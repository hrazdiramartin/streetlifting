/* ============================================
   TRAINING — záznam a editace tréninků
   ============================================ */

let currentWorkout = null;

document.addEventListener('DOMContentLoaded', () => {
  renderNav('training.html');

  // Nejdřív napumpovat selecty (jinak openEditor nastaví neexistující value)
  populateTypeFilter();
  attachListHandlers();
  attachEditorHandlers();

  const params = new URLSearchParams(location.search);
  if (params.get('new') === '1') {
    openEditor(buildNewWorkout(params.get('type'), null, params.get('block_id'), params.get('week_number')));
  } else if (params.get('date')) {
    const existing = Workouts.byDate(params.get('date'));
    if (existing) {
      openEditor(existing);
    } else {
      openEditor(buildNewWorkout(null, params.get('date')));
    }
  } else if (params.get('id')) {
    const w = Workouts.list().find(x => x.id === params.get('id'));
    if (w) openEditor(w);
    else showListView();
  } else {
    showListView();
  }
});

function attachListHandlers() {
  document.getElementById('btn-new-workout').onclick = () => {
    openEditor(buildNewWorkout());
  };
  document.getElementById('filter-type').onchange = (e) => renderWorkoutList(e.target.value);
}

function attachEditorHandlers() {
  document.getElementById('btn-back-to-list').onclick = showListView;
  document.getElementById('btn-cancel').onclick = showListView;
  const addBtn = document.getElementById('btn-add-exercise');
  if (addBtn) addBtn.onclick = () => addExerciseRow();
  const addBtnBottom = document.getElementById('btn-add-exercise-bottom');
  if (addBtnBottom) addBtnBottom.onclick = () => addExerciseRow();
  const completeBtn = document.getElementById('btn-complete-workout');
  if (completeBtn) completeBtn.onclick = () => saveCurrentWorkout('completed');
  const skipBtn = document.getElementById('btn-skip-workout');
  if (skipBtn) skipBtn.onclick = openSkipModal;
  const resetBtn = document.getElementById('btn-reset-workout');
  if (resetBtn) resetBtn.onclick = resetWorkoutStatus;
}

function resetWorkoutStatus() {
  const wasCompleted = currentWorkout.is_completed;
  const wasSkipped = currentWorkout.is_skipped;
  const label = wasCompleted ? 'dokončený' : (wasSkipped ? 'nedokončený' : 'označený');
  confirmAction(`Vrátit ${label} trénink zpátky do plánu? Záznamy váhy/RPE/opakování zůstanou, jen se odznačí stav.`, () => {
    currentWorkout.is_completed = false;
    currentWorkout.is_skipped = false;
    delete currentWorkout.completed_at;
    delete currentWorkout.skipped_at;
    delete currentWorkout.skip_reason;
    Workouts.save(currentWorkout);
    toast('Vráceno do plánu ✓');
    setTimeout(() => showListView(), 400);
  });
}

function openSkipModal() {
  const existingReason = currentWorkout.skip_reason || '';
  const modal = openModal(`
    <h3 class="mb-3">Nedokončený trénink</h3>
    <p class="mb-4" style="color: var(--text-secondary); font-size: 0.9rem;">
      Z jakého důvodu jsi trénink nedokončil/a? (nemoc, zranění, časový tlak, ...)
    </p>
    <div class="field">
      <label>Důvod</label>
      <textarea id="skip-reason" rows="3" placeholder="např. zranění ramene, nemoc, časový tlak ..." autofocus>${existingReason}</textarea>
    </div>
    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" id="skip-cancel">Zrušit</button>
      <button class="btn btn-primary" id="skip-save">Uložit jako nedokončené</button>
    </div>
  `);
  modal.querySelector('#skip-cancel').onclick = () => closeModal();
  modal.querySelector('#skip-save').onclick = () => {
    const reason = modal.querySelector('#skip-reason').value.trim();
    if (!reason) {
      toast('Napiš důvod');
      return;
    }
    currentWorkout.skip_reason = reason;
    closeModal();
    saveCurrentWorkout('skipped');
  };
}

function populateTypeFilter() {
  const filter = document.getElementById('filter-type');
  TRAINING_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.label;
    opt.textContent = t.label;
    filter.appendChild(opt);
  });

  const typeSel = document.getElementById('workout-type');
  TRAINING_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.label;
    opt.textContent = t.label;
    typeSel.appendChild(opt);
  });
}

/**
 * Najde plánovaný trénink pro daný blok, týden a typ/den.
 */
function findPlannedWorkout(blockId, weekNumber, dayName, type) {
  if (!blockId) return null;
  const block = Blocks.byId(blockId);
  if (!block) return null;

  let week;
  if (weekNumber) {
    week = block.weeks.find(w => String(w.number) === String(weekNumber));
  } else {
    return null;
  }
  if (!week) return null;

  // Hledáme nejdřív podle typu, pak podle dne
  let plan = (week.planned_workouts || []).find(p => p.type === type);
  if (!plan && dayName) {
    plan = (week.planned_workouts || []).find(p => p.day === dayName);
  }
  return plan;
}

function buildNewWorkout(typeLabel = null, date = null, blockIdParam = null, weekNumberParam = null) {
  const today = date || DateUtil.today();
  const block = blockIdParam ? Blocks.byId(blockIdParam) : Blocks.current();
  let week = null;
  if (block) {
    if (weekNumberParam) {
      week = block.weeks.find(w => String(w.number) === String(weekNumberParam));
    } else {
      week = block.weeks.find(w => today >= w.start_date && today <= w.end_date);
    }
  }

  const dayName = DateUtil.dayName(today);
  const plannedForDay = week && (week.planned_workouts || []).find(p => p.day === dayName);
  const type = typeLabel || (plannedForDay && plannedForDay.type) || 'Bodyweight Intensity';

  // Try to find the planned workout
  const plan = block && week
    ? findPlannedWorkout(block.id, week.number, dayName, type)
    : null;

  const exercises = plan && plan.exercises && plan.exercises.length
    ? plan.exercises.map(e => ({ ...e, from_plan: true, note: '' }))
    : defaultExercisesForType(type);

  return {
    date: today,
    type,
    block_id: block ? block.id : null,
    week_number: week ? week.number : null,
    from_plan: !!(plan && plan.exercises && plan.exercises.length),
    exercises,
    notes: '',
  };
}

function defaultExercisesForType(typeLabel) {
  return [
    { name: '', sets: '', reps: '', weight: '', rpe: '', rest: '', from_plan: false },
  ];
}

function openEditor(workout) {
  currentWorkout = workout;
  document.getElementById('workout-list-view').style.display = 'none';
  document.getElementById('workout-editor-view').style.display = 'block';

  document.getElementById('workout-date').value = workout.date;
  document.getElementById('workout-type').value = workout.type || 'Bodyweight Intensity';
  document.getElementById('workout-notes').value = workout.notes || '';

  populateBlockSelect();
  document.getElementById('workout-block').value = workout.block_id || '';

  // Hlídej změnu data, ať enable/disable tlačítek byl správný
  document.getElementById('workout-date').onchange = updateActionButtonsState;

  renderExercises();
  updateActionButtonsState();

  // Tlačítko "Vrátit do plánu" jen pokud je workout v stavu completed nebo skipped
  const resetBtn = document.getElementById('btn-reset-workout');
  if (resetBtn) {
    const isMarked = !!(workout.is_completed || workout.is_skipped);
    resetBtn.style.display = isMarked ? 'inline-flex' : 'none';
    resetBtn.textContent = workout.is_completed ? '↺ Vrátit do plánu (dokončené)'
      : workout.is_skipped ? '↺ Vrátit do plánu (nedokončené)'
      : '↺ Vrátit do plánu';
  }

  const editorEyebrow = document.getElementById('editor-eyebrow');
  const editorTitle = document.getElementById('editor-title');
  if (workout.id) {
    editorEyebrow.textContent = `${DateUtil.dayName(workout.date)} • ${DateUtil.format(workout.date)}`;
    editorTitle.textContent = 'Upravit trénink';
    document.getElementById('btn-delete-workout').style.display = 'inline-flex';
  } else {
    const block = workout.block_id ? Blocks.byId(workout.block_id) : null;
    const ctx = block ? `${block.name} • Týden ${workout.week_number}` : 'Nový záznam';
    editorEyebrow.textContent = ctx;
    editorTitle.textContent = workout.from_plan ? `Trénink podle plánu — ${workout.type}` : 'Nový trénink';
    document.getElementById('btn-delete-workout').style.display = 'none';
  }
}

/**
 * Povolí Dokončeno / Nedokončeno tlačítka jen pokud datum tréninku === dnešní datum.
 */
function updateActionButtonsState() {
  const dateInput = document.getElementById('workout-date');
  const workoutDate = dateInput?.value || (currentWorkout && currentWorkout.date);
  const today = DateUtil.today();
  const isToday = workoutDate === today;

  const completeBtn = document.getElementById('btn-complete-workout');
  const skipBtn = document.getElementById('btn-skip-workout');

  [completeBtn, skipBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = !isToday;
    btn.classList.toggle('btn-disabled', !isToday);
    if (!isToday) {
      const diff = DateUtil.daysBetween(today, workoutDate);
      const tooltip = diff > 0
        ? `Trénink je naplánovaný za ${diff} ${diff === 1 ? 'den' : diff < 5 ? 'dny' : 'dní'} — označit ho můžeš až v den tréninku (${DateUtil.format(workoutDate, { short: true })}).`
        : `Trénink byl ${-diff} ${-diff === 1 ? 'den' : -diff < 5 ? 'dny' : 'dní'} zpátky — označit ho můžeš jen v den tréninku.`;
      btn.title = tooltip;
    } else {
      btn.title = '';
    }
  });

  // Hint pod tlačítky
  let hint = document.getElementById('date-restriction-hint');
  if (!isToday) {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'date-restriction-hint';
      hint.className = 'date-restriction-hint';
      const actions = completeBtn?.parentElement;
      if (actions) actions.parentElement.insertBefore(hint, actions);
    }
    const diff = DateUtil.daysBetween(today, workoutDate);
    hint.innerHTML = diff > 0
      ? `🕒 Trénink je naplánovaný na <strong>${DateUtil.dayName(workoutDate)} ${DateUtil.format(workoutDate, { short: true })}</strong>. Označit ho jako dokončený/nedokončený můžeš až v ten den.`
      : `🕒 Trénink byl na <strong>${DateUtil.dayName(workoutDate)} ${DateUtil.format(workoutDate, { short: true })}</strong>. Změnit stav můžeš jen v den tréninku.`;
  } else if (hint) {
    hint.remove();
  }
}

function populateBlockSelect() {
  const sel = document.getElementById('workout-block');
  sel.innerHTML = '<option value="">— bez bloku —</option>';
  Blocks.list().forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    sel.appendChild(opt);
  });
}

function renderExercises() {
  const rows = document.getElementById('exercise-rows');
  rows.innerHTML = '';
  (currentWorkout.exercises || []).forEach((ex, idx) => {
    rows.appendChild(buildExerciseRow(ex, idx));
  });
}

function buildExerciseRow(ex, idx) {
  const row = document.createElement('div');
  row.className = 'workout-row';
  if (ex.is_main) row.classList.add('is-main');
  row.dataset.idx = idx;

  // Pokud je cvik z plánu, zamkni vše kromě Váhy a RPE
  const locked = !!ex.from_plan;
  const lockAttr = locked ? 'readonly' : '';
  const lockClass = locked ? 'locked' : '';

  if (window.innerWidth <= 720) {
    row.innerHTML = `
      <div class="exercise-name-row">
        <input class="exercise-name ${lockClass}" type="text" placeholder="Cvik" value="${ex.name || ''}" data-field="name" ${lockAttr}>
        ${ex.is_main ? '<span class="badge badge-accent" style="font-size: 0.65rem;">hlavní</span>' : ''}
      </div>
      <div class="field-group">
        <div class="field-mobile">
          <label>Série</label>
          <input class="${lockClass}" type="text" inputmode="numeric" value="${ex.sets || ''}" data-field="sets" ${lockAttr}>
        </div>
        <div class="field-mobile">
          <label>Opak.</label>
          <input class="${lockClass}" type="text" value="${ex.reps || ''}" data-field="reps" ${lockAttr}>
        </div>
        <div class="field-mobile">
          <label>Váha</label>
          <input type="text" inputmode="decimal" value="${ex.weight || ''}" data-field="weight" placeholder="kg">
        </div>
        <div class="field-mobile">
          <label>RPE</label>
          <input type="text" inputmode="decimal" value="${ex.rpe || ''}" data-field="rpe">
        </div>
        <div class="field-mobile">
          <label>Rest</label>
          <input class="${lockClass}" type="text" value="${ex.rest || ''}" data-field="rest" ${lockAttr}>
        </div>
        ${ex.is_main ? `
        <div class="field-mobile record-mobile">
          <label>Záznam (opakování každé série)</label>
          <input type="text" value="${ex.record || ''}" data-field="record" placeholder="">
        </div>` : ''}
      </div>
      ${locked ? '' : `
      <div class="flex gap-2 mt-2" style="justify-content: flex-end;">
        <button class="btn btn-ghost btn-sm" data-action="remove">Odstranit</button>
      </div>`}
    `;
  } else {
    const recordCell = ex.is_main
      ? `<input type="text" value="${ex.record || ''}" data-field="record" placeholder="">`
      : `<span class="record-na">—</span>`;
    row.innerHTML = `
      <input class="exercise-name ${lockClass}" type="text" placeholder="Cvik" value="${ex.name || ''}" data-field="name" ${lockAttr}>
      <input class="${lockClass}" type="text" inputmode="numeric" value="${ex.sets || ''}" data-field="sets" placeholder="3" ${lockAttr}>
      <input class="${lockClass}" type="text" value="${ex.reps || ''}" data-field="reps" placeholder="10" ${lockAttr}>
      <input type="text" inputmode="decimal" value="${ex.weight || ''}" data-field="weight" placeholder="kg">
      <input type="text" inputmode="decimal" value="${ex.rpe || ''}" data-field="rpe" placeholder="8">
      <input class="${lockClass}" type="text" value="${ex.rest || ''}" data-field="rest" placeholder="3" ${lockAttr}>
      ${recordCell}
    `;
  }

  row.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const field = inp.dataset.field;
      currentWorkout.exercises[idx][field] = inp.value;
    });
  });

  const remBtn = row.querySelector('[data-action="remove"]');
  if (remBtn) {
    remBtn.onclick = () => {
      currentWorkout.exercises.splice(idx, 1);
      renderExercises();
    };
  }

  return row;
}

function addExerciseRow() {
  currentWorkout.exercises.push({ name: '', sets: '', reps: '', weight: '', rpe: '', rest: '', record: '', from_plan: false });
  renderExercises();
}

function saveCurrentWorkout(status = 'draft') {
  currentWorkout.date = document.getElementById('workout-date').value;
  currentWorkout.type = document.getElementById('workout-type').value;
  currentWorkout.notes = document.getElementById('workout-notes').value;

  // Pojistka — dokončené/nedokončené jen v den tréninku
  if ((status === 'completed' || status === 'skipped') && currentWorkout.date !== DateUtil.today()) {
    toast('Označit jako ' + (status === 'completed' ? 'dokončené' : 'nedokončené') + ' lze jen v den tréninku');
    return;
  }
  const blockId = document.getElementById('workout-block').value;
  currentWorkout.block_id = blockId || null;
  if (blockId) {
    const block = Blocks.byId(blockId);
    if (block) {
      const week = block.weeks.find(w => currentWorkout.date >= w.start_date && currentWorkout.date <= w.end_date);
      currentWorkout.week_number = week ? week.number : null;
    }
  } else {
    currentWorkout.week_number = null;
  }

  currentWorkout.exercises = currentWorkout.exercises.filter(e => e.name && e.name.trim());

  if (!currentWorkout.date) {
    toast('Zadej datum');
    return;
  }
  if (!currentWorkout.exercises.length) {
    toast('Přidej alespoň jeden cvik');
    return;
  }

  if (status === 'completed') {
    currentWorkout.is_completed = true;
    currentWorkout.is_skipped = false;
    currentWorkout.completed_at = new Date().toISOString();
    currentWorkout.skip_reason = '';
  } else if (status === 'skipped') {
    currentWorkout.is_completed = false;
    currentWorkout.is_skipped = true;
    currentWorkout.skipped_at = new Date().toISOString();
  }

  Workouts.save(currentWorkout);
  const msg = status === 'completed' ? 'Trénink dokončen ✓'
    : status === 'skipped' ? 'Uloženo jako nedokončené'
    : 'Uloženo';
  toast(msg);
  setTimeout(() => showListView(), 400);
}

function showListView() {
  document.getElementById('workout-list-view').style.display = 'block';
  document.getElementById('workout-editor-view').style.display = 'none';
  renderWorkoutList();

  // Pokud sessionStorage obsahuje highlight, scrolluj a zazáři.
  // Flag necháváme dokud animation nedoběhne (pro případ, že showListView je
  // voláno víckrát rychle za sebou — re-render by jinak smazal flash třídu).
  const raw = sessionStorage.getItem('__sl_highlight');
  if (raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { sessionStorage.removeItem('__sl_highlight'); }
    if (parsed) {
      const age = Date.now() - (parsed.t || 0);
      if (age > 4000) {
        sessionStorage.removeItem('__sl_highlight');
      } else {
        setTimeout(() => highlightWeekInHistory(parsed.blockId, parsed.weekNumber), 100);
      }
    }
  }
  history.replaceState({}, '', 'training.html');
}

function highlightWeekInHistory(blockId, weekNumber) {
  const el = document.querySelector(`.history-week[data-block-id="${blockId}"][data-week-number="${weekNumber}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash-highlight');
  el.addEventListener('animationend', () => {
    el.classList.remove('flash-highlight');
    sessionStorage.removeItem('__sl_highlight');
  }, { once: true });
}

function renderWorkoutList(typeFilter = '') {
  const container = document.getElementById('workout-list');
  const today = DateUtil.today();
  let workouts = Workouts.list();
  if (typeFilter) workouts = workouts.filter(w => w.type === typeFilter);

  if (!workouts.length) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div>Zatím žádné tréninky.</div>
        <div class="text-muted mt-2" style="font-size: 0.85rem;">
          Klikni na "+ Nový trénink" a začni.
        </div>
      </div>
    `;
    return;
  }

  // Hierarchie: Blok → Týden → Tréninky
  const blocks = Blocks.list();
  const blockGroups = new Map(); // block_id -> { block, weeks: Map<weekNum, [workouts]> }
  const standalone = []; // workouts bez bloku

  workouts.forEach(w => {
    if (!w.block_id) { standalone.push(w); return; }
    if (!blockGroups.has(w.block_id)) {
      const block = blocks.find(b => b.id === w.block_id);
      blockGroups.set(w.block_id, { block, weeks: new Map() });
    }
    const grp = blockGroups.get(w.block_id);
    const wk = w.week_number || 0;
    if (!grp.weeks.has(wk)) grp.weeks.set(wk, []);
    grp.weeks.get(wk).push(w);
  });

  // Seřaď bloky: aktivní/nadcházející nahoře, pak ostatní podle start_date desc
  const blockEntries = Array.from(blockGroups.entries()).sort((a, b) => {
    const aStart = a[1].block?.start_date || '0';
    const bStart = b[1].block?.start_date || '0';
    return bStart.localeCompare(aStart); // nejnovější bloky nahoře
  });

  const renderWorkoutCard = (w) => {
    const isCompleted = w.is_completed || Workouts.hasData(w);
    const isSkipped = w.is_skipped;
    const isFuture = w.date >= today;
    const isToday = w.date === today;
    const status = isSkipped ? '× nedokončeno'
      : isCompleted ? '✓ dokončeno'
      : isToday ? 'dnes'
      : (isFuture ? 'naplánováno' : 'nevyplněno');
    const statusClass = isSkipped ? 'skipped'
      : isCompleted ? 'completed'
      : isToday ? 'today'
      : (isFuture ? 'upcoming' : 'missed');
    return `
      <a href="training.html?id=${w.id}" class="card card-compact" style="display: block;">
        <div class="flex-between">
          <div>
            <div style="font-weight: 500;">${w.type || 'Trénink'}</div>
            <div class="text-muted" style="font-size: 0.8rem;">
              ${DateUtil.dayName(w.date)} • ${DateUtil.format(w.date, { short: true })}
            </div>
          </div>
          <span class="week-day-status ${statusClass}">${status}</span>
        </div>
      </a>
    `;
  };

  const blocksHtml = blockEntries.map(([bid, grp]) => {
    const block = grp.block;
    const blockName = block?.name || 'Neznámý blok';
    const blockMeta = block ? `${DateUtil.formatRange(block.start_date, block.end_date)} • ${block.weeks.length} týdnů` : '';

    // Seřaď týdny chronologicky
    const weekEntries = Array.from(grp.weeks.entries()).sort((a, b) => a[0] - b[0]);

    const weeksHtml = weekEntries.map(([wkNum, items]) => {
      // Najdi rozsah dat týdne
      const weekMeta = block?.weeks.find(w => w.number === wkNum);
      const weekRange = weekMeta ? DateUtil.formatRange(weekMeta.start_date, weekMeta.end_date) : '';
      // Seřaď tréninky v týdnu chronologicky
      const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
      return `
        <div class="history-week" data-block-id="${bid}" data-week-number="${wkNum}">
          <div class="history-week-header">
            <span class="history-week-title">Týden ${wkNum}${weekMeta?.is_deload ? ' • Deload' : ''}${weekMeta?.is_pr_week ? ' • PR' : ''}</span>
            <span class="history-week-dates">${weekRange}</span>
          </div>
          <div class="flex-col gap-2">
            ${sorted.map(renderWorkoutCard).join('')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="history-block">
        <header class="history-block-header">
          <h2 class="history-block-title">${blockName}</h2>
          ${blockMeta ? `<div class="history-block-meta">${blockMeta}</div>` : ''}
        </header>
        <div class="history-weeks">
          ${weeksHtml}
        </div>
      </section>
    `;
  }).join('');

  // Standalone tréninky (bez bloku) jako samostatná sekce na konec
  let standaloneHtml = '';
  if (standalone.length) {
    const sortedStandalone = standalone.slice().sort((a, b) => b.date.localeCompare(a.date));
    standaloneHtml = `
      <section class="history-block">
        <header class="history-block-header">
          <h2 class="history-block-title">Bez bloku</h2>
          <div class="history-block-meta">${standalone.length} tréninků</div>
        </header>
        <div class="flex-col gap-2">
          ${sortedStandalone.map(renderWorkoutCard).join('')}
        </div>
      </section>
    `;
  }

  container.innerHTML = blocksHtml + standaloneHtml;
}
