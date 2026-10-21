# Mossline v3 · export per-frame 2D anchors (normalised 0-1, y down) for the DOM labels.
#   blender -b specimen.blend -P export_anchors.py -- --seq hero|cut [--out ../seq]
import bpy, sys, os, json, argparse
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seq

ap = argparse.ArgumentParser()
ap.add_argument('--seq', required=True, choices=('hero', 'cut'))
ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'seq'))
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

sc = bpy.context.scene
if a.seq == 'hero':
    seq.setup_hero(1200)
    names = {'soc': 'A_soc', 'depth': 'A_depth', 'moss': 'A_moss'}
else:
    seq.setup_cut(1600, 900)
    names = {'band1': 'A_band1', 'band2': 'A_band2', 'band3': 'A_band3',
             'ruler_top': 'A_ruler_top', 'ruler_30': 'A_ruler_30', 'face': 'A_face'}
cam = sc.camera
out = {'seq': a.seq, 'count': sc.frame_end - sc.frame_start + 1,
       'width': sc.render.resolution_x, 'height': sc.render.resolution_y, 'anchors': {k: [] for k in names}}
for f in range(sc.frame_start, sc.frame_end + 1):
    sc.frame_set(f)
    for k, n in names.items():
        p = world_to_camera_view(sc, cam, bpy.data.objects[n].matrix_world.translation)
        out['anchors'][k].append([round(p.x, 4), round(1 - p.y, 4)] if p.z > 0 else None)
os.makedirs(a.out, exist_ok=True)
path = os.path.join(a.out, f'anchors-{a.seq}.json')
with open(path, 'w') as fh:
    json.dump(out, fh, separators=(',', ':'))
print('WROTE', path)
