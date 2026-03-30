const TOTAL = 15, ML = 200, GOAL = 3000;
  const CIRCUMFERENCE = 2 * Math.PI * 65; // ~408.4

  let filled = 0;
  const now = new Date();
  const TODAY = getTodayKey(now);

  const dateBadgeEl = document.getElementById('date-badge');
  const grid = document.getElementById('cups-grid');
const ringEl = document.getElementById('ring');
const ringMlEl = document.getElementById('ring-ml');
const ringPctEl = document.getElementById('ring-pct');
const progressEl = document.getElementById('hydration-progress');
const cupsEl = document.getElementById('s-cups');
const litersEl = document.getElementById('s-liters');
const remainingEl = document.getElementById('s-rem');
const motivEl = document.getElementById('motiv');
const congratsEl = document.getElementById('congrats');
const historyListEl = document.getElementById('history-list');
const statusEl = document.getElementById('sr-status');
const btnAdd = document.getElementById('btn-add');
const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
let lastStatusMessage = '';

  // ── Storage helpers ──
  function getTodayKey(date = new Date()) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function clampFilled(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(Math.trunc(value), 0), TOTAL);
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function loadState() {
    const raw = readStorage('hydro_' + TODAY);
    return clampFilled(Number.parseInt(raw, 10));
  }

  function saveState(n) {
    const safeFilled = clampFilled(n);
    writeStorage('hydro_' + TODAY, String(safeFilled));
    saveHistory(safeFilled);
  }

  function saveHistory(n) {
    const hist = getHistory();
    hist[TODAY] = clampFilled(n);
    writeStorage('hydro_history', JSON.stringify(hist));
  }

  function getHistory() {
    const raw = readStorage('hydro_history');

    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  // ── Date badge ──
  const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  dateBadgeEl.textContent = days[now.getDay()] + ', ' + now.getDate() + ' de ' + months[now.getMonth()];

  // ── Build cups ──
  const cupEls = [];

  for (let i = 0; i < TOTAL; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cup-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `Copo ${i+1} — ${(i+1)*ML} ml`);
    btn.innerHTML = `
      <div class="cup-inner">
        <div class="cup-water"></div>
        <div class="cup-drop">💧</div>
      </div>
      <div class="cup-num">${(i+1)*ML >= 1000 ? ((i+1)*ML/1000).toFixed(1)+'L' : (i+1)*ML+'ml'}</div>
    `;
    btn.addEventListener('click', () => handleCupClick(i));
    grid.appendChild(btn);
    cupEls.push(btn);
  }

  function handleCupState(idx, isFilled) {
    const cupEl = cupEls[idx];

    if (!cupEl) return;

    cupEl.classList.toggle('filled', isFilled);
    cupEl.setAttribute('aria-pressed', String(isFilled));
  }

  function handleCupClick(idx) {
    if (idx === filled) {
      fill(idx);
    } else if (idx < filled) {
      // unfill all from idx+1 onward
      for (let i = filled - 1; i >= idx + 1; i--) unfill(i);
      unfill(idx);
      filled = idx;
      saveState(filled);
      update();
      return;
    }
    update();
  }

  function fill(idx) {
    if (idx < 0 || idx >= TOTAL) return;

    // ripple
    const rip = document.createElement('div');
    rip.className = 'ripple';
    cupEls[idx].querySelector('.cup-inner').appendChild(rip);
    setTimeout(() => rip.remove(), 600);
    filled = idx + 1;
    handleCupState(idx, true);
    saveState(filled);
  }

  function unfill(idx) {
    handleCupState(idx, false);
  }

  // ── Update UI ──
  const motivMessages = [
    '💧 Vamos lá! Beba o primeiro copo.',
    '🌊 Ótimo começo! Continue assim.',
    '💪 Você está indo bem! Não para.',
    '🐟 Quase na metade! Beba mais.',
    '🌿 Metade da meta! Você consegue.',
    '⚡ Mais da metade! Falta pouco.',
    '🚀 Está quase lá! Só mais alguns.',
    '🏁 Reta final! Quase na meta.',
    '✨ Incrível! Só mais um pouquinho.',
    '🎯 Um copo pra meta! Bora!',
    '🎉 Meta batida! Você é hidratado(a)!'
  ];

function getMotiv(cups) {
  if (cups === TOTAL) return motivMessages[motivMessages.length - 1];
  const stepCount = motivMessages.length - 1;
  const index = Math.min(Math.floor(cups / (TOTAL / stepCount)), stepCount - 1);
  return motivMessages[index];
}

function buildStatusMessage(ml, pct) {
  if (filled === TOTAL) {
    return `Meta batida com ${ml.toLocaleString('pt-BR')} mililitros, equivalente a ${TOTAL} copos.`;
  }

  return `Progresso atualizado: ${filled} de ${TOTAL} copos, ${ml.toLocaleString('pt-BR')} mililitros, ${pct}% da meta diária.`;
}

function announceStatus(message) {
  if (!statusEl || message === lastStatusMessage) return;

  lastStatusMessage = message;
  statusEl.textContent = '';
  window.setTimeout(() => {
    statusEl.textContent = message;
  }, 0);
}

function update(shouldAnnounce = true) {
  filled = clampFilled(filled);

  const ml = filled * ML;
  const pct = Math.round(ml / GOAL * 100);
  const clampedPct = Math.min(pct, 100);
  const liters = (ml / 1000).toFixed(1).replace('.', ',');

  // Ring
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * clampedPct / 100);
  ringEl.style.strokeDashoffset = offset;
  ringMlEl.textContent = ml.toLocaleString('pt-BR') + ' ml';
  ringPctEl.textContent = clampedPct + '%';
  progressEl.setAttribute('aria-valuenow', String(ml));
  progressEl.setAttribute('aria-valuetext', `${ml.toLocaleString('pt-BR')} de ${GOAL.toLocaleString('pt-BR')} mililitros (${clampedPct}%)`);

  // Stats
  cupsEl.textContent = filled;
    litersEl.textContent = liters + ' L';
    remainingEl.textContent = TOTAL - filled;

    // Motivational
    motivEl.textContent = getMotiv(filled);

    // Congrats
    congratsEl.classList.toggle('show', filled === TOTAL);

    // Cups visual
    for (let i = 0; i < TOTAL; i++) {
      handleCupState(i, i < filled);
    }

    btnAdd.disabled = filled >= TOTAL;
  btnUndo.disabled = filled === 0;
  btnReset.disabled = filled === 0;

  if (shouldAnnounce) {
    announceStatus(buildStatusMessage(ml, clampedPct));
  }

  renderHistory();
}

  // ── Buttons ──
  btnAdd.addEventListener('click', () => {
    if (filled < TOTAL) { fill(filled); update(); }
  });

  btnUndo.addEventListener('click', () => {
    if (filled > 0) {
      filled--;
      unfill(filled);
      saveState(filled);
      update();
    }
  });

  btnReset.addEventListener('click', () => {
    if (!confirm('Zerar o progresso de hoje?')) return;
    filled = 0;
    saveState(0);
    update();
  });

  // ── History ──
  function renderHistory() {
    const hist = getHistory();
    const entries = Object.entries(hist)
      .filter(([date]) => date !== TODAY && /^\d{4}-\d{2}-\d{2}$/.test(date))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6);

  if (entries.length === 0) {
    historyListEl.innerHTML = '<li class="history-empty">Nenhum registro anterior ainda.</li>';
    return;
  }

  historyListEl.innerHTML = entries.map(([date, cups]) => {
      const safeCups = clampFilled(Number(cups));
      const ml = safeCups * ML;
      const pct = Math.min(Math.round(ml / GOAL * 100), 100);
      const [y, m, d] = date.split('-');
    const label = d + '/' + m + '/' + y;
    return `
      <li class="history-item">
        <span class="history-date">${label}</span>
        <div class="history-bar-wrap">
          <div class="history-bar" style="width:${pct}%"></div>
        </div>
        <span class="history-val">${(ml/1000).toFixed(1).replace('.',',')} L</span>
      </li>
    `;
  }).join('');
}

  // ── Ring circumference setup ──
  ringEl.style.strokeDasharray = CIRCUMFERENCE;
  ringEl.style.strokeDashoffset = CIRCUMFERENCE;

// ── Init ──
filled = loadState();
update(false);
