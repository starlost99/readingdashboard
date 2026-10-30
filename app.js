// App shell: shared UI helpers and state, raw-data view, main draw(), dialogs, global event handlers and startup. Loaded last.
const $=s=>document.querySelector(s), fmt=n=>Number(n||0).toLocaleString();
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S={
 fics:[['title','Title','text'],['aka','Nickname','text'],['workId','Work ID','text'],['currentChapter','Chapter I am on','number'],['totalChapters','Total chapters','number'],['words','Words','number'],['caughtUp','Caught up','check'],['finished','Finished','check']],
 log:[['title','Title','text'],['chapter','Chapter','text'],['words','Words','number'],['date','Date','date']],
 mood:[['date','Date','date'],['mood','Mood','number'],['energy','Energy','number'],['sleep','Sleep','number'],['symptoms','Symptoms (comma separated)','list']],
 period:[['start','Start','date'],['end','End (empty if ongoing)','date'],['notes','Notes','text']]};
let rows={},tab='log',q='',flt='all',more=80,msg='',session=null,cur={};
let F={m:null,d:'',s:'',e:'',all:false};
const st=x=>x.finished?'finished':x.caughtUp?'caught up':'reading';
const sp=(...a)=>a.filter(Boolean).map(t=>`<span>${esc(t)}</span>`).join('');
const rt=w=>{const m=Math.round(w/WPM),h=Math.floor(m/60);return h?`${h}h ${m%60}m`:`${m}m`};
const books=w=>(w/BOOK).toFixed(1)+' books';
const stars=n=>n?'★'.repeat(Math.floor(n))+(n%1?'½':''):'';
const row=(s,d,c)=>`<div class=sr><b${c?` style="color:${c}"`:''}>${s}</b>${d?`<small>${esc(d)}</small>`:''}</div>`;
const det=(t,b,o)=>`<details${o?' open':''}><summary>${t}</summary><div class=pn>${b}</div></details>`;
const V={
 fics:x=>`<span class=t>${esc(x.title)}</span>${x.aka?` <em class=m>${esc(x.aka)}</em>`:''}<div class=m>${sp(x.fandoms?.[0],`chapter ${x.currentChapter??'?'} of ${x.totalChapters??'?'}`,fmt(x.words)+' words')}<span class="b ${st(x).split(' ')[0]}">${st(x)}</span></div>`,
 mood:x=>`<b>${esc(x.date)}</b><div class=m>${sp('mood '+x.mood,'energy '+x.energy,'sleep '+x.sleep,...(x.symptoms||[]))}</div>`,
 period:x=>`<b>${esc(x.start)}</b> to <b>${esc(x.end||'ongoing')}</b>`};
const fd=d=>new Date(d+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
const dt=(k,t,b)=>`<details data-o=${k}${OPEN[k]?' open':''}><summary>${t}</summary><div class=pn>${b}</div></details>`;
document.addEventListener('toggle',e=>{if(e.target.dataset&&e.target.dataset.o)OPEN[e.target.dataset.o]=e.target.open},true);


function rawView(){return `<p class=m>Every synced key. Edit carefully, this is the raw JSON.</p><label>Import a backup file (replaces matching data)<input type=file id=imp accept=".json"></label><div id=list>`+Object.values(rows).sort((a,b)=>a.key.localeCompare(b.key)).map(r=>`<div class=row><div><b>${esc(r.key)}</b><div class=m>${sp(Math.round(JSON.stringify(r.value).length/1024)+' KB','updated '+r.updated_at.slice(0,16).replace('T',' '))}</div></div><button data-a=raw data-k="${esc(r.key)}">Edit</button></div>`).join('')+'</div>';}
function draw(){const el=$('#app');
 if(!session){el.innerHTML=`<form id=login class=login><h1>Reading Dashboard</h1>${msg?`<p class=msg>${esc(msg)}</p>`:''}<label>Email<input name=email type=email required></label><label>Password<input name=pw type=password required></label><button class=pri>Sign in</button></form>`;return;}
 if(!F.m)F.m=today().slice(0,7);
 const T=[['log','Today'],['read','Reading'],['fics','Fics'],['mood','Mood'],['period','Period'],['raw','Raw data']];
 el.innerHTML=`<div class=modal><div class=top><div><b>Reading Dashboard</b><span class=h>♡</span></div><div><button data-a=refresh>Refresh</button> <button data-a=out>Sign out</button></div></div><div class=body><nav class=tabs>${T.map(([k,l])=>`<button class=tab data-a=tab data-t=${k} aria-selected=${tab===k}>${l}</button>`).join('')}</nav>${msg?`<p class=msg>${esc(msg)}</p>`:''}${tab==='log'?'<div id=mbv>'+mbBox()+'</div><div id=logv>'+logView()+'</div><div id=calv>'+calBox()+'</div><div id=logl>'+letterView()+'</div>':tab==='raw'?rawView():tab==='read'?readView():tab==='period'?periodView():listView()}</div></div>`;}

function edit(t,i){cur={t,i};const o=i<0?{}:arr(t)[i]||{};
 $('#dlg form').innerHTML=`<h2>${i<0?'Add':'Edit'}</h2>`+S[t].map(([n,l,ty])=>`<label>${l}`+(ty==='check'?`<input type=checkbox name=${n} ${o[n]?'checked':''}>`:`<input name=${n} type=${ty==='list'?'text':ty} value="${esc(ty==='list'?(o[n]||[]).join(', '):ty==='date'?String(o[n]??'').slice(0,10):o[n])}">`)+'</label>').join('')
  +`<div class=btns><button class=pri>Save</button>${i<0?'':'<button type=button class=danger data-a=del>Delete</button>'}<button type=button data-a=close>Cancel</button></div>`;
 $('#dlg').showModal();}
function editRaw(k){cur={raw:k};$('#dlg form').innerHTML=`<h2>${esc(k)}</h2><textarea name=j rows=16>${esc(JSON.stringify(rows[k].value,null,1))}</textarea><div class=btns><button class=pri>Save</button><button type=button data-a=close>Cancel</button></div>`;$('#dlg').showModal();}
async function save(form){const fd=new FormData(form);
 if(cur.raw){try{await persist(cur.raw,JSON.parse(fd.get('j')));msg='Saved.';}catch(e){msg=e.message;}$('#dlg').close();return draw();}
 const {t,i}=cur,a=arr(t).slice(),o=i<0?{}:{...a[i]};
 S[t].forEach(([n,l,ty])=>{const v=fd.get(n);
  if(ty==='check')o[n]=v!==null;else if(ty==='number')o[n]=v===''?undefined:+v;
  else if(ty==='list')o[n]=v.split(',').map(s=>s.trim()).filter(Boolean);
  else if(ty==='date'){const old=String(o[n]??'');o[n]=v===old.slice(0,10)?old:(t==='log'&&v?new Date(v+'T12:00:00').toISOString():v);}
  else o[n]=v;});
 if(i<0){if(t==='log'){o.id=crypto.randomUUID();o.key='manual::'+o.id;if(!o.date)o.date=new Date().toISOString();}
  if(t==='period')o.id='p_'+Date.now();
  if(t==='fics'){if(!o.workId){alert('A work ID is needed (the number in the fic link).');return;}o.url='https://archiveofourown.org/works/'+o.workId;o.trackedAt=new Date().toISOString();o.fandoms=[];}
  a.push(o);}else a[i]=o;
 if(t==='mood'){const j=a.findIndex((x,k)=>x.date===o.date&&x!==o);if(j>=0)a.splice(j,1);}
 commit(t,a);}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;if(a.startsWith('lg-'))return logAct(b);
 if(a==='cal-p'||a==='cal-n'){const[y,m]=CALM.split('-').map(Number),x=new Date(y,m-1+(a==='cal-n'?1:-1),1);CALM=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');return drawCal()}
 if(a==='cal-d'){const d=b.dataset.d;CSEL=CSEL===d?null:d;if(CSEL&&d<=today()){LD=d;WK=null;drawLetter();return drawLog()}return drawCal()}
 if(a==='cal-l'){const el=$('#logv');return el&&el.scrollIntoView({behavior:'smooth'})}
 if(a==='per-end'){const x=arr('period').map(o=>({...o})),i=+b.dataset.i;x[i].end=today();return commit('period',x)}
 if(a==='tab'){tab=b.dataset.t;more=80;msg='';draw();}
 else if(a==='edit')edit(b.dataset.t,+b.dataset.i);else if(a==='add')edit(b.dataset.t,-1);
 else if(a==='raw')editRaw(b.dataset.k);else if(a==='more'){more+=80;draw();}
 else if(a==='close')$('#dlg').close();
 else if(a==='fclear'){F={m:F.m,d:'',s:'',e:'',all:true};draw();}
 else if(a==='fnow'){F={m:today().slice(0,7),d:'',s:'',e:'',all:false};draw();}
 else if(a==='del'){if(confirm('Delete this entry?')){const x=arr(cur.t).slice();x.splice(cur.i,1);commit(cur.t,x);}}
 else if(a==='refresh'){msg='Refreshed.';await load();}
 else if(a==='out'){await sb.auth.signOut();session=null;rows={};draw();}});
document.addEventListener('input',e=>{if(e.target.id==='lgl'){clearTimeout(LT);const v=e.target.value,d=LD;$('#lgls').textContent='saving…';LT=setTimeout(()=>saveLetter(d,v),700);return}
 if(e.target.id==='q'){q=e.target.value;more=80;$('#list').innerHTML=listItems();}});
document.addEventListener('change',async e=>{const id=e.target.id,v=e.target.value;
 if(id==='lgd'){LD=v||today();WK=null;drawLetter();return drawLog();}if(id==='lgh')return setMood(LD,{sleepHours:v?+v:undefined});
 if(id==='f'){flt=v;$('#list').innerHTML=listItems();}
 if(['fm','fd','fs','fe'].includes(id)){if(id==='fm'){F.m=v||today().slice(0,7);F.d=F.s=F.e='';}else if(id==='fd'){F.d=v;}else F[id==='fs'?'s':'e']=v;F.all=false;more=80;
  const open=[...document.querySelectorAll('details')].map(d=>d.open);draw();document.querySelectorAll('details').forEach((d,i)=>d.open=i===0?true:open[i]);}
 if(id==='imp'&&e.target.files[0]&&confirm('Import this backup? It replaces the matching data in the cloud.')){
  try{const j=JSON.parse(await e.target.files[0].text());for(const [k,key] of Object.entries(MAP))if(j[k]!==undefined){const ex=Array.isArray(rows[key]?.value)?rows[key].value:[];await persist(key,k==='letters'&&Array.isArray(j[k])?[...ex,...j[k].filter(l=>l&&!ex.some(x=>x.date===l.date))]:j[k]);}msg='Backup imported.';}catch(x){msg=x.message;}await load();}});
document.addEventListener('submit',async e=>{e.preventDefault();
 if(e.target.id==='login'){const f=new FormData(e.target);const {data,error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('pw')});
  if(error){msg=error.message;return draw();}msg='';session=data.session;load();}
 else save(e.target);});
sb.auth.getSession().then(({data})=>{session=data.session;session?load():draw();});
