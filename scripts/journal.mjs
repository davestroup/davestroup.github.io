import { promises as fs, watch } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
// Release image file handles between rebuilds, including on Windows.
sharp.cache(false);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'_site');
const origin='https://davestroup.com';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=new MarkdownIt({html:false,linkify:true,typographer:true});
const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data)};
const dateLabel=d=>new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
function shell(title,body,{preview=false,url='/journal/'}={}){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Dave Stroup</title>${preview?'<meta name="robots" content="noindex">':''}<link rel="canonical" href="${origin}${url}"><link rel="alternate" type="application/rss+xml" title="Dave Stroup · Journal" href="/journal/feed.xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&amp;family=Source+Sans+3:wght@400;500;600&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="/journal/style.css"></head><body><a class="skip" href="#main">Skip to content</a><div class="wrap"><header class="top"><a class="brand" href="/">Dave Stroup</a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/journal/" aria-current="${url==='/journal/'?'page':'true'}">Journal</a><a href="/resume/">Résumé</a></nav></header>${body}<footer><span>Dave Stroup</span><a href="/journal/feed.xml">RSS</a></footer></div>${preview?`<script>let version;setInterval(async()=>{try{const next=await(await fetch('/__version')).text();if(version&&version!==next)location.reload();version=next}catch{}},1000)</script>`:''}</body></html>`}

export async function build({preview=false}={}){
  // Always rebuild from source: removed entries and unpublished drafts cannot linger.
  await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
  for(const name of ['index.html','home.css','CNAME','resume'])await fs.cp(path.join(root,name),path.join(output,name),{recursive:true});
  await fs.cp(path.join(root,'journal/style.css'),path.join(output,'journal/style.css'),{recursive:true});
  await write(path.join(output,'.nojekyll'),'');
  const posts=[];
  const entries=await fs.readdir(path.join(root,'posts'),{withFileTypes:true});
  for(const entry of entries){
    if(!entry.isDirectory())continue;
    const slug=entry.name;if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error(`Invalid entry folder: ${slug}`);
    const dir=path.join(root,'posts',slug),file=path.join(dir,'index.md');
    const raw=await fs.readFile(file,'utf8');const {data,content}=matter(raw);
    if(typeof data.title!=='string'||!data.title.trim())throw Error(`${slug}: title is required`);
    if(data.draft!==true&&data.draft!==false)throw Error(`${slug}: draft must be true or false`);
    const date=raw.split(/^---\s*$/m)[1]?.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*(?:#.*)?$/m)?.[1]||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error(`${slug}: use a valid YYYY-MM-DD date`);
    if(data.draft&&!preview)continue;
    const url=`/journal/${slug}/`,dest=path.join(output,'journal',slug);
    const tokens=md.parse(content,{});
    for(const token of tokens){for(const child of token.children||[]){
      if(child.type!=='image')continue;
      const src=child.attrGet('src');
      if(/^(https?:|data:)/i.test(src))continue;
      const source=path.resolve(dir,decodeURIComponent(src));
      if(!source.startsWith(dir+path.sep))throw Error(`${slug}: images must be inside the entry folder`);
      if(!child.content.trim())throw Error(`${slug}: give ${src} descriptive alt text`);
      const image=sharp(source).rotate();const meta=await image.metadata();
      const width=meta.autoOrient?.width||meta.width;
      const widths=[480,800,1200,1600].filter(w=>w<width);widths.push(Math.min(width,1600));
      const sources=[];
      for(const w of widths){const name=`${path.parse(src).name.replace(/[^a-z0-9-]/gi,'-')}-${createHash('sha256').update(src).digest('hex').slice(0,8)}-${w}.webp`;await fs.mkdir(dest,{recursive:true});const info=await image.clone().resize({width:w,withoutEnlargement:true}).webp({quality:82}).toFile(path.join(dest,name));sources.push({url:url+name,width:info.width,height:info.height})}
      const last=sources.at(-1);child.attrSet('src',last.url);child.attrSet('srcset',sources.map(s=>`${s.url} ${s.width}w`).join(', '));child.attrSet('sizes','(max-width: 650px) calc(100vw - 46px), 944px');child.attrSet('width',String(last.width));child.attrSet('height',String(last.height));child.attrSet('loading','lazy');child.attrSet('decoding','async');
    }}
    const html=md.renderer.render(tokens,md.options,{});
    const excerpt=typeof data.summary==='string'&&data.summary.trim()?data.summary:content.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/[#*_`>\[\]]/g,'').trim().split(/\n\s*\n/)[0].replace(/\n/g,' ').slice(0,240);
    const image=html.match(/<img\s[^>]*>/)?.[0]||'';
    const post={slug,title:data.title,date,draft:data.draft,html,excerpt,url,image};posts.push(post);
    await write(path.join(dest,'index.html'),shell(post.title,`<main id="main"><header class="article-head"><a class="back" href="/journal/">← Journal</a><h1>${esc(post.title)}</h1><time datetime="${date}">${dateLabel(date)}</time>${post.draft?'<br><span class="sample">Draft · Local preview only</span>':''}</header><article class="prose">${html}<div class="endnote"><a class="back" href="/journal/">← All entries</a></div></article></main>`,{preview,url}));
  }
  posts.sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug));
  await write(path.join(output,'journal/index.html'),shell('Journal',`<main id="main"><section class="intro"><div class="label">Notes &amp; photographs</div><h1>Journal</h1><p>A place for things noticed along the way.</p>${preview?'<span class="sample">Local preview · Drafts included</span>':''}</section><div class="stream">${posts.length?posts.map(p=>`<article class="entry"><time datetime="${p.date}">${dateLabel(p.date)}</time>${p.draft?' <span class="label">· Draft</span>':''}<h2><a href="${p.url}">${esc(p.title)}</a></h2>${p.image?`<figure><a href="${p.url}" aria-label="View ${esc(p.title)}">${p.image}</a></figure>`:""}<p class="excerpt">${esc(p.excerpt)}</p><a class="read" href="${p.url}">Read entry ↗</a></article>`).join(''):'<article class="entry"><p>Entries will appear here.</p></article>'}</div></main>`,{preview}));
  const publicPosts=posts.filter(p=>!p.draft);
  await write(path.join(output,'journal/feed.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Dave Stroup · Journal</title><link>${origin}/journal/</link><description>Notes and photographs from Dave Stroup.</description><language>en-us</language>${publicPosts.map(p=>`<item><title>${esc(p.title)}</title><link>${origin}${p.url}</link><guid>${origin}${p.url}</guid><pubDate>${new Date(p.date+'T12:00:00Z').toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('')}</channel></rss>`);
  return posts;
}

async function main(){
  const command=process.argv[2]||'build';
  if(command==='new'){
    const title=process.argv.slice(3).join(' ').trim();if(!title)throw Error('Use: npm run new -- "Entry title"');
    const slug=title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!slug)throw Error('Use a title containing letters or numbers');
    const dir=path.join(root,'posts',slug);await fs.mkdir(dir);const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    await write(path.join(dir,'index.md'),`---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\ndraft: true\nsummary: ""\n---\n\nWrite your entry here.\n`);console.log(`Created posts/${slug}/index.md (draft)`);return;
  }
  if(!['build','preview'].includes(command))throw Error('Choose build, preview, or new');
  let version=Date.now(),error=null;
  await build({preview:command==='preview'});console.log('Built _site');
  if(command==='build')return;
  let timer,running=false,pending=false;
  async function rebuild(){if(running){pending=true;return}running=true;try{await build({preview:true});version=Date.now();error=null;console.log('Updated preview')}catch(e){error=e.message;console.error(e.message)}finally{running=false;if(pending){pending=false;rebuild()}}}
  for(const folder of ['posts','journal','resume'])watch(path.join(root,folder),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(rebuild,200)});
  watch(path.join(root,'index.html'),()=>{clearTimeout(timer);timer=setTimeout(rebuild,200)});
  http.createServer(async(req,res)=>{
    if(req.url==='/__version'){res.writeHead(error?500:200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end(error||String(version));return}
    if(running){res.writeHead(503,{'Retry-After':'1'});res.end('Rebuilding; refresh in a moment.');return}
    try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(output,'.'+pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(output+path.sep))throw Error('Invalid path');const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.webp':'image/webp','.xml':'application/rss+xml; charset=utf-8','.js':'application/javascript'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}
  }).listen(4188,'127.0.0.1',()=>console.log('Journal preview: http://127.0.0.1:4188/journal/'));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
