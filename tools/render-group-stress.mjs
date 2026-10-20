import {JSDOM} from 'jsdom';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
// Optional PNG export; SVG review works with the repository dependencies alone.
const require=createRequire(process.env.ARCHMAP_PNG_PACKAGE || import.meta.url);
let Resvg;try{({Resvg}=require('@resvg/resvg-js'));}catch{}
const dom=new JSDOM('<!doctype html><body></body>');for(const key of ['window','document','DOMParser','XMLSerializer','HTMLElement','Element','Node','SVGElement'])globalThis[key]=key==='window'?dom.window:dom.window[key];
const api=await import('../dist/archmap-mermaid.js');
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,''),out=root+'/docs/diagrams/group-grid/stress',input=root+'/test/fixtures/group-stress';await fs.mkdir(out,{recursive:true});
api.installDiagramIcons();
if(!process.env.GROUP_METRICS_REPORT)throw Error('Run GROUP_METRICS_REPORT=<existing directory> npx vitest run test/group-stress.test.ts first, then pass the same directory here.');
const rows=[];
for(const file of (await fs.readdir(input)).filter(f=>f.endsWith('.mmd')).sort()){
 const name=file.slice(0,-4),source=await fs.readFile(input+'/'+file,'utf8'),m=await api.parseMermaid(source),start=performance.now(),r=api.renderDiagram(m),ms=Math.round(performance.now()-start),baseline=JSON.parse(await fs.readFile(process.env.GROUP_METRICS_REPORT+'/'+name+'.LR.metrics.json','utf8'));
 await fs.writeFile(out+'/'+file,source);await fs.writeFile(out+'/'+name+'.svg',r.svg);if(Resvg)await fs.writeFile(out+'/'+name+'.png',new Resvg(r.svg,{font:{loadSystemFonts:true},fitTo:{mode:'width',value:1600},background:'white'}).render().asPng());
 rows.push({name,...baseline,nodes:r.layout.nodes.length,edges:r.layout.edges.length,ms,diagnostics:r.model.diagnostics});
}
await fs.writeFile(out+'/results.json',JSON.stringify(rows,null,2));
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ArchMap — Layout stress tests</title><style>body{font:16px system-ui;background:#f4f7fb;color:#24344a;margin:0}main{max-width:1400px;margin:auto;padding:24px}a{color:#146779}section{background:white;border:1px solid #dae2e8;border-radius:12px;padding:20px;margin:24px 0}img{width:100%;max-height:780px;object-fit:contain;object-position:left top}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid #d7e0e7;padding:8px}p{line-height:1.8}.scroll{overflow:auto}</style><main><h1>配置ストレステスト：20図・69ケース</h1><p>子の数、非対称な階層、縦横のセル結合、循環・グループ接続、長い文字・画像、密な依存、50〜200ノード。小規模図はLR/RL/TB/BTの4方向を検証。以下はLR版の生成結果です。</p><p>貫通：ノード・見出し・他の線ラベル。交差：線同士の直交交差（複数セグメントごとに計数）。迂回率：経路長の合計÷端点間マンハッタン距離の合計。交差ゼロを保証するものではありません。処理時間はこの端末の単回計測で、パース時間を含みません。</p><div class="scroll"><table><thead><tr><th>パターン</th><th>要素/線</th><th>貫通</th><th>交差</th><th>共有経路</th><th>曲がり</th><th>迂回率</th><th>幅×高さ</th><th>描画ms</th></tr></thead><tbody>${rows.map(r=>`<tr><td><a href="#${r.name}">${r.name}</a></td><td>${r.nodes}/${r.edges}</td><td>${r.nodeHits+r.headerHits+r.labelHits}</td><td>${r.crossings}</td><td>${r.sharedSegments}</td><td>${r.bends}</td><td>${r.detour}</td><td>${r.width}×${r.height}</td><td>${r.ms}</td></tr>`).join('')}</tbody></table></div><p>密な全対全接続には交差が残ります。200ノードの図は5列と10列を比較できます。指定列数や方向を勝手に変更して縦横比を整えることはしません。</p>${rows.map(r=>`<section id="${r.name}"><h2>${r.name}</h2><p><a href="${r.name}.mmd">Mermaid</a> · <a href="${r.name}.svg">SVGを原寸で開く</a>${Resvg?` · <a href="${r.name}.png">PNG</a>`:''}</p><a href="${r.name}.svg"><img src="${r.name}.svg" alt="${r.name}" loading="lazy"></a></section>`).join('')}</main>`;
await fs.writeFile(out+'/index.html',html);console.log(JSON.stringify(rows.map(r=>({name:r.name,ms:r.ms,diagnostics:r.diagnostics}))));dom.window.close();
