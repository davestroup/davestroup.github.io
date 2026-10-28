import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {build} from './journal.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('draft exclusion, RSS, images, escaping, cleanup and existing pages',async()=>{
 const dir=path.join(root,'posts','test-fixture');await fs.mkdir(dir);
 try{
  await sharp({create:{width:1900,height:1000,channels:3,background:'#233b36'}}).jpeg().toFile(path.join(dir,'photo.jpg'));
  const source=draft=>`---\ntitle: "Test & <entry>"\ndate: 2026-10-20\ndraft: ${draft}\n---\n\nSome **Markdown**.\n\n![A test image](photo.jpg)\n`;
  await fs.writeFile(path.join(dir,'index.md'),source(true));
  await build();await assert.rejects(fs.access(path.join(root,'_site/journal/test-fixture/index.html')));
  await build({preview:true});let html=await fs.readFile(path.join(root,'_site/journal/test-fixture/index.html'),'utf8');assert.match(html,/Draft · Local preview only/);assert.match(html,/srcset=/);assert.match(html,/<strong>Markdown<\/strong>/);assert.match(html,/Test &amp; &lt;entry&gt;/);
  assert.doesNotMatch(await fs.readFile(path.join(root,'_site/journal/feed.xml'),'utf8'),/test-fixture/);
  const image=await fs.readdir(path.join(root,'_site/journal/test-fixture'));assert.equal(image.filter(f=>f.endsWith('.webp')).length,4);
  const meta=await sharp(path.join(root,'_site/journal/test-fixture',image.find(f=>f.endsWith('1600.webp')))).metadata();assert.equal(meta.width,1600);
  await fs.writeFile(path.join(dir,'index.md'),source(false));await build();assert.match(await fs.readFile(path.join(root,'_site/journal/feed.xml'),'utf8'),/test-fixture/);
  assert.equal(await fs.readFile(path.join(root,'_site/index.html'),'utf8'),await fs.readFile(path.join(root,'index.html'),'utf8'));
  assert.equal(await fs.readFile(path.join(root,'_site/resume/index.html'),'utf8'),await fs.readFile(path.join(root,'resume/index.html'),'utf8'));
  await fs.writeFile(path.join(dir,'index.md'),source(true));await build();await assert.rejects(fs.access(path.join(root,'_site/journal/test-fixture')));
  await fs.writeFile(path.join(dir,'index.md'),source(false).replace('2026-10-20','2026-02-30'));await assert.rejects(build(),/valid YYYY-MM-DD/);
 }finally{await fs.rm(dir,{recursive:true,force:true});await build()}
});
