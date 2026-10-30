# bingo backend (Node + Turso, deploy lên Render)

Phục vụ kết quả offline từ bảng `draws` và nhận kì mới từ nút "Sync onl → DB" của app.
Không có `TURSO_DATABASE_URL` thì đọc/ghi thẳng file `crawl/bingo18.db` (`npm start`, cổng 8787).

## API
- `GET /data.json` — `{ gbingoDraws: [{ drawAt, winningResult }] }` cùng định dạng `fetchOffUrl` cũ. Tham số: `from`, `to` (YYYY-MM-DD), `limit` (N kì mới nhất)
- `GET /draws` — như trên kèm `id`
- `GET /latest`, `GET /health`
- `POST /sync` — body `{ gbingoDraws }` lấy từ API online; chỉ thêm kì mới hơn kì cuối trong DB

## Biến môi trường
| Biến | Ý nghĩa |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Database trên Turso |
| `SYNC_TOKEN` | Nếu đặt, `POST /sync` phải gửi header `X-Sync-Token` đúng |
| `ALLOWED_ORIGINS` | Origin trang web được gọi `POST /sync` (mặc định GitHub Pages; localhost luôn được) |
| `PORT`, `BINGO_DB` | Cổng và đường dẫn DB local (chỉ dùng khi không có Turso) |

## Triển khai
1. Tạo database trên Turso bằng [Turso CLI](https://docs.turso.tech/cli/installation). Windows cần WSL: mở PowerShell, gõ `wsl`, rồi cài CLI:
   ```sh
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login --headless        # trong WSL dùng --headless
   turso db create bingo
   turso db show bingo --url          # TURSO_DATABASE_URL
   turso db tokens create bingo       # TURSO_AUTH_TOKEN
   ```
2. Nhập dữ liệu hiện có (chạy một lần, cần Node ≥ 22.13). PowerShell, ở thư mục gốc repo:
   ```powershell
   $env:TURSO_DATABASE_URL = "libsql://..."
   $env:TURSO_AUTH_TOKEN = "..."
   node server/import-to-turso.mjs
   ```
   (bash/WSL: `TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node server/import-to-turso.mjs`)
3. Render: **New → Blueprint**, chọn repo (đọc `render.yaml` ở thư mục gốc), điền `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` và một `SYNC_TOKEN` tự đặt.
4. Sửa `fetchOffUrl` và `syncUrl` trong `config.js` sang URL của Render rồi push. Lần đầu bấm "Sync onl → DB" app sẽ hỏi `SYNC_TOKEN` và nhớ trong trình duyệt.

Bản Free của Render ngủ sau 15 phút không có truy cập, request đầu tiên sau đó chậm vì phải khởi động lại và nạp dữ liệu từ Turso.
