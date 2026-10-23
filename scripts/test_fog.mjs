/** Start preview.py first. Regression: fog pixels must not change on scroll. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/Users/pedro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CAPTURE_BROWSER || '/Applications/Helium.app/Contents/MacOS/Helium',headless:true});
try{for(const phone of [false,true]){
 const page=await browser.newPage({viewport:{width:phone?390:1440,height:phone?844:900},isMobile:phone,hasTouch:phone});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_ORIGIN || 'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await page.waitForTimeout(200);
 const canvas=page.locator('.hero .fog-canvas');
 assert.equal(await canvas.evaluate(el=>getComputedStyle(el).position),'absolute');
 if(!phone){await page.mouse.move(180,320);await page.mouse.move(1000,400,{steps:35});await page.mouse.move(1400,800);}
 await page.waitForTimeout(200);
 await page.screenshot({path:`/tmp/fog-new-${phone?'phone':'desktop'}.png`});
 const original=await canvas.evaluate(el=>el.toDataURL());
 for(const y of [120,380,650,1000,350,0]){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(80);assert.equal(await canvas.evaluate(el=>el.toDataURL()),original,'Fog pixels unchanged by scroll');}
 // Sample the actual presented surface every frame while changing viewport size.
 await page.evaluate(() => {
   window.fogBlankFrames=0;
   const sample=()=>{
     for(const canvas of document.querySelectorAll('.fog-canvas.fog-active')){
       if(canvas.getContext('2d').getImageData(0,0,1,1).data[3]===0)window.fogBlankFrames++;
     }
     window.fogSampleFrame=requestAnimationFrame(sample);
   };
   sample();
 });
 const initialSize=page.viewportSize();
 for(const offset of [1,-1,3,-2,0,80,-80,0]){
   await page.setViewportSize({width:initialSize.width+offset,height:initialSize.height+offset});
   await page.waitForTimeout(70);
 }
 assert.equal(await page.evaluate(()=>{cancelAnimationFrame(window.fogSampleFrame);return window.fogBlankFrames;}),0,'No transparent frames during resize');
 assert.equal(await canvas.evaluate(el=>el.toDataURL()),original,'Resize preserves the existing fog and wipes exactly');
 // A larger aspect-ratio change must preserve strokes and pointer alignment.
 await page.setViewportSize({width:phone?500:1100,height:phone?920:760});
 await page.waitForTimeout(100);
 assert.equal(await canvas.evaluate(el=>el.toDataURL()),original);
 const before=await canvas.evaluate(el=>el.getContext('2d').getImageData(Math.floor(el.width*.85),Math.floor(el.height*.15),1,1).data[3]);
 await page.locator('.hero').evaluate(el=>{
   const r=el.getBoundingClientRect();
   el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+r.width*.85,clientY:r.top+r.height*.15}));
 });
 await page.waitForTimeout(100);
 const after=await canvas.evaluate(el=>el.getContext('2d').getImageData(Math.floor(el.width*.85),Math.floor(el.height*.15),1,1).data[3]);
 assert.ok(after<before*.5,'Brush stays aligned after resizing');
 await page.locator('#contact').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
 assert.equal(await page.locator('#contact .fog-canvas.fog-active').count(),1);
 await page.screenshot({path:`/tmp/fog-night-${phone?'phone':'desktop'}.png`});
 assert.deepEqual(errors,[]);
 console.log(`PASS ${phone?'phone':'desktop'}: stable scroll, zero blank resize frames, preserved wipes and correctly aligned brush after resize`);
 await page.close();
}}finally{await browser.close();}
