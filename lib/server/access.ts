import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';

const cookieName='carfit_admin';
const sessions=new Map<string,{count:number;until:number}>();
export function rateLimit(key:string,max:number,windowMs:number){
 const now=Date.now();let entry=sessions.get(key);
 if(!entry||entry.until<now){entry={count:0,until:now+windowMs};sessions.set(key,entry)}
 entry.count++;return entry.count<=max;
}
export function sameOrigin(request:Request){
 try{
  const origin=request.headers.get('origin');if(!origin)return false;
  const url=new URL(origin);
  if(origin!==url.origin||!['http:','https:'].includes(url.protocol))return false;
  const configured=process.env.PUBLIC_SITE_ORIGIN;
  if(configured)return origin===new URL(configured).origin;
  return url.host===request.headers.get('host');
 }catch{return false}
}
export function matchesCode(code:unknown){
 const expected=process.env.ADMIN_ACCESS_CODE;
 if(!expected||typeof code!=='string'||code.length>200)return false;
 const hash=(s:string)=>createHmac('sha256','carfit-code-comparison').update(s).digest();
 return timingSafeEqual(hash(code.trim()),hash(expected));
}
function signature(value:string){
 const secret=process.env.ADMIN_SESSION_SECRET;
 if(!secret||secret.length<32)throw new Error('ADMIN_SESSION_SECRET is missing');
 return createHmac('sha256',secret).update(value).digest('base64url');
}
export function authorised(request:NextRequest){
 try{
   const token=request.cookies.get(cookieName)?.value;if(!token)return false;
   const [expires,nonce,sig,...rest]=token.split('.');
   if(rest.length||!expires||!nonce||!sig||!/^\d+$/.test(expires)||Number(expires)<=Date.now())return false;
   const expected=signature(`${expires}.${nonce}`);
   return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
 }catch{return false}
}
export function openSession(response:NextResponse,request:NextRequest){
 const body=`${Date.now()+8*60*60*1000}.${randomBytes(24).toString('base64url')}`;
 response.cookies.set(cookieName,`${body}.${signature(body)}`,{httpOnly:true,sameSite:'strict',secure:request.nextUrl.protocol==='https:',path:'/api/admin',maxAge:8*60*60});
}
export function closeSession(response:NextResponse){response.cookies.set(cookieName,'',{httpOnly:true,sameSite:'strict',path:'/api/admin',maxAge:0})}
export function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export async function limitedBody(request:Request,limit:number){
 if(Number(request.headers.get('content-length')||0)>limit)throw new Error('BODY_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw new Error('EMPTY_BODY');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('BODY_TOO_LARGE')}chunks.push(value)}
 return Buffer.concat(chunks);
}
