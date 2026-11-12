import {NextRequest} from 'next/server';
import {authorised,json,limitedBody,rateLimit,sameOrigin} from '@/lib/server/access';
import {getRequest,withRequestLock,writeRequest} from '@/lib/server/store';
import {appointmentMessage,mailConfigured,sendAppointment,validDraft} from '@/lib/server/appointment-email';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);
 const id=request.nextUrl.searchParams.get('id');if(!id)return json({configured:mailConfigured()});
 try{const row=await getRequest(id);const message=appointmentMessage(row);return json({...message,configured:mailConfigured(),alreadySent:row.email_delivery?.state==='sent'&&row.email_delivery.key===message.key})}catch{return json({error:'APPOINTMENT_NOT_READY'},400)}
}
export async function POST(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);
 if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 if(!rateLimit('appointment-email',10,60000))return json({error:'RATE_LIMIT'},429);
 try{const input=JSON.parse((await limitedBody(request,32768)).toString());const {id}=input;if(typeof id!=='string'||(input.draft!==undefined&&!validDraft(input.draft)))return json({error:'INVALID_REQUEST'},400);
   return await withRequestLock(id,async()=>{
     const row=await getRequest(id);let message;try{if(input.draft)row.email_draft={language:'de',subject:input.draft.subject.trim(),text:input.draft.text.trim()};message=appointmentMessage(row)}catch{return json({error:'APPOINTMENT_NOT_READY'},400)}
     if(!mailConfigured())return json({error:'SMTP_NOT_CONFIGURED'},503);
     if(row.email_delivery?.key===message.key&&['sending','sent'].includes(row.email_delivery.state))return json({error:'ALREADY_SENT'},409);
     row.email_delivery={state:'sending',key:message.key,to:message.to};await writeRequest(row);
     try{const result=await sendAppointment(row);if(row.appointment_at)row.status='scheduled';row.email_delivery={state:'sent',key:message.key,to:message.to,sent_at:new Date().toISOString(),message_id:result.messageId};await writeRequest(row);return json({request:row})}
     catch{row.email_delivery={state:'failed',key:message.key,to:message.to};await writeRequest(row);return json({error:'EMAIL_FAILED'},502)}
   });
 }catch{return json({error:'INVALID_REQUEST'},400)}
}
export async function PATCH(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 try{const {id,draft}=JSON.parse((await limitedBody(request,32768)).toString());if(typeof id!=='string'||!validDraft(draft))return json({error:'INVALID_DRAFT'},400);
   return await withRequestLock(id,async()=>{const row=await getRequest(id);if(!['accepted','scheduled'].includes(row.status))return json({error:'APPOINTMENT_NOT_READY'},400);row.email_draft={language:'de',subject:draft.subject.trim(),text:draft.text.trim()};const message=appointmentMessage(row);await writeRequest(row);return json({...message,configured:mailConfigured(),alreadySent:row.email_delivery?.state==='sent'&&row.email_delivery.key===message.key})});
 }catch{return json({error:'SAVE_FAILED'},400)}
}
