import { preflightEpub } from './epub';

const utf8 = new TextDecoder('utf-8', { fatal: true });
const MAX_ENTRIES = 2000;
const MAX_ENTRY = 32 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;
const MAX_RATIO = 200;

function fail(why: string): never { throw new Error('Invalid EPUB: ' + why); }
function u16(v: DataView, offset: number): number { return v.getUint16(offset, true); }
function u32(v: DataView, offset: number): number { return v.getUint32(offset, true); }
function crc32(data: Uint8Array): number {
  let crc = -1;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ -1) >>> 0;
}
export function safeArchivePath(name: string): string {
  if (!name || name.includes('\\') || name.includes('\0') || name.startsWith('/') ||
      name.includes('?') || name.includes('#') || /^[a-z][a-z\d+.-]*:/i.test(name)) fail('unsafe archive path');
  const parts = name.split('/');
  if (parts.some(part => part === '..' || part === '.' || !part)) fail('unsafe archive path');
  return name;
}
/** Resolve an EPUB-relative reference without permitting traversal above the archive root. */
export function resolveEpubPath(base: string, href: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(href.split('#')[0].split('?')[0]); }
  catch { return fail('invalid resource reference'); }
  if (!decoded || decoded.startsWith('/') || decoded.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(decoded)) fail('external resource reference');
  const stack = base.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (part === '.' || !part) continue;
    if (part === '..') { if (!stack.length) fail('resource escapes archive'); stack.pop(); }
    else stack.push(part);
  }
  return safeArchivePath(stack.join('/'));
}
interface Entry { path: string; method: number; compressed: number; size: number; crc: number; offset: number; flags: number }
export interface EpubArchive {
  paths(): string[];
  get(path: string): Promise<Uint8Array>;
  text(path: string): Promise<string>;
}
export function openEpubArchive(bytes: Uint8Array): EpubArchive {
  const preflight = preflightEpub(bytes);
  if (!preflight.ok) fail(preflight.error);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // EOCD may have a maximum 65535-byte comment; ZIP64 and multi-disk are not supported by this preview.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(v, i) === 0x06054b50 && i + 22 + u16(v, i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0 || u16(v, end + 4) !== 0 || u16(v, end + 6) !== 0 ||
      u16(v, end + 8) !== u16(v, end + 10)) fail('missing or multi-disk central directory');
  const count = u16(v, end + 10);
  const centralLength = u32(v, end + 12);
  const centralAt = u32(v, end + 16);
  if (count < 2 || count > MAX_ENTRIES || centralLength === 0 || centralAt + centralLength > end) fail('invalid central directory limits');
  let offset = centralAt;
  let total = 0;
  const entries = new Map<string, Entry>();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > centralAt + centralLength || u32(v, offset) !== 0x02014b50) fail('invalid central header');
    const flags = u16(v, offset + 8);
    const method = u16(v, offset + 10);
    const crc = u32(v, offset + 16);
    const compressed = u32(v, offset + 20);
    const size = u32(v, offset + 24);
    const nameLength = u16(v, offset + 28), extra = u16(v, offset + 30), comment = u16(v, offset + 32);
    const localAt = u32(v, offset + 42);
    const next = offset + 46 + nameLength + extra + comment;
    if (next > centralAt + centralLength || flags & 1 || flags & 0x40 || (method !== 0 && method !== 8) ||
        size > MAX_ENTRY || (compressed === 0 && size !== 0) ||
        (compressed > 0 && size / compressed > MAX_RATIO)) fail('unsafe archive entry');
    const rawPath = utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const directory = rawPath.endsWith('/');
    const path = safeArchivePath(directory ? rawPath.slice(0,-1) : rawPath);
    if (entries.has(path)) fail('duplicate archive path');
    if (directory && (compressed !== 0 || size !== 0)) fail('nonempty archive directory');
    if (localAt + 30 > centralAt || u32(v, localAt) !== 0x04034b50 ||
        u16(v, localAt + 6) !== flags || u16(v, localAt + 8) !== method) fail('local header mismatch');
    const localNameLength = u16(v, localAt + 26), localExtra = u16(v, localAt + 28);
    const dataAt = localAt + 30 + localNameLength + localExtra;
    if (dataAt + compressed > centralAt ||
        !matches(bytes.subarray(localAt + 30, localAt + 30 + localNameLength), bytes.subarray(offset + 46, offset + 46 + nameLength))) fail('local data mismatch');
    if (!(flags & 8) && (u32(v, localAt + 14) !== crc || u32(v, localAt + 18) !== compressed || u32(v, localAt + 22) !== size)) fail('local size or CRC mismatch');
    total += size;
    if (total > MAX_TOTAL) fail('archive output limit');
    if (!directory) entries.set(path, { path, method, compressed, size, crc, offset: dataAt, flags });
    offset = next;
  }
  if (offset !== centralAt + centralLength || !entries.has('mimetype') || !entries.has('META-INF/container.xml') ||
      [...entries.keys()][0] !== 'mimetype') fail('missing EPUB structure');
  async function get(path: string): Promise<Uint8Array> {
    const entry = entries.get(path);
    if (!entry) fail('missing resource: ' + path);
    const compressed = bytes.subarray(entry.offset, entry.offset + entry.compressed);
    let output: Uint8Array;
    if (entry.method === 0) output = new Uint8Array(compressed);
    else {
      if (typeof DecompressionStream === 'undefined') fail('deflate-raw unavailable in this browser');
      const stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = stream.getReader(), chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          length += result.value.length;
          if (length > entry.size || length > MAX_ENTRY) { await reader.cancel(); fail('expanded entry exceeds declared size'); }
          chunks.push(result.value);
        }
      } catch { fail('invalid compressed resource'); }
      output = new Uint8Array(length);
      let cursor = 0;
      for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
    }
    if (output.length !== entry.size || crc32(output) !== entry.crc) fail('entry integrity mismatch');
    return output;
  }
  return { paths: () => [...entries.keys()], get, text: async path => utf8.decode(await get(path)) };
}
function matches(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
