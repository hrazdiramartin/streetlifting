/* ============================================
   DATA LAYER — localStorage abstrakce
   ============================================ */

const STORAGE_KEYS = {
  WORKOUTS: 'sl_workouts',
  BLOCKS: 'sl_blocks',
  BODY_WEIGHTS: 'sl_body_weights',
  SETTINGS: 'sl_settings',
  EXERCISES: 'sl_exercises',
  PRS: 'sl_prs',
};

const MAIN_EXERCISES = ['Shyby', 'Dipy', 'Muscle ups', 'Dřepy'];

const TRAINING_TYPES = [
  { id: 'bw-intensity', label: 'Bodyweight Intensity', color: 'rgb(212, 165, 116)' },
  { id: 'w-intensity', label: 'Weighted Intensity', color: 'rgb(184, 92, 74)' },
  { id: 'w-volume', label: 'Weighted Volume', color: 'rgb(110, 138, 155)' },
  { id: 'custom', label: 'Vlastní', color: 'rgb(180, 180, 180)' },
];

const BLOCK_TYPES = [
  { id: 'volume', label: 'Volume', desc: 'Vyšší objem, nižší intenzita (např. 3x12 → 3x9)' },
  { id: 'strength', label: 'Strength', desc: 'Vyšší intenzita, nižší objem (např. 3x10 → 3x6)' },
  { id: 'hypertrophy', label: 'Hypertrophy', desc: 'Střední objem i intenzita' },
  { id: 'peaking', label: 'Peaking', desc: 'Maximální intenzita, nízký objem' },
];

/* --- Storage helpers --- */
const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read error:', e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write error:', e);
      return false;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

/* --- IDs --- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/* --- Date helpers --- */
const DateUtil = {
  today() {
    return new Date().toISOString().slice(0, 10);
  },
  format(isoDate, opts = {}) {
    const d = new Date(isoDate);
    const months = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
                    'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    if (opts.short) {
      return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
    }
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  formatRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getDate()}.${s.getMonth() + 1}. – ${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
  },
  dayName(isoDate) {
    const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    return days[new Date(isoDate).getDay()];
  },
  addDays(isoDate, days) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  },
  daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  },
  weekRange(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    const start = d.toISOString().slice(0, 10);
    const end = DateUtil.addDays(start, 6);
    return { start, end };
  },
};

/* --- Workout API --- */
const Workouts = {
  list() {
    return Storage.get(STORAGE_KEYS.WORKOUTS, []);
  },
  byDate(isoDate) {
    return this.list().find(w => w.date === isoDate);
  },
  byBlockWeek(blockId, weekNumber) {
    return this.list().filter(w => w.block_id === blockId && w.week_number === weekNumber);
  },
  forExercise(exerciseName) {
    const all = this.list();
    const results = [];
    all.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (ex.name.toLowerCase() === exerciseName.toLowerCase()) {
          results.push({
            date: w.date,
            ...ex,
            workout_id: w.id,
          });
        }
      });
    });
    return results.sort((a, b) => a.date.localeCompare(b.date));
  },
  save(workout) {
    const all = this.list();
    if (!workout.id) workout.id = uid();
    const idx = all.findIndex(w => w.id === workout.id);
    workout.updated_at = new Date().toISOString();
    if (idx >= 0) {
      all[idx] = workout;
    } else {
      workout.created_at = new Date().toISOString();
      all.push(workout);
    }
    Storage.set(STORAGE_KEYS.WORKOUTS, all);
    return workout;
  },
  remove(id) {
    const all = this.list().filter(w => w.id !== id);
    Storage.set(STORAGE_KEYS.WORKOUTS, all);
  },
  recent(limit = 10) {
    return this.list()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  },
  /** True, pokud workout je explicitně dokončený, nebo má vyplněnou váhu u alespoň jednoho cviku */
  hasData(workout) {
    if (!workout) return false;
    if (workout.is_completed) return true;
    if (!workout.exercises) return false;
    return workout.exercises.some(e => {
      const w = String(e.weight || '').trim();
      return w !== '' && w !== '0';
    });
  },
  /** Pouze skutečně odtrénované tréninky (s daty), seřazené od nejnovějšího */
  completed(limit = 10) {
    return this.list()
      .filter(w => this.hasData(w))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  },
};

/* --- Block API --- */
const Blocks = {
  list() {
    return Storage.get(STORAGE_KEYS.BLOCKS, []);
  },
  current() {
    const today = DateUtil.today();
    const blocks = this.list();
    // Aktivní = today je v rozsahu bloku, nebo blok startuje do 7 dní
    const inRange = blocks.find(b => {
      const lastWeek = b.weeks[b.weeks.length - 1];
      return today >= b.start_date && today <= lastWeek.end_date;
    });
    if (inRange) return inRange;
    // Pokud žádný neběží, vezmi nejbližší nadcházející do 7 dní
    return blocks
      .filter(b => b.start_date > today && DateUtil.daysBetween(today, b.start_date) <= 7)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] || null;
  },
  /**
   * Vrátí aktuálně běžící blok, nebo nejbližší nadcházející.
   */
  currentOrUpcoming() {
    const today = DateUtil.today();
    const blocks = this.list().slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
    const active = blocks.find(b => today >= b.start_date && today <= b.weeks[b.weeks.length - 1].end_date);
    if (active) return active;
    return blocks.find(b => b.start_date > today) || null;
  },
  byId(id) {
    return this.list().find(b => b.id === id);
  },
  save(block) {
    const all = this.list();
    if (!block.id) block.id = uid();
    const idx = all.findIndex(b => b.id === block.id);
    if (idx >= 0) {
      all[idx] = block;
    } else {
      all.push(block);
    }
    Storage.set(STORAGE_KEYS.BLOCKS, all);
    return block;
  },
  remove(id) {
    const all = this.list().filter(b => b.id !== id);
    Storage.set(STORAGE_KEYS.BLOCKS, all);
  },
  currentWeek(block) {
    if (!block) return null;
    const today = DateUtil.today();
    const inRange = block.weeks.find(w => today >= w.start_date && today <= w.end_date);
    if (inRange) return inRange;
    // Pokud žádný týden nepokrývá today, vezmi nejbližší nadcházející v rámci 7 dní
    return block.weeks
      .filter(w => w.start_date > today && DateUtil.daysBetween(today, w.start_date) <= 7)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] || null;
  },
  /**
   * Vrátí aktuální týden bloku, nebo nejbližší nadcházející.
   */
  currentOrNextWeek(block) {
    if (!block) return null;
    const today = DateUtil.today();
    const active = block.weeks.find(w => today >= w.start_date && today <= w.end_date);
    if (active) return active;
    return block.weeks.find(w => w.start_date > today) || null;
  },
  createNew({ name, type, startDate, weekCount, planTemplate, deloadFirst }) {
    const weeks = [];
    for (let i = 0; i < weekCount; i++) {
      const start = DateUtil.addDays(startDate, i * 7);
      const end = DateUtil.addDays(start, 6);
      weeks.push({
        number: i + 1,
        start_date: start,
        end_date: end,
        is_deload: deloadFirst && i === 0,
        planned_workouts: planTemplate || [],
      });
    }
    return this.save({
      name,
      type,
      start_date: startDate,
      end_date: weeks[weeks.length - 1].end_date,
      weeks,
      created_at: new Date().toISOString(),
    });
  },
};

/* --- Body weight API --- */
const BodyWeight = {
  list() {
    return Storage.get(STORAGE_KEYS.BODY_WEIGHTS, []).sort((a, b) => a.date.localeCompare(b.date));
  },
  latest() {
    const all = this.list();
    return all.length ? all[all.length - 1] : null;
  },
  add(weightKg, isoDate = null, note = '') {
    const date = isoDate || DateUtil.today();
    const all = this.list();
    const existing = all.findIndex(b => b.date === date);
    const entry = { date, weight: parseFloat(weightKg), note };
    if (existing >= 0) {
      all[existing] = entry;
    } else {
      all.push(entry);
    }
    Storage.set(STORAGE_KEYS.BODY_WEIGHTS, all);
    return entry;
  },
  remove(date) {
    const all = this.list().filter(b => b.date !== date);
    Storage.set(STORAGE_KEYS.BODY_WEIGHTS, all);
  },
  trend(days = 30) {
    const all = this.list();
    if (all.length < 2) return null;
    const cutoff = DateUtil.addDays(DateUtil.today(), -days);
    const recent = all.filter(b => b.date >= cutoff);
    if (recent.length < 2) return null;
    const first = recent[0].weight;
    const last = recent[recent.length - 1].weight;
    return { delta: last - first, days };
  },
};

/* --- PR (Personal Records) API --- */
const PRs = {
  list() {
    return Storage.get(STORAGE_KEYS.PRS, []);
  },
  forExercise(exercise) {
    return this.list().filter(p => p.exercise === exercise);
  },
  /** Vrátí nejlepší (nejvyšší váha) PR pro daný cvik a RM */
  best(exercise, rm) {
    const matches = this.list().filter(p => p.exercise === exercise && p.rm === rm);
    if (!matches.length) return null;
    return matches.reduce((best, p) => p.weight > best.weight ? p : best, matches[0]);
  },
  /** Vrátí všechny záznamy pro daný cvik + RM seřazené chronologicky */
  history(exercise, rm) {
    return this.list()
      .filter(p => p.exercise === exercise && p.rm === rm)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  add({ exercise, rm, weight, date, note = '' }) {
    const all = this.list();
    const entry = {
      id: uid(),
      exercise,
      rm: parseInt(rm),
      weight: parseFloat(weight),
      date: date || DateUtil.today(),
      note,
      created_at: new Date().toISOString(),
    };
    all.push(entry);
    Storage.set(STORAGE_KEYS.PRS, all);
    return entry;
  },
  update(id, updates) {
    const all = this.list();
    const idx = all.findIndex(p => p.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...updates };
    Storage.set(STORAGE_KEYS.PRS, all);
    return all[idx];
  },
  remove(id) {
    const all = this.list().filter(p => p.id !== id);
    Storage.set(STORAGE_KEYS.PRS, all);
  },
};

/* --- Settings API --- */
const Settings = {
  get() {
    return Storage.get(STORAGE_KEYS.SETTINGS, {
      name: 'Martin',
      height_cm: null,
      level: 'intermediate',
      main_exercises: MAIN_EXERCISES,
      onboarded: false,
    });
  },
  save(updates) {
    const current = this.get();
    const next = { ...current, ...updates };
    Storage.set(STORAGE_KEYS.SETTINGS, next);
    return next;
  },
};

/* --- Calculations --- */
const Calc = {
  /** Estimated 1RM using Epley formula */
  estimate1RM(weight, reps) {
    if (!weight || !reps || reps < 1) return null;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  },
  /** Total volume for a set: weight × reps */
  setVolume(weight, reps) {
    return (parseFloat(weight) || 0) * (parseInt(reps) || 0);
  },
  /** Total volume for an exercise across all sets */
  exerciseVolume(exercise) {
    const sets = parseInt(exercise.sets) || 0;
    const reps = parseInt(exercise.reps) || 0;
    const weight = parseFloat(exercise.weight) || 0;
    if (weight === 0) return reps * sets; // bodyweight: just reps
    return sets * reps * weight;
  },
  /** Best set across history for an exercise */
  bestSet(history) {
    if (!history.length) return null;
    let best = history[0];
    let bestScore = Calc.estimate1RM(history[0].weight, history[0].reps) || 0;
    history.forEach(h => {
      const score = Calc.estimate1RM(h.weight, h.reps) || 0;
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    });
    return best;
  },
  /** RPE category */
  rpeCategory(rpe) {
    const n = parseFloat(rpe);
    if (isNaN(n)) return null;
    if (n <= 7) return 'low';
    if (n <= 8) return 'mid';
    if (n <= 9) return 'high';
    return 'max';
  },
};

/* --- Export/Import --- */
const DataIO = {
  exportAll() {
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      workouts: Workouts.list(),
      blocks: Blocks.list(),
      body_weights: BodyWeight.list(),
      prs: PRs.list(),
      settings: Settings.get(),
    };
  },
  exportJSON() {
    const data = this.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streetlifting-backup-${DateUtil.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.workouts) Storage.set(STORAGE_KEYS.WORKOUTS, data.workouts);
    if (data.blocks) Storage.set(STORAGE_KEYS.BLOCKS, data.blocks);
    if (data.body_weights) Storage.set(STORAGE_KEYS.BODY_WEIGHTS, data.body_weights);
    if (data.settings) Storage.set(STORAGE_KEYS.SETTINGS, data.settings);
    if (data.prs) Storage.set(STORAGE_KEYS.PRS, data.prs);
    return true;
  },
};
