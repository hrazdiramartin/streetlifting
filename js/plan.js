/* ============================================
   PLAN — bloky 5-7 týdnů, plánování tréninků
   ============================================ */

const DAY_OPTIONS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

document.addEventListener('DOMContentLoaded', () => {
  renderNav('plan.html');
  renderCurrentBlock();
  renderBlocksList();
  document.getElementById('btn-new-block').onclick = openNewBlockModal;

  const params = new URLSearchParams(location.search);
  if (params.get('new') === '1') {
    openNewBlockModal();
  } else if (params.get('id')) {
    const block = Blocks.byId(params.get('id'));
    if (block) openBlockDetail(block);
  }
});

function renderCurrentBlock() {
  const container = document.getElementById('current-block-section');
  const block = Blocks.current();

  if (!block) {
    container.innerHTML = `
      <div class="today-card">
        <div class="today-card-content">
          <div class="today-eyebrow">Žádný aktivní blok</div>
          <h2 class="today-title">Začni nový blok</h2>
          <p class="today-subtitle">5-7 týdenní blok s postupným zvyšováním zátěže.</p>
          <button class="btn btn-primary" onclick="openNewBlockModal()">+ Vytvořit blok</button>
        </div>
      </div>
    `;
    return;
  }

  const week = Blocks.currentWeek(block);
  // Progress podle skutečně uplynulých dnů: 0 % před začátkem, 100 % po skončení
  const today = DateUtil.today();
  const totalDays = DateUtil.daysBetween(block.start_date, block.end_date) + 1;
  const daysPassed = DateUtil.daysBetween(block.start_date, today);
  const weekProgress = Math.max(0, Math.min(100, Math.round((daysPassed / totalDays) * 100)));

  container.innerHTML = `
    <div class="today-card mb-3">
      <div class="today-card-content">
        <div class="today-eyebrow">Aktuální blok</div>
        <h2 class="today-title">${block.name}</h2>
        <p class="today-subtitle">
          ${block.weeks.length} týdnů • ${DateUtil.formatRange(block.start_date, block.end_date)}
        </p>
        <div style="background: var(--bg-surface-3); height: 6px; border-radius: 3px; overflow: hidden;">
          <div style="background: var(--accent); height: 100%; width: ${weekProgress}%; transition: width 0.5s ease;"></div>
        </div>
      </div>
    </div>
    ${renderBlockWeeks(block)}
  `;
}

function renderBlockWeeks(block) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Týdny v bloku</span>
      </div>
      <div class="weeks-list">
        ${block.weeks.map(w => {
          const today = DateUtil.today();
          const isCurrent = today >= w.start_date && today <= w.end_date;
          const isPast = today > w.end_date;
          const workouts = Workouts.byBlockWeek(block.id, w.number);
          return `
            <a class="week-item ${isCurrent ? 'current' : ''} ${isPast ? 'completed' : ''}"
                 href="javascript:void(0)" onclick="navigateToWeekHistory('${block.id}', ${w.number})"
                 style="text-decoration: none; color: inherit;">
              <div class="week-info">
                <div class="week-title">
                  Týden ${w.number}${w.is_deload ? ' • Deload' : ''}
                  ${isCurrent ? '<span class="badge badge-accent" style="margin-left: 8px;">aktuální</span>' : ''}
                </div>
                <div class="week-dates">${DateUtil.formatRange(w.start_date, w.end_date)}</div>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderBlocksList() {
  const container = document.getElementById('blocks-list');
  const all = Blocks.list().sort((a, b) => b.start_date.localeCompare(a.start_date));
  const currentBlock = Blocks.current();

  if (!all.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = all.map(b => {
    const isCurrent = currentBlock && b.id === currentBlock.id;
    const isPast = DateUtil.today() > b.end_date;
    const workoutCount = Workouts.list().filter(w => w.block_id === b.id).length;
    return `
      <div class="block-card ${isCurrent ? 'active' : ''}" onclick="openBlockDetail('${b.id}')" style="cursor: pointer;">
        <div class="flex-between mb-2">
          <h3>${b.name}</h3>
          ${isCurrent ? '<span class="badge badge-accent">aktivní</span>' : ''}
          ${isPast ? '<span class="badge">dokončeno</span>' : ''}
        </div>
        <div class="block-meta">
          ${b.weeks.length} týdnů • ${DateUtil.formatRange(b.start_date, b.end_date)}
        </div>
        <div class="flex gap-4 text-muted" style="font-size: 0.85rem;">
          <span>${workoutCount} tréninků</span>
          <span>${b.type ? BLOCK_TYPES.find(t => t.id === b.type)?.label || b.type : '—'}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.navigateToWeekHistory = function(blockId, weekNumber) {
  sessionStorage.setItem('__sl_highlight', JSON.stringify({ blockId, weekNumber, t: Date.now() }));
  location.href = 'training.html';
};

window.openBlockDetail = function(blockIdOrJson) {
  const blockId = typeof blockIdOrJson === 'string' ? blockIdOrJson.replace(/"/g, '') : blockIdOrJson;
  const block = Blocks.byId(blockId);
  if (!block) return;

  const modal = openModal(`
    <div class="flex-between mb-4">
      <div>
        <span class="card-title" style="display: block; margin-bottom: 4px;">
          ${BLOCK_TYPES.find(t => t.id === block.type)?.label || 'Blok'}
        </span>
        <h3 style="margin: 0;">${block.name}</h3>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <p class="text-muted mb-5" style="font-size: 0.85rem;">
      ${DateUtil.formatRange(block.start_date, block.end_date)} • ${block.weeks.length} týdnů
    </p>

    <div class="card-header">
      <span class="card-title">Týdny</span>
    </div>
    <div class="weeks-list mb-5">
      ${block.weeks.map(w => {
        const today = DateUtil.today();
        const isCurrent = today >= w.start_date && today <= w.end_date;
        const workouts = Workouts.byBlockWeek(block.id, w.number);
        return `
          <a class="week-item ${isCurrent ? 'current' : ''}" href="javascript:void(0)" onclick="navigateToWeekHistory('${block.id}', ${w.number})" style="text-decoration: none; color: inherit;">
            <div class="week-info">
              <div class="week-title">Týden ${w.number}${w.is_deload ? ' • Deload' : ''}</div>
              <div class="week-dates">${DateUtil.formatRange(w.start_date, w.end_date)}</div>
            </div>
          </a>
        `;
      }).join('')}
    </div>

    <div class="flex gap-3" style="justify-content: space-between;">
      <button class="btn btn-ghost text-danger" onclick="deleteBlock('${block.id}')">Smazat blok</button>
      <button class="btn btn-ghost" onclick="editBlockName('${block.id}')">Upravit</button>
    </div>
  `);
};

window.deleteBlock = function(blockId) {
  const block = Blocks.byId(blockId);
  if (!block) return;
  confirmAction(`Smazat blok "${block.name}"? Tréninky zůstanou, jen ztratí přiřazení.`, () => {
    Blocks.remove(blockId);
    toast('Blok smazán');
    renderCurrentBlock();
    renderBlocksList();
  });
};

window.editBlockName = function(blockId) {
  const block = Blocks.byId(blockId);
  if (!block) return;
  const newName = prompt('Nový název bloku:', block.name);
  if (newName && newName.trim()) {
    block.name = newName.trim();
    Blocks.save(block);
    toast('Blok upraven');
    renderCurrentBlock();
    renderBlocksList();
    closeModal();
  }
};

window.openWeekDetail = function(blockId, weekNumber) {
  const block = Blocks.byId(blockId);
  if (!block) return;
  const week = block.weeks.find(w => w.number === weekNumber);
  if (!week) return;
  const workouts = Workouts.byBlockWeek(blockId, weekNumber);

  const planned = week.planned_workouts || [];

  // Compute date for each planned day in this week
  const dayOffset = (dayName) => DAY_OPTIONS.indexOf(dayName);

  const modal = openModal(`
    <div class="flex-between mb-4">
      <div>
        <span class="card-title" style="display: block; margin-bottom: 4px;">${block.name}</span>
        <h3 style="margin: 0;">Týden ${week.number}${week.is_deload ? ' • Deload' : ''}${week.is_pr_week ? ' • PR' : ''}</h3>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <p class="text-muted mb-5" style="font-size: 0.85rem;">
      ${DateUtil.formatRange(week.start_date, week.end_date)}
    </p>

    <div class="card-header">
      <span class="card-title">Plánované tréninky</span>
      <button class="btn btn-ghost btn-sm" id="add-planned">+ Přidat den</button>
    </div>
    <div class="flex-col gap-3 mb-5" id="planned-list">
      ${planned.length === 0 ? '<div class="text-muted" style="padding: var(--space-3); font-size: 0.85rem;">Zatím žádný plán.</div>' : ''}
      ${planned.map((p, idx) => {
        const w = workouts.find(wk => DateUtil.dayName(wk.date) === p.day);
        const completed = !!w && Workouts.hasData(w);
        const skipped = !!w && w.is_skipped;
        const status = skipped ? '× nedokončeno' : (completed ? '✓ dokončeno' : (w ? 'připraveno' : 'nenaplánováno'));
        const offset = dayOffset(p.day);
        const date = offset >= 0 ? DateUtil.addDays(week.start_date, offset) : null;
        const exercisesHtml = (p.exercises || []).map(ex => `
          <div class="planned-exercise ${ex.is_main ? 'main' : ''}">
            <span class="ex-name">${ex.name}</span>
            <span class="ex-sets">${ex.sets || '-'}×${ex.reps || '-'}</span>
            <span class="ex-rpe">RPE ${ex.rpe || '-'}</span>
          </div>
        `).join('');
        const btnHtml = w
          ? `<a href="training.html?id=${w.id}" class="btn ${completed ? 'btn-ghost' : 'btn-primary'} btn-sm">${completed ? 'Otevřít' : 'Začít'}</a>`
          : `<a href="training.html?new=1&type=${encodeURIComponent(p.type)}&block_id=${blockId}&week_number=${weekNumber}" class="btn btn-primary btn-sm">Začít</a>`;
        return `
          <div class="planned-day-card ${completed ? 'completed' : ''}">
            <div class="flex-between mb-3">
              <div>
                <div class="week-title">${p.day} • ${p.type}${week.is_pr_week ? ' • PR' : ''}</div>
                <div class="week-dates">${date ? DateUtil.format(date, { short: true }) : ''} • ${status}</div>
              </div>
              <div class="flex gap-2">
                ${btnHtml}
                <button class="btn btn-ghost btn-sm" onclick="removePlannedDay('${blockId}', ${weekNumber}, ${idx})" title="Odstranit den">×</button>
              </div>
            </div>
            ${exercisesHtml ? `<div class="planned-exercise-list">${exercisesHtml}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `);

  document.getElementById('add-planned').onclick = () => {
    addPlannedDay(blockId, weekNumber);
  };
};

window.removePlannedDay = function(blockId, weekNumber, idx) {
  const block = Blocks.byId(blockId);
  const week = block.weeks.find(w => w.number === weekNumber);
  week.planned_workouts.splice(idx, 1);
  Blocks.save(block);
  closeModal();
  openWeekDetail(blockId, weekNumber);
};

function addPlannedDay(blockId, weekNumber) {
  const modal = openModal(`
    <h3 class="mb-5">Přidat plánovaný den</h3>
    <div class="field">
      <label>Den v týdnu</label>
      <select id="planned-day">
        ${DAY_OPTIONS.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Typ tréninku</label>
      <select id="planned-type">
        ${TRAINING_TYPES.map(t => `<option value="${t.label}">${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" onclick="closeModal()">Zrušit</button>
      <button class="btn btn-primary" id="save-planned">Přidat</button>
    </div>
  `);
  modal.querySelector('#save-planned').onclick = () => {
    const day = modal.querySelector('#planned-day').value;
    const type = modal.querySelector('#planned-type').value;
    const block = Blocks.byId(blockId);
    const week = block.weeks.find(w => w.number === weekNumber);
    if (!week.planned_workouts) week.planned_workouts = [];
    week.planned_workouts.push({ day, type });
    Blocks.save(block);
    closeModal();
    openWeekDetail(blockId, weekNumber);
  };
}

window.openNewBlockModal = function() {
  const startDefault = DateUtil.today();
  const modal = openModal(`
    <h3 class="mb-5">Nový blok</h3>
    <div class="field">
      <label>Název bloku</label>
      <input type="text" id="block-name" placeholder="BLOCK #3 - Strength" autofocus>
    </div>
    <div class="field">
      <label>Typ bloku</label>
      <select id="block-type">
        ${BLOCK_TYPES.map(t => `<option value="${t.id}">${t.label} — ${t.desc}</option>`).join('')}
      </select>
    </div>
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div class="field">
        <label>Začátek</label>
        <input type="date" id="block-start" value="${startDefault}">
      </div>
      <div class="field">
        <label>Týdnů</label>
        <select id="block-weeks">
          <option value="5">5 týdnů</option>
          <option value="6" selected>6 týdnů</option>
          <option value="7">7 týdnů</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>
        <input type="checkbox" id="block-deload" style="width: auto; margin-right: 8px;"> První týden je deload
      </label>
    </div>

    <h4 class="mt-5 mb-3" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 600;">
      Šablona týdne
    </h4>
    <div id="template-days" class="flex-col gap-2"></div>
    <button class="btn btn-ghost btn-sm mt-3" id="add-template-day">+ Přidat den do šablony</button>

    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" onclick="closeModal()">Zrušit</button>
      <button class="btn btn-primary" id="create-block">Vytvořit blok</button>
    </div>
  `);

  const templateDays = [
    { day: 'Úterý', type: 'Weighted Intensity' },
    { day: 'Čtvrtek', type: 'Bodyweight Intensity' },
    { day: 'Sobota', type: 'Weighted Volume' },
  ];

  function renderTemplateDays() {
    const el = modal.querySelector('#template-days');
    el.innerHTML = templateDays.map((d, idx) => `
      <div class="flex gap-2" style="align-items: center;">
        <select class="template-day" data-idx="${idx}" style="flex: 1;">
          ${DAY_OPTIONS.map(opt => `<option value="${opt}" ${opt === d.day ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
        <select class="template-type" data-idx="${idx}" style="flex: 1.5;">
          ${TRAINING_TYPES.map(t => `<option value="${t.label}" ${t.label === d.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-icon" data-remove="${idx}">×</button>
      </div>
    `).join('');
    el.querySelectorAll('.template-day').forEach(sel => {
      sel.onchange = (e) => { templateDays[+e.target.dataset.idx].day = e.target.value; };
    });
    el.querySelectorAll('.template-type').forEach(sel => {
      sel.onchange = (e) => { templateDays[+e.target.dataset.idx].type = e.target.value; };
    });
    el.querySelectorAll('[data-remove]').forEach(btn => {
      btn.onclick = (e) => {
        templateDays.splice(+e.target.dataset.remove, 1);
        renderTemplateDays();
      };
    });
  }
  renderTemplateDays();

  modal.querySelector('#add-template-day').onclick = () => {
    templateDays.push({ day: 'Pondělí', type: TRAINING_TYPES[0].label });
    renderTemplateDays();
  };

  modal.querySelector('#create-block').onclick = () => {
    const name = modal.querySelector('#block-name').value.trim();
    if (!name) { toast('Zadej název bloku'); return; }
    const type = modal.querySelector('#block-type').value;
    const startDate = modal.querySelector('#block-start').value;
    const weekCount = parseInt(modal.querySelector('#block-weeks').value);
    const deloadFirst = modal.querySelector('#block-deload').checked;

    Blocks.createNew({
      name,
      type,
      startDate,
      weekCount,
      planTemplate: templateDays.slice(),
      deloadFirst,
    });
    toast('Blok vytvořen ✓');
    closeModal();
    renderCurrentBlock();
    renderBlocksList();
  };
};
