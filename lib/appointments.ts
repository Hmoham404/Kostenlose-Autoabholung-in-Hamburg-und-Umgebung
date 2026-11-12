export const appointmentZone='Europe/Berlin';
export function berlinInput(iso:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:appointmentZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
 const get=(type:string)=>parts.find(p=>p.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function berlinToISO(wallTime:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wallTime))throw new Error('INVALID_DATE');
 const target=Date.parse(`${wallTime}:00Z`);let guess=target;
 for(let i=0;i<3;i++){const rendered=Date.parse(`${berlinInput(new Date(guess).toISOString())}:00Z`);guess+=target-rendered}
 const result=new Date(guess).toISOString();if(berlinInput(result)!==wallTime)throw new Error('INVALID_DATE');return result;
}
