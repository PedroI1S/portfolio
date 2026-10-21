# Turn the float lightmaps baked by build_house.py into web JPGs plus model/house.json.
#   python3 -I pack_lightmaps.py <scratch dir with lm_N.npy + house_meta.json>
import sys, os, json
import numpy as np
from PIL import Image

src = sys.argv[1]
out = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'model'))
meta = json.load(open(os.path.join(src, 'house_meta.json')))
scales = {}
tags = [f'{r}' for r in range(len(meta['rooms']))] + [f'd{r}' for r in range(len(meta['rooms']))]
tags += [t for t in ('x', 'xd') if os.path.exists(os.path.join(src, f'lm_{t}.npy'))]   # the street front
for tag in tags:
    lm = np.load(os.path.join(src, f'lm_{tag}.npy')).astype(np.float32)
    valid = lm.sum(axis=2) > 1e-6
    # light denoise: normalised gaussian over baked texels only, so empty atlas space never bleeds in
    def blur(a, sigma):
        k = np.exp(-0.5 * (np.arange(-3, 4) / sigma) ** 2)
        k /= k.sum()
        a = sum(np.roll(a, i - 3, axis=0) * k[i] for i in range(7))
        return sum(np.roll(a, i - 3, axis=1) * k[i] for i in range(7))
    w = blur(valid.astype(np.float32), 1.1)
    den = np.stack([blur(lm[..., c] * valid, 1.1) for c in range(3)], axis=2) / np.maximum(w[..., None], 1e-4)
    lm = np.where(valid[..., None], den, lm)
    s = float(np.percentile(lm[valid].max(axis=1), 99.7))
    scales[tag] = round(s, 4)
    v = np.clip(lm / s, 0, 1)
    srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, f'lm_{tag}.jpg'), quality=84, optimize=True, progressive=True)
    print(tag, 'scale', round(s, 3), os.path.getsize(os.path.join(out, f'lm_{tag}.jpg')) // 1024, 'KB')

meta.pop('bakeP995', None)
meta['lightScale'] = scales
meta['exposure'] = 1.0
json.dump(meta, open(os.path.join(out, 'house.json'), 'w'), indent=1)
print('wrote', os.path.join(out, 'house.json'))
