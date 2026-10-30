// Supabase client plus load / persist / commit (cloud sync of the ao3_sync table).
const SB_URL="https://mwiqglbaitdueibcqjeb.supabase.co", SB_KEY="sb_publishable_50olar8X22QLGtKKrgMk1g_w3xFQB0n";
const sb=supabase.createClient(SB_URL,SB_KEY);
async function load(){const {data,error}=await sb.from('ao3_sync').select('key,value,updated_at');
 if(error)msg=error.message;else{rows={};data.forEach(r=>rows[r.key]=r);}draw();}
async function persist(key,value){const r=rows[key];let res;
 if(r)res=await sb.from('ao3_sync').update({value,device:'web'}).eq('key',key).eq('updated_at',r.updated_at).select('updated_at');
 else res=await sb.from('ao3_sync').insert({key,value,device:'web'}).select('updated_at');
 if(res.error)throw res.error;
 if(!res.data.length){await load();throw new Error('That data changed somewhere else, so I reloaded it. Please try again.');}
 rows[key]={key,value,updated_at:res.data[0].updated_at};}
async function commit(t,a){try{await persist(K[t],a);
 if(t==='log')await persist(TOT,a.reduce((s,x)=>s+(x.words||0),0));
 msg='Saved. Your AO3 pages pick it up the next time they load.';}catch(e){msg=e.message;}
 $('#dlg').close();draw();}
