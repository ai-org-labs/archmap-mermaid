/** SVG exports can be opened outside the playground: keep navigation URLs inert unless safe. */
export function safeLink(value: unknown): string | undefined {
  if(typeof value!=='string'||!value.trim())return undefined;
  const href=value.trim();
  try {const url=new URL(href,'https://archmap.invalid/');return ['http:','https:','mailto:'].includes(url.protocol)?href:undefined;}catch{return undefined;}
}
