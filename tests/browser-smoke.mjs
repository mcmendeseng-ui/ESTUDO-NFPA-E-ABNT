import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'test-results/browser';
fs.mkdirSync(dir, { recursive: true });
const failures = [];
const metrics = {};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.on('pageerror', error => failures.push('Javascript: ' + error.message));
try {
  await page.goto('http://127.0.0.1:8765/studio.html', { waitUntil:'networkidle', timeout:30000 });
  await page.waitForFunction(() => document.querySelector('#workspace')?.getAttribute('aria-busy') === 'false', { timeout:20000 });
  metrics.title = await page.title();
  metrics.aulas = await page.locator('#lesson-select option').count();
  metrics.cenas = await page.locator('#scenes .scene-card').count();
  metrics.canvas = await page.locator('#stage').count();
  assert.ok(metrics.aulas > 0 && metrics.cenas > 0 && metrics.canvas === 1, 'Editor carregou sem biblioteca/canvas');
  await page.screenshot({ path: path.join(dir,'estudio-desktop.png'), fullPage:true });
  await page.locator('[data-action="tab"][data-value="assets"]').click();
  metrics.recursos = await page.locator('#assets [data-action="asset"]').count();
  assert.ok(metrics.recursos >= 6, 'Biblioteca sem recursos');
  await page.locator('#assets [data-action="asset"][data-value="breaker"]').click();
  await page.locator('[data-action="undo"]').click();
  await page.locator('[data-action="redo"]').click();

  async function download(action, filename) {
    const [result] = await Promise.all([
      page.waitForEvent('download', { timeout:15000 }),
      page.locator('[data-action="' + action + '"]').first().click()
    ]);
    await result.saveAs(path.join(dir,filename));
    const size = fs.statSync(path.join(dir,filename)).size;
    assert.ok(size > 50, filename + ' vazio');
    return size;
  }
  metrics.htmlBytes = await download('html','aula.html');
  await page.locator('details.export-more summary').click();
  metrics.jsonBytes = await download('json','projeto.json');
  await page.locator('details.export-more summary').click();
  metrics.srtBytes = await download('srt','legendas.srt');
  await page.locator('details.export-more summary').click();
  metrics.pngBytes = await download('png','cena.png');
  const html = fs.readFileSync(path.join(dir,'aula.html'),'utf8');
  assert.ok(html.includes('function createEngine()') && html.includes('<canvas'), 'HTML sem renderer');
  const json = JSON.parse(fs.readFileSync(path.join(dir,'projeto.json'),'utf8'));
  assert.ok(json.lessons?.length > 0, 'Exportacao JSON sem aulas');
  metrics.browserMP4Support = await page.evaluate(() =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4'));
  metrics.browserWEBMSupport = await page.evaluate(() =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm'));
  const mobile = await browser.newPage({ viewport: { width:390,height:844}, isMobile:true, hasTouch:true });
  mobile.on('pageerror', error => failures.push('Mobile: ' + error.message));
  await mobile.goto('http://127.0.0.1:8765/studio.html', { waitUntil:'networkidle',timeout:30000 });
  await mobile.waitForFunction(() => document.querySelector('#workspace')?.getAttribute('aria-busy') === 'false',{timeout:20000});
  await mobile.screenshot({path:path.join(dir,'estudio-mobile.png'),fullPage:true});
  metrics.mobileOK = true;
  await mobile.close();
  assert.equal(failures.length,0,'Erros de Javascript: '+failures.join(' | '));
  console.log('BROWSER_SMOKE_OK '+JSON.stringify(metrics));
} catch (error) {
  await page.screenshot({path:path.join(dir,'falha.png'),fullPage:true}).catch(()=>{});
  console.error('BROWSER_SMOKE_FAIL '+error.stack);
  console.error('DETAILS '+JSON.stringify({metrics,failures}));
  process.exitCode = 1;
} finally { await browser.close(); }
