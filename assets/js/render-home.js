/* ---- ORBITAL HERO ---- */
function buildOrbitNodes(){const ymd=todayStr();const today=calendarDayEntries(ymd);const nodes=[];const boundary=dayBoundaryMins(),nightSt=nightStartMinsVal();today.filter(e=>e.type==='sleep').forEach(e=>{const m=timeToMins(e.start);nodes.push({type:'sleep',icon:'moon',time:e.start,mins:m,isNight:sleepIsNight(e)});});today.filter(e=>e.type==='feed').slice(-2).forEach(e=>{nodes.push({type:'feed',icon:'bottle',time:e.start,mins:timeToMins(e.start)});});return nodes;}
function renderOrbit(){
  const wrap=$('orbit-wrap');if(!wrap)return;
  const kicker=$('orbit-kicker'),main=$('orbit-main'),sub=$('orbit-sub'),ctaLbl=$('orbit-cta-label'),cta=$('orbit-cta');
  const active=getActiveSleep();
  const last=getLastCompletedSleep();
  const today=calendarDayEntries(todayStr());
  const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);

  // Decide what the center shows
  let title='',subText='',ctaText='Registrar agora',ctaFn='log';
  let predObj=null;
  if(active){
    // Sleeping right now
    const st=parseTimeOnDate(active.start,active.date);
    const mins=Math.max(0,Math.round((now()-st)/60000));
    kicker.textContent=sleepIsNight(active)?'Noite em curso':'Soneca em curso';
    title='<span>'+fmtDurShort(mins).replace(/^(\d+h)/, '$1 ').replace(/^(\d+m)$/, '$1')+'</span>';
    main.innerHTML=fmtDurShort(mins).split('h').length>1 ? `${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>` : `${mins}<small>min</small>`;
    sub.textContent='Dormiu às '+active.start+' · toque em Acordou quando despertar.';
    ctaLbl.textContent='Acordou agora';
    cta.dataset.action='wake';
    cta.onclick=()=>{babyWoke();};
  }else if(isNightContextForClock(fmtTime(now()))){
    // Inside the physiological night window — suggest night sleep, don't predict it as far away
    const mSinceLast=last?Math.max(0,Math.floor((now()-sleepEndDate(last))/60000)):null;
    kicker.textContent='Janela noturna';
    main.innerHTML='<span class="serif" style="font-size:36px;line-height:1.1">Hora de dormir</span>';
    sub.textContent=mSinceLast!=null?'Desperto há '+fmtDur(mSinceLast)+'. Toque em Dormiu quando adormecer.':'Início da noite foi às '+(cfg.nightStart||'18:00')+'. Toque em Dormiu quando adormecer.';
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else if(last&&wakeCountsAsDayForPredictions(last)){
    // Daytime — show next nap (if manual end time pushed prediction into the past, don't fake a ~24h countdown)
    const p=smartPredictNextNap(last.end,last.durationMins||0,ts);
    const fallsNight=timeToMins(p.center)>=nightStartMinsVal();
    predObj=fallsNight?nightStartPrediction():p;
    const nowM=timeToMins(fmtTime(now()));
    const toM=predObj.to!=null?timeToMins(p.to):null;
    const overdueNap=!fallsNight&&toM!=null&&nowM>toM;
    const mins=fallsNight?formatTimeUntil(predObj.center):formatTimeUntilNapIfDay(predObj.center);
    if(overdueNap){
      const late=Math.min(24*60,nowM-toM);
      kicker.textContent='Soneca em atraso';
      main.innerHTML=late<60?`${late}<small>min</small>`:`${Math.floor(late/60)}<small>h</small> ${String(late%60).padStart(2,'0')}<small>min</small>`;
      sub.textContent='Depois da faixa '+predObj.from+'–'+predObj.to+' · '+predObj.basis;
    }else{
      kicker.textContent=fallsNight?'Rotina da noite em':'Próxima soneca em';
      main.innerHTML=mins<60?`${mins}<small>min</small>`:`${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>`;
      sub.textContent='Faixa provável '+predObj.from+'–'+predObj.to+' · '+predObj.basis;
    }
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else if(last){
    // Daytime (sleep ended during day) but outside active-nap logic — show night routine
    const p=nightStartPrediction();
    predObj=p;
    const mins=formatTimeUntil(p.center);
    kicker.textContent='Rotina da noite em';
    main.innerHTML=mins<60?`${mins}<small>min</small>`:`${Math.floor(mins/60)}<small>h</small> ${String(mins%60).padStart(2,'0')}<small>min</small>`;
    sub.textContent='Janela típica '+p.from+'–'+p.to+' · '+p.basis;
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }else{
    // No data yet
    kicker.textContent='Bem-vindo';
    main.innerHTML='—';
    sub.textContent='Registre o primeiro sono para começarmos a aprender o ritmo.';
    ctaLbl.textContent='Dormiu agora';
    cta.onclick=()=>{babySlept();};
  }

  // Orbit arc (progress of awake window)
  const arc=$('orbit-arc');
  if(arc){
    const R=120,CX=150,CY=150;
    let pct=0;
    if(active){pct=Math.min(1,Math.round((now()-parseTimeOnDate(active.start,active.date))/60000)/60);}
    else if(last&&wakeCountsAsDayForPredictions(last)){
      const aw=wwCurrentAwakeMinutes();
      const tgt=Math.max(1,wwCurrentTargetMinutes()||0);
      // Arc: clamp for normal rendering; if overdue, draw a full ring (Safari can glitch on >1).
      const ratio=aw/tgt;
      pct=Math.min(1,Math.max(0,ratio));
    }
    if(pct>=0.999){
      // Full circle path (two arcs) to avoid SVG elliptical arc edge cases.
      arc.setAttribute('d',`M ${CX} ${CY-R} A ${R} ${R} 0 1 1 ${CX} ${CY+R} A ${R} ${R} 0 1 1 ${CX} ${CY-R}`);
      // continue to nodes
    }else{
    const theta=-Math.PI/2+pct*Math.PI*2;
    const x=CX+R*Math.cos(theta),y=CY+R*Math.sin(theta);
    const large=pct>0.5?1:0;
    arc.setAttribute('d',pct>0.01?`M ${CX} ${CY-R} A ${R} ${R} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`:'');
    }
  }

  // Orbit nodes (sleeps/feeds of today plotted on circle by time)
  const host=$('orbit-nodes');if(host){
    const ymd=todayStr();
    const items=[];
    const push=(icon,time,mins,active,subLbl,tone)=>items.push({icon,time,mins,active,subLbl,tone});
    today.filter(e=>e.type==='sleep').forEach(e=>{push('moon',e.start,timeToMins(e.start),false,sleepIsNight(e)?'noite':'soneca','sleep');});
    today.filter(e=>e.type==='feed').slice(-3).forEach(e=>{push('feed',e.start,timeToMins(e.start),false,'mamada','feed');});
    if(predObj){push(predObj===nightStartPrediction()?'moon':'sun',predObj.center,predObj.centerMin,true,'próxima','next');}
    const nowM=timeToMins(fmtTime(now()));
    // Map mins (0-1439) -> angle on circle. Use a 12h window centered on NOW.
    const win=12*60;const start=nowM-win/2;
    const html=items.map(it=>{
      let rel=it.mins-start;while(rel<0)rel+=1440;while(rel>=1440)rel-=1440;
      if(rel>win)return '';
      const theta=-Math.PI/2+(rel/win)*Math.PI*2;
      const R=125;
      const x=50+(R/3)*Math.cos(theta),y=50+(R/3)*Math.sin(theta);
      const icon=it.icon==='moon'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>':it.icon==='sun'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6z"/></svg>';
      return `<div class="orbit-node ${it.active?'active':''}" style="left:${50+(Math.cos(theta)*42)}%;top:${50+(Math.sin(theta)*42)}%">
        <div class="on-dot">${icon}</div>
        <div class="on-time">${escHtml(it.time)}</div>
      </div>`;
    }).join('');
    host.innerHTML=html;
  }

  // Twinkle stars
  const stars=document.querySelector('.orbit-stars');
  if(stars&&!stars.dataset.rendered){stars.dataset.rendered='1';let s='';for(let i=0;i<28;i++){const x=Math.random()*100,y=Math.random()*100,d=Math.random()*3;s+=`<span style="left:${x}%;top:${y}%;animation-delay:${d}s"></span>`;}stars.innerHTML=s;}
}

/* ---- Status cards ---- */
function renderStatusRow(){
  const host=$('status-row');if(!host)return;
  const lastSleep=getLastCompletedSleep();
  const lastFeed=entries.filter(e=>e.type==='feed').sort((a,b)=>{const da=new Date(a.date+'T12:00:00'),db=new Date(b.date+'T12:00:00');return db-da||timeToMins(b.start)-timeToMins(a.start);})[0];
  let sleepHtml='<div class="status-card" style="--tone:var(--c-sleep)"><div class="sc-label">Último sono</div><div class="sc-main">—</div><div class="sc-sub">Sem registros ainda.</div></div>';
  if(lastSleep){const mSince=Math.max(0,Math.round((now()-sleepEndDate(lastSleep))/60000));sleepHtml=`<div class="status-card" style="--tone:var(--c-sleep)"><div class="sc-label">${sleepIsNight(lastSleep)?'Última noite':'Última soneca'}</div><div class="sc-main">${fmtDurShort(lastSleep.durationMins||0)}</div><div class="sc-sub">Acordou há ${fmtDur(mSince)} · ${lastSleep.start} → ${lastSleep.end||'—'}</div></div>`;}
  let feedHtml='<div class="status-card" style="--tone:var(--c-feed)"><div class="sc-label">Última mamada</div><div class="sc-main">—</div><div class="sc-sub">Toque no + para registrar.</div></div>';
  if(lastFeed){const since=Math.max(0,Math.round((now()-parseTimeOnDate(lastFeed.start,lastFeed.date))/60000));feedHtml=`<div class="status-card" style="--tone:var(--c-feed)"><div class="sc-label">Última mamada</div><div class="sc-main">${fmtDurShort(since)}</div><div class="sc-sub">${escHtml(lastFeed.subtype==='breast'?'Seio':'Mamadeira')} · ${lastFeed.start}${lastFeed.durationMins?' · '+lastFeed.durationMins+'min':''}</div></div>`;}
  host.innerHTML=sleepHtml+feedHtml;
}

/* ---- Insight ---- */
function buildDayFlowRead(){const ymd=todayStr(),td=calendarDayEntries(ymd);const naps=td.filter(e=>e.type==='sleep'&&e.durationMins&&!sleepIsNight(e));const napMin=naps.reduce((a,e)=>a+(e.durationMins||0),0);const late=naps.filter(e=>timeToMins(e.start)>=nightStartMinsVal()-90);const feeds=td.filter(e=>e.type==='feed').length,di=td.filter(e=>e.type==='diaper').length;const mo=td.filter(e=>e.type==='mood').length;const g=calendarDayEntries(ymd).filter(e=>e.type==='mood'&&e.subtype==='gas').length;let flow='O dia ainda está no começo para termos uma leitura robusta.';let tone='neutral';if(naps.length>=1){if(naps.length>=4||(napMin<90&&naps.length>=2)){flow='Dia <strong>fragmentado</strong>: várias sonecas curtas. Espere humor mais sensível à tarde.';tone='warn';}else if(late.length){flow='Houve <strong>soneca tardia</strong> (perto da noite). A entrada na noite pode atrasar.';tone='warn';}else if(napMin>=90){flow='Boa <strong>base de descanso</strong> de dia — o motor abre a janela com mais folga.';tone='ok';}else{flow='Dia <strong>no ritmo</strong> para o que foi registrado até agora.';tone='ok';}}const bot=naps.length>=4?'Sonecas muitas e curtas — consolide a próxima.':(late.length?'Soneca perto do horário da noite — cuidado com o atraso.':(g>=3?'Muitos sinais de gases — pode puxar a próxima janela pra menos.':(feeds<2&&naps.length>0&&babyAgeMonths()<=3?'Poucas mamadas para o tamanho do dia.':'Sem gargalo óbvio agora.')));return{flow,bot,tone,stats:{napMin,feeds,di,mo,naps:naps.length}};}
function renderInsight(){const host=$('home-insight');if(!host)return;const d=buildDayFlowRead();const chipCls=d.tone==='warn'?'warn':d.tone==='ok'?'ok':'';host.innerHTML=`<div class="insight"><div class="insight-kicker">Leitura do dia</div><div class="insight-title">${d.flow}</div><div class="insight-body"><strong>Atenção:</strong> ${escHtml(d.bot)}</div><div class="insight-chip ${chipCls}">${d.stats.naps} sonecas · ${d.stats.feeds} mamadas · ${d.stats.di} fraldas</div></div>`;}

/* ---- Predictions list ---- */
function renderPredictions(){
  const list=$('pred-list'),badge=$('home-conf-badge');if(!list)return;
  const dm=dataMaturity();if(badge){badge.textContent=dm.label;badge.style.color=dm.conf==='high'?'var(--mint)':dm.conf==='mid'?'var(--sun)':'var(--lilac)';}
  const today=calendarDayEntries(todayStr());
  const activeSleep=getActiveSleep();
  const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);
  const lastSleep=getLastCompletedSleep();
  const nsM=nightStartMinsVal();
  const preds=[];
  const insideNight=isNightContextForClock(fmtTime(now()));
  // ActiveSleepGuard: warn when an active sleep is implausibly long (never auto-close).
  try{
    const st=(typeof ActiveSleepGuard!=='undefined'&&ActiveSleepGuard.getActiveSleepStatus)?ActiveSleepGuard.getActiveSleepStatus(now()):null;
    if(st&&st.needsConfirmation&&st.actions&&st.actions.length){
      const title='Esse sono ainda está em andamento?';
      const sub=`Ele começou há ${fmtDurShort(st.activeMins)}.`;
      const body='Se o bebê já acordou, registre o horário para manter as previsões corretas.';
      const btns=st.actions.map(a=>`<button type="button" class="cop-pill ${a.variant==='primary'?'primary':''}" onclick="handleActiveSleepGuardAction('${escHtml(a.action)}')">${escHtml(a.label)}</button>`).join('');
      preds.push({kind:'active-sleep-guard',_html:`<div class="cop-block" style="margin-bottom:12px"><div class="cb-kicker">Confirmação</div><h4>${escHtml(title)}</h4><p>${escHtml(sub)}</p><p style="margin-top:8px">${escHtml(body)}</p><div class="cb-actions">${btns}</div></div>`});
    }
  }catch(e){}
  if(activeSleep){
    preds.push({kind:'sleep-now',name:sleepIsNight(activeSleep)?'Noite em andamento':'Soneca em andamento',sub:'Registre Acordou quando despertar',pred:{center:activeSleep.start,from:activeSleep.start,to:activeSleep.start,basis:'sono ativo'},color:sleepIsNight(activeSleep)?'#6366F1':'#A78BFA'});
  }else if(insideNight){
    preds.push({kind:'night-now',name:'Janela noturna ativa',sub:'Toque em Dormiu quando adormecer',pred:{center:cfg.dayBoundary||'06:00',from:cfg.nightStart||'18:00',to:cfg.dayBoundary||'06:00',basis:'janela fisiológica configurada'},color:'#6366F1'});
  }else if(lastSleep&&lastSleep.end){
    if(wakeCountsAsDayForPredictions(lastSleep)){
      const p=smartPredictNextNap(lastSleep.end,lastSleep.durationMins||0,ts);
      if(timeToMins(p.center)>=nsM){const np=nightStartPrediction();preds.push({kind:'night',name:'Entrada da noite',sub:'Primeiro sono longo',pred:np,color:'#6366F1'});}
      else{preds.push({kind:'nap',name:'Próxima soneca',sub:'A partir do último despertar',pred:p,color:'#A78BFA'});const np=nightStartPrediction();preds.push({kind:'night',name:'Rotina da noite',sub:'Hora de desacelerar',pred:np,color:'#6366F1'});}
    }else{const np=nightStartPrediction();preds.push({kind:'night',name:'Rotina da noite',sub:'Fim do dia se aproximando',pred:np,color:'#6366F1'});}
  }
  const lf=today.filter(e=>e.type==='feed').sort((a,b)=>timeToMins(b.start)-timeToMins(a.start))[0]||entries.filter(e=>e.type==='feed').sort((a,b)=>b.id-a.id)[0];
  if(lf){const p=smartPredictNextFeed(lf.start);preds.push({kind:'feed',name:'Próxima mamada',sub:insideNight?'Noturna — bebês pequenos ainda mamam de madrugada':'Ritmo dos últimos intervalos',pred:p,color:'#22D3EE'});}
  let listHtml;
  if(!preds.length){listHtml='<div class="empty-pretty"><h4>Vamos começar a medir</h4><p>Registre um sono com início e fim, e uma mamada. A próxima janela aparece aqui com faixa e motivo.</p></div>';}
  else{const iconSvg={sleep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',nap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg>',night:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6zM10 11h4"/></svg>'};
  listHtml=preds.map(p=>{
    if(p.kind==='active-sleep-guard' && p._html) return p._html;
    const risk=p.kind==='nap'?getWakeRisk(wwCurrentAwakeMinutes(),wwCurrentTargetMinutes()):null;
    const ico=iconSvg[p.kind==='night-now'?'night':p.kind==='sleep-now'?'sleep':p.kind]||iconSvg.nap;
    let right;
    if(p.kind==='night-now'||p.kind==='sleep-now'){
      right=`<div class="pclock" style="font-size:16px">agora</div><div class="prange">desperta ~${escHtml(p.pred.center)}</div>`;
    }else{
      const nowM=timeToMins(fmtTime(now())),centerM=timeToMins(p.pred.center);
      let diff=centerM-nowM;if(diff<0)diff+=1440;
      const nowDay=nowM>=dayBoundaryMins()&&nowM<nightStartMinsVal();
      const centerDay=centerM>=dayBoundaryMins()&&centerM<nightStartMinsVal();
      const overdueMin=(nowDay&&centerDay&&centerM<nowM)?(nowM-centerM):0;
      const timeLbl=overdueMin>0?`<span style="color:var(--rose)">atrasada ~${overdueMin} min</span>`:`em ${diff} min · ${escHtml(p.pred.from)}–${escHtml(p.pred.to)}`;
      right=`<div class="pclock">${escHtml(p.pred.center)}</div><div class="prange">${timeLbl}</div>`;
    }
    return `<div class="pred-row" style="--pcol:${p.color}"><div class="pico">${ico}</div><div class="pmid"><div class="pname">${escHtml(p.name)}</div><div class="psub">${escHtml(p.sub)}</div><div class="pbase">${escHtml(p.pred.basis||'')}</div>${risk?`<span class="risk ${risk.lvl}">${escHtml(risk.msg)}</span>`:''}</div><div class="ptime">${right}</div></div>`;
  }).join('');}
  list.innerHTML=listHtml;
}

/* ---- Glance ---- */
function renderGlance(){const host=$('glance');if(!host)return;const ymd=todayStr();const td=calendarDayEntries(ymd);const total=totalSleepMinsCalendarDay(ymd);const html=`<div class="glance-cell" data-tone="sleep"><div class="glance-val">${fmtDurShort(total)}</div><div class="glance-lbl">Sono</div></div><div class="glance-cell" data-tone="feed"><div class="glance-val">${td.filter(e=>e.type==='feed').length}</div><div class="glance-lbl">Mamadas</div></div><div class="glance-cell" data-tone="diaper"><div class="glance-val">${td.filter(e=>e.type==='diaper').length}</div><div class="glance-lbl">Fraldas</div></div><div class="glance-cell" data-tone="night"><div class="glance-val">${nightWakeCountBetweenSegments(ymd)}</div><div class="glance-lbl">Despertares</div></div>`;host.innerHTML=html;}

/* ---- Night panel ---- */
function renderNightPanel(){const host=$('night-panel-wrap');if(!host)return;const an=analyzeLastCompleteNight();const ymd=todayStr();const segs=nightSegmentsOnWakeDay(ymd);if(!segs.length){host.innerHTML='';return;}const first=segs[0],last=segs[segs.length-1];const total=segs.reduce((a,e)=>a+(e.durationMins||0),0);const waves=[];for(let i=0;i<segs.length;i++){waves.push(`<span class="nseg-pill sl">${fmtDurShort(segs[i].durationMins||0)}</span>`);if(i<segs.length-1){const g=gapMinutesBetweenSleeps(segs[i],segs[i+1]);if(g)waves.push(`<span class="nseg-pill aw">↑ ${fmtDurShort(g)}</span>`);}}const wakes=an?an.wakes:Math.max(0,segs.length-1);const html=`<div class="night-panel"><div class="night-head"><span class="nh-kicker">Noite — referência principal</span><span class="nh-range">${first.start} → ${last.end||'—'}</span></div><div class="night-metrics"><div class="night-metric"><div class="night-metric-val">${fmtDurShort(total)}</div><div class="night-metric-lbl">Total</div></div><div class="night-metric"><div class="night-metric-val">${segs.length}</div><div class="night-metric-lbl">Trechos</div></div><div class="night-metric"><div class="night-metric-val">${wakes}</div><div class="night-metric-lbl">Despertares</div></div></div><div class="night-segs">${waves.join('')}</div><p class="night-foot">A noite não reseta na meia-noite — começa no primeiro sono após ${cfg.nightStart} e fecha quando o bebê acorda de manhã.</p></div>`;host.innerHTML=html;}

/* ---- Today rail (horizontal timeline) ---- */
function renderTodayRail(){const host=$('today-rail'),count=$('today-rail-count');if(!host)return;const ymd=todayStr();const ev=calendarDayEntries(ymd).slice().sort((a,b)=>{const ta=a.start||'00:00',tb=b.start||'00:00';return timeToMins(ta)-timeToMins(tb);});if(count)count.textContent=ev.length+' eventos';let inner;if(!ev.length){inner='<div class="trail-empty">Nenhum registro hoje ainda — toque em + para começar.</div>';}else{const tone={sleep:'#A78BFA',feed:'#22D3EE',diaper:'#F59E0B',mood:'#F472B6'};const icon={sleep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>',feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 2h6v4H9zM7 6h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 6z"/></svg>',diaper:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3c-2 4-6 7-6 11a6 6 0 0012 0c0-4-4-7-6-11z"/></svg>',mood:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/></svg>'};inner='<div class="trail-track"></div><div class="trail-items">'+ev.map(e=>{const t=e.type;const dur=e.type==='sleep'&&e.durationMins?fmtDurShort(e.durationMins):'';return `<div class="trail-chip" style="--tone:${tone[t]||'#A78BFA'}"><span class="tc-ico">${icon[t]||icon.sleep}</span><span class="tc-time">${escHtml(e.start||e.time||'00:00')}</span>${dur?`<span class="tc-dur">${escHtml(dur)}</span>`:''}</div>`;}).join('')+'</div>';}host.innerHTML=inner;}

/* ---- WW timer for header update ---- */
function tickOrbit(){renderOrbit();renderStatusRow();}

/* ---- Master refresh (after any data change) ---- */
function refreshAppAfterDataChange(reason=''){
  // This centralizes all home re-renders so retroactive entries, imports, and
  // edge-case errors don't leave the UI blank after a successful save.
  const sr=(typeof safeRender==='function')?safeRender:(name,fn)=>{try{return fn();}catch(e){console.error('[render]',name,e);return null;}};
  sr('renderOrbit',()=>renderOrbit(),{containerId:'orbit-wrap'});
  sr('renderStatusRow',()=>renderStatusRow(),{containerId:'status-row'});
  sr('renderInsight',()=>renderInsight(),{containerId:'home-insight'});
  sr('renderPredictions',()=>renderPredictions(),{containerId:'pred-list',fallbackHtml:'<div class="empty-pretty"><h4>Não foi possível renderizar agora</h4><p>Tente recarregar o app. Seus dados continuam salvos.</p></div>'});
  sr('renderDaySleepPanel',()=>renderDaySleepPanel(),{containerId:'day-sleep-panel-wrap'});
  sr('renderNightPanel',()=>renderNightPanel(),{containerId:'night-panel-wrap'});
  sr('renderTodayRail',()=>renderTodayRail(),{containerId:'today-rail',fallbackHtml:'<div class="trail-empty">Falha ao renderizar a linha do dia. Recarregue o app.</div>'});

  // Keep these in sync too if the user navigates away and back.
  if(typeof updateHeader==='function') sr('updateHeader',()=>updateHeader());
  if(typeof syncSettingsForm==='function') sr('syncSettingsForm',()=>syncSettingsForm());

  return {ok:true,reason};
}
window.refreshAppAfterDataChange=refreshAppAfterDataChange;


function fmtDateBrYmd(ymd){if(!ymd||!/^\d{4}-\d{2}-\d{2}$/.test(ymd))return ymd||'';const [y,m,d]=ymd.split('-');return `${d}/${m}/${y}`;}

function renderDaySleepPanel(){
  const host=$('day-sleep-panel-wrap');if(!host)return;
  const ymd=todayStr();
  const sum=(typeof getDaySummary==='function')
    ? getDaySummary(ymd,new Date())
    : {
        sleepTotal:totalSleepMinsCalendarDay(ymd),
        sleepPeriods:calendarDayEntries(ymd).filter(e=>e.type==='sleep').length,
        feeds:calendarDayEntries(ymd).filter(e=>e.type==='feed').length,
        diapers:calendarDayEntries(ymd).filter(e=>e.type==='diaper').length,
        events:calendarDayEntries(ymd)
      };
  host.innerHTML=`<div class="night-panel day-panel" style="margin-top:14px;margin-bottom:10px"><div class="night-head"><span class="nh-kicker">Resumo do Dia</span><span class="nh-range">${escHtml(fmtDateBrYmd(ymd))}</span></div><div class="night-metrics"><div class="night-metric"><div class="night-metric-val">${fmtDurShort(sum.sleepTotal||0)}</div><div class="night-metric-lbl">Sono</div></div><div class="night-metric"><div class="night-metric-val">${sum.sleepPeriods||0}</div><div class="night-metric-lbl">Trechos</div></div><div class="night-metric"><div class="night-metric-val">${sum.feeds||0}</div><div class="night-metric-lbl">Mamadas</div></div><div class="night-metric"><div class="night-metric-val">${sum.diapers||0}</div><div class="night-metric-lbl">Fraldas</div></div></div><p class="night-foot">Resumo do dia: ${(sum.events||[]).length} eventos.</p></div>`;
}
