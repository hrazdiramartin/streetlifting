/* ============================================
   APP — sdílené UI utility, navigace, modaly
   ============================================ */

const NAV_ITEMS = [
  { href: 'index.html', label: 'Přehled', icon: 'home', short: 'Přehled' },
  { href: 'plan.html', label: 'Plán', icon: 'calendar', short: 'Plán' },
  { href: 'stats.html', label: 'Statistiky', icon: 'chart', short: 'Statistiky' },
  { href: 'profile.html', label: 'Profil', icon: 'user', short: 'Profil' },
];

const ICONS = {
  home: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V10.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dumbbell: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M4 8v8M2 10v4M22 10v4M20 8v8M8 12h8M6 7v10M18 7v10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calendar: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round"/></svg>',
  chart: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 20h18M6 16V10M11 16V6M16 16v-3M21 16v-8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>',
  plus: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
  trash: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.83 2.83 0 00-4-4L4 16v4zM13.5 6.5l4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow_up: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow_down: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow_right: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
  scale: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 7h18l-2 13H5L3 7zM8 7V5a4 4 0 018 0v2M12 11v6M9 14h6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* --- Navigace renderování --- */
function renderNav(activePage) {
  const topbar = document.getElementById('topbar');
  if (topbar) {
    topbar.innerHTML = `
      <div class="topbar-inner">
        <a href="index.html" class="brand">
          <span class="brand-mark">M</span>
          <span>Streetlifting</span>
        </a>
        <nav class="nav-desktop">
          ${NAV_ITEMS.map(item => `
            <a href="${item.href}" class="nav-link ${activePage === item.href ? 'active' : ''}">
              ${item.label}
            </a>
          `).join('')}
        </nav>
      </div>
    `;
  }

  const bottomnav = document.getElementById('bottomnav');
  if (bottomnav) {
    bottomnav.innerHTML = NAV_ITEMS.map(item => `
      <a href="${item.href}" class="bottomnav-item ${activePage === item.href ? 'active' : ''}">
        ${ICONS[item.icon] || ''}
        <span>${item.short}</span>
      </a>
    `).join('');
  }
}

/* --- Toast --- */
function toast(message, duration = 2400) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* --- Modal --- */
function openModal(html, onClose) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
      if (onClose) onClose();
    }
  });
  document.body.appendChild(backdrop);
  return backdrop.querySelector('.modal');
}

function closeModal() {
  document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
}

/* --- Confirm --- */
function confirmAction(message, onYes) {
  const modal = openModal(`
    <h3 class="mb-4">Potvrzení</h3>
    <p class="mb-5">${message}</p>
    <div class="flex gap-3" style="justify-content: flex-end;">
      <button class="btn btn-ghost" id="confirm-no">Zrušit</button>
      <button class="btn btn-primary" id="confirm-yes">Potvrdit</button>
    </div>
  `);
  modal.querySelector('#confirm-no').onclick = () => closeModal();
  modal.querySelector('#confirm-yes').onclick = () => {
    closeModal();
    onYes();
  };
}

/* --- Format helpers --- */
function formatNumber(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '–';
  return Number(n).toFixed(decimals).replace('.', ',');
}

function formatInt(n) {
  if (n === null || n === undefined || isNaN(n)) return '–';
  return Math.round(n).toString();
}

/**
 * Vrátí vokativ (5. pád) českého jména. Funguje pro běžná mužská jména.
 * Příklady: Martin → Martine, Pavel → Pavle, Jakub → Jakube, Karel → Karle,
 * Tomáš → Tomáši, Lukáš → Lukáši, Aleš → Aleši, Petr → Petře, Filip → Filipe.
 */
function vocative(name) {
  if (!name || typeof name !== 'string') return name;
  const n = name.trim();
  if (!n) return n;

  // Speciální případy
  const special = {
    'Petr': 'Petře', 'Pavel': 'Pavle', 'Karel': 'Karle',
    'Marek': 'Marku', 'Bohouš': 'Bohouši',
  };
  if (special[n]) return special[n];

  const last = n.slice(-1).toLowerCase();
  const last2 = n.slice(-2).toLowerCase();

  // Konsonant: většinou + e
  if (/[bcdfghkmnprstvwxz]/.test(last)) return n + 'e';
  // -š, -č, -ž, -ř, -j: + i
  if (['š', 'č', 'ž', 'ř', 'j'].includes(last)) return n + 'i';
  // -a (maskulinum): -a → -o
  if (last === 'a') return n.slice(0, -1) + 'o';
  // -l: + e (Karel speciálně výše)
  if (last === 'l') return n + 'e';
  // jinak nech
  return n;
}

function rpePill(rpe) {
  const cat = Calc.rpeCategory(rpe);
  if (!cat) return '';
  return `<span class="rpe-pill ${cat}">${rpe}</span>`;
}
