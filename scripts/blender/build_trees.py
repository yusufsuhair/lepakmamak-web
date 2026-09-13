"""Photographic city trees: the rain tree (pokok hujan, Samanea saman) that shades KL's roads and
the city coconut palm. Both are instanced dozens of times (src/foliage.ts), so each variant is
one mesh with two materials: bark, and an alpha-tested leaf atlas that casts leaf-shaped shadows.

What is here
  * rain tree: a short buttressed trunk that splits low into four or five sinuous limbs, forking
    out to a flat-topped umbrella crown wider than it is tall. The crown is clumps of leaf-cluster
    cards painted from bipinnate leaves (tree_textures.py), with bird's nest ferns on the limbs
  * coconut palm: the beach palm's shape (build_beach.py coconut_palm): swollen bole, bowed ringed
    trunk, fibrous crown, young/old/dead fronds and a nut bunch, but each frond is a V of leaflet
    cards instead of hundreds of leaflet triangles
  * two variants per family (node extras lm_variant); the runtime gives each placement one of
    them by its coordinates, so a street of trees never repeats one silhouette
  * leaf-card normals bend toward the outside of the crown, so a canopy shades as one soft volume
    instead of a thousand flat cards (the runtime keeps them facing the same way on both sides)

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_trees.py

Output: public/assets/models/foliage/LM_TREE_RainTree.glb and LM_TREE_CoconutPalm.glb (meshopt
compressed by compress-glb.mjs), a report at assets/trees/manifest.json.
"""
import bpy, math, json, random, shutil, subprocess, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_lrt import pt
import pbr_kit as kit
import tree_textures as TT

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/trees'
PUBLIC = ROOT / 'public/assets/models/foliage'
VERSION = 5
UP = Vector((0, 1, 0))
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
kit.setup('trees', OUT / 'textures', 20260914)


# ------------------------------------------------------------------ materials
def rgba_image(name, arr, data=False):
    """kit.image makes RGB images; the leaf atlases need their alpha, so write RGBA PNGs."""
    h, w = arr.shape[:2]
    if arr.shape[-1] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1))], -1)
    tmp = bpy.data.images.new(name + '_src', w, h, alpha=True)
    tmp.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    path = kit.OUT / f'{name}.png'
    tmp.filepath_raw, tmp.file_format = str(path), 'PNG'
    tmp.save()
    bpy.data.images.remove(tmp)
    im = bpy.data.images.load(str(path), check_existing=False)
    im.name = name
    if data:
        im.colorspace_settings.name = 'Non-Color'
    im.pack()
    return im


def leaf_material(name, kind, tint, rough, cutoff=.5):
    """Atlas x tint, alpha clipped at `cutoff` (the node shape the glTF exporter reads as MASK),
    tangent normal map (at half size: leaflet relief survives it and it halves the download),
    double sided."""
    colour, normal = getattr(TT, kind)()
    h, w = normal.shape[0] // 2, normal.shape[1] // 2
    normal = normal[:h * 2, :w * 2].reshape(h, 2, w, 2, 3).mean((1, 3))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = rgba_image(kind + '_color', colour)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    nt.links.new(tc.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*kit.srgb(tint), 1)
    nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
    less = nt.nodes.new('ShaderNodeMath')
    less.operation = 'LESS_THAN'
    less.inputs[1].default_value = cutoff
    nt.links.new(tc.outputs['Alpha'], less.inputs[0])
    keep = nt.nodes.new('ShaderNodeMath')
    keep.operation = 'SUBTRACT'
    keep.inputs[0].default_value = 1
    nt.links.new(less.outputs['Value'], keep.inputs[1])
    nt.links.new(keep.outputs['Value'], p.inputs['Alpha'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = rgba_image(kind + '_normal', normal, data=True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = rough
    m.use_backface_culling = False
    return m


RAIN_BARK = kit.pbr('Rain tree bark', 'rain_tree_bark', '#ffffff', .92, .9, strength=1.4, source=TT)
RAIN_LEAF = leaf_material('Rain tree leaves', 'rain_tree_leaves', '#ffffff', .72)
PALM_TRUNK = kit.pbr('Palm trunk', 'bark', '#a8988a', .9, 1.2)
PALM_LEAF = leaf_material('Palm fronds', 'palm_leaves', '#dde5d0', .6)


# ------------------------------------------------------------------ mesh builder
class Build:
    """Faces with per-corner UVs and normals in game space (y up), one material index each."""

    def __init__(self, mats):
        self.mats, self.V, self.F, self.index = mats, [], [], {}

    def vertex(self, p):
        """Corners at one position share a vertex (the exporter splits it again where UVs or
        normals differ), so tubes and card quads are indexed instead of unwelded triangles."""
        key = (round(p.x, 5), round(p.y, 5), round(p.z, 5))
        if key not in self.index:
            self.index[key] = len(self.V)
            self.V.append(p)
        return self.index[key]

    def face(self, points, uvs, normals, m):
        pts = [Vector(p) for p in points]
        normals = [Vector(n).normalized() for n in normals]
        geometric = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if geometric.length < 1e-9:
            return
        if geometric.dot(sum(normals, Vector())) < 0:   # front face toward the given normals
            pts, uvs, normals = pts[::-1], uvs[::-1], normals[::-1]
        idx = tuple(self.vertex(p) for p in pts)
        if len(set(idx)) == len(idx):
            self.F.append((idx, uvs, normals, self.mats.index(m)))

    def quad(self, a, b, c, d, uva, uvb, uvc, uvd, na, nb, nc, nd, m):
        self.face([a, b, c], [uva, uvb, uvc], [na, nb, nc], m)
        self.face([a, c, d], [uva, uvc, uvd], [na, nc, nd], m)

    def object(self, name, props):
        me = bpy.data.meshes.new(name)
        me.from_pydata([pt(*v) for v in self.V], [], [f[0] for f in self.F])
        uv = me.uv_layers.new(name='UVMap')
        loops = []
        for poly, (_, uvs, normals, mi) in zip(me.polygons, self.F):
            poly.material_index, poly.use_smooth = mi, True
            for li, u, n in zip(poly.loop_indices, uvs, normals):
                uv.data[li].uv = u
                loops.append(pt(*n))
        for m in self.mats:
            me.materials.append(m)
        me.normals_split_custom_set(loops)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        for key, value in props.items():
            ob[key] = value
        return ob


def catmull(points, samples):
    P = [Vector(p) for p in points]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(samples):
            t = s / samples
            out.append(.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out


def tube(b, points, radii, sides, m, tile, flare=None):
    """Bark tube with parallel-transported rings: u runs along the member in metres / tile (grain
    and leaf-scar rings follow it), v wraps a whole number of times around."""
    P = [Vector(p) for p in points]
    T = [(P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized() for i in range(len(P))]
    N = T[0].orthogonal().normalized()
    wraps = max(1, round(2 * math.pi * radii[0] / tile))
    rings, u = [], 0.0
    for i, p in enumerate(P):
        if i:
            N = (N - T[i] * N.dot(T[i])).normalized()
            u += (P[i] - P[i - 1]).length / tile
        B = T[i].cross(N)
        ring = []
        for k in range(sides + 1):
            a = 2 * math.pi * k / sides
            d = N * math.cos(a) + B * math.sin(a)
            r = radii[i] * (flare(p, a) if flare else 1)
            q = p + d * r
            if i == 0 and abs(p.y) < 1e-6:
                q.y = 0   # a member rising from the ground keeps its base ring on it
            ring.append((q, d, (u, wraps * k / sides)))
        rings.append(ring)
    for i in range(len(P) - 1):
        for k in range(sides):
            a, bb, c, d = rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]
            b.quad(a[0], bb[0], c[0], d[0], a[2], bb[2], c[2], d[2], a[1], bb[1], c[1], d[1], m)
    return P


def card(b, centre, facing, size, cell, normal, R, m, cells=2, inset=.004):
    """A square leaf card turned to `facing`, rolled at random, mapped to one atlas cell."""
    f = Vector(facing).normalized()
    a = f.orthogonal().normalized()
    roll = R.uniform(0, 2 * math.pi)
    a = a * math.cos(roll) + f.cross(a) * math.sin(roll)
    c = f.cross(a)
    h = size / 2
    col, row = cell % cells, cell // cells
    u0, u1 = col / cells + inset, (col + 1) / cells - inset
    v1, v0 = 1 - row / cells - inset, 1 - (row + 1) / cells + inset
    corners = [centre - a * h - c * h, centre + a * h - c * h, centre + a * h + c * h, centre - a * h + c * h]
    b.quad(*corners, (u0, v0), (u1, v0), (u1, v1), (u0, v1), normal, normal, normal, normal, m)


# ------------------------------------------------------------------ rain tree
RAIN_VARIANTS = {
    'A': dict(seed=11, limbs=5, split=2.05, reach=(3.0, 3.9), crown=5.0, top=6.9, stretch=(1.0, 1.0)),
    'B': dict(seed=23, limbs=4, split=2.35, reach=(2.8, 3.7), crown=4.7, top=6.6, stretch=(1.14, .9)),
}


def rain_tree(v):
    """Samanea saman as KL's roads grow it: buttressed trunk, a low split into sinuous limbs that
    fork outward, clumps of fine foliage forming a flat-topped umbrella, ferns in the forks."""
    R = random.Random(v['seed'])
    b = Build([RAIN_BARK, RAIN_LEAF])
    sx, sz = v['stretch']
    lean = Vector((R.uniform(-.2, .2), 0, R.uniform(-.2, .2)))
    split = v['split']
    phase = R.uniform(0, 6)

    def buttress(p, a):   # root flare: four lobes swelling into the ground
        k = max(0.0, 1 - p.y / 1.1)
        return 1 + k * k * (.55 + .45 * math.cos(4 * a + phase))
    # the first span rises plumb, so the base ring lies flat on the ground
    trunk = catmull([(0, 0, 0), (0, .45, 0), (lean.x * .3, split * .6, lean.z * .3), (lean.x, split + .15, lean.z)], 3)
    tube(b, trunk, [.46 - .1 * i / (len(trunk) - 1) for i in range(len(trunk))], 12, RAIN_BARK, .9, buttress)
    top = Vector(trunk[-1])
    skeleton = []   # (point, radius) where twigs can leave for the crown

    def limb(points, r0, r1, sides, samples):
        pts = catmull(points, samples)
        radii = [r0 + (r1 - r0) * (i / (len(pts) - 1)) ** .8 for i in range(len(pts))]
        tube(b, pts, radii, sides, RAIN_BARK, .9)
        skeleton.extend(zip(pts, radii))
        return pts, radii

    ends = []
    az0 = R.uniform(0, 2 * math.pi)
    for i in range(v['limbs']):
        az = az0 + i * 2 * math.pi / v['limbs'] + R.uniform(-.3, .3)
        h = Vector((math.cos(az) * sx, 0, math.sin(az) * sz))
        side = Vector((-math.sin(az), 0, math.cos(az)))
        reach, rise, wob = R.uniform(*v['reach']), R.uniform(2.0, 2.8), R.uniform(.25, .55) * R.choice((-1, 1))
        start = top - UP * .35 + h * .08
        ctrl = [start, top + h * reach * .3 + UP * rise * .45 + side * wob,
                top + h * reach * .66 + UP * rise * .82 - side * wob * .7, top + h * reach + UP * rise]
        pts, radii = limb(ctrl, R.uniform(.25, .3), .06, 8, 4)
        ends.append(pts[-1])
        for t in (.5, .75, 1.0):   # forks, swinging out and levelling off into the umbrella
            k = min(int(t * (len(pts) - 1)), len(pts) - 2)
            base, r = pts[k], radii[k]
            dir_ = (pts[k + 1] - pts[k])
            dir_.y = 0
            turn = R.uniform(.45, .9) * R.choice((-1, 1))
            dir_ = Vector((dir_.x * math.cos(turn) - dir_.z * math.sin(turn), 0, dir_.x * math.sin(turn) + dir_.z * math.cos(turn))).normalized()
            length = R.uniform(1.5, 2.4)
            end = base + dir_ * length + UP * length * R.uniform(.2, .5)
            mid = base.lerp(end, .5) + UP * R.uniform(.1, .3) + side * R.uniform(-.25, .25)
            spts, _ = limb([base, mid, end], min(r * .75, .12), .022, 6, 3)
            ends.append(spts[-1])
    # clump sites: every branch end, then fill the umbrella wherever a gap is left
    crown, topy = v['crown'], v['top']
    dome = lambda x, z: topy - .9 - .045 * ((x / sx) ** 2 + (z / sz) ** 2)
    sites = [Vector((e.x, (e.y + dome(e.x, e.z)) / 2 + .2, e.z)) for e in ends]
    for gx in np.arange(-crown, crown + .01, 1.45):
        for gz in np.arange(-crown, crown + .01, 1.45):
            x, z = gx * sx + R.uniform(-.4, .4), gz * sz + R.uniform(-.4, .4)
            if (x / sx) ** 2 + (z / sz) ** 2 > (crown - .6) ** 2:
                continue
            if all((Vector((x, 0, z)) - Vector((s.x, 0, s.z))).length > 1.3 for s in sites):
                site = Vector((x, dome(x, z) + R.uniform(-.15, .15), z))
                anchor, r = min(skeleton, key=lambda s: (s[0] - site).length + (0 if s[0].y < site.y else 3))
                tip = anchor.lerp(site, .8)
                limb([anchor, anchor.lerp(tip, .5) + UP * .2, tip], min(r * .7, .06), .025, 4, 2)
                sites.append(site)
    centre = Vector((0, split + 2.4, 0))
    leaves = 0
    for s in sites:
        rx, ry = R.uniform(1.35, 1.75), R.uniform(.6, .85)
        for _ in range(int(R.uniform(34, 44))):
            d = Vector((R.gauss(0, 1), R.gauss(0, 1), R.gauss(0, 1))).normalized()
            if d.y < -.25 and R.random() < .55:
                d.y = -d.y   # more foliage on top of a clump than under it
            pos = s + Vector((d.x * rx, d.y * ry, d.z * rx)) * R.uniform(.45, 1.0)
            # cards on a clump's crown open to the sky, so the umbrella reads closed from above
            facing = (d + UP * max(0.0, d.y) * .8 + Vector((R.gauss(0, .45), R.gauss(0, .45), R.gauss(0, .45)))).normalized()
            out = pos - centre
            out.y *= 1.7
            normal = (out.normalized() * .6 + d * .4).normalized()
            cell = 2 if d.y > .35 and R.random() < .55 else (0 if R.random() < .6 else 1)
            card(b, pos, facing, R.uniform(1.1, 1.55), cell, normal, R, RAIN_LEAF)
            leaves += 1
    # bird's nest ferns sit in the upper forks: three crossed cards of the fern cell
    for p, r in R.sample([s for s in skeleton if 2.6 < s[0].y < 4.4 and s[1] > .12], 4):
        base = p + UP * r * .8
        size = R.uniform(.75, 1.0)
        spin = R.uniform(0, math.pi)
        for k in range(3):
            a = spin + k * math.pi / 3
            across = Vector((math.cos(a), 0, math.sin(a))) * size / 2
            lift = UP * size
            n = UP
            b.quad(base - across, base + across, base + across + lift, base - across + lift,
                   (.504, .004), (.996, .004), (.996, .496), (.504, .496), n, n, n, n, RAIN_LEAF)
    return b, dict(clumps=len(sites), cards=leaves)


# ------------------------------------------------------------------ coconut palm
PALM_VARIANTS = {
    'A': dict(seed=5, height=7.6, lean=.17, fronds=20, wiggle=0.0),
    'B': dict(seed=9, height=6.9, lean=.3, fronds=18, wiggle=.18),
}
FROND = {   # atlas column, v range, leaflet droop at base and tip (degrees)
    'young': (0, (0, 1), 18, 40), 'mid': (0, (0, 1), 30, 62), 'weathered': (1, (0, 1), 34, 66),
    'old': (2, (.25, 1), 48, 78), 'dead': (3, (.25, 1), 80, 88)}


def coconut_palm(v):
    """Cocos nucifera after build_beach.py: swollen bole, slender ringed trunk bowing toward the
    light, fibrous crown, arching fronds (young upright, old yellowed and drooping, dead hanging)
    and a bunch of nuts under the crown."""
    R = random.Random(v['seed'])
    b = Build([PALM_TRUNK, PALM_LEAF])
    H, lean = v['height'], v['lean']
    pts, rs = [], []
    for s in range(15):
        t = s / 14
        pts.append((lean * H * t ** 1.6, H * t, v['wiggle'] * math.sin(t * 5.5) * t))
        rs.append(.2 * (1 - t) * .45 + .13 + .1 * max(0, .15 - t) / .15)
    trunk = tube(b, pts, rs, 10, PALM_TRUNK, 1.2)
    top, tipdir = trunk[-1], (trunk[-1] - trunk[-2]).normalized()
    # crown shaft: the fibre swatch wrapped once around a short bulge
    shaft = [top - tipdir * .25, top + tipdir * .2, top + tipdir * .55]
    P = [Vector(p) for p in shaft]
    N = tipdir.orthogonal().normalized()
    Bv = tipdir.cross(N)
    rings = []
    for i, (p, r) in enumerate(zip(P, (.15, .21, .12))):
        rings.append([(p + (N * math.cos(2 * math.pi * k / 8) + Bv * math.sin(2 * math.pi * k / 8)) * r,
                       N * math.cos(2 * math.pi * k / 8) + Bv * math.sin(2 * math.pi * k / 8),
                       (.754 + .242 * k / 8, .004 + .242 * i / 2)) for k in range(9)])
    for i in range(2):
        for k in range(8):
            a, bb, c, d = rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]
            b.quad(a[0], bb[0], c[0], d[0], a[2], bb[2], c[2], d[2], a[1], bb[1], c[1], d[1], PALM_LEAF)
    crown = top + tipdir * .3
    for k in range(7):   # nuts: small ellipsoids on the nut swatch
        a = k * 2.4
        c = crown + Vector((math.cos(a) * (.24 + .06 * (k % 2)), -.3 - .1 * (k % 3), math.sin(a) * (.24 + .06 * (k % 2))))
        rad = .14
        grid = []
        for i in range(5):
            lat = -math.pi / 2 + math.pi * i / 4
            grid.append([(c + Vector((math.cos(lat) * math.cos(2 * math.pi * j / 7), math.sin(lat) * 1.15, math.cos(lat) * math.sin(2 * math.pi * j / 7))) * rad,
                          Vector((math.cos(lat) * math.cos(2 * math.pi * j / 7), math.sin(lat), math.cos(lat) * math.sin(2 * math.pi * j / 7))),
                          (.504 + .242 * j / 7, .004 + .242 * i / 4)) for j in range(8)])
        for i in range(4):
            for j in range(7):
                q = grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]
                if i == 0:
                    b.face([q[0][0], q[3][0], q[2][0]], [q[0][2], q[3][2], q[2][2]], [q[0][1], q[3][1], q[2][1]], PALM_LEAF)
                elif i == 3:
                    b.face([q[0][0], q[1][0], q[2][0]], [q[0][2], q[1][2], q[2][2]], [q[0][1], q[1][1], q[2][1]], PALM_LEAF)
                else:
                    b.quad(*(x[0] for x in q), *(x[2] for x in q), *(x[1] for x in q), PALM_LEAF)
    count = v['fronds']
    for f in range(count):
        age = f / (count - 1)
        a = f * 2.39996 + R.uniform(-.15, .15)
        hx, hz = math.cos(a), math.sin(a)
        heading, across = Vector((hx, 0, hz)), Vector((-hz, 0, hx))
        dead = f >= count - 2
        kind = 'dead' if dead else 'young' if age < .15 else 'old' if age > .82 else ('weathered' if f % 3 == 0 else 'mid')
        column, (va, vb), droop0, droop1 = FROND[kind]
        elev = math.radians(-74 if dead else 58 - 95 * age + R.uniform(-7, 7))
        L = R.uniform(3.4, 4.2) * (1 - .15 * abs(age - .45)) * (.8 if dead else 1)
        width = .95 * L / 3.8
        samples = 12
        rachis = []
        for s in range(samples):
            t = s / (samples - 1)
            d = L * t
            drop = (.1 if dead else .9) * L * t * t * (.35 + .65 * age)
            rachis.append(crown + heading * (d * math.cos(elev)) + UP * (d * math.sin(elev) - drop))
        u0, u1 = column / 4 + .002, (column + 1) / 4 - .002
        for side in (-1, 1):
            strips = []
            for s, p in enumerate(rachis):
                t = s / (samples - 1)
                T = (rachis[min(s + 1, samples - 1)] - rachis[max(s - 1, 0)]).normalized()
                U = across.cross(T).normalized()
                if U.y < 0:
                    U = -U
                env = math.sin(math.pi * min(1, max(0, t - .06) / .96)) ** .7
                reach = min(1, max(.1, .035 + (.25 + .95 * env) * math.cos(math.radians(40 + 16 * t)) + .06))
                phi = math.radians(droop0 + (droop1 - droop0) * t + R.uniform(-3, 3))
                vv = va + (vb - va) * t
                row = [(p, (u0, vv))]
                for frac, bend in ((.5, .55), (1.0, 1.0)):
                    dirv = (across * side * math.cos(phi * bend) - U * math.sin(phi * bend)).normalized()
                    row.append((p + dirv * width * reach * frac, (u0 + (u1 - u0) * reach * frac, vv)))
                surface = (U * math.cos(phi * .7) + across * side * math.sin(phi * .7)).normalized()
                nrm = (surface * .55 + UP * .3 + heading * .15).normalized()
                strips.append((row, nrm))
            for s in range(samples - 1):
                (r0, n0), (r1, n1) = strips[s], strips[s + 1]
                for j in range(2):
                    b.quad(r0[j][0], r0[j + 1][0], r1[j + 1][0], r1[j][0], r0[j][1], r0[j + 1][1], r1[j + 1][1], r1[j][1], n0, n0, n1, n1, PALM_LEAF)
    return b, dict(fronds=count)


# ------------------------------------------------------------------ build / export
FAMILIES = {
    'LM_TREE_RainTree': ('urban-rain-tree', rain_tree, RAIN_VARIANTS),
    'LM_TREE_CoconutPalm': ('tropical-coconut-palm', coconut_palm, PALM_VARIANTS),
}


def glb_json(path):
    raw = path.read_bytes()
    return json.loads(raw[20:20 + int.from_bytes(raw[12:16], 'little')])


def export(asset, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    path = PUBLIC / f'{asset}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_cameras=False, export_lights=False, export_extras=True, export_normals=True,
        export_tangents=False, export_texcoords=True, export_vertex_color='NONE',
        export_image_format='WEBP', export_image_quality=86)
    raw_bytes = path.stat().st_size
    node = shutil.which('node')
    if not node:
        raise RuntimeError('node is needed for compress-glb.mjs')
    subprocess.run([node, 'scripts/blender/compress-glb.mjs', str(path.relative_to(ROOT))], cwd=ROOT, check=True)
    doc = glb_json(path)
    return dict(raw_bytes=raw_bytes, bytes=path.stat().st_size,
        materials=[{'name': m['name'], 'alphaMode': m.get('alphaMode', 'OPAQUE'), 'doubleSided': m.get('doubleSided', False)} for m in doc['materials']],
        images=[(img.get('mimeType')) for img in doc.get('images', [])])


def triangles(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def main():
    report = {}
    for asset, (family, builder, variants) in FAMILIES.items():
        objects, info = [], {}
        for name, v in variants.items():
            b, stats = builder(v)
            ob = b.object(f'{asset}_{name}', dict(lm_asset_id=asset, lm_family=family, lm_foliage_version=VERSION, lm_variant=name,
                                                  lm_origin='base centre, metres, glTF +Y up'))
            box = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
            info[name] = dict(stats, triangles=triangles(ob), materials=len(ob.data.materials),
                height=round(max(c.z for c in box), 2), width=round(max(c.x for c in box) - min(c.x for c in box), 2),
                min_z=round(min(c.z for c in box), 4))
            assert info[name]['min_z'] > -1e-3, f'{ob.name} sinks below its base'
            objects.append(ob)
        report[asset] = dict(family=family, version=VERSION, variants=info, glb=export(asset, objects))
    (OUT / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print('TREES EXPORT', json.dumps(report), flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'trees.blend'))


if __name__ == '__main__':
    main()
