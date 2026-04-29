/* ============================================================
   NEST · JS (engine preserved, UI renderers rewritten)
   ============================================================ */
let entries=[];
const APP_SCHEMA_VERSION=3;
const APP_NAME='Nest';
const PROFILE_KEY='nz3_profiles_v1',CUR_PROFILE='nz3_current_profile';

const defaultCfg=()=>({
  name:'Bebê',babyBirthDate:'',months:3,
  nightStart:'18:00',dayBoundary:'06:00',
  lateNightMode:false,darkTheme:true,
  remindNap:false,remindNight:false,
  ctxTeething:false,ctxCold:false,ctxVaccine:false,ctxTravel:false,ctxRegression:false,ctxOther:false,ctxNote:'',
  premiumState:'free',trialStart:null,licenseToken:'',licenseTier:'',licenseExpiresAt:null,premiumUnlockLocal:false,
  dataSchemaVersion:APP_SCHEMA_VERSION,profileSetupDone:false
});
let cfg={...defaultCfg()};
let curModal=null,state={feedType:'breast',diaperType:'wet'};
let wwTimer=null,lnTimer=null,barChart=null,donutChart=null;

window.__nestErrors=[];window.__nestRenderErrors=[];window.__nestLastRenderState={};
function nestErrPayload(obj){return{...obj,time:new Date().toISOString(),userAgent:typeof navigator!=='undefined'?navigator.userAgent:'',appVersion:typeof APP_NAME!=='undefined'?APP_NAME:'Nest'};}
function nestPushGlobal(o){try{(window.__nestErrors=window.__nestErrors||[]).push(o);if(window.__nestErrors.length>100)window.__nestErrors.shift();}catch(e){}}
function nestPushRender(o){try{(window.__nestRenderErrors=window.__nestRenderErrors||[]).push(o);if(window.__nestRenderErrors.length>60)window.__nestRenderErrors.shift();}catch(e){}}
function nestInitErrorCapture(){if(window.__nestErrCaptureInit)return;window.__nestErrCaptureInit=true;window.addEventListener('error',ev=>{nestPushGlobal(nestErrPayload({type:'error',message:ev.message||String(ev.error),stack:ev.error&&ev.error.stack?String(ev.error.stack):'',filename:ev.filename||'',lineno:ev.lineno||0,colno:ev.colno||0}));});window.addEventListener('unhandledrejection',ev=>{const r=ev.reason;nestPushGlobal(nestErrPayload({type:'unhandledrejection',message:r&&(r.message||String(r))||'rejection',stack:r&&r.stack?String(r.stack):'',filename:'',lineno:0,colno:0}));});}
/** Envolve renderizadores: falha isolada, não apaga outros blocos. */
function safeRender(name,fn,options){options=options||{};try{fn();window.__nestLastRenderState=window.__nestLastRenderState||{};window.__nestLastRenderState[name]={ok:true,t:new Date().toISOString()};return{ok:true};}catch(err){const rec=nestErrPayload({type:'render',name,message:String(err&&err.message||err),stack:String(err&&err.stack||''),filename:'',lineno:0,colno:0});nestPushRender(rec);console.error('[render failed]',name,err);const el=options.containerId?$(options.containerId):null;if(el){const fb=options.fallbackHTML!=null?options.fallbackHTML:(options.containerId==='pred-list'?'<div class="empty-pretty"><p>Não consegui calcular as próximas janelas agora. Registre um evento ou recarregue o app.</p></div>':options.containerId==='today-rail'?'<div class="trail-empty">Não consegui montar a linha do dia agora.</div>':options.containerId==='glance'?'<div class="empty-pretty"><p>Resumo do dia indisponível agora.</p></div>':options.containerId==='night-panel-wrap'?'<div class="empty-pretty"><p>Painel da noite indisponível agora.</p></div>':options.containerId==='stats-charts'?'<p style="padding:12px;color:var(--ink-muted)">Gráfico indisponível agora.</p>':'');if(fb!==undefined&&fb!=='')el.innerHTML=fb;}window.__nestLastRenderState=window.__nestLastRenderState||{};window.__nestLastRenderState[name]={ok:false,t:new Date().toISOString(),error:rec.message};return{ok:false,error:err};}}
function nestContainerSnapshot(id){const el=$(id);if(!el)return{exists:false,childCount:0,text:''};return{exists:true,childCount:el.children?el.children.length:0,text:(el.textContent||'').slice(0,280)};}
function debugRenderHealth(){const sec=document.querySelector('.section.active');return{appVersion:APP_NAME+' schema'+APP_SCHEMA_VERSION,userAgent:navigator.userAgent,activeSection:sec?sec.id:'',renderErrors:(window.__nestRenderErrors||[]).slice(-12),globalErrors:(window.__nestErrors||[]).slice(-12),containers:{predList:nestContainerSnapshot('pred-list'),todayRail:nestContainerSnapshot('today-rail'),statsCharts:nestContainerSnapshot('stats-charts'),dayPanel:nestContainerSnapshot('glance'),nightPanel:nestContainerSnapshot('night-panel-wrap')},lastRenderState:window.__nestLastRenderState||{}};}
function debugNestStorage(){const keys=[];let approx=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k){keys.push(k);try{approx+=(localStorage.getItem(k)||'').length;}catch(e){}}}}catch(e){}return{keyCount:keys.length,approxChars:approx,nzKeys:keys.filter(k=>/^nz/i.test(k)).slice(0,40)};}
function refreshAppAfterDataChange(reason){window.__nestLastRenderState=window.__nestLastRenderState||{};window.__nestLastRenderState.refreshReason=reason;window.__nestLastRenderState.refreshAt=new Date().toISOString();safeRender('updateHeader',updateHeader);safeRender('renderOrbit',renderOrbit);safeRender('renderStatusRow',renderStatusRow);safeRender('renderInsight',renderInsight);safeRender('renderPredictions',renderPredictions,{containerId:'pred-list'});safeRender('renderGlance',renderGlance,{containerId:'glance'});safeRender('renderNightPanel',renderNightPanel,{containerId:'night-panel-wrap'});safeRender('renderTodayRail',renderTodayRail,{containerId:'today-rail'});const cc=$('cc-sub');if(cc)safeRender('cc-sub',()=>{const dm=dataMaturity();cc.textContent=dm.label+' · '+dm.hint.split('.')[0]+'.';});}
function copyNestDebugReport(){const payload={debugRenderHealth:debugRenderHealth(),debugNestStorage:debugNestStorage()};if(typeof debugIphoneHomeState==='function')try{payload.debugIphoneHomeState=debugIphoneHomeState();}catch(e){payload.debugIphoneHomeState={error:String(e.message||e)}}if(typeof debugDateParsing==='function')try{payload.debugDateParsing=debugDateParsing();}catch(e){payload.debugDateParsing={error:String(e.message||e)}}payload.entriesSample=entries.slice(-20).map(e=>{const n=e&&typeof e==='object'?normalizeEntry({...e}):null;return n?{id:n.id,type:n.type,date:n.date,start:n.start,end:n.end,durationMins:n.durationMins,subtype:n.subtype,sleepKind:n.sleepKind}:null;}).filter(Boolean);const txt=JSON.stringify(payload,null,2);if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(txt).then(()=>{showToast('Diagnóstico copiado');}).catch(()=>{fallbackCopy(txt);});fallbackCopy(txt);}
function fallbackCopy(t){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');showToast('Diagnóstico copiado');}catch(e){showToast('Copie manualmente do painel');}document.body.removeChild(ta);}
function showDebugPanel(){let o=$('nest-debug-panel');if(o){o.remove();}
  const d=debugRenderHealth();const st=debugNestStorage();
  o=document.createElement('div');o.id='nest-debug-panel';o.setAttribute('role','dialog');o.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);padding:16px;overflow:auto;-webkit-overflow-scrolling:touch';
  o.innerHTML=`<div style="max-width:420px;margin:0 auto;background:var(--surface-1);border-radius:var(--r-md);padding:16px;box-shadow:var(--shadow-float);color:var(--ink);font-size:13px;line-height:1.45">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><strong>Diagnóstico Nest</strong><button type="button" onclick="document.getElementById('nest-debug-panel').remove()" style="padding:6px 10px">Fechar</button></div>
    <p style="color:var(--ink-muted);margin-bottom:8px">${escHtml(d.appVersion)} · ${escHtml(d.activeSection||'—')}</p>
    <p style="margin-bottom:6px"><strong>Storage:</strong> ${st.keyCount} chaves · ~${st.approxChars} chars</p>
    <div style="margin:10px 0"><strong>Últimos erros (global)</strong><pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;background:var(--surface-0);padding:8px;border-radius:8px;max-height:100px;overflow:auto">${escHtml(JSON.stringify(d.globalErrors.slice(-5),null,2))}</pre></div>
    <div style="margin:10px 0"><strong>Últimos erros (render)</strong><pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;background:var(--surface-0);padding:8px;border-radius:8px;max-height:100px;overflow:auto">${escHtml(JSON.stringify(d.renderErrors.slice(-5),null,2))}</pre></div>
    <div style="margin:10px 0"><strong>Containers</strong><pre style="white-space:pre-wrap;font-size:11px;background:var(--surface-0);padding:8px;border-radius:8px;max-height:120px;overflow:auto">${escHtml(JSON.stringify(d.containers,null,2))}</pre></div>
    <div style="display:grid;gap:8px;margin-top:12px"><button type="button" class="btn-primary" onclick="copyNestDebugReport()" style="width:100%">Copiar relatório JSON</button></div>
  </div>`;
  o.onclick=function(ev){if(ev.target===o)o.remove();};o.firstChild.onclick=function(ev){ev.stopPropagation();};document.body.appendChild(o);}

/* ---- utils ---- */
const $=id=>document.getElementById(id);
const now=()=>new Date();
const todayStr=()=>new Date().toLocaleDateString('sv-SE');
const fmtTime=d=>d.toTimeString().slice(0,5);
const fmtDur=m=>{if(m==null||m<0)m=0;const h=Math.floor(m/60),r=Math.round(m%60);return h>0?(h+'h'+(r>0?' '+r+'m':'')):(r+'m');};
const fmtDurShort=m=>{if(m==null||m<0)m=0;const h=Math.floor(m/60),r=Math.round(m%60);return h>0?(h+'h'+(r>0?String(r).padStart(2,'0'):'')):(r+'m');};
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const parseTime=s=>{const[h,m]=s.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return d;};
function parseTimeOnDate(timeStr,dateStr){const[h,m]=timeStr.split(':').map(Number);const d=new Date(dateStr+'T12:00:00');d.setHours(h,m,0,0);return d;}
const timeToMins=s=>{const[h,m]=s.split(':').map(Number);return h*60+m;};
const minsToTime=m=>{const h=Math.floor(m/60)%24,mm=m%60;return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');};
const fmtDateSV=d=>d.toLocaleDateString('sv-SE');
function isValidTime(s){if(!s)return false;const p=/^(\d{1,2}):(\d{2})$/.exec(s);if(!p)return false;const h=+p[1],m=+p[2];return h>=0&&h<=23&&m>=0&&m<=59;}
function isValidDateStr(s){if(!s)return false;const p=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!p)return false;const d=new Date(s+'T12:00:00');return d.getFullYear()==+p[1]&&d.getMonth()+1==+p[2]&&d.getDate()==+p[3];}
function formatShortDate(ymd){if(!ymd)return'';const p=ymd.split('-');if(p.length!==3)return ymd;return p[2]+'/'+p[1];}
function maskTime(el){let v=el.value.replace(/[^\d]/g,'');if(v.length>4)v=v.slice(0,4);if(v.length>=3){let h=parseInt(v.slice(0,2),10),m=parseInt(v.slice(2),10);if(h>23)h=23;if(v.length===4&&m>59)m=59;el.value=String(h).padStart(2,'0')+':'+v.slice(2);}else if(v.length>=1){el.value=v;}}
function maskDateBirth(el){let d=el.value.replace(/[^\d]/g,'').slice(0,8);if(d.length<=2)el.value=d;else if(d.length<=4)el.value=d.slice(0,2)+'-'+d.slice(2);else el.value=d.slice(0,2)+'-'+d.slice(2,4)+'-'+d.slice(4);}
function isoToBirthDisplay(iso){if(!iso||!isValidDateStr(iso))return'';const p=iso.split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function parseBirthDisplayToIso(s){const p=/^(\d{2})-(\d{2})-(\d{4})$/.exec((s||'').trim());if(!p)return null;const dd=+p[1],mm=+p[2],yy=+p[3];if(mm<1||mm>12||dd<1||dd>31)return null;const iso=yy+'-'+String(mm).padStart(2,'0')+'-'+String(dd).padStart(2,'0');return isValidDateStr(iso)?iso:null;}

/* ---- storage ---- */
function loadProfilesBlob(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch(e){return null;}}
function tryRepairBrokenProfilesBlob(){const raw=localStorage.getItem(PROFILE_KEY);if(!raw)return;try{JSON.parse(raw);}catch(e){try{localStorage.setItem(PROFILE_KEY+'_corrupt_'+Date.now(),raw);}catch(e2){}localStorage.removeItem(PROFILE_KEY);}}
function mergeFlatStorageIntoDefaultProfile(){try{const flatE=localStorage.getItem('nz3_entries');if(!flatE)return;const ent=JSON.parse(flatE);if(!Array.isArray(ent)||!ent.length)return;let blob=loadProfilesBlob();if(!blob)blob={};const id=localStorage.getItem(CUR_PROFILE)||'default';const slot=blob[id]||{entries:[],cfg:defaultCfg()};if((slot.entries||[]).length)return;slot.entries=ent.map(normalizeEntry).filter(Boolean);const oldC=localStorage.getItem('nz3_cfg');if(oldC)try{slot.cfg={...defaultCfg(),...slot.cfg,...JSON.parse(oldC)};}catch(e){}blob[id]=slot;localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));}catch(e){}}
function migrateToProfiles(){tryRepairBrokenProfilesBlob();mergeFlatStorageIntoDefaultProfile();const blob=loadProfilesBlob();if(blob)return;const oldE=localStorage.getItem('nz3_entries'),oldC=localStorage.getItem('nz3_cfg');let ent=[];try{ent=oldE?JSON.parse(oldE):[];}catch(e){ent=[];}if(!Array.isArray(ent))ent=[];let c=defaultCfg();try{if(oldC)c={...defaultCfg(),...JSON.parse(oldC)};}catch(e){}localStorage.setItem(PROFILE_KEY,JSON.stringify({default:{entries:ent,cfg:c}}));if(!localStorage.getItem(CUR_PROFILE))localStorage.setItem(CUR_PROFILE,'default');}
function currentProfileId(){return localStorage.getItem(CUR_PROFILE)||'default';}
function loadProfileIntoMemory(){migrateToProfiles();const id=currentProfileId(),blob=loadProfilesBlob();const slot=(blob&&blob[id])?blob[id]:{entries:[],cfg:defaultCfg()};entries=Array.isArray(slot.entries)?slot.entries:[];cfg={...defaultCfg(),...(slot.cfg||{})};migrateDataModel();}
function persistAll(){const id=currentProfileId();let blob=loadProfilesBlob()||{};const c={...defaultCfg(),...cfg};delete c.appName;blob[id]={entries:JSON.parse(JSON.stringify(entries)),cfg:c};localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));}
function save(){persistAll();}

function babyAgeMonths(){if(cfg.babyBirthDate&&isValidDateStr(cfg.babyBirthDate)){const b=new Date(cfg.babyBirthDate+'T12:00:00'),t=now();let m=(t.getFullYear()-b.getFullYear())*12+(t.getMonth()-b.getMonth());if(t.getDate()<b.getDate())m--;return Math.max(0,Math.min(48,Math.floor(m)));}return Math.max(0,Math.min(48,parseInt(cfg.months,10)||3));}
function dayBoundaryMins(){const s=(cfg.dayBoundary||'06:00');return isValidTime(s)?timeToMins(s):360;}
function nightStartMinsVal(){const s=cfg.nightStart||'18:00';return isValidTime(s)?timeToMins(s):1080;}
function isNightContextAtClock(mins){const dB=dayBoundaryMins(),ns=nightStartMinsVal();return mins>=ns||mins<dB;}
function isNightContextForClock(t){return isNightContextAtClock(timeToMins(t));}
function setSleepKind(e){if(!e||e.type!=='sleep')return e;e.sleepKind=isNightContextForClock(e.start)?'night':'nap';e.subtype=e.sleepKind==='night'?'night':'nap';return e;}
function sleepIsNight(e){return !!(e&&e.type==='sleep'&&isNightContextForClock(e.start));}
function normalizeEntry(raw){if(!raw||typeof raw!=='object')return null;const safe={...raw};safe.id=typeof safe.id==='number'?safe.id:Date.now()+Math.floor(Math.random()*1000);safe.date=isValidDateStr(safe.date)?safe.date:todayStr();let typ=typeof safe.type==='string'?safe.type:'sleep';if(typ==='unknown'){if(safe.start&&safe.end!=null)typ='sleep';else if(safe.subtype==='wet'||safe.subtype==='dirty'||safe.subtype==='both')typ='diaper';else if(safe.subtype==='breast'||safe.subtype==='bottle')typ='feed';else typ='sleep';}safe.type=typ;if(safe.type==='mood'&&safe.subtype==='cry')safe.subtype='crying';safe.start=isValidTime(safe.start)?safe.start:fmtTime(now());if(safe.end!=null&&!isValidTime(safe.end))safe.end=null;if(safe.durationMins!=null&&(!Number.isFinite(safe.durationMins)||safe.durationMins<0))safe.durationMins=null;if(safe.type==='sleep')setSleepKind(safe);return safe;}
function migrateDataModel(){cfg={...defaultCfg(),...(cfg||{})};delete cfg.appName;if(!Array.isArray(entries))entries=[];entries=entries.map(normalizeEntry).filter(Boolean);if((cfg.dataSchemaVersion||0)<APP_SCHEMA_VERSION){if(cfg.dataSchemaVersion<3)entries.forEach(e=>{if(e&&e.type==='sleep'){delete e.sleepKind;setSleepKind(e);}});cfg.dataSchemaVersion=APP_SCHEMA_VERSION;}if(!cfg.profileSetupDone&&(entries.length>0||(cfg.babyBirthDate&&isValidDateStr(cfg.babyBirthDate))))cfg.profileSetupDone=true;}
function profileNeedsSetup(){return!cfg.profileSetupDone;}

/* ---- sleep engine (dates) ---- */
function sleepStartDate(e){if(!e||!isValidTime(e.start))return null;const dateStr=e.date&&isValidDateStr(e.date)?e.date:todayStr();const d=new Date(dateStr+'T12:00:00');const[h,m]=e.start.split(':').map(Number);d.setHours(h,m,0,0);return d;}
function sleepEndDate(e){const dateStr=e.date&&isValidDateStr(e.date)?e.date:todayStr();const d=new Date(dateStr+'T12:00:00');const[h,m]=e.end.split(':').map(Number);d.setHours(h,m,0,0);if(timeToMins(e.end)<timeToMins(e.start))d.setDate(d.getDate()+1);return d;}
function gapMinutesBetweenSleeps(a,b){if(!a||!b||!a.end||!b.start)return 0;const tE=sleepEndDate(a),tS=sleepStartDate(b);if(!tE||!tS)return 0;const g=Math.round((tS-tE)/60000);return g>0&&g<720?g:0;}
const getActiveSleep=()=>entries.filter(e=>e.type==='sleep'&&!e.end).sort((a,b)=>b.id-a.id)[0]||null;
function sleepWakeCalendarDay(e){if(!e||e.type!=='sleep'||!e.end)return null;return fmtDateSV(sleepEndDate(e));}
function totalSleepMinsCalendarDay(ymd){let sum=0;entries.forEach(e=>{if(e.type!=='sleep'||!e.end||!e.durationMins)return;if(sleepIsNight(e)){if(sleepWakeCalendarDay(e)===ymd)sum+=e.durationMins;}else{if(e.date===ymd)sum+=e.durationMins;}});const a=getActiveSleep();if(a&&!a.end){const st=parseTimeOnDate(a.start,a.date);const cur=Math.max(0,Math.round((now()-st)/60000));if(sleepIsNight(a)){const wd=fmtDateSV(sleepEndDate({...a,end:fmtTime(now())}));if(wd===ymd)sum+=cur;}else if(a.date===ymd)sum+=cur;}return sum;}
function calendarDayEntries(ymd){return entries.filter(e=>{if(!e||!e.date)return false;if(e.type!=='sleep')return e.date===ymd;if(!e.end){const act=getActiveSleep();if(!act||act.id!==e.id)return false;if(!sleepIsNight(act))return act.date===ymd;return fmtDateSV(sleepEndDate({...act,end:fmtTime(now())}))===ymd;}if(sleepIsNight(e))return sleepWakeCalendarDay(e)===ymd;return e.date===ymd;});}
function nightSegmentsOnWakeDay(ymd){return entries.filter(e=>e.type==='sleep'&&sleepIsNight(e)&&e.end&&sleepWakeCalendarDay(e)===ymd).sort((a,b)=>sleepEndDate(a)-sleepEndDate(b));}
function nightWakeCountBetweenSegments(ymd){const segs=nightSegmentsOnWakeDay(ymd);if(segs.length<2)return 0;let c=0;for(let i=0;i<segs.length-1;i++){const g=gapMinutesBetweenSleeps(segs[i],segs[i+1]);if(g>0)c++;}return c;}
function analyzeLastCompleteNight(){const wakeDay=todayStr();const segs=nightSegmentsOnWakeDay(wakeDay);if(!segs.length)return null;const first=segs[0],last=segs[segs.length-1];const totalSleep=segs.reduce((a,e)=>a+(e.durationMins||0),0);const durs=segs.map(e=>e.durationMins||0).filter(x=>x>0);const blocks=durs.length;const maxBlock=blocks?Math.max(...durs):0;const minBlock=blocks>1?Math.min(...durs):(durs[0]||0);const wakes=Math.max(0,blocks-1);const gaps=[];for(let i=0;i<segs.length-1;i++){const g=gapMinutesBetweenSleeps(segs[i],segs[i+1]);if(g>0&&g<600)gaps.push(g);}const avgGap=gaps.length?Math.round(gaps.reduce((x,y)=>x+y,0)/gaps.length):0;return{bedYmd:first.date,bedClock:first.start,wakeYmd:wakeDay,wakeClock:last.end,totalSleep,blocks,wakes,maxBlock,minBlock,avgGap,segs};}
function getLastCompletedSleep(){const r=entries.filter(e=>e.type==='sleep'&&e.end);r.sort((a,b)=>sleepEndDate(b)-sleepEndDate(a));return r[0]||null;}
function getDaysWithData(){return[...new Set(entries.filter(e=>e.type==='sleep'&&e.durationMins).map(e=>e.date))].sort();}
const wwBaseTarget=m=>{if(m<=2)return 60;if(m<=4)return 90;if(m<=6)return 120;if(m<=9)return 150;if(m<=12)return 180;return 210;};
const wakeCountsAsDayForPredictions=lastSleepOrEnd=>{
  if(!lastSleepOrEnd)return false;
  if(typeof lastSleepOrEnd==='object'&&!lastSleepOrEnd.end)return false;
  return !isNightContextForClock(fmtTime(now()));
};
function getSleepEngineAdjustmentFromLastNight(){const an=analyzeLastCompleteNight();if(!an)return{napAdj:0,feedAdj:0,rangeAdj:0,label:''};let napAdj=0,feedAdj=0,rangeAdj=0;const bits=[];const months=babyAgeMonths();const tgtMin=(months<=3?8:months<=9?9:9.5)*60;if(an.totalSleep<tgtMin*0.78){napAdj+=8;feedAdj+=4;rangeAdj+=3;bits.push('débito de sono da noite');}if(an.wakes>=3){napAdj+=10;feedAdj+=5;rangeAdj+=5;bits.push('noite fragmentada');}if(an.blocks>=2&&an.minBlock<40){napAdj+=6;bits.push('blocos curtos');}return{napAdj:Math.min(28,napAdj),feedAdj:Math.min(18,feedAdj),rangeAdj:Math.min(14,rangeAdj),label:bits.join(' · ')};}
function sleepDebtNapAdjustment(){const an=analyzeLastCompleteNight();if(!an||!an.totalSleep)return 0;const months=babyAgeMonths();const tgtMin=(months<=3?8:months<=9?9:9.5)*60;const shortfall=Math.max(0,tgtMin-an.totalSleep);return shortfall<90?0:-Math.min(18,Math.floor(shortfall/90));}
function getHistoricalWakeWindows(limit=10){const sleeps=entries.filter(e=>e.type==='sleep'&&e.durationMins&&e.end).sort((a,b)=>sleepEndDate(a)-sleepEndDate(b));const w=[];for(let i=0;i<sleeps.length-1;i++){const g=gapMinutesBetweenSleeps(sleeps[i],sleeps[i+1]);if(g>0&&g<300)w.push(g);}return w.slice(-limit);}
function getTypicalNapTimes(limit=14){return entries.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e)).slice(-limit).map(e=>timeToMins(e.start));}
function getContextAdjust(){let na=0,fa=0,ra=0;if(cfg.ctxTeething){na+=10;fa+=5;ra+=5;}if(cfg.ctxCold){na+=15;fa+=10;ra+=8;}if(cfg.ctxVaccine){na+=10;fa+=5;ra+=5;}if(cfg.ctxTravel){na+=12;fa+=8;ra+=6;}if(cfg.ctxRegression){na+=15;fa+=10;ra+=8;}if(cfg.ctxOther){na+=8;fa+=5;ra+=4;}const n=getSleepEngineAdjustmentFromLastNight();na+=n.napAdj;fa+=n.feedAdj;ra+=n.rangeAdj;return{napAdj:Math.min(45,na),feedAdj:Math.min(35,fa),rangeAdj:Math.min(26,ra),nightLabel:n.label};}
function getRecentSignalCount(windowMin){const cut=now().getTime()-windowMin*60000;return entries.filter(e=>{if(e.type!=='mood'||!e.start||!e.date)return false;try{return parseTimeOnDate(e.start,e.date).getTime()>=cut;}catch{return false;}}).length;}
function getSignalPressure(){const s30=getRecentSignalCount(30),s90=getRecentSignalCount(90);const gasToday=calendarDayEntries(todayStr()).filter(e=>e.type==='mood'&&e.subtype==='gas').length;const gasBias=Math.min(8,gasToday*2);return{napBias:Math.min(20,s30*5+s90*2+gasBias),feedBias:Math.min(15,s30*4),rangeBias:Math.min(10,s90*2),hasSignals:(s90>0||gasToday>0)};}
function smartPredictNextNap(lastEnd,lastDur,todayTotal){const cx=getContextAdjust(),sp=getSignalPressure();const months=babyAgeMonths();const base=wwBaseTarget(months);const days=getDaysWithData().length;const phase=days<4?1:days<8?2:3;const hw=getHistoricalWakeWindows();const nt=getTypicalNapTimes();const endM=timeToMins(lastEnd);let durAdj=lastDur<30?-15:lastDur<45?-8:0;let debtAdj=todayTotal<base*0.9?-10:0;debtAdj+=sleepDebtNapAdjustment();let pw,range;if(phase===1||hw.length<3){pw=base+durAdj+debtAdj;range=20;}else if(phase===2){const ha=Math.round(hw.reduce((a,b)=>a+b,0)/hw.length);pw=Math.round(ha*0.6+base*0.4)+durAdj+debtAdj;range=15;}else{const ha=Math.round(hw.reduce((a,b)=>a+b,0)/hw.length);const hs=Math.round(Math.sqrt(hw.map(w=>(w-ha)**2).reduce((a,b)=>a+b,0)/hw.length));pw=Math.round(ha*0.8+base*0.2)+durAdj+debtAdj;range=Math.max(8,Math.min(20,hs));const rp=endM+pw;const nb=nt.filter(t=>Math.abs(t-rp)<40);if(nb.length>=2){const pa=Math.round(nb.reduce((a,b)=>a+b,0)/nb.length);pw+=Math.round((pa-rp)*0.3);}}pw=Math.max(30,pw)+cx.napAdj-sp.napBias;range=Math.min(45,range+cx.rangeAdj+sp.rangeBias);const c=endM+pw;const basisBits=[];basisBits.push(phase===1?'tabela da idade':phase===2?'histórico + idade':'padrão do bebê');if(cx.nightLabel)basisBits.push(cx.nightLabel);if(sp.hasSignals)basisBits.push('sinais recentes');return{center:minsToTime(c),from:minsToTime(c-range),to:minsToTime(c+range),basis:basisBits.join(' · '),phase,centerMin:c,range};}
function smartPredictNextFeed(lastStart){const cx=getContextAdjust(),sp=getSignalPressure();const months=babyAgeMonths();const base=months<=3?120:months<=6?150:180;const rf=entries.filter(e=>e.type==='feed').slice(-10);if(rf.length<4){const t=timeToMins(lastStart)+base+cx.feedAdj-sp.feedBias;return{center:minsToTime(t),from:minsToTime(t-20-cx.rangeAdj-sp.rangeBias),to:minsToTime(t+20+cx.rangeAdj+sp.rangeBias),basis:'tabela da idade',centerMin:t};}const sf=rf.sort((a,b)=>a.start>b.start?1:-1);const iv=[];for(let i=1;i<sf.length;i++){const d=timeToMins(sf[i].start)-timeToMins(sf[i-1].start);if(d>30&&d<300)iv.push(d);}if(!iv.length){const t=timeToMins(lastStart)+base+cx.feedAdj-sp.feedBias;return{center:minsToTime(t),from:minsToTime(t-20),to:minsToTime(t+20),basis:'tabela da idade',centerMin:t};}const ai=Math.round(iv.reduce((a,b)=>a+b,0)/iv.length);const bl=Math.round(ai*0.8+base*0.2);const t=timeToMins(lastStart)+bl+cx.feedAdj-sp.feedBias;const r=15+cx.rangeAdj+sp.rangeBias;return{center:minsToTime(t),from:minsToTime(t-r),to:minsToTime(t+r),basis:'intervalo médio do bebê',centerMin:t};}
function getTypicalNightStartMins(){const ns=entries.filter(e=>e.type==='sleep'&&e.durationMins&&sleepIsNight(e));if(!ns.length)return nightStartMinsVal();const mins=ns.slice(-30).map(e=>timeToMins(e.start)).sort((a,b)=>a-b);return mins[Math.floor(mins.length/2)];}
function nightStartPrediction(){const m=getTypicalNightStartMins();const cx=getContextAdjust();const r=Math.min(40,20+cx.rangeAdj);const basis=entries.filter(e=>e.type==='sleep'&&sleepIsNight(e)&&e.durationMins).length>=2?'horário típico da noite':'horário configurado';return{center:minsToTime(m),from:minsToTime(Math.max(0,m-r)),to:minsToTime(Math.min(1439,m+r)),basis,centerMin:m};}
function wwCurrentAwakeMinutes(){const last=getLastCompletedSleep();if(!last)return 0;return Math.max(0,Math.floor((now()-sleepEndDate(last))/60000));}
function wwCurrentTargetMinutes(){return wwBaseTarget(babyAgeMonths())+Math.min(25,getContextAdjust().napAdj);}
function getWakeRisk(minutesAwake,target){const r=target?minutesAwake/target:0;if(r<0.85)return{lvl:'low',msg:'dentro da janela'};if(r<1.1)return{lvl:'mid',msg:'próximo do limite'};return{lvl:'high',msg:'janela estourada'};}
/** Minutes until the next real-world occurrence of clock time `centerMin` (0–1439), crossing midnight when needed. */
function minutesUntilNextClock(centerMin,refDate){const d0=refDate instanceof Date?new Date(refDate.getTime()):new Date();const nowM=timeToMins(fmtTime(d0));let diff=centerMin-nowM;if(diff>0)return diff;const t=new Date(d0);t.setHours(0,0,0,0);const h=Math.floor(centerMin/60)%24,mm=centerMin%60;t.setHours(h,mm,0,0);if(t.getTime()<=d0.getTime())t.setDate(t.getDate()+1);return Math.max(0,Math.round((t.getTime()-d0.getTime())/60000));}
function formatTimeUntil(timeStr){return minutesUntilNextClock(timeToMins(timeStr),now());}
function dataMaturity(){const days=getDaysWithData().length;const sl=entries.filter(e=>e.type==='sleep'&&e.durationMins).length;const fd=entries.filter(e=>e.type==='feed').length;const score=Math.min(96,8+Math.min(34,days*5)+Math.min(28,sl*2)+Math.min(18,fd));if(!sl&&!fd)return{conf:'low',label:'Começando',score,hint:'Registre sono e mamadas por 2–3 dias e as faixas ficam bem mais suas.'};if(days<3||sl<4)return{conf:'low',label:'Calibrando',score,hint:'Cada soneca e cada noite gravada afinam o modelo.'};if(days<7)return{conf:'mid',label:'Afinando',score,hint:'Histórico + idade — as faixas estão apertando.'};return{conf:'high',label:'Firme',score,hint:'Base sólida — leituras mais assertivas.'};}

/* ==============================================
   RENDERERS
   ============================================== */
function applyTheme(){document.documentElement.setAttribute('data-theme',cfg.darkTheme?'dark':'light');const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',cfg.darkTheme?'#0B0A1A':'#F7F5FF');const ti=$('theme-icon');if(ti){ti.innerHTML=cfg.darkTheme?'<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';}}
function toggleTheme(){cfg.darkTheme=!cfg.darkTheme;save();applyTheme();syncSettingsForm();}
function applyThemeFromCheckbox(){cfg.darkTheme=$('cfg-dark-theme').checked;save();applyTheme();}

function updateHeader(){const name=cfg.name||'Bebê';const av=$('avatar');if(av)av.textContent=(name.charAt(0)||'N').toUpperCase();$('head-baby').textContent=name;const h=now().getHours();const greet=h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';$('head-greet').textContent=greet;$('head-age').textContent=babyAgeMonths()+' meses';}

/* ---- Onboarding ---- */
function syncOnboardingUI(){const ov=$('onboard');if(!ov)return;if(profileNeedsSetup()){ov.classList.add('open');ov.setAttribute('aria-hidden','false');const n=$('onb-name'),b=$('onb-birth');if(n)n.value=(cfg.name&&cfg.name!=='Bebê')?cfg.name:'';if(b)b.value=isoToBirthDisplay(cfg.babyBirthDate);}else{ov.classList.remove('open');ov.setAttribute('aria-hidden','true');}}
function submitBabyOnboarding(){const raw=($('onb-name')?.value||'').trim();if(!raw){showToast('Preciso do nome do bebê');return;}const bdv=$('onb-birth')?.value;if(bdv&&bdv.replace(/\D/g,'').length>0){const iso=parseBirthDisplayToIso(bdv);if(!iso){showToast('Data inválida — use DD-MM-AAAA');return;}cfg.babyBirthDate=iso;}else cfg.babyBirthDate='';cfg.name=raw.slice(0,48);cfg.profileSetupDone=true;save();syncOnboardingUI();updateHeader();syncSettingsForm();renderHome();showToast('Tudo pronto, '+raw.split(' ')[0]);}
function skipBabyOnboarding(){cfg.profileSetupDone=true;save();syncOnboardingUI();updateHeader();syncSettingsForm();renderHome();showToast('Você pode completar em Configurações');}

/* ---- Profiles ---- */
function refreshProfileSelect(){const sel=$('profile-select');if(!sel)return;const blob=loadProfilesBlob()||{};const ids=Object.keys(blob);sel.innerHTML=ids.map(i=>`<option value="${i}">${escHtml((blob[i].cfg&&blob[i].cfg.name)||i)}</option>`).join('');sel.value=currentProfileId();}
function switchProfile(id){persistAll();localStorage.setItem(CUR_PROFILE,id);loadProfileIntoMemory();applyTheme();refreshProfileSelect();syncSettingsForm();syncOnboardingUI();updateHeader();renderHome();showToast('Perfil trocado');}
function addNewProfile(){const n=prompt('Nome do novo bebê:');if(!n||!n.trim())return;persistAll();const slug='p'+Date.now();let blob=loadProfilesBlob()||{};blob[slug]={entries:[],cfg:{...defaultCfg(),name:n.trim(),profileSetupDone:false}};localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));localStorage.setItem(CUR_PROFILE,slug);loadProfileIntoMemory();applyTheme();refreshProfileSelect();syncSettingsForm();syncOnboardingUI();updateHeader();renderHome();showSec('home');showToast('Novo perfil criado');}
function deleteCurrentProfile(){const blob=loadProfilesBlob()||{};const ids=Object.keys(blob);if(ids.length<2){showToast('Só há um perfil');return;}if(!confirm('Excluir este perfil e todos os dados?'))return;persistAll();const id=currentProfileId();delete blob[id];localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));localStorage.setItem(CUR_PROFILE,Object.keys(blob)[0]);loadProfileIntoMemory();refreshProfileSelect();syncSettingsForm();syncOnboardingUI();updateHeader();renderHome();showToast('Perfil excluído');}

/* ---- Settings form ---- */
function syncSettingsForm(){$('cfg-name').value=cfg.name||'';$('cfg-birth-date').value=isoToBirthDisplay(cfg.babyBirthDate);$('months-auto-hint').textContent=cfg.babyBirthDate&&isValidDateStr(cfg.babyBirthDate)?'(automático)':'';$('cfg-months').value=cfg.months!=null?cfg.months:3;$('cfg-night-start').value=cfg.nightStart||'18:00';$('cfg-day-boundary').value=cfg.dayBoundary||'06:00';$('cfg-dark-theme').checked=!!cfg.darkTheme;$('cfg-late-night').checked=!!cfg.lateNightMode;$('cfg-remind-nap').checked=!!cfg.remindNap;$('cfg-remind-night').checked=!!cfg.remindNight;$('ctx-teething').checked=!!cfg.ctxTeething;$('ctx-cold').checked=!!cfg.ctxCold;$('ctx-vaccine').checked=!!cfg.ctxVaccine;$('ctx-travel').checked=!!cfg.ctxTravel;$('ctx-regression').checked=!!cfg.ctxRegression;$('ctx-other').checked=!!cfg.ctxOther;$('ctx-note').value=cfg.ctxNote||'';$('cfg-license-key').value=cfg.licenseToken||'';$('cfg-premium-local').checked=!!cfg.premiumUnlockLocal;$('cfg-license-api').value=localStorage.getItem('nz_license_api_base')||'';refreshProfileSelect();updatePremiumStatusText();}
function saveSettings(){const rawNm=($('cfg-name').value||'').trim();cfg.name=rawNm||'Bebê';if(rawNm&&rawNm!=='Bebê')cfg.profileSetupDone=true;const bdv=$('cfg-birth-date').value;const iso=parseBirthDisplayToIso(bdv);if(iso){cfg.babyBirthDate=iso;cfg.profileSetupDone=true;}else cfg.babyBirthDate='';cfg.months=Math.max(0,Math.min(36,parseInt($('cfg-months').value,10)||3));const ns=$('cfg-night-start').value;cfg.nightStart=isValidTime(ns)?ns:'18:00';const dbv=$('cfg-day-boundary').value;cfg.dayBoundary=isValidTime(dbv)?dbv:'06:00';cfg.lateNightMode=$('cfg-late-night').checked;cfg.darkTheme=$('cfg-dark-theme').checked;cfg.remindNap=$('cfg-remind-nap').checked;cfg.remindNight=$('cfg-remind-night').checked;cfg.ctxTeething=$('ctx-teething').checked;cfg.ctxCold=$('ctx-cold').checked;cfg.ctxVaccine=$('ctx-vaccine').checked;cfg.ctxTravel=$('ctx-travel').checked;cfg.ctxRegression=$('ctx-regression').checked;cfg.ctxOther=$('ctx-other').checked;cfg.ctxNote=($('ctx-note').value||'').slice(0,80);cfg.premiumUnlockLocal=$('cfg-premium-local').checked;const apiEl=$('cfg-license-api');if(apiEl){let u=(apiEl.value||'').trim();if(u&&!/^https?:\/\//i.test(u))u='https://'+u;localStorage.setItem('nz_license_api_base',u);}applyTheme();save();updateHeader();refreshProfileSelect();showToast('Salvo');renderHome();}
function applyPremiumLocalToggle(){cfg.premiumUnlockLocal=$('cfg-premium-local').checked;save();updatePremiumStatusText();renderHome();showToast(cfg.premiumUnlockLocal?'Premium liberado neste aparelho':'Gratuito');}

/* ---- Premium ---- */
function getPremiumState(){if(cfg.premiumUnlockLocal)return{tier:'lifetime',source:'local'};const nowDt=new Date();if(cfg.licenseTier==='lifetime')return{tier:'lifetime',source:'license'};if(cfg.licenseExpiresAt&&new Date(cfg.licenseExpiresAt)>nowDt&&cfg.licenseTier)return{tier:'premium',source:'license'};if(cfg.premiumState==='trial'&&cfg.trialStart){const el=Math.floor((nowDt-new Date(cfg.trialStart))/(24*3600000));const left=Math.max(0,7-el);if(left>0)return{tier:'trial',source:'trial',trialDaysLeft:left};cfg.premiumState='locked';save();}if(cfg.premiumState==='locked'||cfg.trialUsedAt)return{tier:'free',source:'trial_ended'};return{tier:'free',source:'free'};}
function canUsePremiumFeatures(){return getPremiumState().tier!=='free';}
function updatePremiumStatusText(){const st=getPremiumState(),el=$('premium-status');if(!el)return;if(st.source==='local'){el.textContent='Liberado localmente neste aparelho.';return;}if(st.tier==='lifetime'){el.textContent='Vitalício ativo por chave.';return;}if(st.tier==='premium'){el.textContent='Premium ativo.';return;}if(st.tier==='trial'){el.textContent=`Teste grátis: ${st.trialDaysLeft} dia(s) restante(s).`;return;}if(st.source==='trial_ended'){el.textContent='Teste grátis já utilizado.';return;}el.textContent='Plano gratuito.';}
function startPremiumTrial(){const st=getPremiumState();if(st.tier!=='free'){showToast('Plano ativo já existente');return;}if(cfg.trialUsedAt){showToast('Teste já utilizado');return;}cfg.premiumState='trial';cfg.trialStart=new Date().toISOString();cfg.trialUsedAt=cfg.trialStart;save();syncSettingsForm();renderHome();showToast('7 dias liberados');}
function getLicenseApiBase(){return(localStorage.getItem('nz_license_api_base')||'').replace(/\/$/,'');}
function getOrCreateDeviceId(){const k='nz_device_id_v1';let id=localStorage.getItem(k);if(!id){id='dev-'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,id);}return id;}
async function activateLicenseKey(){const code=($('cfg-license-key').value||'').trim();if(!code){showToast('Cole a chave primeiro');return;}const base=getLicenseApiBase();if(!base){showToast('Configure a URL do servidor primeiro');return;}try{const res=await fetch(base+'/api/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,device_id:getOrCreateDeviceId()})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||('HTTP '+res.status));cfg.licenseToken=code;cfg.licenseTier=data.tier;cfg.licenseExpiresAt=data.expires_at||null;save();syncSettingsForm();renderHome();showToast(data.tier==='lifetime'?'Vitalício ativado':'Premium ativado');}catch(err){showToast('Falha: '+String(err.message||err));}}

/* ---- ORBITAL HERO ---- */
function buildOrbitNodes(){const ymd=todayStr();const today=calendarDayEntries(ymd);const nodes=[];const boundary=dayBoundaryMins(),nightSt=nightStartMinsVal();today.filter(e=>e.type==='sleep').forEach(e=>{const m=timeToMins(e.start);nodes.push({type:'sleep',icon:'moon',time:e.start,mins:m,isNight:sleepIsNight(e)});});today.filter(e=>e.type==='feed').slice(-2).forEach(e=>{nodes.push({type:'feed',icon:'bottle',time:e.start,mins:timeToMins(e.start)});});return nodes;}
function renderOrbit(){
  const wrap=$('orbit-wrap');if(!wrap)return;
  const kicker=$('orbit-kicker'),main=$('orbit-main'),sub=$('orbit-sub'),ctaLbl=$('orbit-cta-label'),cta=$('orbit-cta');
  const active=getActiveSleep();
  const last=getLastCompletedSleep();
  const today=calendarDayEntries(todayStr());
  const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);

  // Decide what the center shows
  let title='',subText='',ctaText='Registrar agora',ctaFn='log';
  let predObj=null;
  if(active){
    // Sleeping right now
    const st=parseTimeOnDate(active.start,active.date);
    const mins=Math.max(0,Math.round((now()-st)/60000));
    kicker.textContent=sleepIsNight(active)?'Noite em curso':'Soneca em curso';
    title='<span>'+fmtDurShort(mins).replace(/^(\d+h)/, '$1 ').replace(/^(\d+m)$/, '$1')+'</span>';
    main.innerHTML=fmtDurShort(mins).split('h').length>1 ? `${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>` : `${mins}<small>min</small>`;
    sub.textContent='Dormiu às '+active.start+' · toque em Acordou quando despertar.';
    ctaLbl.textContent='Acordou agora';
    cta.dataset.action='wake';
    cta.onclick=()=>{babyWoke();};
  }else if(isNightContextForClock(fmtTime(now()))){
    // Inside the physiological night window — suggest night sleep, don't predict it as far away
    const mSinceLast=last?Math.max(0,Math.floor((now()-sleepEndDate(last))/60000)):null;
    kicker.textContent='Janela noturna';
    main.innerHTML='<span class="serif" style="font-size:36px;line-height:1.1">Hora de dormir</span>';
    sub.textContent=mSinceLast!=null?'Desperto há '+fmtDur(mSinceLast)+'. Toque em Dormiu quando adormecer.':'Início da noite foi às '+(cfg.nightStart||'18:00')+'. Toque em Dormiu quando adormecer.';
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else if(last&&wakeCountsAsDayForPredictions(last)){
    // Daytime — show next nap (if manual end time pushed prediction into the past, don't fake a ~24h countdown)
    const p=smartPredictNextNap(last.end,last.durationMins||0,ts);
    const fallsNight=timeToMins(p.center)>=nightStartMinsVal();
    predObj=fallsNight?nightStartPrediction():p;
    const nowM=timeToMins(fmtTime(now()));
    const toM=predObj.to!=null?timeToMins(p.to):null;
    const overdueNap=!fallsNight&&toM!=null&&nowM>toM;
    const mins=formatTimeUntil(predObj.center);
    if(overdueNap){
      const late=Math.min(24*60,nowM-toM);
      kicker.textContent='Soneca em atraso';
      main.innerHTML=late<60?`${late}<small>min</small>`:`${Math.floor(late/60)}<small>h</small> ${String(late%60).padStart(2,'0')}<small>min</small>`;
      sub.textContent='Depois da faixa '+predObj.from+'–'+predObj.to+' · '+predObj.basis;
    }else{
      kicker.textContent=fallsNight?'Rotina da noite em':'Próxima soneca em';
      main.innerHTML=mins<60?`${mins}<small>min</small>`:`${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>`;
      sub.textContent='Faixa provável '+predObj.from+'–'+predObj.to+' · '+predObj.basis;
    }
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else if(last){
    // Daytime (sleep ended during day) but outside active-nap logic — show night routine
    const p=nightStartPrediction();
    predObj=p;
    const mins=formatTimeUntil(p.center);
    kicker.textContent='Rotina da noite em';
    main.innerHTML=mins<60?`${mins}<small>min</small>`:`${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>`;
    sub.textContent='Janela típica '+p.from+'–'+p.to+' · '+p.basis;
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else{
    // No data yet
    kicker.textContent='Bem-vindo';
    main.innerHTML='—';
    sub.textContent='Registre o primeiro sono para começarmos a aprender o ritmo.';
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }

  // Orbit arc (progress of awake window)
  const arc=$('orbit-arc');
  if(arc){
    const R=120,CX=150,CY=150;
    let pct=0;
    if(active){pct=Math.min(1,Math.round((now()-parseTimeOnDate(active.start,active.date))/60000)/60);}
    else if(last&&wakeCountsAsDayForPredictions(last)){const aw=wwCurrentAwakeMinutes();const tgt=wwCurrentTargetMinutes();pct=Math.min(1.1,aw/tgt);}
    const theta=-Math.PI/2+pct*Math.PI*2;
    const x=CX+R*Math.cos(theta),y=CY+R*Math.sin(theta);
    const large=pct>0.5?1:0;
    arc.setAttribute('d',pct>0.01?`M ${CX} ${CY-R} A ${R} ${R} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`:'');
  }

  // Orbit nodes (sleeps/feeds of today plotted on circle by time)
  const host=$('orbit-nodes');if(host){
    const ymd=todayStr();
    const items=[];
    const push=(icon,time,mins,active,subLbl,tone)=>items.push({icon,time,mins,active,subLbl,tone});
    today.filter(e=>e.type==='sleep').forEach(e=>{push('moon',e.start,timeToMins(e.start),false,sleepIsNight(e)?'noite':'soneca','sleep');});
    today.filter(e=>e.type==='feed').slice(-3).forEach(e=>{push('feed',e.start,timeToMins(e.start),false,'mamada','feed');});
    if(predObj){push(predObj===nightStartPrediction()?'moon':'sun',predObj.center,predObj.centerMin,true,'próxima','next');}
    const nowM=timeToMins(fmtTime(now()));
    // Map mins (0-1439) -> angle on circle. Use a 12h window centered on NOW.
    const win=12*60;const start=nowM-win/2;
    const html=items.map(it=>{
      let rel=it.mins-start;while(rel<0)rel+=1440;while(rel>=1440)rel-=1440;
      if(rel>win)return '';
      const theta=-Math.PI/2+(rel/win)*Math.PI*2;
      const R=125;
      const x=50+(R/3)*Math.cos(theta),y=50+(R/3)*Math.sin(theta);
      const icon=it.icon==='moon'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>':it.icon==='sun'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6z"/></svg>';
      return `<div class="orbit-node ${it.active?'active':''}" style="left:${50+(Math.cos(theta)*42)}%;top:${50+(Math.sin(theta)*42)}%">
        <div class="on-dot">${icon}</div>
        <div class="on-time">${escHtml(it.time)}</div>
      </div>`;
    }).join('');
    host.innerHTML=html;
  }

  // Twinkle stars
  const stars=document.querySelector('.orbit-stars');
  if(stars&&!stars.dataset.rendered){stars.dataset.rendered='1';let s='';for(let i=0;i<28;i++){const x=Math.random()*100,y=Math.random()*100,d=Math.random()*3;s+=`<span style="left:${x}%;top:${y}%;animation-delay:${d}s"></span>`;}stars.innerHTML=s;}
}

/* ---- Status cards ---- */
function renderStatusRow(){
  const host=$('status-row');if(!host)return;
  const lastSleep=getLastCompletedSleep();
  const lastFeed=entries.filter(e=>e.type==='feed').sort((a,b)=>{const da=new Date(a.date+'T12:00:00'),db=new Date(b.date+'T12:00:00');return db-da||timeToMins(b.start)-timeToMins(a.start);})[0];
  let sleepHtml='<div class="status-card" style="--tone:var(--c-sleep)"><div class="sc-label">Último sono</div><div class="sc-main">—</div><div class="sc-sub">Sem registros ainda.</div></div>';
  if(lastSleep){const mSince=Math.max(0,Math.round((now()-sleepEndDate(lastSleep))/60000));sleepHtml=`<div class="status-card" style="--tone:var(--c-sleep)"><div class="sc-label">${sleepIsNight(lastSleep)?'Última noite':'Última soneca'}</div><div class="sc-main">${fmtDurShort(lastSleep.durationMins||0)}</div><div class="sc-sub">Acordou há ${fmtDur(mSince)} · ${lastSleep.start} → ${lastSleep.end||'—'}</div></div>`;}
  let feedHtml='<div class="status-card" style="--tone:var(--c-feed)"><div class="sc-label">Última mamada</div><div class="sc-main">—</div><div class="sc-sub">Toque no + para registrar.</div></div>';
  if(lastFeed){const since=Math.max(0,Math.round((now()-parseTimeOnDate(lastFeed.start,lastFeed.date))/60000));feedHtml=`<div class="status-card" style="--tone:var(--c-feed)"><div class="sc-label">Última mamada</div><div class="sc-main">${fmtDurShort(since)}</div><div class="sc-sub">${escHtml(lastFeed.subtype==='breast'?'Seio':'Mamadeira')} · ${lastFeed.start}${lastFeed.durationMins?' · '+lastFeed.durationMins+'min':''}</div></div>`;}
  host.innerHTML=sleepHtml+feedHtml;
}

/* ---- Insight ---- */
function buildDayFlowRead(){const ymd=todayStr(),td=calendarDayEntries(ymd);const naps=td.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e));const napMin=naps.reduce((a,e)=>a+(e.durationMins||0),0);const late=naps.filter(e=>timeToMins(e.start)>=nightStartMinsVal()-90);const feeds=td.filter(e=>e.type==='feed').length,di=td.filter(e=>e.type==='diaper').length;const mo=td.filter(e=>e.type==='mood').length;const g=calendarDayEntries(ymd).filter(e=>e.type==='mood'&&e.subtype==='gas').length;let flow='O dia ainda está no começo para termos uma leitura robusta.';let tone='neutral';if(naps.length>=1){if(naps.length>=4||(napMin<90&&naps.length>=2)){flow='Dia <strong>fragmentado</strong>: várias sonecas curtas. Espere humor mais sensível à tarde.';tone='warn';}else if(late.length){flow='Houve <strong>soneca tardia</strong> (perto da noite). A entrada na noite pode atrasar.';tone='warn';}else if(napMin>=90){flow='Boa <strong>base de descanso</strong> de dia — o motor abre a janela com mais folga.';tone='ok';}else{flow='Dia <strong>no ritmo</strong> para o que foi registrado até agora.';tone='ok';}}const bot=naps.length>=4?'Sonecas muitas e curtas — consolide a próxima.':(late.length?'Soneca perto do horário da noite — cuidado com o atraso.':(g>=3?'Muitos sinais de gases — pode puxar a próxima janela pra menos.':(feeds<2&&naps.length>0&&babyAgeMonths()<=3?'Poucas mamadas para o tamanho do dia.':'Sem gargalo óbvio agora.')));return{flow,bot,tone,stats:{napMin,feeds,di,mo,naps:naps.length}};}
function renderInsight(){const host=$('home-insight');if(!host)return;const d=buildDayFlowRead();const chipCls=d.tone==='warn'?'warn':d.tone==='ok'?'ok':'';host.innerHTML=`<div class="insight"><div class="insight-kicker">Leitura do dia</div><div class="insight-title">${d.flow}</div><div class="insight-body"><strong>Atenção:</strong> ${escHtml(d.bot)}</div><div class="insight-chip ${chipCls}">${d.stats.naps} sonecas · ${d.stats.feeds} mamadas · ${d.stats.di} fraldas</div></div>`;}

/* ---- Predictions list ---- */
function renderPredictions(){
  const list=$('pred-list'),badge=$('home-conf-badge');if(!list)return;
  const dm=dataMaturity();if(badge){badge.textContent=dm.label;badge.style.color=dm.conf==='high'?'var(--mint)':dm.conf==='mid'?'var(--sun)':'var(--lilac)';}
  const today=calendarDayEntries(todayStr());
  const activeSleep=getActiveSleep();
  const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);
  const lastSleep=getLastCompletedSleep();
  const nsM=nightStartMinsVal();
  const preds=[];
  const insideNight=isNightContextForClock(fmtTime(now()));
  if(activeSleep){
    preds.push({kind:'sleep-now',name:sleepIsNight(activeSleep)?'Noite em andamento':'Soneca em andamento',sub:'Registre Acordou quando despertar',pred:{center:activeSleep.start,from:activeSleep.start,to:activeSleep.start,basis:'sono ativo'},color:sleepIsNight(activeSleep)?'#6366F1':'#A78BFA'});
  }else if(insideNight){
    preds.push({kind:'night-now',name:'Janela noturna ativa',sub:'Toque em Dormiu quando adormecer',pred:{center:cfg.dayBoundary||'06:00',from:cfg.nightStart||'18:00',to:cfg.dayBoundary||'06:00',basis:'janela fisiológica configurada'},color:'#6366F1'});
  }else if(lastSleep&&lastSleep.end){
    if(wakeCountsAsDayForPredictions(lastSleep)){
      const p=smartPredictNextNap(lastSleep.end,lastSleep.durationMins||0,ts);
      if(timeToMins(p.center)>=nsM){const np=nightStartPrediction();preds.push({kind:'night',name:'Entrada da noite',sub:'Primeiro sono longo',pred:np,color:'#6366F1'});}
      else{preds.push({kind:'nap',name:'Próxima soneca',sub:'A partir do último despertar',pred:p,color:'#A78BFA'});const np=nightStartPrediction();preds.push({kind:'night',name:'Rotina da noite',sub:'Hora de desacelerar',pred:np,color:'#6366F1'});}
    }else{const np=nightStartPrediction();preds.push({kind:'night',name:'Rotina da noite',sub:'Fim do dia se aproximando',pred:np,color:'#6366F1'});}
  }
  const lf=today.filter(e=>e.type==='feed').sort((a,b)=>timeToMins(b.start)-timeToMins(a.start))[0]||entries.filter(e=>e.type==='feed').sort((a,b)=>b.id-a.id)[0];
  if(lf){const p=smartPredictNextFeed(lf.start);preds.push({kind:'feed',name:'Próxima mamada',sub:insideNight?'Noturna — bebês pequenos ainda mamam de madrugada':'Ritmo dos últimos intervalos',pred:p,color:'#22D3EE'});}
  let listHtml;
  if(!preds.length){listHtml='<div class="empty-pretty"><h4>Vamos começar a medir</h4><p>Registre um sono com início e fim, e uma mamada. A próxima janela aparece aqui com faixa e motivo.</p></div>';}
  else{const iconSvg={sleep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',nap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg>',night:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6zM10 11h4"/></svg>'};
  listHtml=preds.map(p=>{
    const risk=p.kind==='nap'?getWakeRisk(wwCurrentAwakeMinutes(),wwCurrentTargetMinutes()):null;
    const ico=iconSvg[p.kind==='night-now'?'night':p.kind==='sleep-now'?'sleep':p.kind]||iconSvg.nap;
    let right;
    if(p.kind==='night-now'||p.kind==='sleep-now'){
      right=`<div class="pclock" style="font-size:16px">agora</div><div class="prange">desperta ~${escHtml(p.pred.center)}</div>`;
    }else{
      const nowM=timeToMins(fmtTime(now())),centerM=timeToMins(p.pred.center);
      let diff=centerM-nowM;if(diff<0)diff+=1440;
      const nowDay=nowM>=dayBoundaryMins()&&nowM<nightStartMinsVal();
      const centerDay=centerM>=dayBoundaryMins()&&centerM<nightStartMinsVal();
      const overdueMin=(nowDay&&centerDay&&centerM<nowM)?(nowM-centerM):0;
      const timeLbl=overdueMin>0?`<span style="color:var(--rose)">atrasada ~${overdueMin} min</span>`:`em ${diff} min · ${escHtml(p.pred.from)}–${escHtml(p.pred.to)}`;
      right=`<div class="pclock">${escHtml(p.pred.center)}</div><div class="prange">${timeLbl}</div>`;
    }
    return `<div class="pred-row" style="--pcol:${p.color}"><div class="pico">${ico}</div><div class="pmid"><div class="pname">${escHtml(p.name)}</div><div class="psub">${escHtml(p.sub)}</div><div class="pbase">${escHtml(p.pred.basis||'')}</div>${risk?`<span class="risk ${risk.lvl}">${escHtml(risk.msg)}</span>`:''}</div><div class="ptime">${right}</div></div>`;
  }).join('');}
  list.innerHTML=listHtml;
}

/* ---- Glance ---- */
function renderGlance(){const host=$('glance');if(!host)return;const ymd=todayStr();const td=calendarDayEntries(ymd);const total=totalSleepMinsCalendarDay(ymd);const html=`<div class="glance-cell" data-tone="sleep"><div class="glance-val">${fmtDurShort(total)}</div><div class="glance-lbl">Sono</div></div><div class="glance-cell" data-tone="feed"><div class="glance-val">${td.filter(e=>e.type==='feed').length}</div><div class="glance-lbl">Mamadas</div></div><div class="glance-cell" data-tone="diaper"><div class="glance-val">${td.filter(e=>e.type==='diaper').length}</div><div class="glance-lbl">Fraldas</div></div><div class="glance-cell" data-tone="night"><div class="glance-val">${nightWakeCountBetweenSegments(ymd)}</div><div class="glance-lbl">Despertares</div></div>`;host.innerHTML=html;}

/* ---- Night panel ---- */
function renderNightPanel(){const host=$('night-panel-wrap');if(!host)return;const an=analyzeLastCompleteNight();const ymd=todayStr();const segs=nightSegmentsOnWakeDay(ymd);if(!segs.length){host.innerHTML='';return;}const first=segs[0],last=segs[segs.length-1];const total=segs.reduce((a,e)=>a+(e.durationMins||0),0);const waves=[];for(let i=0;i<segs.length;i++){waves.push(`<span class="nseg-pill sl">${fmtDurShort(segs[i].durationMins||0)}</span>`);if(i<segs.length-1){const g=gapMinutesBetweenSleeps(segs[i],segs[i+1]);if(g)waves.push(`<span class="nseg-pill aw">↑ ${fmtDurShort(g)}</span>`);}}const wakes=an?an.wakes:Math.max(0,segs.length-1);const html=`<div class="night-panel"><div class="night-head"><span class="nh-kicker">Noite — referência principal</span><span class="nh-range">${first.start} → ${last.end||'—'}</span></div><div class="night-metrics"><div class="night-metric"><div class="night-metric-val">${fmtDurShort(total)}</div><div class="night-metric-lbl">Total</div></div><div class="night-metric"><div class="night-metric-val">${segs.length}</div><div class="night-metric-lbl">Trechos</div></div><div class="night-metric"><div class="night-metric-val">${wakes}</div><div class="night-metric-lbl">Despertares</div></div></div><div class="night-segs">${waves.join('')}</div><p class="night-foot">A noite não reseta na meia-noite — começa no primeiro sono após ${cfg.nightStart} e fecha quando o bebê acorda de manhã.</p></div>`;host.innerHTML=html;}

/* ---- Today rail (horizontal timeline) ---- */
function renderTodayRail(){const host=$('today-rail'),count=$('today-rail-count');if(!host)return;const ymd=todayStr();const ev=calendarDayEntries(ymd).slice().sort((a,b)=>{const ta=a.start||'00:00',tb=b.start||'00:00';return timeToMins(ta)-timeToMins(tb);});if(count)count.textContent=ev.length+' eventos';let inner;if(!ev.length){inner='<div class="trail-empty">Nenhum registro hoje ainda — toque em + para começar.</div>';}else{const tone={sleep:'#A78BFA',feed:'#22D3EE',diaper:'#F59E0B',mood:'#F472B6'};const icon={sleep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6z"/></svg>',diaper:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3c-2 4-6 7-6 11a6 6 0 0012 0c0-4-4-7-6-11z"/></svg>',mood:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/></svg>'};inner='<div class="trail-track"></div><div class="trail-items">'+ev.map(e=>{const t=e.type;const dur=e.type==='sleep'&&e.durationMins?fmtDurShort(e.durationMins):'';return `<div class="trail-chip" style="--tone:${tone[t]||'#A78BFA'}"><span class="tc-ico">${icon[t]||icon.sleep}</span><span class="tc-time">${escHtml(e.start||'—')}</span>${dur?`<span class="tc-dur">${escHtml(dur)}</span>`:''}</div>`;}).join('')+'</div>';}host.innerHTML=inner;}

/* ---- COPILOT ---- */
function moodCountToday(sub){return calendarDayEntries(todayStr()).filter(e=>e.type==='mood'&&e.subtype===sub).length;}
function renderCopilot(){
  const dm=dataMaturity();
  const hero=$('cop-hero');if(hero){hero.innerHTML=`<div class="ch-kick">Copiloto</div><h2 class="ch-title">${dm.score<35?'Está começando a entender o bebê':dm.score<65?'Já estou lendo padrões':'Leitura firme do seu ritmo'}</h2><p class="ch-sub">${escHtml(dm.hint)}</p><div class="ch-meter"><div class="ch-fill" style="width:${dm.score}%"></div></div><div class="ch-chips"><span class="cop-chip">${dm.label}</span><span class="cop-chip">${getDaysWithData().length} dias · ${entries.filter(e=>e.type==='sleep'&&e.durationMins).length} sonos</span><span class="cop-chip">${babyAgeMonths()} meses</span></div>`;}

  // Agora
  const now_=$('cop-now');if(now_){const active=getActiveSleep();const last=getLastCompletedSleep();let title,body,rule=[];if(active){title=sleepIsNight(active)?'Sono noturno em curso':'Soneca em curso';body=`Dormiu às <strong>${active.start}</strong>. Quando acordar, registre em Acordou — a noite lógica continua depois da meia-noite se for o caso.`;}else if(last&&wakeCountsAsDayForPredictions(last)){const aw=wwCurrentAwakeMinutes();const tgt=wwCurrentTargetMinutes();const r=getWakeRisk(aw,tgt);const p=smartPredictNextNap(last.end,last.durationMins||0,calendarDayEntries(todayStr()).filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0));title=r.lvl==='high'?'Janela estourando':r.lvl==='mid'?'Janela apertando':'Dentro da janela';body=`Acordado há <strong>${fmtDur(aw)}</strong>, referência ~${tgt} min para ${babyAgeMonths()} meses. Próxima soneca prevista em torno de <strong>${p.center}</strong>.`;rule=[['Acordado',fmtDur(aw)],['Alvo aprox.',tgt+' min'],['Risco',r.msg]];}else{title='Sem janela diurna agora';body='Ou o bebê está dormindo, ou ainda estamos no ritmo noturno.';}now_.innerHTML=`<div class="cop-block"><div class="cb-kicker">Agora</div><h4>${escHtml(title)}</h4><p>${body}</p>${rule.length?'<ul class="cb-rule">'+rule.map(r=>`<li><span>${escHtml(r[0])}</span><strong>${escHtml(r[1])}</strong></li>`).join('')+'</ul>':''}</div>`;}

  // Próxima janela
  const winEl=$('cop-window');if(winEl){const last=getLastCompletedSleep();const today=calendarDayEntries(todayStr());const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);if(!last){winEl.innerHTML='';}else{let p,label;if(wakeCountsAsDayForPredictions(last)){const np=smartPredictNextNap(last.end,last.durationMins||0,ts);if(timeToMins(np.center)>=nightStartMinsVal()){p=nightStartPrediction();label='Entrada da noite';}else{p=np;label='Próxima soneca';}}else{p=nightStartPrediction();label='Rotina da noite';}const nowM=timeToMins(fmtTime(now()));const napOver=label==='Próxima soneca'&&p.to!=null&&nowM>timeToMins(p.to);const mins=formatTimeUntil(p.center);const head=napOver?(`${escHtml(label)} · atrasada ~${fmtDur(nowM-timeToMins(p.to))}`):(`${escHtml(label)} em ${mins} min`);winEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Próxima janela</div><h4>${head}</h4><p>Faixa provável <strong>${escHtml(p.from)}–${escHtml(p.to)}</strong>. Base: ${escHtml(p.basis)}.</p><ul class="cb-rule"><li><span>Hora central</span><strong>${escHtml(p.center)}</strong></li><li><span>Tolerância</span><strong>±${p.range||20} min</strong></li></ul><p style="margin-top:10px;font-size:11.5px;color:var(--ink-muted)">Se atrasar muito além da faixa, a próxima soneca tende a ficar curta e a noite pode fragmentar.</p></div>`;}}

  // Leitura do dia
  const dayEl=$('cop-day');if(dayEl){const d=buildDayFlowRead();dayEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Leitura do dia</div><h4>${d.tone==='warn'?'Sinais de atenção':d.tone==='ok'?'Dia fluindo bem':'Dia sem muita sinalização'}</h4><p>${d.flow}</p><p style="margin-top:8px"><strong>Gargalo provável:</strong> ${escHtml(d.bot)}</p><ul class="cb-rule"><li><span>Sonecas</span><strong>${d.stats.naps}</strong></li><li><span>Sono diurno</span><strong>${fmtDur(d.stats.napMin)}</strong></li><li><span>Mamadas</span><strong>${d.stats.feeds}</strong></li><li><span>Sinais de humor</span><strong>${d.stats.mo}</strong></li></ul></div>`;}

  // Leitura da noite
  const nEl=$('cop-night');if(nEl){const an=analyzeLastCompleteNight();if(!an){nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>Nenhuma noite fechada ainda</h4><p>Registre <strong>Acordou</strong> de manhã para o Copiloto calcular total, despertares e maior bloco.</p></div>`;}else{const wq=an.wakes===0?'Noite contínua — ótima referência para o dia.':an.wakes>=3?'Noite fragmentada — pressão extra hoje.':'Noite dentro do comum para a idade.';nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>${fmtDur(an.totalSleep)} em ${an.blocks} trecho(s)</h4><p>${wq} Maior bloco <strong>${fmtDur(an.maxBlock)}</strong>.</p><ul class="cb-rule"><li><span>Início</span><strong>${escHtml(an.bedClock)}</strong></li><li><span>Despertar final</span><strong>${escHtml(an.wakeClock)}</strong></li><li><span>Despertares intermediários</span><strong>${an.wakes}</strong></li><li><span>Média entre trechos</span><strong>${an.avgGap?fmtDur(an.avgGap):'—'}</strong></li></ul></div>`;}}

  // Interpretação de choro (ranking)
  const cryEl=$('cop-cry');if(cryEl){cryEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Interpretação de choro</div><h4>O que pode estar acontecendo?</h4><p>Toque no contexto mais recente para ver o ranking — fome, cansaço, gases, desconforto e estímulo ponderados pelos seus registros.</p><div class="cb-actions"><button class="cop-pill primary" onclick="runCryDiagnosis()">Calcular agora</button></div><div id="cry-out" style="margin-top:12px"></div></div>`;}

  // Simulações
  const simEl=$('cop-sim');if(simEl){simEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Simulações</div><h4>E se eu…</h4><p>Rápidas projeções com base na idade e no que foi registrado.</p><div class="cb-actions"><button class="cop-pill" onclick="runSim('skipNap')">Pular soneca</button><button class="cop-pill" onclick="runSim('lateNap')">Atrasar soneca</button><button class="cop-pill" onclick="runSim('earlyNight')">Noite mais cedo</button><button class="cop-pill" onclick="runSim('shortFeed')">Mamada curta</button></div><div id="sim-out" style="margin-top:12px;padding:12px;border-radius:var(--r-sm);background:var(--surface-1);font-size:12.5px;color:var(--ink-dim);line-height:1.55;display:none"></div></div>`;}
}

function runCryDiagnosis(){
  const out=$('cry-out');if(!out)return;
  const mAge=babyAgeMonths(),tgt=wwBaseTarget(mAge);
  const lastFeed=entries.filter(e=>e.type==='feed').sort((a,b)=>{const da=new Date(a.date+'T12:00:00'),db=new Date(b.date+'T12:00:00');return db-da||timeToMins(b.start)-timeToMins(a.start);})[0];
  const lastSleep=getLastCompletedSleep();
  const feedM=lastFeed?Math.max(0,Math.round((now()-parseTimeOnDate(lastFeed.start,lastFeed.date))/60000)):999;
  const sleepM=lastSleep?Math.max(0,Math.floor((now()-sleepEndDate(lastSleep))/60000)):999;
  const gas=moodCountToday('gas'),fuss=moodCountToday('fussy'),cry=moodCountToday('crying');
  const feedRaw=lastFeed?Math.min(80,5+Math.max(0,feedM-45)*0.4+(feedM>150?25:0)):8;
  const sleepRaw=lastSleep&&wakeCountsAsDayForPredictions(lastSleep)?Math.min(85,8+Math.max(0,sleepM-tgt*0.75)*0.45+(lastSleep.durationMins<35?12:0)):6;
  const gasRaw=Math.min(55,4+gas*12+fuss*5);
  const coldBias=(cfg.ctxCold||cfg.ctxTeething||cfg.ctxOther)?10:0;
  const disRaw=12+coldBias+Math.min(18,cry*3);
  const overRaw=8+fuss*4;
  const h=[{k:'Fome',s:feedRaw,hint:lastFeed?feedM+' min desde a última mamada':'sem mamada registrada'},{k:'Cansaço',s:sleepRaw,hint:lastSleep?'acordado há '+sleepM+' min':'—'},{k:'Gases / barriga',s:gasRaw,hint:gas+' registros de gases hoje'},{k:'Desconforto',s:disRaw,hint:(cfg.ctxCold||cfg.ctxTeething)?'contexto marcado':'geral (temperatura, fralda, dor)'},{k:'Muito estímulo',s:overRaw,hint:fuss+' irritações hoje'}].sort((a,b)=>b.s-a.s);
  const max=h[0].s||1;h.forEach(x=>{x.pct=Math.round((x.s/max)*100);});
  out.innerHTML=h.map((x,i)=>`<div style="margin-bottom:10px"><div class="cop-mini-line"><span class="cm-key">${i+1}. ${escHtml(x.k)} <small style="color:var(--ink-muted);font-weight:500">· ${escHtml(x.hint)}</small></span><span class="cm-val">${x.pct}%</span></div><div class="cop-bar"><div class="cop-bar-fill" style="width:${x.pct}%"></div></div></div>`).join('')+'<p style="font-size:11px;color:var(--ink-muted);margin-top:8px">Estimativa ponderada com horários reais — não é diagnóstico médico.</p>';
}

function runSim(kind){
  const out=$('sim-out');if(!out)return;
  const m=babyAgeMonths(),base=wwBaseTarget(m),last=getLastCompletedSleep();
  const aw=last&&wakeCountsAsDayForPredictions(last)?wwCurrentAwakeMinutes():0;
  const map={skipNap:`Pulando a soneca agora: o fim do dia costuma ficar mais difícil. Com ${m} meses, janela típica ~${base} min; dobrá-la frequentemente aumenta a chance de fragmentar a noite. Se puder, proteja o primeiro sono da manhã amanhã.`,lateNap:`Atrasando a soneca: entrar na noite já cansado puxa o horário da rotina pra trás e pode encurtar o primeiro bloco da noite. Tente não ultrapassar a faixa superior de previsão em mais de 25 min.`,earlyNight:`Adiantando a noite: em dias com débito, entrar 30–40 min antes pode virar noite longa. Atenção à possibilidade de despertar precoce no dia seguinte.`,shortFeed:`Mamada curta agora costuma adiantar a próxima em 30–45 min. Observe sinais de fome na próxima janela — pode puxar a previsão de mamada pra antes.`};
  out.style.display='block';out.textContent=map[kind]||'—';
}

/* ---- WW timer for header update ---- */
function tickOrbit(){renderOrbit();renderStatusRow();}

/* ---- STATS ---- */
function renderStats(){
  const hero=$('stat-hero'),charts=$('stats-charts');if(!hero||!charts)return;
  const statsFallback=()=>{const ymd=todayStr(),td=calendarDayEntries(ymd);const napsToday=td.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e)).length;const feedsToday=td.filter(e=>e.type==='feed').length,diapersToday=td.filter(e=>e.type==='diaper').length;hero.innerHTML=`<div class="stat-hero-kicker">Dados</div><h2 class="stat-hero-title">Resumo rápido</h2><p class="stat-hero-sub">Não foi possível montar o painel completo agora. Valores básicos abaixo.</p>`;charts.innerHTML=`<div class="chart-card"><h4>Resumo rápido (hoje)</h4><div class="stat-grid cols2"><div class="stat-cell"><div class="stat-cell-val">${entries.length}</div><div class="stat-cell-lbl">Registros (total)</div></div><div class="stat-cell"><div class="stat-cell-val">${napsToday}</div><div class="stat-cell-lbl">Sonecas hoje</div></div><div class="stat-cell"><div class="stat-cell-val">${feedsToday}</div><div class="stat-cell-lbl">Mamadas hoje</div></div><div class="stat-cell"><div class="stat-cell-val">${diapersToday}</div><div class="stat-cell-lbl">Fraldas hoje</div></div></div></div><p style="padding:12px;color:var(--ink-muted)">Gráfico indisponível agora.</p>`;};
  try{
  const an=analyzeLastCompleteNight();
  const ymd=todayStr();
  const td=calendarDayEntries(ymd);
  const napM=td.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e)).reduce((a,e)=>a+(e.durationMins||0),0);
  const nightCal=td.filter(e=>e.type==='sleep'&&e.durationMins&&sleepIsNight(e)).reduce((a,e)=>a+(e.durationMins||0),0);
  const totalCal=totalSleepMinsCalendarDay(ymd);
  let heroHtml;
  if(!an){heroHtml=`<div class="stat-hero-kicker">Última noite</div><h2 class="stat-hero-title">Nenhuma noite fechada ainda</h2><p class="stat-hero-sub">Quando o bebê dormir à noite e você registrar o despertar da manhã, aparece aqui o resumo completo — do início do sono noturno até o acordar.</p>`;}
  else{const bedLbl=an.bedYmd===an.wakeYmd?formatShortDate(an.bedYmd):formatShortDate(an.bedYmd)+' → '+formatShortDate(an.wakeYmd);heroHtml=`<div class="stat-hero-kicker">Última noite (referência)</div><h2 class="stat-hero-title">${fmtDur(an.totalSleep)} em ${an.blocks} trecho${an.blocks>1?'s':''}</h2><p class="stat-hero-sub">${escHtml(bedLbl)} · ${escHtml(an.bedClock)} → ${escHtml(an.wakeClock)}</p><div class="stat-grid"><div class="stat-cell"><div class="stat-cell-val">${fmtDur(an.totalSleep)}</div><div class="stat-cell-lbl">Total</div></div><div class="stat-cell"><div class="stat-cell-val">${an.wakes}</div><div class="stat-cell-lbl">Despertares</div></div><div class="stat-cell"><div class="stat-cell-val">${fmtDur(an.maxBlock)}</div><div class="stat-cell-lbl">Maior bloco</div></div><div class="stat-cell"><div class="stat-cell-val">${an.blocks>1?fmtDur(an.minBlock):'—'}</div><div class="stat-cell-lbl">Menor bloco</div></div><div class="stat-cell"><div class="stat-cell-val">${an.avgGap?fmtDur(an.avgGap):'—'}</div><div class="stat-cell-lbl">Entre blocos</div></div><div class="stat-cell"><div class="stat-cell-val">${fmtDur(an.totalSleep-an.maxBlock)}</div><div class="stat-cell-lbl">Outros</div></div></div>`;}
  hero.innerHTML=heroHtml;
  const napsToday=td.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e)).length;
  const feedsToday=td.filter(e=>e.type==='feed').length,diapersToday=td.filter(e=>e.type==='diaper').length;
  const summaryHtml=`<div class="chart-card"><h4>Resumo rápido (hoje)</h4><div class="stat-grid cols2"><div class="stat-cell"><div class="stat-cell-val">${entries.length}</div><div class="stat-cell-lbl">Registros (total)</div></div><div class="stat-cell"><div class="stat-cell-val">${napsToday}</div><div class="stat-cell-lbl">Sonecas hoje</div></div><div class="stat-cell"><div class="stat-cell-val">${feedsToday}</div><div class="stat-cell-lbl">Mamadas hoje</div></div><div class="stat-cell"><div class="stat-cell-val">${diapersToday}</div><div class="stat-cell-lbl">Fraldas hoje</div></div></div></div>`;
  const dayCardHtml=`<div class="chart-card"><h4>Dia civil (hoje)</h4><div class="ch-title">${fmtDur(totalCal)} de sono no relógio</div><div class="stat-grid cols2"><div class="stat-cell"><div class="stat-cell-val">${fmtDur(napM)}</div><div class="stat-cell-lbl">Sonecas</div></div><div class="stat-cell"><div class="stat-cell-val">${fmtDur(nightCal)}</div><div class="stat-cell-lbl">Noturno no dia</div></div><div class="stat-cell"><div class="stat-cell-val">${feedsToday}</div><div class="stat-cell-lbl">Mamadas</div></div><div class="stat-cell"><div class="stat-cell-val">${diapersToday}</div><div class="stat-cell-lbl">Fraldas</div></div></div><p class="ch-ctx">A meia-noite não interrompe a <strong>noite lógica</strong> — ela fecha quando o bebê acorda de manhã.</p></div>`;
  const chartPlaceholders=`<div class="chart-card"><h4>Distribuição de sono (últimas 8h)</h4><div style="position:relative;height:140px;margin-top:12px"><canvas id="barChart"></canvas></div></div><div class="chart-card"><h4>Dia em tipos</h4><div style="position:relative;height:160px;max-width:170px;margin:12px auto 0"><canvas id="donutChart"></canvas></div><p class="ch-ctx">Proporção de cada tipo de evento no dia civil (hoje).</p></div>`;
  charts.innerHTML=summaryHtml+dayCardHtml+chartPlaceholders;
  try{
    const sleeps=td.filter(e=>e.type==='sleep'&&e.durationMins);
    const slots=[],labels=[];for(let i=7;i>=0;i--){const t=new Date(now()-i*3600000);labels.push(t.getHours()+'h');let mins=0;sleeps.forEach(e=>{if(!e.end)return;const s=parseTimeOnDate(e.start,e.date),en=sleepEndDate(e);const ss=new Date(t);ss.setMinutes(0,0,0);const se=new Date(ss.getTime()+3600000);mins+=Math.max(0,(Math.min(en,se)-Math.max(s,ss))/60000);});slots.push(Math.round(Math.min(mins,60)));}
    if(barChart)barChart.destroy();const ctxBar=$('barChart');if(ctxBar){barChart=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{data:slots,backgroundColor:(c)=>{const grad=c.chart.ctx.createLinearGradient(0,0,0,150);grad.addColorStop(0,'#A78BFA');grad.addColorStop(1,'rgba(167,139,250,.15)');return grad;},borderRadius:8,borderSkipped:false,barThickness:14}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1C1940',titleFont:{size:11},bodyFont:{size:11},callbacks:{label:c=>c.parsed.y+' min'}}},scales:{y:{max:60,ticks:{callback:v=>v+'m',color:'#8B87B8',font:{size:10}},grid:{color:'rgba(148,163,255,.08)'}},x:{ticks:{color:'#8B87B8',font:{size:10}},grid:{display:false}}}}});}
    const fc=td.filter(e=>e.type==='feed').length,dc=td.filter(e=>e.type==='diaper').length,sc=sleeps.length;
    if(donutChart)donutChart.destroy();const ctxD=$('donutChart');if(ctxD&&sc+fc+dc>0){donutChart=new Chart(ctxD,{type:'doughnut',data:{labels:['Sono','Mamada','Fralda'],datasets:[{data:[sc,fc,dc],backgroundColor:['#A78BFA','#22D3EE','#F59E0B'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false}}}});}
  }catch(chartErr){nestPushRender(nestErrPayload({type:'render',name:'renderStatsCharts',message:String(chartErr&&chartErr.message||chartErr),stack:String(chartErr&&chartErr.stack||''),filename:'',lineno:0,colno:0}));console.error('[charts failed]',chartErr);const warn=document.createElement('div');warn.style.cssText='padding:12px;margin-top:10px;border-radius:var(--r-sm);background:var(--surface-0);color:var(--ink-muted);font-size:12px';warn.textContent='Gráfico indisponível agora.';charts.appendChild(warn);}
  }catch(err){nestPushRender(nestErrPayload({type:'render',name:'renderStats',message:String(err&&err.message||err),stack:String(err&&err.stack||''),filename:'',lineno:0,colno:0}));console.error('[renderStats failed]',err);statsFallback();}
}

/* ---- HISTORY ---- */
function renderHistory(){const host=$('history-list'),count=$('hist-count');if(!host)return;if(!entries.length){host.innerHTML='<div class="empty-pretty"><h4>Histórico vazio</h4><p>Os eventos registrados aparecem aqui agrupados por dia e por tipo.</p></div>';if(count)count.textContent='';return;}const byDay={};entries.forEach(e=>{(byDay[e.date]=byDay[e.date]||[]).push(e);});const days=Object.keys(byDay).sort().reverse();if(count)count.textContent=entries.length+' eventos em '+days.length+' dias';const tone={sleep:'var(--c-sleep)',feed:'var(--c-feed)',diaper:'var(--c-diaper)',mood:'var(--c-mood)'};const lanes=[['sleep','Sono','var(--c-sleep)'],['feed','Mamadas','var(--c-feed)'],['diaper','Fraldas','var(--c-diaper)'],['mood','Humor / sinais','var(--c-mood)']];const icon={sleep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6z"/></svg>',diaper:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-2 4-6 7-6 11a6 6 0 0012 0c0-4-4-7-6-11z"/></svg>',mood:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9 15c1 1 4 1 6 0"/></svg>'};let html='';days.forEach(day=>{const ev=byDay[day].slice().sort((a,b)=>timeToMins(b.start||'00:00')-timeToMins(a.start||'00:00'));const dayD=new Date(day+'T12:00:00');const dayLbl=dayD.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});const sleepMins=ev.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);html+=`<div class="hgroup"><div class="hgroup-head"><div class="hgroup-day">${escHtml(dayLbl)}</div><div class="hgroup-total">${ev.length} eventos · ${fmtDur(sleepMins)} sono</div></div>`;lanes.forEach(([k,lbl,col])=>{const items=ev.filter(e=>e.type===k);if(!items.length)return;html+=`<div class="hlane"><div class="hlane-label" style="--lane:${col}">${escHtml(lbl)}</div>`;items.forEach(e=>{let name=k==='sleep'?(sleepIsNight(e)?'Sono noturno':'Soneca'):k==='feed'?(e.subtype==='breast'?'Seio':'Mamadeira'):k==='diaper'?(e.subtype==='wet'?'Xixi':e.subtype==='dirty'?'Cocô':'Ambos'):(e.subtype==='crying'?'Choro':e.subtype==='gas'?'Gases':'Irritação');let detail='';if(k==='sleep'){detail=e.start+(e.end?' → '+e.end:' → em andamento')+(e.durationMins?' · '+fmtDur(e.durationMins):'');}else if(k==='feed'){detail=e.start+(e.durationMins?' · '+e.durationMins+' min':'');}else{detail=e.start;}html+=`<div class="hitem"><div class="hdot" style="--tone:${col}">${icon[k]}</div><div class="hmain"><div class="hname">${escHtml(name)}</div><div class="hdetail">${escHtml(detail)}</div></div><button class="hdel" onclick="deleteEntry(${e.id})" aria-label="Excluir">×</button></div>`;});html+='</div>';});html+='</div>';});host.innerHTML=html;}

/* ---- MASTER RENDER ---- */
function renderHome(){refreshAppAfterDataChange('renderHome');}
function showSec(name){if(profileNeedsSetup()&&name!=='settings'&&name!=='home'){showToast('Complete o perfil do bebê primeiro');return;}document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));$('sec-'+name).classList.add('active');const ni=$('nav-'+name);if(ni)ni.classList.add('active');if(name==='home')renderHome();if(name==='stats')safeRender('renderStats',renderStats);if(name==='history')renderHistory();if(name==='copilot')renderCopilot();if(name==='settings')syncSettingsForm();}

/* ---- actions ---- */
function quickSleep(){if(getActiveSleep()){showToast('Já tem sono em andamento');return;}babySlept();}
function babySlept(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}if(getActiveSleep()){showToast('Já tem sono em andamento');return;}const t=fmtTime(now());const e={id:Date.now(),date:todayStr(),type:'sleep',start:t,end:null};setSleepKind(e);entries.push(e);save();showToast((sleepIsNight(e)?'Noite':'Soneca')+' iniciada às '+t);renderHome();}
function babyWoke(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const active=getActiveSleep();if(!active){showToast('Nenhum sono em andamento');return;}const t=fmtTime(now());const idx=entries.findIndex(e=>e.id===active.id);entries[idx].end=t;const sm=parseTime(entries[idx].start),em=parseTime(t);if(em<sm)em.setDate(em.getDate()+1);entries[idx].durationMins=Math.round((em-sm)/60000);save();showToast('Acordou às '+t+' · '+fmtDur(entries[idx].durationMins));renderHome();}
function logMoodQuick(sub){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const t=fmtTime(now());entries.push({id:Date.now(),date:todayStr(),type:'mood',subtype:sub,start:t});save();const lab=sub==='crying'?'Choro':sub==='gas'?'Gases':'Irritação';showToast(lab+' registrado às '+t);renderHome();}
function deleteEntry(id){if(!confirm('Excluir este registro?'))return;entries=entries.filter(e=>e.id!==id);save();renderHome();renderHistory();showToast('Registro excluído');}

function orbitCtaClick(){const cta=$('orbit-cta');if(cta&&cta.onclick)cta.onclick();}

/* ---- Log sheet (FAB) ---- */
function openLogSheet(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const t=$('tile-sleep-lbl');if(t)t.textContent=getActiveSleep()?'Acordou':'Dormiu';const shb=$('sheet-backdrop'),sh=$('log-sheet');if(!shb||!sh)return;shb.classList.add('open');sh.classList.add('open');}
function closeLogSheet(){$('sheet-backdrop').classList.remove('open');$('log-sheet').classList.remove('open');}
function quickSleepOrWake(){if(getActiveSleep())babyWoke();else babySlept();}
// The tile for Dormiu triggers: if active, wake instead
document.addEventListener('DOMContentLoaded',()=>{});

/* ---- Modal (form) ---- */
function openLog(type){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}curModal=type;['feed','diaper','sleep-manual'].forEach(t=>$('mf-'+t).classList.toggle('hide',t!==type));$('modal-title-el').textContent={feed:'Registrar mamada',diaper:'Registrar fralda','sleep-manual':'Sono manual'}[type]||'Registrar';const t=fmtTime(now()),td=todayStr();if(type==='feed'){$('f-feed-date').value=td;$('f-feed-time').value=t;$('f-feed-dur').value='';}if(type==='diaper'){$('f-diaper-date').value=td;$('f-diaper-time').value=t;}if(type==='sleep-manual'){$('f-manual-date').value=td;$('f-manual-start').value=t;$('f-manual-end').value='';}$('modal-backdrop').classList.add('open');}
function closeModal(){$('modal-backdrop').classList.remove('open');}
function saveEntry(){let e={id:Date.now()};if(curModal==='feed'){const date=$('f-feed-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const t=$('f-feed-time').value;if(!isValidTime(t)){showToast('Horário inválido');return;}e.date=date;e.type='feed';e.subtype=state.feedType;e.start=t;e.durationMins=parseInt($('f-feed-dur').value)||null;}else if(curModal==='diaper'){const date=$('f-diaper-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const t=$('f-diaper-time').value;if(!isValidTime(t)){showToast('Horário inválido');return;}e.date=date;e.type='diaper';e.subtype=state.diaperType;e.start=t;}else if(curModal==='sleep-manual'){const date=$('f-manual-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const s=$('f-manual-start').value,en=$('f-manual-end').value;if(!isValidTime(s)){showToast('Início inválido');return;}e.date=date;e.type='sleep';e.start=s;e.end=isValidTime(en)?en:null;if(e.end){let sm=parseTimeOnDate(s,date),em=parseTimeOnDate(e.end,date);if(em<sm)em.setDate(em.getDate()+1);e.durationMins=Math.round((em-sm)/60000);}setSleepKind(e);}entries.push(e);save();closeModal();showToast('Registro salvo');renderHome();}

/* ---- Segmented buttons (in forms) ---- */
function initSegs(){[['seg-feed','feedType'],['seg-diaper','diaperType']].forEach(([sid,key])=>{const seg=$(sid);if(!seg)return;seg.querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',function(e){e.preventDefault();seg.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));this.classList.add('sel');state[key]=this.dataset.val;});});});}

/* ---- Toast ---- */
let toastT=null;
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2400);}

/* ---- Late night mode ---- */
function inLateNightWindow(){const m=timeToMins(fmtTime(now()));return m>=0&&m<6*60;}
function maybeEnforceLateNight(){if(!cfg.lateNightMode||!inLateNightWindow())return;if(profileNeedsSetup())return;try{if(sessionStorage.getItem('nest_ln_dismiss_'+todayStr()))return;}catch{}openLateNight();}
function openLateNight(){const o=$('lateNight');if(!o)return;o.classList.add('open');o.setAttribute('aria-hidden','false');updateLateNight();if(lnTimer)clearInterval(lnTimer);lnTimer=setInterval(updateLateNight,15000);}
function dismissLateNight(){const o=$('lateNight');if(o){o.classList.remove('open');o.setAttribute('aria-hidden','true');}try{sessionStorage.setItem('nest_ln_dismiss_'+todayStr(),'1');}catch{}if(lnTimer){clearInterval(lnTimer);lnTimer=null;}}
function updateLateNight(){const c=$('ln-clock'),s=$('ln-since');if(!c)return;c.textContent=fmtTime(now());const active=getActiveSleep();const last=getLastCompletedSleep();if(active){const mins=Math.round((now()-parseTimeOnDate(active.start,active.date))/60000);s.textContent='Dormindo há '+fmtDur(mins)+' (desde '+active.start+')';}else if(last){const mins=Math.round((now()-sleepEndDate(last))/60000);s.textContent='Acordado há '+fmtDur(mins);}else s.textContent='Registre o primeiro sono para começar.';}

/* ---- Export / Import ---- */
function exportData(){const data={entries,cfg,exportedAt:new Date().toISOString(),profileId:currentProfileId(),appName:APP_NAME};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nest-backup-'+todayStr()+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('JSON exportado');}
function csvEscape(s){if(s==null)return'';const t=String(s);if(/[",\n]/.test(t))return'"'+t.replace(/"/g,'""')+'"';return t;}
function exportCsv(){const rows=[['id','date','type','subtype','start','end','durationMins'].map(csvEscape).join(',')];entries.slice().sort((a,b)=>a.id-b.id).forEach(e=>rows.push([e.id,e.date||'',e.type||'',e.subtype||'',e.start||'',e.end||'',e.durationMins!=null?e.durationMins:''].map(csvEscape).join(',')));const blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nest-'+todayStr()+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('CSV exportado');}
function printReport(){const lines=entries.slice().sort((a,b)=>b.id-a.id).slice(0,200);let html='<h1>Nest — relatório</h1><p><strong>'+escHtml(cfg.name||'Bebê')+'</strong> · '+escHtml(new Date().toLocaleString('pt-BR'))+'</p><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:11px"><tr><th>Data</th><th>Tipo</th><th>Detalhe</th></tr>';lines.forEach(e=>{let d=(e.start||'')+(e.type==='sleep'?' → '+(e.end||'')+(e.durationMins?' ('+fmtDur(e.durationMins)+')':''):e.type==='feed'?' '+(e.subtype||'')+(e.durationMins?' '+e.durationMins+'min':''):' '+(e.subtype||''));html+='<tr><td>'+escHtml(e.date)+'</td><td>'+escHtml(e.type)+'</td><td>'+escHtml(d)+'</td></tr>';});html+='</table>';$('print-area').innerHTML=html;$('print-area').classList.remove('hide');window.print();setTimeout(()=>{$('print-area').innerHTML='';$('print-area').classList.add('hide');},300);}
function importData(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=(e)=>{try{const data=JSON.parse(e.target.result);if(!data.entries||!Array.isArray(data.entries)){showToast('Arquivo inválido');return;}if(!confirm('Isso vai substituir os dados deste perfil. Continuar?'))return;let fb=todayStr();try{if(data.exportedAt)fb=new Date(data.exportedAt).toLocaleDateString('sv-SE');}catch{}entries=data.entries.map(x=>{if(!x||typeof x!=='object')return x;return x.date&&isValidDateStr(x.date)?x:{...x,date:fb};});if(data.cfg){cfg={...defaultCfg(),...data.cfg};delete cfg.appName;}migrateDataModel();if(!cfg.profileSetupDone&&(entries.length>0||(cfg.babyBirthDate&&isValidDateStr(cfg.babyBirthDate))))cfg.profileSetupDone=true;save();syncSettingsForm();syncOnboardingUI();updateHeader();renderHome();showToast('Importado');}catch(err){showToast('Erro ao importar');}};r.readAsText(f);ev.target.value='';}

/* ---- PWA ---- */
function registerPWA(){if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}}

/* ---- init ---- */
function init(){
  nestInitErrorCapture();
  migrateToProfiles();loadProfileIntoMemory();applyTheme();syncSettingsForm();updateHeader();syncOnboardingUI();initSegs();
  registerPWA();
  renderHome();
  // Refresh orbit every 30s so timers "tick"
  setInterval(tickOrbit,30000);
  // Modal close on backdrop click
  $('modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  // Visibility: recheck late night
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){maybeEnforceLateNight();renderHome();}});
  maybeEnforceLateNight();
}
init();


/* ---- Exposto para handlers inline (onclick / oninput / onchange) ---- */
function nestExposeGlobalsForInlineHandlers(){
  const map={
    skipBabyOnboarding,submitBabyOnboarding,babySlept,babyWoke,dismissLateNight,openLog,showSec,toggleTheme,orbitCtaClick,
    addNewProfile,deleteCurrentProfile,activateLicenseKey,startPremiumTrial,exportData,exportCsv,printReport,saveSettings,
    openLogSheet,closeLogSheet,quickSleep,logMoodQuick,saveEntry,closeModal,copyNestDebugReport,maskDateBirth,maskTime,
    switchProfile,applyThemeFromCheckbox,applyPremiumLocalToggle,importData,runCryDiagnosis,runSim,deleteEntry,
    showDebugPanel,quickSleepOrWake
  };
  Object.entries(map).forEach(([k,v])=>{window[k]=v;});
}

/** Smoke checks para desenvolvimento (console). Não altera dados. */
function runNestSelfTests(){
  const out={ok:true,errors:[],checks:[]};
  const fail=(name,msg)=>{out.ok=false;out.errors.push(msg);out.checks.push({name,ok:false,msg});};
  const pass=name=>out.checks.push({name,ok:true});
  try{
    if(typeof Chart==='undefined')fail('chart-js','Chart global ausente');
    else pass('chart-js');
    const fullShell=!!document.getElementById('sec-home');
    if(fullShell){
      ['pred-list','today-rail','stats-charts','sec-home'].forEach(id=>{
        if(!document.getElementById(id))fail('dom-'+id,'#'+id+' ausente');
        else pass('dom-'+id);
      });
    }else{out.checks.push({name:'dom-app-shell',ok:true,msg:'skip (página mínima, sem #sec-home)'});}
    if(typeof refreshAppAfterDataChange!=='function')fail('refresh','refreshAppAfterDataChange não é função');
    else pass('refreshAppAfterDataChange');
    if(typeof save!=='function')fail('save','save não é função');
    else pass('save');
    if(!Number.isFinite(timeToMins('12:00')))fail('timeToMins','timeToMins inválido');
    else pass('timeToMins');
  }catch(e){out.ok=false;out.errors.push(String(e&&e.message||e));}
  return out;
}

nestExposeGlobalsForInlineHandlers();
window.runNestSelfTests=runNestSelfTests;
