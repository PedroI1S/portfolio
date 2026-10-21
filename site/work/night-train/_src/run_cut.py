import sys
import numpy as np
from cut import *

def grids(size):
    W, H = size
    X, Y = np.meshgrid(np.arange(W)/W*100, np.arange(H)/H*100)
    return X, Y

def curve(X, pts):
    xs, ys = zip(*pts)
    return np.interp(X, xs, ys)

def lum(a):
    return 0.299*a[..., 0] + 0.587*a[..., 1] + 0.114*a[..., 2]

which = sys.argv[1:]

if 'breakfast' in which:
    im = load('breakfast')
    near = rrect(im.size, (9.25, -6, 96.6, 49.4), 3.4, invert=True)
    save('breakfast', im, near)

if 'compartment' in which:
    im = load('compartment'); a = np.asarray(im).astype(float); X, Y = grids(im.size)
    win = rrect(im.size, (46.0, 1.4, 95.3, 49.3), 2.0)
    warm = ((a[..., 0] - a[..., 2] > 55) & (a[..., 0] > 110)).astype(float)
    lampbox = poly(im.size, [(65, 35), (77.5, 35), (77.5, 50), (65, 50)])
    lamp = morph(morph(warm * lampbox, 7, 'dilate'), 7, 'erode')
    carafe = poly(im.size, [(76.2, 47.6), (79.6, 47.6), (80.8, 50), (75.4, 50)])
    near = np.clip((1 - win) + lamp + carafe, 0, 1)
    save('compartment', im, near)

if 'arrival' in which:
    im = load('arrival'); a = np.asarray(im).astype(float); X, Y = grids(im.size)
    under = curve(X, [(0, 36), (2, 33.5), (4, 28.5), (6, 24.5), (8, 21.5), (10, 18.5), (12, 16.5), (14, 14.8), (16, 13.3), (20, 11.2), (24, 9.4), (30, 7.6), (40, 6.4), (50, 6.0), (60, 6.6), (64, 8.0), (68, 10.2), (72, 13.0), (76, 17.0), (80, 22.0), (84, 28.0), (88, 35.0), (92, 42.0), (94, 46.0), (100, 47)])
    dark = (lum(a) < 105).astype(float)
    bridge = ((Y < under - 3.5) | ((Y < under + 2.5) & (dark > 0))).astype(float)
    bridge = morph(morph(bridge, 5, 'dilate'), 5, 'erode')
    pillars = poly(im.size, [(93.3, 44.5), (100, 44.5), (100, 69.5), (98, 69.5), (94, 69), (93.6, 60), (92.8, 52)])
    left = poly(im.size, [(0, 15), (8.6, 25), (8.8, 51.5), (12.6, 52.5), (12.8, 71), (14.5, 72.5), (15.2, 80), (18.6, 82), (19, 91.5), (24, 92), (26, 96), (40, 97), (42, 100), (0, 100)])
    near = np.clip(bridge + pillars + left, 0, 1)
    save('arrival', im, near)

if 'viaduct' in which:
    im = load('viaduct'); a = np.asarray(im).astype(float); X, Y = grids(im.size)
    region = poly(im.size, [(64, 100), (64, 82), (68, 72), (74, 64), (80, 56), (86, 52), (92, 50), (100, 48), (100, 100)]) \
           + poly(im.size, [(16, 100), (18, 96), (30, 94), (45, 91), (56, 88), (64, 86), (64, 100)])
    region = np.clip(region, 0, 1)
    foliage = ((a[..., 1] >= a[..., 2] * 0.92) & (lum(a) < 130)) | ((a[..., 0] > 150) & (Y > 60) & (X > 64))
    core = morph(region, 71, 'erode')
    near = np.clip(core + region * foliage, 0, 1)
    near = morph(morph(near, 15, 'dilate'), 15, 'erode')
    near = morph(morph(near, 5, 'erode'), 5, 'dilate') * region
    save('viaduct', im, near)
