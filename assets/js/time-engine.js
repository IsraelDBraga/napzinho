/* ---- utils ---- */
const $=id=>document.getElementById(id);
const now=()=>new Date();
function ymdFromDateLocal(d){
  if(!(d instanceof Date)||!Number.isFinite(d.getTime()))return '';
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
// Must not rely on locale-specific formatting (Safari/iOS sensitivity).
const todayStr=()=>ymdFromDateLocal(new Date());
const fmtTime=d=>d.toTimeString().slice(0,5);
const fmtDur=m=>{if(m==null||m<0)m=0;const h=Math.floor(m/60),r=Math.round(m%60);return h>0?(h+'h'+(r>0?' '+r+'m':'')):(r+'m');};
const fmtDurShort=m=>{if(m==null||m<0)m=0;const h=Math.floor(m/60),r=Math.round(m%60);return h>0?(h+'h'+(r>0?String(r).padStart(2,'0'):'')):(r+'m');};
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const parseTime=s=>{const[h,m]=s.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return d;};
function parseTimeOnDate(timeStr,dateStr){const[h,m]=timeStr.split(':').map(Number);const d=new Date(dateStr+'T12:00:00');d.setHours(h,m,0,0);return d;}
const timeToMins=s=>{const[h,m]=s.split(':').map(Number);return h*60+m;};
/** Minute-of-day 0–1439 for clock math. */
function normClockMin(m){const x=Math.round(Number(m));if(!Number.isFinite(x))return 0;return((x%1440)+1440)%1440;}
const minsToTime=m=>{const mm0=normClockMin(m);const h=Math.floor(mm0/60),r=mm0%60;return String(h).padStart(2,'0')+':'+String(r).padStart(2,'0');};
const fmtDateSV=d=>ymdFromDateLocal(d);
function isValidTime(s){if(!s)return false;const p=/^(\d{1,2}):(\d{2})$/.exec(s);if(!p)return false;const h=+p[1],m=+p[2];return h>=0&&h<=23&&m>=0&&m<=59;}
function isValidDateStr(s){if(!s)return false;const p=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!p)return false;const d=new Date(s+'T12:00:00');return d.getFullYear()==+p[1]&&d.getMonth()+1==+p[2]&&d.getDate()==+p[3];}
function formatShortDate(ymd){if(!ymd)return'';const p=ymd.split('-');if(p.length!==3)return ymd;return p[2]+'/'+p[1];}
function maskTime(el){let v=el.value.replace(/[^\d]/g,'');if(v.length>4)v=v.slice(0,4);if(v.length>=3){let h=parseInt(v.slice(0,2),10),m=parseInt(v.slice(2),10);if(h>23)h=23;if(v.length===4&&m>59)m=59;el.value=String(h).padStart(2,'0')+':'+v.slice(2);}else if(v.length>=1){el.value=v;}}
function maskDateBirth(el){let d=el.value.replace(/[^\d]/g,'').slice(0,8);if(d.length<=2)el.value=d;else if(d.length<=4)el.value=d.slice(0,2)+'-'+d.slice(2);else el.value=d.slice(0,2)+'-'+d.slice(2,4)+'-'+d.slice(4);}
function isoToBirthDisplay(iso){if(!iso||!isValidDateStr(iso))return'';const p=iso.split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function parseBirthDisplayToIso(s){const p=/^(\d{2})-(\d{2})-(\d{4})$/.exec((s||'').trim());if(!p)return null;const dd=+p[1],mm=+p[2],yy=+p[3];if(mm<1||mm>12||dd<1||dd>31)return null;const iso=yy+'-'+String(mm).padStart(2,'0')+'-'+String(dd).padStart(2,'0');return isValidDateStr(iso)?iso:null;}



function parseYmdLocal(ymd){const d=TimeEngine.parseYmdLocalSafe(ymd);if(!d)return new Date();d.setHours(0,0,0,0);return d;}
const TimeEngine={
  parseYmdLocalSafe(ymd){if(!isValidDateStr(ymd))return null;const [y,m,d]=ymd.split('-').map(Number);return new Date(y,m-1,d,12,0,0,0);},
  resolveClockOnDate(ymd,hhmm){const base=this.parseYmdLocalSafe(ymd);if(!base||!isValidTime(hhmm))return null;const [h,m]=hhmm.split(':').map(Number);return new Date(base.getFullYear(),base.getMonth(),base.getDate(),h,m,0,0);},
  resolveWindowOnDate(ymd,startHHMM,endHHMM){const start=this.resolveClockOnDate(ymd,startHHMM),end0=this.resolveClockOnDate(ymd,endHHMM);if(!start||!end0)return null;const end=new Date(end0);if(end<=start)end.setDate(end.getDate()+1);return{start,end};}
};

// Birthdate helpers (used by storage/config). Keep global for non-module scripts.
function babyAgeMonthsFromDate(birthIso,refDate=new Date()){
  if(!birthIso||!isValidDateStr(birthIso))return 0;
  const b=TimeEngine.parseYmdLocalSafe(birthIso);
  const t=(refDate instanceof Date && Number.isFinite(refDate.getTime()))?refDate:new Date();
  if(!(b instanceof Date)||!Number.isFinite(b.getTime()))return 0;
  let m=(t.getFullYear()-b.getFullYear())*12+(t.getMonth()-b.getMonth());
  if(t.getDate()<b.getDate())m--;
  return Math.max(0,Math.min(48,Math.floor(m)));
}
