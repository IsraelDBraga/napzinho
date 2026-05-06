/* ---- STATS ---- */
let __chartJsLoadPromise=null;
function ensureChartJs(){
  if(typeof window.Chart!=='undefined')return Promise.resolve(window.Chart);
  if(__chartJsLoadPromise)return __chartJsLoadPromise;
  __chartJsLoadPromise=new Promise((resolve,reject)=>{
    const src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    const existing=[...document.querySelectorAll('script[src]')].find(s=>s.src===src);
    if(existing){
      existing.addEventListener('load',()=>resolve(window.Chart),{once:true});
      existing.addEventListener('error',()=>reject(new Error('chart_load_failed')),{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=src;
    s.async=true;
    s.onload=()=>resolve(window.Chart);
    s.onerror=()=>reject(new Error('chart_load_failed'));
    document.head.appendChild(s);
  });
  return __chartJsLoadPromise;
}
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
    if(typeof window.Chart==='undefined'){
      const warn=document.createElement('div');
      warn.style.cssText='padding:12px;margin-top:10px;border-radius:var(--r-sm);background:var(--surface-0);color:var(--ink-muted);font-size:12px';
      warn.textContent='Carregando gráficos...';
      charts.appendChild(warn);
      ensureChartJs()
        .then(()=>{
          if($('sec-stats')?.classList.contains('active'))renderStats();
        })
        .catch(()=>{warn.textContent='Gráfico indisponível agora.';});
      return;
    }
    if(barChart)barChart.destroy();const ctxBar=$('barChart');if(ctxBar){barChart=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{data:slots,backgroundColor:(c)=>{const grad=c.chart.ctx.createLinearGradient(0,0,0,150);grad.addColorStop(0,'#A78BFA');grad.addColorStop(1,'rgba(167,139,250,.15)');return grad;},borderRadius:8,borderSkipped:false,barThickness:14}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1C1940',titleFont:{size:11},bodyFont:{size:11},callbacks:{label:c=>c.parsed.y+' min'}}},scales:{y:{max:60,ticks:{callback:v=>v+'m',color:'#8B87B8',font:{size:10}},grid:{color:'rgba(148,163,255,.08)'}},x:{ticks:{color:'#8B87B8',font:{size:10}},grid:{display:false}}}}});}
    const fc=td.filter(e=>e.type==='feed').length,dc=td.filter(e=>e.type==='diaper').length,sc=sleeps.length;
    if(donutChart)donutChart.destroy();const ctxD=$('donutChart');if(ctxD&&sc+fc+dc>0){donutChart=new Chart(ctxD,{type:'doughnut',data:{labels:['Sono','Mamada','Fralda'],datasets:[{data:[sc,fc,dc],backgroundColor:['#A78BFA','#22D3EE','#F59E0B'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false}}}});}
  }catch(chartErr){
    if(window.__nestRenderErrors&&Array.isArray(window.__nestRenderErrors)){
      window.__nestRenderErrors.push({name:'renderStatsCharts',message:String(chartErr&&chartErr.message||chartErr),stack:String(chartErr&&chartErr.stack||''),time:new Date().toISOString()});
    }
    console.error('[charts failed]',chartErr);const warn=document.createElement('div');warn.style.cssText='padding:12px;margin-top:10px;border-radius:var(--r-sm);background:var(--surface-0);color:var(--ink-muted);font-size:12px';warn.textContent='Gráfico indisponível agora.';charts.appendChild(warn);
  }
  }catch(err){
    if(window.__nestRenderErrors&&Array.isArray(window.__nestRenderErrors)){
      window.__nestRenderErrors.push({name:'renderStats',message:String(err&&err.message||err),stack:String(err&&err.stack||''),time:new Date().toISOString()});
    }
    console.error('[renderStats failed]',err);statsFallback();
  }
}
