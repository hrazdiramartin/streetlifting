/* ============================================
   SEED — Martinův aktuální BLOCK #2 - Strength
   Spustí se při prvním návštěvě (žádné bloky v storage)
   ============================================ */

const SEED_VERSION = 7;
const DAY_OFFSETS = { 'Pondělí': 0, 'Úterý': 1, 'Středa': 2, 'Čtvrtek': 3, 'Pátek': 4, 'Sobota': 5, 'Neděle': 6 };

// --- Helper: parsuj "8-12" nebo "6" a vrať jako string s -2 reps ---
function reduceReps(reps, delta = 2) {
  if (!reps) return reps;
  // "Max" zůstává Max
  if (/^max$/i.test(reps)) return 'Max';
  // Rozsah "8-12" → "6-10"
  const range = reps.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    return `${Math.max(1, parseInt(range[1]) - delta)}-${Math.max(1, parseInt(range[2]) - delta)}`;
  }
  // Číslo "6" → "4"
  const num = parseInt(reps);
  if (!isNaN(num)) return String(Math.max(1, num - delta));
  return reps;
}

// --- Helper: generuj cviky pro daný typ tréninku v daném týdnu ---
// weekNumber 0 = deload, 1-5 = progrese
function buildExercises(type, weekNumber) {
  // RPE progrese pro week 1-5:
  // Hlavní cviky W. Intensity & BW Intensity: 7 → 8 → 8.5 → 9 → 10
  // Hlavní cviky W. Volume: vždy -1 RPE  →  6 → 7 → 7.5 → 8 → 9
  // Doplňkové cviky: vždy RPE 10
  // Deload (week 0): -2 reps a -2 RPE oproti week 1
  const RPE_MAIN = [7, 8, 8.5, 9, 10];
  const RPE_VOLUME = [6, 7, 7.5, 8, 9];

  const isDeload = weekNumber === 0;
  const refIdx = 0; // deload se odvozuje z week 1
  const idx = isDeload ? refIdx : Math.max(0, Math.min(4, weekNumber - 1));

  let mainRpe = (type === 'Weighted Volume') ? RPE_VOLUME[idx] : RPE_MAIN[idx];
  let accRpe = 10;
  if (isDeload) {
    mainRpe = Math.max(1, mainRpe - 2);
    accRpe = Math.max(1, accRpe - 2);
  }
  const restMain = '4-6 min';
  const restAcc = '2-3 min';

  // Reduce reps for deload by -2
  const r = (reps) => isDeload ? reduceReps(reps, 2) : reps;

  if (type === 'Weighted Intensity') {
    return [
      { name: 'Weighted pull ups', sets: '3', reps: r('6'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Weighted dips',     sets: '3', reps: r('6'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Lowbar squats',     sets: '2', reps: r('6'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Hammer curl',        sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Triceps pushdown',   sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Lateral raises',     sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
    ];
  }

  if (type === 'Bodyweight Intensity') {
    return [
      { name: 'Pull ups',           sets: '4', reps: r('Max'), weight: '0', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Dipy',               sets: '4', reps: r('Max'), weight: '0', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Sissy squats',       sets: '2', reps: r('Max'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Dragon flag',        sets: '2', reps: r('Max'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Biceps curl',        sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Triceps extension',  sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Face pull',          sets: '3', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
    ];
  }

  if (type === 'Weighted Volume') {
    return [
      { name: 'Weighted pull ups', sets: '5', reps: r('3'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Weighted dips',     sets: '5', reps: r('3'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Lowbar squats',     sets: '4', reps: r('3'), weight: '', rpe: String(mainRpe), rest: restMain, record: '', is_main: true },
      { name: 'Hammer curl',        sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Triceps pushdown',   sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
      { name: 'Lateral raises',     sets: '2', reps: r('8-12'), weight: '', rpe: String(accRpe), rest: restAcc, record: '', is_main: false },
    ];
  }

  return [];
}

// --- Helper: jeden týden BLOCK #2 ---
function buildWeek2(weekNumber, startIso) {
  const endIso = DateUtil.addDays(startIso, 6);
  const isDeload = weekNumber === 0;
  return {
    number: weekNumber,
    start_date: startIso,
    end_date: endIso,
    is_deload: isDeload,
    is_pr_week: weekNumber === 5,
    planned_workouts: [
      { day: 'Úterý',    type: 'Weighted Intensity',   exercises: buildExercises('Weighted Intensity', weekNumber) },
      { day: 'Čtvrtek',  type: 'Bodyweight Intensity', exercises: buildExercises('Bodyweight Intensity', weekNumber) },
      { day: 'Sobota',   type: 'Weighted Volume',      exercises: buildExercises('Weighted Volume', weekNumber) },
    ],
  };
}

// --- BLOCK #2 STRENGTH ---
// Week 0 (deload) začíná 25.5.2026, Week 5 končí 5.7.2026 = 6 týdnů celkem
const BLOCK_2_START = '2026-05-25';
const FILIP_SEED = {
  version: SEED_VERSION,
  blocks: [
    {
      name: 'BLOCK #2 - Strength',
      type: 'strength',
      status: 'active',
      start_date: BLOCK_2_START,
      end_date: DateUtil.addDays(BLOCK_2_START, 7 * 6 - 1), // 5.7.2026
      weeks: [0, 1, 2, 3, 4, 5].map(n =>
        buildWeek2(n, DateUtil.addDays(BLOCK_2_START, n * 7))
      ),
    },
  ],
  settings: {
    name: 'Martin',
    level: 'intermediate',
    main_exercises: ['Shyby', 'Dipy', 'Muscle ups', 'Dřepy'],
    onboarded: true,
  },
};

/**
 * Kontrola první návštěvy / staré verze seedu a nabídnutí seed dat.
 */
function checkFirstRun() {
  const settings = Settings.get();
  const storedVersion = Storage.get('sl_seed_version', 0);

  // Pokud user už projel onboarding a stejnou verzi seedu už má, nic
  if (settings.onboarded && storedVersion === SEED_VERSION) return;

  // Pokud nemá vůbec data, ukaž onboarding
  const existingBlocks = Blocks.list();
  const existingWorkouts = Workouts.list();
  if (!existingBlocks.length && !existingWorkouts.length) {
    setTimeout(() => showOnboardingModal(), 400);
    return;
  }

  // Má starou verzi seedu nebo nějaká data — nabídni reset
  if (storedVersion < SEED_VERSION) {
    setTimeout(() => showUpdateSeedModal(), 400);
  }
}

function showOnboardingModal() {
  const modal = openModal(`
    <h3 class="mb-3">Vítej, Martine 👋</h3>
    <p class="mb-5" style="color: var(--text-secondary);">
      Tohle je tvoje osobní streetlifting aplikace. Můžu ti rovnou nahrát
      <strong>BLOCK #2 - Strength</strong> (Week 0 deload + 5 týdnů progrese, 25.5. - 5.7.2026)
      s plánem cviků. Váhy si pak doplníš sám pro každý trénink.
    </p>
    <div class="flex-col gap-3">
      <button class="btn btn-primary" id="seed-yes">Nahrát BLOCK #2</button>
      <button class="btn btn-ghost" id="seed-no">Začnu od nuly</button>
    </div>
  `);
  modal.querySelector('#seed-yes').onclick = () => {
    applySeed();
    closeModal();
    toast('BLOCK #2 nahrán ✓');
    setTimeout(() => location.reload(), 600);
  };
  modal.querySelector('#seed-no').onclick = () => {
    Settings.save({ onboarded: true });
    Storage.set('sl_seed_version', SEED_VERSION);
    closeModal();
  };
}

function showUpdateSeedModal() {
  const modal = openModal(`
    <h3 class="mb-3">Nová verze plánu</h3>
    <p class="mb-5" style="color: var(--text-secondary);">
      Máme aktualizovaný BLOCK #2 — přidán Week 0 (deload) na začátek bloku.
      Chceš ho nahrát? Stávající bloky a předvytvořené (neodtrénované) tréninky budou
      nahrazeny, ale dokončené tréninky a tělesné váhy zůstanou.
    </p>
    <div class="flex-col gap-3">
      <button class="btn btn-primary" id="seed-update">Nahrát novou verzi</button>
      <button class="btn btn-ghost" id="seed-skip">Nech to být</button>
    </div>
  `);
  modal.querySelector('#seed-update').onclick = () => {
    // Smaž staré bloky a všechny prázdné (nedokončené) workouty
    Storage.set('sl_blocks', []);
    const remaining = Workouts.list().filter(w => w.is_completed || w.is_skipped || Workouts.hasData(w));
    Storage.set('sl_workouts', remaining);
    applySeed();
    closeModal();
    toast('Plán aktualizován ✓');
    setTimeout(() => location.reload(), 600);
  };
  modal.querySelector('#seed-skip').onclick = () => {
    Storage.set('sl_seed_version', SEED_VERSION);
    closeModal();
  };
}

function applySeed() {
  const savedBlocks = FILIP_SEED.blocks.map(b => Blocks.save({ ...b }));
  Settings.save(FILIP_SEED.settings);

  // Předvytvoř workouts pro každý plánovaný trénink v každém týdnu každého bloku
  savedBlocks.forEach(block => {
    block.weeks.forEach(week => {
      (week.planned_workouts || []).forEach(plan => {
        const offset = DAY_OFFSETS[plan.day];
        if (offset === undefined) return;
        const date = DateUtil.addDays(week.start_date, offset);

        // Vynech, pokud už existuje workout na tomto dni
        if (Workouts.byDate(date)) return;

        Workouts.save({
          date,
          type: plan.type,
          block_id: block.id,
          week_number: week.number,
          from_plan: true,
          exercises: (plan.exercises || []).map(e => ({ ...e, from_plan: true, note: '' })),
          notes: '',
        });
      });
    });
  });

  Storage.set('sl_seed_version', SEED_VERSION);
}

document.addEventListener('DOMContentLoaded', checkFirstRun);
