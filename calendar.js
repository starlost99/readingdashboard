// Calendar view: month grid, day detail and calendar drawing.
let CALM=null,CSEL=null;
function cstat(){const P=arr('period').filter(p=>p.start).sort((a,b)=>a.start.localeCompare(b.start));if(!P.length)return null;
 const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null,gp=P.slice(1).map((p,i)=>ddf(P[i].start,p.start)).slice(-6),
 cl=Math.round(avg(gp)||28),pl=Math.round(avg(P.filter(p=>p.end).map(p=>ddf(p.start,p.end)+1).slice(-6))||5),
 ov=Math.max(pl+1,Math.round(cl/2)),ps=Math.max(ov+2,cl-6);return{P,cl,pl,ov,ps}}
function calInfo(d,C,t){if(!C)return{};
 const o=C.P.find(p=>d>=p.start&&d<=(p.end||(p.start<=t?t:p.start)));
 if(o)return{logged:1,ph:'menstrual',day:ddf(o.start,d)+1};
 let cs=C.P[C.P.length-1].start;
 if(d>=cs){while(addD(cs,C.cl)<=d)cs=addD(cs,C.cl)}else{do{cs=addD(cs,-C.cl)}while(cs>d)}
 const day=ddf(cs,d)+1;return{ph:phd(day,C),day,pred:day<=C.pl}}
function calView(){const t=today(),C=cstat();if(!CALM)CALM=t.slice(0,7);
 const [y,m]=CALM.split('-').map(Number),dim=new Date(y,m,0).getDate(),fow=(new Date(y,m-1,1).getDay()+6)%7,
 hasM={};moodArr().forEach(e=>{if(e.date&&(e.mood||e.energy||e.sleep||e.sleepHours||(e.symptoms||[]).length))hasM[e.date]=1});
 const rd={};arr('log').forEach(x=>{const k=dk(x.date);(rd[k]=rd[k]||[]).push(x)});
 let g=['M','T','W','T','F','S','S'].map(x=>`<div class=dh>${x}</div>`).join('')+'<div></div>'.repeat(fow);
 for(let i=1;i<=dim;i++){const d=`${CALM}-${String(i).padStart(2,'0')}`,f=calInfo(d,C,t);
  let bg='transparent',bd='1px solid transparent',col='',ti='';
  if(f.logged){bg=PC.menstrual;col='#171117';ti='Logged period'}
  else if(f.pred){bd=`1px dashed ${PC.menstrual}`;col=PC.menstrual;ti='Predicted period'}
  else if(f.ph){bg=rgba(PC[f.ph],.18);ti=PH[f.ph][1]}
  if(rd[d])ti+=(ti?' · ':'')+rd[d].length+' fic'+(rd[d].length>1?'s':'')+' read';
  g+=`<button data-a=cal-d data-d=${d} title="${esc(ti)}" class="cd${d===t?' tdy':''}${d===CSEL?' sel':''}" style="background:${bg};border:${bd};${col?'color:'+col:''}">${i}${f.day?`<small>d${f.day}</small>`:''}${rd[d]?`<u style="right:2px;${f.logged?'background:#171117':''}"></u>`:''}${hasM[d]?'<u style="left:2px"></u>':''}</button>`}
 const lg=[['Logged period',PC.menstrual,''],['Predicted period','transparent',`border:1px dashed ${PC.menstrual}`],...['follicular','ovulatory','luteal','pms'].map(k=>[PH[k][1],rgba(PC[k],.5),''])];
 return `<div class=cn><button data-a=cal-p>‹</button><b>${new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</b><button data-a=cal-n>›</button></div>`
  +(C?'':'<p class=empty>Log a period start to see phases on the calendar.</p>')
  +`<div class=cgd>${g}</div><div class=cleg>${lg.map(([l,c,x])=>`<span><i style="background:${c};${x}"></i>${l}</span>`).join('')}<span><i style="background:var(--p2)"></i>mood logged (left) · fic read (right)</span></div>`+calDetail(C,t)}
function calDetail(C,t){if(!CSEL)return'';const d=CSEL,f=calInfo(d,C,t),e=ent(d),L=arr('log').filter(x=>dk(x.date)===d).sort((a,b)=>a.date.localeCompare(b.date));
 const bits=[e.mood&&'Mood '+e.mood+'/5',e.energy&&'Energy '+e.energy+'/5',e.sleep&&'Sleep '+e.sleep+'/5',e.sleepHours&&'Slept '+SHR[e.sleepHours-1]+' hrs',typeof e.orgasmCount==='number'?'Orgasms: '+e.orgasmCount:typeof e.orgasm==='boolean'?'Orgasm: '+(e.orgasm?'Yes':'No'):null,e.sick&&'🤒 sick'].filter(Boolean);
 return `<div class=cdet><div class=t>${esc(new Date(d+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}))}</div>`
  +(f.ph?`<div class=m>${PH[f.ph][0]} Day ${f.day} · ${PH[f.ph][1]}${f.logged?' · logged period':f.pred?' · predicted period':d>t?' · predicted':''}</div>`:'')
  +(bits.length?`<div class=m style="opacity:.85">${esc(bits.join(' · '))}</div>`:'')
  +((e.symptoms||[]).length?`<div class=chips style="margin-top:6px">${e.symptoms.map(s=>`<span class=b>${SI[s]||'•'} ${esc(s)}</span>`).join('')}</div>`:'')
  +L.map(x=>`<div class=row style="margin-top:8px"><div><span class=t>${x.url?`<a href="${esc(x.url)}" target=_blank rel=noopener>${esc(x.title)}</a>`:esc(x.title)}</span><div class=m>${sp(x.chapter,fmt(x.words)+' words')}</div></div></div>`).join('')
  +(!bits.length&&!(e.symptoms||[]).length&&!L.length?'<div class=m>Nothing logged this day.</div>':'')
  +(d<=t?`<div style="margin-top:10px"><button class=pri data-a=cal-l data-d=${d}>Edit this day ↑</button></div>`:'')+'</div>'}
function calBox(){return dt('ca','📅 Calendar',calView())}
OPEN.ca=true;
function drawCal(){const el=$('#calv');if(el)el.innerHTML=calBox()}
