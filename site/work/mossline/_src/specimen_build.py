# Mossline v3 · builds the floating soil specimen in Blender 5.2 (Cycles) and saves specimen.blend.
#   /opt/homebrew/bin/blender -b --factory-startup -P specimen_build.py
# Everything is procedural and original: no downloaded textures or models.
# Units are metres. Specimen-local frame: turf surface at z = 0, clean cut face is the plane x = XCUT (normal +X).
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, Euler, noise
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

HERE = os.path.dirname(os.path.abspath(__file__))
XCUT = 0.20
PROBE_Y = -0.02
R = random.Random(8)


# ------------------------------------------------------------------ helpers
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexc(h, k=1.0):
    h = h.lstrip('#')
    return tuple(min(1.0, lin(int(h[i:i + 2], 16) / 255) * k) for i in (0, 2, 4)) + (1.0,)

def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def fbm(p, oct=4, basis='PERLIN_NEW'):
    return noise.fractal(p, 0.6, 2.0, oct, noise_basis=basis)

def link_to(ob, coll):
    coll.objects.link(ob)
    return ob

def new_obj(name, me, coll, parent=None):
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob

def mesh_from(name, verts, faces, uvs=None, pattrs=None, mat_idx=None, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    for name_, vals in (pattrs or {}).items():
        a = me.attributes.new(name_, 'FLOAT', 'POINT')
        a.data.foreach_set('value', vals)
    if mat_idx is not None:
        me.polygons.foreach_set('material_index', mat_idx)
    me.validate()
    if smooth_shade:
        me.shade_smooth()
    me.update()
    return me

def evaluated_copy(ob, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.name = name
    return me


class Builder:
    """Accumulates vertices/faces/uvs/attributes for one asset mesh."""
    def __init__(self):
        self.v, self.f, self.uv, self.mi, self.a = [], [], [], [], {}

    def add(self, verts, faces, uvs=None, mat=0, attrs=None):
        base = len(self.v)
        self.v += verts
        self.uv += uvs if uvs else [(0, 0)] * len(verts)
        for k in set(list(self.a.keys()) + list((attrs or {}).keys())):
            arr = self.a.setdefault(k, [0.0] * base)
            vals = (attrs or {}).get(k)
            if vals is None:
                arr += [0.0] * len(verts)
            elif isinstance(vals, (int, float)):
                arr += [float(vals)] * len(verts)
            else:
                arr += list(vals)
        for f in faces:
            self.f.append(tuple(i + base for i in f))
            self.mi.append(mat)

    def mesh(self, name):
        return mesh_from(name, self.v, self.f, self.uv, self.a, self.mi)


def frame_along(path):
    """Tangents and a stable side vector along a polyline."""
    tans = []
    for i in range(len(path)):
        a = path[max(0, i - 1)]; b = path[min(len(path) - 1, i + 1)]
        t = (b - a)
        tans.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    return tans

def tube(path, radii, sides=6, cap=True):
    tans = frame_along(path)
    ref = Vector((0.31, 0.77, 0.55)).normalized()
    verts, faces, uvs = [], [], []
    side = None
    for i, (p, r, t) in enumerate(zip(path, radii, tans)):
        if side is None:
            side = t.cross(ref).normalized()
        side = (side - t * side.dot(t)).normalized()  # parallel transport-ish
        up = t.cross(side)
        for k in range(sides):
            a = 2 * math.pi * k / sides
            verts.append(p + (side * math.cos(a) + up * math.sin(a)) * r)
            uvs.append((k / sides, i / (len(path) - 1)))
    n = len(path)
    for i in range(n - 1):
        for k in range(sides):
            a = i * sides + k; b = i * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if cap:
        verts.append(path[-1] + tans[-1] * radii[-1] * 0.6); uvs.append((0.5, 1))
        tip = len(verts) - 1
        for k in range(sides):
            a = (n - 1) * sides + k; b = (n - 1) * sides + (k + 1) % sides
            faces.append((a, b, tip))
    return verts, faces, uvs

def ribbon(path, widths, normals, cols=3, fold=0.25, cup=0.0):
    """A leaf/blade strip. u across (-1..1), v along (0..1). normals = surface up per row."""
    tans = frame_along(path)
    verts, faces, uvs = [], [], []
    n = len(path)
    for i, (p, w, nr, t) in enumerate(zip(path, widths, normals, tans)):
        side = t.cross(nr).normalized()
        up = side.cross(t).normalized()
        for j in range(cols):
            u = -1 + 2 * j / (cols - 1)
            verts.append(p + side * (u * w) + up * (abs(u) * w * fold + u * u * w * cup))
            uvs.append((0.5 + 0.5 * u, i / (n - 1)))
    for i in range(n - 1):
        for j in range(cols - 1):
            a = i * cols + j
            faces.append((a, a + 1, a + cols + 1, a + cols))
    return verts, faces, uvs

def arc_path(start, direction, length, steps, droop=0.0, curl=None, wobble=0.0, seed=0):
    rr = random.Random(seed)
    pts = [Vector(start)]
    d = Vector(direction).normalized()
    seg = length / steps
    ph = Vector((rr.random() * 10, rr.random() * 10, rr.random() * 10))
    for i in range(steps):
        t = (i + 1) / steps
        d = (d + Vector((0, 0, -droop * seg * 40 * t))).normalized()
        if curl is not None:
            d = (d + Vector(curl) * seg * 30).normalized()
        if wobble:
            d = (d + noise.noise_vector(ph + Vector((t * 3, 0, 0))) * wobble).normalized()
        pts.append(pts[-1] + d * seg)
    return pts


# ------------------------------------------------------------------ scene setup
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'Specimen'
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    c = sc.cycles
    c.samples = 112
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.015
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.max_bounces = 8; c.diffuse_bounces = 3; c.glossy_bounces = 3
    c.transmission_bounces = 6; c.transparent_max_bounces = 12; c.volume_bounces = 0
    c.caustics_reflective = False; c.caustics_refractive = False
    c.sample_clamp_indirect = 6.0
    c.dicing_rate = 1.0
    c.offscreen_dicing_scale = 6.0
    c.blur_glossy = 0.5
    sc.render.film_transparent = True
    sc.render.use_persistent_data = True
    sc.render.fps = 30
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    return sc


# ------------------------------------------------------------------ shader DSL
class SN:
    def __init__(self, name):
        self.mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new('ShaderNodeOutputMaterial')
        self.x = 0

    def n(self, idn, **kw):
        node = self.nt.nodes.new(idn)
        for k, v in kw.items():
            setattr(node, k, v)
        self.x += 1
        node.location = (self.x * 40 % 2000, -(self.x * 40 // 2000) * 300)
        return node

    def L(self, a, b):
        self.nt.links.new(a, b)

    def put(self, sock, v):
        if v is None:
            return
        if hasattr(v, 'is_output') or isinstance(v, bpy.types.NodeSocket):
            self.L(v, sock)
        else:
            sock.default_value = v

    def sock(self, node, name, kind=None, out=False):
        socks = node.outputs if out else node.inputs
        for s in socks:
            if s.name == name and s.enabled and (kind is None or s.type == kind):
                return s
        raise KeyError(name)

    def coord(self, kind='Object'):
        if not hasattr(self, '_tc'):
            self._tc = self.n('ShaderNodeTexCoord')
        return self._tc.outputs[kind]

    def attr(self, name, kind='GEOMETRY', out='Fac'):
        a = self.n('ShaderNodeAttribute', attribute_name=name, attribute_type=kind)
        return a.outputs[out]

    def math(self, op, a, b=None, clamp=False):
        m = self.n('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.put(m.inputs[0], a)
        if b is not None:
            self.put(m.inputs[1], b)
        return m.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        m = self.n('ShaderNodeVectorMath', operation=op)
        self.put(m.inputs[0], a)
        if b is not None:
            self.put(m.inputs[1], b)
        if scale is not None:
            self.put(m.inputs[3], scale)
        return m.outputs[0] if op not in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else m.outputs[1]

    def noise(self, vec, scale, detail=4.0, rough=0.55, dist=0.0, out='Fac', dim='3D', w=None):
        t = self.n('ShaderNodeTexNoise', noise_dimensions=dim)
        self.put(t.inputs['Vector'], vec)
        if w is not None:
            self.put(t.inputs['W'], w)
        t.inputs['Scale'].default_value = scale
        t.inputs['Detail'].default_value = detail
        t.inputs['Roughness'].default_value = rough
        t.inputs['Distortion'].default_value = dist
        return t.outputs[out]

    def voronoi(self, vec, scale, feature='F1', out='Distance', rand=1.0, metric='EUCLIDEAN'):
        t = self.n('ShaderNodeTexVoronoi', feature=feature, distance=metric)
        self.put(t.inputs['Vector'], vec)
        t.inputs['Scale'].default_value = scale
        t.inputs['Randomness'].default_value = rand
        return t.outputs[out]

    def wave(self, vec, scale, dist=0.0, kind='BANDS', direction='X', profile='SIN', detail=2.0):
        t = self.n('ShaderNodeTexWave', wave_type=kind, bands_direction=direction, wave_profile=profile)
        self.put(t.inputs['Vector'], vec)
        t.inputs['Scale'].default_value = scale
        t.inputs['Distortion'].default_value = dist
        t.inputs['Detail'].default_value = detail
        return t.outputs['Fac']

    def ramp(self, fac, stops, interp='LINEAR'):
        r = self.n('ShaderNodeValToRGB')
        r.color_ramp.interpolation = interp
        els = r.color_ramp.elements
        while len(els) > 2:
            els.remove(els[-1])
        for i, (pos, col) in enumerate(stops):
            e = els[i] if i < 2 else els.new(pos)
            e.position = pos
            e.color = col if len(col) == 4 else tuple(col) + (1.0,)
        self.put(r.inputs['Fac'], fac)
        return r.outputs['Color']

    def mapr(self, v, a, b, c=0.0, d=1.0, interp='LINEAR', clamp=True):
        m = self.n('ShaderNodeMapRange', interpolation_type=interp, clamp=clamp)
        ins = [s for s in m.inputs if s.type == 'VALUE' and s.enabled]
        self.put(ins[0], v); self.put(ins[1], a); self.put(ins[2], b); self.put(ins[3], c); self.put(ins[4], d)
        return m.outputs['Result']

    def mix(self, fac, a, b, blend='MIX', clamp=True):
        m = self.n('ShaderNodeMix', data_type='RGBA', blend_type=blend, clamp_result=clamp)
        self.put(m.inputs[0], fac)
        self.put(self.sock(m, 'A', 'RGBA'), a)
        self.put(self.sock(m, 'B', 'RGBA'), b)
        return self.sock(m, 'Result', 'RGBA', out=True)

    def hsv(self, col, h=0.5, s=1.0, v=1.0):
        m = self.n('ShaderNodeHueSaturation')
        self.put(m.inputs['Hue'], h); self.put(m.inputs['Saturation'], s)
        self.put(m.inputs['Value'], v); self.put(m.inputs['Color'], col)
        return m.outputs['Color']

    def bump(self, height, strength=0.4, dist=0.001, normal=None):
        b = self.n('ShaderNodeBump')
        b.inputs['Strength'].default_value = strength
        b.inputs['Distance'].default_value = dist
        self.put(b.inputs['Height'], height)
        if normal is not None:
            self.put(b.inputs['Normal'], normal)
        return b.outputs['Normal']

    def principled(self, **kw):
        p = self.n('ShaderNodeBsdfPrincipled')
        for k, v in kw.items():
            self.put(p.inputs[k.replace('_', ' ')], v)
        return p

    def mixs(self, fac, a, b):
        m = self.n('ShaderNodeMixShader')
        self.put(m.inputs[0], fac)
        self.L(a, m.inputs[1]); self.L(b, m.inputs[2])
        return m.outputs[0]

    def output(self, shader, disp=None):
        self.L(shader, self.out.inputs['Surface'])
        if disp is not None:
            self.L(disp, self.out.inputs['Displacement'])

    def displacement(self, height, scale, mid=0.5):
        d = self.n('ShaderNodeDisplacement', space='OBJECT')
        self.put(d.inputs['Height'], height)
        d.inputs['Midlevel'].default_value = mid
        d.inputs['Scale'].default_value = scale
        return d.outputs['Displacement']


# ------------------------------------------------------------------ materials
def soil_horizon_colour(s, z):
    """Shared horizon colour ramp from a local-z socket. Returns colour socket + humus/sub masks."""
    co = s.coord('Object')
    zw = s.math('ADD', z, s.math('MULTIPLY', s.math('SUBTRACT', s.noise(co, 16, 3), 0.5), 0.022))
    zw = s.math('ADD', zw, s.math('MULTIPLY', s.math('SUBTRACT', s.noise(co, 3.5, 2), 0.5), 0.03))
    humus = s.mapr(zw, -0.085, -0.045, 0, 1, 'SMOOTHSTEP')
    top = s.mapr(zw, -0.255, -0.185, 0, 1, 'SMOOTHSTEP')
    col = s.mix(top, hexc('#5c4936', 1.05), hexc('#3a2c20', 1.0))
    col = s.mix(humus, col, hexc('#1e1610', 1.2))
    return col, humus, top, zw


def mat_soil():
    s = SN('M_Soil')
    co = s.coord('Object')
    sep = s.n('ShaderNodeSeparateXYZ'); s.L(co, sep.inputs[0])
    z = sep.outputs['Z']
    col, humus, top, zw = soil_horizon_colour(s, z)
    turf = s.attr('turf'); face = s.attr('cutface')
    # large-scale tonal variation and mottling in the subsoil
    big = s.noise(co, 7, 3)
    col = s.mix(s.mapr(big, 0.3, 0.7, 0, 1), s.hsv(col, v=0.82), s.hsv(col, v=1.15))
    mott = s.mapr(s.noise(co, 38, 4, 0.6, 0.4), 0.58, 0.68, 0, 1)
    mott = s.math('MULTIPLY', mott, s.math('SUBTRACT', 1, top))
    col = s.mix(s.math('MULTIPLY', mott, 0.7), col, hexc('#8a5428'))
    grey = s.math('MULTIPLY', s.mapr(s.noise(co, 22, 3, 0.6, 1.0), 0.62, 0.7, 0, 1), s.math('SUBTRACT', 1, top))
    col = s.mix(s.math('MULTIPLY', grey, 0.4), col, hexc('#6d685a'))
    # crumb aggregates: two voronoi scales, cracks darken and recess
    warp = s.vmath('ADD', co, s.vmath('SCALE', s.vmath('SUBTRACT', s.noise(co, 45, 2, out='Color'), (0.5, 0.5, 0.5)), scale=0.012))
    e1 = s.voronoi(warp, 230, 'DISTANCE_TO_EDGE')
    e2 = s.voronoi(warp, 75, 'DISTANCE_TO_EDGE')
    # crumb size varies across the face: blend fine and coarse crumbs by a low-frequency mask
    csz = s.mapr(s.noise(co, 5, 2), 0.35, 0.65, 0, 1, 'SMOOTHSTEP')
    fa = s.voronoi(warp, 320, 'F1'); fb = s.voronoi(warp, 140, 'F1')
    f1 = s.math('ADD', s.math('MULTIPLY', fa, s.math('SUBTRACT', 1, csz)), s.math('MULTIPLY', fb, csz))
    crack1 = s.mapr(e1, 0.0, 0.09, 1, 0, 'SMOOTHSTEP')
    crack2 = s.mapr(e2, 0.0, 0.05, 1, 0, 'SMOOTHSTEP')
    crack = s.math('MAXIMUM', s.math('MULTIPLY', crack1, 0.75), crack2)
    smear = s.mapr(s.noise(co, 11, 3), 0.42, 0.6, 0, 1, 'SMOOTHSTEP')
    crack = s.math('MULTIPLY', crack, s.mapr(smear, 0, 1, 1.0, 0.35))
    crack = s.math('MULTIPLY', crack, s.mapr(face, 0, 1, 1.0, 0.25))
    col = s.mix(s.math('MULTIPLY', crack, 0.4), col, s.hsv(col, v=0.45))
    dome = s.mapr(f1, 0.0, 0.6, 1, 0, 'SMOOTHSTEP')
    # pores
    pf = s.voronoi(co, 520, 'F1', out='Distance')
    prand = s.voronoi(co, 520, 'F1', out='Color')
    sepc = s.n('ShaderNodeSeparateColor'); s.L(prand, sepc.inputs[0])
    pore = s.math('MULTIPLY', s.mapr(pf, 0.16, 0.1, 0, 1), s.mapr(sepc.outputs[0], 0.94, 0.96, 0, 1))
    col = s.mix(pore, col, s.hsv(col, v=0.18))
    # mineral grains (bright) in topsoil/subsoil and dark organic flecks in humus
    gf = s.voronoi(co, 1500, 'F1')
    gc = s.voronoi(co, 1500, 'F1', out='Color')
    sg = s.n('ShaderNodeSeparateColor'); s.L(gc, sg.inputs[0])
    grain = s.math('MULTIPLY', s.mapr(gf, 0.3, 0.18, 0, 1), s.mapr(sg.outputs[1], 0.9, 0.93, 0, 1))
    grain = s.math('MULTIPLY', grain, s.math('SUBTRACT', 1, s.math('MULTIPLY', humus, 0.8)))
    col = s.mix(grain, col, hexc('#b7a68a'))
    # mycelium threads in the humus band: thin voronoi edges in a noise mask
    mw = s.vmath('ADD', co, s.vmath('SCALE', s.noise(co, 40, 3, out='Color'), scale=0.02))
    myc_e = s.voronoi(mw, 55, 'DISTANCE_TO_EDGE')
    myc = s.mapr(myc_e, 0.0, 0.012, 1, 0, 'SMOOTHSTEP')
    mmask = s.mapr(s.noise(co, 9, 2), 0.56, 0.66, 0, 1)
    band = s.math('MULTIPLY', s.mapr(zw, -0.16, -0.11, 0, 1, 'SMOOTHSTEP'), s.mapr(zw, -0.015, -0.03, 0, 1, 'SMOOTHSTEP'))
    myc = s.math('MULTIPLY', s.math('MULTIPLY', myc, mmask), band)
    col = s.mix(s.math('MULTIPLY', myc, 0.85), col, hexc('#d9d3c3'))
    # turf mat: dark peaty brown-green under the moss
    col = s.mix(turf, col, hexc('#1c1a0c'))
    rough = s.mapr(humus, 0, 1, 0.93, 0.78)
    rough = s.math('MINIMUM', rough, s.mapr(grain, 0, 1, 1.0, 0.45))
    warp2 = s.vmath('ADD', co, s.vmath('SCALE', s.vmath('SUBTRACT', s.noise(co, 9, 3, out='Color'), (0.5, 0.5, 0.5)), scale=0.05))
    e3 = s.voronoi(warp2, 22, 'DISTANCE_TO_EDGE')
    fiss_mask = s.math('MULTIPLY', s.mapr(s.noise(co, 6, 2), 0.62, 0.72, 0, 1, 'SMOOTHSTEP'), s.math('SUBTRACT', 1, face))
    clod = s.math('SUBTRACT', 1, s.math('MULTIPLY', s.mapr(e3, 0.0, 0.07, 1, 0, 'SMOOTHSTEP'), fiss_mask))
    col = s.mix(s.math('MULTIPLY', s.math('SUBTRACT', 1, clod), 0.2), col, s.hsv(col, v=0.45))
    height = s.math('ADD', s.math('MULTIPLY', s.math('MULTIPLY', dome, s.mapr(smear, 0, 1, 0.5, 0.2)), s.mapr(face, 0, 1, 1.0, 0.8)),
                    s.math('MULTIPLY', s.math('SUBTRACT', 1, crack), 0.5))
    height = s.math('ADD', height, s.math('MULTIPLY', clod, 0.35))
    height = s.math('ADD', height, s.math('MULTIPLY', s.noise(co, 420, 3), 0.25))
    height = s.math('SUBTRACT', height, s.math('MULTIPLY', pore, 0.8))
    height = s.math('ADD', height, s.math('MULTIPLY', myc, 0.25))
    amt = s.math('MULTIPLY', s.math('SUBTRACT', 1, turf), s.mapr(face, 0, 1, 1.6, 1.0))
    disp = s.displacement(s.math('MULTIPLY', height, amt), 0.0032, 0.45)
    nb = s.bump(s.noise(co, 900, 2), 0.25, 0.0004)
    p = s.principled(Base_Color=col, Roughness=rough, Normal=nb)
    p.inputs['Specular IOR Level'].default_value = 0.22
    s.output(p.outputs[0], disp)
    s.mat.displacement_method = 'BOTH'

    # burrow lining: smoother, darker cast-lined channel
    b = SN('M_Burrow')
    co = b.coord('Object')
    c = b.mix(b.mapr(b.noise(co, 120, 4), 0.3, 0.7), hexc('#1a120b', 1.2), hexc('#2f2216', 1.2))
    pb = b.principled(Base_Color=c, Roughness=0.62, Normal=b.bump(b.noise(co, 300, 3), 0.5, 0.0008))
    pb.inputs['Specular IOR Level'].default_value = 0.45
    b.output(pb.outputs[0])
    return s.mat, b.mat


def mat_crumb():
    s = SN('M_Crumb')
    hz = s.attr('hz', 'INSTANCER')
    col, humus, top, zw = soil_horizon_colour(s, hz)
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    col = s.hsv(col, v=s.mapr(rnd, 0, 1, 0.7, 1.25))
    co = s.coord('Object')
    col = s.mix(s.mapr(s.noise(co, 3, 3), 0.55, 0.75), col, s.hsv(col, v=0.5))
    p = s.principled(Base_Color=col, Roughness=0.9, Normal=s.bump(s.noise(co, 9, 4), 0.6, 0.0003))
    p.inputs['Specular IOR Level'].default_value = 0.3
    s.output(p.outputs[0])
    return s.mat


def mat_pebble():
    s = SN('M_Pebble')
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    base = s.ramp(rnd, [(0.0, hexc('#6e695e')), (0.3, hexc('#7d6c52')), (0.55, hexc('#55524a')),
                        (0.8, hexc('#8f8676')), (0.94, hexc('#bdb6a4')), (1.0, hexc('#5e4733'))], 'CONSTANT')
    co = s.coord('Object')
    col = s.mix(s.mapr(s.noise(co, 2.2, 5, 0.6), 0.3, 0.7), s.hsv(base, v=0.75), s.hsv(base, v=1.15))
    dirt = s.mapr(s.noise(co, 1.6, 3), 0.3, 0.75)
    col = s.mix(s.math('MULTIPLY', dirt, 0.7), col, hexc('#3a2a1a'))
    p = s.principled(Base_Color=col, Roughness=s.mapr(dirt, 0, 1, 0.45, 0.9),
                     Normal=s.bump(s.noise(co, 14, 5), 0.35, 0.0002))
    s.output(p.outputs[0])
    return s.mat


def mat_stone():
    s = SN('M_Stone')
    co = s.coord('Object')
    cav = s.attr('cavity'); strata = s.attr('strata'); mossm = s.attr('mossmask')
    sep = s.n('ShaderNodeSeparateXYZ'); s.L(co, sep.inputs[0])
    z = sep.outputs['Z']
    # bedding bands of ochre, buff and warm grey
    sband = s.math('ADD', strata, s.math('MULTIPLY', s.noise(co, 9, 3), 0.9))
    bands = s.ramp(s.math('FRACT', s.math('MULTIPLY', sband, 0.23)),
                   [(0.0, hexc('#7d6a40')), (0.18, hexc('#94825a')), (0.34, hexc('#6b6a5e')),
                    (0.52, hexc('#8a713f')), (0.7, hexc('#a09068')), (0.86, hexc('#5e5a4f')), (1.0, hexc('#7d6a40'))])
    patch = s.mapr(s.noise(co, 4.5, 4, 0.55), 0.35, 0.65)
    col = s.mix(s.math('MULTIPLY', patch, 0.55), bands, hexc('#6e6c62'))
    # each bed gets its own tone (beds differ in grain and iron content)
    bed = s.n('ShaderNodeTexWhiteNoise', noise_dimensions='1D')
    s.L(s.math('FLOOR', s.math('ADD', strata, s.math('MULTIPLY', s.noise(co, 14, 2), 0.25))), bed.inputs['W'])
    col = s.hsv(col, h=s.mapr(bed.outputs['Value'], 0, 1, 0.485, 0.52), s=s.mapr(bed.outputs['Value'], 0, 1, 0.8, 1.2),
                v=s.mapr(bed.outputs['Value'], 0, 1, 0.72, 1.18))
    # grain speckle
    g = s.noise(co, 900, 2)
    col = s.hsv(col, v=s.mapr(g, 0, 1, 0.86, 1.12))
    sp = s.voronoi(co, 700, 'F1')
    spc = s.n('ShaderNodeSeparateColor'); s.L(s.voronoi(co, 700, 'F1', out='Color'), spc.inputs[0])
    dark_grain = s.math('MULTIPLY', s.mapr(sp, 0.25, 0.12), s.mapr(spc.outputs[0], 0.9, 0.95))
    col = s.mix(dark_grain, col, hexc('#3d3326'))
    # iron staining / warm streaks running down the face
    streak = s.wave(s.vmath('MULTIPLY', co, (1.0, 1.0, 0.15)), 18, 6, 'BANDS', 'X')
    stain = s.math('MULTIPLY', s.mapr(streak, 0.55, 0.9), s.mapr(s.noise(co, 3, 2), 0.45, 0.7))
    col = s.mix(s.math('MULTIPLY', stain, 0.45), col, hexc('#7a5530'))
    # crevices: cool, dark; ambient occlusion deepens them
    ao = s.n('ShaderNodeAmbientOcclusion', samples=8, inside=False, only_local=True)
    ao.inputs['Distance'].default_value = 0.025
    occl = s.math('MULTIPLY', s.mapr(ao.outputs['AO'], 0.35, 1.0, 1, 0), 1.0)
    cv = s.math('MAXIMUM', s.mapr(cav, 0.55, 0.9, 0, 1, 'SMOOTHSTEP'), occl)
    col = s.mix(s.math('MULTIPLY', cv, 0.85), col, hexc('#2b2a24'))
    # worn convex edges lighter
    edge = s.mapr(cav, 0.3, 0.12, 0, 1, 'SMOOTHSTEP')
    col = s.mix(s.math('MULTIPLY', edge, 0.35), col, hexc('#b3a07c'))
    # green algal film near moss, soil splash near base
    algae = s.math('MULTIPLY', s.mapr(mossm, 0.05, 0.4), s.mapr(s.noise(co, 14, 4), 0.35, 0.6))
    col = s.mix(s.math('MULTIPLY', algae, 0.7), col, hexc('#3d4a1c'))
    base = s.mapr(z, 0.02, -0.02, 0, 1, 'SMOOTHSTEP')
    col = s.mix(s.math('MULTIPLY', base, 0.75), col, hexc('#3a2c1c'))
    # lichens: crustose pale grey-green, yellow-orange rosettes, black dots
    lw = s.vmath('ADD', co, s.vmath('SCALE', s.noise(co, 30, 3, out='Color'), scale=0.01))
    expose = s.math('MULTIPLY', s.math('SUBTRACT', 1, cv), s.math('SUBTRACT', 1, base))
    expose = s.math('MULTIPLY', expose, s.math('SUBTRACT', 1, s.mapr(mossm, 0.1, 0.35)))
    l1 = s.math('MULTIPLY', s.mapr(s.voronoi(lw, 16, 'F1'), 0.36, 0.22, 0, 1, 'SMOOTHSTEP'),
                s.mapr(s.noise(co, 5, 3), 0.44, 0.56))
    l1 = s.math('MULTIPLY', l1, expose)
    l1tex = s.mapr(s.noise(co, 260, 4, 0.7), 0.35, 0.65)
    lcol = s.mix(l1tex, hexc('#8e9682'), hexc('#c4c7b0'))
    col = s.mix(s.math('MULTIPLY', l1, 0.92), col, lcol)
    l2 = s.math('MULTIPLY', s.mapr(s.voronoi(lw, 40, 'F1'), 0.26, 0.14, 0, 1, 'SMOOTHSTEP'),
                s.mapr(s.noise(co, 7, 3, 0.5, 0, 'Fac'), 0.55, 0.62))
    l2 = s.math('MULTIPLY', l2, expose)
    col = s.mix(l2, col, s.mix(l1tex, hexc('#c27a22'), hexc('#d9a640')))
    l3 = s.math('MULTIPLY', s.mapr(s.voronoi(co, 300, 'F1'), 0.2, 0.1),
                s.mapr(s.noise(co, 11, 2), 0.62, 0.68))
    col = s.mix(s.math('MULTIPLY', l3, expose), col, hexc('#1c1c18'))
    lich = s.math('MAXIMUM', l1, l2)
    rough = s.mapr(lich, 0, 1, 0.82, 0.95)
    rough = s.math('SUBTRACT', rough, s.math('MULTIPLY', cv, 0.12))
    h = s.math('ADD', s.math('MULTIPLY', s.noise(co, 55, 6, 0.6), 0.7), s.math('MULTIPLY', s.noise(co, 380, 3), 0.25))
    h = s.math('ADD', h, s.math('MULTIPLY', lich, 0.35))
    h = s.math('ADD', h, s.math('MULTIPLY', s.math('MULTIPLY', l1tex, lich), 0.25))
    terr = s.mapr(s.math('FRACT', s.math('ADD', strata, s.math('MULTIPLY', s.noise(co, 20, 2), 0.3))), 0.86, 1.0, 0, 1, 'SMOOTHSTEP')
    terr = s.math('MULTIPLY', terr, s.mapr(s.noise(co, 7, 2), 0.35, 0.5))
    h = s.math('SUBTRACT', h, s.math('MULTIPLY', terr, 0.9))
    cw = s.vmath('ADD', co, s.vmath('SCALE', s.vmath('SUBTRACT', s.noise(co, 18, 4, out='Color'), (0.5, 0.5, 0.5)), scale=0.03))
    crk = s.mapr(s.voronoi(cw, 26, 'DISTANCE_TO_EDGE'), 0.0, 0.035, 1, 0, 'SMOOTHSTEP')
    crk = s.math('MULTIPLY', crk, s.mapr(s.noise(co, 6, 3), 0.56, 0.7))
    h = s.math('SUBTRACT', h, s.math('MULTIPLY', crk, 1.2))
    col = s.mix(s.math('MULTIPLY', s.math('MAXIMUM', crk, s.math('MULTIPLY', terr, 0.6)), 0.8), col, hexc('#211f1a'))
    h = s.math('MULTIPLY', h, s.math('SUBTRACT', 1, s.mapr(mossm, 0.15, 0.4)))
    disp = s.displacement(h, 0.0055, 0.4)
    col = s.hsv(col, h=0.505, v=0.64, s=1.15)
    p = s.principled(Base_Color=col, Roughness=rough, Normal=s.bump(s.noise(co, 1400, 2), 0.18, 0.0002))
    p.inputs['Specular IOR Level'].default_value = 0.4
    s.output(p.outputs[0], disp)
    s.mat.displacement_method = 'BOTH'
    return s.mat


def plant_bsdf(s, col, rough, trans_col, trans_amt, normal=None, sss=0.0):
    p = s.principled(Base_Color=col, Roughness=rough)
    p.inputs['Specular IOR Level'].default_value = 0.28
    if normal is not None:
        s.L(normal, p.inputs['Normal'])
    if sss:
        p.inputs['Subsurface Weight'].default_value = sss
        p.inputs['Subsurface Radius'].default_value = (0.002, 0.004, 0.001)
    t = s.n('ShaderNodeBsdfTranslucent')
    s.put(t.inputs['Color'], trans_col)
    if normal is not None:
        s.L(normal, t.inputs['Normal'])
    return s.mixs(trans_amt, p.outputs[0], t.outputs[0])


def mat_moss():
    s = SN('M_Moss')
    h = s.attr('h')
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    patch = s.attr('patch', 'INSTANCER')
    col = s.ramp(h, [(0.0, hexc('#231c10')), (0.3, hexc('#3b3c18')), (0.62, hexc('#52631f')),
                     (0.85, hexc('#6e8629')), (1.0, hexc('#95aa3e'))])
    # cushions shift between yellow-olive and deeper green
    col = s.hsv(col, h=s.mapr(patch, 0.3, 0.7, 0.465, 0.53), s=s.mapr(patch, 0.3, 0.7, 0.75, 1.0), v=s.mapr(rnd, 0, 1, 0.7, 1.12))
    tcol = s.hsv(col, s=1.2, v=1.5)
    sh = plant_bsdf(s, col, 0.48, tcol, s.mapr(h, 0.2, 0.9, 0.12, 0.45))
    s.output(sh)
    s.mat.use_backface_culling = False
    return s.mat


def mat_leaf(name, base, pale, edge_red=False):
    s = SN(name)
    uv = s.coord('UV')
    sep = s.n('ShaderNodeSeparateXYZ'); s.L(uv, sep.inputs[0])
    u = s.math('ABSOLUTE', s.math('SUBTRACT', s.math('MULTIPLY', sep.outputs['X'], 2), 1))
    v = sep.outputs['Y']
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    col = s.mix(s.mapr(s.noise(s.coord('Object'), 400, 3), 0.3, 0.7), hexc(base, 0.9), hexc(base, 1.1))
    # midrib
    rib = s.mapr(u, 0.08, 0.0, 0, 1, 'SMOOTHSTEP')
    col = s.mix(s.math('MULTIPLY', rib, 0.5), col, hexc(pale))
    # lateral veins
    vein_f = s.math('SINE', s.math('MULTIPLY', s.math('SUBTRACT', v, s.math('MULTIPLY', u, 0.45)), 55))
    vein = s.mapr(vein_f, 0.92, 1.0, 0, 1, 'SMOOTHSTEP')
    col = s.mix(s.math('MULTIPLY', vein, 0.22), col, hexc(pale))
    if name == 'M_Clover':
        # white clover's pale chevron
        vm = s.math('SUBTRACT', v, s.math('ADD', 0.42, s.math('MULTIPLY', u, 0.28)))
        chev = s.mapr(s.math('ABSOLUTE', vm), 0.1, 0.04, 0, 1, 'SMOOTHSTEP')
        chev = s.math('MULTIPLY', chev, s.mapr(rnd, 0.2, 0.3))
        col = s.mix(s.math('MULTIPLY', chev, 0.55), col, hexc('#a9bf8a'))
    if edge_red:
        red = s.math('MULTIPLY', s.mapr(u, 0.75, 1.0, 0, 1, 'SMOOTHSTEP'), s.mapr(rnd, 0.3, 0.9))
        col = s.mix(s.math('MULTIPLY', red, 0.8), col, hexc('#7a2a1c'))
        col = s.mix(s.math('MULTIPLY', s.mapr(v, 0.7, 1.0), s.mapr(rnd, 0.6, 1.0)), col, hexc('#6b3b20'))
    col = s.hsv(col, h=s.mapr(rnd, 0, 1, 0.48, 0.52), v=s.mapr(rnd, 0, 1, 0.8, 1.15))
    nb = s.bump(s.math('ADD', s.math('MULTIPLY', vein, 0.6), s.math('MULTIPLY', rib, -0.6)), 0.25, 0.0004)
    col = s.hsv(col, s=0.85)
    sh = plant_bsdf(s, col, 0.6, s.hsv(col, s=1.2, v=1.6), 0.3, nb)
    s.output(sh)
    return s.mat


def mat_grass():
    s = SN('M_Grass')
    uv = s.coord('UV')
    sep = s.n('ShaderNodeSeparateXYZ'); s.L(uv, sep.inputs[0])
    v = sep.outputs['Y']
    dry = s.attr('dry')
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    green = s.ramp(v, [(0.0, hexc('#3d5a1e')), (0.6, hexc('#5f8a2a')), (0.92, hexc('#8aa045')), (1.0, hexc('#b5a35f'))])
    straw = s.ramp(v, [(0.0, hexc('#8c7a4c')), (1.0, hexc('#c9b58a'))])
    col = s.mix(dry, green, straw)
    col = s.hsv(col, h=s.mapr(rnd, 0, 1, 0.48, 0.52), v=s.mapr(rnd, 0, 1, 0.8, 1.2))
    stri = s.wave(uv, 40, 0, 'BANDS', 'X')
    nb = s.bump(stri, 0.12, 0.0002)
    sh = plant_bsdf(s, col, 0.42, s.hsv(col, s=1.15, v=1.6), s.mapr(dry, 0, 1, 0.35, 0.15), nb)
    s.output(sh)
    return s.mat


def mat_simple(name, col, rough=0.5, trans=0.0, sss=0.0, emit=None, emit_str=0.0, spec=0.5):
    s = SN(name)
    p = s.principled(Base_Color=col, Roughness=rough)
    p.inputs['Specular IOR Level'].default_value = spec
    if sss:
        p.inputs['Subsurface Weight'].default_value = sss
        p.inputs['Subsurface Radius'].default_value = (0.003, 0.002, 0.0012)
    if emit:
        p.inputs['Emission Color'].default_value = emit
        p.inputs['Emission Strength'].default_value = emit_str
    sh = p.outputs[0]
    if trans:
        t = s.n('ShaderNodeBsdfTranslucent'); t.inputs['Color'].default_value = col
        sh = s.mixs(trans, sh, t.outputs[0])
    s.output(sh)
    return s.mat


def mat_root():
    s = SN('M_Root')
    co = s.coord('Object')
    rnd = s.n('ShaderNodeObjectInfo').outputs['Random']
    col = s.mix(s.mapr(s.noise(co, 140, 4), 0.35, 0.7), hexc('#c9b38e'), hexc('#8f6f4a'))
    dirt = s.mapr(s.noise(co, 60, 3), 0.5, 0.65)
    col = s.mix(s.math('MULTIPLY', dirt, 0.8), col, hexc('#3a2a1a'))
    col = s.hsv(col, v=s.mapr(rnd, 0, 1, 0.75, 1.1))
    p = s.principled(Base_Color=col, Roughness=0.6, Normal=s.bump(s.noise(co, 500, 3), 0.3, 0.0002))
    p.inputs['Subsurface Weight'].default_value = 0.25
    p.inputs['Subsurface Radius'].default_value = (0.0015, 0.001, 0.0006)
    s.output(p.outputs[0])
    return s.mat


def mat_probe():
    mats = {}
    s = SN('M_ProbeBody')
    tg = s.n('ShaderNodeTangent', direction_type='RADIAL', axis='Z')
    co = s.coord('Object')
    sep = s.n('ShaderNodeSeparateXYZ'); s.L(co, sep.inputs[0])
    lathe = s.noise(s.vmath('MULTIPLY', co, (0.0, 0.0, 1.0)), 9000, 1)
    p = s.principled(Base_Color=hexc('#3f4347'), Metallic=1.0, Roughness=s.mapr(lathe, 0, 1, 0.24, 0.32),
                     Anisotropic=0.55)
    s.L(tg.outputs[0], p.inputs['Tangent'])
    s.L(s.bump(lathe, 0.08, 0.0001), p.inputs['Normal'])
    s.output(p.outputs[0])
    mats['body'] = s.mat
    s = SN('M_ProbeCap')
    p = s.principled(Base_Color=hexc('#1b1d1f'), Metallic=1.0, Roughness=0.42)
    s.output(p.outputs[0]); mats['cap'] = s.mat
    s = SN('M_ProbeTip')
    p = s.principled(Base_Color=hexc('#9a9c9e'), Metallic=1.0, Roughness=0.22)
    s.output(p.outputs[0]); mats['tip'] = s.mat
    for i in range(3):
        s = SN(f'M_Band{i + 1}')
        p = s.principled(Base_Color=hexc('#2c3a26'), Roughness=0.18, Emission_Color=hexc('#9fe05a'))
        p.inputs['Emission Strength'].default_value = 0.0
        p.inputs['Coat Weight'].default_value = 1.0
        p.inputs['Coat Roughness'].default_value = 0.05
        s.output(p.outputs[0]); mats[f'band{i + 1}'] = s.mat
    s = SN('M_LED')
    p = s.principled(Base_Color=hexc('#22301f'), Roughness=0.2, Emission_Color=hexc('#C6F19D'))
    p.inputs['Emission Strength'].default_value = 0.0
    s.output(p.outputs[0]); mats['led'] = s.mat
    return mats


# ------------------------------------------------------------------ soil block
def footprint_r(ang):
    # irregular rounded footprint radius (unit, multiplied by half extents)
    return 1.0 + 0.07 * math.sin(3 * ang + 0.7) + 0.05 * math.sin(5 * ang + 2.1) + 0.03 * math.sin(8 * ang)

def build_soil_mesh():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
    rx, ry, rz = 0.25, 0.21, 0.20
    cz = -0.17
    for v in bm.verts:
        d = v.co.normalized()
        ang = math.atan2(d.y, d.x)
        fr = footprint_r(ang)
        n_xy, n_z = 3.2, 7.0
        # superellipsoid: |x/rx|^n + |y/ry|^n (as radial) then with z
        rad = (abs(d.x / (rx * fr)) ** n_xy + abs(d.y / (ry * fr)) ** n_xy) ** (1 / n_xy)
        t = (rad ** n_z + abs(d.z / rz) ** n_z) ** (-1 / n_z)
        v.co = d * t + Vector((0.03, 0, cz))
    me = bpy.data.meshes.new('soil_tmp')
    bm.to_mesh(me); bm.free()
    tmp = bpy.data.objects.new('soil_tmp', me)
    bpy.context.scene.collection.objects.link(tmp)
    rm = tmp.modifiers.new('rm', 'REMESH')
    rm.mode = 'VOXEL'; rm.voxel_size = 0.0055
    me2 = evaluated_copy(tmp, 'Soil')
    bpy.data.objects.remove(tmp); bpy.data.meshes.remove(me)

    bm = bmesh.new(); bm.from_mesh(me2)
    bm.normal_update()
    off = Vector((3.1, 7.7, 1.3))
    off2 = Vector((11.4, -3.9, 6.6))
    newco = []
    for v in bm.verts:
        p = v.co.copy(); n = v.normal.copy()
        depth = max(0.0, min(1.0, -p.z / 0.37))
        # taper towards a root-ball bottom
        c = Vector((0.03, 0.0, p.z))
        taper = 1.0 - 0.26 * depth ** 1.8
        q = c + (p - c) * taper
        q.z = p.z
        hz = Vector((n.x, n.y, 0))
        side = hz.length
        topness = smooth(0.55, 0.9, n.z)
        botness = smooth(0.25, 0.7, -n.z)
        # torn sides: low-frequency bulges, then broken clods (voronoi cells set back by random amounts,
        # with recessed fissures along cell borders)
        a = 0.013 + 0.015 * depth
        dside = a * fbm(p * 3.6 + off2, 4) + 0.006 * fbm(p * 14 + off, 3) + 0.0025 * fbm(p * 70, 2)
        for cs, amp in ((4.0, 0.016), (11.0, 0.011), (24.0, 0.005)):
            dist_, pts_ = noise.voronoi(p * cs + off2 + noise.noise_vector(p * cs * 0.7) * 0.35, distance_metric='DISTANCE')
            h = (math.sin(pts_[0].dot(Vector((12.9898, 78.233, 37.719)))) * 43758.5453) % 1.0
            w = smooth(0.0, 0.12, dist_[1] - dist_[0])
            dside += amp * ((h - 0.55) * w - 0.5 * (1 - w))
        if side > 1e-6:
            q += hz.normalized() * dside * side * (1 - topness)
        # turf lip overhang just under the top edge, undercut below it
        if side > 0.4 and p.z > -0.09:
            lip = 0.006 * smooth(-0.03, -0.008, p.z) - 0.007 * smooth(-0.012, -0.03, p.z) * smooth(-0.09, -0.045, p.z)
            q += hz.normalized() * lip
        # lumpy, chunky bottom
        if botness > 0:
            vo = noise.voronoi(p * 9 + off, distance_metric='DISTANCE')[0][0]
            dd = 0.045 * max(0.0, fbm(p * 4.5 + off, 3) + 0.25) + 0.02 * (1 - min(1, vo * 1.6)) + 0.006 * fbm(p * 30, 2)
            q.z -= dd * botness
        # hummocky top
        if topness > 0:
            hump = 0.5 + 0.5 * fbm(p * 5.5 + off, 3)
            q.z += topness * (0.004 + 0.024 * hump ** 1.8 + 0.004 * fbm(p * 20 + off, 2))
        newco.append(q)
    for v, q in zip(bm.verts, newco):
        v.co = q
    for _ in range(1):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    # clean planar cut
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(XCUT, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
    bnd = [e for e in bm.edges if e.is_boundary]
    # order boundary loops
    adj = {}
    for e in bnd:
        a, b = e.verts
        adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in adj:
        if start in seen:
            continue
        loop = [start]; seen.add(start); prev = None; cur = start
        while True:
            nxt = [w for w in adj[cur] if w is not prev and w not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur); seen.add(cur)
        if len(loop) > 8:
            loops.append(loop)
    loops.sort(key=len, reverse=True)
    outline = loops[0]
    poly = [(v.co.y, v.co.z) for v in outline]

    def inside(y, z):
        c = False
        j = len(poly) - 1
        for i in range(len(poly)):
            yi, zi = poly[i]; yj, zj = poly[j]
            if (zi > z) != (zj > z) and y < (yj - yi) * (z - zi) / (zj - zi + 1e-12) + yi:
                c = not c
            j = i
        return c

    ys = [p[0] for p in poly]; zs = [p[1] for p in poly]
    pts = []
    step = 0.0045
    rr = random.Random(3)
    y = min(ys)
    while y < max(ys):
        z = min(zs)
        while z < max(zs):
            jy = y + (rr.random() - 0.5) * step * 0.5; jz = z + (rr.random() - 0.5) * step * 0.5
            if inside(jy, jz):
                dmin = min((jy - a) ** 2 + (jz - b) ** 2 for a, b in poly[::3])
                if dmin > (step * 0.7) ** 2:
                    pts.append((jy, jz))
            z += step
        y += step
    coords = [Vector(p) for p in poly] + [Vector(p) for p in pts]
    nb = len(poly)
    vout, eout, fout, overts, oedges, ofaces = delaunay_2d_cdt(coords, [], [list(range(nb))], 1, 1e-7, True)
    vmap = []
    for i, co in enumerate(vout):
        orig = [o for o in overts[i] if o < nb]
        if orig:
            vmap.append(outline[orig[0]])
        else:
            vmap.append(bm.verts.new((XCUT, co.x, co.y)))
    for f in fout:
        vs = [vmap[i] for i in f]
        if len(set(vs)) < 3:
            continue
        try:
            face = bm.faces.new(vs)
        except ValueError:
            continue
        face.normal_update()
        if face.normal.x < 0:
            face.normal_flip()
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.normal_update()
    bm.to_mesh(me2); bm.free()
    me2.update()
    return me2


def burrow_cutters(coll):
    """Worm burrow (half-open channel on the cut face) and a few round pores."""
    obs = []
    rr = random.Random(11)
    pts = []
    y, z = 0.075, -0.07
    for i in range(40):
        t = i / 39
        pts.append(Vector((XCUT + 0.0006, y + 0.012 * math.sin(t * 5.5) + 0.02 * t, z - 0.17 * t)))
    rad = [0.0032 + 0.0004 * math.sin(i) for i in range(len(pts))]
    v, f, uv = tube(pts, rad, sides=12, cap=False)
    # cap both ends with spheres-ish so the cutter is closed
    me = mesh_from('burrow_cut', v, f, uv, smooth_shade=False)
    ob = bpy.data.objects.new('burrow_cut', me); coll.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bm.to_mesh(me); bm.free()
    obs.append(ob)
    for i in range(7):
        bm = bmesh.new()
        r = rr.uniform(0.0012, 0.0024)
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        c = Vector((XCUT + r * 0.2, rr.uniform(-0.12, 0.13), rr.uniform(-0.28, -0.05)))
        if abs(c.y - PROBE_Y) < 0.02:
            c.y += 0.04
        bmesh.ops.translate(bm, verts=bm.verts, vec=c)
        me = bpy.data.meshes.new(f'pore{i}'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(f'pore{i}', me); coll.objects.link(o); obs.append(o)
    return obs


def soil_attributes(me):
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    cols = {k: [] for k in ('turf', 'cutface', 'pebble', 'crumbmask', 'mosspatch', 'cloverpatch', 'herbpatch', 'grasspatch', 'drape')}
    o1, o2, o3 = Vector((1.3, 4.1, 0.2)), Vector((7.7, 2.2, 5.5)), Vector((3.3, 9.1, 1.7))
    for v in bm.verts:
        p, n = v.co, v.normal
        is_face = 1.0 if (abs(p.x - XCUT) < 1e-4 and n.x > 0.7) else 0.0
        top = smooth(0.45, 0.8, n.z) * smooth(-0.03, -0.005, p.z)
        lipn = 0.5 + 0.5 * fbm(p * 30 + o1, 2)
        lipz = -0.045 + 0.03 * (0.5 + 0.5 * fbm(p * 9 + o2, 2))
        lip = smooth(lipz, -0.004, p.z) * (1 - is_face) * smooth(0.3, 0.65, lipn) * 0.9 * smooth(0.6, 0.2, abs(n.z))
        t = max(top, lip) * (1 - is_face)
        cols['turf'].append(t)
        cols['drape'].append(lip)
        cols['cutface'].append(is_face)
        depth = max(0.0, min(1.0, -p.z / 0.36))
        cols['pebble'].append((1 - t) * (0.25 + 0.75 * smooth(0.15, 0.6, depth)) * (1.0 if is_face else 0.6))
        cols['crumbmask'].append((1 - t) * (1.0 if is_face else 0.85) * smooth(-0.005, -0.03, p.z))
        # turf composition: moss cushions, clover patches and creeping herbs interleave
        m = fbm(p * 11 + o1, 3); c = fbm(p * 8 + o2, 3); h = fbm(p * 13 + o3, 3)
        near_probe = smooth(0.045, 0.025, math.hypot(p.x - XCUT, p.y - PROBE_Y))
        cols['mosspatch'].append(t * (0.35 + 0.65 * smooth(-0.25, 0.25, m)))
        cols['cloverpatch'].append(top * smooth(0.0, 0.3, c) * (1 - near_probe))
        cols['herbpatch'].append(top * smooth(0.05, 0.35, h) * (1 - near_probe))
        cols['grasspatch'].append(top * smooth(0.15, 0.4, -c) * (1 - near_probe))
    bm.free()
    for name, vals in cols.items():
        a = me.attributes.get(name) or me.attributes.new(name, 'FLOAT', 'POINT')
        a.data.foreach_set('value', vals)


# ------------------------------------------------------------------ stone
STONE_C = Vector((-0.03, 0.035, 0.05))

def build_stone_mesh():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1.0)
    sx, sy, sz = 0.205, 0.145, 0.118
    off = Vector((5.2, 1.7, 9.3))
    strata_n = Vector((0.38, 0.2, 1.0)).normalized()
    cleaves = [(Vector((-0.75, -0.55, 0.15)).normalized(), 0.15), (Vector((0.55, -0.7, 0.35)).normalized(), 0.13),
               (Vector((0.12, 0.3, 0.95)).normalized(), 0.098), (Vector((0.9, 0.2, -0.1)).normalized(), 0.17)]
    layer_rand = {}
    strata_vals = []
    for v in bm.verts:
        d = v.co.copy()
        r = 1.0 + 0.16 * fbm(d * 1.1 + off, 3) + 0.05 * fbm(d * 3.2 + off, 3)
        p = Vector((d.x * sx, d.y * sy, d.z * sz)) * r
        # cleavage planes: pull material onto planes (blocky character)
        for nrm, dist in cleaves:
            k = p.dot(nrm) - dist
            if k > 0:
                p -= nrm * k * (0.85 + 0.1 * noise.noise(p * 30 + off))
        # flattened, sunk base
        if p.z < -0.07:
            p.z = -0.07 + (p.z + 0.07) * 0.25
        # bedding terraces: each layer set back by a random amount, notches between layers
        s = p.dot(strata_n)
        u = s / 0.024 + 0.65 * fbm(p * 4.5 + off, 2) + 0.2 * fbm(p * 16 + off, 2)
        li = math.floor(u); fr = u - li
        if li not in layer_rand:
            layer_rand[li] = random.Random(li * 7 + 3).random()
        notch = 1.0 if layer_rand[li] > 0.3 else 0.4
        setback = 0.012 * layer_rand[li] + notch * (0.0045 * smooth(0.88, 1.0, fr) + 0.0015 * smooth(0.0, 0.07, 0.07 - fr))
        radial = Vector((p.x, p.y, 0))
        if radial.length > 1e-6:
            p -= radial.normalized() * setback * smooth(0.0, 0.6, radial.length / 0.16)
        # crack network: grooves along noise isolines
        cn = abs(noise.noise(p * 7 + off * 2)) + 0.25 * abs(noise.noise(p * 21 + off))
        p -= p.normalized() * 0.0065 * smooth(0.07, 0.0, cn) * smooth(-0.1, 0.35, fbm(p * 3 + off, 2))
        # erosion: gentle ridged noise (no pits)
        p += (p.normalized()) * (0.004 * noise.ridged_multi_fractal(p * 10 + off, 0.9, 2.0, 4, 1.0, 2.0) * 0.25 - 0.0015)
        v.co = p
        strata_vals.append(u)
    bm.normal_update()
    bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.12, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    # cavity: mean signed offset of neighbours along the normal, smoothed
    cav = []
    for v in bm.verts:
        acc, w = 0.0, 0.0
        for e in v.link_edges:
            o = e.other_vert(v)
            dv = o.co - v.co
            acc += dv.dot(v.normal) / max(dv.length, 1e-6); w += 1
        cav.append(acc / max(w, 1))
    idx = {v: i for i, v in enumerate(bm.verts)}
    for _ in range(4):
        new = []
        for v in bm.verts:
            s_ = cav[idx[v]]; c_ = 1
            for e in v.link_edges:
                s_ += cav[idx[e.other_vert(v)]]; c_ += 1
            new.append(s_ / c_)
        cav = new
    sc = sorted(cav)
    lo, hi = sc[int(len(sc) * 0.03)], sc[int(len(sc) * 0.97)]
    cav = [max(0.0, min(1.0, 0.5 + 0.5 * (c / max(abs(lo), abs(hi))))) for c in cav]
    # moss mask: concave + upward facing + base band, broken by noise
    moss = []
    for v, c in zip(bm.verts, cav):
        p = v.co + STONE_C
        up = smooth(0.1, 0.75, v.normal.z)
        base = smooth(0.03, -0.012, p.z)
        nz = noise.fractal(v.co * 30 + off, 0.6, 2.0, 3)
        crack = smooth(0.6, 0.85, c) * (0.4 + 0.6 * up)
        patch = up ** 1.5 * smooth(-0.05, 0.3, nz + 0.3 * (c - 0.5))
        m = max(base * smooth(-0.3, 0.2, nz), crack * smooth(-0.2, 0.3, nz), patch * 0.9)
        moss.append(max(0.0, min(1.0, m)))
    rot = Matrix.Rotation(math.radians(-24), 3, 'Z')
    for v in bm.verts:
        v.co = rot @ v.co + STONE_C
    me = bpy.data.meshes.new('Stone')
    bm.to_mesh(me); bm.free()
    for name, vals in (('cavity', cav), ('mossmask', moss), ('strata', strata_vals)):
        a = me.attributes.new(name, 'FLOAT', 'POINT'); a.data.foreach_set('value', vals)
    me.shade_smooth()
    return me


# ------------------------------------------------------------------ plant assets
def asset_moss_sprig(seed):
    rr = random.Random(seed)
    B = Builder()
    H = rr.uniform(0.0065, 0.0105)
    stem = arc_path((0, 0, 0), (rr.uniform(-.15, .15), rr.uniform(-.15, .15), 1), H, 6, wobble=0.15, seed=seed)
    v, f, uv = tube(stem, [0.00028 * (1 - 0.5 * i / 6) for i in range(7)], 5)
    B.add(v, f, uv, 0, {'h': [max(0, q.z / H) for q in v]})
    nl = rr.randint(20, 28)
    for k in range(nl):
        t = 0.12 + 0.88 * (k + 0.5) / nl
        i = min(int(t * 6), 5); ft = t * 6 - i
        p = stem[i].lerp(stem[i + 1], ft)
        phi = k * 2.39996 + rr.uniform(-0.2, 0.2)
        theta = math.radians(62 - 45 * t ** 1.5 + rr.uniform(-8, 8))
        d = Vector((math.cos(phi) * math.sin(theta), math.sin(phi) * math.sin(theta), math.cos(theta)))
        L = 0.0021 * (1.15 - 0.55 * t ** 2) * rr.uniform(0.85, 1.15)
        radial = Vector((math.cos(phi), math.sin(phi), 0))
        path = [p + d * (L * j / 4) + radial * (L * 0.18 * (j / 4) ** 2) for j in range(5)]
        widths = [0.00045 * math.sin(math.pi * min(1, 0.15 + j / 4 * 0.95)) ** 0.8 + 0.00002 for j in range(5)]
        v, f, uv = ribbon(path, widths, [radial] * 5, cols=3, fold=0.45)
        B.add(v, f, uv, 0, {'h': [max(0, min(1, q.z / (H * 1.05))) for q in v]})
    return B.mesh(f'moss_sprig_{seed}')


def asset_moss_frond(seed):
    rr = random.Random(seed)
    B = Builder()
    L = rr.uniform(0.016, 0.026)
    d0 = Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), 0)).normalized() + Vector((0, 0, 0.9))
    axis = arc_path((0, 0, 0), d0, L, 10, droop=0.01, wobble=0.1, seed=seed)
    v, f, uv = tube(axis, [0.0003 * (1 - 0.6 * i / 10) for i in range(11)], 4)
    B.add(v, f, uv, 0, {'h': [0.2 + 0.8 * (i // 4) / 10 for i in range(len(v))]})
    tans = frame_along(axis)
    for k in range(2, 10):
        for side in (-1, 1):
            t = k / 10
            p = axis[k]
            tg = tans[k]
            sd = tg.cross(Vector((0, 0, 1))).normalized() * side
            pl = 0.0042 * (1 - t) ** 0.8 + 0.0008
            dirp = (sd * 0.9 + tg * 0.5).normalized()
            path = [p + dirp * (pl * j / 3) for j in range(4)]
            widths = [0.0007 * math.sin(math.pi * min(1, 0.2 + j / 3 * 0.85)) + 0.00003 for j in range(4)]
            v, f, uv = ribbon(path, widths, [Vector((0, 0, 1))] * 4, cols=3, fold=0.2)
            B.add(v, f, uv, 0, {'h': [0.35 + 0.65 * t] * len(v)})
    return B.mesh(f'moss_frond_{seed}')


def leaflet(B, base, direction, up, length, width, mat, profile='obovate', rows=7, fold=0.18, cup=0.12, attrs=None):
    path, widths, normals = [], [], []
    d = direction.normalized()
    for i in range(rows):
        t = i / (rows - 1)
        p = base + d * (length * t) + up * (length * 0.12 * math.sin(math.pi * t) - length * 0.08 * t * t)
        path.append(p)
        if profile == 'obovate':
            w = width * (t ** 0.55) * max(0.0, 1 - t ** 3.5) ** 0.6
        elif profile == 'hastate':
            w = width * (0.42 * (1 - t) ** 0.9 * smooth(0.0, 0.1, t) + 0.0) + width * 0.75 * max(0.0, 1 - t / 0.13) * smooth(0, 0.04, t)
        elif profile == 'lance':
            w = width * math.sin(math.pi * min(1, t * 0.95 + 0.04)) ** 0.7 * (1 - 0.3 * t)
        elif profile == 'petal':
            w = width * math.sin(math.pi * min(1.0, 0.1 + t * 0.75)) ** 0.5
        widths.append(w + 1e-5)
        normals.append(up)
    v, f, uv = ribbon(path, widths, normals, cols=5, fold=fold, cup=cup)
    B.add(v, f, uv, mat, attrs)


def asset_clover(seed):
    rr = random.Random(seed)
    B = Builder()
    for s_ in range(rr.randint(3, 6)):
        ang = rr.uniform(0, 2 * math.pi)
        L = rr.uniform(0.014, 0.032)
        d = Vector((math.cos(ang) * rr.uniform(0.4, 0.9), math.sin(ang) * rr.uniform(0.4, 0.9), 1))
        pet = arc_path((rr.uniform(-.004, .004), rr.uniform(-.004, .004), 0), d, L, 8, droop=0.004, wobble=0.12, seed=seed * 13 + s_)
        v, f, uv = tube(pet, [0.0007 - 0.0002 * i / 8 for i in range(9)], 5)
        B.add(v, f, uv, 0)
        top = pet[-1]
        lsize = rr.uniform(0.008, 0.0125)
        rot0 = rr.uniform(0, 2 * math.pi)
        tilt = rr.uniform(-0.25, 0.25)
        for k in range(3):
            a = rot0 + k * 2 * math.pi / 3
            dirl = Vector((math.cos(a), math.sin(a), rr.uniform(0.05, 0.3) + tilt * math.cos(a)))
            leaflet(B, top, dirl, Vector((0, 0, 1)), lsize * rr.uniform(0.9, 1.1), lsize * 0.42, 1, 'obovate')
    return B.mesh(f'clover_{seed}')


def asset_sorrel(seed):
    rr = random.Random(seed)
    B = Builder()
    for k in range(rr.randint(6, 9)):
        a = k * 2.39996 + rr.uniform(-0.3, 0.3)
        lean = rr.uniform(0.9, 1.6)
        d = Vector((math.cos(a) * lean, math.sin(a) * lean, 1))
        pl = rr.uniform(0.01, 0.022)
        pet = arc_path((0, 0, 0), d, pl, 5, droop=0.006, seed=seed * 7 + k)
        v, f, uv = tube(pet, [0.0008 - 0.0002 * i / 5 for i in range(6)], 5)
        B.add(v, f, uv, 0)
        dir2 = (pet[-1] - pet[-2]).normalized()
        dir2 = (dir2 + Vector((0, 0, -0.35))).normalized()
        L = rr.uniform(0.02, 0.036)
        side = dir2.cross(Vector((0, 0, 1))).normalized()
        up = side.cross(dir2).normalized()
        leaflet(B, pet[-1], dir2, up, L, L * 0.38, 1, 'hastate', rows=9, fold=0.25, cup=0.05)
    return B.mesh(f'sorrel_{seed}')


def asset_grass(seed):
    rr = random.Random(seed)
    B = Builder()
    for k in range(rr.randint(5, 10)):
        a = rr.uniform(0, 2 * math.pi)
        tilt = rr.uniform(0.25, 0.9)
        d = Vector((math.cos(a) * tilt, math.sin(a) * tilt, 1))
        L = rr.uniform(0.05, 0.14)
        path = arc_path((rr.uniform(-.004, .004), rr.uniform(-.004, .004), 0), d, L, 11, droop=0.007 * L / 0.1, wobble=0.06, seed=seed * 31 + k)
        W = rr.uniform(0.0011, 0.0019)
        widths = [W * (1 - (i / 11) ** 1.6) + 0.00006 for i in range(12)]
        tans = frame_along(path)
        side = Vector((-math.sin(a), math.cos(a), 0))
        normals = [t.cross(side).normalized() for t in tans]
        v, f, uv = ribbon(path, widths, normals, cols=3, fold=0.5)
        dry = 1.0 if rr.random() < 0.18 else 0.0
        B.add(v, f, uv, 0, {'dry': dry})
    return B.mesh(f'grass_{seed}')


def asset_seedhead(seed):
    rr = random.Random(seed)
    B = Builder()
    L = rr.uniform(0.13, 0.2)
    d = Vector((rr.uniform(-.25, .25), rr.uniform(-.25, .25), 1))
    stem = arc_path((0, 0, 0), d, L, 12, droop=0.0012, wobble=0.04, seed=seed)
    v, f, uv = tube(stem, [0.0007 - 0.0003 * i / 12 for i in range(13)], 5)
    B.add(v, f, uv, 0)
    tans = frame_along(stem)
    for k in range(rr.randint(9, 14)):
        t = rr.uniform(0.72, 0.98)
        i = min(int(t * 12), 11)
        p = stem[i].lerp(stem[i + 1], t * 12 - i)
        a = rr.uniform(0, 2 * math.pi)
        out = Vector((math.cos(a), math.sin(a), 0))
        bd = (tans[i] * 1.4 + out).normalized()
        bl = rr.uniform(0.004, 0.012) * (1.2 - t)
        br = arc_path(p, bd, bl, 3, droop=0.004, seed=seed + k)
        v, f, uv = tube(br, [0.0002] * 4, 4)
        B.add(v, f, uv, 0)
        for s_ in range(rr.randint(2, 3)):
            q = br[-1 - s_] if s_ < len(br) else br[-1]
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1)
            sd = (bd + Vector((rr.uniform(-.3, .3), rr.uniform(-.3, .3), 0.4))).normalized()
            rot = sd.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            mat = Matrix.Translation(q + sd * 0.0012) @ rot @ Matrix.Diagonal((0.0007, 0.0007, 0.0021, 1))
            vv = [mat @ x.co for x in bm.verts]
            ff = [tuple(x.index for x in fa.verts) for fa in bm.faces]
            bm.free()
            B.add(vv, ff, None, 1)
    return B.mesh(f'seedhead_{seed}')


def asset_flower(seed):
    rr = random.Random(seed)
    B = Builder()
    L = rr.uniform(0.035, 0.07)
    d = Vector((rr.uniform(-.6, .6), rr.uniform(-.6, .6), 1))
    stem = arc_path((0, 0, 0), d, L, 9, droop=0.003, wobble=0.15, seed=seed)
    v, f, uv = tube(stem, [0.00055] * 10, 5)
    B.add(v, f, uv, 0)
    # two small lance leaves at a node
    i = 4
    for sgn in (-1, 1):
        a = rr.uniform(0, 6.28)
        dl = Vector((math.cos(a) * sgn, math.sin(a) * sgn, 0.4)).normalized()
        leaflet(B, stem[i], dl, Vector((0, 0, 1)), rr.uniform(0.006, 0.01), 0.0022, 3, 'lance', rows=5)
    top = stem[-1]
    face = ((stem[-1] - stem[-3]).normalized() * 0.4 + Vector((0, 0, 1.0))).normalized()
    side = face.cross(Vector((0.3, 0.7, 0.1))).normalized()
    side2 = face.cross(side)
    rot0 = rr.uniform(0, 6.28)
    for k in range(4):
        a = rot0 + k * math.pi / 2
        dp = (side * math.cos(a) + side2 * math.sin(a) + face * 0.12).normalized()
        leaflet(B, top + face * 0.0005, dp, face, 0.0062, 0.0056, 1, 'petal', rows=6, fold=-0.03, cup=0.05)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
    rot = face.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    mat = Matrix.Translation(top + face * 0.0009) @ rot @ Matrix.Diagonal((0.0014, 0.0014, 0.0007, 1))
    B.add([mat @ x.co for x in bm.verts], [tuple(x.index for x in fa.verts) for fa in bm.faces], None, 2)
    bm.free()
    return B.mesh(f'flower_{seed}')


def asset_herb(seed):
    rr = random.Random(seed)
    B = Builder()
    for k in range(rr.randint(2, 4)):
        a = rr.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a), math.sin(a), rr.uniform(0.25, 0.6)))
        L = rr.uniform(0.025, 0.05)
        stem = arc_path((0, 0, 0), d, L, 10, droop=0.008, wobble=0.25, seed=seed * 17 + k)
        v, f, uv = tube(stem, [0.00055 - 0.0002 * i / 10 for i in range(11)], 4)
        B.add(v, f, uv, 0)
        tans = frame_along(stem)
        for i in (2, 4, 6, 8, 10):
            t = i / 10
            side = tans[i].cross(Vector((0, 0, 1))).normalized()
            rot = (i * 1.3) % 3.14
            for sgn in (-1, 1):
                dl = (side * sgn + tans[i] * 0.35 + Vector((0, 0, rr.uniform(0.15, 0.5)))).normalized()
                ls = rr.uniform(0.011, 0.017) * (1.15 - 0.4 * t)
                leaflet(B, stem[i], dl, Vector((0, 0, 1)), ls, ls * 0.55, 1, 'lance', rows=6, fold=0.22, cup=0.15)
    return B.mesh(f'herb_{seed}')



def asset_crumb(seed):
    rr = random.Random(seed)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
    off = Vector((rr.random() * 9, rr.random() * 9, rr.random() * 9))
    sq = Vector((rr.uniform(0.7, 1.2), rr.uniform(0.7, 1.2), rr.uniform(0.5, 0.9)))
    for v in bm.verts:
        d = v.co.normalized()
        r = 1 + 0.5 * fbm(d * 1.8 + off, 3) + 0.18 * fbm(d * 5 + off, 2)
        v.co = Vector((d.x * sq.x, d.y * sq.y, d.z * sq.z)) * r
    me = bpy.data.meshes.new(f'crumb_{seed}'); bm.to_mesh(me); bm.free(); me.shade_smooth()
    return me


def asset_pebble(seed):
    rr = random.Random(seed)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1)
    off = Vector((rr.random() * 9, rr.random() * 9, rr.random() * 9))
    sq = Vector((rr.uniform(0.8, 1.2), rr.uniform(0.6, 1.0), rr.uniform(0.4, 0.8)))
    for v in bm.verts:
        d = v.co.normalized()
        r = 1 + 0.18 * fbm(d * 1.4 + off, 3) + 0.03 * fbm(d * 6 + off, 2)
        v.co = Vector((d.x * sq.x, d.y * sq.y, d.z * sq.z)) * r
    me = bpy.data.meshes.new(f'pebble_{seed}'); bm.to_mesh(me); bm.free(); me.shade_smooth()
    return me


# ------------------------------------------------------------------ geometry node groups
class GN:
    def __init__(self, name):
        self.ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
        self.ng.is_modifier = True
        self.ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
        self.ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
        self.gi = self.n('NodeGroupInput'); self.go = self.n('NodeGroupOutput')

    def inp(self, name, kind, default=None):
        s = self.ng.interface.new_socket(name, in_out='INPUT', socket_type=kind)
        if default is not None:
            s.default_value = default
        return name

    def g(self, name):
        return self.gi.outputs[name]

    def n(self, idn, **kw):
        node = self.ng.nodes.new(idn)
        for k, v in kw.items():
            setattr(node, k, v)
        return node

    def L(self, a, b):
        self.ng.links.new(a, b)

    def put(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.L(v, sock)
        elif v is not None:
            sock.default_value = v

    def ins(self, node, kind=None):
        return [s for s in node.inputs if s.enabled and (kind is None or s.type == kind)]

    def math(self, op, a, b=None):
        m = self.n('ShaderNodeMath', operation=op)
        self.put(m.inputs[0], a)
        if b is not None:
            self.put(m.inputs[1], b)
        return m.outputs[0]

    def rand(self, lo, hi, seed, kind='FLOAT'):
        r = self.n('FunctionNodeRandomValue', data_type=kind)
        ins = self.ins(r)
        self.put(ins[0], lo); self.put(ins[1], hi)
        self.put([s for s in ins if s.name == 'Seed'][0], seed)
        return [s for s in r.outputs if s.enabled][0]

    def attr(self, name, kind='FLOAT'):
        a = self.n('GeometryNodeInputNamedAttribute', data_type=kind)
        self.put(a.inputs['Name'], name)
        return [s for s in a.outputs if s.enabled and s.name == 'Attribute'][0]

    def mapr(self, v, a, b, c, d, interp='SMOOTHSTEP'):
        m = self.n('ShaderNodeMapRange', interpolation_type=interp, clamp=True)
        ins = self.ins(m, 'VALUE')
        for s, x in zip(ins, (v, a, b, c, d)):
            self.put(s, x)
        return m.outputs['Result']

    def combine(self, x, y, z):
        c = self.n('ShaderNodeCombineXYZ')
        for s, v in zip(c.inputs, (x, y, z)):
            self.put(s, v)
        return c.outputs[0]

    def vscale(self, v, s):
        m = self.n('ShaderNodeVectorMath', operation='SCALE')
        self.put(m.inputs[0], v); self.put(m.inputs[3], s)
        return m.outputs[0]

    def instance(self, points, coll_socket, index, rotation, scale):
        ci = self.n('GeometryNodeCollectionInfo')
        self.put(ci.inputs['Collection'], coll_socket)
        ci.inputs['Separate Children'].default_value = True
        ci.inputs['Reset Children'].default_value = True
        iop = self.n('GeometryNodeInstanceOnPoints')
        self.L(points, iop.inputs['Points'])
        self.L(ci.outputs[0], iop.inputs['Instance'])
        iop.inputs['Pick Instance'].default_value = True
        self.put(iop.inputs['Instance Index'], index)
        self.put(iop.inputs['Rotation'], rotation)
        self.put(iop.inputs['Scale'], scale)
        return iop.outputs[0]

    def store(self, geo, name, value, kind='FLOAT', domain='POINT'):
        s = self.n('GeometryNodeStoreNamedAttribute', data_type=kind, domain=domain)
        self.L(geo, s.inputs['Geometry'])
        self.put(s.inputs['Name'], name)
        self.put([x for x in s.inputs if x.name == 'Value' and x.enabled][0], value)
        return s.outputs[0]

    def finish(self, geo):
        self.L(geo, self.go.inputs['Geometry'])
        return self.ng


def gn_surface_scatter():
    """Distribute instances on a mesh by a mask attribute; grow them with Growth (0..1)."""
    G = GN('MS_SurfaceScatter')
    G.inp('Density', 'NodeSocketFloat', 1000.0)
    G.inp('Mask', 'NodeSocketString')
    G.inp('Collection', 'NodeSocketCollection')
    G.inp('Growth', 'NodeSocketFloat', 1.0)
    G.inp('Seed', 'NodeSocketInt', 0)
    G.inp('Scale Min', 'NodeSocketFloat', 0.8)
    G.inp('Scale Max', 'NodeSocketFloat', 1.2)
    G.inp('Tilt', 'NodeSocketFloat', 0.25)
    G.inp('Sink', 'NodeSocketFloat', 0.0)
    G.inp('Mask Power', 'NodeSocketFloat', 1.0)
    G.inp('Upright', 'NodeSocketFloat', 0.0)
    mask = G.attr(G.g('Mask'))
    maskp = G.math('POWER', mask, G.g('Mask Power'))
    d = G.n('GeometryNodeDistributePointsOnFaces', distribute_method='RANDOM')
    G.L(G.g('Geometry'), d.inputs['Mesh'])
    G.L(G.math('MULTIPLY', G.g('Density'), maskp), d.inputs['Density'])
    G.L(G.g('Seed'), d.inputs['Seed'])
    pts = d.outputs['Points']
    s = G.math('MULTIPLY', G.rand(G.g('Scale Min'), G.g('Scale Max'), 3), G.mapr(mask, 0.0, 1.0, 0.55, 1.0, 'LINEAR'))
    delay = G.rand(0.0, 0.55, 4)
    grow = G.mapr(G.g('Growth'), delay, G.math('ADD', delay, 0.45), 0.0, 1.0)
    scale = G.math('MULTIPLY', s, grow)
    # sink along -normal (pebbles, crumbs half-embedded)
    sp = G.n('GeometryNodeSetPosition')
    G.L(pts, sp.inputs['Geometry'])
    G.L(G.vscale(d.outputs['Normal'], G.math('MULTIPLY', s, G.math('MULTIPLY', G.g('Sink'), -1.0))), sp.inputs['Offset'])
    # local z for instance shading
    pos = G.n('GeometryNodeInputPosition')
    sep = G.n('ShaderNodeSeparateXYZ'); G.L(pos.outputs[0], sep.inputs[0])
    pts = G.store(sp.outputs[0], 'hz', sep.outputs['Z'])
    # spatially coherent patch value for colour variation in the shader
    nz = G.n('ShaderNodeTexNoise', noise_dimensions='3D')
    G.L(pos.outputs[0], nz.inputs['Vector']); nz.inputs['Scale'].default_value = 9.0; nz.inputs['Detail'].default_value = 2.0
    pts = G.store(pts, 'patch', nz.outputs['Fac'])
    # orientation: blend between the surface normal and world up (plants stay upright on slopes)
    up = G.n('ShaderNodeVectorMath', operation='NORMALIZE')
    mixv = G.n('ShaderNodeMix', data_type='VECTOR')
    G.L(G.g('Upright'), mixv.inputs[0])
    G.L(d.outputs['Normal'], [x for x in mixv.inputs if x.name == 'A' and x.type == 'VECTOR'][0])
    [x for x in mixv.inputs if x.name == 'B' and x.type == 'VECTOR'][0].default_value = (0, 0, 1)
    G.L([x for x in mixv.outputs if x.type == 'VECTOR'][0], up.inputs[0])
    spin = G.n('FunctionNodeEulerToRotation'); G.L(G.combine(0.0, 0.0, G.rand(0.0, 6.2832, 7)), spin.inputs[0])
    al = G.n('FunctionNodeAlignRotationToVector', axis='Z')
    G.L(spin.outputs[0], al.inputs['Rotation']); G.L(up.outputs[0], al.inputs['Vector'])
    tilt = G.g('Tilt')
    eul = G.combine(G.rand(G.math('MULTIPLY', tilt, -1), tilt, 5), G.rand(G.math('MULTIPLY', tilt, -1), tilt, 6), 0.0)
    e2r = G.n('FunctionNodeEulerToRotation'); G.L(eul, e2r.inputs[0])
    rr = G.n('FunctionNodeRotateRotation', rotation_space='LOCAL')
    G.L(al.outputs[0], rr.inputs['Rotation']); G.L(e2r.outputs[0], rr.inputs['Rotate By'])
    idx = G.rand(0, 1000, 8, 'INT')
    out = G.instance(pts, G.g('Collection'), idx, rr.outputs[0], G.combine(scale, scale, scale))
    return G.finish(out)


def gn_point_instancer():
    """Instance a collection on hand-placed points (attributes: variant, rotz, scl, delay, tiltx, tilty)."""
    G = GN('MS_PlantPoints')
    G.inp('Collection', 'NodeSocketCollection')
    G.inp('Growth', 'NodeSocketFloat', 1.0)
    m2p = G.n('GeometryNodeMeshToPoints'); G.L(G.g('Geometry'), m2p.inputs['Mesh'])
    delay = G.attr('delay')
    g = G.mapr(G.g('Growth'), delay, G.math('ADD', delay, 0.5), 0.0, 1.0)
    lean = G.math('MULTIPLY', G.math('SUBTRACT', 1.0, g), 0.9)
    eul = G.combine(G.math('ADD', G.attr('tiltx'), lean), G.attr('tilty'), G.attr('rotz'))
    e2r = G.n('FunctionNodeEulerToRotation'); G.L(eul, e2r.inputs[0])
    sc = G.math('MULTIPLY', G.attr('scl'), G.math('ADD', 0.02, G.math('MULTIPLY', g, 0.98)))
    out = G.instance(m2p.outputs[0], G.g('Collection'), G.attr('variant', 'INT'), e2r.outputs[0], G.combine(sc, sc, sc))
    return G.finish(out)


def gn_crumbs():
    """Scrub-safe falling/drifting crumbs: u = fract(phase + Fall * speed); pos = P + dir * u * travel."""
    G = GN('MS_Crumbs')
    G.inp('Collection', 'NodeSocketCollection')
    G.inp('Fall', 'NodeSocketFloat', 0.0)
    G.inp('Amount', 'NodeSocketFloat', 1.0)
    m2p = G.n('GeometryNodeMeshToPoints'); G.L(G.g('Geometry'), m2p.inputs['Mesh'])
    u = G.math('FRACT', G.math('ADD', G.attr('phase'), G.math('MULTIPLY', G.g('Fall'), G.attr('speed'))))
    off = G.vscale(G.attr('dir', 'FLOAT_VECTOR'), G.math('MULTIPLY', u, G.attr('travel')))
    sp = G.n('GeometryNodeSetPosition'); G.L(m2p.outputs[0], sp.inputs['Geometry']); G.L(off, sp.inputs['Offset'])
    pts = G.store(sp.outputs[0], 'hz', G.attr('hz0'))
    fade = G.math('POWER', G.math('SINE', G.math('MULTIPLY', u, math.pi)), 0.35)
    keep = G.math('LESS_THAN', G.attr('rank'), G.g('Amount'))
    sc = G.math('MULTIPLY', G.math('MULTIPLY', G.attr('scl'), fade), keep)
    spin = G.vscale(G.attr('spin', 'FLOAT_VECTOR'), G.math('ADD', G.math('MULTIPLY', u, 6.0), G.attr('phase')))
    e2r = G.n('FunctionNodeEulerToRotation'); G.L(spin, e2r.inputs[0])
    out = G.instance(pts, G.g('Collection'), G.attr('variant', 'INT'), e2r.outputs[0], G.combine(sc, sc, sc))
    return G.finish(out)


def set_mod_inputs(mod, ng, **vals):
    for item in ng.interface.items_tree:
        if item.item_type == 'SOCKET' and item.in_out == 'INPUT' and item.name.replace(' ', '_') in vals:
            getattr(mod.properties.inputs, item.identifier).value = vals[item.name.replace(' ', '_')]


def points_mesh(name, pts, attrs, int_attrs=(), vec_attrs=()):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [], [])
    for k, vals in attrs.items():
        if k in int_attrs:
            a = me.attributes.new(k, 'INT', 'POINT'); a.data.foreach_set('value', [int(x) for x in vals])
        elif k in vec_attrs:
            a = me.attributes.new(k, 'FLOAT_VECTOR', 'POINT')
            a.data.foreach_set('vector', [c for v in vals for c in v])
        else:
            a = me.attributes.new(k, 'FLOAT', 'POINT'); a.data.foreach_set('value', vals)
    me.update()
    return me


# ------------------------------------------------------------------ probe
def build_probe(mats):
    # profile (r, z, material) from tip to cap; z is relative to the turf surface when seated
    prof = []
    def seg(r, z, m):
        prof.append((r, z, m))
    seg(0.0, -0.358, 'tip'); seg(0.004, -0.352, 'tip'); seg(0.0085, -0.338, 'tip'); seg(0.0102, -0.333, 'tip')
    seg(0.0108, -0.331, 'body')
    z = -0.331
    bands = [-0.30, -0.20, -0.10]
    for bi, bz in enumerate(bands):
        seg(0.011, bz - 0.0075, 'body'); seg(0.0104, bz - 0.0065, 'body')
        seg(0.0104, bz - 0.006, f'band{3 - bi}'); seg(0.0104, bz + 0.006, f'band{3 - bi}')
        seg(0.0104, bz + 0.0065, 'body'); seg(0.011, bz + 0.0075, 'body')
    seg(0.011, 0.028, 'body'); seg(0.0105, 0.029, 'body'); seg(0.0105, 0.031, 'body'); seg(0.011, 0.032, 'body')
    seg(0.011, 0.046, 'body')
    seg(0.0135, 0.047, 'cap'); seg(0.016, 0.049, 'cap'); seg(0.016, 0.071, 'cap'); seg(0.0152, 0.0745, 'cap')
    seg(0.0125, 0.0758, 'cap'); seg(0.0, 0.0762, 'cap')
    names = ['body', 'cap', 'tip', 'band1', 'band2', 'band3', 'led']
    segs = 64
    verts, faces, mi = [], [], []
    for i, (r, z, m) in enumerate(prof):
        for k in range(segs):
            a = 2 * math.pi * k / segs
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(len(prof) - 1):
        m = prof[i + 1][2] if prof[i][2] != prof[i + 1][2] and prof[i + 1][2].startswith('band') else prof[i][2]
        if prof[i][2].startswith('band') and prof[i + 1][2].startswith('band'):
            m = prof[i][2]
        elif prof[i][2].startswith('band') or prof[i + 1][2].startswith('band'):
            m = 'body'
        for k in range(segs):
            a = i * segs + k; b = i * segs + (k + 1) % segs
            faces.append((a, b, b + segs, a + segs)); mi.append(names.index(m))
    me = mesh_from('Probe', verts, faces, mat_idx=mi)
    # flat shading on hard steps
    for mname in names:
        me.materials.append(mats[mname])
    ob = bpy.data.objects.new('Probe', me)
    # weighted normals keep bevels crisp
    ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    # status LED on the cap
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.0022)
    bmesh.ops.scale(bm, vec=(1, 1, 0.5), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, 0.0764), verts=bm.verts)
    lme = bpy.data.meshes.new('ProbeLED'); bm.to_mesh(lme); bm.free(); lme.shade_smooth()
    lme.materials.append(mats['led'])
    led = bpy.data.objects.new('ProbeLED', lme)
    led.parent = ob
    return ob, led


# ------------------------------------------------------------------ roots, threads
def root_tube(B, path, r0, r1, sides=6):
    n = len(path)
    radii = [r0 + (r1 - r0) * (i / (n - 1)) ** 0.8 for i in range(n)]
    v, f, uv = tube(path, radii, sides)
    B.add(v, f, uv, 0)

def wander(start, d, length, steps, rr, droop=0.0, jitter=0.35, plane_x=None):
    pts = [Vector(start)]
    d = Vector(d).normalized()
    seg = length / steps
    for i in range(steps):
        d = (d + Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-1, 1))) * jitter + Vector((0, 0, -droop))).normalized()
        if plane_x is not None:
            d.x = 0; d = d.normalized() if d.length > 1e-6 else Vector((0, 0, -1))
        q = pts[-1] + d * seg
        if plane_x is not None:
            q.x = plane_x
        pts.append(q)
    return pts


def build_roots(soil_bvh):
    rr = random.Random(21)
    B = Builder()
    # hanging roots from the underside
    n = 0; tries = 0
    while n < 48 and tries < 800:
        tries += 1
        x, y = rr.uniform(-0.17, XCUT - 0.03), rr.uniform(-0.15, 0.15)
        hit = soil_bvh.ray_cast(Vector((x, y, -0.8)), Vector((0, 0, 1)))
        if hit[0] is None or hit[0].z > -0.2:
            continue
        p = hit[0] + Vector((0, 0, 0.006))
        L = rr.uniform(0.04, 0.16)
        path = wander(p, (rr.uniform(-.4, .4), rr.uniform(-.4, .4), -1), L, 18, rr, droop=0.25, jitter=0.22)
        r0 = rr.uniform(0.0009, 0.0026)
        root_tube(B, path, r0, 0.00015)
        for b in range(rr.randint(2, 6)):
            i = rr.randint(3, 14)
            bl = L * rr.uniform(0.15, 0.4)
            bp = wander(path[i], (rr.uniform(-1, 1), rr.uniform(-1, 1), -0.6), bl, 8, rr, droop=0.2, jitter=0.3)
            root_tube(B, bp, r0 * 0.45, 0.0001, 4)
        n += 1
    # fine rootlets out of the torn sides
    for k in range(110):
        a = rr.uniform(0, 2 * math.pi)
        z = rr.uniform(-0.3, -0.03)
        d = Vector((math.cos(a), math.sin(a), 0))
        origin = Vector((0.03, 0, z)) - d * 0.0
        hit = soil_bvh.ray_cast(origin + d * 0.5, -d)
        if hit[0] is None or hit[0].x > XCUT - 0.004:
            continue
        p = hit[0] - hit[1] * 0.003
        L = rr.uniform(0.006, 0.05)
        path = wander(p, (hit[1] + Vector((0, 0, -0.8))), L, 10, rr, droop=0.5, jitter=0.5)
        root_tube(B, path, rr.uniform(0.0002, 0.0005), 0.00008, 4)
    # roots exposed on the cut face (lie in the face, slightly proud)
    for k in range(18):
        y = rr.uniform(-0.16, 0.16); z = rr.uniform(-0.03, -0.006)
        L = rr.uniform(0.04, 0.22) * (1.0 if k % 3 else 0.5)
        r0 = rr.uniform(0.0004, 0.0011)
        path = wander((XCUT, y, z), (0, rr.uniform(-.3, .3), -1), L, 24, rr, droop=0.15, jitter=0.25, plane_x=XCUT)
        for i, q in enumerate(path):
            q.x = XCUT - r0 * 0.25
        root_tube(B, path, r0, 0.00012, 5)
        for b in range(rr.randint(1, 3)):
            i = rr.randint(4, 20)
            bp = wander(path[i], (0, rr.choice((-1, 1)), -0.5), L * rr.uniform(0.1, 0.3), 8, rr, droop=0.1, jitter=0.35, plane_x=XCUT - 0.0001)
            root_tube(B, bp, r0 * 0.4, 0.00008, 4)
    # cut root stubs poking out of the face
    for k in range(110):
        y = rr.uniform(-0.17, 0.17); z = -abs(rr.gauss(0.0, 0.11)) - 0.01
        if z < -0.33:
            continue
        r0 = rr.uniform(0.00025, 0.0009) * (1.4 if z > -0.08 else 1.0)
        L = rr.uniform(0.0015, 0.007)
        d = Vector((1, rr.uniform(-.4, .4), rr.uniform(-.6, .2)))
        path = [Vector((XCUT - 0.003, y, z)) + d.normalized() * (L * i / 4) for i in range(5)]
        root_tube(B, path, r0, r0 * 0.85, 6)
    return B.mesh('Roots')


def build_mycelium():
    rr = random.Random(5)
    B = Builder()
    for c in range(9):
        cy, cz = rr.uniform(-0.15, 0.15), rr.uniform(-0.1, -0.02)
        for t in range(rr.randint(10, 18)):
            p = Vector((XCUT + 0.0004, cy + rr.uniform(-0.012, 0.012), cz + rr.uniform(-0.01, 0.01)))
            path = wander(p, (0, rr.uniform(-1, 1), rr.uniform(-1, 1)), rr.uniform(0.006, 0.03), 14, rr, jitter=0.6, plane_x=None)
            for q in path:
                q.x = XCUT + 0.0002 + abs(noise.noise(q * 400)) * 0.0006
            root_tube(B, path, rr.uniform(0.00006, 0.0001), 0.00004, 3)
    return B.mesh('Mycelium')


# ------------------------------------------------------------------ main
def main():
    sc = reset_scene()
    root_coll = sc.collection
    spec_coll = bpy.data.collections.new('Specimen'); root_coll.children.link(spec_coll)
    assets = bpy.data.collections.new('Assets'); root_coll.children.link(assets)
    rig_coll = bpy.data.collections.new('Rig'); root_coll.children.link(rig_coll)

    root = bpy.data.objects.new('SpecimenRoot', None); spec_coll.objects.link(root)
    root.empty_display_size = 0.2

    m_soil, m_burrow = mat_soil()
    m_stone = mat_stone()
    m_moss = mat_moss()
    m_clover = mat_leaf('M_Clover', '#3f6a24', '#7f9c55')
    m_sorrel = mat_leaf('M_Sorrel', '#4d6b26', '#86985a', edge_red=True)
    m_grass = mat_grass()
    m_stem = mat_simple('M_Stem', hexc('#4f6a2a'), 0.5, trans=0.2)
    m_stem_red = mat_simple('M_StemRed', hexc('#6a3d26'), 0.5, trans=0.2)
    m_seed = mat_simple('M_Spikelet', hexc('#8a6f7a'), 0.6, trans=0.3)
    m_straw = mat_simple('M_Straw', hexc('#9c9157'), 0.55, trans=0.2)
    m_petal = mat_simple('M_Petal', hexc('#e6c229', 0.42), 0.5, trans=0.05)
    m_centre = mat_simple('M_Centre', hexc('#c98a12'), 0.6)
    m_root = mat_root()
    m_myco = mat_simple('M_Myco', hexc('#e3dfd2'), 0.6, trans=0.4)
    m_crumb = mat_crumb()
    m_peb = mat_pebble()
    pm = mat_probe()

    # ---- soil
    soil_me = build_soil_mesh()
    soil_me.materials.append(m_soil)
    soil = new_obj('Soil', soil_me, spec_coll, root)
    cut_coll = bpy.data.collections.new('Cutters'); root_coll.children.link(cut_coll)
    cutters = burrow_cutters(cut_coll)
    for c in cutters:
        c.data.materials.append(m_burrow)
    bool_coll = bpy.data.collections.new('BoolSet'); cut_coll.children.link(bool_coll)
    for c in cutters:
        bool_coll.objects.link(c)
    bm_ = soil.modifiers.new('cuts', 'BOOLEAN')
    bm_.operation = 'DIFFERENCE'; bm_.solver = 'EXACT'; bm_.operand_type = 'COLLECTION'; bm_.collection = bool_coll
    try:
        bm_.material_mode = 'TRANSFER'
    except Exception:
        pass
    new_me = evaluated_copy(soil, 'Soil')
    soil.modifiers.remove(bm_)
    old = soil.data; soil.data = new_me; bpy.data.meshes.remove(old)
    for c in list(cut_coll.all_objects):
        bpy.data.objects.remove(c)
    bpy.data.collections.remove(bool_coll); bpy.data.collections.remove(cut_coll)
    if len(soil.data.materials) < 2:
        soil.data.materials.append(m_burrow)
    soil_attributes(soil.data)
    soil.data.shade_smooth()
    sub = soil.modifiers.new('adaptive', 'SUBSURF')
    sub.subdivision_type = 'SIMPLE'
    sub.use_adaptive_subdivision = True
    sub.levels = 1; sub.render_levels = 2

    bm = bmesh.new(); bm.from_mesh(soil.data); soil_bvh = BVHTree.FromBMesh(bm); bm.free()

    # ---- stone
    stone_me = build_stone_mesh()
    stone_me.materials.append(m_stone)
    stone = new_obj('Stone', stone_me, spec_coll, root)
    sub = stone.modifiers.new('adaptive', 'SUBSURF')
    sub.subdivision_type = 'CATMULL_CLARK'
    sub.use_adaptive_subdivision = True
    sub.levels = 1; sub.render_levels = 2
    bm = bmesh.new(); bm.from_mesh(stone_me); stone_bvh = BVHTree.FromBMesh(bm); bm.free()

    # ---- asset collections
    def acoll(name, meshes, mats):
        c = bpy.data.collections.new(name); assets.children.link(c)
        for me in meshes:
            for m in mats:
                me.materials.append(m)
            o = bpy.data.objects.new(me.name, me); c.objects.link(o)
        return c
    A_moss = acoll('A_Moss', [asset_moss_sprig(s) for s in range(6)], [m_moss])
    A_frond = acoll('A_Frond', [asset_moss_frond(s) for s in range(5)], [m_moss])
    A_clover = acoll('A_Clover', [asset_clover(s) for s in range(6)], [m_stem, m_clover])
    A_sorrel = acoll('A_Sorrel', [asset_sorrel(s) for s in range(4)], [m_stem_red, m_sorrel])
    A_grass = acoll('A_Grass', [asset_grass(s) for s in range(8)], [m_grass])
    A_seed = acoll('A_Seed', [asset_seedhead(s) for s in range(4)], [m_straw, m_seed])
    A_flower = acoll('A_Flower', [asset_flower(s) for s in range(5)], [m_stem, m_petal, m_centre, m_clover])
    A_herb = acoll('A_Herb', [asset_herb(s) for s in range(6)], [m_stem, m_clover])
    A_crumb = acoll('A_Crumb', [asset_crumb(s) for s in range(8)], [m_crumb])
    A_peb = acoll('A_Pebble', [asset_pebble(s) for s in range(8)], [m_peb])
    vl = bpy.context.view_layer
    vl.layer_collection.children['Assets'].exclude = True

    # ---- surface scatters (share base meshes, output only instances)
    ng_s = gn_surface_scatter()
    def scatter(name, src, coll, **kw):
        o = new_obj(name, src.data, spec_coll, root)
        o.modifiers.clear()
        m = o.modifiers.new('scatter', 'NODES'); m.node_group = ng_s
        set_mod_inputs(m, ng_s, Collection=coll, **kw)
        return o
    scatter('SoilMoss', soil, A_moss, Density=300000.0, Mask='mosspatch', Seed=1, Scale_Min=0.8, Scale_Max=1.5, Tilt=0.3, Mask_Power=1.3, Upright=0.3)
    scatter('SoilFrond', soil, A_frond, Density=12000.0, Mask='turf', Seed=2, Scale_Min=0.8, Scale_Max=1.3, Tilt=0.5, Mask_Power=2.0, Upright=0.3)
    scatter('SoilDrape', soil, A_frond, Density=26000.0, Mask='drape', Seed=14, Scale_Min=0.8, Scale_Max=1.4, Tilt=0.6, Upright=0.0)
    scatter('SoilDrapeHerb', soil, A_herb, Density=900.0, Mask='drape', Seed=15, Scale_Min=0.9, Scale_Max=1.3, Tilt=0.5, Mask_Power=2.0, Upright=0.2)
    scatter('SoilClover', soil, A_clover, Density=2600.0, Mask='cloverpatch', Seed=9, Scale_Min=0.95, Scale_Max=1.35, Tilt=0.15, Upright=0.9)
    scatter('SoilHerb', soil, A_herb, Density=2200.0, Mask='herbpatch', Seed=10, Scale_Min=1.1, Scale_Max=1.5, Tilt=0.2, Upright=0.85)
    scatter('SoilGrass', soil, A_grass, Density=90.0, Mask='grasspatch', Seed=11, Scale_Min=0.55, Scale_Max=1.0, Tilt=0.2, Upright=0.9)
    scatter('SoilCrumbs', soil, A_crumb, Density=32000.0, Mask='crumbmask', Seed=3, Scale_Min=0.001, Scale_Max=0.0045, Tilt=3.0, Sink=0.5, Mask_Power=1.5)
    scatter('FaceCrumbs', soil, A_crumb, Density=450000.0, Mask='cutface', Seed=16, Scale_Min=0.0007, Scale_Max=0.0032, Tilt=3.0, Sink=0.45)
    scatter('SoilPebbles', soil, A_peb, Density=650.0, Mask='pebble', Seed=4, Scale_Min=0.003, Scale_Max=0.011, Tilt=3.0, Sink=0.45, Mask_Power=1.5)
    scatter('StoneMoss', stone, A_moss, Density=300000.0, Mask='mossmask', Seed=5, Scale_Min=0.6, Scale_Max=1.15, Tilt=0.35, Mask_Power=1.2)
    scatter('StoneFrond', stone, A_frond, Density=9000.0, Mask='mossmask', Seed=6, Scale_Min=0.6, Scale_Max=1.0, Tilt=0.6, Mask_Power=2.0)
    scatter('StoneHerb', stone, A_herb, Density=2500.0, Mask='mossmask', Seed=12, Scale_Min=0.8, Scale_Max=1.2, Tilt=0.2, Mask_Power=3.0, Upright=0.7)
    scatter('StoneClover', stone, A_clover, Density=1400.0, Mask='mossmask', Seed=13, Scale_Min=0.9, Scale_Max=1.3, Tilt=0.2, Mask_Power=3.0, Upright=0.8)

    # ---- hand-placed plants on the turf
    rr = random.Random(77)
    def turf_point(x, y):
        h = soil_bvh.ray_cast(Vector((x, y, 0.5)), Vector((0, 0, -1)))
        if h[0] is None or h[1].z < 0.5:
            return None
        hs = stone_bvh.ray_cast(Vector((x, y, 0.5)), Vector((0, 0, -1)))
        if hs[0] is not None and hs[0].z > h[0].z - 0.004:
            return None
        return h[0]
    def place(kind_coll, n, region, nvar, scl, tilt=0.12, delay=(0.0, 0.4), avoid_probe=True, name='P'):
        pts, at = [], {k: [] for k in ('variant', 'rotz', 'scl', 'delay', 'tiltx', 'tilty')}
        tries = 0
        while len(pts) < n and tries < n * 80:
            tries += 1
            x, y = region()
            if avoid_probe and abs(y - PROBE_Y) < 0.035 and x > XCUT - 0.05:
                continue
            p = turf_point(x, y)
            if p is None:
                continue
            pts.append(p - Vector((0, 0, 0.002)))
            at['variant'].append(rr.randrange(nvar)); at['rotz'].append(rr.uniform(0, 6.283))
            at['scl'].append(rr.uniform(*scl)); at['delay'].append(rr.uniform(*delay))
            at['tiltx'].append(rr.uniform(-tilt, tilt)); at['tilty'].append(rr.uniform(-tilt, tilt))
        me = points_mesh(name, pts, at, int_attrs=('variant',))
        o = new_obj(name, me, spec_coll, root)
        m = o.modifiers.new('inst', 'NODES'); m.node_group = ng_p
        set_mod_inputs(m, ng_p, Collection=kind_coll)
        return o
    ng_p = gn_point_instancer()
    anywhere = lambda: (rr.uniform(-0.2, XCUT), rr.uniform(-0.19, 0.19))
    front_right = lambda: (rr.uniform(-0.02, XCUT), rr.uniform(-0.2, -0.04))
    back = lambda: (rr.uniform(-0.2, XCUT), rr.uniform(0.06, 0.2))
    front_left = lambda: (rr.uniform(-0.22, -0.05), rr.uniform(-0.2, -0.02))
    place(A_sorrel, 3, back, 4, (1.3, 1.6), delay=(0.1, 0.4), name='Sorrel')
    place(A_sorrel, 2, front_right, 4, (1.0, 1.3), delay=(0.15, 0.45), name='Sorrel2')
    place(A_grass, 7, back, 8, (0.8, 1.15), tilt=0.2, delay=(0.15, 0.5), name='GrassBack')
    place(A_seed, 3, back, 4, (0.9, 1.1), tilt=0.12, delay=(0.3, 0.5), name='Seedheads')
    place(A_flower, 6, lambda: (rr.uniform(-0.15, XCUT - 0.03), rr.uniform(-0.18, 0.05)), 5, (1.0, 1.25), tilt=0.1, delay=(0.35, 0.5), name='Tormentil')

    # ---- roots and mycelium
    roots = new_obj('Roots', build_roots(soil_bvh), spec_coll, root)
    roots.data.materials.append(m_root)
    myco = new_obj('Mycelium', build_mycelium(), spec_coll, root)
    myco.data.materials.append(m_myco)

    # ---- crumbs: falling from the underside (child of specimen) and drifting in world space
    ng_c = gn_crumbs()
    def crumb_points(name, n, gen, parent):
        at = {k: [] for k in ('phase', 'speed', 'travel', 'scl', 'variant', 'hz0', 'rank')}
        dirs, spins, pts = [], [], []
        for i in range(n):
            p, d, speed, travel, scl, hz = gen(i)
            pts.append(p); dirs.append(d)
            spins.append((rr.uniform(-2, 2), rr.uniform(-2, 2), rr.uniform(-2, 2)))
            at['phase'].append(rr.random()); at['speed'].append(speed); at['travel'].append(travel)
            at['scl'].append(scl); at['variant'].append(rr.randrange(8)); at['hz0'].append(hz); at['rank'].append(rr.random())
        at['dir'] = dirs; at['spin'] = spins
        me = points_mesh(name, pts, at, int_attrs=('variant',), vec_attrs=('dir', 'spin'))
        o = new_obj(name, me, spec_coll, parent)
        m = o.modifiers.new('crumbs', 'NODES'); m.node_group = ng_c
        set_mod_inputs(m, ng_c, Collection=A_crumb)
        return o
    def fall_gen(i):
        while True:
            x, y = rr.uniform(-0.18, XCUT - 0.01), rr.uniform(-0.16, 0.16)
            h = soil_bvh.ray_cast(Vector((x, y, -0.8)), Vector((0, 0, 1)))
            if h[0] is not None and h[0].z < -0.2:
                break
        return (h[0] - Vector((0, 0, 0.004)), Vector((rr.uniform(-.05, .05), rr.uniform(-.05, .05), -1)),
                rr.uniform(0.6, 1.2), rr.uniform(0.08, 0.2), rr.uniform(0.0012, 0.0045), -0.3)
    crumb_points('CrumbsFall', 70, fall_gen, root)
    def drift_gen(i):
        p = Vector((rr.uniform(-0.6, 0.6), rr.uniform(-0.55, 0.5), rr.uniform(-0.7, 0.35)))
        if abs(p.x) < 0.3 and abs(p.y) < 0.26 and -0.48 < p.z < 0.2:
            p.x += 0.35 * (1 if p.x > 0 else -1)
        if i < 8:  # a few close to the lens, thrown out of focus
            p = Vector((rr.choice((-1, 1)) * rr.uniform(0.05, 0.14), rr.uniform(-1.25, -1.0), rr.uniform(-0.25, 0.05)))
        big = rr.random() < 0.3
        return (p, Vector((rr.uniform(-.2, .2), rr.uniform(-.2, .2), -1)), rr.uniform(0.15, 0.4),
                rr.uniform(0.15, 0.35), rr.uniform(0.003, 0.0065) if big else rr.uniform(0.0008, 0.0026), rr.uniform(-0.12, -0.02))
    crumb_points('CrumbsDrift', 160, drift_gen, None)

    # ---- probe
    probe, led = build_probe(pm)
    spec_coll.objects.link(probe); spec_coll.objects.link(led)
    probe.parent = root
    probe.location = (XCUT + 0.0025, PROBE_Y, 0.0)

    # ---- anchors (empties) for the DOM labels
    def anchor(name, loc, parent=root):
        e = bpy.data.objects.new(name, None); rig_coll.objects.link(e)
        e.parent = parent; e.location = loc; e.empty_display_size = 0.01
        return e
    def surface_near(dirn, z):
        d = Vector((dirn[0], dirn[1], 0)).normalized()
        h = soil_bvh.ray_cast(Vector((0.03, 0, z)) + d * 0.6, -d)
        return h[0] if h[0] is not None else Vector((0.03, 0, z)) + d * 0.2
    anchor('A_soc', surface_near((-0.35, -1), -0.13))
    anchor('A_depth', surface_near((-0.7, -1), -0.30))
    hs = stone_bvh.ray_cast(STONE_C + Vector((-0.06, -0.35, 0.01)), Vector((0, 1, 0)))
    anchor('A_moss', hs[0] if hs[0] is not None else STONE_C)
    for i, z in enumerate((-0.10, -0.20, -0.30)):
        anchor(f'A_band{i + 1}', Vector((0.0115, 0, z)), probe)
    anchor('A_ruler_top', Vector((XCUT + 0.001, PROBE_Y - 0.035, 0.0)))
    anchor('A_ruler_30', Vector((XCUT + 0.001, PROBE_Y - 0.035, -0.30)))
    anchor('A_face', Vector((XCUT, 0.03, -0.17)))

    # ---- lights and world
    world = bpy.data.worlds.new('Forest'); sc.world = world
    world.use_nodes = True
    wn = world.node_tree.nodes; wl = world.node_tree.links
    wn.clear()
    bg = wn.new('ShaderNodeBackground'); wo = wn.new('ShaderNodeOutputWorld')
    tc = wn.new('ShaderNodeTexCoord'); sep = wn.new('ShaderNodeSeparateXYZ'); rp = wn.new('ShaderNodeValToRGB')
    wl.new(tc.outputs['Generated'], sep.inputs[0]); wl.new(sep.outputs['Z'], rp.inputs[0])
    rp.color_ramp.elements[0].position = 0.35; rp.color_ramp.elements[0].color = (0.003, 0.005, 0.003, 1)
    rp.color_ramp.elements[1].position = 0.75; rp.color_ramp.elements[1].color = (0.03, 0.042, 0.03, 1)
    wl.new(rp.outputs[0], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
    wl.new(bg.outputs[0], wo.inputs['Surface'])

    def area(name, loc, target, size, energy, color, shape='RECTANGLE', size_y=None):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = shape; ld.size = size; ld.size_y = size_y or size
        ld.energy = energy; ld.color = color
        o = bpy.data.objects.new(name, ld); rig_coll.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o
    area('Key', (-1.55, -0.55, 1.25), (0, 0, -0.05), 0.8, 270.0, (1.0, 0.84, 0.66), size_y=0.6)
    area('Rim', (0.95, 1.25, 0.55), (0, 0, -0.08), 0.5, 600.0, (0.72, 1.0, 0.6), size_y=1.0)
    area('Top', (0.2, 0.9, 1.4), (0, 0, 0.0), 0.6, 150.0, (1.0, 0.93, 0.82))
    area('Rim2', (-1.1, 1.0, 0.2), (0, 0, -0.15), 0.5, 120.0, (0.85, 0.95, 0.8), size_y=0.9)
    area('Fill', (1.6, -1.4, -0.25), (0, 0, -0.12), 1.8, 14.0, (0.82, 0.9, 1.0))
    area('Under', (0.0, -0.6, -1.2), (0, 0, -0.2), 1.0, 3.0, (0.75, 0.9, 0.7))
    rake = area('Rake', (0.6, -1.0, 0.4), (XCUT, 0, -0.15), 0.5, 0.0, (1.0, 0.9, 0.78), size_y=0.25)
    strip = area('Strip', (0.6, -1.0, 0.0), (XCUT, 0, -0.15), 0.06, 0.0, (1.0, 0.97, 0.92), size_y=0.9)
    # light linking: the strip only lights the probe (a long highlight without washing the soil)
    pcoll = bpy.data.collections.new('ProbeOnly'); root_coll.children.link(pcoll)
    bpy.context.view_layer.layer_collection.children['ProbeOnly'].exclude = True
    for o in (probe, led):
        pcoll.objects.link(o)
    strip.light_linking.receiver_collection = pcoll

    # ---- cameras
    for name, lens in (('CamHero', 85.0), ('CamCut', 50.0)):
        cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36.0; cd.sensor_fit = 'HORIZONTAL'
        cd.dof.use_dof = True; cd.dof.aperture_fstop = 8.0
        cd.clip_start = 0.01; cd.clip_end = 20
        co = bpy.data.objects.new(name, cd); rig_coll.objects.link(co)
    focus = bpy.data.objects.new('Focus', None); rig_coll.objects.link(focus)
    for name in ('CamHero', 'CamCut'):
        bpy.data.objects[name].data.dof.focus_object = focus

    sc.camera = bpy.data.objects['CamHero']
    out = os.path.join(HERE, 'specimen.blend')
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print('SAVED', out)


if __name__ == '__main__':
    main()
