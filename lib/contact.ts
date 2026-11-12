export function whatsappUrl(number:string){
 let digits=number.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 else if(digits.startsWith('0'))digits='49'+digits.slice(1);
 return digits.length>=6?`https://wa.me/${digits}`:null;
}
