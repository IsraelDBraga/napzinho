// ActiveSleepGuard (forgot to mark wake) — minimal, defensive module.
// Rules:
// - Never auto-end sleep without user action.
// - Never create a second active sleep.
// - Show warning when active sleep is implausibly long.

const ActiveSleepGuard=(()=>{
  const keyFor=(id)=>`nest_active_sleep_guard_${id}`;
  const min0=x=>{const n=Number(x);return Number.isFinite(n)?Math.max(0,Math.round(n)):0;};
  const minsBetween=(a,b)=>{if(!(a instanceof Date)||!(b instanceof Date))return null;const ms=b.getTime()-a.getTime();return Number.isFinite(ms)?min0(ms/60000):null;};

  function startDt(active){
    if(!active||active.type!=='sleep'||!active.start||!active.date)return null;
    if(!isValidDateStr(active.date)||!isValidTime(active.start))return null;
    return parseTimeOnDate(active.start,active.date);
  }
  function isDismissed(id){
    try{
      const raw=sessionStorage.getItem(keyFor(id));
      if(!raw)return false;
      const until=parseInt(raw,10);
      return Number.isFinite(until) && Date.now()<until;
    }catch(e){return false;}
  }
  function snooze(id,minutes){
    try{
      const ms=min0(minutes)*60000;
      sessionStorage.setItem(keyFor(id),String(Date.now()+ms));
      return true;
    }catch(e){return false;}
  }
  function thresholds(isNight){
    // Suggested thresholds (mins):
    // nap: <=150 normal; 150-240 long; >240 probably forgotten
    // night: <=720 normal; 720-810 long; >810 probably forgotten
    return isNight
      ? {normalMax:12*60,longMax:13.5*60,forgotMax:13.5*60}
      : {normalMax:2.5*60,longMax:4*60,forgotMax:4*60};
  }
  function getActiveSleepStatus(nowDt=new Date()){
    const active=getActiveSleep&&getActiveSleep();
    if(!active)return null;
    const sdt=startDt(active);
    if(!sdt)return {activeSleep:active,activeMins:0,state:'invalid',needsConfirmation:false,actions:[]};
    const n=nowDt instanceof Date?nowDt:new Date();
    const m=minsBetween(sdt,n);
    const isNight=!!sleepIsNight(active);
    const th=thresholds(isNight);
    let state='normal';
    if(m>th.longMax) state='probably_forgotten';
    else if(m>th.normalMax) state=isNight?'long_night':'long_nap';
    const needsConfirmation = (state!=='normal' && !isDismissed(active.id));
    const actions = [
      {kind:'active-sleep',action:'still',label:'Ainda dormindo',variant:'secondary'},
      {kind:'active-sleep',action:'wakeNow',label:'Acordou agora',variant:'primary'},
      {kind:'active-sleep',action:'dismiss',label:'Ignorar',variant:'ghost'}
    ];
    return {activeSleep:active,activeMins:m,isNight,state,needsConfirmation,actions};
  }
  function confirmStillSleeping(activeSleepId){
    return snooze(activeSleepId,90);
  }
  function dismissActiveSleepWarning(activeSleepId,minutes=180){
    return snooze(activeSleepId,minutes);
  }
  function closeActiveSleepNow(){
    try{babyWoke();return true;}catch(e){return false;}
  }

  return{
    getActiveSleepStatus,
    confirmStillSleeping,
    dismissActiveSleepWarning,
    closeActiveSleepNow
  };
})();

function handleActiveSleepGuardAction(action){
  const st=ActiveSleepGuard.getActiveSleepStatus(now());
  const id=st&&st.activeSleep?st.activeSleep.id:null;
  if(!id)return;
  if(action==='still'){ActiveSleepGuard.confirmStillSleeping(id);renderHome();return;}
  if(action==='dismiss'){ActiveSleepGuard.dismissActiveSleepWarning(id,180);renderHome();return;}
  if(action==='wakeNow'){ActiveSleepGuard.closeActiveSleepNow();renderHome();return;}
}
