# Mossline v3 · hand-off points: the same specimen-local 3D points projected in hero frame 72 (where the
# hero carry ends) and cut frame 0 (where the pin starts). main.js fits scale + offset to them by least squares.
#   blender -b specimen.blend -P export_handoff.py
import bpy, sys, os, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seq

PTS = [(-0.20, -0.17, 0.0), (0.18, -0.15, 0.0), (0.0, 0.17, 0.02), (-0.03, 0.035, 0.17), (-0.18, -0.12, -0.2),
       (0.17, -0.12, -0.2), (0.0, -0.16, -0.32), (0.02, 0.0, -0.42), (-0.12, 0.08, 0.1), (0.1, -0.05, 0.08)]
sc = bpy.context.scene
root = bpy.data.objects['SpecimenRoot']
def project(frame):
    sc.frame_set(frame)
    m = root.matrix_world
    out = []
    for p in PTS:
        v = world_to_camera_view(sc, sc.camera, m @ Vector(p))
        out.append([round(v.x, 5), round(1 - v.y, 5)])
    return out
seq.setup_hero(1200); hero = project(72)
seq.setup_cut(1600, 900); cut = project(0)
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'seq', 'handoff.json')
json.dump({'heroFrame': 72, 'cutFrame': 0, 'hero': hero, 'cut': cut}, open(path, 'w'), separators=(',', ':'))
print('WROTE', path, hero[:2], cut[:2])
