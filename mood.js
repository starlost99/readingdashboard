// Mood & symptom logging, cycle-day titles, day score, letters to future you, and the companion/comfort/affirmation features.
const SG=[["Pain & physical","Cramps,Pre-period cramps,Ovulation pain,Spasms,Headache,Tender breasts,Bloating,Muscle aches,PMS flu,Spotting"],["Skin & body","Acne,Oily hair,Watery discharge,Sweating,Hot flashes,Dry eyes,Eye strain"],["Energy & appetite","Fatigue,Hungry,Small appetite,Cravings,Craving chocolate,Vivid dreams,Nesting"],["Mood & mind","Emotional,Irritable,Anxiety,Overthinking,Self critical,Hopelessness,PMDD,Calm,Confident,Feeling okay,Hating men,Taking it personally,Over it,Sad"],["Social & libido","Sociable,Solitary,Flirty,High libido,Low libido"]].map(([n,s])=>[n,s.split(',')]);
const SI={"Cramps":"😣","Pre-period cramps":"😖","Ovulation pain":"🥚","Spasms":"💢","Headache":"🤕","Tender breasts":"🩹","Bloating":"🎈","Muscle aches":"💪","PMS flu":"🤧","Spotting":"🩸","Acne":"🔴","Oily hair":"🧴","Watery discharge":"💧","Sweating":"💦","Hot flashes":"🥵","Dry eyes":"🏜️","Eye strain":"👀","Fatigue":"🥱","Hungry":"🍔","Small appetite":"🍽️","Cravings":"🍕","Craving chocolate":"🍫","Vivid dreams":"🔮","Nesting":"🧺","Emotional":"☁️","Irritable":"😤","Anxiety":"🌀","Overthinking":"🧠","Self critical":"🪞","Hopelessness":"🥀","PMDD":"🌪️","Calm":"🎐","Confident":"💅","Feeling okay":"🎀","Hating men":"🤹‍♂️","Taking it personally":"🎯","Over it":"🙄","Sad":"😢","Sociable":"🍹","Solitary":"🚪","Flirty":"😏","High libido":"🔥","Low libido":"🧊"};
const SHR=["1-2","3-4","4-5","5-6","6-7","7-8","8-9","9-10","10-11","11-12","12-13","13+"];
let LD=null,pend=[],busy=false;
function apply(a,d,ch){const i=a.findIndex(e=>e.date===d),o={...(i<0?{date:d}:a[i]),...ch};Object.keys(o).forEach(k=>o[k]===undefined&&delete o[k]);i<0?a.push(o):a[i]=o}
const moodArr=()=>{const a=arr('mood').map(e=>({...e}));pend.forEach(([d,ch])=>apply(a,d,ch));return a};
const ent=d=>moodArr().find(e=>e.date===d)||{};
function drawLog(){const el=$('#logv');if(el)el.innerHTML=logView();drawCal();drawBrief()}
function setMood(d,ch){pend.push([d,ch]);drawLog();flush()}
async function flush(){if(busy)return;busy=true;let tries=0;
 while(pend.length){const n=pend.length,v=moodArr();
  try{await persist(K.mood,v);pend.splice(0,n);tries=0}
  catch(e){if(/changed somewhere/.test(e.message)&&++tries<4)continue;msg=e.message;pend=[];break}}
 busy=false;msg?draw():drawLog()}
// ─── Cycle-day titles (logic only, ported from the userscript; no UI) ───
const TITLES_KEY     = "ao3_cycle_day_titles_v1"; // { "15": "custom title" } — your own titles win over auto ones
const TITLE_MIN_COUNT = 2;     // a symptom must have shown up this many times...
const TITLE_MIN_SHARE = 0.5;   // ...and on at least this share of the logged days
const TITLE_MAX_SYMPTOMS = 3;
const TITLE_MOOD_DIFF = 0.5;   // distance from your usual (1-5 scale) worth mentioning
const TITLE_PHRASES = {
  "Cramps": "cramps", "Pre-period cramps": "early cramps", "Ovulation pain": "ovulation twinge", "Spasms": "spasms",
  "Headache": "headache", "Tender breasts": "tender breasts", "Bloating": "bloated", "Muscle aches": "achy",
  "PMS flu": "pms flu", "Spotting": "spotting", "Acne": "breakouts", "Oily hair": "oily hair",
  "Watery discharge": "watery discharge", "Sweating": "sweaty", "Hot flashes": "hot flashes", "Dry eyes": "dry eyes",
  "Eye strain": "eye strain", "Fatigue": "tired", "Hungry": "hungry", "Small appetite": "small appetite",
  "Cravings": "cravings", "Craving chocolate": "chocolate craving", "Vivid dreams": "vivid dreams", "Nesting": "nesting",
  "Emotional": "emotional", "Irritable": "irritable", "Anxiety": "anxious", "Overthinking": "overthinking",
  "Self critical": "self-critical", "Hopelessness": "hopeless", "PMDD": "pmdd flare", "Calm": "calm",
  "Confident": "confident", "Feeling okay": "feeling okay", "Hating men": "hating men",
  "Taking it personally": "taking things personally", "Over it": "over it", "Sad": "sad",
  "Sociable": "sociable", "Solitary": "wants solitude", "Flirty": "flirty", "High libido": "high libido", "Low libido": "low libido",
};
// Web-app reader: same key, via the synced rows instead of localStorage.
function symptomIcon(symptom) { return SI[symptom] || "•"; } // userscript uses SYMPTOM_ICONS (same map as the web app's SI)


// Saves (or, with empty text, clears) your own title for a cycle day. Reads live in
// storage.js (getCycleDayTitles). Only the write differs from the userscript: it goes
// through persist() to the TITLES_KEY row instead of localStorage.setItem, so it is
// async (await it).
async function setCycleDayTitle(day, text) {
  const all = { ...getCycleDayTitles() };
  const t = String(text || "").trim();
  if (t) all[day] = t; else delete all[day];
  await persist(TITLES_KEY, all);
}

function getCycleDayTags(day, stats) {
  const { cycleLen, ovulationDay, pmsStart } = getCycleMarkers(stats.avgCycle, stats.avgPeriod);
  const tags = [];
  if (day === 1) tags.push("period starts");
  if (day === ovulationDay - 1) tags.push("first day of possible ovulation");
  if (day === ovulationDay + 1) tags.push("last day of possible ovulation");
  if (day === pmsStart) tags.push("pms week starts");
  if (day === cycleLen) tags.push("period due around now");
  return tags;
}

const TITLE_NOTE_ICONS = {
  "good-mood day": "😊", "low-mood day": "🌧️", "high energy": "⚡", "low energy": "🪫",
  "rough sleep": "😵‍💫", "good sleep": "😴",
};

// Structured pieces of the automatic title: heads-up tags plus items
// ({label, icon}) for symptoms and mood/energy/sleep notes.
function buildAutoCycleDayTitleParts(day, bucket, baseline, stats) {
  const tags = getCycleDayTags(day, stats);
  const items = [];
  if (bucket && bucket.entryCount >= 2) {
    Object.entries(bucket.symptoms || {})
      .filter(([, n]) => n >= TITLE_MIN_COUNT && n / bucket.entryCount >= TITLE_MIN_SHARE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TITLE_MAX_SYMPTOMS)
      .forEach(([name]) => items.push({ label: TITLE_PHRASES[name] || name.toLowerCase(), icon: symptomIcon(name) }));
    const avg = (sum, n) => (n >= 2 ? sum / n : null);
    const mood = avg(bucket.moodSum, bucket.moodCount), energy = avg(bucket.energySum, bucket.energyCount), sleep = avg(bucket.sleepSum, bucket.sleepCount);
    const note = label => items.push({ label, icon: TITLE_NOTE_ICONS[label] || "" });
    if (mood != null && baseline.mood != null) {
      if (mood - baseline.mood >= TITLE_MOOD_DIFF) note("good-mood day");
      else if (baseline.mood - mood >= TITLE_MOOD_DIFF) note("low-mood day");
    }
    if (energy != null && baseline.energy != null) {
      if (energy - baseline.energy >= TITLE_MOOD_DIFF) note("high energy");
      else if (baseline.energy - energy >= TITLE_MOOD_DIFF) note("low energy");
    }
    if (sleep != null && baseline.sleep != null) {
      if (baseline.sleep - sleep >= TITLE_MOOD_DIFF) note("rough sleep");
      else if (sleep - baseline.sleep >= TITLE_MOOD_DIFF) note("good sleep");
    }
  }
  const shown = items.slice(0, 4);
  let empty = null;
  if (!tags.length && !shown.length) empty = (bucket && bucket.entryCount) ? "no clear pattern yet" : "nothing logged on this day yet";
  return { tags, items: shown, empty };
}

function buildAutoCycleDayTitle(day, bucket, baseline, stats) {
  const { tags, items, empty } = buildAutoCycleDayTitleParts(day, bucket, baseline, stats);
  if (empty) return empty;
  return [...tags, items.map(i => i.label).join(", ")].filter(Boolean).join(" · ");
}

// ─── Mood / symptom stats by cycle day (ported from the userscript; no UI) ───
// A day can also carry sick: true ("I was ill that day"). Everything logged on a
// sick day is tinted by the illness, so those entries still count but only
// weigh SICK_DAY_WEIGHT as much as a normal day in the averages, baselines
// and day-score predictions (1 = full weight, 0 = ignored entirely).
const SICK_DAY_WEIGHT = 0.25;
function moodEntryWeight(entry) { return entry && entry.sick === true ? SICK_DAY_WEIGHT : 1; }

// Buckets mood/symptom log entries by exact cycle day (1, 2, 3, ...) rather
// than by phase. Lets the overview card show what a *specific* day of the
// cycle usually looks like, falling back to the coarser phase-level bucket
// (getMoodStatsByPhase) only when a given day has no history of its own.
// Tallies one more occurrence of `value` in a {value: count} histogram —
// shared by the phase and cycle-day mood buckets below, used to find the
// most-common logged value (the mode) instead of just averaging.
function bumpHistogram(hist, value, weight = 1) {
  hist[value] = (hist[value] || 0) + weight;
}

function getMoodStatsByCycleDay() {
  const periodLog = getPeriodLog();
  const buckets = {};
  if (!periodLog.length) return buckets;

  const { avgCycle, avgPeriod } = getPeriodStats();
  getMoodLog().forEach(entry => {
    const classified = classifyDateByCycle(entry.date, periodLog, avgCycle, avgPeriod);
    if (!classified) return;
    const day = classified.cycleDay;
    if (!buckets[day]) buckets[day] = {
      moodSum: 0, moodCount: 0, energySum: 0, energyCount: 0, sleepSum: 0, sleepCount: 0, sleepHoursSum: 0, sleepHoursCount: 0,
      moodValues: {}, energyValues: {}, sleepValues: {}, sleepHoursValues: {},
      symptoms: {}, symptomsW: {}, entryCount: 0, entryWeight: 0, orgasmLoggedCount: 0, orgasmTrueCount: 0,
    };
    const b = buckets[day];
    const w = moodEntryWeight(entry);
    b.entryCount += 1;
    b.entryWeight += w;
    if (typeof entry.mood === "number")   { b.moodSum += entry.mood * w; b.moodCount += w; bumpHistogram(b.moodValues, entry.mood, w); }
    if (typeof entry.energy === "number") { b.energySum += entry.energy * w; b.energyCount += w; bumpHistogram(b.energyValues, entry.energy, w); }
    if (typeof entry.sleep === "number")  { b.sleepSum += entry.sleep * w; b.sleepCount += w; bumpHistogram(b.sleepValues, entry.sleep, w); }
    if (typeof entry.sleepHours === "number") { b.sleepHoursSum += entry.sleepHours * w; b.sleepHoursCount += w; bumpHistogram(b.sleepHoursValues, entry.sleepHours, w); }
    if (typeof entry.orgasm === "boolean") { b.orgasmLoggedCount += 1; if (entry.orgasm) b.orgasmTrueCount += 1; }
    (entry.symptoms || []).forEach(s => { b.symptoms[s] = (b.symptoms[s] || 0) + 1; b.symptomsW[s] = (b.symptomsW[s] || 0) + w; });
  });
  return buckets;
}

// ─── Baseline: overall average mood/energy/sleep across ALL logged days ───
// Not phase-bucketed — this is "your usual" self, used to show phase/day
// stats as a delta ("↑ 0.5 above your usual") instead of just a raw number.
function getOverallMoodBaseline() {
  const log = getMoodLog();
  let moodSum = 0, moodCount = 0, energySum = 0, energyCount = 0,
      sleepSum = 0, sleepCount = 0, sleepHoursSum = 0, sleepHoursCount = 0;
  log.forEach(e => {
    const w = moodEntryWeight(e);
    if (typeof e.mood === "number")       { moodSum += e.mood * w; moodCount += w; }
    if (typeof e.energy === "number")     { energySum += e.energy * w; energyCount += w; }
    if (typeof e.sleep === "number")      { sleepSum += e.sleep * w; sleepCount += w; }
    if (typeof e.sleepHours === "number") { sleepHoursSum += e.sleepHours * w; sleepHoursCount += w; }
  });
  return {
    mood: moodCount ? moodSum / moodCount : null,
    energy: energyCount ? energySum / energyCount : null,
    sleep: sleepCount ? sleepSum / sleepCount : null,
    sleepHours: sleepHoursCount ? sleepHoursSum / sleepHoursCount : null,
  };
}

// { text, custom, tags, items, empty } — pass precomputed buckets/baseline when titling many days.
function getCycleDayTitle(day, stats, buckets, baseline) {
  const custom = getCycleDayTitles()[day];
  // Your own title never hides the heads-up tags (period starts, ovulation, pms week starts…)
  if (custom) return { text: custom, custom: true, tags: getCycleDayTags(day, stats || getPeriodStats()), items: [], empty: null };
  const b = (buckets || getMoodStatsByCycleDay())[day] || null;
  const parts = buildAutoCycleDayTitleParts(day, b, baseline || getOverallMoodBaseline(), stats || getPeriodStats());
  const text = parts.empty || [...parts.tags, parts.items.map(i => i.label).join(", ")].filter(Boolean).join(" · ");
  return { text, custom: false, ...parts };
}

// The title as a row of soft chips, styled like the score pill / meters
// in the card it sits in: heads-up tags as brighter "✦ … ✦" pills,
// symptoms and mood/sleep notes as quieter icon chips, your own title as
// one slightly larger chip.
function buildCycleDayTitleChips(t, accent, opts = {}) {
  const left = !!opts.left, sm = !!opts.compact;
  const row = document.createElement("div");
  row.style.cssText = `display:flex; flex-wrap:wrap; justify-content:${left ? "flex-start" : "center"}; align-items:center; gap:${sm ? 5 : 6}px; margin:${left ? "0" : "2px 2px 6px"};`;
  const chip = (text, icon, css) => {
    const el = document.createElement("span");
    el.style.cssText = `display:inline-flex; align-items:center; gap:5px; border-radius:999px; line-height:1.2; ${css}`;
    if (icon) {
      const i = document.createElement("span");
      i.textContent = icon;
      i.style.cssText = "font-size:12px;";
      el.appendChild(i);
    }
    const tx = document.createElement("span");
    tx.textContent = text;
    el.appendChild(tx);
    return el;
  };
  const tagCss = `padding:${sm ? "3px 9px" : "4px 11px"}; font-size:${sm ? 9.5 : 10}px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;
    color:${accent}; background:${hexToRgba(accent, 0.18)}; border:1px solid ${hexToRgba(accent, 0.5)};`;
  const itemCss = `padding:${sm ? "2px 9px" : "3px 10px"}; font-size:${sm ? 11 : 11.5}px; font-weight:500; color:rgba(255,234,244,0.92);
    background:${hexToRgba(accent, 0.1)}; border:1px solid ${hexToRgba(accent, 0.28)};`;
  if (t.custom) {
    t.tags.forEach(tag => row.appendChild(chip(tag, "✦", tagCss)));
    row.appendChild(chip(t.text, "✎", `padding:${sm ? "3px 11px" : "5px 13px"}; font-size:${sm ? 12 : 12.5}px; font-weight:500; color:rgba(255,234,244,0.95);
      background:${hexToRgba(accent, 0.14)}; border:1px solid ${hexToRgba(accent, 0.38)};`));
  } else if (t.empty) {
    row.appendChild(chip(t.empty, "", `padding:${sm ? "2px 10px" : "3px 11px"}; font-size:${sm ? 10.5 : 11}px; font-style:italic; color:rgba(255,234,244,0.55);
      border:1px dashed ${hexToRgba(accent, 0.3)};`));
  } else {
    t.tags.forEach(tag => row.appendChild(chip(tag, "✦", tagCss)));
    t.items.forEach(it => row.appendChild(chip(it.label, it.icon, itemCss)));
  }
  return row;
}

// ─── Mood-metrics + symptoms history for a cycle day ───
// Mood/energy/sleep-quality/sleep-hours *and* symptoms for this exact
// cycle day across past cycles, for the combined "On day X you usually
// feel:" history popup.
function getCycleDayHistory(targetCycleDay, maxCycles = PERIOD_CYCLE_LOOKBACK) {
  const periodLog = getPeriodLog(); // sorted oldest → newest
  if (periodLog.length < 2) return [];
  const starts = periodLog.map(e => e.start);

  const moodByDay = {};
  getMoodLog().forEach(e => { moodByDay[e.date] = e; });

  const todayIso = getPragueTodayIso();
  const entries = [];
  for (let i = starts.length - 2; i >= 0 && entries.length < maxCycles; i--) {
    const cycleStart = starts[i];
    const nextStart = starts[i + 1];
    const cycleLen = daysBetween(cycleStart, nextStart);
    if (targetCycleDay > cycleLen) continue;
    const dateObj = parseLocalIso(cycleStart);
    dateObj.setDate(dateObj.getDate() + (targetCycleDay - 1));
    const dateIso = toLocalIso(dateObj);
    if (dateIso >= todayIso) continue;
    const mood = moodByDay[dateIso];
    if (!mood) continue;
    const symptoms = mood.symptoms || [];
    const hasAny = typeof mood.mood === "number" || typeof mood.energy === "number" ||
                   typeof mood.sleep === "number" || typeof mood.sleepHours === "number" ||
                   typeof mood.orgasm === "boolean" || typeof mood.orgasmCount === "number" || symptoms.length > 0;
    if (!hasAny) continue; // logged that day, but nothing relevant to this popup
    entries.push({
      date: dateIso,
      cyclesAgo: starts.length - 1 - i,
      mood: typeof mood.mood === "number" ? mood.mood : null,
      energy: typeof mood.energy === "number" ? mood.energy : null,
      sleep: typeof mood.sleep === "number" ? mood.sleep : null,
      sleepHours: typeof mood.sleepHours === "number" ? mood.sleepHours : null,
      orgasm: typeof mood.orgasm === "boolean" ? mood.orgasm : null,
      orgasmCount: typeof mood.orgasmCount === "number" ? mood.orgasmCount : null,
      symptoms,
    });
  }
  return entries;
}

function logView(){const t=today();if(!LD||LD>t)LD=t;const e=ent(LD),c=cyc(LD),sy=new Set(e.symptoms||[]),o=e.orgasm,
 B=(a,x,on,tx)=>`<button data-a=${a} ${x} class="${on?'pri':''}">${tx}</button>`,
 sc=(k,l,lo,hi)=>`<div class=lbl>${l}</div><div class=sc>${[1,2,3,4,5].map(v=>B('lg-s',`data-k=${k} data-v=${v}`,e[k]===v,v)).join('')}</div><div class=sv style="display:flex;justify-content:space-between"><span>${lo}</span><span>${hi}</span></div>`,
 per=c&&c.on&&!c.o.end?'end':'start';
 return `<div class=lgh><input type=date id=lgd value="${LD}" max="${t}">${LD!==t?B('lg-t','',0,'Today'):''}<span class=sv>${busy||pend.length?'saving…':'saved ✓'}</span></div>`
 +`<div class=cy><div>${c?`<b>${PH[c.ph][0]} Day ${c.day} · ${PH[c.ph][1]}</b><div class=m>${LD===t?'next period ~'+c.next:'cycle position that day'}</div>`:'<b>No cycle day yet</b><div class=m>Log a period start to begin</div>'}</div>${B('lg-p','data-v='+per,0,per==='end'?'Period ended':'Period started')}</div>`
 +dayScoreRow(c)+companion(c)
 +B('lg-k','',e.sick,e.sick?'🤒 Sick day (tap to undo)':'🤒 I was sick this day')
 +sc('mood','Mood','low','great')+sc('energy','Energy','drained','buzzing')+sc('sleep','Sleep quality','rough','restful')
 +`<div class=lbl>Hours slept</div><select id=lgh><option value="">—</option>${SHR.map((r,i)=>`<option value=${i+1}${e.sleepHours===i+1?' selected':''}>${r} hrs</option>`).join('')}</select>`
 +`<div class=lbl>Orgasm</div><div class=two>${B('lg-o','data-v=y',o===true,'Yes')}${B('lg-o','data-v=n',o===false,'No')}${o===true?B('lg-c','data-d=-1',0,'−')+`<b>${e.orgasmCount||1}</b>`+B('lg-c','data-d=1',0,'+'):''}</div>`
 +SG.map(([n,l])=>`<div class=lbl>${n}</div><div class=chips>${l.map(s=>B('lg-y',`data-s="${s}"`,sy.has(s),(SI[s]||'•')+' '+s).replace('class="','class="ch ')).join('')}</div>`).join('')
 +note(c)+dt('cy','🌙 Cycle overview',cycPanel(c))+dt('hd','📅 On this cycle day',c?hist(c.day,c,LD):'<p class=empty>Log a period first.</p>')}
async function lgPer(kind){const a=arr('period').map(x=>({...x}));
 if(kind==='start'){if(a.some(p=>p.start===LD))return;a.push({id:'p_'+Date.now(),start:LD})}
 else{const o=a.filter(p=>!p.end).sort((x,y)=>y.start.localeCompare(x.start))[0];if(!o||o.start>LD)return;o.end=LD}
 a.sort((x,y)=>x.start.localeCompare(y.start));
 try{await persist(K.period,a);msg='Saved.'}catch(e){msg=e.message}draw()}
function logAct(b){const a=b.dataset.a,d=b.dataset,e=ent(LD);
 if(a==='lg-s')setMood(LD,{[d.k]:e[d.k]===+d.v?undefined:+d.v});
 else if(a==='lg-y'){const l=new Set(e.symptoms||[]);l.has(d.s)?l.delete(d.s):l.add(d.s);setMood(LD,{symptoms:[...l]})}
 else if(a==='lg-k')setMood(LD,{sick:e.sick?undefined:true});
 else if(a==='lg-o'){const y=d.v==='y';setMood(LD,e.orgasm===y?{orgasm:undefined,orgasmCount:undefined}:{orgasm:y,orgasmCount:y?e.orgasmCount||1:0})}
 else if(a==='lg-c')setMood(LD,{orgasmCount:Math.max(1,(e.orgasmCount||1)+ +d.d)});
 else if(a==='lg-t'){LD=today();WK=null;drawLog();drawLetter()}
 else if(a==='lg-w'){WK=WK===+d.d?null:+d.d;drawLog()}
 else if(a==='lg-q'){QO++;drawLog()}
 else if(a==='lg-h')pet()
 else if(a==='lg-mh')openCompanionMoodHistory(d.pc)
 else if(a==='lg-p')lgPer(d.v)}


let WK=null,QO=0,LT=null;
function letterView(){const c=cyc(LD||today()),cur=LET().find(x=>x.date===LD);let past='';
 if(c){const P=arr('period').filter(p=>p.start).sort((a,b)=>a.start.localeCompare(b.start)),L=LET();
  for(let i=P.length-2;i>=0;i--){const x=new Date(P[i].start+'T12:00');x.setDate(x.getDate()+c.day-1);const k=x.toLocaleDateString('sv'),len=Math.round((new Date(P[i+1].start)-new Date(P[i].start))/864e5),l=L.find(y=>y.date===k);
   if(c.day>len||k>=LD||!l)continue;past+=`<div class=sr><b>${fd(k)}</b><small style="white-space:pre-wrap;opacity:.85">${esc(l.text)}</small></div>`}}
 return dt('l','💌 Letter to future you',`<textarea id=lgl rows=4 placeholder="Anything future-you should read on this cycle day…">${esc(cur?.text||'')}</textarea><div class=sv id=lgls></div><div class=lbl>From past cycles</div>${past||'<p class=empty>Nothing written on this cycle day yet.</p>'}`)+allLetters()}
function allLetters(){const AL=LET().filter(x=>x&&x.date&&x.text).sort((x,y)=>y.date.localeCompare(x.date));
 return dt('la','📚 All letters · '+AL.length,AL.length?AL.map(l=>{const k=cyc(l.date);return `<div class=sr><b>${esc(l.date)}${k?' · day '+k.day:''}</b><small style="white-space:pre-wrap;opacity:.85">${esc(l.text)}</small></div>`}).join(''):'<p class=empty>No letters found in the cloud. Check the Raw data tab for ao3_cycle_letters_v1. If it is missing, they have not synced up from your AO3 page yet.</p>')}
function drawLetter(){const el=$('#logl');if(el)el.innerHTML=letterView()}
async function saveLetter(d,v){const a=LET().filter(x=>x.date!==d);if(v.trim())a.push({date:d,text:v.trim()});
 try{await persist(LK,a);const s=$('#lgls');if(s)s.textContent='saved ✓'}catch(e){msg=e.message;draw()}}
const VAL={"Cramps":-1,"Pre-period cramps":-.8,"Ovulation pain":-.7,"Spasms":-.8,"Headache":-.8,"Tender breasts":-.4,"Bloating":-.4,"Muscle aches":-.5,"PMS flu":-.9,"Spotting":-.2,"Acne":-.3,"Oily hair":-.15,"Watery discharge":0,"Sweating":-.25,"Hot flashes":-.5,"Dry eyes":-.25,"Eye strain":-.25,"Fatigue":-.7,"Hungry":0,"Small appetite":-.2,"Cravings":0,"Craving chocolate":0,"Vivid dreams":0,"Nesting":.1,"Emotional":-.35,"Irritable":-.6,"Anxiety":-.7,"Overthinking":-.6,"Self critical":-.7,"Hopelessness":-1,"PMDD":-1,"Calm":.7,"Confident":.8,"Feeling okay":.7,"Hating men":-.3,"Taking it personally":-.5,"Over it":-.5,"Sad":-.6,"Sociable":.4,"Solitary":-.2,"Flirty":.4,"High libido":.3,"Low libido":0};
const bv=a=>a[1]?a[0]/a[1]:null;
function hMode(h){const E=Object.entries(h).map(([k,c])=>[Number(k),c]);if(!E.length)return null;const mx=Math.max(...E.map(x=>x[1])),t=E.filter(x=>x[1]===mx).map(x=>x[0]);if(t.length===1)return t[0];const mean=E.reduce((s,[v,c])=>s+v*c,0)/E.reduce((s,x)=>s+x[1],0);t.sort((a,b)=>Math.abs(a-mean)-Math.abs(b-mean));return t[0]}
function dsB(ex,byPh){const B={};moodArr().forEach(e=>{if(e.date===ex)return;const k=cyc(e.date);if(!k)return;const K=byPh?k.ph:k.day,b=B[K]||(B[K]={n:0,w:0,m:[0,0],en:[0,0],sl:[0,0],sy:{},h:{m:{},en:{},sl:{}}}),w=e.sick?.25:1;b.n++;b.w+=w;
 [['mood','m'],['energy','en'],['sleep','sl']].forEach(([K,a])=>{if(typeof e[K]==='number'){b[a][0]+=e[K]*w;b[a][1]+=w;b.h[a][e[K]]=(b.h[a][e[K]]||0)+w}});(e.symptoms||[]).forEach(x=>b.sy[x]=(b.sy[x]||0)+w)});return B}
function rawScore(b){const P=[],m=hMode(b.h.m),en=hMode(b.h.en),sl=hMode(b.h.sl);if(m!=null)P.push([(m-3)/2,1.3]);if(en!=null)P.push([(en-3)/2,1.1]);if(sl!=null)P.push([(sl-3)/2,.9]);
 const E=Object.entries(b.sy);if(E.length&&b.w){let l=0;E.forEach(([x,n])=>l+=(VAL[x]||0)*n/(b.w+1));P.push([Math.tanh(l/1.2),1.5])}
 return P.length?P.reduce((a,p)=>a+p[0]*p[1],0)/P.reduce((a,p)=>a+p[1],0):null}
function scoreFor(day,c,ex){day=((day-1)%c.cl)+1;const db=dsB(null)[day],pb=dsB(null,1)[phd(day,c)],hm=x=>x&&['m','en','sl'].some(K=>Object.keys(x.h[K]).length),ms=hm(db)?db:pb,ss=db&&Object.keys(db.sy).length?db:pb;if(!ms&&!ss)return null;const b={n:(db||pb).n,w:ss?ss.w:0,h:ms?ms.h:{m:{},en:{},sl:{}},sy:ss?ss.sy:{}};const r=rawScore(b);if(r==null)return null;
 const all=Object.values(dsB(null)),sol=all.filter(x=>x.n>=2),vs=(sol.length>=10?sol:all).map(rawScore).filter(v=>v!=null),
 pr=Math.max(.3,Math.max(0,...vs.filter(v=>v>0))),nr=Math.max(.3,Math.max(0,...vs.filter(v=>v<0).map(v=>-v))),
 lg=moodArr().length,ok=vs.length>=5,c1=ok?Math.min(1,lg/45):0,c2=ok?Math.min(1,lg/180):0,st=.6+.25*c2,amp=40+10*c2,
 sc=Math.max(-1,Math.min(1,r*(r>=0?1+c1*st*(1/pr-1):1+c1*st*(1/nr-1)))),score=Math.round(Math.max(0,Math.min(100,50+sc*amp)));
 const[label,color]=score>=72?['Likely a good day','#8fd9c4']:score>=55?['Probably a decent day','#bfe3d6']:score>=40?['A mixed day','#c4c4de']:score>=25?['Could be a tough day','#ffb38a']:['Likely a rough day','#ff9ecf'];
 return{score,label,color,n:b.n}}
const scoreHtml=x=>x?`<div class=sr><b style="color:${x.color}">${x.score}/100 · ${x.label}</b><div class=bar style="margin:4px 0"><i style="width:${x.score}%;background:${x.color}"></i></div><small>predicted from ${x.n} logged day${x.n>1?'s':''} in past cycles</small></div>`:'';
const dayScoreRow=c=>c?`<div class=cy style="display:block">${scoreHtml(scoreFor(c.day,c,LD))||'<small>Day score appears once this cycle day has some history.</small>'}</div>`:'';
const CK='ao3_companion_v1',MS=[7,14,30,50,100,200,365],CS=[[0,'🫧','a quiet little bubble'],[5,'🌱','a small sprout'],[15,'🌷','a budding bloom'],[40,'🌸','a full bloom'],[90,'🌺','in radiant bloom']];
const CMSG={menstrual:["curls up next to you and doesn't ask you to be anything today.","brought you a blanket. it's not going to explain why.","thinks today is a heating-pad-and-nothing-else kind of day.","is not judging the fourth cup of tea. or the fifth.","wants you to know horizontal counts as a valid position."],
follicular:["has a little more bounce today and is hoping you do too.","thinks today is a good day to start the thing you've been eyeing.","is pointing at your reading list with great enthusiasm.","brought a small spark. use it however you like.","is feeling optimistic and won't be talked out of it."],
ovulatory:["is feeling extra friendly and wants you to know it.","thinks you should text that person back. today.","is glowing a little. it's not sure why. neither is anyone.","wants to go somewhere with you. anywhere.","is very proud of you for no particular reason."],
luteal:["is nesting. it's not going to explain the nest.","thinks a cosy reread is exactly the right call.","brought snacks and zero opinions.","wants things finished, quietly, with no drama.","is staying close and keeping the volume down."],
pms:["is lowering everyone's expectations on your behalf.","thinks comfort over adventure today. no appeals.","is guarding you from small annoyances.","brought dark chocolate and a very soft look.","is not taking anything personally on your behalf."]};
const COMPANION_FEELINGS = [
  { emoji: "😳", label: "feels a little shy right now" },
  { emoji: "😌", label: "is feeling calm and settled" },
  { emoji: "🥹", label: "is a little overwhelmed, in a good way" },
  { emoji: "😴", label: "is having a sleepy sort of day" },
  { emoji: "🤭", label: "is in a mischievous mood" },
  { emoji: "🥰", label: "is feeling especially fond of you today" },
  { emoji: "😊", label: "is quietly content" },
  { emoji: "🫠", label: "is melting a little, happily" },
  { emoji: "🤔", label: "is deep in thought about something" },
  { emoji: "🥳", label: "is in a giddy, celebratory mood" },
  { emoji: "🙂‍↕️", label: "is feeling a little wobbly today, in a fine way" },
  { emoji: "😇", label: "is feeling unusually angelic" },
  { emoji: "🥲", label: "is feeling something bittersweet" },
  { emoji: "😤", label: "is puffed up with quiet determination" },
  { emoji: "🫣", label: "is peeking out from behind its own paws" },
  { emoji: "😋", label: "is in a satisfied, well-fed sort of mood" },
  { emoji: "🥱", label: "is having a slow, unhurried day" },
  { emoji: "😽", label: "is feeling especially affectionate" },
  { emoji: "🤗", label: "is in a huggy sort of mood" },
  { emoji: "🫡", label: "is feeling weirdly dutiful today" },
  { emoji: "🥴", label: "is feeling a bit scrambled, harmlessly" },
  { emoji: "😙", label: "is in a soft, whistly-content mood" },
  { emoji: "🥺", label: "is feeling a little tender-hearted today" },
  { emoji: "😶‍🌫️", label: "is off in a daydream somewhere" },
  { emoji: "🫥", label: "is feeling a bit quiet and faded today" },
  { emoji: "😼", label: "is in a smug, pleased-with-itself mood" },
  { emoji: "🙃", label: "is feeling a little upside-down today, harmlessly" },
  { emoji: "😯", label: "is easily startled and wide-eyed today" },
  { emoji: "🥸", label: "is feeling silly and a little theatrical" },
  { emoji: "😐", label: "is feeling neutral, just puttering along" },
  { emoji: "🤨", label: "is feeling skeptical of something, unprompted" },
  { emoji: "😗", label: "is humming quietly to itself" },
  { emoji: "🫤", label: "is feeling a little unsettled, nothing serious" },
  { emoji: "🩵", label: "is feeling shy but pleased underneath it" },
  { emoji: "🤍", label: "is feeling gentle and soft-hearted" },
  { emoji: "🫶", label: "is feeling grateful for you today" },
  { emoji: "🐈‍⬛", label: "is feeling sneaky, in a playful way" },
  { emoji: "🥶", label: "is feeling a little chilly today" },
  { emoji: "🫨", label: "is feeling wonderfully, harmlessly rattled" },
  { emoji: "😵‍💫", label: "is feeling a bit dizzy and dreamy" },
  { emoji: "🙂", label: "is feeling steady and unremarkably fine" },
  { emoji: "😆", label: "is in a bright, laughing sort of mood" },
  { emoji: "🩷", label: "is feeling sentimental about something small" },
  { emoji: "😮‍💨", label: "is letting out a long, satisfied sigh" },
  { emoji: "🦉", label: "is quietly keeping watch tonight" },
  { emoji: "🐾", label: "is restless and padding around a lot today" },
  { emoji: "🌤️", label: "is feeling brighter than usual today" },
  { emoji: "🌧️", label: "is feeling a little rained-on, but okay" },
  { emoji: "🫂", label: "is craving closeness today" },
  { emoji: "🧸", label: "is feeling soft and a little clingy" },
  { emoji: "🕊️", label: "is feeling unusually peaceful" },
  { emoji: "🎐", label: "is feeling light and easily swayed today" },
  { emoji: "🪄", label: "is feeling whimsical and a little magical" },
  { emoji: "🍵", label: "is in a slow, tea-sipping kind of mood" },
  { emoji: "🌙", label: "is feeling dreamy and half-asleep" },
  { emoji: "🐣", label: "is feeling small and a little new to everything" },
  { emoji: "🦦", label: "is feeling playful and a bit fidgety" },
];
const COMPANION_TRINKETS = [
  { emoji: "🌼", label: "brought you a little daisy" },
  { emoji: "🐚", label: "brought you a smooth seashell" },
  { emoji: "🍄", label: "brought you a tiny mushroom" },
  { emoji: "🪶", label: "brought you a soft feather" },
  { emoji: "🍂", label: "brought you a pressed leaf" },
  { emoji: "🔮", label: "brought you a little marble" },
  { emoji: "🎀", label: "brought you a spare ribbon" },
  { emoji: "🧷", label: "brought you a shiny little pin" },
  { emoji: "🪨", label: "brought you a smooth pebble" },
  { emoji: "🍬", label: "brought you a wrapped candy" },
  { emoji: "🍀", label: "brought you a lucky clover" },
  { emoji: "🌰", label: "brought you a little acorn" },
  { emoji: "🧵", label: "brought you a spool of thread" },
  { emoji: "🕯️", label: "brought you a stubby little candle" },
  { emoji: "🪱", label: "brought you a rubbery little worm charm" },
  { emoji: "🍯", label: "brought you a drop of honey" },
  { emoji: "🧿", label: "brought you a little evil-eye bead" },
  { emoji: "🪵", label: "brought you a piece of driftwood" },
  { emoji: "🦴", label: "brought you a tiny bone-shaped trinket" },
  { emoji: "🧶", label: "brought you a ball of yarn" },
  { emoji: "🍒", label: "brought you a pair of cherries" },
  { emoji: "🪺", label: "brought you an empty little nest" },
  { emoji: "🌾", label: "brought you a stalk of wheat" },
  { emoji: "🧊", label: "brought you an ice cube, somehow unmelted" },
  { emoji: "🪙", label: "brought you a worn little coin" },
  { emoji: "🍁", label: "brought you a maple leaf" },
  { emoji: "🎋", label: "brought you a bamboo sprig" },
  { emoji: "🪷", label: "brought you a little lotus" },
  { emoji: "🐝", label: "brought you a pretend bee, made of felt" },
  { emoji: "🐞", label: "brought you a ladybug charm" },
  { emoji: "🦋", label: "brought you a delicate butterfly wing" },
  { emoji: "🌻", label: "brought you a small sunflower" },
  { emoji: "🍎", label: "brought you a shiny apple" },
  { emoji: "🍓", label: "brought you a ripe strawberry" },
  { emoji: "🧸", label: "brought you a tiny teddy bear" },
  { emoji: "🪆", label: "brought you a miniature nesting doll" },
  { emoji: "🎐", label: "brought you a little wind chime" },
  { emoji: "🧦", label: "brought you a mismatched sock" },
  { emoji: "🥨", label: "brought you a soft pretzel" },
  { emoji: "🍪", label: "brought you a cookie, slightly nibbled" },
  { emoji: "🫐", label: "brought you a handful of blueberries" },
  { emoji: "🦢", label: "brought you a carved wooden swan" },
  { emoji: "🐢", label: "brought you a tiny toy turtle" },
  { emoji: "🐌", label: "brought you a snail shell, empty" },
  { emoji: "🪻", label: "brought you a sprig of hyacinth" },
  { emoji: "🍇", label: "brought you a few grapes" },
  { emoji: "🥥", label: "brought you a tiny coconut charm" },
  { emoji: "🪥", label: "brought you a toothbrush? you're not sure why" },
  { emoji: "🔑", label: "brought you an old key that doesn't fit anything" },
  { emoji: "🧩", label: "brought you a single puzzle piece" },
  { emoji: "🎲", label: "brought you a single die" },
  { emoji: "🪞", label: "brought you a tiny hand mirror" },
  { emoji: "🕸️", label: "brought you a bit of spiderweb, carefully preserved" },
  { emoji: "🦔", label: "brought you a pinecone that looked like a hedgehog" },
  { emoji: "🌵", label: "brought you a tiny potted cactus" },
  { emoji: "🍋", label: "brought you a lemon, for some reason" },
  { emoji: "🥕", label: "brought you a baby carrot" },
  { emoji: "🎈", label: "brought you a half-deflated balloon" },
  { emoji: "🪡", label: "brought you a sewing needle — careful with that" },
  { emoji: "🩰", label: "brought you a tiny ballet shoe charm" },
  { emoji: "🎭", label: "brought you a tiny theater mask charm" },
  { emoji: "🖋️", label: "brought you an old fountain pen" },
  { emoji: "📎", label: "brought you a bent paperclip" },
  { emoji: "🔖", label: "brought you a ribbon bookmark" },
  {
    emoji: "🌟",
    label: "brought you something rare — a wishing star",
    rare: true,
  },
  {
    emoji: "🌈",
    label: "brought you something rare — a tiny rainbow, still faintly glowing",
    rare: true,
  },
  {
    emoji: "🕰️",
    label: "brought you something rare — a pocket watch, stopped at an odd hour",
    rare: true,
  },
];


// A small deterministic "random" generator seeded by an integer -- same
// seed always yields the same float in [0, 1). Used so the corner badge's
// daily choices look random from day to day instead of ticking through
// the pool in a visible sequence, while still staying fixed for the
// whole Prague day (no flicker on re-render).
function seededDailyRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Computes the two things that are fixed for the whole Prague day: which
// feeling and which trinket "belong" to today. Both are picked with the
// seeded random above so they're stable all day but don't look like a
// visible rotation from one day to the next.
function getDailyCompanionPicks(dayIndex) {
  const moodIdx = Math.floor(seededDailyRandom(dayIndex + 1000) * COMPANION_FEELINGS.length);
  const mood = { ...COMPANION_FEELINGS[moodIdx], kind: "feeling" };

  // Rare trinkets get their own long, low-odds roll instead of sitting in
  // the regular pool -- otherwise adding just one rare entry would make
  // it show up almost as often as any other trinket, which defeats the
  // point of it being rare.
  const rareTrinkets = COMPANION_TRINKETS.filter(t => t.rare);
  const commonTrinkets = COMPANION_TRINKETS.filter(t => !t.rare);
  const isRareDay = rareTrinkets.length > 0 && seededDailyRandom(dayIndex + 5000) < 0.035;
  const trinketPool = isRareDay ? rareTrinkets : commonTrinkets;
  const trinketIdx = Math.floor(seededDailyRandom(dayIndex + 2000) * trinketPool.length);
  const trinket = { ...trinketPool[trinketIdx], kind: "trinket" };

  return { mood, trinket };
}

function recordCompanionMoodToday(mood) {
  if (!mood) return;
  const todayStr = getPragueTodayIso();
  const log = getCompanionMoodLog();
  if (log.some(e => e.date === todayStr)) return;
  log.push({ date: todayStr, emoji: mood.emoji, label: mood.label });
  saveCompanionMoodLog(log);
}

function hexToRgba(hex, alpha) {
  // Also accept rgb()/rgba() input (re-alpha'd) and 3-digit hex, so a
  // non-hex color can't silently produce an invalid CSS value.
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(String(hex).trim());
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  let h = String(hex).trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatPrettyDate(isoDateOnly) {
  if (!isoDateOnly) return "—";
  const d = new Date(isoDateOnly + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Opens a small overlay listing the companion's past daily moods, most
// recent first. Mirrors openTrinketCollection/openFeedHistory's layout.
function openCompanionMoodHistory(phaseColor) {
  const log = getCompanionMoodLog().slice().sort((a, b) => b.date.localeCompare(a.date));

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(20,10,16,0.55); z-index:2147483005;
    display:flex; align-items:center; justify-content:center; padding:20px;
  `;
  overlay.onclick = () => overlay.remove();

  const panel = document.createElement("div");
  panel.style.cssText = `
    background:#1c1319; border:1px solid ${hexToRgba(phaseColor, 0.3)}; border-radius:14px;
    padding:16px; max-width:300px; width:100%; max-height:70vh; overflow-y:auto;
    box-shadow:0 8px 30px rgba(0,0,0,0.4);
  `;
  panel.onclick = (e) => e.stopPropagation();

  const title = document.createElement("div");
  title.style.cssText = "font-size:13px; font-weight:600; color:#ffeaf4; margin-bottom:10px;";
  title.textContent = "Companion mood history";
  panel.appendChild(title);

  if (!log.length) {
    const empty = document.createElement("div");
    empty.style.cssText = `font-size:11px; color:${hexToRgba(phaseColor, 0.7)}; line-height:1.5;`;
    empty.textContent = "nothing yet — check back tomorrow for the next entry.";
    panel.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    log.forEach(entry => {
      const row = document.createElement("div");
      row.style.cssText = `
        display:flex; align-items:center; gap:8px;
        background:${hexToRgba(phaseColor, 0.08)}; border:1px solid ${hexToRgba(phaseColor, 0.2)};
        border-radius:10px; padding:6px 9px;
      `;
      const emojiEl = document.createElement("div");
      emojiEl.style.cssText = "font-size:17px;";
      emojiEl.textContent = entry.emoji;
      const textCol = document.createElement("div");
      textCol.style.cssText = "display:flex; flex-direction:column; gap:1px; min-width:0;";
      const labelEl = document.createElement("div");
      labelEl.style.cssText = "font-size:11px; color:#ffeaf4;";
      labelEl.textContent = entry.label.replace(/^is /, "").replace(/^feels /, "");
      const dateEl = document.createElement("div");
      dateEl.style.cssText = `font-size:9.5px; color:${hexToRgba(phaseColor, 0.6)};`;
      dateEl.textContent = formatPrettyDate(entry.date);
      textCol.appendChild(labelEl);
      textCol.appendChild(dateEl);
      row.appendChild(emojiEl);
      row.appendChild(textCol);
      list.appendChild(row);
    });
    panel.appendChild(list);

    const footer = document.createElement("div");
    footer.style.cssText = `font-size:9.5px; color:${hexToRgba(phaseColor, 0.4)}; margin-top:10px; text-align:center;`;
    footer.textContent = `${log.length} day${log.length === 1 ? "" : "s"} logged`;
    panel.appendChild(footer);
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ─── Comfort message ───
// A short line reacting to one symptom logged the previous day. Picked
// deterministically off the day index (both which symptom, if several
// were logged, and which phrasing) so it's stable through the day and
// changes the next.
const COMFORT_MESSAGES = {
  "Cramps": ["cramps yesterday? heating pad's earned its keep today.", "still sorry about the cramps yesterday. go easy on yourself today."],
  "Headache": ["hope yesterday's headache is fully gone. drink some water, just in case.", "yesterday's headache didn't go unnoticed. hydrate today, okay?"],
  "Bloating": ["yesterday's bloating wasn't fun. today's a looser-waistband day.", "noted the bloating yesterday — comfy clothes today, no questions asked."],
  "Fatigue": ["you were running on empty yesterday. no shame in an early night tonight.", "yesterday's fatigue is allowed to carry into today. rest if you can."],
  "Acne": ["yesterday's skin stuff is temporary. you're still you.", "hope your skin's feeling calmer today than yesterday."],
  "PMDD": ["yesterday sounded like a genuinely hard one. you got through it.", "still thinking about how heavy yesterday felt. be extra gentle with yourself today."],
  "Watery discharge": ["just a body doing normal body things yesterday. nothing to worry about.", "noted yesterday's log. all normal, all fine."],
  "High libido": ["yesterday had a whole mood, huh. no comment, just noted.", "yesterday's energy was a lot. hope today's just as fun, your way."],
  "Irritable": ["yesterday's short fuse makes sense. today's a clean slate.", "sorry if yesterday felt snappy. that wasn't a character flaw, just a phase."],
  "Ovulation pain": ["yesterday's ovulation twinge is noted. hope today's quieter.", "that pain yesterday was real, even if it doesn't show. hope today's easier."],
  "Flirty": ["yesterday you were feeling yourself. hope some of that's still around.", "noted the flirty energy yesterday. no notes, just cute."],
  "Craving chocolate": ["yesterday's chocolate craving was valid. still is, honestly.", "hope you got the chocolate yesterday. if not, today's fair game."],
  "Cravings": ["yesterday's cravings were just your body asking for something. no guilt required.", "noted yesterday's cravings. feeding yourself isn't a moral issue."],
  "Hot flashes": ["yesterday's hot flashes sound miserable. hope today runs cooler.", "still thinking about the heat yesterday. hydrate, layer light, be patient with it."],
  "Tender breasts": ["yesterday sounds uncomfortable. a softer bra today might help.", "noted yesterday's tenderness. be a little careful today."],
  "Self critical": ["yesterday you were harder on yourself than you deserved. today, don't.", "whatever you told yourself yesterday, it probably wasn't true. try again today."],
  "Oily hair": ["yesterday's hair thing is not a big deal, promise.", "noted, and also: nobody else clocked it like you did."],
  "Eye strain": ["yesterday's eyes needed a break. take one today too.", "hope the eye strain from yesterday eased off. blink more, screen less, if you can."],
  "Sweating": ["yesterday ran hot. hope today's a little cooler on you.", "noted yesterday. drink some water today just in case."],
  "Nesting": ["yesterday's nesting mode was doing something. let the space stay tidy today.", "hope yesterday's cleaning spree left things feeling calmer today."],
  "Dry eyes": ["yesterday's dry eyes noted. maybe give the screen a rest today.", "hope your eyes feel less scratchy today than yesterday."],
  "Emotional": ["yesterday was a lot to feel. today, you're allowed to feel less.", "noted how much yesterday held. hope today's a little lighter."],
  "Sociable": ["yesterday you had people-energy. hope some of it's left for today.", "noted yesterday's social battery running high. use it well today too."],
  "Feeling okay": ["yesterday was just okay, and that counted for something.", "glad yesterday was steady. hoping today's the same."],
  "Small appetite": ["yesterday's appetite was quiet. no pressure to force anything today either.", "noted yesterday. eat what sounds good today, even if it's small."],
  "Vivid dreams": ["yesterday's dreams sound like a lot to carry into a normal day.", "hope your head's a little quieter today after all that dreaming."],
  "Spasms": ["yesterday's spasms sound rough. take it slower today if you can.", "noted the spasms yesterday. be gentle with your body today."],
  "Anxiety": ["yesterday sounds like it asked a lot of you. today, one thing at a time.", "still thinking about yesterday's anxiety. you made it through. today too."],
  "Hungry": ["yesterday you were properly hungry. make sure today feeds you enough.", "noted yesterday. don't skip meals today either."],
  "Solitary": ["yesterday you needed space, and that's allowed. today too, if you still do.", "noted yesterday's need to be alone. no explanation owed, today or ever."],
  "Confident": ["yesterday you were glowing. hoping some of that followed you into today.", "noted yesterday's confidence. wear it again today if it's still around."],
};
const COMFORT_DEFAULT_TEMPLATES = [
  s => `you logged "${s}" yesterday. hope today treats you a little better.`,
  s => `still thinking about the "${s}" from yesterday. be gentle with yourself today.`,
];


function getYesterdaySymptom() {
  const entry = getMoodForDate(getPragueDaysAgoIso(1));
  const symptoms = (entry && entry.symptoms) || [];
  if (!symptoms.length) return null;

  const todayIso = getPragueTodayIso();
  const history = getComfortHistory();

  // Already picked for today (drawer reopened same day) — stay consistent
  // rather than re-rolling, same as the rest of the daily-pick pattern.
  if (history.date === todayIso && symptoms.includes(history.symptom)) {
    return history.symptom;
  }

  const baseIdx = getPragueDayIndex() % symptoms.length;
  let symptom = symptoms[baseIdx];

  // If that's the same symptom shown last time and there's more than one
  // option today, rotate to the next one instead of repeating it.
  if (symptoms.length > 1 && symptom === history.symptom) {
    symptom = symptoms[(baseIdx + 1) % symptoms.length];
  }

  saveComfortHistory(todayIso, symptom);
  return symptom;
}

function getComfortMessage() {
  const symptom = getYesterdaySymptom();
  if (!symptom) return null;
  const pool = COMFORT_MESSAGES[symptom] || COMFORT_DEFAULT_TEMPLATES.map(fn => fn(symptom));
  const msg = pool[getPragueDayIndex() % pool.length];
  return { symptom, msg };
}

// ─── Daily affirmation ───
// A short comforting/insightful line, picked deterministically off the day
// index so it's stable through the day and changes the next. Not tied to
// any logged data — just a nice thing to read.
const AFFIRMATION_QUOTES = [
  "you don't have to earn rest today.",
  "whatever today looks like, it's enough.",
  "you're allowed to move slower than yesterday.",
  "small progress still counts as progress.",
  "you're doing better than the inside of your head is telling you.",
  "it's okay to not have a plan for today.",
  "you're allowed to take up space, today included.",
  "nobody's keeping score. you can stop too.",
  "today doesn't have to be productive to be good.",
  "you're allowed to change your mind about today.",
  "being tired isn't a character flaw.",
  "you get to decide what today is for.",
  "you've survived every hard day so far. that's not nothing.",
  "you don't owe anyone your best today.",
  "rest is not something you have to justify.",
  "you're allowed to ask for an easier day.",
  "it's fine if today is just a maintenance day.",
  "you're not behind. there's no schedule.",
  "you can be proud of yourself for smaller things than you think.",
  "today, good enough is good enough.",
  "you're allowed to close the tab and just breathe for a minute.",
  "whatever you're carrying right now, you don't have to carry it perfectly.",
  "you're not too much. today included.",
  "it's okay to need a soft day.",
  "you get to be gentle with yourself, starting now.",
];

function getDailyAffirmation() {
  return AFFIRMATION_QUOTES[getPragueDayIndex() % AFFIRMATION_QUOTES.length];
}
let CM=null;
const trk=()=>{const d=new Set();moodArr().forEach(e=>e.date&&d.add(e.date));arr('period').forEach(x=>{x.start&&d.add(x.start);x.end&&d.add(x.end)});return d.size};
function companion(c){const n=trk();let i=0;CS.forEach((x,k)=>{if(n>=x[0])i=k});const st=CS[i],nx=CS[i+1],m=rows[CK]?.value||{},pool=CMSG[c?c.ph:'follicular'];
 const comfort=getComfortMessage();
 const dailyMood=getDailyCompanionPicks(getPragueDayIndex()).mood;recordCompanionMoodToday(dailyMood);
 const msg=CM||pool[(Math.floor(Date.parse(LD)/864e5))%pool.length];
 return `<div class="cy co"><div class=em>${st[1]}</div><div style="flex:1"><b>${st[2]}</b><div class=m>${n} tracked day${n===1?'':'s'}${nx?` · ${nx[0]-n} to grow`:''}${m.streak?` · 💗 ${m.streak}-day streak`:''}</div><div class=m style="margin-top:4px;font-style:italic">${esc(msg)}</div><div class=m data-a=lg-mh data-pc="${PC[c?c.ph:'follicular']||'#ffb8dc'}" style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.12);cursor:pointer;"><span style="opacity:0.75;">${dailyMood.emoji} feeling today —</span> Your companion ${dailyMood.label}.</div><div class=m style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.12)"><span style="opacity:0.75;">✧ today —</span> ${getDailyAffirmation()}</div>${comfort?`<div class=m style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.12)"><span style="opacity:0.75;">${SI[comfort.symptom]||"🫂"} about yesterday —</span> ${comfort.msg}</div>`:`<div class=m style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.12);opacity:0.7;">no symptoms logged yesterday.</div>`}</div><button data-a=lg-h>say hi</button></div>`}
let petBusy=false;
async function pet(){if(petBusy)return;petBusy=true;const m={pets:0,lastPetDate:null,streak:0,...(rows[CK]?.value||{})},t=today(),y=dk(Date.now()-864e5);let ms=false;
 if(m.lastPetDate!==t){m.streak=m.lastPetDate===y?(m.streak||0)+1:1;m.lastPetDate=t;ms=MS.includes(m.streak)}
 m.pets=(m.pets||0)+1;const c=cyc(today()),pool=CMSG[c?c.ph:'follicular'];
 CM=ms?`celebrates your ${m.streak}-day streak. it's a big deal to it.`:pool[Math.floor(Math.random()*pool.length)];drawLog();
 try{await persist(CK,m)}catch(e){msg=e.message;draw()}petBusy=false;drawLog()}
