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

function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function postJson(path, body) {
  return fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.error('[sw] register failed:', e));
}

async function refreshSubscribeUi() {
  const btn = document.querySelector('#subscribe-btn');
  const status = document.querySelector('#subscribe-status');
  if (!pushSupported) {
    status.textContent = 'Trình duyệt không hỗ trợ push (iOS: cần Add to Home Screen từ Safari, rồi mở app từ icon)';
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  btn.textContent = sub ? 'Unsubscribe' : 'Subscribe';
  status.textContent = sub ? 'Đang subscribe: sẽ báo khi có hoa, kể cả khi đóng app' : '';
}

async function handleToggleSubscribe() {
  const status = document.querySelector('#subscribe-status');
  if (!pushSupported) return refreshSubscribeUi();

  // Phải gọi ngay trong user gesture (iOS rất nghiêm ngặt việc này)
  const permissionPromise = Notification.permission === 'default'
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission);

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      await postJson('/unsubscribe', { endpoint: existing.endpoint });
      await existing.unsubscribe();
      return refreshSubscribeUi();
    }

    const permission = await permissionPromise;
    if (permission !== 'granted') {
      status.textContent = `Quyền thông báo: ${permission}. Hãy cho phép thông báo cho trang này`;
      return;
    }

    const publicKey = await (await fetch(`${WORKER_URL}/vapid-public-key`)).text();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    const res = await postJson('/subscribe', sub.toJSON());
    if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);

    // Noti xác nhận
    const draw = await fetchLatestDraw();
    await reg.showNotification('Đã subscribe', {
      body: formatDrawNotification(draw),
      icon: 'icon-192.png'
    });
    await refreshSubscribeUi();
  } catch (e) {
    console.error(e);
    status.textContent = `Lỗi: ${e.message}`;
  }
}

refreshSubscribeUi();
