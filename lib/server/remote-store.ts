import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {RequestRow} from './store';

const table='server_requests';
const bucket='server-request-photos';

function client(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error('STORAGE_NOT_CONFIGURED');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
function check(error:{message:string}|null){if(error)throw new Error(`STORAGE_FAILED: ${error.message}`)}
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
function photoType(bytes:Buffer){
 if(bytes.length>12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'webp';
 if(bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 throw new Error('INVALID_PHOTO');
}

export async function createRemoteRequest(payload:Record<string,unknown>,files:File[]){
 const db=client(),id=randomUUID(),names:string[]=[];
 const images=await Promise.all(files.map(async file=>{if(file.size>2097152||file.size===0)throw new Error('INVALID_PHOTO');const bytes=Buffer.from(await file.arrayBuffer());return {bytes,ext:photoType(bytes)}}));
 const clean:Record<string,unknown>={};
 for(const key of ['make','model','year','wheels','condition','notes','name','email','phone','whatsapp','postal','city','address','locale','consent'])if(payload[key]!==undefined)clean[key]=typeof payload[key]==='string'?String(payload[key]).trim():payload[key];
 try{
  for(const photo of images){const name=`${randomUUID()}.${photo.ext}`,object=`${id}/${name}`;const {error}=await db.storage.from(bucket).upload(object,photo.bytes,{contentType:photo.ext==='jpg'?'image/jpeg':`image/${photo.ext}`,upsert:false});check(error);names.push(name)}
  const row:RequestRow={id,payload:clean,photo_paths:names,status:'new',appointment_at:null,created_at:new Date().toISOString()};
  const {error}=await db.from(table).insert({id,data:row});check(error);return id;
 }catch(error){if(names.length)await db.storage.from(bucket).remove(names.map(name=>`${id}/${name}`));throw error}
}
export async function getRemoteRequest(id:string,includeDeleted=false):Promise<RequestRow>{
 if(!validId(id))throw new Error('NOT_FOUND');
 const {data,error}=await client().from(table).select('data,deleted_at').eq('id',id).maybeSingle();check(error);
 if(!data||(!includeDeleted&&data.deleted_at))throw new Error('NOT_FOUND');
 return data.data as RequestRow;
}
export async function writeRemoteRequest(row:RequestRow){
 if(!validId(row.id))throw new Error('NOT_FOUND');
 const {data,error}=await client().from(table).update({data:row,deleted_at:row.deleted_at||null}).eq('id',row.id).select('id').maybeSingle();check(error);
 if(!data)throw new Error('NOT_FOUND');
}
export async function listRemoteRequests():Promise<RequestRow[]>{
 const {data,error}=await client().from(table).select('data').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);check(error);
 return (data||[]).map(item=>item.data as RequestRow);
}
export async function trashRemoteRequest(id:string){const row=await getRemoteRequest(id);await writeRemoteRequest({...row,deleted_at:new Date().toISOString()})}
export async function restoreRemoteRequest(id:string){const row=await getRemoteRequest(id,true);if(!row.deleted_at)throw new Error('NOT_FOUND');delete row.deleted_at;await writeRemoteRequest(row);return row}
export async function getRemotePhoto(id:string,index:number){
 const row=await getRemoteRequest(id),name=row.photo_paths[index];
 if(!name||!/^[-a-f0-9]+\.(png|jpg|webp)$/.test(name))throw new Error('NOT_FOUND');
 const {data,error}=await client().storage.from(bucket).download(`${id}/${name}`);check(error);
 if(!data)throw new Error('NOT_FOUND');
 return {bytes:Buffer.from(await data.arrayBuffer()),type:name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp'};
}
