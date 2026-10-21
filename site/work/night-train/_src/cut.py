"""Cut painted scenes into parallax planes.
near mask (1 = near plane). Far plane = original with near area inpainted (push-pull)."""
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def load(n):
    return Image.open(n + '.png').convert('RGB')

def rrect(size, box, r, invert=False):
    W, H = size
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0*W/100, y0*H/100, x1*W/100, y1*H/100), radius=r*W/100, fill=255)
    a = np.asarray(m) / 255.
    return 1 - a if invert else a

def poly(size, pts):
    W, H = size
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(x*W/100, y*H/100) for x, y in pts], fill=255)
    return np.asarray(m) / 255.

def morph(a, size, op):
    im = Image.fromarray((a*255).astype(np.uint8))
    f = ImageFilter.MaxFilter(size) if op == 'dilate' else ImageFilter.MinFilter(size)
    return np.asarray(im.filter(f)) / 255.

def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))) / 255.

def inpaint(rgb, hole):
    """push-pull fill of hole (1 = unknown)."""
    img = rgb.astype(np.float64); w = (1 - hole).astype(np.float64)
    levels = []
    ci, cw = img * w[..., None], w.copy()
    while min(cw.shape) > 4:
        levels.append((ci, cw))
        H, W = cw.shape
        H2, W2 = H // 2 * 2, W // 2 * 2
        ci = ci[:H2, :W2].reshape(H2//2, 2, W2//2, 2, 3).sum((1, 3))
        cw = cw[:H2, :W2].reshape(H2//2, 2, W2//2, 2).sum((1, 3))
    est = ci / np.maximum(cw, 1e-6)[..., None]
    for li, lw in reversed(levels):
        H, W = lw.shape
        up = np.asarray(Image.fromarray(np.clip(est, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(np.float64)
        known = np.clip(lw, 0, 1)[..., None]
        cur = li / np.maximum(lw, 1e-6)[..., None]
        est = known * cur + (1 - known) * up
    return np.clip(est, 0, 255).astype(np.uint8)

def save(name, rgb, near, feather=1.2, grow=7, preview=True):
    a = np.asarray(rgb)
    alpha = blur(near, feather)
    hole = morph((near > 0.02).astype(float), grow, 'dilate')
    far = inpaint(a, hole)
    Image.fromarray(far).save(f'out/{name}-far.png')
    rgba = np.dstack([a, (alpha*255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(f'out/{name}-near.png')
    if preview:
        # magenta-tinted near area + far plane side by side, half size
        p = a.astype(float).copy(); p[..., 0] = p[..., 0]*(1-alpha*.5) + 255*alpha*.5; p[..., 2] = p[..., 2]*(1-alpha*.5) + 255*alpha*.5
        top = Image.fromarray(p.astype(np.uint8)).resize((836, 470))
        bot = Image.fromarray(far).resize((836, 470))
        sheet = Image.new('RGB', (836, 950)); sheet.paste(top, (0, 0)); sheet.paste(bot, (0, 480))
        sheet.save(f'prev-{name}.jpg', quality=80)
