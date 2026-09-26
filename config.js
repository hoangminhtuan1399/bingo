// URL của Cloudflare Worker (xem worker/README.md)
const WORKER_URL = 'https://bingo-push.bingo-net.workers.dev';

const fetchOptions = {
  method: 'POST', headers: {
    Authorization: 'Bearer 50291500:992e1f01-2451-4fc6-bed9-e7df5481e06d',
    Checksum: '02afccf9b76c80b3ef2ac24832ac4cdbd0e5c75329d92b2ef45959c152b35605'
  }
};

const fetchUrl = 'https://api.vietlott-sms.vn/mobile-api/customerAccount/getStatisticGbingoResult';

const fetchOffUrl = 'https://bingo18.top/data/data.json';

// Nội dung noti kết quả, dùng chung cho sw.js và event.js
function formatDrawNotification(draw) {
  if (!draw || !draw.winningResult) return 'Chưa có kết quả';
  if (draw.hoa === null || draw.hoa === undefined) return `${draw.winningResult} (không phải hoa)`;
  const gap = draw.prevHoaGap === null ? `≥${draw.total - 1}` : draw.prevHoaGap;
  return `${draw.winningResult} - Hoa ${draw.hoa}\nChưa ra hoa trước đó: ${gap} kì`;
}
