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

function getHoa(winningResult) {
  const s = String(winningResult);
  return s[0] === s[1] && s[1] === s[2] ? parseInt(s[0]) : null;
}

// Gọi API ngay trên máy người dùng (Vietlott chặn IP ngoài Việt Nam nên không gọi từ Worker).
// Trả về kì mới nhất, hoa (null nếu không phải hoa) và số kì chưa ra hoa trước đó
// (VD hoa ở kì 100 và 180 -> 80). prevHoaGap = null nếu không thấy hoa trước đó trong `total` kì
async function fetchLatestDraw() {
  const json = await (await fetch(fetchUrl, fetchOptions)).json();
  const draws = (json.gbingoDraws || []).filter((d) => d.winningResult);
  if (!draws.length) return null;
  const last = draws.length - 1;
  const { winningResult, drawAt } = draws[last];
  const hoa = getHoa(winningResult);
  let prevHoaGap = null;
  if (hoa !== null) {
    for (let i = last - 1; i >= 0; i--) {
      if (getHoa(draws[i].winningResult) !== null) {
        prevHoaGap = last - i;
        break;
      }
    }
  }
  return { winningResult, drawAt, hoa, prevHoaGap, total: draws.length };
}

// Nội dung noti kết quả, dùng chung cho sw.js và event.js
function formatDrawNotification(draw) {
  if (!draw || !draw.winningResult) return 'Chưa có kết quả';
  if (draw.hoa === null || draw.hoa === undefined) return `${draw.winningResult} (không phải hoa)`;
  const gap = draw.prevHoaGap === null ? `≥${draw.total - 1}` : draw.prevHoaGap;
  return `${draw.winningResult} - Hoa ${draw.hoa}\nChưa ra hoa trước đó: ${gap} kì`;
}
