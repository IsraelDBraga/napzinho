/* ---- COPILOT ---- */
function moodCountToday(sub){return calendarDayEntries(todayStr()).filter(e=>e.type==='mood'&&e.subtype===sub).length;}
function renderCopilot(){
  const dm=dataMaturity();
  const state=(typeof CopilotEngine==='object'&&CopilotEngine.getCurrentBabyState)?CopilotEngine.getCurrentBabyState(now()):null;
  const hyps=(typeof CopilotEngine==='object'&&CopilotEngine.scoreHypotheses&&state)?CopilotEngine.scoreHypotheses(state):[];
  const guidance=(typeof CopilotEngine==='object'&&CopilotEngine.getPrimaryGuidance&&state)?CopilotEngine.getPrimaryGuidance(state,hyps):'';
  const quality=(typeof CopilotEngine==='object'&&CopilotEngine.getDataQualitySummary&&state)?CopilotEngine.getDataQualitySummary(state):{badge:{label:dm.label,tone:dm.conf||'low'},summary:dm.hint,details:[]};

  function toneClass(t){return t==='ok'?'ok':t==='warn'?'warn':t==='danger'?'danger':'neutral';}
  function chip(label,tone='neutral'){return `<span class="cop-chip cop-chip-${toneClass(tone)}">${escHtml(label||'')}</span>`;}
  function pctLabel01(p){const v=Math.max(0,Math.min(1,Number(p)||0));return Math.round(v*100);}
  function fmtScore(s){const v=Math.max(0,Math.min(100,Math.round(Number(s)||0)));return v;}
  function renderHypothesisList(items){
    const arr=Array.isArray(items)?items:[];
    if(!arr.length)return `<div class="cop-empty">Sem hipóteses fortes agora — use as perguntas rápidas para dar contexto.</div>`;
    return `<div class="cop-hyp-grid">`+arr.slice(0,6).map(h=>{
      const score=fmtScore(h.score);
      const reasons=Array.isArray(h.reasons)?h.reasons.filter(Boolean):[];
      const caut=(h.caution||'').trim();
      const badge=score>=70?'ok':score>=45?'warn':'neutral';
      return `<div class="cop-card">
        <div class="cop-card-top">
          <div class="cop-card-title">${escHtml(h.label||h.key||'Hipótese')}</div>
          <div class="cop-score ${toneClass(badge)}">${score}</div>
        </div>
        ${reasons.length?`<ul class="cop-list">${reasons.slice(0,4).map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>`:''}
        ${caut?`<div class="cop-caution">${escHtml(caut)}</div>`:''}
      </div>`;
    }).join('')+`</div>`;
  }
  function quickQBtn(q){return `<button type="button" class="cop-pill" onclick="copilotQuickAsk('${escHtml(q)}')">${escHtml(q)}</button>`;}
  function renderAnswerCard(ans){
    if(!ans)return '';
    const safe=(ans.answer||'').trim();
    const warns=Array.isArray(ans.urgentIf)?ans.urgentIf.filter(Boolean):[];
    const ped=Array.isArray(ans.pediatricianIf)?ans.pediatricianIf.filter(Boolean):[];
    const acts=Array.isArray(ans.safeActions)?ans.safeActions.filter(Boolean):[];
    const conf=Math.max(0,Math.min(1,Number(ans.confidence)||0));
    const confPct=pctLabel01(conf);
    return `<div class="cop-block copilot-answer" id="copilot-answer">
      <div class="cb-kicker">Resposta</div>
      <h4>${escHtml(ans.topicLabel||ans.topic||'Orientação')}</h4>
      <p>${escHtml(safe||'Não consegui gerar uma resposta segura agora.')}</p>
      ${acts.length?`<div class="cop-subhead">Ações seguras</div><ul class="cop-list">${acts.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>`:''}
      ${warns.length?`<div class="cop-alert ${toneClass('danger')}"><div class="cop-alert-title">Procure urgência se:</div><ul class="cop-list">${warns.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul></div>`:''}
      ${ped.length?`<div class="cop-alert ${toneClass('warn')}"><div class="cop-alert-title">Fale com o pediatra se:</div><ul class="cop-list">${ped.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul></div>`:''}
      <div class="cop-meta">Confiança local: ${confPct}%</div>
    </div>`;
  }

  const hero=$('cop-hero');
  if(hero){
    const title=dm.score<35?'Está começando a entender o bebê':dm.score<65?'Já estou lendo padrões':'Leitura firme do seu ritmo';
    const stBadge=quality?.badge||{label:dm.label,tone:dm.conf||'low'};
    hero.innerHTML=`<div class="ch-kick">Copiloto</div>
      <h2 class="ch-title">${escHtml(title)}</h2>
      <p class="ch-sub">${escHtml(quality?.summary||dm.hint||'')}</p>
      <div class="ch-meter"><div class="ch-fill" style="width:${Math.max(0,Math.min(100,Number(dm.score)||0))}%"></div></div>
      <div class="ch-chips">
        ${chip(stBadge.label,stBadge.tone)}
        ${chip(`${getDaysWithData().length} dias · ${entries.filter(e=>e.type==='sleep'&&e.durationMins).length} sonos`,'neutral')}
        ${chip(`${babyAgeMonths()} meses`,'neutral')}
      </div>`;
  }

  // Agora
  const now_=$('cop-now');
  if(now_){
    const active=getActiveSleep();
    const last=getLastCompletedSleep();
    let title='Agora';
    let body=guidance||'Observe sinais por alguns minutos e registre os eventos mais recentes.';
    const rule=[];

    if(active){
      title=sleepIsNight(active)?'Sono noturno em curso':'Soneca em curso';
      body=`Dormiu às <strong>${escHtml(active.start)}</strong>. Quando acordar, registre em <strong>Acordou</strong>.`;
      rule.push(['Status','Dormindo']);
    }else if(last&&wakeCountsAsDayForPredictions(last)){
      const aw=wwCurrentAwakeMinutes();
      const tgt=wwCurrentTargetMinutes();
      const r=getWakeRisk(aw,tgt);
      title=r.lvl==='high'?'Janela estourando':r.lvl==='mid'?'Janela apertando':'Dentro da janela';
      rule.push(['Acordado',fmtDur(aw)]);
      rule.push(['Alvo aprox.',(tgt||0)+' min']);
      rule.push(['Risco',r.msg||'—']);
    }else{
      title='Ritmo noturno / poucos dados';
    }

    const details=(Array.isArray(quality?.details)?quality.details:[]);
    now_.innerHTML=`<div class="cop-block">
      <div class="cb-kicker">Leitura agora</div>
      <div class="cop-row">
        <h4 style="margin:0">${escHtml(title)}</h4>
        ${chip((quality?.badge?.label||dm.label||'').toString(),quality?.badge?.tone||'neutral')}
      </div>
      <p>${body}</p>
      ${details.length?`<ul class="cop-list">${details.slice(0,4).map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>`:''}
      ${rule.length?'<ul class="cb-rule">'+rule.map(r=>`<li><span>${escHtml(r[0])}</span><strong>${escHtml(r[1])}</strong></li>`).join('')+'</ul>':''}
    </div>`;
  }

  // Próxima janela
  const winEl=$('cop-window');
  if(winEl){
    const last=getLastCompletedSleep();
    const today=calendarDayEntries(todayStr());
    const ts=today.filter(e=>e.type==='sleep'&&e.durationMins).reduce((a,e)=>a+(e.durationMins||0),0);
    if(!last){winEl.innerHTML='';}
    else{
      let p,label;
      if(wakeCountsAsDayForPredictions(last)){
        const np=smartPredictNextNap(last.end,last.durationMins||0,ts);
        if(timeToMins(np.center)>=nightStartMinsVal()){p=nightStartPrediction();label='Entrada da noite';}
        else{p=np;label='Próxima soneca';}
      }else{p=nightStartPrediction();label='Rotina da noite';}
      const nowM=timeToMins(fmtTime(now()));
      const napOver=label==='Próxima soneca'&&p.to!=null&&nowM>timeToMins(p.to);
      const mins=formatTimeUntil(p.center);
      const head=napOver?(`${escHtml(label)} · atrasada ~${escHtml(fmtDur(nowM-timeToMins(p.to)))}`):(`${escHtml(label)} em ${mins} min`);
      winEl.innerHTML=`<div class="cop-block">
        <div class="cb-kicker">Próxima janela</div>
        <h4>${head}</h4>
        <p>Faixa provável <strong>${escHtml(p.from)}–${escHtml(p.to)}</strong>. Base: ${escHtml(p.basis)}.</p>
        <ul class="cb-rule">
          <li><span>Hora central</span><strong>${escHtml(p.center)}</strong></li>
          <li><span>Tolerância</span><strong>±${escHtml(String(p.range||20))} min</strong></li>
        </ul>
      </div>`;
    }
  }

  // Leitura do dia
  const dayEl=$('cop-day');if(dayEl){const d=buildDayFlowRead();dayEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Leitura do dia</div><h4>${d.tone==='warn'?'Sinais de atenção':d.tone==='ok'?'Dia fluindo bem':'Dia sem muita sinalização'}</h4><p>${d.flow}</p><p style="margin-top:8px"><strong>Gargalo provável:</strong> ${escHtml(d.bot)}</p><ul class="cb-rule"><li><span>Sonecas</span><strong>${d.stats.naps}</strong></li><li><span>Sono diurno</span><strong>${fmtDur(d.stats.napMin)}</strong></li><li><span>Mamadas</span><strong>${d.stats.feeds}</strong></li><li><span>Sinais de humor</span><strong>${d.stats.mo}</strong></li></ul></div>`;}

  // Leitura da noite
  const nEl=$('cop-night');if(nEl){const an=analyzeLastCompleteNight();if(!an){nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>Nenhuma noite fechada ainda</h4><p>Registre <strong>Acordou</strong> de manhã para o Copiloto calcular total, despertares e maior bloco.</p></div>`;}else{const wq=an.wakes===0?'Noite contínua — ótima referência para o dia.':an.wakes>=3?'Noite fragmentada — pressão extra hoje.':'Noite dentro do comum para a idade.';nEl.innerHTML=`<div class="cop-block"><div class="cb-kicker">Última noite</div><h4>${fmtDur(an.totalSleep)} em ${an.blocks} trecho(s)</h4><p>${wq} Maior bloco <strong>${fmtDur(an.maxBlock)}</strong>.</p><ul class="cb-rule"><li><span>Início</span><strong>${escHtml(an.bedClock)}</strong></li><li><span>Despertar final</span><strong>${escHtml(an.wakeClock)}</strong></li><li><span>Despertares intermediários</span><strong>${an.wakes}</strong></li><li><span>Média entre trechos</span><strong>${an.avgGap?fmtDur(an.avgGap):'—'}</strong></li></ul></div>`;}}

  // Possíveis motivos
  const cryEl=$('cop-cry');
  if(cryEl){
    cryEl.innerHTML=`<div class="cop-block copilot-section">
      <div class="cb-kicker">Possíveis motivos</div>
      <h4>O que pode estar acontecendo?</h4>
      <p>Hipóteses locais (sem diagnóstico), ponderadas pelo que foi registrado e pelo contexto atual.</p>
      ${renderHypothesisList(hyps)}
    </div>`;
  }

  // Perguntas / resposta / sinais de alerta
  const simEl=$('cop-sim');
  if(simEl){
    simEl.innerHTML=`<div class="cop-block copilot-section">
      <div class="cb-kicker">Perguntas rápidas</div>
      <h4>Respostas rápidas (seguras)</h4>
      <p>Escolha uma pergunta para receber orientação local com base no contexto atual.</p>
      <div class="cop-actions">
        ${quickQBtn('Está chorando muito?')}
        ${quickQBtn('Mamou há quanto tempo?')}
        ${quickQBtn('A fralda está limpa?')}
        ${quickQBtn('Está com febre?')}
        ${quickQBtn('Está respirando diferente?')}
        ${quickQBtn('Teve vacina recente?')}
        ${quickQBtn('Parece com gases?')}
        ${quickQBtn('Está recusando alimento?')}
        ${quickQBtn('Dormiu pouco hoje?')}
        ${quickQBtn('Acordou muitas vezes?')}
      </div>
    </div>
    <div class="cop-block copilot-section">
      <div class="cb-kicker">Perguntar ao Copiloto</div>
      <h4>Escreva o que está acontecendo</h4>
      <div class="cop-question-box">
        <textarea id="copilot-q" rows="3" placeholder="Ex.: chorou após mamada e está com nariz entupido"></textarea>
        <button type="button" class="cop-pill primary" onclick="copilotAskFromInput()">Analisar</button>
      </div>
      <div id="copilot-answer-slot">${renderAnswerCard(window.__copilotLastAnswer||null)}</div>
    </div>
    <div class="cop-block copilot-section">
      <div class="cb-kicker">Sinais de alerta</div>
      <h4>Quando procurar ajuda</h4>
      <div class="cop-alert ${toneClass('warn')}">
        <div class="cop-alert-title">Procure orientação médica se houver:</div>
        <ul class="cop-list">
          <li>Dificuldade para respirar, esforço, gemência, lábios arroxeados.</li>
          <li>Sonolência anormal, convulsão, desidratação (pouca urina, boca seca).</li>
          <li>Sangue nas fezes, vômitos persistentes, recusa persistente de líquidos.</li>
          <li>Trauma/queda com piora, febre persistente ou piora rápida.</li>
        </ul>
      </div>
      <div class="cop-disclaimer">${escHtml((typeof COPILOT_DISCLAIMER==='string'?COPILOT_DISCLAIMER:''))}</div>
    </div>`;
  }
}

function copilotQuickAsk(question){
  try{
    const st=(typeof CopilotEngine==='object'&&CopilotEngine.getCurrentBabyState)?CopilotEngine.getCurrentBabyState(now()):{};
    const ans=(typeof CopilotEngine==='object'&&CopilotEngine.answerLocalQuestion)?CopilotEngine.answerLocalQuestion(question,st):null;
    window.__copilotLastAnswer=ans;
    const slot=$('copilot-answer-slot');
    if(slot){
      // Re-render only the answer card portion
      // (renderCopilot can be heavy; keep UI snappy).
      const safeAns=ans&&typeof ans==='object'?ans:null;
      // Create a small card without depending on outer scope helpers.
      const urgent=Array.isArray(safeAns?.urgentIf)?safeAns.urgentIf.filter(Boolean):[];
      const ped=Array.isArray(safeAns?.pediatricianIf)?safeAns.pediatricianIf.filter(Boolean):[];
      const acts=Array.isArray(safeAns?.safeActions)?safeAns.safeActions.filter(Boolean):[];
      const conf=Math.max(0,Math.min(1,Number(safeAns?.confidence)||0));
      const confPct=Math.round(conf*100);
      slot.innerHTML=`<div class="cop-block copilot-answer">
        <div class="cb-kicker">Resposta</div>
        <h4>${escHtml(safeAns?.topicLabel||safeAns?.topic||'Orientação')}</h4>
        <p>${escHtml((safeAns?.answer||'').trim()||'Não consegui gerar uma resposta segura agora.')}</p>
        ${acts.length?`<div class="cop-subhead">Ações seguras</div><ul class="cop-list">${acts.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>`:''}
        ${urgent.length?`<div class="cop-alert danger"><div class="cop-alert-title">Procure urgência se:</div><ul class="cop-list">${urgent.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul></div>`:''}
        ${ped.length?`<div class="cop-alert warn"><div class="cop-alert-title">Fale com o pediatra se:</div><ul class="cop-list">${ped.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul></div>`:''}
        <div class="cop-meta">Confiança local: ${confPct}%</div>
      </div>`;
    }else{
      // Worst case: refresh whole section.
      renderCopilot();
    }
  }catch(e){
    try{showToast('Falha ao analisar.');}catch{}
  }
}

function copilotAskFromInput(){
  const el=$('copilot-q');
  const q=(el&&typeof el.value==='string')?el.value:'';
  copilotQuickAsk(q);
}
