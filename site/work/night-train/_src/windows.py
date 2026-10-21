"""Cut the two window scenes from traced glass outlines (v2).
near = everything outside the glass (eroded a few px) + objects in front of the glass.
far  = glass content, mirrored outward past the glass edge, so a drift never shows frame pixels."""
import numpy as np
from PIL import Image, ImageDraw
from cut import load, poly, morph, blur, inpaint

GLASS = {
    'breakfast': [(9.3, -2), (9.3, 44), (9.5, 45.5), (10.0, 47.0), (10.8, 48.4), (11.8, 49.5), (12.8, 50.2),
                  (20, 50.55), (30, 51.0), (40, 51.5), (50, 52.15), (60, 52.6), (70, 53.35), (80, 53.8),
                  (88, 54.2), (93, 54.4), (96.0, 53.6), (96.9, 52.5), (97.3, 50), (97.6, 46), (98.3, 42),
                  (99.0, 39.5), (100.5, 37), (102, 37), (102, -2)],
    'compartment': [(46.25, 6), (46.25, 41), (46.5, 42.6), (47.1, 43.6), (48, 44.1), (52, 45.4), (56, 45.95),
                    (60, 46.45), (64, 46.85), (70, 47.65), (76, 48.45), (82, 49.25), (86, 49.85), (90, 50.35),
                    (92.5, 50.6), (93.8, 50.2), (94.6, 49.3), (95.05, 48), (95.15, 46), (95.1, 35), (95.05, 3),
                    (95.05, -2), (66, -2), (60, 0.6), (56, 1.4), (52, 2.1), (48.6, 2.9), (47.4, 3.5), (46.6, 4.5)],
}

def reflect(i, lo, hi):
    """reflect integer index array i into [lo, hi] (inclusive)."""
    span = max(hi - lo, 1)
    j = np.abs(i - lo) % (2 * span)
    return lo + np.where(j > span, 2 * span - j, j)

def mirror_fill(rgb, g):
    out = rgb.copy(); H, W = g.shape
    have = np.zeros(W, bool)
    for x in range(W):                       # vertical pass, per column
        ys = np.nonzero(g[:, x])[0]
        if len(ys) < 4: continue
        have[x] = True
        lo, hi = ys.min(), ys.max()
        idx = np.arange(H); src = reflect(idx, lo, hi)
        col = rgb[src, x]; col[lo:hi+1] = rgb[lo:hi+1, x]
        out[:, x] = col
    xs = np.nonzero(have)[0]; lo, hi = xs.min(), xs.max()   # horizontal pass for columns with no glass
    src = reflect(np.arange(W), lo, hi)
    miss = ~have
    out[:, miss] = out[:, src[miss]]
    return out

def cut(name, extra_near=None):
    im = load(name); a = np.asarray(im)
    glass = poly(im.size, GLASS[name])
    source = morph(glass, 15, 'erode') > 0.5                   # mirror from ~7px inside the traced edge
    far = mirror_fill(a, source)
    opening = morph(glass, 9, 'erode')                         # opening sits ~4px inside the glass
    near = 1 - opening
    if extra_near is not None:
        near = np.clip(near + extra_near, 0, 1)
        far = inpaint(far, morph((extra_near > 0.02).astype(float), 9, 'dilate'))  # objects in front of glass
    alpha = blur(near, 1.0)
    Image.fromarray(far).save(f'out/{name}-far.png')
    Image.fromarray(np.dstack([a, (alpha*255).astype(np.uint8)]), 'RGBA').save(f'out/{name}-near.png')
    # preview: far plane shifted 24px up/left under the near plane = worst-case drift
    for dx, dy, tag in [(0, -24, 'up'), (0, 24, 'down'), (24, 0, 'side')]:
        f = np.roll(np.roll(far, dy, 0), dx, 1).astype(float)
        comp = f * (1 - alpha[..., None]) + a * alpha[..., None]
        Image.fromarray(comp.astype(np.uint8)).save(f'drift-{name}-{tag}.png')

if __name__ == '__main__':
    cut('breakfast')
    im = load('compartment'); a = np.asarray(im).astype(float)
    warm = ((a[..., 0] - a[..., 2] > 55) & (a[..., 0] > 110)).astype(float)
    lamp = morph(morph(warm * poly(im.size, [(65, 35), (77.5, 35), (77.5, 50), (65, 50)]), 7, 'dilate'), 7, 'erode')
    carafe = poly(im.size, [(76.2, 47.6), (79.6, 47.6), (80.8, 50.5), (75.4, 50.5)])
    cut('compartment', np.clip(lamp + carafe, 0, 1))
