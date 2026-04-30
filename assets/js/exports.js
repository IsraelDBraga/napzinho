/* ---- exports (JSON/CSV/PDF) ---- */
function downloadTextFile(filename, text, mime='text/plain'){
  const safeName=String(filename||'download.txt').replace(/[^\w.\-]+/g,'_');
  const txt=String(text==null?'':text);
  try{
    const blob=new Blob([txt],{type:mime+';charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {ok:true};
  }catch(err){
    // iOS/Safari fallback: show copyable payload
    try{prompt('Falha no download automático. Copie o conteúdo abaixo:',txt);}catch{}
    return {ok:false,error:String(err&&err.message||err)};
  }
}

function getAppLocale(){
  // Prefer explicit app UI language if available, fallback to cfg, then browser.
  try{
    const sel=document.getElementById('cfg-language');
    const v=sel&&typeof sel.value==='string'?sel.value.trim():'';
    if(v) return v;
  }catch{}
  try{
    const v=(cfg&&typeof cfg.language==='string')?cfg.language.trim():'';
    if(v) return v;
  }catch{}
  const nav=(navigator&&navigator.language)?String(navigator.language):'pt-BR';
  return nav||'pt-BR';
}

function isPt(locale){return /^pt\b/i.test(String(locale||''));}

function formatDateForLocale(ymd, locale){
  if(!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return String(ymd||'');
  const [y,m,d]=ymd.split('-');
  if(isPt(locale)) return `${d}/${m}/${y}`;
  // en-US style
  return `${m}/${d}/${y}`;
}

function exportData(){
  // Prefer canonical backup payload (profiles + cfg) to keep consistency.
  if(typeof exportBackupJson==='function') return exportBackupJson();
  const payload={appName:typeof APP_NAME!=='undefined'?APP_NAME:'Nest',appVersion:typeof APP_VERSION!=='undefined'?APP_VERSION:'',exportedAt:new Date().toISOString(),entries:Array.isArray(entries)?entries:[],cfg:typeof cfg==='object'?cfg:{}};
  const txt=JSON.stringify(payload,null,2);
  downloadTextFile('nest-export-'+(typeof todayStr==='function'?todayStr():'')+'.json',txt,'application/json');
  try{showToast('Exportado');}catch{}
  return payload;
}

function toCsvCell(v){
  const s=String(v==null?'':v);
  if(/[",;\n\r]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

function exportCsv(){
  const locale=getAppLocale();
  const sep=isPt(locale)?';':',';
  const list=(Array.isArray(entries)?entries:[]).slice();
  // Stable-ish order: date + time/start + id
  list.sort((a,b)=>{
    const da=(a&&a.date)||'',db=(b&&b.date)||'';
    if(da!==db) return da<db?-1:1;
    const ta=(a&&((a.start||a.time)||''))||'',tb=(b&&((b.start||b.time)||''))||'';
    if(ta!==tb) return ta<tb?-1:1;
    return (Number(a&&a.id)||0)-(Number(b&&b.id)||0);
  });
  const hdrPt=['id','tipo','data','hora_início','hora_fim','duração_min','detalhe','sono','mamada','fralda','origem'];
  const hdrEn=['id','type','date','start_time','end_time','duration_min','detail','sleep_kind','feed_type','diaper_type','source'];
  const header=isPt(locale)?hdrPt:hdrEn;
  const rows=[header.map(toCsvCell).join(sep)];

  const typeLabel=(t)=>{
    const tt=String(t||'');
    if(!isPt(locale)) return tt;
    if(tt==='sleep') return 'sono';
    if(tt==='feed') return 'mamada';
    if(tt==='diaper') return 'fralda';
    if(tt==='mood') return 'humor';
    return tt;
  };
  const sleepKindLabel=(k)=>{
    const kk=String(k||'');
    if(!isPt(locale)) return kk;
    if(kk==='night') return 'noite';
    if(kk==='nap') return 'soneca';
    return kk;
  };

  for(const e of list){
    if(!e||typeof e!=='object') continue;
    const detail=e.subtype??e.feedType??e.diaperType??'';
    rows.push([
      e.id??'',
      typeLabel(e.type),
      formatDateForLocale(e.date, locale),
      e.start??e.time??'',
      e.end??'',
      e.durationMins??'',
      detail,
      sleepKindLabel(e.sleepKind??''),
      e.feedType??'',
      e.diaperType??'',
      e.source??''
    ].map(toCsvCell).join(sep));
  }
  const csv=rows.join('\n');
  downloadTextFile('nest-export-'+(typeof todayStr==='function'?todayStr():'')+'.csv',csv,'text/csv');
  try{showToast('CSV exportado');}catch{}
  return {rows:list.length};
}

function printReport(){
  // "PDF" is produced via the browser print dialog (Save as PDF).
  const w=window.open('','nest-report','noopener,noreferrer');
  if(!w){
    try{showToast('Não foi possível abrir o relatório (bloqueado).');}catch{}
    return {ok:false,error:'popup_blocked'};
  }
  const locale=getAppLocale();
  const name=(cfg&&cfg.name)||'Bebê';
  const ymd=(typeof todayStr==='function')?todayStr():'';
  const day=typeof getDaySummary==='function'?getDaySummary(ymd,new Date()):null;
  const night=typeof analyzeLastCompleteNight==='function'?analyzeLastCompleteNight(new Date()):null;
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtMins=m=>{const n=Math.max(0,Math.round(Number(m)||0));const h=Math.floor(n/60),r=n%60;return h?`${h}h ${String(r).padStart(2,'0')}m`:`${r}m`;};
  const entriesCount=Array.isArray(entries)?entries.length:0;
  const rows=(Array.isArray(entries)?entries:[]).slice(-120).map(e=>{
    const t=e.type||'';
    const when=(e.start||e.time||'');
    const dur=(e.type==='sleep'&&e.durationMins)?fmtMins(e.durationMins):'';
    const sub=e.subtype||e.feedType||e.diaperType||'';
    return `<tr><td>${esc(formatDateForLocale(e.date, locale))}</td><td>${esc(when)}</td><td>${esc(t)}</td><td>${esc(sub)}</td><td style="text-align:right">${esc(dur)}</td></tr>`;
  }).join('');
  w.document.open();
  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório — Nest</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#111}
  h1{font-size:20px;margin:0 0 6px}
  .muted{color:#555;font-size:12px;margin:0 0 14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 18px}
  .card{border:1px solid #ddd;border-radius:12px;padding:12px}
  .k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-bottom:6px}
  .v{font-size:16px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{border-bottom:1px solid #eee;padding:8px 6px;font-size:12px}
  th{text-align:left;color:#555;font-weight:700}
  @media print{body{margin:12mm} .noprint{display:none}}
</style>
</head>
<body>
  <div class="noprint" style="margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <button onclick="window.print()">Imprimir / Salvar como PDF</button>
    <span class="muted" style="margin:0">No iPhone: se não abrir, use o menu Compartilhar → Imprimir → Salvar como PDF.</span>
  </div>
  <h1>Relatório — ${esc(name)}</h1>
  <p class="muted">Gerado em ${esc(new Date().toLocaleString())} · Total de registros: ${entriesCount}</p>
  <div class="grid">
    <div class="card">
      <div class="k">Resumo do dia (sonecas)</div>
      <div class="v">${day?esc(fmtMins(day.sleepTotal||0)):'—'}</div>
      <div class="muted">${day?esc(String(day.naps||0))+' soneca(s)':'Sem dados suficientes.'}</div>
    </div>
    <div class="card">
      <div class="k">Última noite (referência)</div>
      <div class="v">${night?esc(fmtMins(night.totalSleep||0)):'—'}</div>
      <div class="muted">${night?esc((night.bedYmd||'')+' · '+(night.bedClock||'')+' → '+(night.wakeClock||'')):'Sem noite fechada.'}</div>
    </div>
  </div>
  <div class="card">
    <div class="k">Eventos recentes</div>
    <table>
      <thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Detalhe</th><th style="text-align:right">Duração</th></tr></thead>
      <tbody>${rows||''}</tbody>
    </table>
    <p class="muted" style="margin-top:10px">Obs.: Este relatório é um resumo. O Nest não substitui orientação médica.</p>
  </div>
</body></html>`);
  w.document.close();
  // Don't auto-print: iOS often blocks prints not triggered directly by user gesture.
  try{w.focus();}catch{}
  try{showToast('Relatório aberto. Toque em “Imprimir / Salvar como PDF”.');}catch{}
  return {ok:true,mode:'report_window'};
}

window.exportData=exportData;
window.exportCsv=exportCsv;
window.printReport=printReport;

