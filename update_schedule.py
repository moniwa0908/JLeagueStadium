#!/usr/bin/env python3
import json
import time
import urllib.request
import calendar
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from lxml import html

BASE = "https://www.jleague.jp"
LEAGUES = ("J1", "J2", "J3")
MONTHS_AHEAD = 11
ROOT = Path(__file__).resolve().parent


def month_keys(start, count):
    year, month = start.year, start.month
    for offset in range(count + 1):
        value = year * 12 + month - 1 + offset
        yield f"{value // 12:04d}{value % 12 + 1:02d}"


def text_one(node, xpath):
    found = node.xpath(xpath)
    return " ".join(found[0].text_content().split()) if found else ""


def fetch_month(league, month):
    year, number = int(month[:4]), int(month[4:])
    last_day = calendar.monthrange(year, number)[1]
    start_date = f"{year:04d}-{number:02d}-01"
    end_date = f"{year:04d}-{number:02d}-{last_day:02d}"
    lower = league.lower()
    url = f"{BASE}/{lower}/match/search-list/?category={lower}&startdate={start_date}&enddate={end_date}&period=custom"
    request = urllib.request.Request(url, headers={"User-Agent": "JLeagueStadiumSchedule/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = html.fromstring(response.read())
    matches = []
    for card in root.xpath("//div[contains(concat(' ', normalize-space(@class), ' '), ' m-schedule ')][@id]"):
        match_id = card.get("id", "")
        if len(match_id) < 8 or not match_id[:8].isdigit():
            continue
        home = text_one(card, ".//*[contains(@class,'m-schedule__team-home')]//*[contains(@class,'m-schedule__team-name')][@data-media='pc']")
        away = text_one(card, ".//*[contains(@class,'m-schedule__team-away')]//*[contains(@class,'m-schedule__team-name')][@data-media='pc']")
        kickoff = text_one(card, ".//*[contains(@class,'m-schedule__time-text')]")
        stadium = text_one(card, ".//*[contains(@class,'m-schedule__info-stadium')][@data-media='pc']")
        links = card.xpath(".//a[contains(@class,'m-schedule__link')]/@href")
        if not (home and away):
            continue
        matches.append({
            "id": f"{league}-{match_id}",
            "date": f"{match_id[:4]}-{match_id[4:6]}-{match_id[6:8]}",
            "time": kickoff or "未定",
            "league": league,
            "home": home,
            "away": away,
            "stadium": stadium or "会場未定",
            "url": urljoin(BASE, links[0]) if links else f"{BASE}/match/search/{league.lower()}/",
        })
    return matches


def main():
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today = now.strftime("%Y-%m-%d")
    matches = {}
    league_counts = {}
    for league in LEAGUES:
        found = 0
        for month in month_keys(now, MONTHS_AHEAD):
            for match in fetch_month(league, month):
                if match["date"] >= today:
                    matches[match["id"]] = match
                    found += 1
            time.sleep(0.25)
        if found == 0:
            raise RuntimeError(f"{league}の日程を取得できませんでした。既存データを更新しません。")
        league_counts[league] = found
    if not matches:
        raise RuntimeError("日程を1件も取得できませんでした。既存データを更新しません。")
    output = {
        "updatedAt": now.isoformat(timespec="minutes"),
        "source": f"{BASE}/match/search/",
        "matches": sorted(matches.values(), key=lambda item: (item["date"], item["time"], item["league"], item["id"])),
    }
    (ROOT / "schedule.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"updated {len(matches)} matches: {league_counts}")


if __name__ == "__main__":
    main()
