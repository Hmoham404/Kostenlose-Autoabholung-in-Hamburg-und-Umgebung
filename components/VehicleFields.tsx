import {makes,vehicleModels} from '@/lib/vehicles';
import {Lang} from './content';
export default function VehicleFields({lang,make,model,onChange,id='vehicle'}:{lang:Lang;make:string;model:string;onChange:(make:string,model:string)=>void;id?:string}){
 const w={de:['Marke','Modell','Marke auswählen','Zuerst Marke wählen','Modell wählen oder eingeben'],fr:['Marque','Modèle','Choisir une marque','Choisissez une marque','Choisir ou saisir le modèle'],en:['Make','Model','Select a make','Select a make first','Select or enter model']}[lang];
 return <><label>{w[0]} *<input list={`${id}-makes`} required value={make} placeholder={w[2]} onChange={e=>onChange(e.target.value,'')} autoComplete="off" maxLength={100}/><datalist id={`${id}-makes`}>{makes.map(m=><option key={m} value={m}/>)}</datalist></label><label>{w[1]} *<input list={`${id}-models`} required disabled={!make.trim()} value={model} placeholder={make?w[4]:w[3]} onChange={e=>onChange(make,e.target.value)} autoComplete="off" maxLength={100}/><datalist id={`${id}-models`}>{(vehicleModels[makes.find(m=>m.toLowerCase()===make.toLowerCase())||make]||[]).map(m=><option key={m} value={m}/>)}</datalist></label></>;
}
