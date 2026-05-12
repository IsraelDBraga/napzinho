/* ---- MASTER RENDER ---- */

function refreshAppAfterDataChange(reason){
  const jobs = [
    'renderOrbit',
    'renderStatusRow',
    'renderInsight',
    'renderPredictions',
    'renderGlance',
    'renderNightPanel',
    'renderDaySleepPanel',
    'renderTodayRail'
  ];

  jobs.forEach(name => {
    const fn = window[name];

    if (typeof fn !== 'function') return;

    if (typeof safeRender === 'function') {
      safeRender(name, () => fn());
      return;
    }

    try {
      fn();
    } catch (err) {
      console.error('[Napzinho render]', name, reason || '', err);
    }
  });
}

function renderHome(){
  refreshAppAfterDataChange('renderHome');
}
function showSec(name){if(profileNeedsSetup()&&name!=='settings'&&name!=='home'){showToast('Complete o perfil do bebê primeiro');return;}document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));$('sec-'+name).classList.add('active');const ni=$('nav-'+name);if(ni)ni.classList.add('active');if(name==='home')renderHome();if(name==='stats')safeRender('renderStats',()=>renderStats(),{containerId:'sec-stats',fallbackHtml:'<div class="card"><h3>Dados</h3><p class="muted">Falha ao renderizar gráficos. Recarregue o app.</p></div>'});if(name==='history')renderHistory();if(name==='copilot')renderCopilot();if(name==='settings')syncSettingsForm();}

/* ---- Toast ---- */
let toastT=null;
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2400);}

/* ---- Late night mode ---- */
function inLateNightWindow(){const m=timeToMins(fmtTime(now()));return m>=0&&m<6*60;}
function maybeEnforceLateNight(){if(!cfg.lateNightMode||!inLateNightWindow())return;if(profileNeedsSetup())return;try{if(sessionStorage.getItem('nest_ln_dismiss_'+todayStr()))return;}catch{}openLateNight();}
function openLateNight(){const o=$('lateNight');if(!o)return;o.classList.add('open');o.setAttribute('aria-hidden','false');updateLateNight();if(lnTimer)clearInterval(lnTimer);lnTimer=setInterval(updateLateNight,15000);}
function dismissLateNight(){const o=$('lateNight');if(o){o.classList.remove('open');o.setAttribute('aria-hidden','true');}try{sessionStorage.setItem('nest_ln_dismiss_'+todayStr(),'1');}catch{}if(lnTimer){clearInterval(lnTimer);lnTimer=null;}}
function updateLateNight(){const c=$('ln-clock'),s=$('ln-since');if(!c)return;c.textContent=fmtTime(now());const active=getActiveSleep();const last=getLastCompletedSleep();if(active){const mins=Math.round((now()-parseTimeOnDate(active.start,active.date))/60000);s.textContent='Dormindo há '+fmtDur(mins)+' (desde '+active.start+')';}else if(last){const mins=Math.round((now()-sleepEndDate(last))/60000);s.textContent='Acordado há '+fmtDur(mins);}else s.textContent='Registre o primeiro sono para começar.';}

/* ---- PWA ---- */
function registerPWA(){if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}}

/* ---- init ---- */
function init(){
  nestInitErrorCapture();
  migrateToProfiles();loadProfileIntoMemory();applyTheme();safeRender('syncSettingsForm',syncSettingsForm);updateHeader();syncOnboardingUI();initSegs();
  registerPWA();
  renderHome();
  // Refresh orbit every 30s so timers "tick"
  if(window.__nestOrbitTimer)clearInterval(window.__nestOrbitTimer);
  window.__nestOrbitTimer=setInterval(tickOrbit,30000);
  // Modal close on backdrop click
  $('modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  // Visibility: recheck late night
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){maybeEnforceLateNight();renderHome();}});
  maybeEnforceLateNight();
}
init();


window.showSec=showSec;window.openLog=openLog;window.openLogSheet=openLogSheet;window.babySlept=babySlept;window.babyWoke=babyWoke;window.renderCopilot=renderCopilot;window.runNestSelfTests=runNestSelfTests;window.debugNestVersion=debugNestVersion;window.debugNestStorage=debugNestStorage;window.debugRenderHealth=debugRenderHealth;window.debugDateParsing=debugDateParsing;window.debugIphoneHomeState=debugIphoneHomeState;window.debugSettingsDomMap=debugSettingsDomMap;window.copyDiagnostics=copyDiagnostics;window.tickOrbit=tickOrbit;
