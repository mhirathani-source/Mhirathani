const {test}=require("node:test");
const assert=require("node:assert/strict");
const {sendTemplateReminder,expiredMemberships,metaConfiguration}=require("./reminders.js");
const env={META_WHATSAPP_TOKEN:"test-placeholder-not-a-real-token",META_PHONE_NUMBER_ID:"12345"};
const payload={to:"962790000000",templateName:"prime_subscription_expired",parameters:["مشترك اختبار","شهري","2026-10-22"]};
test("OFF and absent credentials never issue a request",async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;throw Error("must not send");};
  assert.equal((await sendTemplateReminder(payload,{env,fetchImpl})).reason,"disabled");
  assert.equal((await sendTemplateReminder({...payload,enabled:true},{env:{},fetchImpl})).reason,"not_configured");
  assert.equal(calls,0);
  assert.equal(metaConfiguration({}).configured,false);
});
test("enabled Meta request uses approved-template API and reports accepted, not delivered",async()=>{
  let calls=0;
  const result=await sendTemplateReminder({...payload,enabled:true},{env,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,"https://graph.facebook.com/v23.0/12345/messages");
    assert.equal(options.headers.Authorization,`Bearer ${env.META_WHATSAPP_TOKEN}`);
    const body=JSON.parse(options.body);assert.equal(body.type,"template");
    assert.equal(body.template.language.code,"ar");assert.equal(body.template.components[0].parameters.length,3);
    return {ok:true,json:async()=>({messages:[{id:"test-message"}]})};
  }});
  assert.deepEqual(result,{ok:true,providerMessageId:"test-message"});assert.equal(calls,1);
});
test("Meta failure and invalid phones fail explicitly without exposing credentials",async()=>{
  await assert.rejects(sendTemplateReminder({...payload,enabled:true},{env,fetchImpl:async()=>({ok:false,status:401,json:async()=>({})})}),/401/);
  await assert.rejects(sendTemplateReminder({...payload,enabled:true,to:"invalid"},{env}),/غير صالح/);
});
test("expired selection suppresses renewed, paused and cancelled members and older contracts",()=>{
  const row=(id,memberId,status,endDate)=>({id,memberId,status,endDate});
  const rows=[row(1,1,"expired","2026-10-20"),row(2,1,"expired","2026-10-21"),row(3,2,"expired","2026-10-20"),row(4,2,"active","2026-11-20"),row(5,3,"cancelled","2026-10-20"),row(6,4,"active","2026-10-23"),row(7,5,"paused","2026-10-20"),row(8,5,"expired","2026-10-19")];
  assert.deepEqual(expiredMemberships(rows,"2026-10-23").map(s=>s.id),[2]);
  assert.deepEqual(expiredMemberships([row(1,1,"expired","2026-10-20"),row(2,1,"cancelled","2026-10-21")],"2026-10-23"),[]);
});
