# House of Vey: the house, modelled, lit and baked in Blender (headless).
#   blender -b -P build_house.py -- preview            quick Cycles stills of each room
#   blender -b -P build_house.py -- bake [res] [samp]  bake lightmaps, export house.glb + house.json
# Blender is Z-up with the rooms running along +Y; glTF export turns that into three.js -Z.
import bpy, bmesh, math, os, sys, json, random
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'model'))
SCRATCH = os.environ.get('VEY_SCRATCH', HERE)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
STAGE = ARGS[0] if ARGS else 'preview'
RES = int(ARGS[1]) if len(ARGS) > 1 else 2048
SAMPLES = int(ARGS[2]) if len(ARGS) > 2 else 256

W, H, D, T = 5.0, 3.4, 6.5, 0.3          # current room width/height/depth (set per room below), wall thickness
DW, DSPR = 1.7, 1.95                     # door width, springing height (top = 2.8 m)
WW, WSILL, WSPR = 1.5, 0.75, 2.15        # bedroom window
PLINTH_H, PLINTH_Y = 1.05, 3.9           # plinth height, distance from room front face
LAMP_Z = 2.42
FT, GROUND = 0.3, -0.3                   # facade thickness (in front of y = 0), street level

# Each room has its own proportions: a double-height hall, a wide salon, a low study, a broad bedroom.
ROOMS = [
    dict(name='hall', W=5.0, H=5.8, D=6.5, wall='#bcd0be', trim='#e8efe6', ceil='#e2e9df', floor='#c9c2b3', plinth='#f2ede3', light=(1.0, 0.85, 0.66), power=170, bx=0.9),
    dict(name='salon', W=6.2, H=3.6, D=7.0, wall='#b5583d', trim='#ecc9b2', ceil='#cf8064', floor='#7a5236', plinth='#ecdfcc', light=(1.0, 0.8, 0.58), power=175, bx=-0.9),
    dict(name='study', W=4.2, H=3.05, D=5.6, wall='#c79a35', trim='#f0dfae', ceil='#dcba6c', floor='#4a3220', plinth='#efe6d2', light=(1.0, 0.84, 0.62), power=150, bx=0.9),
    dict(name='bedroom', W=7.0, H=3.4, D=6.5, wall='#4a2a4e', trim='#7c5b80', ceil='#3e2443', floor='#8d5b70', plinth='#ecd9de', light=(1.0, 0.8, 0.84), power=160, bx=-0.9),
]
Y0 = [sum(R['D'] for R in ROOMS[:r]) for r in range(len(ROOMS))]
LENGTH = sum(R['D'] for R in ROOMS)


def lin(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# ── scene reset ───────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection
MATS = {}


def mat(name, hexstr, rough=0.8, emission=None, strength=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = lin(hexstr)
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = emission + (1.0,)
        p.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


def new_obj(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    me.materials.append(material)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, material):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    return new_obj(name, bm, material)


def quad(name, pts, material):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bm.faces.new(vs)
    return new_obj(name, bm, material)


def cylinder(name, x, y, z0, z1, r, material, seg=32, axis='Z'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - z0)
    ob = new_obj(name, bm, material)
    if axis == 'Z':
        ob.location = (x, y, (z0 + z1) / 2)
    return ob


def arch_outline(w, z0, spr, seg=28):
    pts = [(-w / 2, z0), (-w / 2, spr)]
    for i in range(1, seg):
        a = math.pi - math.pi * i / seg
        pts.append((w / 2 * math.cos(a), spr + w / 2 * math.sin(a)))
    pts += [(w / 2, spr), (w / 2, z0)]
    return pts


def prism(name, outline, y0, y1, material, xoff=0.0):
    bm = bmesh.new()
    front = [bm.verts.new((x + xoff, y0, z)) for x, z in outline]
    back = [bm.verts.new((x + xoff, y1, z)) for x, z in outline]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, material)


def apply_boolean(ob, cutter, op='DIFFERENCE'):
    mod = ob.modifiers.new('bool', 'BOOLEAN')
    mod.operation = op
    mod.object = cutter
    mod.solver = 'EXACT'
    try:
        mod.material_mode = 'TRANSFER'
    except Exception:
        pass
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)
    bpy.data.objects.remove(cutter)


def cull(ob, planes):
    """Delete faces lying entirely on any (axis, value) plane: hidden faces waste lightmap space."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dead = []
    for f in bm.faces:
        for ax, val in planes:
            if all(abs(v.co[ax] - val) < 1e-4 for v in f.verts):
                dead.append(f)
                break
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def slab_with_arch(name, y0, y1, wall_m, trim_m, w, z0, spr, cull_y):
    s = box(name, -W / 2, W / 2, y0, y1, 0, H, wall_m)
    c = prism(name + '_cut', arch_outline(w, z0, spr), y0 - 0.05, y1 + 0.05, trim_m)
    apply_boolean(s, c)
    cull(s, [(0, -W / 2), (0, W / 2), (2, 0.0), (2, H), (1, cull_y)])
    return s


def arch_ring(name, y_face, facing, w, spr, width, depth, material, z0=0.0):
    """Moulded architrave: outer arch minus inner arch, standing proud of a wall face."""
    y0, y1 = (y_face - depth, y_face) if facing < 0 else (y_face, y_face + depth)
    outer = prism(name, arch_outline(w + 2 * width, z0, spr), y0, y1, material)
    inner = prism(name + '_in', arch_outline(w, z0 - 0.1, spr), y0 - 0.05, y1 + 0.05, material)
    apply_boolean(outer, inner)
    return outer


def run_x(name, y_face, facing, z0, z1, depth, material, gaps=()):
    """A horizontal moulding along a front/back wall face, interrupted by openings (x ranges)."""
    y0, y1 = (y_face - depth, y_face) if facing < 0 else (y_face, y_face + depth)
    xs = [-W / 2]
    for g0, g1 in sorted(gaps):
        xs += [g0, g1]
    xs.append(W / 2)
    out = []
    for i in range(0, len(xs), 2):
        if xs[i + 1] - xs[i] > 0.02:
            out.append(box(f'{name}_{i}', xs[i], xs[i + 1], y0, y1, z0, z1, material))
    return out


def run_y(name, side, y0, y1, z0, z1, depth, material):
    # stop short of the front/back runs (same depth) so the corners never overlap: coplanar faces bake black
    y0, y1 = y0 + depth, y1 - depth
    x = -W / 2 if side < 0 else W / 2
    return box(name, x, x + depth, y0, y1, z0, z1, material) if side < 0 else box(name, x - depth, x, y0, y1, z0, z1, material)


def panel_frame(name, side, yc, zc, w, h, strip, material):
    x = -W / 2 if side < 0 else W / 2
    d = 0.018
    xa, xb = (x, x + d) if side < 0 else (x - d, x)
    parts = [
        box(name + 'b', xa, xb, yc - w / 2, yc + w / 2, zc - h / 2, zc - h / 2 + strip, material),
        box(name + 't', xa, xb, yc - w / 2, yc + w / 2, zc + h / 2 - strip, zc + h / 2, material),
        box(name + 'l', xa, xb, yc - w / 2, yc - w / 2 + strip, zc - h / 2 + strip, zc + h / 2 - strip, material),
        box(name + 'r', xa, xb, yc + w / 2 - strip, yc + w / 2, zc - h / 2 + strip, zc + h / 2 - strip, material),
    ]
    return parts


def uv_sphere(name, x, y, z, r, material, half=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    if half:   # keep the upper dome, open underneath
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    ob = new_obj(name, bm, material)
    ob.location = (x, y, z)
    return ob


def cull_facing(ob, rules):
    """Delete faces whose normal points along (axis, sign)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dead = [f for f in bm.faces if any(f.normal[ax] * sg > 0.9 for ax, sg in rules)]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def cull_hidden(ob, a, b):
    """Delete faces pressed against the room's own surfaces and facing into them (backs of mouldings, undersides)."""
    planes = [(2, 0.0, -1), (2, H, 1), (0, -W / 2, -1), (0, W / 2, 1), (1, a, -1), (1, b, 1)]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dead = []
    for f in bm.faces:
        for ax, val, sg in planes:
            if f.normal[ax] * sg > 0.9 and all(abs(v.co[ax] - val) < 1e-3 for v in f.verts):
                dead.append(f)
                break
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def join(name, parts):
    parts = [p for p in parts if p]
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, object=parts[0]):
        bpy.ops.object.join()
    ob = parts[0]
    ob.name = name
    ob.data.name = name
    # bake transforms
    ob.data.transform(ob.matrix_world)
    ob.matrix_world.identity()
    return ob


# ── the rooms ─────────────────────────────────────────────────
trim_brass = mat('brass', '#b48a3c', rough=0.35)
shade_in = mat('shade_inner', '#e9cf94', rough=0.5)
bulb = mat('bulb', '#fff4dc', emission=(1.0, 0.92, 0.78), strength=25.0)
wood_dark = mat('wood_dark', '#3a2a1e', rough=0.6)
wood_mid = mat('wood_mid', '#5b3b22', rough=0.6)
ceramic = mat('ceramic', '#efe9dc', rough=0.4)
rng = random.Random(16)
meta = dict(W=W, H=H, D=D, T=T, DW=DW, DSPR=DSPR, WW=WW, WSILL=WSILL, WSPR=WSPR, plinthH=PLINTH_H, lampZ=LAMP_Z,
            FT=FT, ground=GROUND, length=LENGTH, rooms=[])
room_objs = []
proxies = []

for r, R in enumerate(ROOMS):
    W, H, D = R['W'], R['H'], R['D']      # the helpers read these module globals
    ys, ye = Y0[r], Y0[r] + D
    a, b = ys + T / 2, ye - T / 2
    CO = 0.16 if H > 3.2 else 0.1         # a shallower cornice under the study's low ceiling
    wall = mat(f'wall_{r}', R['wall'], rough=0.9)
    trim = mat(f'trim_{r}', R['trim'], rough=0.7)
    ceil = mat(f'ceil_{r}', R['ceil'], rough=0.9)
    floor = mat(f'floor_{r}', R['floor'], rough=0.7)
    plinth = mat(f'plinth_{r}', R['plinth'], rough=0.6)
    bx, py = R['bx'], a + PLINTH_Y
    parts = []

    # shell
    parts.append(quad(f'floor{r}', [(-W / 2, ys, 0), (W / 2, ys, 0), (W / 2, ye, 0), (-W / 2, ye, 0)], floor))
    parts.append(quad(f'ceil{r}', [(-W / 2, ys, H), (-W / 2, ye, H), (W / 2, ye, H), (W / 2, ys, H)], ceil))
    parts.append(quad(f'wl{r}', [(-W / 2, ys, 0), (-W / 2, ye, 0), (-W / 2, ye, H), (-W / 2, ys, H)], wall))
    parts.append(quad(f'wr{r}', [(W / 2, ys, 0), (W / 2, ys, H), (W / 2, ye, H), (W / 2, ye, 0)], wall))
    parts.append(slab_with_arch(f'front{r}', ys, a, wall, trim, DW, -0.1, DSPR, ys))
    last = r == len(ROOMS) - 1
    if last:
        parts.append(slab_with_arch(f'back{r}', b, ye, wall, trim, WW, WSILL, WSPR, ye))
    else:
        parts.append(slab_with_arch(f'back{r}', b, ye, wall, trim, DW, -0.1, DSPR, ye))

    # mouldings: skirting, dado, cornice, architraves, wall panels
    door_gap = (-DW / 2 - 0.13, DW / 2 + 0.13)
    back_gap = (-WW / 2 - 0.13, WW / 2 + 0.13) if last else door_gap
    for side in (-1, 1):
        parts.append(run_y(f'sk{r}{side}', side, a, b, 0, 0.16, 0.022, trim))
        parts.append(run_y(f'da{r}{side}', side, a, b, 0.92, 0.97, 0.03, trim))
        parts.append(run_y(f'co{r}{side}a', side, a, b, H - CO, H, 0.05, trim))
        parts.append(run_y(f'co{r}{side}b', side, a, b, H - CO * 0.45, H, 0.12, trim))
    parts += run_x(f'skf{r}', a, 1, 0, 0.16, 0.022, trim, [door_gap])
    parts += run_x(f'skb{r}', b, -1, 0, 0.16, 0.022, trim, [] if last else [back_gap])
    parts += run_x(f'daf{r}', a, 1, 0.92, 0.97, 0.03, trim, [door_gap])
    parts += run_x(f'dab{r}', b, -1, 0.92, 0.97, 0.03, trim, [back_gap])
    parts += run_x(f'cof{r}a', a, 1, H - CO, H, 0.05, trim)
    parts += run_x(f'cof{r}b', a, 1, H - CO * 0.45, H, 0.12, trim)
    parts += run_x(f'cob{r}a', b, -1, H - CO, H, 0.05, trim)
    parts += run_x(f'cob{r}b', b, -1, H - CO * 0.45, H, 0.12, trim)
    parts.append(arch_ring(f'arf{r}', a, 1, DW, DSPR, 0.13, 0.035, trim))
    if last:
        parts.append(arch_ring(f'arb{r}', b, -1, WW, WSPR, 0.13, 0.035, trim, z0=WSILL - 0.06))
        parts.append(box(f'sill{r}', -WW / 2 - 0.16, WW / 2 + 0.16, b - 0.09, b, WSILL - 0.06, WSILL, trim))
        # glazing bars
        parts.append(box(f'mv{r}', -0.025, 0.025, b + 0.05, b + 0.09, WSILL, WSPR + WW / 2, trim))
        parts.append(box(f'mh{r}', -WW / 2, WW / 2, b + 0.05, b + 0.09, 1.55, 1.6, trim))
    else:
        parts.append(arch_ring(f'arb{r}', b, -1, DW, DSPR, 0.13, 0.035, trim))
    n_pan = max(2, round((b - a) / 2.05))
    pitch = (b - a) / n_pan
    for side in (-1, 1):
        for k in range(n_pan):
            yc = a + pitch * (k + 0.5)
            parts += panel_frame(f'pn{r}{side}{k}', side, yc, 1.95, pitch - 0.5, 1.5, 0.045, trim)
            parts += panel_frame(f'pq{r}{side}{k}', side, yc, 0.53, pitch - 0.5, 0.58, 0.035, trim)
            if H > 5:   # the double-height hall: a second, taller register above a picture rail
                parts += panel_frame(f'pu{r}{side}{k}', side, yc, 4.3, pitch - 0.5, 2.2, 0.05, trim)
        if H > 5:
            parts.append(run_y(f'pr{r}{side}', side, a, b, 3.0, 3.07, 0.035, trim))
    if H > 5:
        parts += run_x(f'prf{r}', a, 1, 3.0, 3.07, 0.035, trim)
        parts += run_x(f'prb{r}', b, -1, 3.0, 3.07, 0.035, trim)

    # plinth, pendant lamp
    parts.append(box(f'pl{r}', bx - 0.3, bx + 0.3, py - 0.3, py + 0.3, 0, PLINTH_H - 0.04, plinth))
    parts.append(box(f'plc{r}', bx - 0.34, bx + 0.34, py - 0.34, py + 0.34, PLINTH_H - 0.04, PLINTH_H, plinth))
    parts.append(box(f'plb{r}', bx - 0.34, bx + 0.34, py - 0.34, py + 0.34, 0, 0.08, plinth))
    parts.append(cylinder(f'cord{r}', bx, py, LAMP_Z + 0.16, H, 0.008, trim_brass, seg=8))
    parts.append(uv_sphere(f'shade{r}', bx, py, LAMP_Z, 0.2, trim_brass, half=True))
    inner = uv_sphere(f'shadein{r}', bx, py, LAMP_Z + 0.001, 0.194, shade_in, half=True)
    bm = bmesh.new()                       # the inside of the dome faces down, toward the bulb
    bm.from_mesh(inner.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(inner.data)
    bm.free()
    parts.append(inner)
    parts.append(uv_sphere(f'bulb{r}', bx, py, LAMP_Z + 0.03, 0.038, bulb))

    # props
    if r == 0:   # hall: console table, vase, books, round mirror
        x0 = -W / 2
        parts.append(box('ct_top', x0 + 0.02, x0 + 0.44, a + 1.0, a + 2.5, 0.8, 0.85, wood_dark))
        for yy in (a + 1.04, a + 2.42):
            parts.append(box(f'ct_leg{yy}', x0 + 0.36, x0 + 0.4, yy, yy + 0.04, 0, 0.8, wood_dark))
            parts.append(box(f'ct_legb{yy}', x0 + 0.04, x0 + 0.08, yy, yy + 0.04, 0, 0.8, wood_dark))
        parts.append(cylinder('vase', x0 + 0.23, a + 1.35, 0.85, 1.22, 0.09, ceramic))
        for i, (hx, th) in enumerate(((0.3, 0.05), (0.27, 0.04), (0.24, 0.045))):
            z = 0.85 + sum(t for _, t in ((0.3, 0.05), (0.27, 0.04), (0.24, 0.045))[:i])
            parts.append(box(f'bk{i}', x0 + 0.08, x0 + 0.08 + hx, a + 2.0, a + 2.21, z, z + th, mat(f'book{i}', ['#1f3d30', '#7a1f24', '#e8dcc3'][i])))
        mirror = mat('mirror', '#a9b5b2', rough=0.25)
        m = cylinder('mirror', 0, 0, 0, 0.03, 0.42, mirror, seg=48)
        m.rotation_euler = (0, math.pi / 2, 0)
        m.location = (x0 + 0.03, a + 1.75, 1.85)
        mf = cylinder('mirror_f', 0, 0, 0, 0.025, 0.47, trim_brass, seg=48)
        mf.rotation_euler = (0, math.pi / 2, 0)
        mf.location = (x0 + 0.012, a + 1.75, 1.85)
        parts += [m, mf]
    if r == 1:   # salon: armchair in green velvet, rug, framed picture
        velvet = mat('velvet', '#1f4a3a', rough=0.95)
        x1 = W / 2
        parts.append(box('ac_seat', x1 - 1.0, x1 - 0.12, a + 1.0, a + 1.85, 0.16, 0.46, velvet))
        parts.append(box('ac_back', x1 - 0.32, x1 - 0.1, a + 1.0, a + 1.85, 0.46, 1.02, velvet))
        parts.append(box('ac_arm1', x1 - 1.0, x1 - 0.12, a + 0.92, a + 1.06, 0.16, 0.66, velvet))
        parts.append(box('ac_arm2', x1 - 1.0, x1 - 0.12, a + 1.79, a + 1.93, 0.16, 0.66, velvet))
        for lx in (x1 - 0.95, x1 - 0.2):
            for ly in (a + 0.95, a + 1.85):
                parts.append(box(f'ac_l{lx}{ly}', lx, lx + 0.05, ly, ly + 0.05, 0, 0.16, wood_dark))
        parts.append(box('rug1', bx - 1.35, bx + 1.35, py - 1.6, py + 1.6, 0, 0.012, mat('rug_salon', '#6d2a1d', rough=1.0)))
        parts.append(box('pic_f', x1 - 0.04, x1, a + 1.0, a + 1.85, 1.55, 2.5, trim_brass))
        parts.append(box('pic_c', x1 - 0.05, x1 - 0.04, a + 1.06, a + 1.79, 1.61, 2.44, mat('canvas', '#e2c69c', rough=0.9)))
    if r == 2:   # study: bookshelf, desk
        x0 = -W / 2
        y0s, y1s = a + 0.8, a + 3.0
        parts.append(box('bs_back', x0, x0 + 0.02, y0s, y1s, 0, 2.5, wood_mid))
        parts.append(box('bs_s1', x0, x0 + 0.36, y0s, y0s + 0.04, 0, 2.5, wood_mid))
        parts.append(box('bs_s2', x0, x0 + 0.36, y1s - 0.04, y1s, 0, 2.5, wood_mid))
        parts.append(box('bs_top', x0, x0 + 0.38, y0s - 0.02, y1s + 0.02, 2.46, 2.52, wood_mid))
        palette = ['#1f3d30', '#6e1d22', '#1d2a4a', '#b0842c', '#e6dcc4', '#3b2a20']
        shelves = [0.08, 0.56, 1.04, 1.52, 2.0]
        for k, sz in enumerate(shelves):
            parts.append(box(f'bs_sh{k}', x0, x0 + 0.36, y0s, y1s, sz - 0.03, sz, wood_mid))
            yy = y0s + 0.06
            while yy < y1s - 0.12:
                tw = rng.uniform(0.025, 0.065)
                th = rng.uniform(0.2, 0.38)
                if rng.random() < 0.08:
                    yy += 0.1
                    continue
                c = palette[rng.randrange(len(palette))]
                bk = box(f'book_{k}_{yy:.3f}', x0 + 0.05, x0 + 0.05 + rng.uniform(0.2, 0.27), yy, yy + tw, sz, sz + th, mat('bk_' + c, c, rough=0.7))
                cull_facing(bk, [(2, -1), (0, -1)])   # bottoms and backs are never seen
                parts.append(bk)
                yy += tw + 0.003
        x1 = W / 2
        parts.append(box('desk_top', x1 - 0.8, x1 - 0.05, a + 1.0, a + 2.4, 0.74, 0.78, wood_mid))
        for lx in (x1 - 0.78, x1 - 0.1):
            for ly in (a + 1.02, a + 2.34):
                parts.append(box(f'dk_l{lx}{ly}', lx, lx + 0.04, ly, ly + 0.04, 0, 0.74, wood_mid))
        parts.append(box('desk_blot', x1 - 0.6, x1 - 0.2, a + 1.4, a + 1.9, 0.78, 0.785, mat('leather', '#163a2a', rough=0.6)))
    if r == 3:   # bedroom: curtains, rod, bench, round rug
        curtain = mat('curtain', '#b98494', rough=1.0)
        for sgn in (-1, 1):
            bm = bmesh.new()
            nx, nz = 28, 2
            xa, xb = (WW / 2 + 0.02, WW / 2 + 0.75)
            verts = []
            for j in range(nz + 1):
                row = []
                for i in range(nx + 1):
                    u = i / nx
                    x = sgn * (xa + (xb - xa) * u)
                    y = b - 0.08 - 0.045 * (1 + math.sin(u * math.pi * 7))
                    row.append(bm.verts.new((x, y, 0.04 + (3.08 - 0.04) * j / nz)))
                verts.append(row)
            for j in range(nz):
                for i in range(nx):
                    f = (verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i])
                    bm.faces.new(f if sgn > 0 else tuple(reversed(f)))
            bm.normal_update()
            for f in bm.faces:          # face into the room
                if f.normal.y > 0:
                    f.normal_flip()
            parts.append(new_obj(f'curtain{sgn}', bm, curtain))
        rod = cylinder('rod', 0, 0, -1.6, 1.6, 0.015, trim_brass, seg=12)
        rod.rotation_euler = (0, math.pi / 2, 0)
        rod.location = (0, b - 0.12, 3.14)
        parts.append(rod)
        rose = mat('velvet_rose', '#a86f82', rough=0.95)
        x1 = W / 2
        parts.append(box('bench', x1 - 0.95, x1 - 0.35, a + 1.3, a + 2.9, 0.36, 0.5, rose))
        for ly in (a + 1.34, a + 2.82):
            for lx in (x1 - 0.92, x1 - 0.42):
                parts.append(box(f'bn_l{lx}{ly}', lx, lx + 0.04, ly, ly + 0.04, 0, 0.36, wood_dark))
        rug = cylinder('rug3', bx, py, 0, 0.012, 1.45, mat('rug_bed', '#c3aecb', rough=1.0), seg=64)
        parts.append(rug)


    shell_names = {f'floor{r}', f'ceil{r}', f'wl{r}', f'wr{r}', f'front{r}', f'back{r}', f'pl{r}', f'plc{r}', f'plb{r}', 'rug1', 'rug3'}
    shell_parts = [p for p in parts if p.name in shell_names]
    detail_parts = [p for p in parts if p.name not in shell_names]
    shell = join(f'room_{r}', shell_parts)
    detail = join(f'detail_{r}', detail_parts)
    for o in (shell, detail):
        cull_hidden(o, a, b)
    room_objs += [shell, detail]
    meta['rooms'].append(dict(name=R['name'], bagX=bx, bagY=py, plinthTop=PLINTH_H, y0=ys, y1=ye, W=W, H=H))

# ── the street front ─────────────────────────────────────────
# One deep-green townhouse front: banded ground floor, pilasters, an entablature, lit sash windows,
# a brass lantern and a wet stone pavement. The door is the same 1.7 : 1.95 arch as the gate.
ext_wall = mat('ext_wall', '#2a6a53', rough=0.85)
ext_trim = mat('ext_trim', '#337a60', rough=0.75)
ext_base = mat('ext_base', '#215744', rough=0.85)
ext_sash = mat('ext_sash', '#3f8467', rough=0.6)
ext_stone = mat('ext_stone', '#46534c', rough=0.6)
ext_ground = mat('ext_ground', '#2b3a34', rough=0.4)
ext_glass = mat('ext_glass', '#0c2019', rough=0.15)
glow = mat('glow', '#f1d7a8', emission=(1.0, 0.78, 0.5), strength=3.2)
glow_dim = mat('glow_dim', '#e9cfa0', emission=(1.0, 0.74, 0.48), strength=1.1)
lamp_glass = mat('lamp', '#fff1d0', emission=(1.0, 0.84, 0.6), strength=40.0)
FX = 9.0
F0, F1 = -FT, 0.0
GF_WIN = [-6.1, -3.3, 3.3, 6.1]
UP_WIN = [-6.1, -3.3, 0.0, 3.3, 6.1]
WIN_W, WIN_Z0, WIN_Z1 = 1.3, 0.9, 3.0
UP_Z0, UP_Z1 = 4.55, 6.75
PIL_X = 1.55
ENT_Z = 3.5
TOP_Z = 7.8
LANTERN = (PIL_X, F0 - 0.5, 2.47)


def fbox(name, x0, x1, z0, z1, proud, material, back=F0):
    """A block standing proud of the facade face."""
    return box(name, x0, x1, back - proud, back, z0, z1, material)


def bands(name, z0, z1, proud, material, gaps=(), x0=-FX, x1=FX):
    xs = [x0]
    for g0, g1 in sorted(gaps):
        xs += [g0, g1]
    xs.append(x1)
    return [fbox(f'{name}_{i}', xs[i], xs[i + 1], z0, z1, proud, material) for i in range(0, len(xs), 2) if xs[i + 1] - xs[i] > 0.02]


ext_shell, ext_detail = [], []
facade = box('facade', -FX, FX, F0, F1, GROUND, TOP_Z, ext_wall)
apply_boolean(facade, prism('door_cut', arch_outline(DW, 0.0, DSPR, seg=40), F0 - 0.05, F1 + 0.05, ext_wall))
for wx in GF_WIN:
    apply_boolean(facade, box('wcut', wx - WIN_W / 2, wx + WIN_W / 2, F0 - 0.05, F0 + 0.22, WIN_Z0, WIN_Z1, ext_wall))
for wx in UP_WIN:
    apply_boolean(facade, box('ucut', wx - WIN_W / 2, wx + WIN_W / 2, F0 - 0.05, F0 + 0.22, UP_Z0, UP_Z1, ext_wall))
cull(facade, [(1, F1), (0, -FX), (0, FX), (2, GROUND), (2, TOP_Z)])
ext_shell.append(facade)
ground = quad('ground', [(-FX - 3, -18, GROUND), (FX + 3, -18, GROUND), (FX + 3, F0, GROUND), (-FX - 3, F0, GROUND)], ext_ground)
ext_shell.append(ground)
ext_shell.append(box('step', -1.25, 1.25, F0 - 0.5, F0, GROUND, GROUND + 0.15, ext_stone))
ext_shell += bands('base', GROUND, 0.5, 0.05, ext_base, [(-1.0, 1.0)])

# banded rustication between the base and the entablature
door_gap = (-1.02, 1.02)
pil_gaps = [(-PIL_X - 0.22, -PIL_X + 0.22), (PIL_X - 0.22, PIL_X + 0.22)]
course = (ENT_Z - 0.5) / 8
for k in range(8):
    z0, z1 = 0.5 + k * course + 0.018, 0.5 + (k + 1) * course - 0.018
    gaps = [door_gap] + pil_gaps
    if z1 > WIN_Z0 - 0.04:
        gaps += [(wx - WIN_W / 2 - 0.15, wx + WIN_W / 2 + 0.15) for wx in GF_WIN]
    ext_detail += bands(f'rust{k}', z0, z1, 0.025, ext_wall, gaps)

# pilasters either side of the door
for px in (-PIL_X, PIL_X):
    ext_detail.append(fbox('pil_ped', px - 0.27, px + 0.27, 0.5, 0.62, 0.17, ext_trim))
    ext_detail.append(fbox('pil_shaft', px - 0.2, px + 0.2, 0.62, 3.22, 0.12, ext_trim))
    for dx in (-0.1, 0.0, 0.1):
        ext_detail.append(fbox('pil_flute', px + dx - 0.012, px + dx + 0.012, 0.78, 3.08, 0.135, ext_trim))
    ext_detail.append(fbox('pil_neck', px - 0.22, px + 0.22, 3.22, 3.3, 0.14, ext_trim))
    ext_detail.append(fbox('pil_cap', px - 0.28, px + 0.28, 3.3, 3.5, 0.19, ext_trim))
    ext_detail.append(fbox('pil_plinth', px - 0.27, px + 0.27, GROUND, 0.5, 0.17, ext_base))

# the door: moulded architrave, brass bead on the opening edge, keystone, brass threshold
ext_detail.append(arch_ring('door_arch', F0, -1, DW, DSPR, 0.15, 0.05, ext_trim))
ext_detail.append(arch_ring('door_bead', F0 - 0.05, -1, DW, DSPR, 0.022, 0.016, trim_brass))
ext_detail.append(fbox('keystone', -0.13, 0.13, 2.7, 3.24, 0.09, ext_trim))
ext_detail.append(box('threshold', -DW / 2, DW / 2, F0, F0 + 0.08, 0.0, 0.008, trim_brass))

# entablature over the ground floor, cornice at the top
for z0, z1, proud in ((ENT_Z, 3.62, 0.06), (3.62, 3.82, 0.03), (3.82, 3.9, 0.13), (3.9, 3.97, 0.24), (3.97, 4.06, 0.34)):
    ext_detail.append(fbox('entab', -FX, FX, z0, z1, proud, ext_trim))
for z0, z1, proud in ((7.32, 7.42, 0.1), (7.42, 7.55, 0.22), (7.55, TOP_Z, 0.36)):
    ext_detail.append(fbox('cornice', -FX, FX, z0, z1, proud, ext_trim))


def sash(name, wx, z0, z1, glass):
    """Recessed sash window: glass at the back of the reveal, frame, meeting rail and glazing bars."""
    xa, xb = wx - WIN_W / 2, wx + WIN_W / 2
    gy = F0 + 0.21
    out = [quad(name + '_glass', [(xa, gy, z0), (xb, gy, z0), (xb, gy, z1), (xa, gy, z1)], glass)]
    fy0, fy1 = gy - 0.06, gy - 0.005
    out += [box(name + '_fl', xa, xa + 0.07, fy0, fy1, z0, z1, ext_sash), box(name + '_fr', xb - 0.07, xb, fy0, fy1, z0, z1, ext_sash),
            box(name + '_fb', xa, xb, fy0, fy1, z0, z0 + 0.08, ext_sash), box(name + '_ft', xa, xb, fy0, fy1, z1 - 0.07, z1, ext_sash)]
    mid = z0 + (z1 - z0) * 0.5
    out.append(box(name + '_mr', xa, xb, fy0 - 0.02, fy1, mid - 0.035, mid + 0.035, ext_sash))
    for f in (1 / 3, 2 / 3):
        x = xa + WIN_W * f
        out.append(box(name + '_mv', x - 0.013, x + 0.013, fy0 + 0.01, fy1, z0, z1, ext_sash))
    for zz in ((z0 + mid) / 2, (mid + z1) / 2):
        out.append(box(name + '_mh', xa, xb, fy0 + 0.01, fy1, zz - 0.013, zz + 0.013, ext_sash))
    # architrave and sill on the wall face
    out += [fbox(name + '_al', xa - 0.13, xa, z0, z1 + 0.13, 0.04, ext_trim), fbox(name + '_ar', xb, xb + 0.13, z0, z1 + 0.13, 0.04, ext_trim),
            fbox(name + '_at', xa - 0.13, xb + 0.13, z1, z1 + 0.13, 0.04, ext_trim)]
    out.append(box(name + '_sill', xa - 0.2, xb + 0.2, F0 - 0.12, gy, z0 - 0.08, z0, ext_trim))
    return out


for wx in GF_WIN:
    ext_detail += sash(f'gw{wx}', wx, WIN_Z0, WIN_Z1, glow if abs(wx) < 4 else ext_glass)
    ext_detail.append(fbox(f'gwk{wx}', wx - 0.1, wx + 0.1, WIN_Z1 - 0.04, WIN_Z1 + 0.24, 0.07, ext_trim))
for wx in UP_WIN:
    ext_detail += sash(f'uw{wx}', wx, UP_Z0, UP_Z1, glow_dim if wx == -3.3 else ext_glass)
    ext_detail.append(fbox(f'uwh{wx}', wx - WIN_W / 2 - 0.24, wx + WIN_W / 2 + 0.24, UP_Z1 + 0.14, UP_Z1 + 0.26, 0.16, ext_trim))

# brass lantern on the right pilaster
lx, ly, lz = LANTERN
ext_detail.append(box('lan_plate', lx - 0.06, lx + 0.06, F0 - 0.15, F0 - 0.12, 2.55, 2.95, trim_brass))
ext_detail.append(box('lan_arm', lx - 0.015, lx + 0.015, ly, F0 - 0.15, 2.84, 2.87, trim_brass))
ext_detail.append(box('lan_brace', lx - 0.012, lx + 0.012, F0 - 0.3, F0 - 0.15, 2.62, 2.86, trim_brass))
ext_detail.append(box('lan_finial', lx - 0.02, lx + 0.02, ly - 0.02, ly + 0.02, 2.72, 2.84, trim_brass))
ext_detail.append(box('lan_cap', lx - 0.125, lx + 0.125, ly - 0.125, ly + 0.125, 2.66, 2.72, trim_brass))
ext_detail.append(box('lan_glass', lx - 0.09, lx + 0.09, ly - 0.09, ly + 0.09, 2.3, 2.66, lamp_glass))
for cx in (-1, 1):
    for cy in (-1, 1):
        ext_detail.append(box('lan_post', lx + cx * 0.095 - 0.012, lx + cx * 0.095 + 0.012, ly + cy * 0.095 - 0.012, ly + cy * 0.095 + 0.012, 2.27, 2.67, trim_brass))
ext_detail.append(box('lan_base', lx - 0.11, lx + 0.11, ly - 0.11, ly + 0.11, 2.25, 2.3, trim_brass))

exterior = [join('ext_shell', ext_shell), join('ext_detail', ext_detail)]
for o in exterior:
    bm = bmesh.new()
    bm.from_mesh(o.data)
    dead = [f for f in bm.faces if (f.normal.y > 0.9 and all(abs(v.co.y - F0) < 1e-3 for v in f.verts))
            or (f.normal.z < -0.9 and all(abs(v.co.z - GROUND) < 1e-3 for v in f.verts))]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(o.data)
    bm.free()
room_objs += exterior
meta['facade'] = dict(F0=F0, FX=FX, lantern=LANTERN, windows=[[wx, WIN_Z0, WIN_Z1] for wx in GF_WIN if abs(wx) < 4], pilasterX=PIL_X)

# bedroom night sky (light source only; three.js draws its own sky)
sky = quad('sky', [(-5, LENGTH + 1.6, -1), (5, LENGTH + 1.6, -1), (5, LENGTH + 1.6, 7), (-5, LENGTH + 1.6, 7)],
           mat('sky', '#1b2448', emission=(0.18, 0.24, 0.55), strength=1.6))

# ── lights ───────────────────────────────────────────────────
world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.04, 0.045, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

for r, R in enumerate(ROOMS):
    py = Y0[r] + T / 2 + PLINTH_Y
    ld = bpy.data.lights.new(f'lamp{r}', 'POINT')
    ld.energy = R['power']
    ld.color = R['light']
    ld.shadow_soft_size = 0.08
    lo = bpy.data.objects.new(f'lamp{r}', ld)
    lo.location = (R['bx'], py, LAMP_Z - 0.09)
    coll.objects.link(lo)
    # soft ceiling fill, standing in for the light that would come from other lamps in a real house
    fd = bpy.data.lights.new(f'fill{r}', 'AREA')
    fd.energy = 70
    fd.size = 2.5
    fd.color = R['light']
    fo = bpy.data.objects.new(f'fill{r}', fd)
    fo.location = (0, Y0[r] + R['D'] * 0.45, min(R['H'], 3.4) - 0.25)
    coll.objects.link(fo)

lan = bpy.data.lights.new('lantern', 'POINT')
lan.energy = 38
lan.color = (1.0, 0.8, 0.55)
lan.shadow_soft_size = 0.05
lo = bpy.data.objects.new('lantern', lan)
lo.location = LANTERN
coll.objects.link(lo)
street = bpy.data.lights.new('street', 'AREA')
street.shape = 'RECTANGLE'
street.size, street.size_y = 16, 6
street.energy = 420
street.color = (0.7, 0.86, 1.0)
so = bpy.data.objects.new('street', street)
so.location = (-2, -16, 6.5)
so.rotation_euler = (math.radians(76), 0, 0)
coll.objects.link(so)

moon = bpy.data.lights.new('moon', 'SUN')
moon.energy = 2.2
moon.color = (0.72, 0.8, 1.0)
moon.angle = math.radians(2.5)
mo = bpy.data.objects.new('moon', moon)
mo.rotation_euler = (math.radians(-62), 0, math.radians(-8))
coll.objects.link(mo)

# ── render settings ──────────────────────────────────────────
scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU setup failed, using CPU:', e)
scene.view_settings.view_transform = 'Standard'
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4


def world_uvs(ob):
    """UV0 in metres, projected along each face's dominant axis (drives tiling floor patterns in three.js)."""
    me = ob.data
    while len(me.uv_layers):
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UVMap')
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            c = lp.vert.co
            lp[uv].uv = (c.x, c.y) if ax == 2 else ((c.y, c.z) if ax == 0 else (c.x, c.z))
    bm.to_mesh(me)
    bm.free()
    lm = me.uv_layers.new(name='Lightmap')
    me.uv_layers.active = lm
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    except Exception as e:
        print('pack_islands failed:', e)
    bpy.ops.object.mode_set(mode='OBJECT')


if STAGE == 'preview':
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 960, 600
    scene.view_settings.view_transform = 'AgX'
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 22
    cam = bpy.data.objects.new('cam', cam_d)
    coll.objects.link(cam)
    scene.camera = cam
    for o in proxies:
        o.hide_render = True
    sky.hide_render = False
    shots = [('outside', (0.0, -5.2, 1.45)), ('outside_wide', (-1.2, -8.5, 1.45))] + [(R['name'], (R['bx'], Y0[r] + T / 2 + PLINTH_Y - 2.6, 1.45)) for r, R in enumerate(ROOMS)]
    for name, loc in shots:
        cam.location = loc
        cam.rotation_euler = (math.radians(90), 0, 0)
        cam_d.lens = 30 if name.startswith('outside') else 22
        cam_d.shift_y = 0.18 if name.startswith('outside') else 0.0
        scene.render.filepath = os.path.join(SCRATCH, f'preview_{name}.jpg')
        scene.render.image_settings.file_format = 'JPEG'
        bpy.ops.render.render(write_still=True)
    sys.exit(0)

# ── bake ─────────────────────────────────────────────────────
os.makedirs(OUT, exist_ok=True)
scene.cycles.samples = SAMPLES
scene.render.bake.margin = 12
for o in room_objs:
    world_uvs(o)

stats = []
TAGS = {'ext_shell': 'x', 'ext_detail': 'xd'}
for ob in room_objs:
    kind, r = ob.name.split('_')
    res = RES // 2 if kind == 'detail' else RES
    tag = TAGS.get(ob.name) or (f'{r}' if kind == 'room' else f'd{r}')
    img = bpy.data.images.new(f'lm_{tag}', res, res, float_buffer=True, alpha=False)
    for m in ob.data.materials:
        nt = m.node_tree
        node = nt.nodes.get('BakeTarget') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'BakeTarget'
        node.image = img
        nt.nodes.active = node
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, use_clear=True, margin=12)
    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    arr = px.reshape(res, res, 4)[::-1, :, :3]    # top row first
    np.save(os.path.join(SCRATCH, f'lm_{tag}.npy'), arr.astype(np.float16))
    print(f'baked {ob.name}', flush=True)

# export: rooms only (no proxies, sky, lights)
for o in proxies:
    bpy.data.objects.remove(o)
bpy.data.objects.remove(sky)
for o in list(scene.objects):
    o.select_set(o in room_objs)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SCRATCH, 'house_baked.blend'))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'house.glb'), export_format='GLB', use_selection=True,
    export_apply=True, export_normals=False, export_materials='EXPORT', export_yup=True,
    export_lights=False, export_cameras=False, export_image_format='NONE')
meta['bakeP995'] = stats
with open(os.path.join(SCRATCH, 'house_meta.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('DONE', flush=True)
