import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
const dir='test-results/browser';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:900}});
const result={};
try {
 await page.goto('http://127.0.0.1:8765/studio.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#workspace')?.getAttribute('aria-busy')==='false');
 result.mp4=await page.evaluate(async()=>{
  const { demo }=await import('./js/estudio/templates.js');
  const { recordLesson,recorderType }=await import('./js/estudio/export.js');
  const l=demo(); l.scenes=l.scenes.slice(0,1); l.scenes[0].duration=2.1;
  const codec=recorderType(false,'mp4');
  if (!codec) return {supported:false};
  const blob=await recordLesson(l,{height:720,captions:true,signal:new AbortController().signal,format:'mp4',progress:()=>{}});
  const signature=String.fromCharCode(...new Uint8Array(await blob.slice(4,8).arrayBuffer()));
  return {supported:true,size:blob.size,type:blob.type,signature};
 });
 if (result.mp4.supported) {
  assert.ok(result.mp4.size>5000, 'MP4 vazio');
  assert.equal(result.mp4.signature,'ftyp','MP4 nao tem assinatura ISO BMFF');
 }
 const [popup]=await Promise.all([
   page.waitForEvent('popup',{timeout:12000}),
   page.locator('[data-action="print"]').click()
 ]);
 await popup.waitForSelector('h1',{timeout:15000});
 await popup.waitForFunction(()=>document.querySelectorAll('article').length>=4,{timeout:15000});
 result.pdfSections=await popup.locator('article').count();
 const pdf=await popup.pdf({path:dir+'/aula-impressao.pdf',format:'A4',printBackground:true});
 result.pdfBytes=pdf.length;
 assert.ok(pdf.length>3000 && pdf.toString('ascii',0,4)==='%PDF','Impressao PDF invalida');
 await popup.close();
 console.log('MEDIA_EXPORT_OK '+JSON.stringify(result));
} catch(error){
 await page.screenshot({path:dir+'/falha-media.png',fullPage:true}).catch(()=>{});
 console.error('MEDIA_EXPORT_FAIL '+error.stack);
 process.exitCode=1;
}finally{await browser.close();}
