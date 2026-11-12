import {NextRequest} from 'next/server';
import {authorised,json} from '@/lib/server/access';
import {getPhoto} from '@/lib/server/store';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;index:string}>}){
 if(!authorised(request))return json({error:'UNAUTHORIZED'},401);
 try{const {id,index}=await params;if(!/^[0-5]$/.test(index))return json({error:'NOT_FOUND'},404);const photo=await getPhoto(id,Number(index));return new Response(photo.bytes,{headers:{'Content-Type':photo.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch{return json({error:'NOT_FOUND'},404)}
}
