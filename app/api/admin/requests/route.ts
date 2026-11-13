import {NextRequest} from 'next/server';
import {authorised,json,limitedBody,sameOrigin} from '@/lib/server/access';
import {listRequests,updateRequest,validEmail,withRequestLock,trashRequest,restoreRequest} from '@/lib/server/store';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);
 try{return json({requests:await listRequests()})}
 catch(error){
  if(error instanceof Error&&error.message==='STORAGE_NOT_CONFIGURED')return json({error:'STORAGE_NOT_CONFIGURED'},503);
  console.error('Request list failed',error);
  return json({error:'LOAD_FAILED'},500);
 }
}
export async function PATCH(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);
 if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 try{const p=JSON.parse((await limitedBody(request,2048)).toString());
   if(typeof p.id!=='string'||!['new','review','accepted','rejected','scheduled','collected'].includes(p.status)||(p.email!==undefined&&p.email!==''&&!validEmail(p.email))||[p.phone,p.whatsapp].some(number=>number!==undefined&&(typeof number!=='string'||(number!==''&&!/^[+0-9() .-]{6,40}$/.test(number))))||(p.appointment_at!==null&&(typeof p.appointment_at!=='string'||Number.isNaN(Date.parse(p.appointment_at))))||(p.status==='scheduled'&&!p.appointment_at))return json({error:'INVALID_UPDATE'},400);
   return json({request:await withRequestLock(p.id,()=>updateRequest(p.id,p.status,p.appointment_at,p.email,p.phone,p.whatsapp))});
 }catch{return json({error:'UPDATE_FAILED'},400)}
}
export async function DELETE(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 try{const {id}=JSON.parse((await limitedBody(request,1024)).toString());if(typeof id!=='string')return json({error:'INVALID_REQUEST'},400);await withRequestLock(id,()=>trashRequest(id));return json({deleted:true,id})}catch{return json({error:'DELETE_FAILED'},400)}
}
export async function POST(request:NextRequest){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 try{const {id,action}=JSON.parse((await limitedBody(request,1024)).toString());if(typeof id!=='string'||action!=='restore')return json({error:'INVALID_REQUEST'},400);return json({request:await withRequestLock(id,()=>restoreRequest(id))})}catch{return json({error:'RESTORE_FAILED'},400)}
}
