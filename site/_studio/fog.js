/** Section-local condensation. Scrolling never redraws or relocates a surface.
 * The persistent, normalized wipe mask changes only on pointer input.
 * CSS scales the surface and its masks together; resizing never clears pixels.
 */
export function initFog({ regions = document.querySelectorAll('[data-fog-region]') } = {}) {
  const noop = { available: false, refresh() {}, destroy() {}, setClear() {}, setFront() {}, setLens() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return noop;
  const removers = [], states = [];
  let frame = 0, disposed = false;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    removers.push(() => target.removeEventListener(type, fn, options));
  };
  const maskImage = (element, value) => {
    if (!element) return;
    element.style.maskImage = value;
    element.style.webkitMaskImage = value;
    element.style.maskSize = '100% 100%';
    element.style.maskRepeat = 'no-repeat';
  };
  function texture(state) {
    const { base, width:w, height:h, night } = state;
    const ctx = base.getContext('2d');
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = night ? '#14202bea' : '#dbe3e7ef';
    ctx.fillRect(0,0,w,h);
    // Broad, fixed variations in moisture; no time-dependent grain or beads.
    for (const [x,y,r,alpha] of [[.12,.1,.8,.32],[.8,.32,.65,.2],[.35,.9,.7,.24]]) {
      const radius = Math.max(w,h)*r;
      const glow = ctx.createRadialGradient(w*x,h*y,0,w*x,h*y,radius);
      glow.addColorStop(0, night ? `rgba(72,88,108,${alpha})` : `rgba(255,255,255,${alpha})`);
      glow.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    }
  }
  function paint(state) {
    const { ctx, canvas, base, twin, blur } = state;
    const wipe=state.feather, soft=wipe.getContext('2d');
    soft.clearRect(0,0,wipe.width,wipe.height);
    soft.filter=`blur(${16*state.ratio}px)`;
    soft.drawImage(state.wipe,0,0);soft.filter='none';
    ctx.globalCompositeOperation='copy';ctx.drawImage(base,0,0);
    ctx.globalCompositeOperation='destination-out';ctx.drawImage(wipe,0,0);
    ctx.globalCompositeOperation='source-over';
    if (!state.marked) return;
    // The DOM blur and alternate text use the very same section-local mask.
    const url=`url("${wipe.toDataURL()}")`;
    maskImage(twin,url);
    const inverse=state.inverse, inv=inverse.getContext('2d');
    inv.globalCompositeOperation='source-over';inv.fillStyle='#fff';
    inv.fillRect(0,0,canvas.width,canvas.height);
    inv.globalCompositeOperation='destination-out';inv.drawImage(wipe,0,0);
    maskImage(blur,`url("${inverse.toDataURL()}")`);
  }
  function flush() {
    frame=0;
    for (const state of states) if(state.dirty){state.dirty=false;paint(state);}
  }
  function wake() { if(!disposed && !frame) frame=requestAnimationFrame(flush); }
  function initialize(state) {
    const w=state.element.clientWidth,h=state.element.clientHeight;
    const ratio=Math.min(devicePixelRatio||1,coarse?1:1.5,1800/Math.max(w,h));
    const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
    state.width=width;state.height=height;state.ratio=ratio;
    for(const canvas of [state.canvas,state.base,state.wipe,state.inverse,state.feather]){canvas.width=width;canvas.height=height;}
    // Paint synchronously before exposing the enhanced surface.
    texture(state);paint(state);state.dirty=false;
  }
  function stamp(state,x,y,scaleX,scaleY) {
    const ctx=state.wipe.getContext('2d'),r=coarse?48:68;
    // Keep the brush circular in CSS pixels after any aspect-ratio change.
    ctx.save();ctx.scale(scaleX,scaleY);
    const gradient=ctx.createRadialGradient(x,y,r*.4,x,y,r);
    gradient.addColorStop(0,'#fff');gradient.addColorStop(.6,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  for(const element of regions){
    const canvas=element.querySelector('.fog-canvas');
    if(!canvas)continue;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    const state={element,canvas,ctx,base:document.createElement('canvas'),wipe:document.createElement('canvas'),inverse:document.createElement('canvas'),feather:document.createElement('canvas'),
      twin:element.querySelector('[data-fog-twin]'),blur:element.querySelector('[data-fog-blur]'),night:element.dataset.fogTone==='night',
      width:0,height:0,ratio:1,dirty:true,marked:false,previous:null,touch:null};
    states.push(state);maskImage(state.twin,'linear-gradient(transparent,transparent)');
    initialize(state);canvas.classList.add('fog-active');element.classList.add('fog-ready');
    const end=()=>{state.previous=null;state.touch=null;};
    listen(element,'pointerdown',event=>{
      if(event.pointerType==='touch')state.touch={id:event.pointerId,x:event.clientX,y:event.clientY,mode:null};
    },{passive:true});
    listen(element,'pointermove',event=>{
      if(event.target.closest('a,button')){state.previous=null;return;}
      if(event.pointerType==='touch'){
        if(!state.touch||state.touch.id!==event.pointerId)return;
        const dx=Math.abs(event.clientX-state.touch.x),dy=Math.abs(event.clientY-state.touch.y);
        if(!state.touch.mode&&Math.max(dx,dy)>8)state.touch.mode=dx>dy*1.2?'wipe':'scroll';
        if(state.touch.mode!=='wipe')return;
      }
      const rect=element.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const scaleX=state.width/rect.width,scaleY=state.height/rect.height;
      const previous=state.previous;
      const distance=previous?Math.hypot(x-previous.x,y-previous.y):0;
      const count=Math.max(1,Math.ceil(distance/8));
      for(let i=1;i<=count;i++)stamp(state,previous?previous.x+(x-previous.x)*i/count:x,previous?previous.y+(y-previous.y)*i/count:y,scaleX,scaleY);
      state.previous={x,y};state.marked=true;state.dirty=true;wake();
    },{passive:true});
    for(const type of ['pointerleave','pointerup','pointercancel'])listen(element,type,end,{passive:true});
  }
  // Reset stroke continuity on scroll, but leave every rendered pixel alone.
  listen(window,'scroll',()=>states.forEach(state=>{state.previous=null;}),{passive:true});
  // A resize only resets stroke continuity. No bitmap or CSS mask replacement.
  const refresh=()=>states.forEach(state=>{state.previous=null;state.touch=null;});
  listen(window,'resize',refresh,{passive:true});
  function destroy(){
    disposed=true;cancelAnimationFrame(frame);removers.forEach(remove=>remove());
    states.forEach(state=>{state.canvas.classList.remove('fog-active');state.element.classList.remove('fog-ready');maskImage(state.blur,'');maskImage(state.twin,'linear-gradient(transparent,transparent)');});
  }
  return {...noop,available:states.length>0,refresh,destroy};
}
