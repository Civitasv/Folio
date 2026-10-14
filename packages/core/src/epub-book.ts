import { openEpubArchive, resolveEpubPath, type EpubArchive } from './epub-archive';
import type { EpubMetadata, EpubTocItem, EpubSpineItem } from './epub';

export interface EpubChapter { id: string; href: string; html: string }
export interface ParsedEpub { metadata: EpubMetadata; chapters: EpubChapter[] }
const decoder = new TextDecoder('utf-8', { fatal: true });
function invalid(reason: string): never { throw new Error('Invalid EPUB: ' + reason); }
function parseXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) invalid('XML entities/DOCTYPE are prohibited');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) invalid('malformed XML');
  return xml;
}
function all(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name));
}
function first(root: Document | Element, name: string): Element | undefined { return all(root, name)[0]; }
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const tags = new Set(['p','div','section','article','header','footer','blockquote','pre','code','em','strong','b','i','u','s','sup','sub','br','hr','h1','h2','h3','h4','h5','h6','ol','ul','li','dl','dt','dd','span','small','figure','figcaption','table','thead','tbody','tfoot','tr','th','td','img']);
const images = new Map([['image/png','image/png'],['image/jpeg','image/jpeg'],['image/gif','image/gif'],['image/webp','image/webp']]);
function base64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i,i+8192));
  return btoa(binary);
}
function contentNodes(body: Element, chapter: string, assets: Map<string,string>): string {
  function walk(node: Node): string {
    if (node.nodeType === 3) return escapeHtml(node.textContent ?? '');
    if (node.nodeType !== 1) return '';
    const el = node as Element, tag = el.localName.toLowerCase();
    if (!tags.has(tag)) return Array.from(el.childNodes).map(walk).join('');
    if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      let path = '';
      try { path = resolveEpubPath(chapter,src); } catch { return ''; }
      const data = assets.get(path);
      return data ? '<img alt="' + escapeHtml(el.getAttribute('alt') ?? '') + '" src="' + data + '">' : '';
    }
    const children = Array.from(el.childNodes).map(walk).join('');
    if (tag === 'br' || tag === 'hr') return '<' + tag + '>';
    return '<' + tag + '>' + children + '</' + tag + '>';
  }
  return Array.from(body.childNodes).map(walk).join('');
}
function navItems(list: Element, navPath: string, spine: EpubSpineItem[]): EpubTocItem[] {
  return Array.from(list.children).filter(el=>el.localName === 'li').map(li => {
    const link = first(li,'a'), span = first(li,'span');
    const label = (link?.textContent ?? span?.textContent ?? '').trim() || 'Untitled';
    const href = link?.getAttribute('href') ?? '';
    let path = '';
    try { if (href) path = resolveEpubPath(navPath,href); } catch { /* skip unusable link */ }
    const nested = Array.from(li.children).find(el=>el.localName==='ol' || el.localName==='ul');
    return { label, href: spine.find(x=>x.href===path)?.href ?? '', children: nested ? navItems(nested,navPath,spine) : [] };
  });
}
function ncxItems(node: Element, navPath: string, spine: EpubSpineItem[]): EpubTocItem[] {
  return Array.from(node.children).filter(el=>el.localName === 'navPoint').map(el => {
    const label = first(el,'text')?.textContent?.trim() || 'Untitled';
    const href = first(el,'content')?.getAttribute('src') ?? '';
    let path = '';
    try { if(href) path=resolveEpubPath(navPath,href); } catch { /* skip external link */ }
    return {label,href:spine.find(x=>x.href===path)?.href ?? '',children:ncxItems(el,navPath,spine)};
  });
}
/** Parse a supported reflowable, unencrypted EPUB without running publication scripts or styles. */
export async function parseEpub(bytes: Uint8Array): Promise<ParsedEpub> {
  const zip: EpubArchive = openEpubArchive(bytes);
  if (zip.paths().includes('META-INF/encryption.xml')) invalid('encrypted/obfuscated publications unsupported');
  const container = parseXml(await zip.text('META-INF/container.xml'));
  const opfPath = first(container,'rootfile')?.getAttribute('full-path');
  if (!opfPath) invalid('missing package rootfile');
  const packagePath = resolveEpubPath('container.xml',opfPath);
  const packageDoc = parseXml(await zip.text(packagePath));
  if (packageDoc.documentElement.localName !== 'package') invalid('missing OPF package');
  const manifest = new Map<string,{href:string;media:string;properties:string}>();
  for (const item of all(packageDoc,'item')) {
    const id = item.getAttribute('id'), href = item.getAttribute('href');
    if (!id || !href || manifest.has(id)) invalid('invalid OPF manifest');
    manifest.set(id,{href:resolveEpubPath(packagePath,href),media:item.getAttribute('media-type')??'',properties:item.getAttribute('properties')??''});
  }
  const spineNode = first(packageDoc,'spine');
  if (!spineNode) invalid('missing OPF spine');
  const spine = all(spineNode,'itemref').filter(item=>item.getAttribute('linear')!=='no').map(item=>{
    const id = item.getAttribute('idref') ?? '';
    const resource = manifest.get(id);
    if (!resource || resource.media !== 'application/xhtml+xml') invalid('unsupported spine resource');
    return {id,href:resource.href};
  });
  if (!spine.length) invalid('empty reading spine');
  const metadataNode = first(packageDoc,'metadata');
  const metadata: EpubMetadata = {
    title: metadataNode ? first(metadataNode,'title')?.textContent?.trim() || undefined : undefined,
    creators: metadataNode ? all(metadataNode,'creator').map(x=>x.textContent?.trim()??'').filter(Boolean) : [],
    language: metadataNode ? first(metadataNode,'language')?.textContent?.trim() || undefined : undefined,
    spine, toc:[]
  };
  const nav = [...manifest.values()].find(x=>x.properties.split(/\s+/).includes('nav'));
  if (nav) {
    const doc = parseXml(await zip.text(nav.href));
    const navNode = all(doc,'nav').find(node => (node.getAttribute('epub:type')??node.getAttribute('type')??'').split(/\s+/).includes('toc'));
    const list = navNode && (first(navNode,'ol') ?? first(navNode,'ul'));
    if (list) metadata.toc=navItems(list,nav.href,spine);
  } else {
    const ncx = manifest.get(spineNode.getAttribute('toc')??'');
    if (ncx && ncx.media==='application/x-dtbncx+xml') {
      const doc = parseXml(await zip.text(ncx.href));
      const navMap=first(doc,'navMap');
      if(navMap) metadata.toc=ncxItems(navMap,ncx.href,spine);
    }
  }
  const chapters: EpubChapter[] = [];
  for (const part of spine) {
    const doc = parseXml(await zip.text(part.href));
    const body = first(doc,'body');
    if (!body) invalid('chapter has no XHTML body');
    const assets = new Map<string,string>();
    for (const image of all(body,'img')) {
      const src=image.getAttribute('src');
      if (!src) continue;
      let path='';
      try { path=resolveEpubPath(part.href,src); } catch { continue; }
      const entry=[...manifest.values()].find(x=>x.href===path);
      const type=entry && images.get(entry.media);
      if (type && !assets.has(path)) assets.set(path,'data:'+type+';base64,'+base64(await zip.get(path)));
    }
    chapters.push({id:part.id,href:part.href,html:contentNodes(body,part.href,assets)});
  }
  return {metadata,chapters};
}
/** A publisher-independent, chapter-granularity durable EPUB CFI-like location. */
export function chapterCfi(index: number): string { return 'epubcfi(/6/' + (index+1)*2 + ')'; }
