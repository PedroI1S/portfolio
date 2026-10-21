# Mossline v3 · convert rendered PNG frames to WebP (desktop + mobile).
#   python3 convert_frames.py hero|cut
# Delivery ("Balanced", Pedro 2026-10-21): the brief's 45 KB/frame was not reachable at this level of detail.
# hero: RGBA render 1200 → 1000 px (q58, lossy alpha) → seq/hero; 720 px → seq/hero-m. All 96 frames.
# cut:  composited over the page background ramp (forest → studio), darkened to #080d0b over frames 150-159;
#       all 160 frames (the player snaps to the nearest frame, no crossfade);
#       1600×900 → 1280×720 (q60) → seq/cut; centre 900×900 → 600 px → seq/cut-m
import sys, os, subprocess, glob
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

from collections import deque
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'seq'))
BG0, BG1 = (15, 31, 16), (8, 13, 11)

def seg(x, a, b): return max(0.0, min(1.0, (x - a) / (b - a)))
def ss(x): return x * x * (3 - 2 * x)
def bg(f):
    t = ss(seg(f, 20, 150))
    return tuple(round(a + (b - a) * t) for a, b in zip(BG0, BG1))

def build_droplets():
    """Extract the floating rock droplets (CrumbsDrift) from hero frame 72, aligned to cut frame 0 (1600x900)."""
    p72 = os.path.join(HERE, 'renders', 'hero', '0072.png')
    if not os.path.exists(p72):
        return None
    arr = np.array(Image.open(p72).convert('RGBA'))
    mask = arr[:, :, 3] > 8
    H, W = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    comps = []
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not visited[y, x]:
                q = deque([(y, x)])
                visited[y, x] = True
                pts = []
                while q:
                    cy, cx = q.popleft()
                    pts.append((cx, cy))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not visited[ny, nx]:
                                visited[ny, nx] = True
                                q.append((ny, nx))
                comps.append(pts)
    comps.sort(key=len, reverse=True)
    rock_mask = np.zeros((H, W), dtype=bool)
    for cx, cy in comps[0]:
        rock_mask[max(0, cy - 3):min(H, cy + 4), max(0, cx - 3):min(W, cx + 4)] = True
    droplet_rgba = arr.copy()
    droplet_rgba[rock_mask] = 0
    sw, sh = 1091, 1091
    d_im = Image.fromarray(droplet_rgba).resize((sw, sh), Image.LANCZOS)
    canvas = Image.new('RGBA', (1600, 900), (0, 0, 0, 0))
    canvas.paste(d_im, (800 - sw // 2 - 1, 450 - sh // 2 - 1))
    return canvas

DROPLETS = None

def get_droplets():
    global DROPLETS
    if DROPLETS is None:
        DROPLETS = build_droplets()
    return DROPLETS

def webp(img, path, q, alpha=False, alpha_q=90):
    tmp = path + '.png'
    img.save(tmp)
    args = ['cwebp', '-quiet', '-q', str(q), '-m', '6', '-sharp_yuv']
    if alpha:
        args += ['-alpha_q', str(alpha_q)]
    subprocess.run(args + [tmp, '-o', path], check=True)
    os.remove(tmp)

def hero(png):
    f = int(os.path.basename(png)[:4])
    im = Image.open(png).convert('RGBA')
    webp(im if im.size == (1200, 1200) else im.resize((1200, 1200), Image.LANCZOS), os.path.join(OUT, 'hero', f'{f:04d}.webp'), 82, alpha=True, alpha_q=92)
    webp(im.resize((800, 800), Image.LANCZOS), os.path.join(OUT, 'hero-m', f'{f:04d}.webp'), 78, alpha=True, alpha_q=90)

def cut(png):
    f = int(os.path.basename(png)[:4])
    im = Image.open(png).convert('RGBA')
    base = Image.new('RGBA', im.size, bg(f) + (255,))
    # Keep the floating rock droplets visible in #how: composite them around the specimen with a subtle drift
    droplets = get_droplets()
    if droplets is not None:
        # Fade gently during the deep close-up (54-100), then return when the camera pulls back (100-148)
        fade = 1.0 - 0.65 * ss(seg(f, 44, 62)) * (1.0 - ss(seg(f, 102, 118)))
        fade *= 1.0 - ss(seg(f, 148, 158))
        if fade > 0.01:
            dx = round(-18 * ss(seg(f, 0, 40)))
            dy = round((f * 0.45) % 28)
            dr = droplets.copy()
            if fade < 0.99:
                r, g, b, a = dr.split()
                a = a.point(lambda p: round(p * fade))
                dr = Image.merge('RGBA', (r, g, b, a))
            shifted = Image.new('RGBA', im.size, (0, 0, 0, 0))
            shifted.paste(dr, (dx, dy))
            base.alpha_composite(shifted)
    base.alpha_composite(im)
    rgb = base.convert('RGB')
    k = ss(seg(f, 150, 159))
    if k > 0:
        rgb = Image.blend(rgb, Image.new('RGB', rgb.size, BG1), k)
    webp(rgb if rgb.size == (1600, 900) else rgb.resize((1600, 900), Image.LANCZOS), os.path.join(OUT, 'cut', f'{f:04d}.webp'), 80)
    sq = rgb.crop((350, 0, 1250, 900)).resize((720, 720), Image.LANCZOS)
    webp(sq, os.path.join(OUT, 'cut-m', f'{f:04d}.webp'), 78)

if __name__ == '__main__':
    which = sys.argv[1]
    for d in ((which,), (which + '-m',)):
        os.makedirs(os.path.join(OUT, d[0]), exist_ok=True)
    pngs = sorted(glob.glob(os.path.join(HERE, 'renders', which, '[0-9][0-9][0-9][0-9].png')))
    if len(sys.argv) > 2:
        done = {int(os.path.basename(p)[:4]) for p in glob.glob(os.path.join(OUT, which, '*.webp'))}
        pngs = [p for p in pngs if int(os.path.basename(p)[:4]) not in done]
    with ProcessPoolExecutor(6) as ex:
        list(ex.map(hero if which == 'hero' else cut, pngs))
    for d in (which, which + '-m'):
        files = glob.glob(os.path.join(OUT, d, '*.webp'))
        tot = sum(os.path.getsize(x) for x in files)
        print(f'{d}: {len(files)} frames, {tot / 1e6:.2f} MB, {tot / max(1, len(files)) / 1e3:.1f} KB avg, max {max((os.path.getsize(x) for x in files), default=0) / 1e3:.1f} KB')
