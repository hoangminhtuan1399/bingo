const HOA_PAYOUT = 120;
const BET_UNIT = 10000;
const HOAS = [1, 2, 3, 4, 5, 6];

let simulation = null;

// Mức cược nhỏ nhất (bội số BET_UNIT) sao cho nếu trúng thì bù được cost + chính tiền cược
// VD: cost = 1.200.000 => 120 * buy >= 1.200.000 + buy => buy = 20.000
// Không thấp hơn baseBet (cược ban đầu)
function getBuy(cost, baseBet) {
  const units = Math.ceil(cost / (HOA_PAYOUT - 1) / BET_UNIT);
  return Math.max(baseBet, units * BET_UNIT);
}

function getHoa(winningResult) {
  const s = winningResult.toString();
  return s[0] === s[1] && s[1] === s[2] ? parseInt(s[0]) : null;
}

// Chiến thuật A: sau mỗi hoa, trong windowSize kì tiếp theo cược các hoa có số kì chưa về < threshold
function createWindowPlanner({ windowSize, threshold, unseen }) {
  const lastSeen = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  let windowLeft = 0;
  return {
    // Trả về { hoa: số kì chưa về } cho các hoa cần cược ở kì index
    targets(index) {
      const targets = {};
      if (windowLeft <= 0) return targets;
      HOAS.forEach((h) => {
        // Số kì đã qua mà hoa chưa về, tính trước kì đang đặt
        const gap = lastSeen[h] === null ? (unseen === 'skip' ? Infinity : index) : index - lastSeen[h] - 1;
        if (gap < threshold) targets[h] = gap;
      });
      windowLeft--;
      return targets;
    },
    update(index, hoa) {
      if (hoa === null) return;
      lastSeen[hoa] = index;
      windowLeft = windowSize;
    }
  };
}

// Chiến thuật B: hoa ra sau >= minGap kì hoa chung => cược hoa đó trong `rounds` kì hoa tiếp theo.
// Chỉ cược khi chưa quá windowSize kì kể từ hoa gần nhất, quá thì dừng chờ hoa tiếp theo (vẫn tính là 1 kì hoa)
function createPlanPlanner({ windowSize, minGap, rounds }) {
  const plans = new Map(); // hoa => số kì hoa còn lại
  let lastTriple = null;
  return {
    targets(index) {
      const targets = {};
      if (lastTriple === null || index - lastTriple > windowSize) return targets;
      plans.forEach((remaining, h) => { targets[h] = index - lastTriple; });
      return targets;
    },
    update(index, hoa) {
      if (hoa === null) return;
      plans.forEach((remaining, h) => {
        if (remaining <= 1) plans.delete(h);
        else plans.set(h, remaining - 1);
      });
      // Hoa đầu tiên trong dữ liệu: chưa biết hoa trước, chỉ tính khi chắc chắn đã >= minGap kì
      const gap = lastTriple === null ? index + 1 : index - lastTriple;
      if (gap >= minGap) plans.set(hoa, rounds);
      lastTriple = index;
    }
  };
}

function simulate(draws, settings) {
  let { capital } = settings;
  const { mode, baseBet, selectedHoas, stopLoss } = settings;
  const planner = settings.strategy === 'plan' ? createPlanPlanner(settings) : createWindowPlanner(settings);
  const cost = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const maxBet = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let maxTotal = { total: 0, index: null };
  let minCapital = { capital, index: null };
  let bustIndex = null;
  const rows = [];
  const wins = [];
  const stopLosses = [];

  draws.forEach(({ winningResult, drawAt }, index) => {
    const hoa = getHoa(winningResult);
    const bets = {};
    const gaps = planner.targets(index);
    let total = 0;

    Object.keys(gaps).map(Number).filter((h) => selectedHoas.includes(h)).forEach((h) => {
      bets[h] = mode === 'fixed' ? baseBet : getBuy(cost[h], baseBet);
      total += bets[h];
      if (bets[h] > maxBet[h]) maxBet[h] = bets[h];
    });

    if (total > maxTotal.total) maxTotal = { total, index };

    capital -= total;
    let payout = 0;
    Object.entries(bets).forEach(([key, buy]) => {
      const h = parseInt(key);
      if (h === hoa) {
        payout = buy * HOA_PAYOUT;
        const benefit = payout - cost[h] - buy;
        wins.push({ index, drawAt, winningResult, hoa: h, cost: cost[h], buy, payout, benefit });
        cost[h] = 0;
      } else {
        cost[h] += buy;
        if (stopLoss > 0 && cost[h] > stopLoss) {
          stopLosses.push({ index, drawAt, hoa: h, cost: cost[h] });
          cost[h] = 0;
        }
      }
    });
    capital += payout;

    if (capital < minCapital.capital) minCapital = { capital, index };
    if (bustIndex === null && capital < 0) bustIndex = index;

    rows.push({ index, drawAt, winningResult, hoa, bets, gaps, total, payout, capital, cost: { ...cost } });

    planner.update(index, hoa);
  });

  return { rows, wins, stopLosses, maxBet, maxTotal, minCapital, bustIndex, finalCost: { ...cost } };
}

function readSettings() {
  return {
    strategy: document.getElementById('strategy').value,
    capital: parseInt(document.getElementById('capital').value) || 0,
    minGap: parseInt(document.getElementById('min-gap').value) || 90,
    rounds: parseInt(document.getElementById('rounds').value) || 3,
    windowSize: parseInt(document.getElementById('window').value) || 36,
    threshold: parseInt(document.getElementById('threshold').value) || 216,
    unseen: document.getElementById('unseen').value,
    mode: document.getElementById('mode').value,
    stopLoss: parseInt(document.getElementById('stop-loss').value) || 0,
    selectedHoas: [...document.querySelectorAll('input[name="hoa"]:checked')].map((el) => parseInt(el.value)),
    // Làm tròn lên bội số BET_UNIT, tối thiểu 1 BET_UNIT
    baseBet: Math.max(1, Math.ceil((parseInt(document.getElementById('base-bet').value) || 0) / BET_UNIT)) * BET_UNIT
  };
}

function toggleStrategyInputs() {
  const plan = document.getElementById('strategy').value === 'plan';
  document.querySelectorAll('.only-window').forEach((el) => { el.hidden = plan; });
  document.querySelectorAll('.only-plan').forEach((el) => { el.hidden = !plan; });
}

async function runStrategy() {
  const status = document.getElementById('status');
  status.textContent = 'Đang tải dữ liệu...';
  try {
    const online = document.getElementById('source').value === 'online';
    const res = online ? await fetch(fetchUrl, fetchOptions) : await fetch(fetchOffUrl);
    const json = await res.json();
    const draws = json.gbingoDraws;
    const settings = readSettings();
    simulation = { settings, draws, ...simulate(draws, settings) };
    status.textContent = `${draws.length} kì, từ ${formatDate(draws[0].drawAt)} đến ${formatDate(draws[draws.length - 1].drawAt)}`;
    renderAll();
  } catch (e) {
    console.error(e);
    status.textContent = `Lỗi: ${e.message}`;
  }
}

function formatMoney(value) {
  return Math.round(value).toLocaleString('vi-VN');
}

function formatDate(drawAt) {
  if (!drawAt) return '';
  const d = new Date(drawAt);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function signClass(value) {
  return value > 0 ? 'pos' : value < 0 ? 'neg' : '';
}

function renderAll() {
  renderSummary();
  renderChart();
  renderMaxTable();
  renderWinTable();
  renderDetail();
}

function renderSummary() {
  const { settings, rows, wins, stopLosses, maxTotal, minCapital, bustIndex } = simulation;
  const stopLossTotal = stopLosses.reduce((sum, s) => sum + s.cost, 0);
  const last = rows[rows.length - 1];
  const profit = last.capital - settings.capital;
  const totalBet = rows.reduce((sum, r) => sum + r.total, 0);
  const betDraws = rows.filter((r) => r.total > 0).length;
  const tiles = [
    ['Vốn cuối', formatMoney(last.capital), ''],
    ['Lãi / lỗ', formatMoney(profit), signClass(profit)],
    ['Vốn thấp nhất', formatMoney(minCapital.capital), minCapital.capital < settings.capital ? 'neg' : ''],
    ['Tổng tiền đã đặt', formatMoney(totalBet), ''],
    ['Số kì có đặt', `${betDraws} / ${rows.length}`, ''],
    ['Số lần trúng', wins.length, ''],
    ['Số lần cắt lỗ', settings.stopLoss > 0 ? `${stopLosses.length} (${formatMoney(stopLossTotal)})` : 'Tắt', stopLosses.length ? 'neg' : ''],
    ['Tổng lớn nhất 1 kì', formatMoney(maxTotal.total), ''],
    ['Cháy vốn', bustIndex === null ? 'Không' : `Kì #${bustIndex} (${formatDate(rows[bustIndex].drawAt)})`, bustIndex === null ? '' : 'neg']
  ];
  document.getElementById('summary').innerHTML = tiles.map(([label, value, cls]) =>
    `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value ${cls}">${value}</div></div>`
  ).join('');
}

function renderMaxTable() {
  const { maxBet, maxTotal, rows, finalCost } = simulation;
  const head = HOAS.map((h) => `<th>Hoa ${h}</th>`).join('') + '<th>Tổng 1 kì</th>';
  const maxCells = HOAS.map((h) => `<td>${formatMoney(maxBet[h])}</td>`).join('') +
    `<td><b>${formatMoney(maxTotal.total)}</b>${maxTotal.index === null ? '' : `<div class="muted">kì #${maxTotal.index} · ${formatDate(rows[maxTotal.index].drawAt)}</div>`}</td>`;
  const costCells = HOAS.map((h) => `<td>${formatMoney(finalCost[h])}</td>`).join('') + '<td></td>';
  document.getElementById('max-table').innerHTML =
    `<table><thead><tr><th></th>${head}</tr></thead><tbody>` +
    `<tr><th>Cược lớn nhất</th>${maxCells}</tr>` +
    `<tr><th>Cost hiện tại</th>${costCells}</tr>` +
    '</tbody></table>';
}

function renderWinTable() {
  const { wins } = simulation;
  if (!wins.length) {
    document.getElementById('win-table').innerHTML = '<p class="muted">Chưa có lần trúng nào</p>';
    return;
  }
  const body = wins.map((w) => `<tr>
    <td>#${w.index}</td><td>${formatDate(w.drawAt)}</td><td>${w.winningResult}</td><td>Hoa ${w.hoa}</td>
    <td>${formatMoney(w.cost)}</td><td>${formatMoney(w.buy)}</td><td>${formatMoney(w.payout)}</td>
    <td class="${signClass(w.benefit)}">${formatMoney(w.benefit)}</td></tr>`).join('');
  document.getElementById('win-table').innerHTML =
    '<table><thead><tr><th>Kì</th><th>Thời gian</th><th>Kết quả</th><th>Hoa</th><th>Cost</th><th>Cược</th><th>Trúng</th><th>Benefit</th></tr></thead>' +
    `<tbody>${body}</tbody></table>`;
}

function renderDetail() {
  return
  if (!simulation) return;
  const rows = simulation.rows.slice().reverse();
  const head = HOAS.map((h) => `<th>Hoa ${h}</th>`).join('');
  const body = rows.map((r) => {
    const cells = HOAS.map((h) => {
      const bet = r.bets[h];
      if (bet === undefined) return '<td class="muted">–</td>';
      const cls = r.hoa === h ? 'win' : '';
      return `<td class="${cls}">${formatMoney(bet)}<div class="muted">${r.gaps[h]} kì</div></td>`;
    }).join('');
    const net = r.payout - r.total;
    return `<tr class="${r.hoa !== null ? 'hoa-row' : ''}">
      <td>#${r.index}</td><td>${formatDate(r.drawAt)}</td><td>${r.winningResult}</td>${cells}
      <td>${r.total ? `<b>${formatMoney(r.total)}</b>` : ''}</td><td>${r.payout ? formatMoney(r.payout) : ''}</td>
      <td class="${signClass(net)}">${net ? formatMoney(net) : ''}</td><td>${formatMoney(r.capital)}</td></tr>`;
  }).join('');
  document.getElementById('detail-table').innerHTML =
    `<table><thead><tr><th>Kì</th><th>Thời gian</th><th>Kết quả</th>${head}<th>Tổng đặt</th><th>Trúng</th><th>+/−</th><th>Vốn</th></tr></thead>` +
    `<tbody>${body}</tbody></table>`;
}

function renderChart() {
  const { rows, settings } = simulation;
  const container = document.getElementById('chart');
  const W = Math.max(320, container.clientWidth || 1000), H = 280, pad = { l: 90, r: 16, t: 12, b: 28 };
  const values = rows.map((r) => r.capital);
  let min = Math.min(settings.capital, ...values);
  let max = Math.max(settings.capital, ...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.05;
  max += span * 0.05;
  const x = (i) => pad.l + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  const ticks = [];
  for (let i = 0; i <= 4; i++) ticks.push(min + ((max - min) * i) / 4);
  const grid = ticks.map((v) =>
    `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/>` +
    `<text x="${pad.l - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${formatMoney(v)}</text>`
  ).join('');
  const baseline = `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(settings.capital)}" y2="${y(settings.capital)}" class="baseline"/>`;
  // Đường bậc thang: vốn giữ nguyên giữa các kì, chỉ đổi đúng tại kì có đặt / trúng
  const path = `M${x(0).toFixed(1)},${y(settings.capital).toFixed(1)}` +
    values.map((v, i) => `H${x(i).toFixed(1)}V${y(v).toFixed(1)}`).join('');
  const winDots = simulation.wins.map((w) =>
    `<circle cx="${x(w.index)}" cy="${y(rows[w.index].capital)}" r="4" class="win-dot"/>`).join('');
  const xLabels = [0, Math.floor((rows.length - 1) / 2), rows.length - 1].map((i, k) =>
    `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="${['start', 'middle', 'end'][k]}">${formatDate(rows[i].drawAt)}</text>`
  ).join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vốn qua từng kì">
      ${grid}${baseline}<path d="${path}" class="line"/>${winDots}${xLabels}
      <line class="cross" y1="${pad.t}" y2="${H - pad.b}" x1="0" x2="0" visibility="hidden"/>
      <rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" class="hit"/>
    </svg><div class="tooltip" hidden></div>`;

  const svg = container.querySelector('svg');
  const cross = svg.querySelector('.cross');
  const tooltip = container.querySelector('.tooltip');
  svg.querySelector('.hit').addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((svgX - pad.l) / (W - pad.l - pad.r)) * (rows.length - 1))));
    const r = rows[i];
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    tooltip.hidden = false;
    tooltip.innerHTML = `<b>#${r.index}</b> · ${formatDate(r.drawAt)} · ${r.winningResult}<br>` +
      `Vốn: <b>${formatMoney(r.capital)}</b><br>Đặt: ${formatMoney(r.total)}${r.payout ? `<br>Trúng: ${formatMoney(r.payout)}` : ''}`;
    const left = (x(i) / W) * rect.width;
    tooltip.style.left = `${Math.min(left + 12, rect.width - tooltip.offsetWidth)}px`;
  });
  svg.querySelector('.hit').addEventListener('mouseleave', () => {
    cross.setAttribute('visibility', 'hidden');
    tooltip.hidden = true;
  });
}
