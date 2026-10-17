import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const [command,...args]=process.argv.slice(2);
async function main(){
 if(!['doctor','render','icons'].includes(command))throw Error('Usage: node cli.mjs doctor | icons [query] | render input.mmd --out output/base [--png] [--force]');
 const runtime=await import('./node-render.mjs').catch(e=>{throw Error('Runtime unavailable. Run node '+path.join(root,'runtime/setup.mjs')+'; '+e.message);});
 try {
  if(command==='doctor')return {ok:true,renderer:'bundled',runtime:'node-jsdom',chromium:false,icons:runtime.icons('').length};
  if(command==='icons')return runtime.icons(args.join(' '));
  const input=args[0],oi=args.indexOf('--out');
  if(!input||oi<1||!args[oi+1]||args.some((a,i)=>i>0&&i!==oi+1&&!['--out','--force','--png'].includes(a)))throw Error('render requires input.mmd --out output/base [--png] [--force]');
  const base=path.resolve(args[oi+1]);
  const outputs=Object.fromEntries(['svg','html','json',...(args.includes('--png')?['png']:[])].map(ext=>[ext,base+'.'+ext]));
  for(const f of Object.values(outputs)){
   if(path.resolve(input)===f)throw Error('Output would overwrite source');
   try{const st=await fs.lstat(f);if(!args.includes('--force')||!st.isFile()||st.isSymbolicLink())throw Error('Output exists (use --force for generated files): '+f);}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const source=await fs.readFile(input,'utf8');if(Buffer.byteLength(source)>1024*1024)throw Error('Source exceeds 1 MiB');
  const result=await runtime.render(source);
  const svg=result.svg;
  const raster=args.includes('--png')?await runtime.png(result):null;
  const report={width:result.layout.width,height:result.layout.height,nodes:result.model.nodes.length,edges:result.model.edges.length,diagnostics:result.model.diagnostics,...(raster?{pngWidth:raster.width,pngHeight:raster.height}:{})};
  const html='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><title>ArchMap diagram</title><style>body{margin:24px;background:white}svg{max-width:100%;height:auto}</style>'+svg+'</html>';
  await fs.mkdir(path.dirname(base),{recursive:true});
  for(const [ext,data] of Object.entries({svg,...(raster?{png:raster.data}:{}),html,json:JSON.stringify(report,null,2)+'\n'}))await fs.writeFile(outputs[ext],data,{flag:args.includes('--force')?'w':'wx'});
  return {ok:true,...report,files:outputs};
 }finally{runtime.close();}
}
const timeout=setTimeout(()=>{console.error('ArchMap timed out after 60 seconds');process.exit(1);},60000);
try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}finally{clearTimeout(timeout);}
