'use client';
import {LayoutDashboard,ClipboardList,CalendarDays,Check,CheckCircle2,X,XCircle,LogOut,ExternalLink,ArrowUpRight,ArrowRight,ArrowLeft,RefreshCw,Search,Mail,Phone,MessageCircle,Trash2,Undo2,LockKeyhole,Inbox,Clock3,Save,LoaderCircle,Menu} from 'lucide-react';
import {clientCopy} from './client-content';
import {whatsappUrl} from '@/lib/contact';
import AppointmentEmail from './AppointmentEmail';
import {decisionCopy} from './decision-content';
import {berlinInput,berlinToISO} from '@/lib/appointments';
import type {RequestRow} from '@/lib/server/store';
import {useEffect,useRef,useState,FormEvent} from 'react';
import Brand from '../Brand';
import Flag from '../Flag';
import {adminCopy,AdminLang} from './content';

type Status=RequestRow['status'];
type View='overview'|'requests'|'appointments'|'archive'|'rejected';
const statusKeys:Status[]=['new','review','accepted','rejected','scheduled','collected'];
const value=(r:RequestRow,key:string)=>String(r.payload[key]??'');
const brandFiles:Record<string,string>={'Volkswagen':'volkswagen','Mercedes-Benz':'mercedes-benz','BMW':'bmw','Audi':'audi','Opel':'opel','Ford':'ford','Renault':'renault'};
const conditions:Record<string,[string,string,string]>={engine:['Motorschaden','Panne moteur','Engine damage'],gearbox:['Getriebeschaden','Panne de boîte','Gearbox damage'],stored:['Lange Standzeit','Immobilisation prolongée','Long storage'],accident:['Unfallschaden','Accidenté','Accident damage'],other:['Sonstiges','Autre','Other']};
function samples():RequestRow[]{return ['Volkswagen','Mercedes-Benz','BMW','Audi','Opel'].map((make,i)=>({id:`DEMO-2026-00${i+1}`,payload:{make,model:['Golf','C-Klasse','3er','A4','Corsa'][i],year:['2010','2008','2012','2009','2014'][i],name:`Beispielkunde ${String.fromCharCode(65+i)}`,phone:'',postal:'22043',city:'Hamburg',address:'Beispieladresse — Demo',wheels:'4',condition:['engine','accident','gearbox','stored','other'][i],notes:'DEMO — Keine echte Kundenanfrage.'},photo_paths:[],status:(['new','review','scheduled','collected','new'] as Status[])[i],appointment_at:i===2?new Date(Date.now()+86400000).toISOString():null,created_at:new Date(Date.now()-i*86400000).toISOString()}))}
function Mark({make}:{make:string}){const file=brandFiles[make];return <span className="desk-car-mark">{file?<img src={`/brands/${file}.png`} alt=""/>:<span>{make.slice(0,2).toUpperCase()}</span>}</span>}

export default function AdminWorkspace({demo=false}:{demo?:boolean}){
 const [lang,setLang]=useState<AdminLang>('de');
 const [ready,setReady]=useState(false),[allowed,setAllowed]=useState(false);
 const [accessCode,setAccessCode]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [rows,setRows]=useState<RequestRow[]>([]),[view,setView]=useState<View>('overview'),[filter,setFilter]=useState('all'),[search,setSearch]=useState('');
 const [selected,setSelected]=useState<RequestRow|null>(null),[status,setStatus]=useState<Status>('new'),[appointment,setAppointment]=useState('');
 const [photos,setPhotos]=useState<string[]>([]),[photoState,setPhotoState]=useState<'idle'|'loading'|'error'>('idle'),[detailError,setDetailError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const t=adminCopy[lang],d=decisionCopy[lang],c=clientCopy[lang];
 const [clientEmail,setClientEmail]=useState(''),[clientPhone,setClientPhone]=useState(''),[clientWhatsapp,setClientWhatsapp]=useState(''),[detailNotice,setDetailNotice]=useState(''),[deleteConfirm,setDeleteConfirm]=useState(false),[deletedId,setDeletedId]=useState<string|null>(null);
 const locale={de:'de-DE',fr:'fr-FR',en:'en-GB'}[lang];
 const date=(date:string,time=false)=>new Date(date).toLocaleString(locale,time?{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}:{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Berlin'});

 async function refresh(){
   if(demo)return;
   setLoading(true);setError('');
   try{const response=await fetch('/api/admin/requests/',{cache:'no-store'});if(response.status===401){setAllowed(false);setRows([]);throw new Error('UNAUTHORIZED')}if(!response.ok)throw new Error('LOAD_FAILED');const data=await response.json();setRows(data.requests||[])}catch{setError(t.fetchError)}finally{setLoading(false)}
 }
 async function check(){
   try{const response=await fetch('/api/admin/session/',{cache:'no-store'});const data=await response.json();setAllowed(data.authenticated===true);if(data.authenticated)await refresh()}
   catch{setError(t.loginError)}finally{setReady(true)}
 }

 useEffect(()=>{
   const query=new URLSearchParams(location.search).get('lang');
   let saved:string|null=null;try{saved=localStorage.getItem('carfit-admin-language')}catch{}
   const initial=query||saved;if(initial==='fr'||initial==='en'||initial==='de')setLang(initial);
   if(demo){setRows(samples());setAllowed(true);setReady(true);return}
   void check();

 },[demo]);
 useEffect(()=>{document.documentElement.lang=lang},[lang]);
 useEffect(()=>{
   if(!selected){dialog.current?.close();return}
   dialog.current?.showModal();
   let active=true;setPhotos([]);setPhotoState('idle');
   if(!demo&&selected.photo_paths.length){
     setPhotoState('loading');
     Promise.resolve().then(()=>{if(!active)return;setPhotos(selected.photo_paths.map((_,i)=>`/api/admin/photos/${selected.id}/${i}/`));setPhotoState('idle')});
   }
   return()=>{active=false};
 },[selected,demo]);
 function language(next:AdminLang){setLang(next);try{localStorage.setItem('carfit-admin-language',next)}catch{}}
 async function login(event:FormEvent){
   event.preventDefault();setBusy(true);setError('');
   try{const response=await fetch('/api/admin/session/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:accessCode})});if(!response.ok)throw new Error('LOGIN_FAILED');setAccessCode('');await check()}
   catch{setError(t.loginError)}finally{setBusy(false)}
 }
 async function logout(){setError('');try{const response=await fetch('/api/admin/session/',{method:'DELETE'});if(!response.ok)throw new Error('LOGOUT_FAILED');setAllowed(false);setRows([]);setSelected(null)}catch{setError(t.loginError)}}
 function open(row:RequestRow){setSelected(row);setStatus(row.status);setDetailError('');setNotice('');setDetailNotice('');setClientEmail(value(row,'email'));setClientPhone(value(row,'phone'));setClientWhatsapp(value(row,'whatsapp')||value(row,'phone'));setDeleteConfirm(false);setAppointment(row.appointment_at?berlinInput(row.appointment_at):'')}
 async function commit(nextStatus:Status){
   if(!selected)return;
   if(nextStatus!=='rejected'&&clientEmail&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(clientEmail)){setDetailError(d.invalidEmail);return}
   if(nextStatus==='scheduled'&&!appointment){setDetailError(t.dateRequired);return}
   let iso:string|null=null;
   try{iso=nextStatus!=='rejected'&&appointment?berlinToISO(appointment):null}catch{setDetailError(t.dateRequired);return}
   setBusy(true);setDetailError('');setDetailNotice('');
   const savedEmail=nextStatus==='rejected'?value(selected,'email'):clientEmail;
   const savedPhone=nextStatus==='rejected'?value(selected,'phone'):clientPhone,savedWhatsapp=nextStatus==='rejected'?(value(selected,'whatsapp')||value(selected,'phone')):clientWhatsapp;
   const changes={status:nextStatus,appointment_at:iso,email:savedEmail,phone:savedPhone,whatsapp:savedWhatsapp};
   try{
     let updated:RequestRow={...selected,status:nextStatus,appointment_at:iso,payload:{...selected.payload,email:savedEmail,phone:savedPhone,whatsapp:savedWhatsapp}};
     if(!demo){const response=await fetch('/api/admin/requests/',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,...changes})});if(!response.ok)throw new Error('UPDATE_FAILED');updated=(await response.json()).request}
     setRows(old=>old.map(row=>row.id===updated.id?updated:row));setSelected(updated);setStatus(updated.status);if(nextStatus==='rejected'){setAppointment('');setClientEmail(value(updated,'email'));setClientPhone(value(updated,'phone'));setClientWhatsapp(value(updated,'whatsapp')||value(updated,'phone'))}setDetailNotice(nextStatus==='rejected'?d.refused:d.saved);
   }catch{setDetailError(t.saveError)}finally{setBusy(false)}
 }
 async function save(event:FormEvent){event.preventDefault();await commit(status)}
 function emailSent(updated:RequestRow){setRows(old=>old.map(row=>row.id===updated.id?updated:row));setSelected(updated);setStatus(updated.status);setDetailNotice(d.sent)}
 async function removeSelected(){
   if(!selected)return;setBusy(true);setDetailError('');
   try{if(!demo){const response=await fetch('/api/admin/requests/',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})});if(!response.ok)throw new Error()}
     setDeletedId(selected.id);setRows(old=>old.filter(r=>r.id!==selected.id));setSelected(null);setNotice(c.deleted);setDeleteConfirm(false);
   }catch{setDetailError(c.failed)}finally{setBusy(false)}
 }
 async function undoDelete(){
   if(!deletedId||demo)return;setBusy(true);
   try{const response=await fetch('/api/admin/requests/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:deletedId,action:'restore'})});if(!response.ok)throw new Error();const data=await response.json();setRows(old=>[data.request,...old]);setDeletedId(null);setNotice('')}
   catch{setError(c.failed)}finally{setBusy(false)}
 }
 function navigate(next:View){setView(next);setFilter('all');setSearch('');setNotice('')}
 const languageButtons=<div className="desk-languages">{(['de','fr','en'] as AdminLang[]).map(l=><button key={l} type="button" aria-label={{de:'Deutsch',fr:'Français',en:'English'}[l]} aria-pressed={lang===l} onClick={()=>language(l)}><Flag lang={l}/><span>{l.toUpperCase()}</span></button>)}</div>;
 if(!ready)return <main className="desk-loading"><Brand/><span className="desk-spinner"/><p>{t.working}</p></main>;
 if(!allowed)return <main className="desk-login"><section className="desk-login-story"><a href="/" aria-label="Car-Fit24"><Brand/></a><div><span className="desk-overline">CAR-FIT24 / {t.portal}</span><h1>{t.loginTitle}</h1><p>{t.loginBody}</p><div className="desk-story-line"><span>01 — {t.requests}</span><span>02 — {t.appointments}</span><span>03 — {t.archive}</span></div></div><small>HAMBURG & UMGEBUNG</small></section><section className="desk-login-panel"><div className="desk-login-top"><a href="/">← {t.back}</a>{languageButtons}</div><form onSubmit={login}><span className="desk-lock"><LockKeyhole size={23}/></span><span className="desk-overline">{t.private}</span><h2>{t.hello}</h2><p>{t.loginIntro}</p><label>{t.accessCode}<input type="password" required autoComplete="off" autoCapitalize="characters" spellCheck={false} value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="CF24-XXXXXX-XXXXXX" maxLength={200}/></label>{error&&<p className="desk-error" role="alert">{error}</p>}<button className="desk-primary" disabled={busy}>{busy?t.signing:t.login}<ArrowRight size={18}/></button><small>{t.secure}</small><a className="desk-preview-link" href={`/admin/preview/?lang=${lang}`}>{t.preview} ↗</a></form><p className="desk-login-foot">© {new Date().getFullYear()} Car-Fit24</p></section></main>;

 const query=search.toLocaleLowerCase().trim();
 const filtered=rows.filter(r=>(view!=='archive'||r.status==='collected')&&(view!=='rejected'||r.status==='rejected')&&(view!=='appointments'||r.status==='scheduled')&&(filter==='all'||r.status===filter)&&(!query||[r.id,...['make','model','name','phone','postal','city'].map(k=>value(r,k))].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>view==='appointments'?(a.appointment_at||'').localeCompare(b.appointment_at||''):b.created_at.localeCompare(a.created_at));
 const upcoming=rows.filter(r=>r.status==='scheduled'&&r.appointment_at&&new Date(r.appointment_at)>=new Date()).sort((a,b)=>a.appointment_at!.localeCompare(b.appointment_at!)).slice(0,4);
 const heading={overview:t.overview,requests:t.requests,appointments:t.appointments,archive:t.archive,rejected:t.rejected}[view];
 return <main className="desk-shell">
   <aside className="desk-sidebar"><a href="/" aria-label="Car-Fit24"><Brand/></a><span className="desk-sidebar-caption">{t.portal}</span><nav>{(['overview','requests','appointments','archive','rejected'] as View[]).map((v,i)=><button key={v} className={view===v?'active':''} onClick={()=>navigate(v)}><span>{[<LayoutDashboard key='overview' size={18}/>,<ClipboardList key='requests' size={18}/>,<CalendarDays key='appointments' size={18}/>,<CheckCircle2 key='archive' size={18}/>,<XCircle key='rejected' size={18}/>][i]}</span>{[t.overview,t.requests,t.appointments,t.archive,t.rejected][i]}{v==='requests'&&<b>{rows.filter(r=>r.status==='new').length}</b>}</button>)}</nav><div className="desk-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> {t.back}</a>{demo?<a href={`/admin/?lang=${lang}`}>← {t.demoExit}</a>:<button onClick={()=>void logout()}><LogOut size={16}/> {t.logout}</button>}<div className="desk-profile"><img className="sofiane-avatar" src="/images/sofiane-carfit24.webp" alt="Car-Fit24" width={38} height={38}/><div><strong>Sofiane</strong><small>Car-Fit24 · Admin</small></div><i/></div></div></aside>
   <div className="desk-main"><header className="desk-topbar"><span>Car-Fit24 <i>/</i> {heading}</span>{languageButtons}</header>{demo&&<div className="desk-demo-banner" role="status">{t.demo}<a href={`/admin/?lang=${lang}`}>{t.demoExit} ↗</a></div>}
   <div className="desk-content"><div className="desk-title"><div><span className="desk-overline">{t.workspace}</span><h1>{heading}<span>.</span></h1><p>{t.subtitle}</p></div>{!demo&&<button className="desk-secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15} className={loading?'spin':''}/> {loading?t.loading:t.refresh}</button>}</div>
   <div className="desk-stats">{[{label:t.total,count:rows.length,key:'all',icon:<ClipboardList size={18}/>},{label:t.pending,count:rows.filter(r=>r.status==='new').length,key:'new',icon:<Inbox size={18}/>},{label:t.upcoming,count:rows.filter(r=>r.status==='scheduled').length,key:'scheduled',icon:<CalendarDays size={18}/>},{label:t.rejected,count:rows.filter(r=>r.status==='rejected').length,key:'rejected',icon:<XCircle size={18}/>}].map(s=><button key={s.key} onClick={()=>{setView('requests');setFilter(s.key);setSearch('')}}><span className={`stat-icon stat-${s.key}`}>{s.icon}</span><span>{s.label}</span><strong>{s.count.toString().padStart(2,'0')}</strong><small>↗</small></button>)}</div>
   {error&&<p role="alert" className="desk-error">{error}</p>}{notice&&<div className="desk-notice" role="status">{notice}{deletedId&&!demo&&<button type="button" disabled={busy} onClick={()=>void undoDelete()}><Undo2 size={15}/>{c.undo}</button>}</div>}
   <section className="desk-list"><div className="desk-list-heading"><div><h2>{view==='appointments'?t.appointments:view==='archive'?t.archive:t.tableTitle}</h2><p>{t.scope}</p></div><span className="desk-count">{filtered.length}</span></div><div className="desk-toolbar"><label className="desk-search"><Search size={17}/><input type="search" aria-label={t.search} placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label={t.status} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t.all}</option>{statusKeys.map(s=><option key={s} value={s}>{t[s]}</option>)}</select></div>
   <div className="desk-table-scroll"><table><thead><tr><th>{t.vehicle}</th><th>{t.customer}</th><th>{t.location}</th><th>{t.status}</th><th>{view==='appointments'?t.appointments:t.received}</th><th/></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td data-label={t.vehicle}><div className="desk-vehicle"><Mark make={value(r,'make')}/><div><strong>{value(r,'make')} {value(r,'model')}</strong><small>{value(r,'year')} · {r.id.slice(0,13)}</small></div></div></td><td data-label={t.customer}><strong>{value(r,'name')}</strong><small>{value(r,'email')||'—'}</small><small>{value(r,'phone')||'—'}</small><div className="client-quick-links">{value(r,'email')&&<a href={`mailto:${value(r,'email')}`} aria-label={`${c.email}: ${value(r,'email')}`} title={c.email}><Mail size={15}/></a>}{value(r,'phone')&&<a href={`tel:${value(r,'phone').replace(/[^+0-9]/g,'')}`} aria-label={`${c.phone}: ${value(r,'phone')}`} title={c.phone}><Phone size={15}/></a>}{whatsappUrl(value(r,'whatsapp')||value(r,'phone'))&&<a href={whatsappUrl(value(r,'whatsapp')||value(r,'phone'))!} target="_blank" rel="noreferrer" title={c.whatsapp} aria-label={`${c.whatsapp}: ${value(r,'whatsapp')||value(r,'phone')}`}><MessageCircle size={15}/></a>}</div></td><td data-label={t.location}>{value(r,'city')}<small>{value(r,'postal')}</small></td><td data-label={t.status}><span className={`desk-status ${r.status}`}><i/>{t[r.status]}</span></td><td data-label={view==='appointments'?t.appointments:t.received}>{view==='appointments'?(r.appointment_at?date(r.appointment_at,true):'—'):date(r.created_at)}</td><td><button className="desk-open" onClick={()=>open(r)}>{t.open} <ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div>{loading&&<p className="desk-fetching" role="status">{t.loading}</p>}{!loading&&!filtered.length&&<div className="desk-empty"><span><Inbox size={34}/></span><h3>{t.empty}</h3><p>{t.emptyText}</p></div>}</section>
   {view==='overview'&&<section className="desk-upcoming"><div><h2>{t.next}</h2><button onClick={()=>navigate('appointments')}>{t.appointments} →</button></div>{upcoming.length?<div className="desk-appointment-grid">{upcoming.map(r=><button key={r.id} onClick={()=>open(r)}><span className="desk-date-tile">{new Date(r.appointment_at!).toLocaleDateString(locale,{day:'2-digit',timeZone:'Europe/Berlin'})}<small>{new Date(r.appointment_at!).toLocaleDateString(locale,{month:'short',timeZone:'Europe/Berlin'})}</small></span><span><strong>{value(r,'make')} {value(r,'model')}</strong><small>{value(r,'city')} · {new Date(r.appointment_at!).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'})}</small></span><b>↗</b></button>)}</div>:<p>{t.noAppointments}</p>}</section>}
   <p className="desk-footnote">Car-Fit24 · {t.private}</p></div></div>
   <dialog className="desk-dialog" ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)setSelected(null)}} onClick={e=>{if(e.target===e.currentTarget&&!busy)setSelected(null)}}>
   {selected&&<form onSubmit={save}><header><div><span className="desk-overline">{t.detail}</span><small>{t.ref} · {selected.id}</small></div><button type="button" aria-label={t.close} disabled={busy} onClick={()=>setSelected(null)}><X size={20}/></button></header><div className="desk-detail-body"><div className="desk-detail-title"><Mark make={value(selected,'make')}/><div><h2>{value(selected,'make')} {value(selected,'model')}</h2><span className={`desk-status ${selected.status}`}><i/>{t[selected.status]}</span></div></div><h3><Phone size={14}/>{t.contact}</h3><div className="desk-customer-card"><strong>{value(selected,'name')}</strong><p>{value(selected,'address')}<br/>{value(selected,'postal')} {value(selected,'city')}</p>{value(selected,'phone')&&<a href={`tel:${value(selected,'phone').replace(/[^+0-9]/g,'')}`}>{t.call} · {value(selected,'phone')} ↗</a>}</div><label className="desk-client-email"><Mail size={14}/>{d.email}<input type="email" value={clientEmail} onChange={e=>setClientEmail(e.target.value)} maxLength={254}/>{!value(selected,'email')&&<small>{d.oldEmail}</small>}</label><div className="client-contact-fields"><label>{c.phone}<input type="tel" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} maxLength={40}/></label><label>{c.whatsapp}<input type="tel" value={clientWhatsapp} onChange={e=>setClientWhatsapp(e.target.value)} maxLength={40}/></label></div><div className="client-contact-actions">{clientEmail&&<a href={`mailto:${clientEmail}`}><Mail size={16}/>{c.email}</a>}{clientPhone&&<a href={`tel:${clientPhone.replace(/[^+0-9]/g,'')}`}><Phone size={16}/>{c.phone}</a>}{whatsappUrl(clientWhatsapp||clientPhone)&&<a href={whatsappUrl(clientWhatsapp||clientPhone)!} target="_blank" rel="noreferrer"><MessageCircle size={16}/>{c.whatsapp}</a>}</div><h3><ClipboardList size={14}/>{t.car}</h3><div className="desk-specs"><div><span>{t.year}</span><strong>{value(selected,'year')}</strong></div><div><span>{t.wheels}</span><strong>{value(selected,'wheels')}</strong></div><div><span>{t.condition}</span><strong>{conditions[value(selected,'condition')]?.[lang==='de'?0:lang==='fr'?1:2]||value(selected,'condition')}</strong></div></div><h3>{t.notes}</h3><p className="desk-notes">{value(selected,'notes')||t.noNotes}</p><h3>{t.photos}<small>{selected.photo_paths.length}</small></h3>{photoState==='loading'?<p>{t.photoLoading}</p>:photoState==='error'?<p role="alert" className="desk-error">{t.photoError}</p>:photos.length?<><div className="desk-photos">{photos.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${t.vehicle} ${i+1}`} onError={()=>setPhotoState('error')}/></a>)}</div><small>{t.photoHint}</small></>:<p className="desk-no-photos">{t.noPhotos}</p>}<section className="desk-decision"><h3>{d.decision}</h3><div><button type="button" disabled={busy} className={selected.status==='accepted'?'decision-accept chosen':'decision-accept'} onClick={()=>void commit('accepted')}><CheckCircle2 size={18}/>{d.accept}</button><button type="button" disabled={busy} className={selected.status==='rejected'?'decision-reject chosen':'decision-reject'} onClick={()=>void commit('rejected')}><XCircle size={18}/>{d.reject}</button></div><p>{d.rejectNote}</p></section><div className="desk-edit"><label>{t.status}<select value={status} onChange={e=>setStatus(e.target.value as Status)}>{statusKeys.map(s=><option key={s} value={s}>{t[s]}</option>)}</select></label><label>{d.appointment}<input type="datetime-local" required={status==='scheduled'} value={appointment} onChange={e=>setAppointment(e.target.value)}/></label></div>{detailNotice&&<p className="desk-notice" role="status">{detailNotice}</p>}<AppointmentEmail row={selected} lang={lang} demo={demo} onSent={emailSent} onBusy={setBusy} unsaved={clientPhone!==value(selected,'phone')||clientWhatsapp!==(value(selected,'whatsapp')||value(selected,'phone'))||clientEmail!==value(selected,'email')||status!==selected.status||appointment!==(selected.appointment_at?berlinInput(selected.appointment_at):'')}/>{detailError&&<p className="desk-error" role="alert">{detailError}</p>}{deleteConfirm&&<div className="client-delete-confirm" role="alert"><p>{c.confirm}</p><button type="button" className="desk-danger" disabled={busy} onClick={()=>void removeSelected()}><Trash2 size={15}/>{c.yes}</button><button type="button" className="desk-secondary" disabled={busy} onClick={()=>setDeleteConfirm(false)}>{c.cancel}</button></div>}</div><footer><button type="button" className="desk-delete-icon" disabled={busy} aria-label={c.remove} title={c.remove} onClick={()=>setDeleteConfirm(true)}><Trash2 size={17}/><span>{c.remove}</span></button><button className="desk-secondary" type="button" onClick={()=>setSelected(null)} disabled={busy}>{t.cancel}</button><button className="desk-primary" disabled={busy}><Save size={15}/>{busy?t.saving:t.save}</button></footer></form>}
   </dialog>
 </main>;
}
