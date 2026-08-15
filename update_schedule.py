#!/usr/bin/env python3
import json
import re
import time
import urllib.request
import calendar
from datetime import datetime
from pathlib import Path
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


def fetch_month(league, month):
    year, number = int(month[:4]), int(month[4:])
    last_day = calendar.monthrange(year, number)[1]
    start_date = f"{year:04d}-{number:02d}-01"
    end_date = f"{year:04d}-{number:02d}-{last_day:02d}"
    lower = league.lower()
    url = f"{BASE}/{lower}/match/search-list/?category={lower}&startdate={start_date}&enddate={end_date}&period=custom"
    request = urllib.request.Request(url, headers={"User-Agent": "JLeagueStadiumSchedule/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        source = response.read().decode("utf-8")

    # Jリーグ公式サイトはNext.jsのストリーミング表示を使っているため、
    # 通常のHTMLだけでは一部の試合がプレースホルダーのままになる。
    # ページ内のFlightデータを復元して、後から表示される試合も取得する。
    root = html.fromstring(source)
    expected_ids = {
        card.get("id")
        for card in root.xpath("//div[contains(concat(' ', normalize-space(@class), ' '), ' m-schedule ')][@id]")
        if card.get("id", "").isdigit()
    }
    matches = {}
    script_pattern = re.compile(r"self\.__next_f\.push\((\[1,.*?\])\)</script>", re.S)
    href_pattern = re.compile(rf'href":"/match/{lower}/{year}/(\d{{6}})')
    team_pattern = re.compile(r'm-schedule__team-name.*?data-media":"pc","children":"([^"]+)')
    time_pattern = re.compile(r'm-schedule__time-text.*?children":"([^"]+)')
    stadium_pattern = re.compile(r'm-schedule__info-stadium.*?data-media":"pc","children":"([^"]+)')

    for script in script_pattern.finditer(source):
        try:
            payload = json.loads(script.group(1))[1]
        except (json.JSONDecodeError, IndexError, TypeError):
            continue
        for line in payload.splitlines():
            if f"/match/{lower}/{year}/" not in line or "m-schedule__team-home" not in line:
                continue
            href = href_pattern.search(line)
            teams = team_pattern.findall(line)
            if not href or len(teams) < 2:
                continue
            match_id = f"{year}{href.group(1)}"
            kickoff = time_pattern.findall(line)
            stadium = stadium_pattern.findall(line)
            matches[match_id] = {
            "id": f"{league}-{match_id}",
            "date": f"{match_id[:4]}-{match_id[4:6]}-{match_id[6:8]}",
            "time": kickoff[0] if kickoff else "未定",
            "league": league,
            "home": teams[0],
            "away": teams[1],
            "stadium": stadium[0] if stadium else "会場未定",
            "url": f"{BASE}/match/{lower}/{year}/{href.group(1)}/",
            }

    missing = sorted(expected_ids - matches.keys())
    if missing:
        raise RuntimeError(f"{league} {month} の試合を完全に取得できませんでした: {', '.join(missing)}")
    return list(matches.values())


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
