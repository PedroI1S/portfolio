# Mossline v3 · render a sequence (or single frames) from specimen.blend.
#   blender -b specimen.blend -P render_seq.py -- --seq hero [--frames 0-95] [--res 1200] [--samples 112] [--out DIR]
# Frames are RGBA PNG; existing frames are skipped so an interrupted run can resume.
import bpy, sys, os, time, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seq

ap = argparse.ArgumentParser()
ap.add_argument('--seq', required=True, choices=('hero', 'cut'))
ap.add_argument('--frames', default=None)
ap.add_argument('--res', type=int, default=None, help='hero: square size; cut: width (16:9)')
ap.add_argument('--samples', type=int, default=112)
ap.add_argument('--out', default=None)
ap.add_argument('--threshold', type=float, default=0.015)
ap.add_argument('--overwrite', action='store_true')
ap.add_argument('--no-drift', action='store_true', help='hide the world-space drifting crumbs (matches the first cut render)')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

sc = bpy.context.scene
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'METAL'
sc.cycles.device = 'GPU'
if a.seq == 'hero':
    seq.setup_hero(a.res or 1200)
else:
    w = a.res or 1600
    seq.setup_cut(w, round(w * 9 / 16))
if a.no_drift:
    bpy.data.objects['CrumbsDrift'].hide_render = True
sc.cycles.samples = a.samples
sc.cycles.adaptive_threshold = a.threshold
out = a.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'renders', a.seq)
os.makedirs(out, exist_ok=True)
if a.frames:
    parts = []
    for chunk in a.frames.split(','):
        if '-' in chunk:
            x, y = chunk.split('-'); parts += list(range(int(x), int(y) + 1))
        else:
            parts.append(int(chunk))
elif a.seq == 'cut':
    # all 160 frames are shipped; render coarse-to-fine so the page can be tested early
    ship = list(range(160))
    parts = [f for f in ship if f % 8 == 0] + [f for f in ship if f % 8 == 4] + [f for f in ship if f % 4]
else:
    parts = list(range(sc.frame_start, sc.frame_end + 1))
log = open(os.path.join(out, 'render_log.txt'), 'a')
for f in parts:
    path = os.path.join(out, f'{f:04d}.png')
    if os.path.exists(path) and not a.overwrite:
        continue
    sc.frame_set(f)
    sc.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t0
    print(f'FRAME {a.seq} {f} {dt:.1f}s', flush=True)
    log.write(f'{a.seq} {f} {dt:.1f}s {sc.render.resolution_x}x{sc.render.resolution_y} s{a.samples}\n'); log.flush()
