import {PhotoRecord,updatePhoto} from './storage';

export type SyncConfig={url:string;token:string;enabled:boolean};
export type Snapshot={reports:Record<string,unknown>[];works:Record<string,unknown>[];streets:Record<string,unknown>[]};
const CONFIG_KEY='rdo-facil-server-config';
const DEFAULT_SERVER_URL='https://franerdserver.tail38777c.ts.net';

export function loadSyncConfig():SyncConfig{
 try{return{url:DEFAULT_SERVER_URL,token:'',enabled:false,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}}
 catch{return{url:DEFAULT_SERVER_URL,token:'',enabled:false}}
}
export function saveSyncConfig(config:SyncConfig){localStorage.setItem(CONFIG_KEY,JSON.stringify({...config,url:config.url.trim().replace(/\/$/, '')}))}

async function request(config:SyncConfig,path:string,init:RequestInit={}){
 if(!config.enabled||!config.url)throw new Error('Servidor não configurado');
 const response=await fetch(config.url+path,{...init,headers:{Authorization:`Bearer ${config.token}`,...init.headers}});
 if(!response.ok){let message=`Erro ${response.status}`;try{const value=await response.json() as {error?:string};message=value.error||message}catch{}throw new Error(message)}
 return response;
}

export async function testServer(config:SyncConfig){return (await request({...config,enabled:true},'/api/health')).json()}
export async function getSnapshot(config:SyncConfig):Promise<Snapshot>{return (await request(config,'/api/snapshot')).json()}
export async function putItem(config:SyncConfig,resource:'reports'|'works'|'streets',item:{id:string}){await request(config,`/api/${resource}/${encodeURIComponent(item.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)})}
export async function deleteItem(config:SyncConfig,resource:'reports'|'works'|'streets',id:string){await request(config,`/api/${resource}/${encodeURIComponent(id)}`,{method:'DELETE'})}
export async function uploadPhoto(config:SyncConfig,reportId:string,file:Blob,name:string,type:string,id?:string){const response=await request(config,`/api/reports/${encodeURIComponent(reportId)}/photos`,{method:'POST',headers:{'X-File-Name':encodeURIComponent(name),'X-File-Type':type||'image/jpeg',...(id?{'X-Photo-Id':id}:{})},body:file});return response.json()}
export async function deleteRemotePhoto(config:SyncConfig,id:string){await request(config,`/api/photos/${encodeURIComponent(id)}`,{method:'DELETE'})}
export async function updateRemotePhoto(config:SyncConfig,id:string,caption:string){await request(config,`/api/photos/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({caption})})}
export async function downloadPhotos(config:SyncConfig,reportId:string):Promise<PhotoRecord[]>{
 const metadata=await (await request(config,`/api/reports/${encodeURIComponent(reportId)}/photos`)).json() as Omit<PhotoRecord,'blob'>[];
 const photos=await Promise.all(metadata.map(async(item:Omit<PhotoRecord,'blob'>)=>{const blob=await (await request(config,`/api/photos/${encodeURIComponent(item.id)}/file`)).blob();return{...item,blob}}));
 for(const photo of photos)await updatePhoto(photo);
 return photos;
}
