#!/usr/bin/env python3
import json
import re
import sys
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


def fetch_standings(league):
    lower = league.lower()
    url = f"{BASE}/{lower}/standings/2026-27/"
    found = {}
    # 順位表もストリーミング表示のため、画面用HTMLでは先頭行などが欠ける。
    # ページ内のFlightデータにあるstandingListを優先して復元する。
    for attempt in range(3):
        request = urllib.request.Request(url, headers={"User-Agent": "JLeagueStadiumSchedule/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            source = response.read().decode("utf-8")
        for script in re.finditer(r"self\.__next_f\.push\((\[1,.*?\])\)</script>", source, re.S):
            try:
                payload = json.loads(script.group(1))[1]
            except (json.JSONDecodeError, IndexError, TypeError):
                continue
            key = '"standingList":'
            position = payload.find(key)
            if position < 0:
                continue
            try:
                standing_list, _ = json.JSONDecoder().raw_decode(payload[position + len(key):])
            except json.JSONDecodeError:
                continue
            if len(standing_list) != 20:
                continue
            return [{
                "rank": str(item.get("ranking", {}).get("value", "-")),
                "team": item.get("club", {}).get("name", ""),
                "points": str(item.get("point", "-")),
                "played": str(item.get("match", "-")),
                "won": str(item.get("win", "-")),
                "drawn": str(item.get("draw", "-")),
                "lost": str(item.get("loss", "-")),
                "goalsFor": str(item.get("goalScored", "-")),
                "goalsAgainst": str(item.get("goalLost", "-")),
                "goalDifference": str(item.get("goalDifference", "-")),
            } for item in standing_list]

        # Flightデータを読めない場合に限り、通常の表から取れた行を補完する。
        root = html.fromstring(source)
        for tr in root.xpath("//table//tr[position()>1]"):
            cells = [" ".join(cell.text_content().split()) for cell in tr.xpath("./th|./td")]
            if len(cells) < 10 or not cells[1]:
                continue
            found[cells[1]] = {
                "rank": cells[0], "team": cells[1], "points": cells[2],
                "played": cells[3], "won": cells[4], "drawn": cells[5],
                "lost": cells[6], "goalsFor": cells[7], "goalsAgainst": cells[8],
                "goalDifference": cells[9],
            }
        if len(found) == 20:
            break
        time.sleep(1)
    rows = sorted(found.values(), key=lambda row: int(row["rank"]) if row["rank"].isdigit() else 999)
    if len(rows) != 20:
        raise RuntimeError(f"{league}の順位表が20チームではありません: {len(rows)}チーム")
    return rows


def write_standings(now, standings):
    output = {
        "updatedAt": now.isoformat(timespec="minutes"),
        "source": f"{BASE}/standings/",
        "leagues": standings,
    }
    (ROOT / "standings.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    schedule_path = ROOT / "schedule.json"
    if schedule_path.exists():
        schedule_output = json.loads(schedule_path.read_text(encoding="utf-8"))
        schedule_output["standings"] = standings
        schedule_output["standingsUpdatedAt"] = now.isoformat(timespec="minutes")
        schedule_path.write_text(json.dumps(schedule_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today = now.strftime("%Y-%m-%d")
    if "--standings-only" in sys.argv:
        standings = {league: fetch_standings(league) for league in LEAGUES}
        write_standings(now, standings)
        print(f"updated standings: {', '.join(f'{league}={len(rows)}' for league, rows in standings.items())}")
        return
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
    standings = {league: fetch_standings(league) for league in LEAGUES}
    output = {
        "updatedAt": now.isoformat(timespec="minutes"),
        "source": f"{BASE}/match/search/",
        "matches": sorted(matches.values(), key=lambda item: (item["date"], item["time"], item["league"], item["id"])),
        "standings": standings,
    }
    (ROOT / "schedule.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_standings(now, standings)
    print(f"updated {len(matches)} matches: {league_counts}")
    print(f"updated standings: {', '.join(f'{league}={len(rows)}' for league, rows in standings.items())}")


if __name__ == "__main__":
    main()
