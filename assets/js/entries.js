/* ---- actions ---- */
function quickSleep(){if(getActiveSleep()){showToast('Já tem sono em andamento');return;}babySlept();}
function babySlept(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}if(getActiveSleep()){showToast('Já tem sono em andamento');return;}const t=fmtTime(now());const e={id:Date.now(),date:todayStr(),type:'sleep',start:t,end:null};setSleepKind(e);entries.push(e);save();showToast((sleepIsNight(e)?'Noite':'Soneca')+' iniciada às '+t);renderHome();}
function babyWoke(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const active=getActiveSleep();if(!active){showToast('Nenhum sono em andamento');return;}const t=fmtTime(now());const idx=entries.findIndex(e=>e.id===active.id);entries[idx].end=t;const sm=parseTime(entries[idx].start),em=parseTime(t);if(em<sm)em.setDate(em.getDate()+1);entries[idx].durationMins=Math.round((em-sm)/60000);save();showToast('Acordou às '+t+' · '+fmtDur(entries[idx].durationMins));renderHome();}
function logMoodQuick(sub){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const t=fmtTime(now());entries.push({id:Date.now(),date:todayStr(),type:'mood',subtype:sub,start:t});save();const lab=sub==='crying'?'Choro':sub==='gas'?'Gases':'Irritação';showToast(lab+' registrado às '+t);renderHome();}
function deleteEntry(id){if(!confirm('Excluir este registro?'))return;entries=entries.filter(e=>e.id!==id);save();renderHome();renderHistory();showToast('Registro excluído');}

function orbitCtaClick(){const cta=$('orbit-cta');if(cta&&cta.onclick)cta.onclick();}

/* ---- Log sheet (FAB) ---- */
function openLogSheet(){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}const t=$('tile-sleep-lbl');if(t)t.textContent=getActiveSleep()?'Acordou':'Dormiu';const shb=$('sheet-backdrop'),sh=$('log-sheet');if(!shb||!sh)return;shb.classList.add('open');sh.classList.add('open');}
function closeLogSheet(){$('sheet-backdrop').classList.remove('open');$('log-sheet').classList.remove('open');}
function quickSleepOrWake(){if(getActiveSleep())babyWoke();else babySlept();}
// The tile for Dormiu triggers: if active, wake instead
document.addEventListener('DOMContentLoaded',()=>{});

/* ---- Modal (form) ---- */
function openLog(type){if(profileNeedsSetup()){showToast('Cadastre o bebê primeiro');return;}curModal=type;['feed','diaper','sleep-manual'].forEach(t=>$('mf-'+t).classList.toggle('hide',t!==type));$('modal-title-el').textContent={feed:'Registrar mamada',diaper:'Registrar fralda','sleep-manual':'Sono manual'}[type]||'Registrar';const t=fmtTime(now()),td=todayStr();if(type==='feed'){$('f-feed-date').value=td;$('f-feed-time').value=t;$('f-feed-dur').value='';}if(type==='diaper'){$('f-diaper-date').value=td;$('f-diaper-time').value=t;}if(type==='sleep-manual'){$('f-manual-date').value=td;$('f-manual-start').value=t;$('f-manual-end').value='';}$('modal-backdrop').classList.add('open');}
function closeModal(){$('modal-backdrop').classList.remove('open');}
function saveEntry(){let e={id:Date.now()};if(curModal==='feed'){const date=$('f-feed-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const t=$('f-feed-time').value;if(!isValidTime(t)){showToast('Horário inválido');return;}e.date=date;e.type='feed';e.subtype=state.feedType;e.start=t;e.durationMins=parseInt($('f-feed-dur').value)||null;}else if(curModal==='diaper'){const date=$('f-diaper-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const t=$('f-diaper-time').value;if(!isValidTime(t)){showToast('Horário inválido');return;}e.date=date;e.type='diaper';e.subtype=state.diaperType;e.start=t;}else if(curModal==='sleep-manual'){const date=$('f-manual-date').value||todayStr();if(!isValidDateStr(date)){showToast('Data inválida');return;}const s=$('f-manual-start').value,en=$('f-manual-end').value;if(!isValidTime(s)){showToast('Início inválido');return;}e.date=date;e.type='sleep';e.start=s;e.end=isValidTime(en)?en:null;if(e.end){let sm=parseTimeOnDate(s,date),em=parseTimeOnDate(e.end,date);if(em<sm)em.setDate(em.getDate()+1);e.durationMins=Math.round((em-sm)/60000);}setSleepKind(e);}entries.push(e);save();closeModal();showToast('Registro salvo');renderHome();}

/* ---- Segmented buttons (in forms) ---- */
function initSegs(){[['seg-feed','feedType'],['seg-diaper','diaperType']].forEach(([sid,key])=>{const seg=$(sid);if(!seg)return;seg.querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',function(e){e.preventDefault();seg.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));this.classList.add('sel');state[key]=this.dataset.val;});});});}

