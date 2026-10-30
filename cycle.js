// Cycle logic: date helpers, Prague-time helpers, cycle/period statistics, phases, ovulation anchor, predictions, cycle panel.
const PH={menstrual:['🩸','Menstrual'],follicular:['🌱','Follicular'],ovulatory:['🌕','Ovulatory'],luteal:['🍂','Luteal'],pms:['🌸','PMS']};
// ─── Cycle calculation logic ported verbatim from the AO3 userscript (source of truth) ───
// Pure calculation only: nothing here is wired into the UI yet. Same storage keys as the
// userscript; data comes from the already-synced `rows` instead of localStorage.
const PERIOD_KEY     = K.period; // "ao3_period_log_v1"
const MOOD_KEY       = K.mood;   // "ao3_mood_log_v1"
const SHIFT_KEY      = "ao3_cycle_shift_v1";   // { shifts: {periodId: {fromDate, offset}}, dismissed: {date: true}, notified: {date: true} }
const PERIOD_CYCLE_LOOKBACK = 6; // number of most recent cycles used for averages

const MS_PER_DAY = 86400000;

function daysBetween(a, b) {
  // Whole-day difference, ignoring time-of-day drift
  const da = new Date(a); da.setHours(0,0,0,0);
  const db = new Date(b); db.setHours(0,0,0,0);
  return Math.round((db - da) / MS_PER_DAY);
}

// Formats a Date object as a local-calendar "YYYY-MM-DD" string.
// Deliberately NOT toISOString(): that converts to UTC first, which shifts
// the date backward a day for anyone in a UTC+ timezone (local midnight
// becomes the previous day once converted to UTC).
function toLocalIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parses a "YYYY-MM-DD" string into a Date at *local* midnight.
// Deliberately NOT `new Date(str)`: passed a date-only string, that parses
// as UTC midnight, so a later .setDate()/.getDate() or re-format can land
// on the wrong calendar day depending on this device's offset from UTC.
// Building it from explicit components avoids that entirely.
function parseLocalIso(str) {
  const [y, m, day] = str.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Returns the current wall-clock date/time in Prague, regardless of what
// timezone this device is actually set to (uses Intl's IANA tz database,
// so CET/CEST DST transitions are handled automatically).
function getPragueNowParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return {
    year:   parseInt(get("year"), 10),
    month:  parseInt(get("month"), 10) - 1, // 0-indexed, matches Date
    day:    parseInt(get("day"), 10),
    hour:   parseInt(get("hour"), 10) % 24, // Intl can return "24" for midnight
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

// Rolls Prague's raw wall-clock date/time parts back onto the *previous*
// calendar day whenever it's before the given cutoff (in minutes since
// midnight) — e.g. cutoff=120 means anything from 12:00am–1:59am still
// counts as "yesterday". Clock time (hour/minute/second) itself is left
// untouched; only year/month/day shift. This is the single source of
// truth for the app's "day boundary" — everything that needs to know
// what day it currently is (not just the literal wall-clock date) should
// go through this rather than reading getPragueNowParts() raw.
function getPragueRolledParts(cutoffMinutes) {
  const { year, month, day, hour, minute, second } = getPragueNowParts();
  const minutesSinceMidnight = hour * 60 + minute;
  if (minutesSinceMidnight < cutoffMinutes) {
    const rolled = new Date(year, month, day);
    rolled.setDate(rolled.getDate() - 1);
    return {
      year: rolled.getFullYear(), month: rolled.getMonth(), day: rolled.getDate(),
      hour, minute, second,
    };
  }
  return { year, month, day, hour, minute, second };
}

// The "log date" for a new reading-log entry: Prague time, with the
// 12:00am–1:59am window counted toward the previous day (late-night
// reading sessions log against the day you were mostly reading on).
// Returns a Date object built from the *local* Date constructor using
// Prague's wall-clock components — a deliberate trick so that every bit of
// this script that later reads the stored entry.date with local getters
// (getFullYear/getMonth/getDate/...) sees Prague time back out again,
// regardless of this device's real timezone.
function getPragueLogDate() {
  const { year, month, day, hour, minute, second } = getPragueRolledParts(120);
  return new Date(year, month, day, hour, minute, second);
}

// Returns a Date object whose LOCAL getters (getFullYear/getMonth/getDate/
// getHours/getDay/getMinutes/...) report Prague's current *effective* day —
// with the 12:00am–1:59am window still counted as the day before, so a
// late night doesn't flip today-highlighting, streaks, default log dates,
// etc. over to the next calendar day the moment the clock ticks past
// midnight. Use this instead of a bare `new Date()` anywhere the script
// needs "the current moment" for calendar-day logic — today-highlighting,
// streaks, month/heatmap nav, chart windows, default filter months, etc.
// Note: hour/minute/second still reflect the real wall-clock time; only
// year/month/day roll back before 2am.
function getPragueNow() {
  const { year, month, day, hour, minute, second } = getPragueRolledParts(120);
  return new Date(year, month, day, hour, minute, second);
}

// Prague's current calendar day as "YYYY-MM-DD". Use this anywhere the
// code needs today's date key (mood/period entries, the calendar's
// "today" cell, default log dates) instead of
// `new Date().toISOString().slice(0, 10)` — that converts to UTC first
// and lands on the wrong day for part of the night in a UTC+ timezone
// like Prague.
function getPragueTodayIso() {
  return toLocalIso(getPragueNow());
}

// A device-timezone-independent integer that increments exactly once per
// Prague *effective* day (2am boundary, same as getPragueNow()) — used for
// deterministic "rotate by day" picks: the daily tarot/read draws, the
// reading-mood rotation, the companion's daily photo, etc. Built from
// Date.UTC on Prague's own rolled-over y/m/d so it isn't affected by
// whatever timezone this device happens to be in.
function getPragueDayIndex() {
  const { year, month, day } = getPragueRolledParts(120);
  return Math.floor(Date.UTC(year, month, day) / MS_PER_DAY);
}

// Prague's calendar date N days ago (or ahead, for negative n), as
// "YYYY-MM-DD". Building it by shifting getPragueNow()'s own local fields
// (rather than subtracting n*86400000 from Date.now()) keeps it correct
// regardless of this device's real timezone or DST transitions.
function getPragueDaysAgoIso(n) {
  const d = getPragueNow();
  d.setDate(d.getDate() - n);
  return toLocalIso(d);
}

// Cycle length = days between consecutive period start dates.
function getCycleLengths(log) {
  const sorted = [...log].sort((a, b) => new Date(a.start) - new Date(b.start));
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    lengths.push(daysBetween(sorted[i - 1].start, sorted[i].start));
  }
  return lengths;
}

function getPeriodLengths(log) {
  return log
    .filter(e => e.end)
    .map(e => daysBetween(e.start, e.end) + 1); // inclusive of both days
}

function average(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ─── Ovulation estimate (watery discharge) ───
// The SECOND day you log "Watery discharge" inside the plausible ovulation
// window of a cycle is treated as your ovulation day. It is only used for ONE
// extra stat: a second period prediction (ovulation + ~14 days) shown next to
// the usual one, saying whether your period may come earlier or later.
// It never moves phases, cycle days, or the normal prediction.
// Everything is derived live from the mood log, so deleting the symptom
// undoes it; "Undo" in the Upcoming card switches it off for one cycle.
const OVU_SYMPTOM        = "Watery discharge";
const OVU_TO_PERIOD_DAYS = 14;  // ovulation day -> next period
const OVU_WIN_BEFORE     = 6;   // accept the symptom from this many days before predicted ovulation...
const OVU_WIN_AFTER      = 4;   // ...to this many days after it
const OVU_OFF_KEY        = "ao3_ovu_anchor_off_v1"; // { periodId: true }


let _ovuCacheKey = null, _ovuCache = new Map();

// Returns { date (ovulation day), firstDate, nextPeriod } or null.
// Ovulation day = the second distinct day with Watery discharge logged inside the window.
// With ignoreOff=true the "Undo" switch is ignored (to offer turning it back on).
function getOvulationAnchor(owner, avgCycle, avgPeriod, ignoreOff) {
  if (!owner) return null;
  if (!ignoreOff && getOvuOffStore()[owner.id]) return null;
  const moodRaw = JSON.stringify(getMoodLog());
  const key = moodRaw + "|" + (avgCycle || "") + "|" + (avgPeriod || "");
  if (key !== _ovuCacheKey) { _ovuCacheKey = key; _ovuCache = new Map(); }
  const cacheId = owner.id + (ignoreOff ? "|any" : "");
  if (_ovuCache.has(cacheId)) return _ovuCache.get(cacheId);

  const { ovulationDay } = getCycleMarkers(avgCycle, avgPeriod);
  const days = new Set();
  getMoodLog().forEach(e => {
    if (!e || !e.date || !Array.isArray(e.symptoms) || !e.symptoms.includes(OVU_SYMPTOM)) return;
    if (e.date < owner.start) return;
    const rawDay = daysBetween(owner.start, e.date) + 1;
    if (rawDay < ovulationDay - OVU_WIN_BEFORE || rawDay > ovulationDay + OVU_WIN_AFTER) return;
    days.add(String(e.date).slice(0, 10));
  });
  const sorted = [...days].sort();
  let res = null;
  if (sorted.length >= 2) {
    const ov = parseLocalIso(sorted[1]);
    const np = new Date(ov); np.setDate(np.getDate() + OVU_TO_PERIOD_DAYS);
    res = { date: sorted[1], firstDate: sorted[0], nextPeriod: toLocalIso(np) };
  }
  _ovuCache.set(cacheId, res);
  return res;
}

// Phase of a day of the CURRENT cycle (plain calendar count; ovulation estimate doesn't affect it).
function getPhaseForStatsDay(cycleDay, stats) {
  return getPhaseForCycleDay(cycleDay, stats.avgCycle, stats.avgPeriod);
}

// Days until the next period.
function getDaysToNextPeriod(stats, cycleLen) {
  return daysUntilCycleDay(cycleLen + 1, stats.currentCycleDay, cycleLen);
}

// Returns { avgCycle, avgPeriod, nextPredicted, currentCycleDay, isOnPeriod, lastEntry,
//   cycleDeviation, cycleDeviationCount, cycleLengths, periodLengths }
// cycleDeviation is the mean absolute deviation (in days) of the *same* recent
// cycle-length window used to compute avgCycle/nextPredicted — i.e. how much
// those particular cycles have actually wobbled, which is what should drive
// how much to trust the prediction above, rather than an all-time figure that
// could include a much steadier (or shakier) era of the person's history.
function getPeriodStats() {
  const log = getPeriodLog();
  if (!log.length) {
    return { avgCycle: null, avgPeriod: null, nextPredicted: null, currentCycleDay: null, isOnPeriod: false, lastEntry: null, cycleDeviation: null, cycleDeviationCount: 0, cycleLengths: [], periodLengths: [] };
  }
  const sorted = [...log].sort((a, b) => new Date(a.start) - new Date(b.start));
  const lastEntry = sorted[sorted.length - 1];

  const cycleLengths  = getCycleLengths(sorted).slice(-PERIOD_CYCLE_LOOKBACK);
  const periodLengths = getPeriodLengths(sorted).slice(-PERIOD_CYCLE_LOOKBACK);
  const avgCycle  = average(cycleLengths);
  const avgPeriod = average(periodLengths);
  // Needs at least 2 cycle-length samples to say anything about *variation*
  // (a single gap has nothing to vary against).
  const cycleDeviation = (cycleLengths.length >= 2 && avgCycle)
    ? average(cycleLengths.map(l => Math.abs(l - avgCycle)))
    : null;

  const cycleShift = getCycleShiftFor(lastEntry.id);
  const shiftOffset = cycleShift ? cycleShift.offset : 0;

  let nextPredicted = null;
  if (avgCycle) {
    const predicted = parseLocalIso(lastEntry.start);
    // Running a day "ahead" (offset +1) means the next period should land a day sooner.
    predicted.setDate(predicted.getDate() + Math.round(avgCycle) - shiftOffset);
    nextPredicted = toLocalIso(predicted);
  }

  const today = getPragueTodayIso();
  const isOnPeriod = !lastEntry.end
    ? new Date(lastEntry.start) <= new Date(today)
    : new Date(lastEntry.start) <= new Date(today) && new Date(today) <= new Date(lastEntry.end);

  const rawCycleDay = daysBetween(lastEntry.start, today) + 1;
  const currentCycleDay = rawCycleDay + (cycleShift && today >= cycleShift.fromDate ? shiftOffset : 0);
  // Watery-discharge ovulation estimate: only feeds the extra "based on your ovulation" stat.
  const ovuAnchor = getOvulationAnchor(lastEntry, avgCycle, avgPeriod);
  const nextPredictedOvu = ovuAnchor ? ovuAnchor.nextPeriod : null;

  return { avgCycle, avgPeriod, nextPredicted, nextPredictedOvu, ovuAnchor, currentCycleDay, rawCycleDay, cycleShift, isOnPeriod, lastEntry, cycleDeviation, cycleDeviationCount: cycleLengths.length, cycleLengths, periodLengths };
}

// True if a reading-log timestamp falls within any logged period (ongoing
// entries count through right now). Uses real Date comparisons rather than
// string comparison, since entry.date carries a full timestamp.
function isDateWithinLoggedPeriod(dateIso, periodLog) {
  const d = new Date(dateIso);
  const now = getPragueNow();
  return periodLog.some(e => {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end + "T23:59:59") : now;
    return d >= start && d <= end;
  });
}

// ── Cycle-phase classification (for correlating with reading habits) ──
// Uses typical phase proportions scaled to the person's own average cycle/period
// length where available, falling back to textbook defaults (28-day cycle, 5-day period).
const PHASE_DEFS = [
  { key: "menstrual", label: "Menstrual" },
  { key: "follicular", label: "Follicular" },
  { key: "ovulatory", label: "Ovulatory" },
  { key: "luteal", label: "Luteal" },
  { key: "pms", label: "PMS" },
];
const PMS_WINDOW_DAYS = 7; // last N days of the cycle, right before the next period starts

function getCycleMarkers(avgCycle, avgPeriod) {
  const cycleLen  = Math.round(avgCycle || 28);
  const periodLen = Math.round(avgPeriod || 5);
  const ovulationDay = Math.max(periodLen + 1, Math.round(cycleLen / 2));
  // PMS window is the last PMS_WINDOW_DAYS days of the cycle, but never allowed
  // to eat into the ovulatory window on short cycles.
  const pmsStart = Math.max(ovulationDay + 2, cycleLen - (PMS_WINDOW_DAYS - 1));
  return { cycleLen, periodLen, ovulationDay, pmsStart };
}

function getPhaseForCycleDay(cycleDay, avgCycle, avgPeriod) {
  const { periodLen, ovulationDay, pmsStart } = getCycleMarkers(avgCycle, avgPeriod);

  if (cycleDay <= periodLen) return "menstrual";
  if (cycleDay >= pmsStart) return "pms";
  if (cycleDay < ovulationDay - 1) return "follicular";
  if (cycleDay <= ovulationDay + 1) return "ovulatory";
  return "luteal";
}

// Finds which period entry a given date falls under (most recent start on/before it)
// and returns that date's cycle day + phase. Returns null if it predates all logged periods.
function classifyDateByCycle(dateIso, periodLog, avgCycle, avgPeriod) {
  const sorted = [...periodLog].sort((a, b) => new Date(a.start) - new Date(b.start));
  let owner = null;
  for (const entry of sorted) {
    if (new Date(entry.start) <= new Date(dateIso)) owner = entry;
    else break;
  }
  if (!owner) return null;
  let cycleDay = daysBetween(owner.start, dateIso) + 1;
  // A confirmed "this cycle slipped by a day" shift applies from its start date onward.
  const shift = getCycleShiftFor(owner.id);
  if (shift && String(dateIso).slice(0, 10) >= shift.fromDate) cycleDay += shift.offset;
  if (cycleDay < 1 || (avgCycle && cycleDay > avgCycle + 10)) return null; // too far past — unreliable
  return { cycleDay, phase: getPhaseForCycleDay(cycleDay, avgCycle, avgPeriod), ownerId: owner.id };
}

// ─── Cycle shift store mutators (ported from the userscript) ───
// Reads (getCycleShiftStore / getCycleShiftFor) live in storage.js. Only the write
// differs from the userscript: it goes through persist() to the SHIFT_KEY row
// instead of localStorage.setItem, so these are async (await them).
async function mutateCycleShiftStore(fn) {
  const store = JSON.parse(JSON.stringify(getCycleShiftStore()));
  fn(store);
  await persist(SHIFT_KEY, store);
}
async function applyCycleShift(periodId, fromDate, offset) {
  await mutateCycleShiftStore(st => { st.shifts[periodId] = { fromDate, offset }; });
}
async function clearCycleShift(periodId) {
  await mutateCycleShiftStore(st => { delete st.shifts[periodId]; });
}
async function dismissCycleShiftSuggestion(dateIso) {
  await mutateCycleShiftStore(st => { st.dismissed[dateIso] = true; });
}

// Days from today until the next occurrence of a given cycle day, wrapping
// forward to the following cycle if that day has already passed this one.
function daysUntilCycleDay(targetDay, currentCycleDay, cycleLen) {
  let delta = Math.round(targetDay) - Math.round(currentCycleDay);
  while (delta < 0) delta += Math.round(cycleLen);
  return delta;
}

// Finds the day, within the person's own cycle, where the phase changes next —
// used to preview an upcoming transition (e.g. "In 3 days you'll likely enter PMS").
function getNextPhaseTransition(currentCycleDay, avgCycle, avgPeriod) {
  const cycleLen = Math.round(avgCycle || 28);
  const currentPhase = getPhaseForCycleDay(currentCycleDay, avgCycle, avgPeriod);
  for (let step = 1; step <= cycleLen; step++) {
    // Wrap into the next cycle once we pass cycleLen, so day 25 + 10 on a
    // 31-day cycle is treated as day 4 of the *next* cycle (menstrual),
    // not day 35 of a cycle that only has 31 days.
    const rawDay = currentCycleDay + step;
    const day = ((rawDay - 1) % cycleLen) + 1;
    const phase = getPhaseForCycleDay(day, avgCycle, avgPeriod);
    if (phase !== currentPhase) return { phase, daysUntil: step };
  }
  return null;
}

// ── Calendar-day classification (logged / predicted / phase tint / cycle day) ──
function findOwningPeriodEntry(dateIso, periodLog) {
  const today = getPragueTodayIso();
  return periodLog.find(e => {
    const end = e.end || (e.start <= today ? today : e.start); // ongoing entries count through today
    return dateIso >= e.start && dateIso <= end;
  }) || null;
}

function cyc(d){const P=arr('period').filter(p=>p.start).sort((a,b)=>a.start.localeCompare(b.start));if(!P.length)return null;
 const dd=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5),avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const gp=P.slice(1).map((p,i)=>dd(P[i].start,p.start)).slice(-6),ga=avg(gp),dev=gp.length>=2?avg(gp.map(x=>Math.abs(x-ga))):null,cl=Math.round(ga||28),pl=Math.round(avg(P.filter(p=>p.end).map(p=>dd(p.start,p.end)+1).slice(-6))||5);
 let o=null;P.forEach(p=>{if(p.start<=d)o=p});if(!o)return null;
 const day=dd(o.start,d)+1;if(day>cl+10)return null;
 const ov=Math.max(pl+1,Math.round(cl/2)),ps=Math.max(ov+2,cl-6),ph=day<=pl?'menstrual':day>=ps?'pms':day<ov-1?'follicular':day<=ov+1?'ovulatory':'luteal';
 const nx=new Date(o.start+'T12:00');nx.setDate(nx.getDate()+cl);
 return{day,ph,o,cl,pl,ov,ps,dev,n:gp.length,next:nx.toLocaleDateString('sv'),on:!o.end||d<=o.end}}
const OPEN={},PC={menstrual:'#ff7a9c',follicular:'#a3be8c',ovulatory:'#f6c177',luteal:'#c4a7e7',pms:'#ff9ecf'},LK='ao3_cycle_letters_v1';
const TXT={menstrual:["It's okay if today is just survivable. Survivable is still a form of winning.","Rest isn't something you have to earn back later. It's allowed right now.","Heat applied early beats waiting for the cramps to peak.","Iron dips this week: lentils, greens or red meat help."],
follicular:["You've got a little spark back. Spend it on something that interests you.","Today's a fine day to start something instead of adding it to the list.","Energy tends to climb from here, so front-load the annoying tasks.","Small sparks of 'I want to' are worth following."],
ovulatory:["Some days you're just easier to be around, even to yourself. Today's one of them.","Social energy often peaks here. A decent window for plans you've been putting off.","Warm up a little longer before anything intense; ligaments loosen around ovulation.","You can be a lot today, in the good way."],
luteal:["You're allowed to feel a lot today and not have a tidy reason for it.","Cravings ramp up here. A real snack on hand beats fighting it all day.","Sleep gets lighter in this phase. Winding down earlier may help.","Close open loops rather than starting something new."],
pms:["It's fine to have zero patience today. That's not a character flaw.","Magnesium-rich food (nuts, dark chocolate, leafy greens) is worth leaning into.","Comfort over adventure today. No one's grading the choice.","Restock now. Future you in three days won't want to run to the store."]};
const phd=(day,c)=>{day=((day-1)%c.cl)+1;return day<=c.pl?'menstrual':day>=c.ps?'pms':day<c.ov-1?'follicular':day<=c.ov+1?'ovulatory':'luteal'};
function hist(day,c,ex){day=((day-1)%c.cl)+1;const A=moodArr(),w=e=>e.sick?.25:1,ph=phd(day,c),f=fn=>A.filter(e=>{const k=cyc(e.date);return k&&fn(k)});
 let L=f(k=>k.day===day),fb=0;if(!L.length){L=f(k=>k.ph===ph);fb=1}
 const av=(K,S)=>{const v=S.filter(e=>typeof e[K]==='number'),W=v.reduce((s,e)=>s+w(e),0);return W?v.reduce((s,e)=>s+e[K]*w(e),0)/W:null};
 const tl=[['mood','😊'],['energy','⚡'],['sleep','😴']].map(([K,i])=>{const a=av(K,L);if(a==null)return'';const b=av(K,A),d=b==null?0:a-b;return `<span class=tl>${i} <b>${a.toFixed(1)}</b> <small>${Math.abs(d)<.15?'usual':(d>0?'▲':'▼')+Math.abs(d).toFixed(1)}</small></span>`}).join('');
 const cn={};L.forEach(e=>(e.symptoms||[]).forEach(s=>cn[s]=(cn[s]||0)+1));
 const sy=Object.entries(cn).sort((a,b)=>b[1]-a[1]).slice(0,10);
 return L.length?`${scoreHtml(scoreFor(day,c,ex))}<div class=m>${fb?`no logs for day ${day} yet, showing the ${PH[ph][1]} phase average`:`day ${day} · from ${L.length} logged day${L.length>1?'s':''}`} (sick days count for less)</div><div class=tls>${tl}</div><div class=chips style="margin-top:6px">${sy.map(([s,n])=>`<span class=b>${SI[s]||'•'} ${s} ×${n}</span>`).join('')}</div>`:`<p class=empty>No history for day ${day} yet.</p>`}
function cycPanel(c){if(!c)return'<p class=empty>Log a period start first.</p>';
 const w=x=>x<0?x+c.cl:x,T=[['🩸','Period',c.cl+1-c.day],['🌸','PMS',w(c.ps-c.day)],['🌕','Ovulation',w(c.ov-c.day)]].sort((a,b)=>a[2]-b[2]),
 sp=Math.max(1,Math.round(c.dev||0)),sh=n=>{const x=new Date(c.next+'T12:00');x.setDate(x.getDate()+n);return fd(x.toLocaleDateString('sv'))},
 cf=c.n<2?'Low':c.n>=4&&c.dev<=1.5?'High':c.dev!=null&&c.dev<=3.5?'Moderate':'Low',
 wd=d=>{const x=new Date(LD+'T12:00');x.setDate(x.getDate()+d);return x.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2)};
 const runs=[];for(let i=1;i<=c.cl;i++){const p=phd(i,c),l=runs[runs.length-1];l&&l[0]===p?l[1]++:runs.push([p,1])}
 return `<div class=cg>${T.map(([i,l,n])=>`<div><b>${n<=0?'now':n+'d'}</b><small>${i} ${l}</small></div>`).join('')}</div>`
 +row('Expected '+fd(c.next),`likely ${sh(-sp)} – ${sh(sp)} · confidence ${cf}`)
 +row(`Avg cycle ${c.cl} days · period ${c.pl} days`,c.dev!=null?`recent cycles vary by ±${c.dev.toFixed(1)} days`:'log more periods for a variation estimate')
 +`<div class=pb>${runs.map(([p,n])=>`<i style="flex:${n};background:${PC[p]}"></i>`).join('')}<u style="left:${Math.min(100,(c.day-.5)/c.cl*100)}%"></u></div>`
 +`<div class=wk>${[0,1,2,3,4,5,6].map(d=>`<button data-a=lg-w data-d=${d} class="${WK===d?'pri':''}">${d?wd(d):'now'}<span style="font-size:14px">${PH[phd(c.day+d,c)][0]}</span></button>`).join('')}</div>`
 +(WK!=null?hist(c.day+WK,c,LD):'<div class=sv>Tap a day to see what you usually feel on it.</div>')}
function note(c){if(!c)return'';const a=TXT[c.ph],i=(Math.floor(Date.parse(LD)/864e5)+QO)%a.length;
 return `<div class=cy style="margin-top:14px"><div style="font-style:italic;font-family:Georgia,serif;flex:1">“${a[i]}”</div><button data-a=lg-q>🔮 another</button></div>`}
const addD=(d,n)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+n);return x.toLocaleDateString('sv')};
const ddf=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
const rgba=(h,a)=>{h=h.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`};
