const fetchOptions = {
  method: 'POST', headers: {
    Authorization: 'Bearer 50291500:992e1f01-2451-4fc6-bed9-e7df5481e06d',
    Checksum: '02afccf9b76c80b3ef2ac24832ac4cdbd0e5c75329d92b2ef45959c152b35605'
  }
};

const fetchUrl = 'https://api.vietlott-sms.vn/mobile-api/customerAccount/getStatisticGbingoResult';

const fetchOffUrl = 'https://bingo18.top/data/data.json';

function handleGetOfflineTotal() {
  const arr = getValues();

  fetch(fetchOffUrl).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTotal(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOfflineTriple() {
  const arr = getValues();

  fetch(fetchOffUrl).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTriple(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOnlineTotal() {
  const arr = getValues();
  fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTotal(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

async function handleGetOnlineTriple() {
  const arr = getValues();
  fetch(fetchUrl, fetchOptions).then(res => res.json()).then(json => {
    const counts = {
      newest: json.gbingoDraws[json.gbingoDraws.length - 1],
      ...countTriple(arr, json.gbingoDraws)
    };
    console.log(counts);
    displayResult(counts);
  });
}

function handleGetOnlineIndexStatistic() {
  fetch(fetchUrl, fetchOptions).then(res => {
    res.json().then(res => {
      const results = res.gbingoDraws;
      const arr = getValues();
      const counts = {
        newest: results[results.length - 1],
        ...countIndex(arr, results)
      };
      console.log(counts);
      displayResult(counts);
    });
  });
}

function getValues() {
  if (!document.querySelector('#check-value').value) return [];
  return document.querySelector('#check-value').value.split(' ').map((item) => parseInt(item));
}

function displayResult(result) {
  const element = document.querySelector('#result');
  element.innerHTML = JSON.stringify(result, null, 2);
}

let subscribeTimer = null;
let lastCheckedAt = null;

function fmtTime(date) {
  return date ? date.toLocaleTimeString() : '-';
}

function updateSubscribeStatus(extra = '') {
  const el = document.querySelector('#subscribe-status');
  if (subscribeTimer === null) {
    el.textContent = '';
    return;
  }
  const nextAt = new Date(Date.now() + msUntilNextSlot());
  el.textContent = `Đang subscribe | Quyền: ${Notification.permission} | Kiểm tra gần nhất: ${fmtTime(lastCheckedAt)} | Lần kế tiếp: ${fmtTime(nextAt)} ${extra}`;
}

async function showNotification(title, body) {
  // Android Chrome và iOS PWA chỉ cho hiện noti qua Service Worker
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon: 'icon-192.png' });
    console.log('[notification] shown (sw):', title);
    return;
  }
  const n = new Notification(title, { body });
  n.onshow = () => console.log('[notification] shown:', title);
  n.onerror = (e) => console.error('[notification] error:', e);
}

function notify(title, body) {
  showNotification(title, body).catch((e) => console.error('[notification] error:', e));
  updateSubscribeStatus(`| ${title}: ${body}`);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.error('[sw] register failed:', e));
}

function getLatestDraw(draws) {
  for (let i = draws.length - 1; i >= 0; i--) {
    if (draws[i].winningResult) return draws[i];
  }
  return null;
}

// Mốc kế tiếp có phút % 6 === 1 (:01, :07, :13, :19, :25, ...), luôn tính lại từ đồng hồ thật để không bị trôi
function msUntilNextSlot(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  do {
    next.setMinutes(next.getMinutes() + 1);
  } while (next.getMinutes() % 6 !== 1);
  return next - now;
}

async function fetchLatestDraw() {
  const res = await fetch(fetchUrl, fetchOptions);
  const json = await res.json();
  lastCheckedAt = new Date();
  return getLatestDraw(json.gbingoDraws);
}

async function subscribeTick() {
  try {
    const draw = await fetchLatestDraw();
    console.log(`[subscribe] ${fmtTime(new Date())} latest=${draw && draw.drawAt}-${draw && draw.winningResult}`);
    if (draw) {
      notify('Kết quả mới nhất', String(draw.winningResult));
    }
  } catch (e) {
    console.error(e);
  }
  if (subscribeTimer === null) return;
  subscribeTimer = setTimeout(subscribeTick, msUntilNextSlot());
  updateSubscribeStatus();
}

async function handleToggleSubscribe() {
  const btn = document.querySelector('#subscribe-btn');
  const status = document.querySelector('#subscribe-status');

  if (subscribeTimer !== null) {
    clearTimeout(subscribeTimer);
    subscribeTimer = null;
    btn.textContent = 'Subscribe';
    status.textContent = '';
    return;
  }

  if (!('Notification' in window)) {
    status.textContent = 'Trình duyệt không hỗ trợ Notification';
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    status.textContent = `Quyền thông báo: ${permission}. Hãy cho phép thông báo cho trang này (cần chạy qua localhost/HTTPS, không dùng file://)`;
    return;
  }

  subscribeTimer = setTimeout(subscribeTick, msUntilNextSlot());
  btn.textContent = 'Unsubscribe';

  // Noti xác nhận
  try {
    const draw = await fetchLatestDraw();
    notify('Đã subscribe', draw ? `Kết quả hiện tại: ${draw.winningResult}` : 'Chưa có kết quả');
  } catch (e) {
    console.error(e);
    notify('Đã subscribe', 'Không lấy được kết quả hiện tại (xem console)');
  }
}
