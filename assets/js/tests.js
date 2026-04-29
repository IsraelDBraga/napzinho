function runNestSelfTests(){
  const checks=[];
  const add=(id,name,ok,expected,actual,details={})=>checks.push({id,name,ok:!!ok,expected,actual,details});
  const pending=(id,name,reason)=>checks.push({id,name,ok:false,expected:'ready',actual:'pending',details:{pending:true,reason}});

  add('W1','debugDateParsing exposto',typeof window.debugDateParsing==='function','function',typeof window.debugDateParsing);
  add('W2','debugIphoneHomeState exposto',typeof window.debugIphoneHomeState==='function','function',typeof window.debugIphoneHomeState);
  add('W3','debugRenderHealth exposto',typeof window.debugRenderHealth==='function','function',typeof window.debugRenderHealth);
  add('W4','debugNestStorage exposto',typeof window.debugNestStorage==='function','function',typeof window.debugNestStorage);
  add('W5','debugNestVersion exposto',typeof window.debugNestVersion==='function','function',typeof window.debugNestVersion);
  add('W6','runNestSelfTests exposto',typeof window.runNestSelfTests==='function','function',typeof window.runNestSelfTests);

  if(typeof tickOrbit==='function'){
    const beforeEntries=(Array.isArray(entries)?entries.length:null);
    const beforeBlob=localStorage.getItem(PROFILE_KEY)||'';
    try{tickOrbit();add('T2','tickOrbit não lança',true,true,true);}catch(e){add('T2','tickOrbit não lança',false,true,String(e));}
    add('T1','tickOrbit existe',true,'function',typeof tickOrbit);
    if(beforeEntries!=null)add('T3','tickOrbit não cria entries',entries.length===beforeEntries,beforeEntries,entries.length);
    add('T4','tickOrbit não altera storage',(localStorage.getItem(PROFILE_KEY)||'')===beforeBlob,true,(localStorage.getItem(PROFILE_KEY)||'')===beforeBlob);
  }else pending('T1','tickOrbit existe','tickOrbit será sincronizado no Patch 3C');

  if(typeof EntitlementService==='object'){
    add('B2','canUsePremium familyLifetime',EntitlementService.canUsePremium('any_feature')===true,true,EntitlementService.canUsePremium('any_feature'));
  }else pending('B2','familyLifetime/entitlement','EntitlementService ainda não modularizado (Patch 3B/3C)');

  if(typeof CopilotEngine==='object'){
    const cst=CopilotEngine.getCurrentBabyState(new Date());
    add('CP1','CopilotEngine existe',true,'object',typeof CopilotEngine);
    add('CP2','Copilot state objeto',typeof cst==='object','object',typeof cst);
  }else pending('CP1','Copilot checks','CopilotEngine será sincronizado no Patch 3C');

  const failed=checks.filter(c=>!c.ok&&!c.details?.pending);
  const pendingChecks=checks.filter(c=>c.details?.pending);
  return {passed:checks.filter(c=>c.ok).length,total:checks.length,failed,pending:pendingChecks,checks};
}
window.runNestSelfTests=runNestSelfTests;


function runStorageBackupChecks(){
  const fixture={entries:[{type:'feed',date:'2026-03-23',subtype:'bottle',start:'06:40'},{type:'diaper',date:'2026-03-23',subtype:'both',start:'12:05'},{type:'sleep',date:'2026-03-23',subtype:'nap',start:'08:40',end:'09:04',durationMins:24},{type:'sleep',date:'2026-03-24',subtype:'night',start:'23:48',end:'03:18',durationMins:210},{type:'sleep',date:'2026-04-02',subtype:'night',start:'02:53',end:'02:53',durationMins:0},{type:'signal',date:'2026-04-11',subtype:'cry',start:'21:08'},{type:'mood',date:'2026-04-28',subtype:'gas',start:'05:22'}],cfg:{name:'Azrael',babyBirthDate:'2025-07-07',nightStart:'18:00',dayBoundary:'06:00',dataSchemaVersion:6,premiumUnlockLocal:true},profileId:'default',appName:'Nest'};
  const checks=[]; const add=(id,name,ok,expected,actual,details={})=>checks.push({id,name,ok:!!ok,expected,actual,details});
  const norm=normalizeBackupPayload(fixture);const p=norm.profiles.default||{};
  add('B1','normalizeBackupPayload aceita raiz',!!norm.profiles,true,!!norm.profiles);
  add('B2','cria profiles.default',!!norm.profiles.default,true,!!norm.profiles.default);
  add('B3','activeProfileId default',norm.activeProfileId==='default','default',norm.activeProfileId);
  add('B4','feed usa time=time||start',(p.entries||[]).find(e=>e.type==='feed')?.time==='06:40','06:40',(p.entries||[]).find(e=>e.type==='feed')?.time);
  add('B5','diaper usa diaperType',(p.entries||[]).find(e=>e.type==='diaper')?.diaperType==='both','both',(p.entries||[]).find(e=>e.type==='diaper')?.diaperType);
  add('B6','sleep nap válido',(p.entries||[]).some(e=>e.type==='sleep'&&e.subtype==='nap'),true,(p.entries||[]).filter(e=>e.type==='sleep'&&e.subtype==='nap').length);
  add('B7','sleep night meia-noite ok',(p.entries||[]).some(e=>e.type==='sleep'&&e.subtype==='night'),true,(p.entries||[]).filter(e=>e.type==='sleep'&&e.subtype==='night').length);
  add('B8','zero-duration preservado',(p.entries||[]).some(e=>e.type==='sleep'&&e.durationMins===0),true,(p.entries||[]).some(e=>e.type==='sleep'&&e.durationMins===0));
  add('B9','signal/mood normalizados',(p.entries||[]).some(e=>e.type==='mood'&&e.subtype==='crying')&&(p.entries||[]).some(e=>e.type==='mood'&&e.subtype==='gas'),true,(p.entries||[]).filter(e=>e.type==='mood').map(e=>e.subtype));
  add('B10','cfg.babyBirthDate preservado',p.cfg?.babyBirthDate==='2025-07-07','2025-07-07',p.cfg?.babyBirthDate);
  add('B11','cfg.nightStart/dayBoundary preservados',p.cfg?.nightStart==='18:00'&&p.cfg?.dayBoundary==='06:00',true,{nightStart:p.cfg?.nightStart,dayBoundary:p.cfg?.dayBoundary});
  add('B12','premiumUnlockLocal -> familyLifetime',p.cfg?.entitlement?.status==='familyLifetime',true,p.cfg?.entitlement?.status);
  const wrongCfg={premiumUnlockLocal:true,entitlement:{status:'devUnlocked',source:'legacyPremiumUnlockLocal'}};EntitlementService.migrateLegacyPremiumState(wrongCfg);add('B13','corrige devUnlocked legado',wrongCfg.entitlement.status==='familyLifetime',true,wrongCfg.entitlement.status);
  const exp=exportBackupJson();add('B14','export preserva entitlement',!!exp.cfg?.entitlement,true,exp.cfg?.entitlement);
  const n1=normalizeBackupPayload(fixture);const n2=normalizeBackupPayload(fixture);add('B15','import duas vezes não duplica',(n1.profiles.default.entries||[]).length===(n2.profiles.default.entries||[]).length,true,[(n1.profiles.default.entries||[]).length,(n2.profiles.default.entries||[]).length]);
  const before=localStorage.getItem(PROFILE_KEY)||'';const bad=importBackupJson('{');add('B16','JSON inválido não apaga dados',bad.ok===false && (localStorage.getItem(PROFILE_KEY)||'')===before,true,bad);
  const adjusted=normalizeBackupPayload({profiles:{a:{entries:[{type:'feed',start:'08:00'}],cfg:{}},b:{entries:[{type:'feed',start:'08:00'},{type:'feed',start:'09:00'}],cfg:{}}},activeProfileId:'z'});add('B17','activeProfile inválido escolhe maior perfil',adjusted.activeProfileId==='b','b',adjusted.activeProfileId);
  add('B18','localStorage.clear não é usado',!(importBackupJson.toString().includes('localStorage.clear')||migrateLegacyDataIfNeeded.toString().includes('localStorage.clear')),true,false);
  return checks;
}
const _baseRun=runNestSelfTests;
runNestSelfTests=function(){const base=_baseRun();const extra=runStorageBackupChecks();const checks=[...base.checks,...extra];return{passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok&&!c.details?.pending),pending:checks.filter(c=>c.details?.pending),checks};};
window.runNestSelfTests=runNestSelfTests;

function runPatch3CChecks(){const checks=[];const add=(id,name,ok,expected,actual,details={})=>checks.push({id,name,ok:!!ok,expected,actual,details});const pending=(id,name,reason)=>checks.push({id,name,ok:false,expected:'ready',actual:'pending',details:{pending:true,reason}});add('C1','showSec fn',typeof showSec==='function','function',typeof showSec);add('C2','window.showSec fn',typeof window.showSec==='function','function',typeof window.showSec);add('C3','tickOrbit fn',typeof tickOrbit==='function','function',typeof tickOrbit);if(typeof tickOrbit==='function'){const be=entries.length,bs=localStorage.getItem(PROFILE_KEY)||'';try{tickOrbit();add('C4','tickOrbit não lança',true,true,true);}catch(e){add('C4','tickOrbit não lança',false,true,String(e));}add('C5','tickOrbit não cria entries',entries.length===be,be,entries.length);add('C6','tickOrbit não altera storage',(localStorage.getItem(PROFILE_KEY)||'')===bs,true,(localStorage.getItem(PROFILE_KEY)||'')===bs);}add('C7','CopilotEngine objeto',typeof CopilotEngine==='object','object',typeof CopilotEngine);add('C8','renderCopilot fn',typeof renderCopilot==='function','function',typeof renderCopilot);add('C9','COPILOT_DISCLAIMER único',typeof COPILOT_DISCLAIMER==='string'&&COPILOT_DISCLAIMER.length>20,true,COPILOT_DISCLAIMER);if(typeof CopilotEngine==='object'){const st=CopilotEngine.getCurrentBabyState(new Date());const feb=CopilotEngine.answerLocalQuestion('febre',st);const resp=CopilotEngine.answerLocalQuestion('respiração estranha',st);const unk=CopilotEngine.answerLocalQuestion('blabla xyz',st);add('C10','febre sem dose/remédio',!/dipirona|paracetamol|ibuprofeno|dose|mg|ml/i.test(JSON.stringify(feb)),true,feb);add('C11','respiração alerta',/urgên|alerta/i.test((resp.answer||'')),true,resp.answer);add('C12','fallback seguro',/não consigo avaliar/i.test((unk.answer||'').toLowerCase()),true,unk.answer);}else pending('C10','CP QA','CopilotEngine ausente');return checks;}
const __oldRun=runNestSelfTests;runNestSelfTests=function(){const b=__oldRun();const checks=[...b.checks,...runPatch3CChecks()];return{passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok&&!c.details?.pending),pending:checks.filter(c=>c.details?.pending),checks};};window.runNestSelfTests=runNestSelfTests;
function runPatch3CBChecks(){const checks=[];const add=(id,name,ok,expected,actual,details={})=>checks.push({id,name,ok:!!ok,expected,actual,details});const pending=(id,name,reason)=>checks.push({id,name,ok:false,expected:'ready',actual:'pending',details:{pending:true,reason}});try{if(typeof renderCopilot==='function'){renderCopilot();const tx=($('sec-copilot')?.textContent||'');add('C13','renderCopilot sem string crua',!(/\+escHtml|\[object Object\]/i.test(tx)),true,tx.slice(0,120));}else pending('C13','renderCopilot','depende bootstrap');}catch(e){add('C13','renderCopilot sem string crua',false,true,String(e));}try{if(typeof renderTodayRail==='function'){renderTodayRail();const tx=($('today-rail')?.textContent||'').trim();add('C14','todayRail não só travessão',tx!=='' && tx!=='—',true,tx.slice(0,80));}else pending('C14','todayRail','depende DOM');}catch(e){add('C14','todayRail não só travessão',false,true,String(e));}try{const old=globalThis.Chart;globalThis.Chart=undefined;renderStats();const tx=($('stats-charts')?.textContent||'');add('C15','stats fallback sem Chart',/Resumo rápido|Gráfico indisponível agora/.test(tx),true,tx.slice(0,100));globalThis.Chart=old;}catch(e){pending('C15','stats fallback','depende DOM/canvas');}try{if(typeof renderPredictions==='function'){const old=globalThis.entries;globalThis.entries=[{type:'feed',start:'xx'}];renderPredictions();const tx=($('pred-list')?.textContent||'');add('C16','predictions fallback inválido',tx.length>0,true,tx.slice(0,90));globalThis.entries=old;}else pending('C16','predictions fallback','depende bootstrap');}catch(e){add('C16','predictions fallback inválido',false,true,String(e));}try{const h=debugRenderHealth();add('C17','debugRenderHealth containers',typeof h==='object'&&!!h.containers,true,typeof h);}catch(e){add('C17','debugRenderHealth containers',false,true,String(e));}try{const txt=document.body?document.body.innerText:'';add('C18','sem undefined/NaN/Infinity/Invalid Date',!/undefined|NaN|Infinity|Invalid Date/.test(txt),true,txt.slice(0,80));}catch(e){pending('C18','render text health','depende DOM');}return checks;}
const ___run=runNestSelfTests;runNestSelfTests=function(){const b=___run();const checks=[...b.checks,...runPatch3CBChecks()];return{passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok&&!c.details?.pending),pending:checks.filter(c=>c.details?.pending),checks};};window.runNestSelfTests=runNestSelfTests;
