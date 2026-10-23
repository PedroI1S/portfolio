/** Fresh concept captures. Run preview.py --port 4317 first.
 * PLAYWRIGHT_MODULE / CAPTURE_BROWSER / FFMPEG may override local tools.
 * node scripts/capture_media.mjs [slug ...] [--phone|--desktop]
 * All captures run inside same-origin, unsandboxed, viewport-sized iframes.
 * Work files are never modified. Temporary JPEGs stay outside the repository.
 */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/pedro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=resolve(import.meta.dirname,'..'), out=join(root,'site/_studio/media');
await mkdir(out,{recursive:true});
const base=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:4317';
const projects=JSON.parse(await readFile(join(root,'docs/projects.json'),'utf8')).projects;
const selected=new Set(['challenger-deep','mossline','sort','house-of-vey','thimble-planet','snack-atlas']);
const args=process.argv.slice(2), slugs=args.filter(x=>!x.startsWith('--'));
const modes=args.includes('--phone')?['phone']:args.includes('--desktop')?['desktop']:['desktop','phone'];
const browser=await chromium.launch({executablePath:process.env.CAPTURE_BROWSER||'/Applications/Helium.app/Contents/MacOS/Helium',headless:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const configs={
 'brisure-capital':{pointer:true,note:'Move across the contour field to raise an elevation bump'},
 'cal-sombra':{scroll:'.hero',note:'Tilt the architectural model into its measured plan'},
 seedfile:{click:'[data-next]',note:'Reseed the plotter and watch it draw'},
 fieldbook:{section:'#specimens',click:'[data-formation="spiral"]',second:'[data-formation="grid"]',note:'Morph the specimen cloud from Ring to Spiral to Grid'},
 'side-street':{scroll:'#long-block',note:'Scrub the pinned street panorama and its odometer'},
 'nice-specific':{scroll:'.pass__runway',note:'Scrub the brochure-to-headline detail pass'},
 corkwood:{scroll:'#build',note:'Assemble the bench from its kit of parts'},
 mossline:{scroll:'#how',fraction:.92,note:'Turn the soil specimen and insert the depth probe'},
 'noct-vale':{pointer:true,note:'Move through the live incense smoke'},
 'silver-hour':{section:'.w__frame',setupClick:'.w__frame',pointer:true,second:'.lightbox__light',note:'Move the dark-room spotlight and raise the light'},
 'thimble-planet':{enter:'[data-act="enter"]',click:'.spot[data-place="lighthouse"]',range:'[data-ctl="lamp"]',note:'Fly to the lighthouse and sweep its beam across the island'},
 'challenger-deep':{scroll:'.hero',distance:1800,note:'Ripple the surface and plunge across the waterline'},
 vectorhaus:{scroll:'.wake',note:'Wake the inference ribbons through the 0.84-second sequence'},
 undersun:{scroll:'.dive__track',note:'Descend through the closed geothermal loop'},
 'kamen-lodge':{section:'.season-stage',click:'.season-stage__toggle',second:'.season-stage__toggle',note:'Switch the mountain scene between summer and winter'},
 'house-of-vey':{enter:'[data-enter]',scroll:'#house',fraction:.44,note:'Enter the house and move through its first rooms'},
 'night-train':{click:'.ticket__start',note:'Punch and tear the ticket into the travelling stamp card'},
 sort:{click:'[data-wm-sort]',second:'[data-wm-sort]',note:'Reorder the giant logo through its sorting modes'},
 'loud-hours':{section:'#services',click:'.svc__btn[aria-controls="svc-2"]',note:'Expand the Shorts treatment into its animated work canvas'},
 'throwback-pace':{section:'.capsule .card',click:'.sw[data-i="1"]',second:'.sw[data-i="0"]',note:'Switch the running capsule product colorway'},
 'hello-exe':{section:'#work',click:'[data-open="w-nimbus"]',doubleClick:true,second:'[data-n-update]',note:'Open the pixel-weather app and update its forecast'},
 'snack-atlas':{scroll:'#how',note:'Scrub the country map into a packed box and a postcard stamp'},
 sowsheet:{section:'#season-live',click:'[data-season="winter"].season-control',second:'[data-season="spring"].season-control',note:'Carry the planted bed from summer through winter and spring'},
 grevholt:{scroll:'#lives',note:'Scrub the material, assembly and repair boot story'},
 tidewright:{section:'.survey',click:'.survey__play',note:'Play the finite approach and sonar mission replay'}
};
async function click(f,s){const el=f.locator(s).first();await el.click({timeout:6000,force:true});}
async function bounds(f,s){return f.locator(s).first().evaluate(el=>({top:el.getBoundingClientRect().top+scrollY,height:el.getBoundingClientRect().height}));}
async function capture(project,mode){
 const {slug}=project,phone=mode==='phone',w=phone?390:1440,h=phone?844:900;
 const cfg=slug==='brisure-capital'&&phone?{section:'#strategies',click:'.index__head',note:'Expand the touch strategy accordion and its image plate'}:configs[slug];
 if(slug==='snack-atlas'&&phone){Object.assign(cfg,{section:'#postcard',click:'.tile-btn',second:'.tile-btn',note:'Flip the illustrated country postcard, the native phone alternative to the desktop packing scene'});delete cfg.scroll;}
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:phone,hasTouch:phone,reducedMotion:'no-preference'});
 await ctx.addInitScript(()=>{window.__captureAudio=[];const AC=window.AudioContext;if(AC)window.AudioContext=class extends AC{constructor(...a){super(...a);window.__captureAudio.push(this);}};});
 const p=await ctx.newPage(),errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
 await p.route(`${base}/__media_capture__`,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style><iframe title="${project.name} embedded preview" src="/work/${slug}/"></iframe>`}));
 let report={slug,mode,width:w,height:h,interaction:cfg.note,errors,failed};
 try{
  await p.goto(`${base}/__media_capture__`,{waitUntil:'networkidle',timeout:60000});
  const f=p.frames().find(x=>x.url().includes(`/work/${slug}/`));if(!f)throw Error('Concept frame did not load');
  await f.waitForLoadState('load');await sleep(300);await f.evaluate(()=>document.fonts.ready);await sleep(slug==='mossline'?6500:3500);
  const actualSize=await f.evaluate(()=>[innerWidth,innerHeight]);if(actualSize[0]!==w||actualSize[1]!==h)throw Error(`Incorrect embedded viewport ${actualSize}`);
  report.initial=await f.evaluate(()=>({title:document.title,overflow:document.documentElement.scrollWidth>innerWidth+2,audibleMedia:[...document.querySelectorAll('audio,video')].some(x=>!x.paused&&!x.muted&&x.volume>0),audioContexts:window.__captureAudio?.map(x=>x.state)||[],soundControls:[...document.querySelectorAll('[data-sound],[data-act="sound"],[data-toggle="sound"],.sound')].map(x=>x.getAttribute('aria-pressed'))}));
  if(cfg.enter){await click(f,cfg.enter);await sleep(2600);}
  await p.screenshot({path:join(out,`${slug}-${mode}.png`)});
  if(slug==='seedfile'&&await f.locator('[data-skip]').isVisible()){await click(f,'[data-skip]');await sleep(300);}
  let range=null;
  if(cfg.scroll){const b=await bounds(f,cfg.scroll);range={from:b.top,to:b.top+(cfg.distance||Math.max(300,b.height-h))*(cfg.fraction||1)};await f.evaluate(y=>scrollTo(0,y),range.from);await sleep(900);}
  if(cfg.section){const b=await bounds(f,cfg.section);await f.evaluate(y=>scrollTo(0,y),Math.max(0,b.top-90));await sleep(900);}
  if(cfg.setupClick){await click(f,cfg.setupClick);await sleep(900);}
  const duration=selected.has(slug)?7.2:3.8,fps=15,n=Math.round(duration*fps),temp=await mkdtemp(join(tmpdir(),'otherweather-'));
  let clicked=false,second=false;const started=Date.now();
  for(let i=0;i<n;i++){
   const t=i/(n-1);
   if(range){let v=Math.min(1,Math.max(0,(t-.08)/.82));await f.evaluate(y=>scrollTo(0,y),range.from+(range.to-range.from)*v);}
   if(cfg.pointer||slug==='challenger-deep'){await p.mouse.move(w*(.25+.5*t),h*(.48+.2*Math.sin(t*Math.PI*2)));if(phone&&i===15)await p.touchscreen.tap(w*.4,h*.55);}
   if(cfg.click&&!clicked&&t>.12){if(cfg.doubleClick&&!phone)await f.locator(cfg.click).first().dblclick({force:true});else if(cfg.doubleClick&&phone)await f.locator(cfg.click).first().tap({force:true});else await click(f,cfg.click);clicked=true;}
   if(cfg.second&&!second&&t>.62){await click(f,cfg.second);second=true;}
   if(cfg.range&&t>.45){await f.locator(cfg.range).evaluate((el,t)=>{const low=Number(el.min),high=Number(el.max);el.value=String(Math.round(low+(t-.45)/.55*(high-low)));el.dispatchEvent(new Event('input',{bubbles:true}));},t);}
   await p.screenshot({path:join(temp,`${String(i).padStart(4,'0')}.jpg`),type:'jpeg',quality:85});
   await sleep(Math.max(0,started+(i+1)*1000/fps-Date.now()));
  }
  execFileSync(process.env.FFMPEG||'/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',join(temp,'%04d.jpg'),'-an','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',join(out,`${slug}-${mode}.mp4`)]);
  await p.screenshot({path:join(temp,'end.png')});
  await mkdir(join(root,'docs/media-qa'),{recursive:true});
  await p.screenshot({path:join(root,'docs/media-qa',`${slug}-${mode}.jpg`),type:'jpeg',quality:65});
  report.final=await f.evaluate(()=>({scrollY,frameWidth:innerWidth,frameHeight:innerHeight,parentScroll:parent.scrollY,pointerCaptured:!!document.querySelector(':active'),audibleMedia:[...document.querySelectorAll('audio,video')].some(x=>!x.paused&&!x.muted&&x.volume>0),audioContexts:window.__captureAudio?.map(x=>x.state)||[]}));
  report.duration=duration;report.captureWallSeconds=(Date.now()-started)/1000;report.status='captured';
  await rm(temp,{recursive:true,force:true});
 }catch(e){report.status='failed';report.error=e.message;console.error(slug,mode,e.message);}
 await ctx.close();
 await mkdir(join(root,'docs/media-qa'),{recursive:true});await writeFile(join(root,'docs/media-qa',`${slug}-${mode}.json`),JSON.stringify(report,null,2)+'\n');
 console.log(`${slug} ${mode}: ${report.status}`);
}
for(const p of projects.filter(p=>!slugs.length||slugs.includes(p.slug)))for(const mode of modes)await capture(p,mode);
await browser.close();
execFileSync('python3',['-c',`from PIL import Image,ImageFilter\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\nfor f in p.glob('*.png'):\n im=Image.open(f).convert('RGB'); im.save(f.with_suffix('.webp'),quality=84,method=6)\n if f.stem.endswith('-desktop'): im.resize((960,600)).filter(ImageFilter.GaussianBlur(20)).save(p/(f.stem.replace('-desktop','-blur')+'.webp'),quality=65,method=6)\n f.unlink()\n`]);
