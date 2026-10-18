import webpush from 'web-push';
import { createPrivateKey } from 'node:crypto';
const env=process.env, checks=[];
const add=(name,ok)=>checks.push({name,ready:!!ok});
add('Persistent database',env.DATABASE_URL);
add('Cron authorization (32+ chars)',env.CRON_SECRET?.length>=32);
add('Resend API key and sender',env.RESEND_API_KEY && env.EMAIL_FROM);
let vapid=false;try{webpush.getVapidHeaders('https://web.push.apple.com',env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY,'aes128gcm');vapid=true;}catch{}
add('Web Push key configuration',vapid);
let apns=false;try{const key=createPrivateKey(env.APNS_PRIVATE_KEY.replace(/\\n/g,'\n'));apns=key.asymmetricKeyDetails?.namedCurve==='prime256v1' && env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_TOPIC && ['sandbox','production'].includes(env.APNS_ENVIRONMENT);}catch{}
add('Native Apple Push credentials',apns);
add('Native pilot enabled',env.MOBILE_DRIVER_ENABLED==='1');
let origin=false;try{const u=new URL(env.APP_URL);origin=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;}catch{}
add('Canonical email link origin',origin);
for(const c of checks)console.log(`${c.ready?'READY':'MISSING'} ${c.name}`);
console.log('This only checks configuration. Verify domain DNS in Resend, 5-minute scheduler execution in Admin, and delivery on an opted-in test account. No messages were sent.');
if(checks.some(c=>!c.ready))process.exitCode=2;
