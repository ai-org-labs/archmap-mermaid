import type {DiagramModel,DiagramNode} from './types.js';

export function validImageSource(src:string): boolean {
  try {
    if(/^data:/i.test(src))return /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;[^,]*)?,/i.test(src);
    return ['http:','https:','file:'].includes(new URL(src,document.baseURI).protocol);
  } catch {return false;}
}
export function imageSize(node:DiagramNode) {
  const image=node.image!;
  const naturalWidth=image.naturalWidth??280,naturalHeight=image.naturalHeight??180;
  const height=image.height??naturalHeight;
  const width=image.constraint==='on'?naturalWidth/naturalHeight*height:image.width??naturalWidth;
  return {width,height};
}
const cache=new Map<string,Promise<{data:string;width:number;height:number}>>();
function load(src:string) {
  const existing=cache.get(src);if(existing)return existing;
  const job=new Promise<{data:string;width:number;height:number}>((resolve,reject)=>{
    const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';
    const finish=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;};
    const timer=setTimeout(()=>{finish();image.src='';reject(new Error('画像の読込がタイムアウトしました'));},8000);
    image.onerror=()=>{finish();reject(new Error('画像を読み込めません（URL・CORS設定を確認してください）'));};
    image.onload=()=>{
      try {
        if(!image.naturalWidth||!image.naturalHeight)throw Error('画像サイズを取得できません');
        const canvas=document.createElement('canvas'),scale=Math.min(1,4096/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像の埋め込みに対応していません');
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const data=canvas.toDataURL('image/png');finish();resolve({data,width:image.naturalWidth,height:image.naturalHeight});
      }catch(error){finish();reject(error);}
    };
    image.src=src;
  });
  cache.set(src,job);if(cache.size>16)cache.delete(cache.keys().next().value!);
  void job.catch(()=>{if(cache.get(src)===job)cache.delete(src);});
  return job;
}
/** Resolve standard Mermaid images once, embedding raster data for portable SVG/PNG. */
export async function prepareDiagramImages(model:DiagramModel):Promise<DiagramModel> {
  const diagnostics=[...model.diagnostics];
  const nodes=[] as DiagramNode[];
  // Bound simultaneous image decoding and canvas allocation.
  for(let start=0;start<model.nodes.length;start+=4)nodes.push(...await Promise.all(model.nodes.slice(start,start+4).map(async node=>{
    if(!node.image)return node;
    try {
      if(!validImageSource(node.image.src))throw Error('画像URLの形式が未対応です');
      const result=await load(node.image.src);
      return {...node,image:{...node.image,data:result.data,naturalWidth:result.width,naturalHeight:result.height}};
    } catch {
      diagnostics.push({severity:'warning',line:node.line,message:`${node.label}: 画像を読み込めません。URL・CORS設定を確認してください。`});
      return {...node,image:{...node.image,error:true}};
    }
  })));
  return {...model,nodes,diagnostics};
}
