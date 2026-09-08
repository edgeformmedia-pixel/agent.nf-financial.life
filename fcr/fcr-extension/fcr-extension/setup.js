const PERSONAL = ['contactName', 'email'];

const AIL = {
  companyName: 'American Income Life Insurance Company',
  addr1: '1200 Wooded Acres Dr',
  addr2: '',
  city: 'Waco',
  state: 'TX',
  zip: '76710',
  url: 'https://www.ailife.com/',
  category: 'financial_service',
  callCount: '5001',
  feedback: 'Customers report seeing Spam Likely or Scam Likely labels',
  fcrUrl: 'https://www.freecallerregistry.com/fcr/'
};

const COMPANY = Object.keys(AIL);
const el = id => document.getElementById(id);
const MAX_PHONES = 20;

// ---- phone rows ----
function addRow(value = '') {
  const rows = el('phoneRows');
  if (rows.children.length >= MAX_PHONES) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
  const input = document.createElement('input');
  input.className = 'phone-row';
  input.placeholder = '5551234567';
  input.value = value;
  const del = document.createElement('button');
  del.className = 'ghost';
  del.textContent = '×';
  del.style.cssText = 'flex:none;width:34px;padding:6px 0;font-size:15px';
  del.onclick = () => {
    wrap.remove();
    if (!el('phoneRows').children.length) addRow();
  };
  wrap.append(input, del);
  rows.appendChild(wrap);
  return input;
}

const readPhones = () =>
  [...document.querySelectorAll('.phone-row')]
    .map(i => i.value.replace(/\D/g, ''))
    .filter(Boolean);

el('addRow').onclick = e => { e.preventDefault(); addRow()?.focus(); };

// ---- load ----
chrome.storage.sync.get(null, saved => {
  const v = { ...AIL, ...saved };
  [...PERSONAL, ...COMPANY].forEach(k => { if (el(k)) el(k).value = v[k] ?? ''; });

  const phones = saved.phones?.length ? saved.phones : (saved.phone ? [saved.phone] : []);
  (phones.length ? phones : ['']).forEach(p => addRow(p));
});

el('reset').onclick = () => {
  Object.entries(AIL).forEach(([k, val]) => { if (el(k)) el(k).value = val; });
};

// ---- save ----
el('save').onclick = () => {
  const out = {};
  [...PERSONAL, ...COMPANY].forEach(k => { if (el(k)) out[k] = el(k).value.trim(); });

  const m = el('msg');
  const missing = PERSONAL.filter(k => !out[k]);
  if (missing.length) {
    m.className = 'bad';
    m.textContent = 'Fill in your name and email.';
    return;
  }

  const phones = readPhones();
  if (!phones.length) {
    m.className = 'bad';
    m.textContent = 'Add at least one phone number.';
    return;
  }
  const bad = phones.find(p => p.length !== 10);
  if (bad) {
    m.className = 'bad';
    m.textContent = `"${bad}" isn't 10 digits.`;
    return;
  }
  if (new Set(phones).size !== phones.length) {
    m.className = 'bad';
    m.textContent = 'Duplicate numbers in the list.';
    return;
  }

  out.phones = phones;
  out.phone = phones[0]; // business contact number
  out.setupDone = true;

  chrome.storage.sync.set(out, () => {
    m.className = 'ok';
    m.textContent = `✓ Saved ${phones.length} number${phones.length > 1 ? 's' : ''} — click the toolbar icon to register.`;
  });
};
