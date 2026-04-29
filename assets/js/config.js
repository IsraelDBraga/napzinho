const APP_SCHEMA_VERSION=3;
const APP_NAME='Nest';
const PROFILE_KEY='nz3_profiles_v1',CUR_PROFILE='nz3_current_profile';

const defaultCfg=()=>({
  name:'Bebê',babyBirthDate:'',months:3,
  nightStart:'18:00',dayBoundary:'06:00',
  lateNightMode:false,darkTheme:true,
  remindNap:false,remindNight:false,
  ctxTeething:false,ctxCold:false,ctxVaccine:false,ctxTravel:false,ctxRegression:false,ctxOther:false,ctxNote:'',
  premiumState:'free',trialStart:null,licenseToken:'',licenseTier:'',licenseExpiresAt:null,premiumUnlockLocal:false,
  dataSchemaVersion:APP_SCHEMA_VERSION,profileSetupDone:false
});
