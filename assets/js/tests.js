/* ---- Exposto para handlers inline (onclick / oninput / onchange) ---- */
function nestExposeGlobalsForInlineHandlers(){
  // Use names (strings) to avoid ReferenceError when some features
  // are absent in minimal/headless environments.
  const names=[
    'skipBabyOnboarding','submitBabyOnboarding','babySlept','babyWoke','dismissLateNight','openLog','showSec','toggleTheme','orbitCtaClick',
    'addNewProfile','deleteCurrentProfile','activateLicenseKey','startPremiumTrial','exportData','exportCsv','printReport','saveSettings',
    'openLogSheet','closeLogSheet','quickSleep','logMoodQuick','saveEntry','closeModal','copyNestDebugReport','maskDateBirth','maskTime',
    'switchProfile','applyThemeFromCheckbox','applyPremiumLocalToggle','importData','runCryDiagnosis','runSim','deleteEntry',
    'showDebugPanel','quickSleepOrWake','handleActiveSleepGuardAction'
  ];
  names.forEach(k=>{try{const v=globalThis[k];if(typeof v==='function')window[k]=v;}catch(e){}});
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
