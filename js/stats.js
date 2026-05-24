/* ============================================
   STATS — grafy a dlouhodobé výsledky
   ============================================ */

let activeRange = 90; // days, 'all' = null
let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
  renderNav('stats.html');
  Chart.defaults.color = '#7a6e64';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';

  attachRangeButtons();
  renderAll();
});

function attachRangeButtons() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.range;
      activeRange = val === 'all' ? null : parseInt(val);
      renderAll();
    };
  });
  // Mark active button look
  const style = document.createElement('style');
  style.textContent = `
    .range-btn.active {
      background: var(--accent-bg) !important;
      color: var(--accent) !important;
      border-color: var(--accent-dim);
    }
  `;
  document.head.appendChild(style);
}

function rangeCutoff() {
  if (!activeRange) return '0000-01-01';
  return DateUtil.addDays(DateUtil.today(), -activeRange);
}

function renderAll() {
  renderPRsGrid();
  renderMainExerciseCharts();
  renderWeightChart();
  renderHeatmap();
}

function renderPRsGrid() {
  const container = document.getElementById('prs-grid-container');
  container.innerHTML = MAIN_EXERCISES.map(ex => {
    const cells = Array.from({ length: 10 }, (_, i) => i + 1).map(rm => {
      const best = PRs.best(ex, rm);
      const value = best ? `${formatNumber(best.weight, 1)} kg` : '—';
      const date = best ? DateUtil.format(best.date, { short: true }) : '';
      const hasData = !!best;
      return `
        <div class="pr-cell ${hasData ? 'has-data' : ''}" onclick="openPRModal('${ex}', ${rm})">
          <div class="pr-cell-label">${rm}RM</div>
          <div class="pr-cell-value">${value}</div>
          ${date ? `<div class="pr-cell-date">${date}</div>` : ''}
        </div>
      `;
    }).join('');
    return `
      <section class="pr-card">
        <header class="pr-card-header">
          <h3 class="pr-card-title">${ex}</h3>
          <span class="pr-card-hint">klikni pro úpravu</span>
        </header>
        <div class="pr-grid">${cells}</div>
      </section>
    `;
  }).join('');
}

window.openPRModal = function(exercise, rm) {
  const existing = PRs.best(exercise, rm);
  const history = PRs.history(exercise, rm);
  const historyHtml = history.length > 1 ? `
    <div class="field" style="margin-top: var(--space-4);">
      <label>Historie (${history.length} záznamů)</label>
      <div class="pr-history-list">
        ${history.slice().reverse().map(h => `
          <div class="pr-history-item">
            <span class="mono">${formatNumber(h.weight, 1)} kg</span>
            <span class="text-muted">${DateUtil.format(h.date, { short: true })}</span>
            ${h.note ? `<span class="text-muted" style="font-style: italic;">${h.note}</span>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="deletePR('${h.id}', '${exercise}', ${rm})" title="Smazat">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const modal = openModal(`
    <h3 class="mb-2">${exercise} — ${rm}RM</h3>
    <p class="text-muted mb-5" style="font-size: 0.85rem;">
      ${existing ? `Aktuální nejlepší: <strong>${formatNumber(existing.weight, 1)} kg</strong> (${DateUtil.format(existing.date, { short: true })})` : 'Zatím žádný záznam'}
    </p>
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div class="field">
        <label>Váha (kg)</label>
        <input type="number" id="pr-weight" step="0.5" placeholder="${existing ? existing.weight : '0'}" autofocus>
      </div>
      <div class="field">
        <label>Datum</label>
        <input type="date" id="pr-date" value="${DateUtil.today()}">
      </div>
    </div>
    <div class="field">
      <label>Poznámka (volitelné)</label>
      <input type="text" id="pr-note" placeholder="např. lehčí den, čisté provedení, ...">
    </div>
    ${historyHtml}
    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" onclick="closeModal()">Zrušit</button>
      <button class="btn btn-primary" id="pr-save">Uložit záznam</button>
    </div>
  `);

  modal.querySelector('#pr-save').onclick = () => {
    const weight = modal.querySelector('#pr-weight').value;
    const date = modal.querySelector('#pr-date').value;
    const note = modal.querySelector('#pr-note').value;
    if (!weight || isNaN(parseFloat(weight))) {
      toast('Zadej platnou váhu');
      return;
    }
    PRs.add({ exercise, rm, weight, date, note });
    closeModal();
    toast(`${exercise} ${rm}RM: ${weight} kg ✓`);
    renderPRsGrid();
    renderMainExerciseCharts();
  };
};

window.deletePR = function(id, exercise, rm) {
  confirmAction('Smazat tento záznam?', () => {
    PRs.remove(id);
    toast('Záznam smazán');
    closeModal();
    setTimeout(() => openPRModal(exercise, rm), 100);
    renderPRsGrid();
    renderMainExerciseCharts();
  });
};

function renderMainExerciseCharts() {
  const container = document.getElementById('main-exercise-charts');
  container.innerHTML = MAIN_EXERCISES.map((ex, i) => `
    <section class="card">
      <div class="card-header">
        <span class="card-title">${ex}</span>
        <span class="text-muted" style="font-size: 0.8rem;" id="ex-summary-${i}"></span>
      </div>
      <div class="chart-container">
        <canvas id="ex-chart-${i}"></canvas>
      </div>
    </section>
  `).join('');

  MAIN_EXERCISES.forEach((ex, i) => {
    drawExerciseChart(ex, `ex-chart-${i}`, `ex-summary-${i}`);
  });
}

function drawExerciseChart(exerciseName, canvasId, summaryId) {
  const cutoff = rangeCutoff();
  // Vykresluje vícero linií: 1RM, 3RM, 5RM, 10RM v čase
  const RM_LINES = [
    { rm: 1, color: '#d4a574', label: '1RM' },
    { rm: 3, color: '#b85c4a', label: '3RM' },
    { rm: 5, color: '#7a9b6e', label: '5RM' },
    { rm: 10, color: '#6e8a9b', label: '10RM' },
  ];

  const canvas = document.getElementById(canvasId);
  const summary = document.getElementById(summaryId);

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }

  // Sestavíme datasety pro každé RM
  const datasets = RM_LINES.map(({ rm, color, label }) => {
    const history = PRs.history(exerciseName, rm).filter(p => p.date >= cutoff);
    return {
      rm,
      label,
      color,
      data: history.map(p => ({ x: p.date, y: parseFloat(p.weight) })),
    };
  }).filter(d => d.data.length > 0);

  if (!datasets.length) {
    canvas.style.display = 'none';
    canvas.parentElement.innerHTML = `<div class="empty"><div class="text-muted">žádná data v tomto období</div><div class="text-muted mt-2" style="font-size: 0.8rem;">Vyplň PR výše a graf se objeví.</div></div>`;
    return;
  }

  canvas.style.display = 'block';

  // Summary: aktuální nejlepší 1RM
  const best1RM = PRs.best(exerciseName, 1);
  if (summary) {
    summary.innerHTML = best1RM
      ? `1RM: <strong>${formatNumber(best1RM.weight, 1)} kg</strong> <span class="text-muted">(${DateUtil.format(best1RM.date, { short: true })})</span>`
      : '<span class="text-muted">žádný 1RM</span>';
  }

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        backgroundColor: d.color + '22',
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 3,
        pointBackgroundColor: d.color,
        pointBorderColor: '#15110f',
        pointBorderWidth: 1,
        pointHoverRadius: 5,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#b5a89c', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: '#1f1a17',
          borderColor: '#3a3330',
          borderWidth: 1,
          titleColor: '#f5ede4',
          bodyColor: '#b5a89c',
          padding: 10,
          callbacks: {
            title: (items) => DateUtil.format(items[0].raw.x),
            label: (item) => `${item.dataset.label}: ${formatNumber(item.raw.y, 1)} kg`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', displayFormats: { month: 'MMM' } },
          grid: { display: false },
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'kg', color: '#7a6e64', font: { size: 11 } },
        },
      },
    },
  });
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  const data = BodyWeight.list();
  const cutoff = rangeCutoff();
  const recent = data.filter(d => d.date >= cutoff);

  if (chartInstances['weight-chart']) {
    chartInstances['weight-chart'].destroy();
    delete chartInstances['weight-chart'];
  }

  const summary = document.getElementById('weight-summary');
  if (recent.length < 2) {
    canvas.style.display = 'none';
    if (canvas.parentElement.querySelector('.empty')) return;
    canvas.parentElement.insertAdjacentHTML('beforeend', `<div class="empty"><div class="text-muted">Potřeba víc záznamů váhy</div></div>`);
    summary.textContent = '';
    return;
  }

  canvas.style.display = 'block';
  const oldEmpty = canvas.parentElement.querySelector('.empty');
  if (oldEmpty) oldEmpty.remove();

  const first = recent[0].weight;
  const last = recent[recent.length - 1].weight;
  const delta = last - first;
  summary.innerHTML = `${formatNumber(last, 1)} kg
    <span style="color: ${delta > 0 ? 'var(--warning)' : 'var(--success)'}; margin-left: 4px;">
      ${delta > 0 ? '+' : ''}${formatNumber(delta, 1)} kg
    </span>`;

  chartInstances['weight-chart'] = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Váha (kg)',
        data: recent.map(d => ({ x: d.date, y: d.weight })),
        borderColor: '#b85c4a',
        backgroundColor: 'rgba(184, 92, 74, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: '#b85c4a',
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f1a17',
          borderColor: '#3a3330',
          borderWidth: 1,
          callbacks: {
            title: (items) => DateUtil.format(items[0].raw.x),
            label: (item) => `${formatNumber(item.raw.y, 1)} kg`,
          },
        },
      },
      scales: {
        x: { type: 'time', time: { unit: 'month' }, grid: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

function renderVolumeChart() {
  const canvas = document.getElementById('volume-chart');
  const cutoff = rangeCutoff();
  const workouts = Workouts.list().filter(w => w.date >= cutoff);

  if (chartInstances['volume-chart']) {
    chartInstances['volume-chart'].destroy();
    delete chartInstances['volume-chart'];
  }

  if (!workouts.length) {
    canvas.style.display = 'none';
    if (canvas.parentElement.querySelector('.empty')) return;
    canvas.parentElement.insertAdjacentHTML('beforeend', '<div class="empty"><div class="text-muted">žádné tréninky v tomto období</div></div>');
    return;
  }
  canvas.style.display = 'block';
  const oldEmpty = canvas.parentElement.querySelector('.empty');
  if (oldEmpty) oldEmpty.remove();

  // Group by week
  const byWeek = {};
  workouts.forEach(w => {
    const range = DateUtil.weekRange(w.date);
    if (!byWeek[range.start]) byWeek[range.start] = 0;
    byWeek[range.start] += w.exercises.reduce((s, e) => s + (parseInt(e.sets) || 0), 0);
  });

  const labels = Object.keys(byWeek).sort();
  const values = labels.map(k => byWeek[k]);

  chartInstances['volume-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map(l => DateUtil.format(l, { short: true })),
      datasets: [{
        label: 'Série / týden',
        data: values,
        backgroundColor: 'rgba(212, 165, 116, 0.5)',
        borderColor: '#d4a574',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f1a17',
          borderColor: '#3a3330',
          borderWidth: 1,
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  const summary = document.getElementById('heatmap-summary');
  const workouts = Workouts.list();

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  // align to Monday
  const dow = start.getDay() || 7;
  start.setDate(start.getDate() - (dow - 1));

  // Build day map
  const dayMap = {};
  workouts.forEach(w => {
    if (!dayMap[w.date]) dayMap[w.date] = 0;
    dayMap[w.date]++;
  });

  const cells = [];
  const cursor = new Date(start);
  let totalWorkouts = 0;
  while (cursor <= today) {
    const iso = cursor.toISOString().slice(0, 10);
    const count = dayMap[iso] || 0;
    if (count > 0) totalWorkouts++;
    let level = 0;
    if (count >= 1) level = 1;
    if (count >= 2) level = 2;
    if (count >= 3) level = 3;
    if (count >= 4) level = 4;
    cells.push({ date: iso, count, level });
    cursor.setDate(cursor.getDate() + 1);
  }

  // arrange into 7 rows (Mon-Sun) and ~52 cols
  const weeks = Math.ceil(cells.length / 7);
  const grid = [];
  for (let row = 0; row < 7; row++) {
    const rowCells = [];
    for (let col = 0; col < weeks; col++) {
      const idx = col * 7 + row;
      rowCells.push(cells[idx] || null);
    }
    grid.push(rowCells);
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 2px; min-width: 720px;">
      ${grid.map(row => `
        <div style="display: grid; grid-template-columns: repeat(${weeks}, 1fr); gap: 2px;">
          ${row.map(c => {
            if (!c) return '<div></div>';
            return `<div class="heatmap-cell level-${c.level}" title="${DateUtil.format(c.date, { short: true })} • ${c.count} ${c.count === 1 ? 'trénink' : 'tréninků'}"></div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    <div class="flex gap-2 mt-3" style="font-size: 0.75rem; color: var(--text-muted); align-items: center;">
      <span>méně</span>
      <div class="heatmap-cell" style="width: 12px; height: 12px;"></div>
      <div class="heatmap-cell level-1" style="width: 12px; height: 12px;"></div>
      <div class="heatmap-cell level-2" style="width: 12px; height: 12px;"></div>
      <div class="heatmap-cell level-3" style="width: 12px; height: 12px;"></div>
      <div class="heatmap-cell level-4" style="width: 12px; height: 12px;"></div>
      <span>více</span>
    </div>
  `;

  summary.textContent = `${totalWorkouts} tréninků za rok`;
}
