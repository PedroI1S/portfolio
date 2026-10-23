/** Browser journeys for the portfolio. Start preview.py first.
 * Optional: PLAYWRIGHT_MODULE, CAPTURE_BROWSER and TEST_ORIGIN.
 * Screenshots and JSON reports go to /tmp, never public deployment output.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/pedro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=resolve(import.meta.dirname,'..');
const projects=JSON.parse(await readFile(resolve(root,'docs/projects.json'),'utf8')).projects;
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:process.env.CAPTURE_BROWSER||'/Applications/Helium.app/Contents/MacOS/Helium',headless:true});
const results=[];
const check=async(name,task)=>{await task();results.push(name);console.log('PASS '+name);};
try{
 for(const phone of [false,true]){
  const context=await browser.newContext({viewport:{width:phone?390:1440,height:phone?844:900},isMobile:phone,hasTouch:phone});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await check(`${phone?'Phone':'Desktop'} index filters, phone toggle and Back`,async()=>{
   await page.goto(base+'/work/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.work-row:visible').count(),25);
   await page.locator('[data-filter="interaction"]').click();
   assert.match(page.url(),/filter=interaction/);
   assert.equal(await page.locator('.work-row:visible').count(),projects.filter(p=>p.tags.includes('interaction')).length);
   await page.locator('.phone-toggle').click();
   assert.match(page.url(),/view=phone/);
   await page.goBack();
   assert.equal(await page.locator('.phone-toggle').getAttribute('aria-pressed'),'false');
   assert.equal(await page.locator('[data-filter="interaction"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('iframe').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  });
  await check(`${phone?'Phone':'Desktop'} homepage navigation and static content`,async()=>{
   await page.goto(base+'/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.forecast').count(),6);
   assert.equal(await page.locator('.strip-card').count(),25);
   await page.locator('.nav-contact').click();
   await page.waitForTimeout(1300);
   assert.equal(await page.locator('#contact .button').getAttribute('href'),'mailto:pedromariano.s@outlook.com');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const box=await page.locator('#contact h2').boundingBox();
   assert.ok(box.y<844,'Contact anchor reaches its heading');
  });
  for(const project of projects){
   await check(`${phone?'Phone':'Desktop'} story / ${project.slug}`,async()=>{
    await page.goto(base+`/projects/${project.slug}/`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('iframe').count(),0,'Never load a live concept before Play');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.decision').count(),project.decisions.length);
    if(!project.embedEnabled){assert.equal(await page.locator('.play-concept').count(),0);return;}
    await page.locator('.play-concept').click();
    await page.locator('iframe').waitFor();
    const frame=await (await page.locator('iframe').elementHandle()).contentFrame();
    assert.ok(frame,'Concept loads at its unchanged route');
    await frame.waitForURL(`**/work/${project.slug}/`);
    await frame.waitForLoadState('load');
    assert.equal(await frame.evaluate(()=>innerWidth),390,'Default embed is the real phone viewport');
    await page.locator('.stop-concept').click();
    assert.equal(await page.locator('iframe').count(),0,'Stop unloads the concept');
    await page.locator('[data-device="desktop"]').click();
    await page.locator('.play-concept').click();
    const desktopFrame=await (await page.locator('iframe').elementHandle()).contentFrame();
    await desktopFrame.waitForURL(`**/work/${project.slug}/`);
    await desktopFrame.waitForLoadState('load');
    assert.equal(await desktopFrame.evaluate(()=>innerWidth),1440,'Desktop toggle has its own viewport');
    await page.locator('.next-project').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('iframe').count(),0,'Offscreen concept unloads');
   });
  }
  assert.deepEqual(errors,[],'No browser runtime exceptions');
  await context.close();
 }
 for(const mode of ['reduced','no-js','no-webgl']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:mode==='reduced'?'reduce':'no-preference',javaScriptEnabled:mode!=='no-js'});
  if(mode==='no-webgl')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
  const page=await context.newPage();
  await check(`${mode} readable homepage and navigation`,async()=>{
   await page.goto(base+'/',{waitUntil:'networkidle'});
   assert.equal((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim(),'A different atmosphere for the web.');
   assert.equal(await page.locator('.forecast-links a.button').count(),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(mode==='reduced'){
    assert.equal(await page.locator('.pin-spacer').count(),0);
    assert.equal(await page.locator('canvas.fog-active').count(),0);
    assert.equal(await page.locator('video[src], video source[src]').count(),0);
   }
   await page.screenshot({path:`/tmp/portfolio-${mode}.png`});
  });
  await context.close();
 }
 await writeFile('/tmp/portfolio-browser-results.json',JSON.stringify({passed:results.length,results},null,2)+'\n');
 console.log(`OK: ${results.length} browser journeys.`);
}finally{await browser.close();}
