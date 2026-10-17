import {JSDOM} from 'jsdom';
import {imageSize} from 'image-size';
const dom=new JSDOM('<!doctype html><body></body>',{url:'http://archmap.local/'});
// No script execution or resource loading is enabled in this DOM.
for(const key of ['window','document','DOMParser','XMLSerializer','HTMLElement','Element','Node','SVGElement'])globalThis[key]=key==='window'?dom.window:dom.window[key];
const api=await import('../assets/archmap-mermaid.js');
api.installDiagramIcons();
export const icons=query=>api.getDiagramIconCatalog().filter(i=>`${i.key} ${i.label}`.toLowerCase().includes(query.toLowerCase()));
export function close(){dom.window.close();}
export async function render(source){
 const model=await api.parseMermaid(source);
 const errors=model.diagnostics.filter(d=>d.severity==='error');
 if(errors.length)throw Error(errors.map(d=>d.message).join('\n'));
 for(const n of model.nodes){
  if(!n.image)continue;
  const match=/^data:image\/(png|jpeg|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(n.image.src);
  if(!match)throw Error('External images and this image format are disabled. Use embedded PNG, JPEG or GIF base64 data URIs.');
  const bytes=Buffer.from(match[2],'base64'),size=imageSize(bytes);
  if(!['png','jpg','gif'].includes(size.type)||!size.width||!size.height||size.width*size.height>16777216)throw Error('Invalid or oversized embedded image');
  n.image={...n.image,data:n.image.src,naturalWidth:size.width,naturalHeight:size.height};
 }
 return api.renderDiagram(model);
}
// resvg 2.6 does not implement SVG2 auto-start-reverse consistently. Give each
// endpoint its actual angle, including the reversed source arrow, only for PNG.
export function pngSvg(svg,layout){
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),defs=doc.querySelector('defs');
 const paths=[...doc.querySelectorAll('.archmap-edge')];
 const edges=layout.edges.filter(e=>!e.edge.invisible);
 paths.forEach((p,i)=>{
  const points=edges[i].points;
  for(const side of ['start','end']){
   const attr='marker-'+side,ref=p.getAttribute(attr);if(!ref)continue;
   const marker=doc.getElementById(ref.slice(5,-1));if(!marker)continue;
   let a,b;
   if(side==='start'){a=points[0];b=points.find(q=>q.x!==a.x||q.y!==a.y);}
   else {b=points.at(-1);a=points.slice(0,-1).reverse().find(q=>q.x!==b.x||q.y!==b.y);}
   if(!a||!b)continue;
   const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+(side==='start'&&marker.getAttribute('orient')==='auto-start-reverse'?180:0);
   const clone=marker.cloneNode(true),id=`png-marker-${i}-${side}`;clone.setAttribute('id',id);clone.setAttribute('orient',String(angle));defs.appendChild(clone);p.setAttribute(attr,`url(#${id})`);
  }
 });
 return new XMLSerializer().serializeToString(doc);
}
export async function png(result,fontFile){
 const {Resvg}=await import('@resvg/resvg-js');
 const scale=Math.min(2,8192/Math.max(result.layout.width,result.layout.height));
 const rendered=new Resvg(pngSvg(result.svg,result.layout),{font:{loadSystemFonts:true,...(fontFile?{fontFiles:[fontFile]}:{})},fitTo:{mode:'zoom',value:scale},background:'white'}).render();
 return {data:rendered.asPng(),width:rendered.width,height:rendered.height};
}
