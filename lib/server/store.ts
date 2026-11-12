import {mkdir,readFile,readdir,rename,writeFile,unlink,rmdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export type RequestRow={id:string;payload:Record<string,unknown>;photo_paths:string[];status:'new'|'review'|'accepted'|'rejected'|'scheduled'|'collected';appointment_at:string|null;created_at:string;deleted_at?:string;email_draft?:{language:'de';subject:string;text:string};email_delivery?:{state:'sending'|'sent'|'failed';key:string;sent_at?:string;to:string;message_id?:string}};
export const validEmail=(email:unknown):email is string=>typeof email==='string'&&email.length<=254&&/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email);
const dataRoot=path.resolve(process.cwd(),'.data');
const requestsDir=path.join(dataRoot,'requests'),photosDir=path.join(dataRoot,'photos'),trashDir=path.join(dataRoot,'trash');
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
async function init(){await Promise.all([mkdir(requestsDir,{recursive:true}),mkdir(photosDir,{recursive:true})])}
export async function getRequest(id:string):Promise<RequestRow>{if(!validId(id))throw new Error('NOT_FOUND');return JSON.parse(await readFile(path.join(requestsDir,`${id}.json`),'utf8'))}
export async function writeRequest(row:RequestRow){
 const file=path.join(requestsDir,`${row.id}.json`),temp=`${file}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify(row,null,2),{encoding:'utf8',mode:0o600,flag:'wx'});
 await rename(temp,file);
}
export function validPayload(input:unknown):input is Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const p=input as Record<string,unknown>;
 if(p.website||p.consent!==true)return false;
 for(const key of ['make','model','name','phone','postal','city','address','year','wheels','condition'])if(typeof p[key]!=='string'||!String(p[key]).trim()||String(p[key]).length>250)return false;
 return validEmail(p.email)&&(!p.whatsapp||(typeof p.whatsapp==='string'&&/^[+0-9() .-]{6,40}$/.test(p.whatsapp)))&&/^\d{5}$/.test(String(p.postal))&&/^(19|20)\d{2}$/.test(String(p.year))&&/^[0-4]$/.test(String(p.wheels))&&String(p.phone).length>=6&&String(p.name).trim().length>=2&&String(p.notes||'').length<=2000;
}
function imageType(bytes:Buffer){
 if(bytes.length>12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'webp';
 if(bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 throw new Error('INVALID_PHOTO');
}
export async function createRequest(payload:Record<string,unknown>,files:File[]){
 await init();const id=randomUUID(),folder=path.join(photosDir,id);const names:string[]=[];
 const images=await Promise.all(files.map(async file=>{if(file.size>2097152||file.size===0)throw new Error('INVALID_PHOTO');const bytes=Buffer.from(await file.arrayBuffer());return {bytes,ext:imageType(bytes)}}));
 const clean:Record<string,unknown>={};
 for(const key of ['make','model','year','wheels','condition','notes','name','email','phone','whatsapp','postal','city','address','locale','consent'])if(payload[key]!==undefined)clean[key]=typeof payload[key]==='string'?String(payload[key]).trim():payload[key];
 try{
   if(images.length)await mkdir(folder);
   for(const photo of images){const name=`${randomUUID()}.${photo.ext}`;await writeFile(path.join(folder,name),photo.bytes,{flag:'wx',mode:0o600});names.push(name)}
   const row:RequestRow={id,payload:clean,photo_paths:names,status:'new',appointment_at:null,created_at:new Date().toISOString()};
   await writeRequest(row);return id;
 }catch(error){for(const name of names)await unlink(path.join(folder,name)).catch(()=>{});if(images.length)await rmdir(folder).catch(()=>{});throw error}
}
export async function listRequests(){await init();const names=(await readdir(requestsDir)).filter(n=>n.endsWith('.json'));const rows=await Promise.all(names.map(n=>getRequest(n.slice(0,-5))));return rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,500)}
export async function updateRequest(id:string,status:RequestRow['status'],appointment_at:string|null,email?:string,phone?:string,whatsapp?:string){const row=await getRequest(id);const next={...row,status,appointment_at:status==='rejected'?null:appointment_at,payload:{...row.payload,...(email!==undefined?{email}:{} ),...(phone!==undefined?{phone}:{}),...(whatsapp!==undefined?{whatsapp}:{})}};await writeRequest(next);return next}
export async function trashRequest(id:string){
 const row=await getRequest(id);await mkdir(trashDir,{recursive:true});
 const source=path.resolve(requestsDir,`${id}.json`),target=path.resolve(trashDir,`${id}.json`);
 if(!source.startsWith(requestsDir+path.sep)||!target.startsWith(trashDir+path.sep))throw new Error('INVALID_PATH');
 await writeRequest({...row,deleted_at:new Date().toISOString()});await rename(source,target);
}
export async function restoreRequest(id:string){
 if(!validId(id))throw new Error('NOT_FOUND');
 const source=path.resolve(trashDir,`${id}.json`),target=path.resolve(requestsDir,`${id}.json`);
 if(!source.startsWith(trashDir+path.sep)||!target.startsWith(requestsDir+path.sep))throw new Error('INVALID_PATH');
 const row:RequestRow=JSON.parse(await readFile(source,'utf8'));
 try{await readFile(target);throw new Error('ALREADY_EXISTS')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 delete row.deleted_at;await writeRequest(row);await unlink(source);return row;
}
const locks=new Map<string,Promise<unknown>>();
export async function withRequestLock<T>(id:string,work:()=>Promise<T>):Promise<T>{const previous=locks.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(work);locks.set(id,next);try{return await next}finally{if(locks.get(id)===next)locks.delete(id)}}
export async function getPhoto(id:string,index:number){
 const row=await getRequest(id),name=row.photo_paths[index];
 if(!name||!/^[-a-f0-9]+\.(png|jpg|webp)$/.test(name))throw new Error('NOT_FOUND');
 return {bytes:await readFile(path.join(photosDir,id,name)),type:name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp'};
}
