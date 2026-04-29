/* ---- sleep engine (dates) ---- */
// Night/nap classification helpers (used across modules).
function dayBoundaryMins(){const s=(cfg&&cfg.dayBoundary)||'06:00';return isValidTime(s)?timeToMins(s):360;}
function nightStartMinsVal(){const s=(cfg&&cfg.nightStart)||'18:00';return isValidTime(s)?timeToMins(s):1080;}
function isNightContextAtClock(mins){const dB=dayBoundaryMins(),ns=nightStartMinsVal();return mins>=ns||mins<dB;}
function isNightContextForClock(hhmm){const m=timeToMins(String(hhmm||'00:00'));return isNightContextAtClock(m);}
/** Sleep that touches the physiological night window counts as night. */
function sleepTouchesPhysiologicalNight(e){
  if(!e||e.type!=='sleep'||!e.end||!isValidTime(e.end))return false;
  const st=sleepStartDate(e),en=sleepEndDate(e);
  if(!st||!en||en.getTime()<=st.getTime())return false;
  const step=5*60000;
  for(let t=st.getTime();t<en.getTime();t+=step){
    const d=new Date(t);
    const mins=d.getHours()*60+d.getMinutes();
    if(isNightContextAtClock(mins))return true;
  }
  return false;
}
function setSleepKind(e){
  if(!e||e.type!=='sleep')return e;
  const isNight=isNightContextForClock(e.start)||sleepTouchesPhysiologicalNight(e);
  e.sleepKind=isNight?'night':'nap';
  if(!e.subtype)e.subtype=e.sleepKind;
  return e;
}
function sleepIsNight(e){
  if(!e||e.type!=='sleep')return false;
  if(isNightContextForClock(e.start))return true;
  if(e.end&&isValidTime(e.end))return sleepTouchesPhysiologicalNight(e);
  return false;
}
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
