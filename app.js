const TOTAL = 15;
const ML = 200;
const GOAL = 3000;
const CIRCUMFERENCE = 2 * Math.PI * 65;
const STORAGE_KEY = 'hydro_state_v2';
const LEGACY_HISTORY_KEY = 'hydro_history';
const LEGACY_DAY_PREFIX = 'hydro_';

let todayKey = getTodayKey();
let filled = 0;
let lastStatusMessage = '';

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

function getTodayKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function clampFilled(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), TOTAL);
}

function formatDateBadge(date = new Date()) {
  const days = ['Domingo', 'Segunda', 'Ter\u00e7a', 'Quarta', 'Quinta', 'Sexta', 'S\u00e1bado'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return days[date.getDay()] + ', ' + date.getDate() + ' de ' + months[date.getMonth()];
}

function updateDateBadge(date = new Date()) {
  dateBadgeEl.textContent = formatDateBadge(date);
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

function sanitizeHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};

  return Object.entries(history).reduce((acc, [date, cups]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      acc[date] = clampFilled(Number(cups));
    }

    return acc;
  }, {});
}

function createEmptyState() {
  return {
    version: 2,
    currentDay: todayKey,
    currentFilled: 0,
    history: { [todayKey]: 0 }
  };
}

function loadLegacyState() {
  const rawToday = readStorage(LEGACY_DAY_PREFIX + todayKey);
  const rawHistory = readStorage(LEGACY_HISTORY_KEY);

  if (rawToday === null && rawHistory === null) {
    return createEmptyState();
  }

  let history = {};

  if (rawHistory) {
    try {
      history = sanitizeHistory(JSON.parse(rawHistory));
    } catch {
      history = {};
    }
  }

  const todayValue = rawToday === null ? history[todayKey] : rawToday;
  const todayFilled = clampFilled(Number.parseInt(String(todayValue ?? ''), 10));
  history[todayKey] = todayFilled;

  return {
    version: 2,
    currentDay: todayKey,
    currentFilled: todayFilled,
    history
  };
}

function normalizeState(rawState) {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return createEmptyState();
  }

  const history = sanitizeHistory(rawState.history);
  const savedDay = typeof rawState.currentDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawState.currentDay)
    ? rawState.currentDay
    : todayKey;
  const savedFilled = clampFilled(Number(rawState.currentFilled));

  history[savedDay] = savedFilled;

  const currentFilled = savedDay === todayKey
    ? savedFilled
    : clampFilled(Number(history[todayKey]));

  history[todayKey] = currentFilled;

  return {
    version: 2,
    currentDay: todayKey,
    currentFilled,
    history
  };
}

function loadState() {
  const raw = readStorage(STORAGE_KEY);

  if (!raw) {
    return loadLegacyState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return loadLegacyState();
  }
}

const state = loadState();
filled = clampFilled(state.currentFilled);

function persistState() {
  state.version = 2;
  state.currentDay = todayKey;
  state.currentFilled = clampFilled(filled);
  state.history = sanitizeHistory(state.history);
  state.history[todayKey] = state.currentFilled;
  writeStorage(STORAGE_KEY, JSON.stringify(state));
}

function saveState(nextFilled) {
  filled = clampFilled(nextFilled);
  persistState();
}

function getHistory() {
  state.history = sanitizeHistory(state.history);
  return state.history;
}

function syncToday(date = new Date()) {
  const nextTodayKey = getTodayKey(date);
  updateDateBadge(date);

  if (nextTodayKey === todayKey) {
    return false;
  }

  todayKey = nextTodayKey;
  filled = clampFilled(Number(state.history[todayKey]));
  state.currentDay = todayKey;
  state.currentFilled = filled;
  state.history[todayKey] = filled;
  persistState();

  return true;
}

updateDateBadge();

const cupEls = [];

for (let i = 0; i < TOTAL; i++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cup-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', `Copo ${i + 1} - ${(i + 1) * ML} ml`);
  btn.innerHTML = `
    <div class="cup-inner">
      <div class="cup-water"></div>
      <div class="cup-drop">&#128167;</div>
    </div>
    <div class="cup-num">${(i + 1) * ML >= 1000 ? ((i + 1) * ML / 1000).toFixed(1) + 'L' : (i + 1) * ML + 'ml'}</div>
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
    for (let i = filled - 1; i >= idx + 1; i--) {
      unfill(i);
    }

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

  const cupInner = cupEls[idx]?.querySelector('.cup-inner');

  if (cupInner) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    cupInner.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 600);
  }

  filled = idx + 1;
  handleCupState(idx, true);
  saveState(filled);
}

function unfill(idx) {
  handleCupState(idx, false);
}

const motivMessages = [
  'Vamos l\u00e1! Beba o primeiro copo.',
  '\u00d3timo come\u00e7o! Continue assim.',
  'Voc\u00ea est\u00e1 indo bem! N\u00e3o para.',
  'Quase na metade! Beba mais.',
  'Metade da meta! Voc\u00ea consegue.',
  'Mais da metade! Falta pouco.',
  'Est\u00e1 quase l\u00e1! S\u00f3 mais alguns.',
  'Reta final! Quase na meta.',
  'Incr\u00edvel! S\u00f3 mais um pouquinho.',
  'Um copo para a meta! Bora!',
  'Meta batida! Voc\u00ea est\u00e1 hidratado(a)!'
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

  return `Progresso atualizado: ${filled} de ${TOTAL} copos, ${ml.toLocaleString('pt-BR')} mililitros, ${pct}% da meta di\u00e1ria.`;
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
  const pct = Math.round((ml / GOAL) * 100);
  const clampedPct = Math.min(pct, 100);
  const liters = (ml / 1000).toFixed(1).replace('.', ',');

  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * clampedPct / 100);
  ringEl.style.strokeDashoffset = offset;
  ringMlEl.textContent = ml.toLocaleString('pt-BR') + ' ml';
  ringPctEl.textContent = clampedPct + '%';
  progressEl.setAttribute('aria-valuenow', String(ml));
  progressEl.setAttribute(
    'aria-valuetext',
    `${ml.toLocaleString('pt-BR')} de ${GOAL.toLocaleString('pt-BR')} mililitros (${clampedPct}%)`
  );

  cupsEl.textContent = String(filled);
  litersEl.textContent = liters + ' L';
  remainingEl.textContent = String(TOTAL - filled);
  motivEl.textContent = getMotiv(filled);
  congratsEl.classList.toggle('show', filled === TOTAL);

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

btnAdd.addEventListener('click', () => {
  if (filled < TOTAL) {
    fill(filled);
    update();
  }
});

btnUndo.addEventListener('click', () => {
  if (filled > 0) {
    filled -= 1;
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

function renderHistory() {
  const hist = getHistory();
  const entries = Object.entries(hist)
    .filter(([date]) => date !== todayKey && /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);

  if (entries.length === 0) {
    historyListEl.innerHTML = '<li class="history-empty">Nenhum registro anterior ainda.</li>';
    return;
  }

  historyListEl.innerHTML = entries.map(([date, cups]) => {
    const safeCups = clampFilled(Number(cups));
    const ml = safeCups * ML;
    const pct = Math.min(Math.round((ml / GOAL) * 100), 100);
    const [year, month, day] = date.split('-');
    const label = day + '/' + month + '/' + year;

    return `
      <li class="history-item">
        <span class="history-date">${label}</span>
        <div class="history-bar-wrap">
          <div class="history-bar" style="width:${pct}%"></div>
        </div>
        <span class="history-val">${(ml / 1000).toFixed(1).replace('.', ',')} L</span>
      </li>
    `;
  }).join('');
}

ringEl.style.strokeDasharray = CIRCUMFERENCE;
ringEl.style.strokeDashoffset = CIRCUMFERENCE;

persistState();
update(false);

window.addEventListener('beforeunload', persistState);
window.addEventListener('focus', () => {
  if (syncToday()) {
    update(false);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && syncToday()) {
    update(false);
  }
});
