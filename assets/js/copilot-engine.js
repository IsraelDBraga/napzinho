const COPILOT_DISCLAIMER='O Nest ajuda a organizar rotina e observar padrões. Ele não diagnostica, não substitui pediatra e não deve ser usado para decisão médica.';

function clampScore01to100(x){
  const n=Number(x);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(100,Math.round(n)));
}

function safeArr(v){return Array.isArray(v)?v:[];}

function defaultAnswer(){
  return{
    topic:'geral',
    answer:'Não consigo avaliar isso com segurança pelo app. Fale com o pediatra.',
    safeActions:['Registre horários recentes e sinais observados.'],
    pediatricianIf:['Se persistir, piorar, ou você ficar inseguro.'],
    urgentIf:['Se houver sinais de alerta, procure urgência.'],
    confidence:0.35
  };
}

const CopilotEngine={
  getCurrentBabyState(nowDt=new Date()){
    const dt=(nowDt instanceof Date && Number.isFinite(nowDt.getTime()))?nowDt:new Date();
    const lastFeed=entries.filter(e=>e&&e.type==='feed').sort((a,b)=>b.id-a.id)[0]||null;
    const lastSleep=typeof getLastCompletedSleep==='function'?getLastCompletedSleep():null;
    const active=typeof getActiveSleep==='function'?getActiveSleep():null;

    const lastFeedMinsAgo=lastFeed?Math.max(0,Math.round((dt-parseTimeOnDate(lastFeed.start,lastFeed.date))/60000)):999;
    const awakeMins=lastSleep?Math.max(0,Math.floor((dt-sleepEndDate(lastSleep))/60000)):0;
    const ageMonths=(typeof babyAgeMonths==='function')?babyAgeMonths(dt):3;

    const daysWithData=(typeof getDaysWithData==='function')?safeArr(getDaysWithData()).length:0;
    const completedSleeps=entries.filter(e=>e&&e.type==='sleep'&&e.durationMins).length;
    const dataInsufficient=(daysWithData<2)||(completedSleeps<2);

    const staleStates={
      feedStale:lastFeedMinsAgo>240,
      diaperStale:false,
      sleepStale:!lastSleep
    };

    const activeSleepGuardState=(typeof ActiveSleepGuard!=='undefined'&&ActiveSleepGuard.getActiveSleepStatus)
      ? ActiveSleepGuard.getActiveSleepStatus(dt)
      : {needsConfirmation:false,actions:[]};

    const dataQuality=
      activeSleepGuardState?.needsConfirmation ? 'needs_confirmation'
      : dataInsufficient ? 'insufficient'
      : (staleStates.feedStale||staleStates.sleepStale) ? 'stale'
      : 'good';

    return{
      nowDt:dt,
      ageMonths,
      isSleeping:!!active,
      activeSleep:active||null,
      activeSleepMins:active?Math.max(0,Math.round((dt-parseTimeOnDate(active.start,active.date))/60000)):0,
      lastFeed:lastFeed||null,
      lastFeedMinsAgo,
      lastSleep:lastSleep||null,
      awakeMins,
      staleStates,
      dataQuality,
      daysWithData,
      completedSleeps,
      activeSleepGuardState
    };
  },

  scoreHypotheses(state={}){
    const s=state||{};
    const hyps=[];
    const push=(key,label,score,reasons=[],caution='')=>{
      hyps.push({
        key:String(key||'other'),
        label:String(label||''),
        score:clampScore01to100(score),
        reasons:safeArr(reasons).map(x=>String(x||'')).filter(Boolean).slice(0,4),
        caution:String(caution||'')
      });
    };

    if(s.activeSleepGuardState?.needsConfirmation){
      push(
        'confirm_sleep',
        'Confirmar se ainda está dormindo',
        92,
        ['Sono ativo está longo demais para a rotina típica.','Isso pode distorcer previsões e resumos.'],
        'Se já acordou, registre o horário real (mesmo aproximado).'
      );
    }

    if(s.isSleeping){
      push(
        'sleeping',
        'Bebê dormindo agora',
        88,
        [s.activeSleep?.start?`Dormiu às ${s.activeSleep.start}.`:'Sono em andamento.'],
        ''
      );
    }

    if(s.dataQuality==='insufficient'){
      push(
        'data',
        'Dados insuficientes ainda',
        72,
        ['Poucos registros para estimar janelas com confiança.','Com 2–3 dias o Copiloto melhora bastante.'],
        ''
      );
    }else if(s.dataQuality==='stale'){
      const rs=[];
      if(s.staleStates?.sleepStale) rs.push('Sem sono fechado recente.');
      if(s.staleStates?.feedStale) rs.push('Última mamada faz bastante tempo (ou não foi registrada).');
      push(
        'stale',
        'Pode estar faltando algum registro',
        70,
        rs.length?rs:['Há sinais de dados desatualizados.'],
        'Complete os horários recentes para destravar a leitura.'
      );
    }

    if(!s.isSleeping && Number.isFinite(s.lastFeedMinsAgo) && s.lastFeedMinsAgo>180){
      push(
        'hunger',
        'Pode ser fome',
        62,
        [`Última mamada há ~${fmtDur(Math.round(s.lastFeedMinsAgo))}.`],
        ''
      );
    }

    if(!s.isSleeping && Number.isFinite(s.awakeMins)){
      const tgt=(typeof wwCurrentTargetMinutes==='function')?wwCurrentTargetMinutes():null;
      if(Number.isFinite(tgt) && s.awakeMins>tgt){
        push(
          'overtired',
          'Janela de sono pode estar estourando',
          68,
          [`Acordado há ${fmtDur(s.awakeMins)}.`,'A faixa típica (pela rotina registrada) pode estar no limite.'],
          ''
        );
      }
    }

    push('comfort','Checar conforto',34,['Fralda, temperatura, gases e estímulos podem somar.'],'');

    // Order by score desc, stable by key.
    return hyps.sort((a,b)=>(b.score-a.score)||String(a.key).localeCompare(String(b.key)));
  },

  getPrimaryGuidance(state={},hypotheses=[]){
    const s=state||{};
    const top=hypotheses[0]||{};
    if(s.isSleeping){
      return 'Bebê dormindo agora: mantenha ambiente calmo. Quando acordar, registre “Acordou” no horário real.';
    }
    if(top.key==='confirm_sleep'){
      return 'Esse sono parece longo demais para ficar “ativo”. Confirme se o bebê ainda está dormindo para manter o app consistente.';
    }
    if(s.dataQuality==='insufficient'){
      return 'Ainda há poucos dados. Registre os próximos eventos (sono/mamada/fralda) e eu volto a sugerir janelas com mais confiança.';
    }
    if(s.dataQuality==='stale'){
      return 'Pode estar faltando algum registro recente. Antes de interpretar sinais, complete os horários mais próximos de agora.';
    }
    if(top.key==='overtired'){
      return 'A janela pode estar apertando. Reduza estímulos e tente uma transição suave para o sono.';
    }
    if(top.key==='hunger'){
      return 'Pode ser fome. Observe sinais e ofereça mamada conforme sua rotina — depois registre para calibrar as próximas previsões.';
    }
    return 'Priorize conforto, pouca estimulação e observe sinais por 10–15 minutos. Se algo parecer fora do normal, procure orientação médica.';
  },

  getSuggestedActions(state={},hypotheses=[]){
    const s=state||{};
    const hyps=safeArr(hypotheses);
    const actions=[];
    const add=(key,label,handler,args=[],variant='')=>actions.push({key,label,handler,args:safeArr(args),variant});

    if(s.activeSleepGuardState?.needsConfirmation){
      add('confirm_sleep','Confirmar sono','handleActiveSleepGuardAction',['still'], 'primary');
      add('wake_now','Acordou agora','handleActiveSleepGuardAction',['wake_now'], '');
      add('dismiss_sleep_warn','Ignorar por enquanto','handleActiveSleepGuardAction',['dismiss'], '');
      return actions;
    }

    if(s.isSleeping){
      add('wake','Acordou','babyWoke',[], 'primary');
      add('log_feed','Registrar mamada','openLog',['feed'], '');
      return actions;
    }

    // Missing logs first.
    if(s.dataQuality==='stale' || s.dataQuality==='insufficient'){
      add('log_sleep','Registrar sono manual','openLog',['sleep-manual'], 'primary');
      add('log_feed','Registrar mamada','openLog',['feed'], '');
      add('log_diaper','Registrar fralda','openLog',['diaper'], '');
      return actions;
    }

    const top=hyps[0]||{};
    if(top.key==='hunger'){
      add('log_feed','Registrar mamada','openLog',['feed'], 'primary');
      add('check_diaper','Checar fralda','openLog',['diaper'], '');
      return actions;
    }
    if(top.key==='overtired'){
      add('sleep_now','Dormiu agora','babySlept',[], 'primary');
      add('sleep_manual','Sono manual','openLog',['sleep-manual'], '');
      return actions;
    }

    add('sleep_now','Dormiu agora','babySlept',[], 'primary');
    add('log_feed','Registrar mamada','openLog',['feed'], '');
    add('log_diaper','Registrar fralda','openLog',['diaper'], '');
    return actions;
  },

  answerLocalQuestion(query='',state={}){
    const q=String(query||'').trim();
    const ql=q.toLowerCase();
    if(!q){
      return{
        topic:'pergunta_vazia',
        answer:'Escreva o que está acontecendo (ex.: “febre”, “respiração estranha”, “não quer mamar”).',
        safeActions:['Inclua há quanto tempo começou e se há piora.'],
        pediatricianIf:['Se você estiver inseguro, fale com o pediatra.'],
        urgentIf:['Se houver sinais de alerta, procure urgência.'],
        confidence:0.4
      };
    }

    // High-risk topics: always safety-first.
    if(/respira|respiração|arrox|rox|cian|chiad|gem|puxand|costel|batimento|apne|convuls|desidrat|sangue|queda|trauma|mol[eê]ra|inconsol/i.test(ql)){
      return{
        topic:'alerta',
        answer:'Isso pode ser sinal de alerta. Se houver dificuldade para respirar, lábios arroxeados, sonolência incomum, esforço respiratório, piora rápida, convulsão, desidratação ou trauma com sintomas, procure atendimento de urgência.',
        safeActions:[
          'Observe respiração e coloração (lábios/pele).',
          'Se estiver engasgando, mantenha vias aéreas livres e procure ajuda imediata.',
          'Registre horários recentes (sono/mamadas) para informar a equipe médica.'
        ],
        pediatricianIf:['Mesmo sem gravidade evidente, fale com o pediatra para orientação.'],
        urgentIf:['Se qualquer sinal de alerta estiver presente, procure urgência.'],
        confidence:0.95
      };
    }

    if(/febre|temperatur|calor|term[oô]metro|vacin|resfri|nariz entupid|tosse|gripe/i.test(ql)){
      return{
        topic:'febre',
        answer:'Não dá para diagnosticar pelo app. Foque em conforto, hidratação e observe sinais gerais. Se houver febre persistente, bebê muito prostrado, dificuldade para respirar ou piora, procure orientação médica.',
        safeActions:[
          'Acompanhe comportamento e hidratação (xixi/fraldas).',
          'Anote temperatura medida e horários (para contar ao pediatra).',
          'Registre sono/mamadas para dar contexto.'
        ],
        pediatricianIf:['Se febre persistir, houver irritabilidade importante, recusa de líquidos ou você ficar inseguro.'],
        urgentIf:['Se houver sonolência anormal, dificuldade respiratória, rigidez, convulsão, sinais de desidratação ou piora rápida.'],
        confidence:0.72
      };
    }

    if(/vomit|v[oô]mit|diarre|recus|n[aã]o quer mamar|n[aã]o quer beber|sem xixi|pouco xixi/i.test(ql)){
      return{
        topic:'ingestao',
        answer:'Se houver vômitos persistentes, recusa de líquidos, poucas fraldas molhadas, sonolência incomum ou piora, procure orientação médica.',
        safeActions:[
          'Monitore hidratação (fraldas) e sinais de piora.',
          'Registre mamadas e episódios (horário e intensidade).'
        ],
        pediatricianIf:['Se persistir por horas ou houver preocupação.'],
        urgentIf:['Se sinais de desidratação, sangue, sonolência incomum, vômitos persistentes ou dificuldade respiratória.'],
        confidence:0.7
      };
    }

    if(/chor|chorando|gases|fralda|fome|mamar|sono|cansa/i.test(ql)){
      return{
        topic:'rotina',
        answer:'Pelo app, a forma mais segura é checar primeiro janela de sono, mamada e conforto (fralda/temperatura/gases) antes de concluir uma causa única.',
        safeActions:[
          'Reduza estímulos por 10–15 min.',
          'Cheque fralda e conforto.',
          'Se estiver na janela/intervalo, ofereça mamada ou tente transição ao sono.',
          'Registre o que acontecer para melhorar as previsões.'
        ],
        pediatricianIf:['Se choro for inconsolável, persistente ou acompanhado de outros sintomas.'],
        urgentIf:['Se houver sinais de alerta.'],
        confidence:0.62
      };
    }

    return defaultAnswer();
  },

  getDataQualitySummary(state={}){
    const q=(state&&state.dataQuality)||'good';
    if(q==='needs_confirmation') return 'Precisa confirmação: há um sono ativo longo que pode estar incorreto.';
    if(q==='insufficient') return 'Dados insuficientes: o Copiloto ainda está aprendendo seu bebê.';
    if(q==='stale') return 'Dados parciais/antigos: complete registros recentes para melhorar a leitura.';
    return 'Dados recentes suficientes para orientação local.';
  }
};

window.CopilotEngine=CopilotEngine;
