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
  if(/[",\n\r]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

function exportCsv(){
  const list=(Array.isArray(entries)?entries:[]).slice();
  // Stable-ish order: date + time/start + id
  list.sort((a,b)=>{
    const da=(a&&a.date)||'',db=(b&&b.date)||'';
    if(da!==db) return da<db?-1:1;
    const ta=(a&&((a.start||a.time)||''))||'',tb=(b&&((b.start||b.time)||''))||'';
    if(ta!==tb) return ta<tb?-1:1;
    return (Number(a&&a.id)||0)-(Number(b&&b.id)||0);
  });
  const header=[
    'id','type','date','start','end','durationMins',
    'subtype','sleepKind','feedType','diaperType','source'
  ];
  const rows=[header.join(',')];
  for(const e of list){
    if(!e||typeof e!=='object') continue;
    rows.push([
      e.id??'',
      e.type??'',
      e.date??'',
      e.start??e.time??'',
      e.end??'',
      e.durationMins??'',
      e.subtype??'',
      e.sleepKind??'',
      e.feedType??'',
      e.diaperType??'',
      e.source??''
    ].map(toCsvCell).join(','));
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
    return `<tr><td>${esc(e.date||'')}</td><td>${esc(when)}</td><td>${esc(t)}</td><td>${esc(sub)}</td><td style="text-align:right">${esc(dur)}</td></tr>`;
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
  <div class="noprint" style="margin-bottom:10px">
    <button onclick="window.print()">Imprimir / Salvar como PDF</button>
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
  // Give the browser a tick before printing.
  setTimeout(()=>{try{w.focus();w.print();}catch{}},200);
  return {ok:true};
}

window.exportData=exportData;
window.exportCsv=exportCsv;
window.printReport=printReport;

