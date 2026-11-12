import {json,limitedBody,rateLimit,sameOrigin} from '@/lib/server/access';
import {createRequest,validPayload} from '@/lib/server/store';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'ORIGIN'},403);
 if(!rateLimit('public-submissions',30,60000))return json({error:'TOO_MANY_REQUESTS'},429);
 try{
   const bytes=await limitedBody(request,14*1024*1024);
   const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
   const raw=form.get('payload');if(typeof raw!=='string'||raw.length>16000)return json({error:'INVALID_REQUEST'},400);
   const payload=JSON.parse(raw),files=form.getAll('photos');
   if(!validPayload(payload)||files.length>6||files.some(file=>typeof file==='string'))return json({error:'INVALID_REQUEST'},400);
   const id=await createRequest(payload,files as File[]);return json({id},201);
 }catch(error){const validation=error instanceof Error&&['BODY_TOO_LARGE','INVALID_PHOTO'].includes(error.message);return json({error:validation?'INVALID_REQUEST':'SAVE_FAILED'},validation?400:500)}
}
