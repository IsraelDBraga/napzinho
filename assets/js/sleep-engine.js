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

// ---- Summaries (consistent day/night semantics) ----
// Day summary: counts naps by calendar day (ymd == entry.date) and includes active nap if applicable.
function getDaySummary(ymd,nowDt=new Date()){
  const dt=(nowDt instanceof Date && Number.isFinite(nowDt.getTime()))?nowDt:new Date();
  const dayEntries=calendarDayEntries(ymd);
  const naps=dayEntries.filter(e=>e.type==='sleep' && !sleepIsNight(e));
  const napClosed=naps.filter(e=>e.end && e.durationMins!=null);
  const napTotalClosed=napClosed.reduce((a,e)=>a+(e.durationMins||0),0);
  let napActiveMins=0;
  const active=getActiveSleep();
  if(active && !active.end && active.date===ymd && !sleepIsNight(active)){
    const st=parseTimeOnDate(active.start,active.date);
    napActiveMins=Math.max(0,Math.round((dt-st)/60000));
  }
  const feeds=dayEntries.filter(e=>e.type==='feed').length;
  const diapers=dayEntries.filter(e=>e.type==='diaper').length;
  const moods=dayEntries.filter(e=>e.type==='mood').length;
  return{
    ymd,
    sleepTotal:napTotalClosed+napActiveMins, // keep field name for existing UI
    sleepTotalClosed:napTotalClosed,
    sleepActiveMins:napActiveMins,
    sleepPeriods:naps.length,
    naps:naps.length,
    feeds,
    diapers,
    moods,
    events:dayEntries
  };
}

// Night grouping: identify a "bed day" (the date the night started, at/after cfg.nightStart),
// then collect all sleep segments that overlap that physiological night window (nightStart -> next dayBoundary),
// including segments that ended before midnight and segments after midnight.
function nightBedYmdForSleep(e){
  if(!e||e.type!=='sleep'||!isValidDateStr(e.date)||!isValidTime(e.start))return null;
  const ns=nightStartMinsVal();
  const db=dayBoundaryMins();
  const stMin=timeToMins(e.start);
  // Rule: if it starts before nightStart but crosses into the night window, it counts as that night's bedYmd.
  // Example: 17:40→18:30 with nightStart 18:00 belongs to the same day's night.
  if(stMin<ns && stMin>=db && e.end && isValidTime(e.end)){
    const endMin=timeToMins(e.end);
    const crossesNightStart=endMin>=ns; // same-day end that reaches nightStart
    if(crossesNightStart) return e.date;
  }
  if(stMin>=ns) return e.date;
  if(stMin<db){
    // after midnight: belongs to previous evening's night
    const d=TimeEngine.parseYmdLocalSafe(e.date);
    if(!d) return null;
    d.setDate(d.getDate()-1);
    return ymdFromDateLocal(d);
  }
  return null; // daytime sleep
}
function nightWindowForBedYmd(bedYmd){
  const win=TimeEngine.resolveWindowOnDate(bedYmd,minsToTime(nightStartMinsVal()),minsToTime(dayBoundaryMins()));
  if(!win) return null;
  return win; // {start,end}
}
function sleepOverlapsWindow(e,win){
  const st=sleepStartDate(e);
  const en=e.end&&isValidTime(e.end)?sleepEndDate(e):null;
  if(!st||!en||!win) return false;
  return st<win.end && en>win.start;
}
function nightSegmentsForBedYmd(bedYmd){
  const win=nightWindowForBedYmd(bedYmd);
  if(!win) return [];
  return entries
    .filter(e=>e && e.type==='sleep' && e.end && isValidTime(e.end))
    .filter(e=>nightBedYmdForSleep(e)===bedYmd || (sleepIsNight(e) && sleepOverlapsWindow(e,win)))
    .filter(e=>sleepOverlapsWindow(e,win))
    .sort((a,b)=>sleepStartDate(a)-sleepStartDate(b));
}
function analyzeLastCompleteNight(nowDt=new Date()){
  // pick the most recent bedYmd that has at least one night segment
  const dt=(nowDt instanceof Date && Number.isFinite(nowDt.getTime()))?nowDt:new Date();
  const candidates=entries
    .filter(e=>e && e.type==='sleep' && e.end && isValidTime(e.end))
    .map(e=>nightBedYmdForSleep(e))
    .filter(Boolean);
  const unique=[...new Set(candidates)].sort(); // ascending ymd
  if(!unique.length) return null;
  // choose latest with segments (defensive)
  let bedYmd=null,segs=[];
  for(let i=unique.length-1;i>=0;i--){
    const by=unique[i];
    const ss=nightSegmentsForBedYmd(by);
    if(ss.length){bedYmd=by;segs=ss;break;}
  }
  if(!bedYmd||!segs.length) return null;

  const first=segs[0],last=segs[segs.length-1];
  const totalSleep=segs.reduce((a,e)=>a+(e.durationMins||0),0);
  const durs=segs.map(e=>e.durationMins||0).filter(x=>x>0);
  const blocks=durs.length;
  const maxBlock=blocks?Math.max(...durs):0;
  const minBlock=blocks>1?Math.min(...durs):(durs[0]||0);
  const wakes=Math.max(0,blocks-1);
  const gaps=[];
  for(let i=0;i<segs.length-1;i++){
    const g=gapMinutesBetweenSleeps(segs[i],segs[i+1]);
    if(g>0&&g<600)gaps.push(g);
  }
  const avgGap=gaps.length?Math.round(gaps.reduce((x,y)=>x+y,0)/gaps.length):0;
  const wakeYmd=sleepWakeCalendarDay(last);
  return{
    bedYmd,
    bedClock:first.start,
    wakeYmd:wakeYmd||todayStr(),
    wakeClock:last.end,
    totalSleep,
    blocks,
    wakes,
    maxBlock,
    minBlock,
    avgGap,
    segs
  };
}

function getLastCompletedSleep(){const r=entries.filter(e=>e.type==='sleep'&&e.end);r.sort((a,b)=>sleepEndDate(b)-sleepEndDate(a));return r[0]||null;}
function getDaysWithData(){return[...new Set(entries.filter(e=>e.type==='sleep'&&e.durationMins).map(e=>e.date))].sort();}

window.getDaySummary=getDaySummary;
