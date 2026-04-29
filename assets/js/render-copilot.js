/* ---- COPILOT ---- */
function moodCountToday(sub){return calendarDayEntries(todayStr()).filter(e=>e.type==='mood'&&e.subtype===sub).length;}
function renderCopilot(){
  const dm=dataMaturity();
  const hero=$('cop-hero');if(hero){hero.innerHTML=`<div class="ch-kick">Copiloto</div><h2 class="ch-title">${dm.score<35?'Está começando a entender o bebê':dm.score<65?'Já estou lendo padrões':'Leitura firme do seu ritmo'}</h2><p class="ch-sub">${escHtml(dm.hint)}</p><div class="ch-meter"><div class="ch-fill" style="width:${dm.score}%"></div></div><div class="ch-chips"><span class="cop-chip">${dm.label}</span><span class="cop-chip">${getDaysWithData().length} dias · ${entries.filter(e=>e.type==='sleep'&&e.durationMins).length} sonos</span><span class="cop-chip">${babyAgeMonths()} meses</span></div>`;}

  // Agora
  const now_=$('cop-now');if(now_){const active=getActiveSleep();const last=getLastCompletedSleep();let title,body,rule=[];if(active){title=sleepIsNight(active)?'Sono noturno em curso':'Soneca em curso';body=`Dormiu às <strong>${active.start}</strong>. Quando acordar, registre em Acordou — a noite lógica continua depois da meia-noite se for o caso.`;}else if(last&&wakeCountsAsDayForPredictions(last)){const aw=wwCurrentAwakeMinutes();const tgt=wwCurrentTargetMinutes();const r=getWakeRisk(aw,tgt);const p=smartPredictNextNap(last.end,last.durationMins||0,calendarDayEntries(todayStr()).filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0));title=r.lvl==='high'?'Janela estourando':r.lvl==='mid'?'Janela apertando':'Dentro da janela';body=`Acordado há <strong>${fmtDur(aw)}</strong>, referência ~${tgt} min para ${babyAgeMonths()} meses. Próxima soneca prevista em torno de <strong>${p.center}</strong>.`;rule=[['Acordado',fmtDur(aw)],['Alvo aprox.',tgt+' min'],['Risco',r.msg]];}else{title='Sem janela diurna agora';body='Ou o bebê está dormindo, ou ainda estamos no ritmo noturno.';}now_.innerHTML=`<div class="cop-block"><div class="cb-kicker">Agora</div><h4>${escHtml(title)}</h4><p>${body}</p>${rule.length?'<ul class="cb-rule">'+rule.map(r=>`<li><span>${escHtml(r[0])}</span><strong>${escHtml(r[1])}</strong></li>`).join('')+'</ul>':''}</div>`;}

  // Próxima janela
  const winEl=$('cop-window');if(winEl){const last=getLastCompletedSleep();const today=calendarDayEntries(todayStr());const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);if(!last){winEl.innerHTML='';}else{let p,label;if(wakeCountsAsDayForPredictions(last)){const np=smartPredictNextNap(last.end,last.durationMins||0,ts);if(timeToMins(np.center)>=nightStartMinsVal()){p=nightStartPrediction();label='Entrada da noite';}else{p=np;label='Próxima soneca';}}else{p=nightStartPrediction();label='Rotina da noite';}const nowM=timeToMins(fmtTime(now()));const napOver=label==='Próxima soneca'&&p.to!=null&&nowM>timeToMins(p.to);const mins=formatTimeUntil(p.center);const head=napOver?(`${escHtml(label)} · atrasada ~${fmtDur(nowM-timeToMins(p.to))}`):(`${escHtml(label)} em ${mins} min`);winEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Próxima janela</div><h4>${head}</h4><p>Faixa provável <strong>${escHtml(p.from)}–${escHtml(p.to)}</strong>. Base: ${escHtml(p.basis)}.</p><ul class="cb-rule"><li><span>Hora central</span><strong>${escHtml(p.center)}</strong></li><li><span>Tolerância</span><strong>±${p.range||20} min</strong></li></ul><p style="margin-top:10px;font-size:11.5px;color:var(--ink-muted)">Se atrasar muito além da faixa, a próxima soneca tende a ficar curta e a noite pode fragmentar.</p></div>`;}}

  // Leitura do dia
  const dayEl=$('cop-day');if(dayEl){const d=buildDayFlowRead();dayEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Leitura do dia</div><h4>${d.tone==='warn'?'Sinais de atenção':d.tone==='ok'?'Dia fluindo bem':'Dia sem muita sinalização'}</h4><p>${d.flow}</p><p style="margin-top:8px"><strong>Gargalo provável:</strong> ${escHtml(d.bot)}</p><ul class="cb-rule"><li><span>Sonecas</span><strong>${d.stats.naps}</strong></li><li><span>Sono diurno</span><strong>${fmtDur(d.stats.napMin)}</strong></li><li><span>Mamadas</span><strong>${d.stats.feeds}</strong></li><li><span>Sinais de humor</span><strong>${d.stats.mo}</strong></li></ul></div>`;}

  // Leitura da noite
  const nEl=$('cop-night');if(nEl){const an=analyzeLastCompleteNight();if(!an){nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>Nenhuma noite fechada ainda</h4><p>Registre <strong>Acordou</strong> de manhã para o Copiloto calcular total, despertares e maior bloco.</p></div>`;}else{const wq=an.wakes===0?'Noite contínua — ótima referência para o dia.':an.wakes>=3?'Noite fragmentada — pressão extra hoje.':'Noite dentro do comum para a idade.';nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>${fmtDur(an.totalSleep)} em ${an.blocks} trecho(s)</h4><p>${wq} Maior bloco <strong>${fmtDur(an.maxBlock)}</strong>.</p><ul class="cb-rule"><li><span>Início</span><strong>${escHtml(an.bedClock)}</strong></li><li><span>Despertar final</span><strong>${escHtml(an.wakeClock)}</strong></li><li><span>Despertares intermediários</span><strong>${an.wakes}</strong></li><li><span>Média entre trechos</span><strong>${an.avgGap?fmtDur(an.avgGap):'—'}</strong></li></ul></div>`;}}

  // Interpretação de choro (ranking)
  const cryEl=$('cop-cry');if(cryEl){cryEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Interpretação de choro</div><h4>O que pode estar acontecendo?</h4><p>Toque no contexto mais recente para ver o ranking — fome, cansaço, gases, desconforto e estímulo ponderados pelos seus registros.</p><div class="cb-actions"><button class="cop-pill primary" onclick="runCryDiagnosis()">Calcular agora</button></div><div id="cry-out" style="margin-top:12px"></div></div>`;}

  // Simulações
  const simEl=$('cop-sim');if(simEl){simEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Simulações</div><h4>E se eu…</h4><p>Rápidas projeções com base na idade e no que foi registrado.</p><div class="cb-actions"><button class="cop-pill" onclick="runSim('skipNap')">Pular soneca</button><button class="cop-pill" onclick="runSim('lateNap')">Atrasar soneca</button><button class="cop-pill" onclick="runSim('earlyNight')">Noite mais cedo</button><button class="cop-pill" onclick="runSim('shortFeed')">Mamada curta</button></div><div id="sim-out" style="margin-top:12px;padding:12px;border-radius:var(--r-sm);background:var(--surface-1);font-size:12.5px;color:var(--ink-dim);line-height:1.55;display:none"></div></div>`;}
}

function runCryDiagnosis(){
  const out=$('cry-out');if(!out)return;
  const mAge=babyAgeMonths(),tgt=wwBaseTarget(mAge);
  const lastFeed=entries.filter(e=>e.type==='feed').sort((a,b)=>{const da=new Date(a.date+'T12:00:00'),db=new Date(b.date+'T12:00:00');return db-da||timeToMins(b.start)-timeToMins(a.start);})[0];
  const lastSleep=getLastCompletedSleep();
  const feedM=lastFeed?Math.max(0,Math.round((now()-parseTimeOnDate(lastFeed.start,lastFeed.date))/60000)):999;
  const sleepM=lastSleep?Math.max(0,Math.floor((now()-sleepEndDate(lastSleep))/60000)):999;
  const gas=moodCountToday('gas'),fuss=moodCountToday('fussy'),cry=moodCountToday('crying');
  const feedRaw=lastFeed?Math.min(80,5+Math.max(0,feedM-45)*0.4+(feedM>150?25:0)):8;
  const sleepRaw=lastSleep&&wakeCountsAsDayForPredictions(lastSleep)?Math.min(85,8+Math.max(0,sleepM-tgt*0.75)*0.45+(lastSleep.durationMins<35?12:0)):6;
  const gasRaw=Math.min(55,4+gas*12+fuss*5);
  const coldBias=(cfg.ctxCold||cfg.ctxTeething||cfg.ctxOther)?10:0;
  const disRaw=12+coldBias+Math.min(18,cry*3);
  const overRaw=8+fuss*4;
  const h=[{k:'Fome',s:feedRaw,hint:lastFeed?feedM+' min desde a última mamada':'sem mamada registrada'},{k:'Cansaço',s:sleepRaw,hint:lastSleep?'acordado há '+sleepM+' min':'—'},{k:'Gases / barriga',s:gasRaw,hint:gas+' registros de gases hoje'},{k:'Desconforto',s:disRaw,hint:(cfg.ctxCold||cfg.ctxTeething)?'contexto marcado':'geral (temperatura, fralda, dor)'},{k:'Muito estímulo',s:overRaw,hint:fuss+' irritações hoje'}].sort((a,b)=>b.s-a.s);
  const max=h[0].s||1;h.forEach(x=>{x.pct=Math.round((x.s/max)*100);});
  out.innerHTML=h.map((x,i)=>`<div style="margin-bottom:10px"><div class="cop-mini-line"><span class="cm-key">${i+1}. ${escHtml(x.k)} <small style="color:var(--ink-muted);font-weight:500">· ${escHtml(x.hint)}</small></span><span class="cm-val">${x.pct}%</span></div><div class="cop-bar"><div class="cop-bar-fill" style="width:${x.pct}%"></div></div></div>`).join('')+'<p style="font-size:11px;color:var(--ink-muted);margin-top:8px">Estimativa ponderada com horários reais — não é diagnóstico médico.</p>';
}

function runSim(kind){
  const out=$('sim-out');if(!out)return;
  const m=babyAgeMonths(),base=wwBaseTarget(m),last=getLastCompletedSleep();
  const aw=last&&wakeCountsAsDayForPredictions(last)?wwCurrentAwakeMinutes():0;
  const map={skipNap:`Pulando a soneca agora: o fim do dia costuma ficar mais difícil. Com ${m} meses, janela típica ~${base} min; dobrá-la frequentemente aumenta a chance de fragmentar a noite. Se puder, proteja o primeiro sono da manhã amanhã.`,lateNap:`Atrasando a soneca: entrar na noite já cansado puxa o horário da rotina pra trás e pode encurtar o primeiro bloco da noite. Tente não ultrapassar a faixa superior de previsão em mais de 25 min.`,earlyNight:`Adiantando a noite: em dias com débito, entrar 30–40 min antes pode virar noite longa. Atenção à possibilidade de despertar precoce no dia seguinte.`,shortFeed:`Mamada curta agora costuma adiantar a próxima em 30–45 min. Observe sinais de fome na próxima janela — pode puxar a previsão de mamada pra antes.`};
  out.style.display='block';out.textContent=map[kind]||'—';
}

