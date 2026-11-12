import assert from 'node:assert/strict';
import {readFile,unlink,rmdir} from 'node:fs/promises';
import path from 'node:path';

const origin=process.env.TEST_ORIGIN||'http://localhost:3000';
const env=await readFile('.env.local','utf8');
const code=env.match(/^ADMIN_ACCESS_CODE=(.+)$/m)?.[1].trim();
assert.ok(code,'Local admin code must be configured');
const request=(route,options={})=>fetch(origin+route,{...options,headers:{Origin:origin,...options.headers}});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=','base64');
const payload={make:'Volkswagen',model:'Golf',year:'2010',wheels:'4',condition:'engine',name:'TEST TECHNIQUE',email:'test@example.invalid',phone:'+49000000000',whatsapp:'+49111111111',postal:'22043',city:'Hamburg',address:'Adresse de test',notes:'Automated test — removed after verification',consent:true,locale:'fr'};
let id;
try{
 assert.equal((await request('/api/admin/requests/')).status,401,'Requests must be private');
 assert.equal((await request('/api/admin/session/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'wrong-code'})})).status,401,'Wrong code must fail');
 assert.equal((await fetch(origin+'/api/requests/',{method:'POST',headers:{Origin:'https://invalid.example'}})).status,403,'Cross-origin submissions must fail');
 const invalid=new FormData();invalid.set('payload',JSON.stringify({...payload,consent:false}));
 assert.equal((await request('/api/requests/',{method:'POST',body:invalid})).status,400,'Invalid payload must fail');
 const fake=new FormData();fake.set('payload',JSON.stringify(payload));fake.append('photos',new Blob(['not an image'],{type:'image/png'}),'fake.png');
 assert.equal((await request('/api/requests/',{method:'POST',body:fake})).status,400,'Invalid image bytes must fail');
 const form=new FormData();form.set('payload',JSON.stringify(payload));form.append('photos',new Blob([png],{type:'image/png'}),'test.png');
 const saved=await request('/api/requests/',{method:'POST',body:form});assert.equal(saved.status,201);id=(await saved.json()).id;assert.match(id,/^[a-f0-9-]{36}$/);
 const login=await request('/api/admin/session/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});assert.equal(login.status,200);
 const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=strict/i);
 const cookie=setCookie.split(';')[0];const headers={Cookie:cookie};
 const list=await request('/api/admin/requests/',{headers});assert.equal(list.status,200);const row=(await list.json()).requests.find(r=>r.id===id);assert.ok(row);assert.equal(row.payload.name,payload.name);assert.equal(row.photo_paths.length,1);
 const disk=JSON.parse(await readFile(path.join('.data','requests',`${id}.json`),'utf8'));assert.equal(disk.id,id,'Request must exist on disk');assert.equal(disk.payload.whatsapp,payload.whatsapp);
 assert.equal((await request(`/api/admin/photos/${id}/0/`)).status,401,'Photo must be private');
 const photo=await request(`/api/admin/photos/${id}/0/`,{headers});assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),png);
 const rejected=await request('/api/admin/requests/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,status:'rejected',appointment_at:null})});assert.equal(rejected.status,200);const refused=(await rejected.json()).request;assert.equal(refused.status,'rejected');assert.equal(refused.email_delivery,undefined,'Rejecting must not send email');
 assert.equal((await request('/api/admin/appointment/',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id})})).status,400,'Rejected requests must never receive appointment emails');
 const acceptedWithoutDate=await request('/api/admin/requests/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,status:'accepted',appointment_at:null})});assert.equal(acceptedWithoutDate.status,200);
 const german=await request(`/api/admin/appointment/?id=${id}`,{headers});assert.equal(german.status,200);const initialDraft=await german.json();assert.ok(initialDraft.text.startsWith('Guten Tag'),'Acceptance template must be German even for French customers');assert.equal(initialDraft.ics,null,'No calendar event without an appointment');
 const customDraft={subject:'Ihre Anfrage wurde angenommen',text:'Guten Tag, wir nehmen Ihr Fahrzeug an. Sofiane meldet sich bei Ihnen.'};
 const draftSaved=await request('/api/admin/appointment/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,draft:customDraft})});assert.equal(draftSaved.status,200);assert.equal((await draftSaved.json()).text,customDraft.text);
 const persistedDraft=JSON.parse(await readFile(path.join('.data','requests',`${id}.json`),'utf8'));assert.equal(persistedDraft.email_draft.language,'de');assert.equal(persistedDraft.email_draft.subject,customDraft.subject);assert.equal(persistedDraft.email_delivery,undefined,'Saving a draft must not send email');
 const invalidDraft=await request('/api/admin/appointment/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,draft:{subject:'Bad\r\nBcc: invalid@example.invalid',text:'text'}})});assert.equal(invalidDraft.status,400,'Header injection must be rejected');
 const accepted=await request('/api/admin/requests/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,status:'accepted',appointment_at:'2027-01-15T10:00:00.000Z'})});assert.equal(accepted.status,200);
 assert.equal((await request(`/api/admin/appointment/?id=${id}`)).status,401);
 const previewResponse=await request(`/api/admin/appointment/?id=${id}`,{headers});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.equal(preview.to,payload.email);assert.equal(preview.text,customDraft.text);assert.ok(preview.ics.includes('BEGIN:VCALENDAR'));assert.ok(preview.ics.includes('DTSTART:20270115T100000Z'));
 if(!preview.configured){const unsent=await request('/api/admin/appointment/',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id})});assert.equal(unsent.status,503);const stillAccepted=JSON.parse(await readFile(path.join('.data','requests',`${id}.json`),'utf8'));assert.equal(stillAccepted.status,'accepted');assert.equal(stillAccepted.email_delivery,undefined,'Unconfigured email must not report success');}
 const {berlinToISO,berlinInput}=await import('../lib/appointments.ts');assert.equal(berlinToISO('2027-01-15T11:00'),'2027-01-15T10:00:00.000Z');assert.equal(berlinToISO('2027-07-15T11:00'),'2027-07-15T09:00:00.000Z');assert.equal(berlinInput('2027-07-15T09:00:00.000Z'),'2027-07-15T11:00');assert.throws(()=>berlinToISO('2027-03-28T02:30'));
 const update={id,status:'scheduled',appointment_at:'2027-01-15T10:00:00.000Z'};
 assert.equal((await request('/api/admin/requests/',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)})).status,401,'Updates must require code session');
 const changed=await request('/api/admin/requests/',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(update)});assert.equal(changed.status,200);assert.equal((await changed.json()).request.status,'scheduled');
 const updated=JSON.parse(await readFile(path.join('.data','requests',`${id}.json`),'utf8'));assert.equal(updated.appointment_at,update.appointment_at,'Appointment must persist');
 assert.equal((await request('/api/admin/requests/',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})).status,401,'Deletion must require admin access');
 const deleted=await request('/api/admin/requests/',{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id})});assert.equal(deleted.status,200);
 const active=await (await request('/api/admin/requests/',{headers})).json();assert.ok(!active.requests.some(r=>r.id===id),'Trashed request must disappear from active list');
 assert.equal((await request(`/api/admin/photos/${id}/0/`,{headers})).status,404,'Trashed photos must be inaccessible');
 const restored=await request('/api/admin/requests/',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,action:'restore'})});assert.equal(restored.status,200);const restoredRow=(await restored.json()).request;assert.equal(restoredRow.payload.whatsapp,payload.whatsapp);assert.equal(restoredRow.email_draft.text,customDraft.text);assert.equal(restoredRow.deleted_at,undefined);
 assert.equal((await request(`/api/admin/photos/${id}/0/`,{headers})).status,200,'Restoring must restore photo access');
 const tampered=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a');assert.equal((await request('/api/admin/requests/',{headers:{Cookie:tampered}})).status,401,'Tampered session must fail');
 const logout=await request('/api/admin/session/',{method:'DELETE',headers});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/i);
 console.log('PASS: contacts, German editable draft, silent rejection, appointment, private photo, trash/restore, signed access and input validation.');
}finally{
 // Remove only the exact UUID generated by this test, never customer records.
 if(id&&/^[a-f0-9-]{36}$/.test(id)){
   const root=path.resolve('.data');let file=path.resolve(root,'requests',`${id}.json`);assert.ok(file.startsWith(root+path.sep));
   let raw;try{raw=await readFile(file,'utf8')}catch(error){if(error.code!=='ENOENT')throw error;file=path.resolve(root,'trash',`${id}.json`);assert.ok(file.startsWith(root+path.sep));raw=await readFile(file,'utf8')}
   const row=JSON.parse(raw);assert.equal(row.payload.name,'TEST TECHNIQUE');
   for(const name of row.photo_paths){assert.match(name,/^[a-f0-9-]+\.png$/);const photo=path.resolve(root,'photos',id,name);assert.ok(photo.startsWith(root+path.sep));await unlink(photo)}
   if(row.photo_paths.length)await rmdir(path.resolve(root,'photos',id));await unlink(file);
 }
}
