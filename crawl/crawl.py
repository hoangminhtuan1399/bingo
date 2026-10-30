"""Crawl Bingo18 từ Vietlott (kỳ 0120546 -> 0193830) vào SQLite, ghép thêm kỳ 0083123 -> 0120545 từ NhanAZ.

Bước 1 (crawl): lấy từng trang (6 kỳ/trang) song song, ghi vào crawl_raw.db; chạy lại sẽ làm tiếp.
Bước 2 (build): suy giờ quay theo thứ tự trong ngày và ghi bảng draws vào bingo18.db.

Dùng: python crawl.py crawl [workers]   |   python crawl.py build
"""
import http.client, json, re, sqlite3, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
RAW_DB = HERE / "crawl_raw.db"
FINAL_DB = HERE / "bingo18.db"

HOST = "vietlott.vn"
PATH = "/ajaxpro/Vietlott.PlugIn.WebParts.GameBingoCompareWebPart,Vietlott.PlugIn.WebParts.ashx"
HEADERS = {
    "content-type": "text/plain; charset=UTF-8",
    "origin": "https://vietlott.vn",
    "referer": "https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/winning-number-bingo18",
    "x-ajaxpro-method": "ServerSideDrawResult",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36",
}
FIRST_ID, LAST_ID = 83123, 193830  # 83123..120545 nhập từ NhanAZ-Data/vietlott-research, 120546.. crawl từ Vietlott
PER_DAY, FIRST_SLOT_MIN, STEP_MIN = 159, 6 * 60 + 5, 6  # kỳ đầu 6:05, mỗi kỳ cách 6 phút, kỳ cuối 21:53
TZ = timezone(timedelta(hours=7))
# Ngày có khoảng trống giữa ngày (đối chiếu với giờ thật của bingo18.top): 44 id đầu chạy liên tục từ 6:05
# tới 10:23, rồi 14 khung giờ không có id (10:29-11:47), 101 id cuối chạy từ 11:53 tới 21:53.
# Ngày 03/12/2024 (ngày đầu, chỉ 58 kỳ) giả định kết thúc 21:53 như mọi ngày nên kỳ đầu là 16:11; chưa có giờ thật để kiểm chứng.
GAP_DAYS = {
    datetime(2024, 12, 3).date(): (0, 101),
    datetime(2026, 4, 2).date(): (44, 14),
}  # ngày -> (số id trước khoảng trống, số khung giờ bị bỏ)

_local = threading.local()


def fetch_page(page):
    body = json.dumps({
        "ORenderInfo": {"SiteId": "main.frontend.vi", "SiteAlias": "main.vi", "UserSessionId": "", "SiteLang": "vi",
                        "IsPageDesign": False, "ExtraParam1": "", "ExtraParam2": "", "ExtraParam3": "", "SiteURL": "",
                        "WebPage": None, "SiteName": "Vietlott", "OrgPageAlias": None, "PageAlias": None,
                        "FullPageAlias": None, "RefKey": None, "System": 1},
        "GameId": "8", "GameDrawNo": "", "number": "", "DrawDate": "", "PageIndex": page, "TotalRow": 0,
    }).encode()
    last_err = None
    for attempt in range(8):
        try:
            conn = getattr(_local, "conn", None)
            if conn is None:
                conn = _local.conn = http.client.HTTPSConnection(HOST, timeout=30)
            conn.request("POST", PATH, body, HEADERS)
            resp = conn.getresponse()
            data = resp.read()
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status}")
            html = json.loads(data.decode())["value"]["HtmlContent"]
            rows = []
            for tr in html.split("<tr>")[1:]:
                m = re.search(r">(\d\d/\d\d/\d{4})</a><div><a[^>]*>#(\d+)</a>", tr)
                if not m:
                    continue
                balls = re.findall(r'bong_tron_bingo small">(\d)<', tr)
                if len(balls) != 3:
                    raise RuntimeError(f"bad balls {balls} in {m.group(2)}")
                rows.append((m.group(2), m.group(1), "".join(balls)))
            if not rows:
                raise RuntimeError("no rows")
            return rows
        except Exception as e:
            last_err = e
            _local.conn = None
            time.sleep(min(2 ** attempt, 30) * 0.5)
    raise RuntimeError(f"page {page} failed: {last_err}")


def crawl(workers):
    db = sqlite3.connect(RAW_DB)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS raw(id TEXT PRIMARY KEY, date TEXT NOT NULL, result TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pages_done(page INTEGER PRIMARY KEY);
    """)
    done = {r[0] for r in db.execute("SELECT page FROM pages_done")}
    todo = [p for p in range(12203) if p not in done]
    print(f"{len(done)} trang đã xong, còn {len(todo)}", flush=True)
    t0, n, failed = time.time(), 0, []
    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(fetch_page, p): p for p in todo}
        for f in as_completed(futs):
            p = futs[f]
            try:
                rows = f.result()
            except Exception as e:
                failed.append(p)
                print(f"FAIL {e}", flush=True)
                continue
            db.executemany("INSERT OR IGNORE INTO raw VALUES (?,?,?)", rows)
            db.execute("INSERT OR IGNORE INTO pages_done VALUES (?)", (p,))
            n += 1
            if n % 100 == 0:
                db.commit()
                el = time.time() - t0
                print(f"{n}/{len(todo)} trang, {n / el:.1f} trang/s, ETA {(len(todo) - n) / (n / el) / 60:.1f} phút", flush=True)
    db.commit()
    print(f"XONG crawl. thất bại: {len(failed)} {sorted(failed)[:20]}", flush=True)


def build(final_db=FINAL_DB):
    raw = sqlite3.connect(RAW_DB)
    rows = raw.execute("SELECT id, date, result FROM raw WHERE CAST(id AS INTEGER) BETWEEN ? AND ?", (FIRST_ID, LAST_ID)).fetchall()
    by_day = {}
    for id_, d, res in rows:
        by_day.setdefault(datetime.strptime(d, "%d/%m/%Y").date(), []).append((id_, res))
    # Id cấp liên tục theo từng ngày; server có kỳ bị thiếu giữa ngày (hoặc cuối ngày) nên không đếm theo số dòng.
    # Mỗi ngày là một khối 159 id từ (kỳ cuối ngày trước + 1) tới (kỳ đầu ngày sau - 1), id đầu khối là 6:05.
    days = sorted(by_day)
    out = []
    block_first = FIRST_ID
    for n, day in enumerate(days):
        draws = sorted(by_day[day])
        block_last = int(draws[-1][0]) if n == len(days) - 1 else int(min(by_day[days[n + 1]])[0]) - 1
        size = block_last - block_first + 1
        before_gap, skipped = GAP_DAYS.get(day, (size, 0))
        if size != PER_DAY - skipped:
            raise SystemExit(f"{day}: khối {size} id không khớp GAP_DAYS")
        for id_, res in draws:
            j = int(id_) - block_first
            minute = FIRST_SLOT_MIN + STEP_MIN * (j if j < before_gap else j + skipped)
            ts = datetime(day.year, day.month, day.day, tzinfo=TZ) + timedelta(minutes=minute)
            out.append((id_, ts.isoformat(), res))
        block_first = block_last + 1
    # Kỳ chỉ có ở bingo18.top, Vietlott không cấp id: id giả dạng <id kỳ trước>.<n> để xếp đúng thứ tự
    if raw.execute("SELECT 1 FROM sqlite_master WHERE name='filled_from_bingo18top'").fetchone():
        out += raw.execute("SELECT id, drawn_at, result FROM filled_from_bingo18top WHERE id LIKE '%.%'").fetchall()
    Path(final_db).unlink(missing_ok=True)
    db = sqlite3.connect(final_db)
    db.execute("CREATE TABLE draws(id TEXT PRIMARY KEY, drawn_at TEXT NOT NULL, result TEXT NOT NULL)")
    db.executemany("INSERT INTO draws VALUES (?,?,?)", out)
    db.commit()
    print(f"{len(out)} kỳ, {len(days)} ngày")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "crawl"
    if cmd == "crawl":
        crawl(int(sys.argv[2]) if len(sys.argv) > 2 else 14)
    elif cmd == "build":
        build(sys.argv[2] if len(sys.argv) > 2 else FINAL_DB)
