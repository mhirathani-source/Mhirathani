// Server-only Meta adapter. Never import this file into browser/native bundles.
// Missing credentials and the default OFF flag are normal, not build errors.
function metaConfiguration(env = process.env) {
  return { configured: Boolean(env.META_WHATSAPP_TOKEN && /^\d+$/.test(env.META_PHONE_NUMBER_ID || "")) };
}

async function metaGraphRequest(path, init = {}, options = {}) {
  const env = options.env || process.env;
  if (!env.META_WHATSAPP_TOKEN) throw new Error("إعداد Meta غير مكتمل؛ أضف الرمز إلى Secrets لاحقًا");
  if (!/^\/\d+\/(?:messages|message_templates)(?:\?[^#]*)?$/.test(path)) throw new Error("مسار Meta غير صالح");
  const response = await (options.fetchImpl || fetch)(`https://graph.facebook.com/v23.0${path}`, {
    ...init, redirect:"error", signal:AbortSignal.timeout(20000),
    headers: { ...init.headers, "Content-Type":"application/json", Authorization:`Bearer ${env.META_WHATSAPP_TOKEN}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`تعذر تنفيذ طلب Meta (${response.status})`);
  return body;
}

async function sendTemplateReminder(input, options = {}) {
  if (input.enabled !== true) return {ok:false,reason:"disabled"};
  const env = options.env || process.env;
  if (!metaConfiguration(env).configured) return {ok:false,reason:"not_configured"};
  if (!/^\d{8,15}$/.test(input.to) || !/^[a-z0-9_]+$/.test(input.templateName)) throw new Error("الهاتف أو اسم القالب غير صالح");
  const result = await metaGraphRequest(`/${env.META_PHONE_NUMBER_ID}/messages`, {
    method:"POST",
    body:JSON.stringify({
      messaging_product:"whatsapp",to:input.to,type:"template",
      template:{name:input.templateName,language:{code:"ar"},components:[
        {type:"body",parameters:input.parameters.map(text=>({type:"text",text:String(text)}))}
      ]},
    }),
  }, options);
  const id=result.messages?.[0]?.id;
  if(typeof id!=="string")throw new Error("لم تؤكد Meta قبول الرسالة");
  return {ok:true,providerMessageId:id};
}

function expiredMemberships(rows, today) {
  const covered=new Set(rows.filter(s=>s.status==="paused"||(s.status==="active"&&s.endDate>=today)).map(s=>s.memberId));
  const newest=new Map();
  for(const row of rows)if(!newest.has(row.memberId)||newest.get(row.memberId).id<row.id)newest.set(row.memberId,row);
  for(const row of newest.values())if(row.status==="cancelled")covered.add(row.memberId);
  const latest=new Map();
  for(const row of rows){
    if(covered.has(row.memberId)||!["active","expired"].includes(row.status)||row.endDate>=today)continue;
    const previous=latest.get(row.memberId);
    if(!previous||previous.endDate<row.endDate||(previous.endDate===row.endDate&&previous.id<row.id))latest.set(row.memberId,row);
  }
  return [...latest.values()];
}

exports.metaConfiguration=metaConfiguration;
exports.metaGraphRequest=metaGraphRequest;
exports.sendTemplateReminder=sendTemplateReminder;
exports.expiredMemberships=expiredMemberships;
