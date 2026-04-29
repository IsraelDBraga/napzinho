/* ---- storage ---- */
function loadProfilesBlob(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch(e){return null;}}
function currentProfileId(){return localStorage.getItem(CUR_PROFILE)||'default';}

const EntitlementService={
  getEntitlement(localCfg={}){if(localCfg.entitlement&&typeof localCfg.entitlement==='object')return localCfg.entitlement;return{status:'free',source:'none',label:'Plano gratuito'};},
  migrateLegacyPremiumState(localCfg={}){
    if(!localCfg||typeof localCfg!=='object')return localCfg;
    const oldString=localCfg.entitlement==='devUnlocked'&&localCfg.entitlementSource==='legacyPremiumUnlockLocal';
    const oldObj=localCfg.entitlement&&localCfg.entitlement.status==='devUnlocked'&&localCfg.entitlement.source==='legacyPremiumUnlockLocal';
    const shouldLegacy=localCfg.premiumUnlockLocal===true||oldString||oldObj;
    if(shouldLegacy){
      const ent=this.getEntitlement(localCfg);
      localCfg.entitlement={status:'familyLifetime',source:'legacy_local',label:'Vitalício familiar ativo',grantedAt:localCfg.updatedAt||new Date().toISOString(),migratedFrom:'premiumUnlockLocal',migrationNote:'Migrado de premiumUnlockLocal=true',previousStatus:(oldString||oldObj)?'devUnlocked':(ent.status||'free')};
      delete localCfg.entitlementSource;
      delete localCfg.premiumUnlockLocal;
    }
    return localCfg;
  },
  canUsePremium(featureKey){const ent=this.getEntitlement(cfg);if(ent.status==='familyLifetime'||ent.status==='lifetime'||ent.status==='premium')return true;if(ent.status==='devUnlocked')return !!window.DEV_MODE;return false;}
};

function normalizeCfgForImport(rawCfg={}){const base={...defaultCfg(),...(rawCfg||{})};if(base.babyBirthDate&&isValidDateStr(base.babyBirthDate)){base.months=babyAgeMonthsFromDate(base.babyBirthDate,now());}else{base.months=Math.max(0,Math.min(36,parseInt(base.months,10)||3));}EntitlementService.migrateLegacyPremiumState(base);delete base.appName;return base;}
function canonicalDateFromAny(e){return [e.date,e.dateStr,e.day,e.ymd].find(v=>isValidDateStr(v))||todayStr();}
function canonicalTimeFromAny(e){const t=[e.time,e.start,e.at,e.hour,e.clock].find(v=>isValidTime(v));return t||fmtTime(now());}
function normalizeEntry(raw){if(!raw||typeof raw!=='object')return null;const e={...raw};const t=String(e.type||'').toLowerCase();const id=typeof e.id==='number'?e.id:Date.now()+Math.floor(Math.random()*1000);const date=canonicalDateFromAny(e);if(['feed','feeding','mamada','bottle','breast'].includes(t)){const time=canonicalTimeFromAny(e);const subtype=e.subtype||e.feedType||'';return{id,type:'feed',date,time,feedType:e.feedType||subtype,subtype,durationMins:Number.isFinite(e.durationMins)?e.durationMins:null,createdAt:e.createdAt||null,updatedAt:e.updatedAt||null,source:e.source||'user',start:time};}
if(['diaper','fralda'].includes(t)){const time=canonicalTimeFromAny(e);const diaperType=e.diaperType||e.subtype||'wet';return{id,type:'diaper',date,time,diaperType,subtype:e.subtype||diaperType,createdAt:e.createdAt||null,updatedAt:e.updatedAt||null,source:e.source||'user',start:time};}
if(['sleep','sono','nap','soneca'].includes(t)||e.start||e.end||e.sleepStart||e.sleepEnd){const start=[e.start,e.startTime,e.sleepStart].find(v=>isValidTime(v))||fmtTime(now());const end0=[e.end,e.endTime,e.sleepEnd,e.endedAt].find(v=>v===''||isValidTime(v));const end=end0==null?'':end0;const out={id,type:'sleep',date,start,end,durationMins:Number.isFinite(e.durationMins)?e.durationMins:null,sleepKind:e.sleepKind||e.subtype||'',subtype:e.subtype||e.sleepKind||'',createdAt:e.createdAt||null,updatedAt:e.updatedAt||null,source:e.source||'user'};if(out.durationMins===0&&out.start===out.end)out.zeroDuration=true;setSleepKind(out);return out;}
if(t==='signal'&&e.subtype==='cry'){return normalizeEntry({...e,type:'mood',subtype:'crying'});} if(t==='mood'){return{...e,id,date,type:'mood',subtype:e.subtype==='cry'?'crying':(e.subtype||'note'),start:e.start&&isValidTime(e.start)?e.start:canonicalTimeFromAny(e),source:e.source||'user'};}
console.warn('normalizeEntry: unsupported entry kept as mood note',e);return{...e,id,date,type:'mood',subtype:'note',start:canonicalTimeFromAny(e),source:e.source||'legacy'};
}

function getCurrentProfile(){const blob=loadProfilesBlob()||{};const current=currentProfileId();if(blob[current])return{id:current,slot:blob[current]};const ids=Object.keys(blob);if(!ids.length)return{id:'default',slot:{entries:[],cfg:defaultCfg()}};const best=ids.sort((a,b)=>(blob[b]?.entries?.length||0)-(blob[a]?.entries?.length||0))[0];localStorage.setItem(CUR_PROFILE,best);return{id:best,slot:blob[best]};}
function getCurrentEntries(){const p=getCurrentProfile();return Array.isArray(p.slot?.entries)?p.slot.entries:[];}
function setCurrentEntries(nextEntries){const p=getCurrentProfile();const blob=loadProfilesBlob()||{};const slot=blob[p.id]||{entries:[],cfg:defaultCfg()};slot.entries=(Array.isArray(nextEntries)?nextEntries:[]).map(normalizeEntry).filter(Boolean);slot.cfg=normalizeCfgForImport(slot.cfg||{});blob[p.id]=slot;localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));}
function migrateLegacyDataIfNeeded(){const blob=loadProfilesBlob()||{};let changed=false;Object.keys(blob).forEach(pid=>{const slot=blob[pid]||{};const list=Array.isArray(slot.entries)?slot.entries:[];const normalized=uniqueEntriesForMetrics(list.map(e=>normalizeEntry(e)).filter(Boolean));blob[pid]={entries:normalized,cfg:normalizeCfgForImport(slot.cfg||{})};if((blob[pid].cfg.dataSchemaVersion||0)<STORAGE_SCHEMA_VERSION){blob[pid].cfg.dataSchemaVersion=STORAGE_SCHEMA_VERSION;changed=true;}if(normalized.length!==list.length)changed=true;});if(changed){backupNestStorageBeforeMigration('legacy');localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));}}


function migrateToProfiles(){let blob=loadProfilesBlob();if(blob&&typeof blob==='object')return;const oldEntries=localStorage.getItem('nz3_entries');const oldCfg=localStorage.getItem('nz3_cfg');let ent=[];let c=defaultCfg();try{ent=oldEntries?JSON.parse(oldEntries):[];}catch(e){ent=[];}try{c=oldCfg?{...defaultCfg(),...JSON.parse(oldCfg)}:defaultCfg();}catch(e){};localStorage.setItem(PROFILE_KEY,JSON.stringify({default:{entries:Array.isArray(ent)?ent:[],cfg:c}}));if(!localStorage.getItem(CUR_PROFILE))localStorage.setItem(CUR_PROFILE,'default');}
function loadProfileIntoMemory(){migrateToProfiles();const p=getCurrentProfile();entries=Array.isArray(p.slot?.entries)?p.slot.entries.map(normalizeEntry).filter(Boolean):[];cfg=normalizeCfgForImport(p.slot?.cfg||{});if(typeof migrateDataModel==='function')migrateDataModel();}
function persistAll(){const p=getCurrentProfile();const blob=loadProfilesBlob()||{};blob[p.id]={entries:JSON.parse(JSON.stringify(entries||[])),cfg:normalizeCfgForImport(cfg||{})};localStorage.setItem(PROFILE_KEY,JSON.stringify(blob));}
function save(){persistAll();}
function profileNeedsSetup(){return !cfg.profileSetupDone;}
function refreshProfileSelect(){}
