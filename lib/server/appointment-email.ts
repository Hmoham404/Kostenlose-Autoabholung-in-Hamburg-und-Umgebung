import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import type {RequestRow} from './store';
import {validEmail} from './store';

export function mailConfigured(){return !!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD&&validEmail(process.env.SMTP_FROM||process.env.SMTP_USER))}
export function validDraft(draft:unknown):draft is {subject:string;text:string}{if(!draft||typeof draft!=='object')return false;const d=draft as Record<string,unknown>;return typeof d.subject==='string'&&d.subject.trim().length>0&&d.subject.length<=250&&!/[\r\n\0]/.test(d.subject)&&typeof d.text==='string'&&d.text.trim().length>0&&d.text.length<=8000&&!/\0/.test(d.text)}
export function appointmentMessage(row:RequestRow){
 if(!['accepted','scheduled'].includes(row.status)||!validEmail(row.payload.email))throw new Error('APPOINTMENT_NOT_READY');
 const lang='de';
 const when=row.appointment_at?new Intl.DateTimeFormat('de-DE',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(row.appointment_at)):'nach persönlicher Vereinbarung';
 const car=`${row.payload.make} ${row.payload.model}`;
 const address=`${row.payload.address}, ${row.payload.postal} ${row.payload.city}`;
 const words={de:{subject:'Ihr Abholtermin mit Car-Fit24',hello:`Guten Tag ${row.payload.name},`,intro:'Ihre Anfrage wurde angenommen. Wir bestätigen die kostenlose Fahrzeugabholung:',date:'Termin',car:'Fahrzeug',place:'Abholadresse',zone:'Uhrzeit in Hamburg (Europe/Berlin)',end:'Bei Fragen oder Änderungswünschen melden Sie sich bitte direkt bei Sofiane.',thanks:'Viele Grüße'},fr:{subject:'Votre rendez-vous d’enlèvement avec Car-Fit24',hello:`Bonjour ${row.payload.name},`,intro:'Votre demande est acceptée. Nous confirmons l’enlèvement gratuit de votre véhicule :',date:'Rendez-vous',car:'Véhicule',place:'Adresse d’enlèvement',zone:'Heure de Hambourg (Europe/Berlin)',end:'Pour une question ou un changement, contactez directement Sofiane.',thanks:'Cordialement'},en:{subject:'Your vehicle collection with Car-Fit24',hello:`Hello ${row.payload.name},`,intro:'Your request has been accepted. We confirm free collection of your vehicle:',date:'Appointment',car:'Vehicle',place:'Collection address',zone:'Hamburg time (Europe/Berlin)',end:'For questions or changes, please contact Sofiane directly.',thanks:'Kind regards'}}[lang];
 const subject=row.email_draft?.subject||(row.appointment_at?`${words.subject} · ${car}`:`Ihre Anfrage bei Car-Fit24 wurde angenommen · ${car}`);
 const text=row.email_draft?.text||`${words.hello}\n\n${row.appointment_at?words.intro:'Ihre Anfrage zur kostenlosen Fahrzeugabholung wurde angenommen. Sofiane meldet sich bei Ihnen, um einen passenden Abholtermin zu vereinbaren.'}\n\n${words.date}: ${when}\n${row.appointment_at?words.zone+'\n':''}${words.car}: ${car}\n${words.place}: ${address}\n\n${words.end}\n\n${words.thanks}\nSofiane · Car-Fit24\n+49 174 2319226\ninfo@car-fit24.de\n\nRef: ${row.id}`;
 const escape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const fold=(line:string)=>{const lines:string[]=[];let current='';for(const char of line){if(Buffer.byteLength(current+char)>73){lines.push(current);current=' '+char}else current+=char}lines.push(current);return lines.join('\r\n')};
 const ics=row.appointment_at?['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Car-Fit24//Collection//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${row.id}@car-fit24`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(new Date(row.appointment_at))}`,`SUMMARY:${escape(words.subject+' · '+car)}`,`LOCATION:${escape(address)}`,`DESCRIPTION:${escape('Car-Fit24 · Sofiane · +49 174 2319226 · Ref: '+row.id)}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n':null;
 const key=createHash('sha256').update(JSON.stringify([row.id,row.payload.email,row.appointment_at,lang,address,car,subject,text])).digest('hex');
 return {to:row.payload.email,subject,text,ics,key};
}
export async function sendAppointment(row:RequestRow){
 if(!mailConfigured())throw new Error('SMTP_NOT_CONFIGURED');
 const message=appointmentMessage(row),port=Number(process.env.SMTP_PORT||587);
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000});
 const sent=await transport.sendMail({from:{name:'Car-Fit24',address:(process.env.SMTP_FROM||process.env.SMTP_USER)!},to:message.to,replyTo:process.env.SMTP_FROM||process.env.SMTP_USER,subject:message.subject,text:message.text,attachments:message.ics?[{filename:'car-fit24.ics',content:message.ics,contentType:'text/calendar; charset=utf-8; method=PUBLISH'}]:[]});
 if(!sent.accepted?.length)throw new Error('EMAIL_REJECTED');return {messageId:sent.messageId,...message};
}
