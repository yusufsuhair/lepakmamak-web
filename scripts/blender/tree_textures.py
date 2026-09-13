"""Procedural foliage and bark textures for the city trees (build_trees.py), numpy only.

Same conventions as pbr_textures.py: colour is sRGB, normals are OpenGL tangent space, array row 0
is the top of the image (v=1 once loaded). Foliage atlases are painted leaf by leaf at twice the
final size and averaged down, so blade edges are anti-aliased; alpha is the leaf coverage and the
colour under transparent texels is bled outward so mipmaps never fringe dark.

Atlas layouts (fractions of the 1024 image, column u then row from the top):
  rain_tree_leaves  2x2 cells: [0,0] dense clump, [1,0] open spray, [0,1] sunlit clump with new
                    flush, [1,1] bird's nest fern rosette (base at the cell's bottom centre)
  palm_leaves       four 256-wide columns, rachis on each column's left edge, frond base at the
                    bottom: 0 healthy frond, 1 weathered frond, 2 old yellowing frond (top 3/4),
                    3 dead frond (top 3/4); under columns 2 and 3 a nut swatch and a fibre swatch
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb

SS = 2   # supersampling factor for painted atlases


class Canvas:
    """Straight-alpha colour, coverage and a height field painted in painter's order."""

    def __init__(self, h, w):
        self.h, self.w = h, w
        self.col = np.zeros((h, w, 3), np.float32)
        self.a = np.zeros((h, w), np.float32)
        self.hgt = np.zeros((h, w), np.float32)

    def blade(self, x, y, length, width, angle, colour, lift=0.0, bend=0.0, shape='oval', rib=.25, tip=None):
        """One leaf blade from its base (x, y) along `angle` (radians, image axes, y down).
        shape 'oval' is a rain-tree leaflet, 'lance' a palm leaflet or fern frond. `bend` bows it
        sideways (fraction of length at the tip), `rib` lightens the midrib, `tip` browns the end."""
        ca, sa = np.cos(angle), np.sin(angle)
        ex, ey = x + ca * length, y + sa * length
        pad = width + abs(bend) * length + 2
        x0, x1 = int(max(min(x, ex) - pad, 0)), int(min(max(x, ex) + pad + 1, self.w))
        y0, y1 = int(max(min(y, ey) - pad, 0)), int(min(max(y, ey) + pad + 1, self.h))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = xx - x, yy - y
        s = (dx * ca + dy * sa) / length
        q = -dx * sa + dy * ca - bend * length * s * s
        if shape == 'oval':
            prof = np.sqrt(np.clip(1 - (2 * s - 1.1) ** 2 / 1.21, 0, 1))
        elif shape == 'stalk':
            prof = np.ones_like(s)
        else:
            prof = np.clip(s / .07, 0, 1) ** .5 * np.clip((1 - s) / .93, 0, 1) ** .75
        half = width * .5 * prof
        m = (s >= 0) & (s <= 1) & (np.abs(q) < half)
        if not m.any():
            return
        across = np.where(m, q / np.maximum(half, 1e-4), 0)
        shade = .82 + .18 * (1 - across * across) + rib * np.exp(-(across / .12) ** 2) * (s < .97)
        c = np.asarray(colour, np.float32)[None, None, :] * shade[..., None]
        if tip is not None:
            t = np.clip((s - tip[0]) / (1 - tip[0]), 0, 1)[..., None]
            c = c * (1 - t) + np.asarray(tip[1], np.float32) * shade[..., None] * t
        dome = lift + np.sqrt(np.clip(1 - across * across, 0, 1)) * width * .35 - np.exp(-(across / .1) ** 2) * width * .08
        view = (slice(y0, y1), slice(x0, x1))
        self.col[view][m] = c[m]
        self.a[view][m] = 1
        self.hgt[view][m] = dome[m]

    def stem(self, points, width, colour, lift=0.0):
        """A thin stalk through image points, as a chain of short blades."""
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            length = float(np.hypot(bx - ax, by - ay))
            if length > .5:
                self.blade(ax, ay, length * 1.05, width, float(np.arctan2(by - ay, bx - ax)), colour, lift, shape='stalk', rib=0)

    def finish(self, strength):
        """Average down the supersampling, bleed colour under the gaps, and build the normal map."""
        def down(a):
            h, w = a.shape[0] // SS, a.shape[1] // SS
            return a[:h * SS, :w * SS].reshape(h, SS, w, SS, *a.shape[2:]).mean((1, 3))
        a = down(self.a)
        col = down(self.col * self.a[..., None]) / np.maximum(a, 1e-4)[..., None]
        col = _bleed(col, a)
        hgt = down(self.hgt)
        return np.concatenate([np.clip(col, 0, 1), a[..., None]], -1), normal_from_height(hgt, strength)


def _bleed(col, a):
    """Push the colour of covered texels into the transparent ones with a premultiplied pyramid."""
    levels = [(col * a[..., None], a)]
    while min(levels[-1][1].shape) > 4:
        p, w = levels[-1]
        h, v = p.shape[0] // 2 * 2, p.shape[1] // 2 * 2
        levels.append((p[:h, :v].reshape(h // 2, 2, v // 2, 2, 3).mean((1, 3)), w[:h, :v].reshape(h // 2, 2, v // 2, 2).mean((1, 3))))
    fill = levels[-1][0] / np.maximum(levels[-1][1], 1e-4)[..., None]
    for p, w in reversed(levels[:-1]):
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)
        up = np.pad(up, ((0, p.shape[0] - up.shape[0]), (0, p.shape[1] - up.shape[1]), (0, 0)), mode='edge')
        own = p / np.maximum(w, 1e-4)[..., None]
        k = np.clip(w * 4, 0, 1)[..., None]
        fill = own * k + up * (1 - k)
    k = np.clip(a * 2, 0, 1)[..., None]
    return col * k + fill * (1 - k)


def _vary(R, base, amount=.1, warm=0.0):
    """A leaf colour: value jitter plus a push toward yellow (warm>0) or blue-green (warm<0)."""
    v = 1 + R.uniform(-amount, amount)
    c = np.array(base) * v
    c += np.array([.06, .04, -.03]) * warm
    return np.clip(c, 0, 1)


# ------------------------------------------------------------------------------ rain tree
LEAF_DEEP, LEAF_MID, LEAF_SUN, LEAF_FLUSH = (.16, .25, .09), (.25, .38, .13), (.36, .50, .17), (.55, .66, .25)


def _compound(cv, R, x, y, angle, size, colour, lift, flush=False):
    """One bipinnate rain-tree leaf: petiole, two to four pairs of pinnae swept forward, each with
    leaflet pairs that grow toward the tip, finished by a larger terminal pair."""
    pairs = int(R.integers(2, 5))
    ca, sa = np.cos(angle), np.sin(angle)
    tipx, tipy = x + ca * size, y + sa * size
    cv.stem([(x, y), (tipx, tipy)], size * .012, (.24, .27, .12), lift)
    for k in range(pairs):
        t = .18 + .82 * (k + 1) / pairs
        px, py = x + ca * size * t, y + sa * size * t
        for side in (-1, 1):
            if k == pairs - 1 and side == 1 and R.random() < .3:
                continue
            pa = angle + side * R.uniform(.55, .95)
            pl = size * R.uniform(.38, .55) * (.75 + .35 * t)
            cpa, spa = np.cos(pa), np.sin(pa)
            cv.stem([(px, py), (px + cpa * pl, py + spa * pl)], size * .008, (.25, .30, .13), lift)
            n = int(R.integers(3, 7))
            for j in range(n):
                u = (j + 1) / n
                lx, ly = px + cpa * pl * u * .96, py + spa * pl * u * .96
                ll = size * (.07 + .09 * u) * R.uniform(.85, 1.15)
                for s2 in (-1, 1):
                    la = pa + s2 * R.uniform(.9, 1.35) - s2 * .25 * u
                    c = _vary(R, LEAF_FLUSH if flush and R.random() < .8 else colour, .12, R.uniform(-.4, .5))
                    cv.blade(lx, ly, ll, ll * .55, la, c, lift + u * .6, bend=R.uniform(-.08, .08), shape='oval', rib=.12)


def _clump_cell(R, n, kind):
    """A foliage clump card: compound leaves in three depth layers, dark and dense at the back,
    sunlit and sparser in front. Leaves start inside a disc and point outward, so the clump is
    full in the middle and feathers out to a ragged, rounded edge that never meets the cell's."""
    cv = Canvas(n, n)
    cx, cy = n * .5, n * .5
    layers = {'dense': [(26, LEAF_DEEP, .2), (22, LEAF_MID, .19), (14, LEAF_SUN, .18)],
              'spray': [(14, LEAF_DEEP, .2), (15, LEAF_MID, .2), (10, LEAF_SUN, .19)],
              'sunlit': [(16, LEAF_MID, .19), (18, LEAF_SUN, .19), (13, LEAF_SUN, .18)]}[kind]
    squash = .62 if kind == 'spray' else 1.0
    for depth, (count, colour, size) in enumerate(layers):
        for i in range(count):
            ray = R.uniform(0, 2 * np.pi)
            d = n * .27 * np.sqrt(R.random())
            x, y = cx + np.cos(ray) * d, cy + np.sin(ray) * d * squash
            a = ray + R.uniform(-.6, .6) if R.random() < .45 else R.uniform(0, 2 * np.pi)
            length = n * size * R.uniform(.8, 1.1)
            while length > n * .05 and np.hypot(x + np.cos(a) * length * 1.1 - cx, y + np.sin(a) * length * 1.1 - cy) > n * .44:
                length *= .85   # the tip stays inside the disc
            _compound(cv, R, x, y, a, length, colour, depth * 2.0 + R.uniform(0, 1),
                      flush=kind == 'sunlit' and depth == 2)
    return cv


def _fern_cell(R, n):
    """Bird's nest fern (Asplenium nidus), the epiphyte on every old KL rain tree: a vase of glossy
    strap fronds with dark midribs rising from the bottom centre, outer fronds arching over."""
    cv = Canvas(n, n)
    fronds = 17
    for i in range(fronds):
        f = i / (fronds - 1)
        angle = -np.pi / 2 + (f - .5) * 2.3 + R.uniform(-.08, .08)
        outer = abs(f - .5) * 2
        length = n * R.uniform(.62, .8) * (1 - .25 * outer)
        width = n * R.uniform(.075, .1)
        bend = (f - .5) * R.uniform(.25, .45)
        colour = _vary(R, (.42, .58, .16) if outer < .6 else (.32, .47, .13), .1, R.uniform(-.2, .6))
        tip = (.9, (.45, .36, .16)) if R.random() < .35 else None
        cv.blade(n * .5 + R.uniform(-4, 4), n * .98, length, width, angle, colour, lift=(1 - outer) * 3, bend=bend, shape='lance', rib=-.35, tip=tip)
    return cv


def rain_tree_leaves(n=1024):
    R = np.random.default_rng(20260914)
    h = n // 2 * SS
    cells = [_clump_cell(R, h, 'dense'), _clump_cell(R, h, 'spray'), _clump_cell(R, h, 'sunlit'), _fern_cell(R, h)]
    outs = [c.finish(h / SS / 90) for c in cells]
    return _tile([o[0] for o in outs]), _tile([o[1] for o in outs])


def _tile(cells):
    top = np.concatenate([cells[0], cells[1]], 1)
    bottom = np.concatenate([cells[2], cells[3]], 1)
    return np.concatenate([top, bottom], 0)


def _plates(n, points, seed, aspect):
    """Periodic Voronoi F2-F1 with cells stretched `aspect` times along u: bark plates."""
    r = np.random.default_rng(seed)
    p = r.random((points, 2)) * n
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = f1.copy()
    for px, py in p:
        dx = np.abs(xx - px)
        dx = np.minimum(dx, n - dx) / aspect
        dy = np.abs(yy - py)
        dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        f2 = np.where(d < f1, f1, np.minimum(f2, d))
        f1 = np.minimum(f1, d)
    return f2 - f1


def rain_tree_bark(n=512):
    """Old Samanea saman bark on a 1 m tile, grain along u: dark grey-brown corky plates split by
    deep interlacing fissures that run along the limb, pale lichen crusts and moss in the cracks."""
    warp = (fractal(n, 2.0, 107) - .5) * n * .08
    edges = _plates(n, 150, 102, 6.0)
    edges = edges[(np.arange(n)[:, None] + warp).astype(int) % n, np.arange(n)[None, :]]   # wavy, still tiling
    furrows = fractal(n, 1.3, 108, stretch=(12, 1))
    fissure = np.maximum(np.clip(1 - edges / 11, 0, 1) ** 1.3, np.clip((.42 - furrows) * 4, 0, 1))
    fibre = fractal(n, 1.7, 101, stretch=(10, 1))
    top = fractal(n, 1.6, 103, stretch=(3, 1))
    plates = np.clip(1 - fissure * 1.15, 0, 1) * (.6 + .4 * top)
    lichen = np.clip((fractal(n, 1.5, 104) - .66) * 6, 0, 1) * np.clip(plates * 1.5 - .3, 0, 1)
    moss = np.clip((fractal(n, 2.0, 105) - .5) * 3, 0, 1) * fissure
    grain = blur(white(n, 106), 1)
    col = rgb((.47, .41, .36), .5 + plates * .5 + (fibre - .5) * .3 + (grain - .5) * .16)
    col = col * (1 - lichen[..., None] * .6) + np.array([.64, .66, .58]) * lichen[..., None] * .6
    col = col * (1 - moss[..., None] * .55) + np.array([.18, .23, .10]) * moss[..., None] * .55
    height = plates * 1.0 + fibre * .25 + grain * .08 + lichen * .06
    return np.clip(col, 0, 1), normal_from_height(height, n / 36)


# ------------------------------------------------------------------------------ coconut palm
def _frond_column(R, w, h, colour, droop=0.0, torn=0.0, brown=0.0, dead=False):
    """One wing of a pinnate coconut frond: the rachis on the left edge, base at the bottom, and
    ~95 lanceolate leaflets angled toward the tip. Leaflet length follows the frond's spindle
    outline. `torn` drops and splits leaflets, `brown` dries their tips, `dead` shrivels them."""
    cv = Canvas(h, w)
    rib = (.72, .70, .42) if not dead else (.52, .40, .25)
    count = 78
    for i in range(count):
        t = .1 + .89 * i / (count - 1)
        if R.random() < torn * (.4 + t * .6):
            continue
        y = h * (1 - t)
        envelope = np.sin(np.pi * min(1, (t - .06) / .96)) ** .7
        length = w * (.25 + .95 * envelope) * R.uniform(.9, 1.06) * (.8 if dead else 1)
        angle = -np.radians(40 + 16 * t + droop + R.uniform(-5, 5))
        width = w * (.05 if not dead else .035) * (.75 + .35 * envelope)
        c = _vary(R, colour, .09, R.uniform(-.3, .5))
        tip = (R.uniform(.6, .85), (.50, .38, .19)) if R.random() < brown else None
        cv.blade(w * .035, y, length, width, angle, c, lift=t * 2, bend=R.uniform(-.1, .04) - (.12 if dead else 0), shape='lance', rib=.3, tip=tip)
        if torn and R.random() < torn * .5:   # a split leaflet: a second narrow blade beside it
            cv.blade(w * .035, y - width * .8, length * .8, width * .55, angle - .06, c * .95, lift=t * 2, shape='lance', rib=.2)
    for i in range(24):   # the rachis: broad and pale at the base, tapering to the tip
        t0, t1 = i / 24, (i + 1) / 24
        cv.blade(0, h * (1 - t0), h / 24 * 1.08, w * (.13 - .1 * t0), -np.pi / 2, rib, lift=4, shape='stalk', rib=.15)
    return cv


def _nut_swatch(R, n):
    """Young green coconut skin: fine longitudinal streaks, yellowing toward the stalk end."""
    streak = fractal(n, 1.6, 121, stretch=(1, 10))
    v = np.linspace(0, 1, n)[:, None]
    base = rgb((.45, .54, .18), .8 + (streak - .5) * .3)
    ripe = np.clip((v - .7) * 3, 0, 1)[..., None]
    col = base * (1 - ripe) + np.array([.62, .55, .24]) * ripe
    return np.clip(col, 0, 1), streak


def _fibre_swatch(R, n):
    """The brown fibrous sheath (and leaf-base boots) wrapped around the crown."""
    a = fractal(n, 1.4, 131, stretch=(1, 12))
    b = fractal(n, 1.4, 132, stretch=(12, 1))
    mesh = np.maximum(a, b * .85)
    col = rgb((.46, .36, .24), .55 + mesh * .6 + (white(n, 133) - .5) * .08)
    return np.clip(col, 0, 1), mesh


def palm_leaves(n=1024):
    R = np.random.default_rng(20260915)
    w, h = n // 4 * SS, n * SS
    cols = [_frond_column(R, w, h, (.30, .45, .13), torn=.05, brown=.05),
            _frond_column(R, w, h, (.36, .48, .14), droop=4, torn=.18, brown=.25),
            _frond_column(R, w, h * 3 // 4, (.50, .52, .19), droop=8, torn=.25, brown=.55),
            _frond_column(R, w, h * 3 // 4, (.46, .34, .18), droop=14, torn=.35, brown=1, dead=True)]
    outs = [c.finish(n / 4 / 70) for c in cols]
    q = n // 4
    colour = np.zeros((n, n, 4), np.float32)
    normal = np.zeros((n, n, 3), np.float32)
    for k, (c, nm) in enumerate(outs):
        colour[:c.shape[0], k * q:(k + 1) * q] = c
        normal[:c.shape[0], k * q:(k + 1) * q] = nm
    nut, nh = _nut_swatch(R, q)
    fib, fh = _fibre_swatch(R, q)
    colour[3 * q:, 2 * q:3 * q, :3], colour[3 * q:, 2 * q:3 * q, 3] = nut, 1
    colour[3 * q:, 3 * q:, :3], colour[3 * q:, 3 * q:, 3] = fib, 1
    normal[3 * q:, 2 * q:3 * q] = normal_from_height(nh, q / 90)
    normal[3 * q:, 3 * q:] = normal_from_height(fh, q / 30)
    return colour, normal
