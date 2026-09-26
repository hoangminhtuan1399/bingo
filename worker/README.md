# bingo-push (Cloudflare Worker)

Chạy cron mỗi phút, đọc kết quả từ bingo18.top (API Vietlott chặn IP ngoài Việt Nam, cron chạy ở Singapore) và chỉ gửi Web Push khi kì mới nhất là hoa, kèm số kì chưa ra hoa trước đó. Không gửi push khi không có hoa vì iOS hiện noti cho mọi push.
Kiểm tra Worker đọc được dữ liệu không: mở `https://bingo-push.bingo-net.workers.dev/latest`.

## Triển khai

```sh
cd worker
npx wrangler login
npx wrangler kv namespace create SUBS        # lấy id dán vào wrangler.toml
node generate-vapid.mjs                       # sinh cặp khoá VAPID
```

1. Sửa `wrangler.toml`: `id` của KV, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (mailto của bạn), `ALLOWED_ORIGIN` (origin GitHub Pages, không có path).
2. Đặt secret:
   ```sh
   npx wrangler secret put VAPID_PRIVATE_JWK     # dán chuỗi JSON từ generate-vapid.mjs
   npx wrangler deploy
   ```
3. Dán URL của Worker (in ra sau `deploy`) vào `../config.js`.
4. Xem log cron: `npx wrangler tail`.
