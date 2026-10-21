# Mossline v3 · per-sequence choreography (hero: 96 frames, cut: 160 frames).
# Imported by render_seq.py and export_anchors.py. Every animated value is keyed on every frame (linear),
# so scrubbing in either direction is deterministic.
import bpy, math
from mathutils import Vector, Matrix

XCUT = 0.20
PROBE_Y = -0.02
REST_YAW = math.radians(28)
HERO_TARGET = Vector((0.0, 0.0, -0.13))


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def ss(x):
    x = clamp(x); return x * x * (3 - 2 * x)

def sst(x):  # smootherstep
    x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10)

def out_cubic(x):
    x = clamp(x); return 1 - (1 - x) ** 3

def out_quart(x):
    x = clamp(x); return 1 - (1 - x) ** 4

def lerp(a, b, t):
    return a + (b - a) * t

def seg(f, f0, f1):
    return clamp((f - f0) / (f1 - f0))


def orbit(target, az, el, dist):
    return target + Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * dist

def look(ob, pos, target):
    ob.location = pos
    ob.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()


def gn_inputs(name):
    """(input struct, identifier) for every modifier input called `name`."""
    res = []
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == 'NODES' and m.node_group:
                for it in m.node_group.interface.items_tree:
                    if it.item_type == 'SOCKET' and it.in_out == 'INPUT' and it.name == name:
                        res.append(getattr(m.properties.inputs, it.identifier))
    return res


def clear_anim():
    for ob in bpy.data.objects:
        ob.animation_data_clear()
    for m in bpy.data.materials:
        if m.node_tree:
            m.node_tree.animation_data_clear()
    for l in bpy.data.lights:
        l.animation_data_clear()


class Keyer:
    def __init__(self):
        self.growth = gn_inputs('Growth')
        self.fall = gn_inputs('Fall')
        self.root = bpy.data.objects['SpecimenRoot']
        self.focus = bpy.data.objects['Focus']
        self.lights = {n: bpy.data.objects[n].data for n in ('Key', 'Rim', 'Rim2', 'Top', 'Fill', 'Under', 'Rake', 'Strip')}
        self.base = {n: l.energy for n, l in self.lights.items()}
        self.base['Rake'] = 28.0
        self.base['Strip'] = 130.0

    def key(self, f, cam, cam_pos, cam_target, root_z, yaw, growth, fall, light_k=1.0, rake=0.0, focus=None, rim=1.0, strip=0.0, fill=1.0):
        sc = bpy.context.scene
        self.root.location = (0, 0, root_z); self.root.rotation_euler = (0, 0, yaw)
        self.root.keyframe_insert('location', frame=f); self.root.keyframe_insert('rotation_euler', frame=f)
        look(cam, cam_pos, cam_target)
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        self.focus.location = focus if focus is not None else cam_target
        self.focus.keyframe_insert('location', frame=f)
        for s in self.growth:
            s.value = growth; s.keyframe_insert('value', frame=f)
        for s in self.fall:
            s.value = fall; s.keyframe_insert('value', frame=f)
        for n, l in self.lights.items():
            k = {'Rake': rake, 'Strip': strip * light_k, 'Rim': rim * light_k, 'Rim2': rim * light_k,
                 'Fill': fill * light_k}.get(n, light_k)
            l.energy = self.base[n] * k
            l.keyframe_insert('energy', frame=f)


def emission_socket(mat_name):
    m = bpy.data.materials[mat_name]
    p = [n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'][0]
    return p.inputs['Emission Strength']


def setup_hero(res=1200):
    sc = bpy.context.scene
    clear_anim()
    sc.frame_start, sc.frame_end = 0, 95
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    cam = bpy.data.objects['CamHero']; sc.camera = cam
    cam.data.dof.aperture_fstop = 11.0
    probe = bpy.data.objects['Probe']; led = bpy.data.objects['ProbeLED']
    for o in (probe, led):
        o.hide_render = True
    for o in ('CrumbsDrift',):
        bpy.data.objects[o].hide_render = False
    K = Keyer()
    for f in range(96):
        if f <= 47:
            t = f / 47
            root_z = lerp(-0.95, 0.0, out_quart(f / 40))
            yaw = REST_YAW - math.radians(6) - math.radians(48) * (1 - out_cubic(t))
            growth = sst(seg(f, 3, 44))
            dist = lerp(1.98, 1.84, out_cubic(t)); el = math.radians(lerp(8, 16, out_cubic(t)))
        else:
            root_z = 0.0
            yaw = REST_YAW - math.radians(6) + math.radians(12) * ss((f - 48) / 47)
            growth = 1.0
            dist = 1.84; el = math.radians(16)
        target = HERO_TARGET.copy()
        pos = orbit(target, math.radians(-90), el, dist)
        focus = Vector((0, -0.09, -0.04 + root_z))
        K.key(f, cam, pos, target, root_z, yaw, growth, fall=f / 30 * 0.35, focus=focus)
    for i in range(3):
        s = emission_socket(f'M_Band{i + 1}'); s.default_value = 0.0
    emission_socket('M_LED').default_value = 0.0


def face_frame(yaw):
    """World-space centre/normal/right/up of the cut face once the specimen sits at `yaw`."""
    R = Matrix.Rotation(yaw, 4, 'Z')
    N = (R @ Vector((1, 0, 0, 0))).to_3d()
    right = (-N).cross(Vector((0, 0, 1))).normalized()
    return R, N, right


CUT_YAW = REST_YAW - math.radians(95)

def setup_cut(res_x=1600, res_y=900):
    sc = bpy.context.scene
    clear_anim()
    sc.frame_start, sc.frame_end = 0, 159
    sc.render.resolution_x, sc.render.resolution_y = res_x, res_y
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    cam = bpy.data.objects['CamCut']; sc.camera = cam
    probe = bpy.data.objects['Probe']; led = bpy.data.objects['ProbeLED']
    K = Keyer()
    R, N, right = face_frame(CUT_YAW)
    def face_pt(y, z):
        return (R @ Vector((XCUT, y, z, 1))).to_3d()
    # camera looks at the face from slightly right of and above its normal
    view_dir = (Matrix.Rotation(math.radians(18), 3, 'Z') @ N).normalized()
    view_dir = (view_dir + Vector((0, 0, 0.1))).normalized()
    # rake light: high on the camera-left of the face, grazing it
    rake = bpy.data.objects['Rake']
    rpos = face_pt(0.0, -0.15) + N * 0.32 - right * 0.55 + Vector((0, 0, 0.55))
    look(rake, rpos, face_pt(0.03, -0.17))
    # tall strip softbox camera-left: gives the anodised probe a long specular highlight
    strip = bpy.data.objects['Strip']
    look(strip, face_pt(PROBE_Y, -0.14) + view_dir * 0.75 - right * 0.38 + Vector((0, 0, 0.12)), face_pt(PROBE_Y, -0.15))

    hero_pos0 = None
    for f in range(160):
        root_z = 0.0
        if f <= 40:
            t = sst(f / 40)
            yaw = lerp(REST_YAW, CUT_YAW, t)
            tgt0 = HERO_TARGET.copy()
            tgt1 = face_pt(0.03, -0.17)
            target = tgt0.lerp(tgt1, t)
            az0 = math.radians(-90); az1 = math.atan2(view_dir.y, view_dir.x)
            el0 = math.radians(16); el1 = math.asin(view_dir.z)
            pos = orbit(target, lerp(az0, az1, t), lerp(el0, el1, t), lerp(1.6, 1.12, t))
            focus = target
        else:
            yaw = CUT_YAW
            if f <= 54:
                t = sst(seg(f, 40, 54))
                y, z = 0.03, lerp(-0.17, -0.012, t)
                d = lerp(1.12, 0.30, t ** 0.8)
            elif f <= 100:
                t = seg(f, 54, 100)
                tt = lerp(t, ss(t), 0.5)
                y, z = lerp(0.03, 0.045, tt), lerp(-0.012, -0.305, tt)
                d = lerp(0.30, 0.27, tt)
            elif f <= 116:
                t = sst(seg(f, 100, 116))
                y, z = lerp(0.045, PROBE_Y + 0.012, t), lerp(-0.305, -0.115, t)
                d = lerp(0.27, 1.16, t)
            else:
                t = seg(f, 116, 159)
                y, z = PROBE_Y + 0.012, lerp(-0.115, -0.125, t)
                d = lerp(1.16, 1.06, ss(t))
            target = face_pt(y, z)
            pos = target + view_dir * d
            focus = face_pt(PROBE_Y, z) if f > 104 else target
        light_k = lerp(1.0, 0.05, ss(seg(f, 149, 158)))
        rake_k = ss(seg(f, 30, 46)) * lerp(1.0, 0.0, ss(seg(f, 149, 157)))
        rim_k = lerp(1.0, 0.04, ss(seg(f, 1, 12))) if f <= 40 else lerp(0.04, 0.15, ss(seg(f, 40, 50)))
        strip_k = ss(seg(f, 100, 112))
        K.key(f, cam, pos, target, root_z, yaw, 1.0, fall=0.8 + f / 30 * 0.3, light_k=light_k, rake=rake_k, focus=focus,
              rim=rim_k, strip=strip_k, fill=lerp(1.0, 0.35, ss(seg(f, 3, 18))))
        cam.data.dof.aperture_fstop = 8.0
        # probe slides in (frames 104-132); hidden before
        probe.hide_render = f < 100; led.hide_render = f < 100
        probe.keyframe_insert('hide_render', frame=f); led.keyframe_insert('hide_render', frame=f)
        pz = lerp(0.46, 0.0, out_cubic(seg(f, 104, 132)))
        probe.location = (XCUT + 0.0025, PROBE_Y, pz); probe.keyframe_insert('location', frame=f)
    for i, f_on in enumerate((133, 138, 143)):
        s = emission_socket(f'M_Band{i + 1}')
        for f in range(160):
            s.default_value = 1.7 * ss(seg(f, f_on, f_on + 3)) * lerp(1.0, 0.0, ss(seg(f, 151, 158)))
            s.keyframe_insert('default_value', frame=f)
    s = emission_socket('M_LED')
    for f in range(160):
        s.default_value = 4.0 * ss(seg(f, 126, 130)) * lerp(1.0, 0.0, ss(seg(f, 152, 158)))
        s.keyframe_insert('default_value', frame=f)
    for o in ('CrumbsDrift',):
        bpy.data.objects[o].hide_render = False


SETUP = {'hero': setup_hero, 'cut': setup_cut}
