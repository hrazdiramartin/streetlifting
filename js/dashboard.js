/* ============================================
   DASHBOARD — hlavní přehled
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderNav('index.html');
  renderGreeting();
  renderCurrentWeekSection();
  renderStatsGrid();
  renderRecentWorkouts();
  renderWeightMiniChart();
  attachQuickActions();
});

function renderGreeting() {
  const today = DateUtil.today();
  const settings = Settings.get();
  const hour = new Date().getHours();
  let g = 'Vítej zpět';
  if (hour < 11) g = 'Dobré ráno';
  else if (hour < 17) g = 'Dobré odpoledne';
  else g = 'Dobrý večer';
  document.getElementById('greeting').textContent = `${g}, ${vocative(settings.name || 'Martin')}`;
  document.getElementById('today-eyebrow').textContent =
    `${DateUtil.dayName(today)}, ${DateUtil.format(today)}`;
}

function renderCurrentWeekSection() {
  const section = document.getElementById('current-week-section');
  const today = DateUtil.today();
  const block = Blocks.currentOrUpcoming();

  if (!block) {
    section.innerHTML = `
      <div class="today-card">
        <div class="today-card-content">
          <div class="today-eyebrow">Žádný aktivní blok</div>
          <h2 class="today-title">Vytvoř první blok</h2>
          <p class="today-subtitle">5-7 týdenní blok s postupným zvyšováním zátěže.</p>
          <a href="plan.html?new=1" class="btn btn-primary">+ Nový blok</a>
        </div>
      </div>
    `;
    return;
  }

  const week = Blocks.currentOrNextWeek(block);
  if (!week) {
    section.innerHTML = `
      <div class="today-card">
        <div class="today-card-content">
          <div class="today-eyebrow">${block.name}</div>
          <h2 class="today-title">Blok dokončen</h2>
          <p class="today-subtitle">Naplánuj další blok.</p>
          <a href="plan.html?new=1" class="btn btn-primary">+ Nový blok</a>
        </div>
      </div>
    `;
    return;
  }

  const daysToStart = DateUtil.daysBetween(today, week.start_date);
  const isSoonOrNow = daysToStart <= 7; // jsme uvnitř nebo začíná do týdne
  const eyebrowText = isSoonOrNow
    ? `Aktuální týden • ${block.name}`
    : `Nadcházející týden • ${block.name}`;
  const titleText = `Týden ${week.number}${week.is_deload ? ' • Deload' : ''}${week.is_pr_week ? ' • PR' : ''}`;
  const dateRange = DateUtil.formatRange(week.start_date, week.end_date);

  const DAY_OFFSETS = { 'Pondělí': 0, 'Úterý': 1, 'Středa': 2, 'Čtvrtek': 3, 'Pátek': 4, 'Sobota': 5, 'Neděle': 6 };
  // Seřaď tréninky podle blízkosti k dnešku: budoucí ASC (nejblíž nahoře), pak minulé DESC
  const planned = (week.planned_workouts || []).slice().sort((a, b) => {
    const aDate = DateUtil.addDays(week.start_date, DAY_OFFSETS[a.day] || 0);
    const bDate = DateUtil.addDays(week.start_date, DAY_OFFSETS[b.day] || 0);
    const aFuture = aDate >= today;
    const bFuture = bDate >= today;
    if (aFuture && bFuture) return aDate.localeCompare(bDate);
    if (!aFuture && !bFuture) return bDate.localeCompare(aDate);
    return aFuture ? -1 : 1;
  });

  const cardsHtml = planned.map(p => {
    const offset = DAY_OFFSETS[p.day];
    const date = offset !== undefined ? DateUtil.addDays(week.start_date, offset) : null;
    const w = date ? Workouts.byDate(date) : null;
    const hasData = w && Workouts.hasData(w);
    const isToday = date === today;
    const isPast = date && date < today;

    let statusLabel, statusClass, statusTitle = '';
    if (w && w.is_skipped) {
      statusLabel = '× nedokončeno'; statusClass = 'skipped';
      statusTitle = w.skip_reason || '';
    }
    else if (hasData) { statusLabel = '✓ dokončeno'; statusClass = 'completed'; }
    else if (isPast) { statusLabel = 'nevyplněno'; statusClass = 'missed'; }
    else if (isToday) { statusLabel = 'dnes'; statusClass = 'today'; }
    else { statusLabel = 'naplánováno'; statusClass = 'upcoming'; }

    const btnHtml = w
      ? `<a href="training.html?id=${w.id}" class="btn btn-sm ${hasData || w.is_skipped ? 'btn-ghost' : 'btn-primary'}">${hasData || w.is_skipped ? 'Otevřít' : 'Začít'}</a>`
      : `<a href="training.html?new=1&type=${encodeURIComponent(p.type)}&block_id=${block.id}&week_number=${week.number}" class="btn btn-sm btn-primary">Začít</a>`;

    return `
      <div class="week-day-card ${statusClass} ${isToday ? 'is-today' : ''}">
        <div class="week-day-header">
          <div>
            <div class="week-day-name">${p.day}</div>
            <div class="week-day-date">${date ? DateUtil.format(date, { short: true }) : ''}</div>
          </div>
          <span class="week-day-status ${statusClass}" ${statusTitle ? `title="${statusTitle.replace(/"/g, '&quot;')}"` : ''}>${statusLabel}</span>
        </div>
        <div class="week-day-type">${p.type}</div>
        ${w && w.is_skipped && w.skip_reason ? `<div class="week-day-skip-reason">⚠ ${w.skip_reason}</div>` : ''}
        <div class="week-day-actions">
          ${btnHtml}
        </div>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <div class="current-week-header">
      <div>
        <span class="eyebrow">${eyebrowText}</span>
        <h2 class="current-week-title">${titleText}</h2>
        <p class="current-week-dates">${dateRange}</p>
      </div>
      <a href="plan.html" class="btn btn-ghost btn-sm">Celý blok →</a>
    </div>
    <div class="week-days-grid">
      ${cardsHtml || '<div class="empty"><div class="text-muted">Žádný plán na tento týden</div></div>'}
    </div>
  `;
}

function renderStatsGrid() {
  const grid = document.getElementById('stats-grid');
  const bw = BodyWeight.latest();
  const bwTrend = BodyWeight.trend(30);
  const streak = calculateConsecutiveTrainings();

  grid.innerHTML = `
    <div class="card card-compact">
      <div class="stat">
        <span class="stat-label">Tělesná váha</span>
        <div>
          <span class="stat-value">${bw ? formatNumber(bw.weight) : '–'}</span>
          ${bw ? '<span class="stat-unit">kg</span>' : ''}
        </div>
        ${bwTrend ? `<span class="stat-trend ${bwTrend.delta > 0 ? 'up' : 'down'}">
          ${bwTrend.delta > 0 ? '+' : ''}${formatNumber(bwTrend.delta)} kg / 30 dní
        </span>` : '<span class="stat-trend">přidej více záznamů</span>'}
      </div>
    </div>

    <div class="card card-compact">
      <div class="stat">
        <span class="stat-label">Tréninky v řadě</span>
        <div>
          <span class="stat-value">${streak}</span>
          <span class="stat-unit">${streak === 1 ? 'trénink' : streak < 5 ? 'tréninky' : 'tréninků'}</span>
        </div>
        <span class="stat-trend">bez skipnutí</span>
      </div>
    </div>
  `;
}

/**
 * Počet po sobě jdoucích dokončených tréninků od nejnovějšího dozadu.
 * Skipnutý nebo nevyplněný (v minulosti) přeruší řadu.
 */
function calculateConsecutiveTrainings() {
  const today = DateUtil.today();
  // Tréninky v minulosti nebo dnes, seřazené od nejnovějšího
  const past = Workouts.list()
    .filter(w => w.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  for (const w of past) {
    if (w.is_completed) {
      streak++;
    } else if (w.is_skipped) {
      break; // skipnutý → konec řady
    } else {
      // V minulosti nedotčený workout (po datu, ale bez označení) — break
      if (w.date < today) break;
      // Dnes ještě nevyplněno — ignoruj (streak pokračuje z minulosti)
    }
  }
  return streak;
}

function renderRecentWorkouts() {
  const container = document.getElementById('recent-workouts');
  const recent = Workouts.completed(5);

  if (!recent.length) {
    container.innerHTML = `
      <div class="empty" style="padding: var(--space-5) 0;">
        <div class="text-muted">Žádné odtrénované tréninky.</div>
        <div class="text-muted mt-2" style="font-size: 0.85rem;">
          Začni první trénink z plánu výše.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="flex-col gap-3">
      ${recent.map(w => `
        <a href="training.html?id=${w.id}" class="flex-between" style="padding: var(--space-3); border-radius: var(--radius); background: var(--bg-surface-2);">
          <div>
            <div style="font-weight: 500;">${w.type || 'Trénink'}</div>
            <div class="text-muted" style="font-size: 0.8rem;">
              ${DateUtil.dayName(w.date)} • ${DateUtil.format(w.date, { short: true })}
            </div>
          </div>
          <span class="text-muted">→</span>
        </a>
      `).join('')}
    </div>
  `;
}

function renderWeightMiniChart() {
  const canvas = document.getElementById('weight-mini-chart');
  if (!canvas) return;
  const data = BodyWeight.list();
  const cutoff = DateUtil.addDays(DateUtil.today(), -30);
  const recent = data.filter(d => d.date >= cutoff);

  if (recent.length < 2) {
    canvas.style.display = 'none';
    canvas.insertAdjacentHTML('afterend', `
      <div class="empty" style="padding: var(--space-5) 0;">
        <div class="text-muted">Záznamy váhy se objeví zde.</div>
        <button class="btn btn-ghost btn-sm mt-3" id="empty-log-weight">Záznam váhy</button>
      </div>
    `);
    const btn = document.getElementById('empty-log-weight');
    if (btn) btn.onclick = openWeightModal;
    return;
  }

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: recent.map(d => DateUtil.format(d.date, { short: true })),
      datasets: [{
        data: recent.map(d => d.weight),
        borderColor: '#d4a574',
        backgroundColor: 'rgba(212, 165, 116, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: '#d4a574',
        pointBorderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7a6e64', font: { size: 10 }, maxTicksLimit: 4 } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#7a6e64', font: { size: 10 } },
        },
      },
    },
  });
}

function attachQuickActions() {
  const btn = document.getElementById('btn-log-weight');
  if (btn) btn.onclick = openWeightModal;
}

function openWeightModal() {
  const latest = BodyWeight.latest();
  const modal = openModal(`
    <h3 class="mb-5">Záznam váhy</h3>
    <div class="field">
      <label>Datum</label>
      <input type="date" id="weight-date" value="${DateUtil.today()}">
    </div>
    <div class="field">
      <label>Váha (kg)</label>
      <input type="number" id="weight-value" step="0.1" placeholder="${latest ? latest.weight : '75.0'}" autofocus>
    </div>
    <div class="field">
      <label>Poznámka (volitelné)</label>
      <input type="text" id="weight-note" placeholder="ráno, po WC, ...">
    </div>
    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" id="weight-cancel">Zrušit</button>
      <button class="btn btn-primary" id="weight-save">Uložit</button>
    </div>
  `);
  modal.querySelector('#weight-cancel').onclick = () => closeModal();
  modal.querySelector('#weight-save').onclick = () => {
    const value = modal.querySelector('#weight-value').value;
    const date = modal.querySelector('#weight-date').value;
    const note = modal.querySelector('#weight-note').value;
    if (!value || isNaN(parseFloat(value))) {
      toast('Zadej platnou váhu');
      return;
    }
    BodyWeight.add(value, date, note);
    closeModal();
    toast('Váha uložena ✓');
    renderStatsGrid();
    renderWeightMiniChart();
  };
}
