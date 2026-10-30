// Storage layer: localStorage / Supabase-row keys, constants, the synced-row cache helpers and the readers for stored data.
const K={fics:'ao3_fic_tracker_v1',log:'ao3_word_log_v4',mood:'ao3_mood_log_v1',period:'ao3_period_log_v1'},TOT='ao3_word_total_v4',STAR='ao3_star_ratings_v1';
const WPM=215,BOOK=90000,GOAL=700000,TZ='Europe/Prague';
const MAP={fics:K.fics,notesFicMap:'ao3_notes_ficmap',total:TOT,log:K.log,periodLog:K.period,moodLog:K.mood,quizResults:'ao3_mood_quiz_results_v1',cycleDayTitles:'ao3_cycle_day_titles_v1',letters:'ao3_cycle_letters_v1'};
const dk=d=>new Date(d).toLocaleDateString('sv',{timeZone:TZ}), today=()=>dk(new Date());
const arr=t=>Array.isArray(rows[K[t]]?.value)?rows[K[t]].value:[];

// Web-app replacements for the userscript's localStorage readers (same keys, via Supabase rows).
function getPeriodLog() { return arr("period"); }
function getMoodLog() { return moodArr(); }

function getMoodForDate(date) {
  return getMoodLog().find(e => e.date === date) || null;
}
function getOvuOffStore() {
  try { const o = rows[OVU_OFF_KEY]?.value || {}; return (o && typeof o === "object") ? o : {}; }
  catch { return {}; }
}
let _shiftRaw = null, _shiftParsed = { shifts: {}, dismissed: {}, notified: {} };
function getCycleShiftStore() {
  const raw = rows[SHIFT_KEY]?.value == null ? "" : JSON.stringify(rows[SHIFT_KEY].value);
  if (raw !== _shiftRaw) {
    _shiftRaw = raw;
    try {
      const o = JSON.parse(raw || "{}");
      _shiftParsed = { shifts: o.shifts || {}, dismissed: o.dismissed || {}, notified: o.notified || {} };
    } catch { _shiftParsed = { shifts: {}, dismissed: {}, notified: {} }; }
  }
  return _shiftParsed;
}

function getCycleShiftFor(periodId) { return getCycleShiftStore().shifts[periodId] || null; }

function getCycleDayTitles() {
  try {
    const o = rows[TITLES_KEY]?.value || {};
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  } catch { return {}; }
}
const LET=()=>Array.isArray(rows[LK]?.value)?rows[LK].value:[];
const COMPANION_MOOD_LOG_KEY = "ao3_companion_moods_v1";
// ─── Companion mood history: same one-entry-per-day pattern as the
// trinket log, but for the daily "feeling" pick instead. This is the
// companion's own mood (from getDailyCompanionPicks), separate from the
// person's own mood/symptom log elsewhere in the dashboard.
function getCompanionMoodLog() {
  try {
    const log = JSON.parse(localStorage.getItem(COMPANION_MOOD_LOG_KEY) || "[]");
    return Array.isArray(log) ? log : [];
  } catch { return []; }
}
function saveCompanionMoodLog(log) { localStorage.setItem(COMPANION_MOOD_LOG_KEY, JSON.stringify(log)); }
// Remembers the last symptom actually shown in "about yesterday" (with the
// date it was shown), purely so the next day's pick can avoid repeating it
// when there's more than one symptom to choose from. Without this, picking
// straight off getPragueDayIndex() % symptoms.length can land on the same
// symptom two days running just by coincidence — e.g. if a symptom's
// position in the (order-preserving) symptoms list happens to line up with
// the new day's index the same way it did the day before.
const COMFORT_HISTORY_KEY = "ao3_comfort_symptom_history_v1";
function getComfortHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(COMFORT_HISTORY_KEY) || "null");
    return (h && typeof h === "object") ? h : { date: null, symptom: null };
  } catch { return { date: null, symptom: null }; }
}
function saveComfortHistory(date, symptom) {
  localStorage.setItem(COMFORT_HISTORY_KEY, JSON.stringify({ date, symptom }));
}
