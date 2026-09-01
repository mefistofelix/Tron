import { mkdir, readFile, writeFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const manifest = JSON.stringify({
  name: 'GRID//∞ — Lightcycle Arena',
  short_name: 'GRID//∞',
  description: 'A 3D P2P lightcycle arena',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#05070a',
  theme_color: '#05070a',
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
});
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#05070a"/><path d="M96 344V168h232v64H176v48h240v64z" fill="#31ecff"/><path d="M334 168h82v64h-82z" fill="#ff3da8"/></svg>';
const sw = 'const C="grid-infinity-v10";self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(["/","/manifest.webmanifest","/icon.svg"]))) });self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>clients.claim())));self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const q=r.clone();caches.open(C).then(c=>c.put(e.request,q));return r}).catch(()=>caches.match(e.request))) });';

const worker = `const HTML=${JSON.stringify(html)};
const MANIFEST=${JSON.stringify(manifest)};
const ICON=${JSON.stringify(icon)};
const SW=${JSON.stringify(sw)};
export default { async fetch(request) { const url=new URL(request.url); const h={"x-content-type-options":"nosniff","referrer-policy":"no-referrer"}; if(url.pathname==="/manifest.webmanifest")return new Response(MANIFEST,{headers:{...h,"content-type":"application/manifest+json; charset=utf-8","cache-control":"public, max-age=3600"}}); if(url.pathname==="/icon.svg")return new Response(ICON,{headers:{...h,"content-type":"image/svg+xml; charset=utf-8","cache-control":"public, max-age=86400"}}); if(url.pathname==="/sw.js")return new Response(SW,{headers:{...h,"content-type":"application/javascript; charset=utf-8","cache-control":"no-cache"}}); if(url.pathname!=="/"&&url.pathname!=="/index.html")return new Response("Not found",{status:404}); return new Response(HTML,{headers:{...h,"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","permissions-policy":"camera=(), microphone=(), geolocation=()"}}); } };
`;

await mkdir(new URL('./dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/server/index.js', import.meta.url), worker);
console.log(`Worker rigenerato: ${worker.length} byte`);
