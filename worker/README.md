# bingo-push (Cloudflare Worker)

Chạy cron mỗi 6 phút (phút :01, :07, ...) và gửi Web Push rỗng tới các thiết bị đã subscribe. Worker không gọi API Vietlott (chặn IP ngoài Việt Nam); service worker trên máy người dùng tự gọi API và chỉ hiện noti khi có hoa.

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
