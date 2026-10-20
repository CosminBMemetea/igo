import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {fcmConfig,fcmFailure,sendFcm,validFcmToken} from '../src/lib/fcm';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const old=process.env.FCM_SERVICE_ACCOUNT_JSON,originalFetch=globalThis.fetch;
let authCalls=0,sendCalls=0,denyOnce=false,status=200,code='';
try{
 process.env.FCM_SERVICE_ACCOUNT_JSON='invalid';assert.equal(fcmConfig(),null);
 process.env.FCM_SERVICE_ACCOUNT_JSON=JSON.stringify({type:'service_account',project_id:'querra-qa',client_email:'test@querra-qa.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})});assert.ok(fcmConfig());
 const token='Firebase:MiXeD_Token'.repeat(10);assert.equal(validFcmToken(token),true);assert.equal(validFcmToken('https://localhost'),false);
 globalThis.fetch=async(input,init)=>{
  if(String(input)==='https://oauth2.googleapis.com/token'){
   authCalls++;const assertion=new URLSearchParams(init?.body as URLSearchParams).get('assertion')!;const [head,body,sig]=assertion.split('.');assert.ok(verify('RSA-SHA256',Buffer.from(head+'.'+body),publicKey,Buffer.from(sig,'base64url')));assert.equal(JSON.parse(Buffer.from(body,'base64url').toString()).aud,'https://oauth2.googleapis.com/token');
   return Response.json({access_token:'synthetic-access-'+authCalls,expires_in:3600});
  }
  assert.equal(String(input),'https://fcm.googleapis.com/v1/projects/querra-qa/messages:send');sendCalls++;
  const body=JSON.parse(String(init?.body));assert.equal(body.message.token,token);assert.equal(body.message.android.notification.channel_id,'qfleet-alerts');assert.equal(body.message.notification.body.includes(token),false);
  if(denyOnce){denyOnce=false;return Response.json({}, {status:401});}
  return status===200?Response.json({name:'projects/querra-qa/messages/test'}):Response.json({error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:code}]}},{status});
 };
 await Promise.all([sendFcm(token,'one'),sendFcm(token,'two')]);assert.equal(authCalls,1);assert.equal(sendCalls,2);
 denyOnce=true;await sendFcm(token,'three');assert.equal(authCalls,2);
 status=404;code='UNREGISTERED';await assert.rejects(sendFcm(token,'four'),(e:any)=>e.removeDevice&&!e.retryable);
 assert.equal(fcmFailure(404,'NOT_FOUND',null).removeDevice,false);assert.equal(fcmFailure(403,'SENDER_ID_MISMATCH',null).removeDevice,false);assert.equal(fcmFailure(429,'QUOTA_EXCEEDED','120').retryAfterMs,120000);assert.equal(fcmFailure(503,'UNAVAILABLE',null).retryable,true);assert.equal(fcmFailure(400,'INVALID_ARGUMENT',null).removeDevice,false);
 console.log('PASS FCM: signed OAuth, shared token refresh, 401 retry, generic lock-screen payload, invalid-token removal only for UNREGISTERED, quota/backoff/configuration classification');
}finally{globalThis.fetch=originalFetch;if(old===undefined)delete process.env.FCM_SERVICE_ACCOUNT_JSON;else process.env.FCM_SERVICE_ACCOUNT_JSON=old;}
