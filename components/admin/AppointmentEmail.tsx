'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,Download,ExternalLink,Mail,Send,CheckCircle2,LoaderCircle,Save} from 'lucide-react';
import type {RequestRow} from '@/lib/server/store';
import {AdminLang} from './content';
import {decisionCopy} from './decision-content';
import {clientCopy} from './client-content';
type Preview={to:string;subject:string;text:string;ics:string|null;configured:boolean;alreadySent:boolean};
function download(content:string,type:string,name:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function encoded(value:string){return btoa(Array.from(new TextEncoder().encode(value),byte=>String.fromCharCode(byte)).join('')).match(/.{1,76}/g)?.join('\r\n')||''}

export default function AppointmentEmail({row,lang,demo,onSent,unsaved,onBusy}:{row:RequestRow;lang:AdminLang;demo:boolean;onSent:(row:RequestRow)=>void;unsaved:boolean;onBusy:(busy:boolean)=>void}){
 const t=decisionCopy[lang],c=clientCopy[lang];
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setPreview(null);setError('');setNotice('')},[row,unsaved]);
 const ready=['accepted','scheduled'].includes(row.status)&&!!row.payload.email;
 const valid=!!preview?.subject.trim()&&!!preview?.text.trim();
 async function prepare(){
   if(demo)return;setBusy(true);setError('');setNotice('');
   try{const response=await fetch(`/api/admin/appointment/?id=${encodeURIComponent(row.id)}`,{cache:'no-store'});if(!response.ok)throw new Error();setPreview(await response.json())}catch{setError(t.saveFirst)}finally{setBusy(false)}
 }
 async function saveDraft(){
   if(!preview||!valid){setError(c.required);return}setBusy(true);onBusy(true);setError('');setNotice('');
   try{const response=await fetch('/api/admin/appointment/',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,draft:{subject:preview.subject,text:preview.text}})});if(!response.ok)throw new Error();setPreview(await response.json());setNotice(c.saved)}catch{setError(c.draftError)}finally{setBusy(false);onBusy(false)}
 }
 async function send(){
   if(unsaved||!preview||!valid)return;setBusy(true);onBusy(true);setError('');
   try{const response=await fetch('/api/admin/appointment/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,draft:{subject:preview.subject,text:preview.text}})});const data=await response.json();if(!response.ok){setError(data.error==='ALREADY_SENT'?t.duplicate:data.error==='SMTP_NOT_CONFIGURED'?t.noSmtp:t.failed);return}onSent(data.request)}catch{setError(t.failed)}finally{setBusy(false);onBusy(false)}
 }
 function eml(){
   if(!preview)return;const boundary=`carfit-${crypto.randomUUID()}`;
   const headers=[`To: ${preview.to}`,`Subject: =?UTF-8?B?${encoded(preview.subject).replace(/\r\n/g,'')}?=`,'X-Unsent: 1','MIME-Version: 1.0'];
   let body:string[];
   if(preview.ics){headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);body=[`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded(preview.text),`--${boundary}`,'Content-Type: text/calendar; charset=UTF-8; method=PUBLISH','Content-Disposition: attachment; filename="car-fit24.ics"','Content-Transfer-Encoding: base64','',encoded(preview.ics),`--${boundary}--`,'']}
   else{headers.push('Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64');body=[encoded(preview.text),'']}
   download([...headers,'',...body].join('\r\n'),'message/rfc822','car-fit24-bestaetigung.eml');
 }
 return <section className="appointment-email"><h3><Mail size={16}/>{c.german}</h3><p>{t.help}</p>
 {row.email_delivery?.state==='sent'&&<div className="appointment-sent"><CheckCircle2 size={16}/><span>{t.sentLabel} · {new Date(row.email_delivery.sent_at!).toLocaleString(lang,{timeZone:'Europe/Berlin'})} (Hamburg)<small>{row.email_delivery.to}</small></span></div>}
 {!preview&&<><button className="desk-secondary" type="button" onClick={()=>void prepare()} disabled={!ready||busy||demo||unsaved}>{busy?<LoaderCircle size={16} className="spin"/>:<Mail size={16}/>} {t.ready}</button>{(!ready||unsaved)&&<small>{t.saveFirst}</small>}</>}
 {preview&&<div className="email-preview"><span className="desk-overline">{c.edit} · DE</span><dl><div><dt>{t.to}</dt><dd>{preview.to}</dd></div></dl>
 <label>{c.subject}<input value={preview.subject} maxLength={250} onChange={e=>{setPreview({...preview,subject:e.target.value,alreadySent:false});setNotice('')}}/></label>
 <label>{c.body}<textarea lang="de" value={preview.text} maxLength={8000} rows={14} onChange={e=>{setPreview({...preview,text:e.target.value,alreadySent:false});setNotice('')}}/></label>
 <button type="button" className="desk-secondary" onClick={()=>void saveDraft()} disabled={busy||!valid}><Save size={15}/>{c.save}</button>
 {preview.configured?<button type="button" className="desk-primary" onClick={()=>void send()} disabled={busy||preview.alreadySent||!valid}>{busy?<LoaderCircle size={16} className="spin"/>:<Send size={16}/>} {busy?t.sending:preview.alreadySent?t.sentLabel:t.send}</button>:<p className="email-setup-note">{t.noSmtp}</p>}
 <div className="email-tools"><a className="desk-secondary" aria-disabled={!valid} href={valid?`mailto:${encodeURIComponent(preview.to)}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.text)}`:undefined}><ExternalLink size={15}/>{t.manual}</a><button className="desk-secondary" disabled={!valid} type="button" onClick={eml}><Download size={15}/>{t.download}</button>{preview.ics&&<button className="desk-secondary" type="button" onClick={()=>download(preview.ics!,'text/calendar;charset=utf-8','car-fit24.ics')}><CalendarDays size={15}/>{t.calendar}</button>}</div><small>{t.manualNote}</small></div>}
 {notice&&<p className="desk-notice" role="status">{notice}</p>}{error&&<p className="desk-error" role="alert">{error}</p>}</section>;
}
