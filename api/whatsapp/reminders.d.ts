type MetaOptions = {env?:Record<string,string|undefined>;fetchImpl?:typeof fetch};
export function metaConfiguration(env?:Record<string,string|undefined>):{configured:boolean};
export function metaGraphRequest(path:string,init?:{method?:string;headers?:Record<string,string>;body?:unknown},options?:MetaOptions):Promise<Record<string,any>>;
export function sendTemplateReminder(input:{enabled?:boolean;to:string;templateName:string;parameters:string[]},options?:MetaOptions):Promise<{ok:false;reason:string}|{ok:true;providerMessageId:string}>;
export function expiredMemberships<T extends {id:number;memberId:number;status:string;endDate:string}>(rows:T[],today:string):T[];
