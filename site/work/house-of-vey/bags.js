/* One recoloured cut-out supplies the panel, collection and WebGL billboard. */
(() => {
  const rooms = [...document.querySelectorAll('.room')];
  const cache = new Map();
  const selected = rooms.map(() => 0);
  const sources = rooms.map((room) => {
    const image = new Image(); image.src = room.querySelector('[data-bag]').getAttribute('src');
    return image;
  });
  async function get(r, k) {
    const key = `${r}:${k}`;
    if (cache.has(key)) return cache.get(key);
    const task = (async () => {
      const image = sources[r]; await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(image, 0, 0, 1024, 1024);
      const colour = rooms[r].querySelectorAll('.swatches li')[k].style.getPropertyValue('--c').trim();
      if (k !== 0) {
        const pixels = g.getImageData(0, 0, 1024, 1024), p = pixels.data;
        const target = colour.slice(1).match(/../g).map((v) => parseInt(v, 16));
        const luminance = (red, green, blue) => .2126 * red + .7152 * green + .0722 * blue;
        // brass and gold: saturated, red-dominant, yellow-orange hue; bags without metal skip the test
        const metal = rooms[r].dataset.metal !== 'none';
        const gold = (red, green, blue) => {
          if (!metal) return false;
          const mx = Math.max(red, green, blue), mn = Math.min(red, green, blue);
          if (mx < 40 || red !== mx || (mx - mn) / mx < 0.38) return false;
          const hue = 60 * (green - blue) / (mx - mn);
          return hue > 26 && hue < 58;
        };
        let sum = 0, count = 0;
        for (let j = 0; j < p.length; j += 4) {
          if (p[j+3] < 128 || gold(p[j],p[j+1],p[j+2])) continue;
          sum += luminance(p[j],p[j+1],p[j+2]); count++;
        }
        const base = sum / Math.max(1, count);
        // Preserve the leather's grain and specular highlights; brass retains its source pixels.
        // Pale targets get a flatter tone curve, so a dark glossy bag turns to bone rather than chrome.
        const gamma = luminance(...target) > 150 ? .55 : .9;
        for (let j = 0; j < p.length; j += 4) {
          if (!p[j+3] || gold(p[j],p[j+1],p[j+2])) continue;
          const l = luminance(p[j],p[j+1],p[j+2]);
          const shade = Math.pow(l / Math.max(1, base), gamma);
          const highlight = Math.max(0, l - base * 1.30) * .25;
          for (let c = 0; c < 3; c++) p[j+c] = Math.min(255, target[c] * shade + highlight);
        }
        g.putImageData(pixels, 0, 0);
      }
      return { canvas, url: k === 0 ? image.src : canvas.toDataURL('image/webp', .9), colour };
    })();
    cache.set(key, task);
    return task;
  }
  window.VeyBags = { get, selected };
})();
