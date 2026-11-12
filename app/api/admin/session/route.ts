import {NextRequest} from 'next/server';
import {authorised,closeSession,json,limitedBody,matchesCode,openSession,rateLimit,sameOrigin} from '@/lib/server/access';
export const runtime='nodejs';
export async function GET(request:NextRequest){return json({authenticated:authorised(request)})}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 if(!rateLimit('admin-login',12,60000))return json({error:'TOO_MANY_ATTEMPTS'},429);
 try{const {code}=JSON.parse((await limitedBody(request,1024)).toString());if(!matchesCode(code))return json({error:'INVALID_CODE'},401);const response=json({authenticated:true});openSession(response,request);return response}catch{return json({error:'LOGIN_FAILED'},400)}
}
export async function DELETE(request:NextRequest){if(!sameOrigin(request))return json({error:'ORIGIN'},403);const response=json({authenticated:false});closeSession(response);return response}
