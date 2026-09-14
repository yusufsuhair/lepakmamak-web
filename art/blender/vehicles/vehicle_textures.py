"""Shared vehicle detail atlas: one 1024 px colour, normal and ORM set for every car style.

Numpy only (no Blender import), so it runs inside Blender or plain Python. Row 0 is the TOP of
the image; colour is sRGB 0..1, normal is an OpenGL (+Y) tangent normal, ORM packs occlusion
(R), roughness (G) and metalness (B) the way glTF does.

Why an atlas: every trim, alloy, tyre, caliper, interior, plate and badge on a car draws with
ONE material, so a near car costs paint + atlas + glass + five lamp materials per chassis and
one call per wheel, instead of fifteen chassis materials and four per wheel. The runtime loads
these three images once and shares them across all 13 styles and all three LOD levels.

Layout (pixels, 1024 atlas): FLAT cells of 128 px (colour/roughness/metal only, UVs collapse to
the cell centre, so they survive six mip levels); a tyre strip, a brake disc, four lamp lenses,
fourteen plates and a few generic badges. Plates use a stroke font drawn here: illustrative
strings only, never a real registration, and no manufacturer marks anywhere.
"""
import numpy as np

N = 1024
# name: (x, y, colour hex, roughness, metalness)
FLAT = {
    'trim': (0, 0, '15191e', .5, 0), 'darkmetal': (128, 0, '3a3f46', .34, .8),
    'metal': (256, 0, 'c3ccd2', .2, .95), 'caliper': (384, 0, '4a4f53', .45, .35),
    'caliper_red': (512, 0, 'b3121f', .38, .15), 'leather': (640, 0, '2b2c2f', .78, 0),
    'carbon': (768, 0, '23262d', .3, .2), 'plate': (896, 0, '070809', .5, 0),
    'rubber': (0, 128, '17191b', .82, 0), 'blue': (128, 128, '0b3f8a', .35, .1),
    'gloss': (256, 128, '0b0c0e', .14, 0), 'recess': (384, 128, '050506', .9, 0),
    'whiteletter': (512, 128, 'efefec', .45, 0), 'silver': (640, 128, 'c9d0d6', .24, .95),
    'gunmetal': (768, 128, '50565e', .3, .85), 'lens': (896, 128, '1d262c', .12, 0),
}
CELL = 128
TYRE = (0, 256, 256, 512)           # x, y, w, h: u across the profile, v once around
DISC = (256, 256, 256, 256)
LAMPS = {'white': (256, 512), 'red': (384, 512), 'amber': (256, 640), 'reverse': (384, 640)}
PLATE = (512, 256, 256, 64)         # origin and cell size; 2 columns x 7 rows
BADGES = {'emblem': (512, 704, 64, 64), 'bar': (576, 704, 128, 64), 'polis': (704, 704, 256, 64),
          'roundel': (960, 704, 64, 64)}
# u of each of the ten tyre profile points (inner sidewall -> tread -> other sidewall).
TYRE_U = [0, .08, .20, .30, .37, .63, .70, .80, .92, 1.0]
PLATES = {'axia': 'WIX 2301', 'myvi': 'VIM 1500', 'emas': 'VIE 7007', 'avanza': 'WIA 2381',
          'vellfire': 'VIL 888', 'suv': 'WIS 4040', 'sport': 'VIG 386', 'ferrari': 'VIF 488',
          'lamborghini': 'VIS 63', 'model-y': 'VIT 2025', 'cybertruck': 'VIC 800', 'police': 'WIP 999'}
PLATE_ORDER = list(PLATES)

def plate_cell(style):
    i = PLATE_ORDER.index(style)
    return (PLATE[0] + (i % 2) * PLATE[2], PLATE[1] + (i // 2) * PLATE[3], PLATE[2], PLATE[3])

def uv(rect, s, t):
    """Blender UV (v up) for fractions s (left->right) and t (bottom->top) of a pixel rect."""
    x, y, w, h = rect
    return ((x + s * w) / N, 1 - (y + (1 - t) * h) / N)

def flat_uv(name):
    x, y, *_ = FLAT[name]
    return ((x + CELL / 2) / N, 1 - (y + CELL / 2) / N)

def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])

# ------------------------------------------------------------------------------- stroke font
G = {
    '0': [[(1, 0), (3, 0), (4, 1), (4, 6), (3, 7), (1, 7), (0, 6), (0, 1), (1, 0)]],
    '1': [[(.9, 1.3), (2.3, 0), (2.3, 7)]],
    '2': [[(0, 1.2), (1, 0), (3, 0), (4, 1), (4, 2.6), (0, 7), (4, 7)]],
    '3': [[(0, .9), (1, 0), (3, 0), (4, 1), (4, 2.5), (3, 3.5), (1.4, 3.5)], [(3, 3.5), (4, 4.5), (4, 6), (3, 7), (1, 7), (0, 6.1)]],
    '4': [[(3, 7), (3, 0), (0, 5), (4, 5)]],
    '5': [[(4, 0), (.4, 0), (0, 3.3), (3, 3.1), (4, 4.1), (4, 6), (3, 7), (1, 7), (0, 6.1)]],
    '6': [[(3.8, .7), (3, 0), (1, 0), (0, 1), (0, 6), (1, 7), (3, 7), (4, 6), (4, 4.3), (3, 3.3), (1, 3.3), (0, 4.3)]],
    '7': [[(0, 0), (4, 0), (1.5, 7)]],
    '8': [[(1, 3.5), (0, 2.5), (0, 1), (1, 0), (3, 0), (4, 1), (4, 2.5), (3, 3.5), (1, 3.5), (0, 4.5), (0, 6), (1, 7), (3, 7), (4, 6), (4, 4.5), (3, 3.5)]],
    '9': [[(.2, 6.3), (1, 7), (3, 7), (4, 6), (4, 1), (3, 0), (1, 0), (0, 1), (0, 2.7), (1, 3.7), (3, 3.7), (4, 2.7)]],
    'A': [[(0, 7), (2, 0), (4, 7)], [(.7, 4.6), (3.3, 4.6)]],
    'C': [[(4, 1), (3, 0), (1, 0), (0, 1), (0, 6), (1, 7), (3, 7), (4, 6)]],
    'E': [[(4, 0), (0, 0), (0, 7), (4, 7)], [(0, 3.5), (3, 3.5)]],
    'F': [[(4, 0), (0, 0), (0, 7)], [(0, 3.5), (3, 3.5)]],
    'G': [[(4, 1), (3, 0), (1, 0), (0, 1), (0, 6), (1, 7), (3, 7), (4, 6), (4, 4), (2.2, 4)]],
    'I': [[(2, 0), (2, 7)], [(1, 0), (3, 0)], [(1, 7), (3, 7)]],
    'L': [[(0, 0), (0, 7), (4, 7)]],
    'M': [[(0, 7), (0, 0), (2, 4), (4, 0), (4, 7)]],
    'O': [[(1, 0), (3, 0), (4, 1), (4, 6), (3, 7), (1, 7), (0, 6), (0, 1), (1, 0)]],
    'P': [[(0, 7), (0, 0), (3, 0), (4, 1), (4, 3), (3, 4), (0, 4)]],
    'S': [[(4, 1), (3, 0), (1, 0), (0, 1), (0, 2.6), (1, 3.5), (3, 3.5), (4, 4.4), (4, 6), (3, 7), (1, 7), (0, 6)]],
    'T': [[(0, 0), (4, 0)], [(2, 0), (2, 7)]],
    'V': [[(0, 0), (2, 7), (4, 0)]],
    'W': [[(0, 0), (1, 7), (2, 3), (3, 7), (4, 0)]],
    'X': [[(0, 0), (4, 7)], [(4, 0), (0, 7)]],
}

def text_mask(text, w, h, stroke=.62, advance=5.5, space=3.2):
    """Anti-aliased strokes (1 = ink) centred in a w x h pixel box, 7 units tall."""
    units = sum(space if c == ' ' else advance for c in text) - (advance - 4)
    scale = min(h * .66 / 7, w * .9 / units)
    ox = (w - units * scale) / 2; oy = (h - 7 * scale) / 2
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) + .5
    ink = np.zeros((h, w), np.float32); cursor = 0.0
    for c in text:
        if c == ' ':
            cursor += space; continue
        for line in G[c]:
            for (ax, ay), (bx, by) in zip(line, line[1:]):
                a = np.array([ox + (cursor + ax) * scale, oy + ay * scale]); b = np.array([ox + (cursor + bx) * scale, oy + by * scale])
                d = b - a; L = max(float(d @ d), 1e-6)
                t = np.clip(((xx - a[0]) * d[0] + (yy - a[1]) * d[1]) / L, 0, 1)
                dist = np.hypot(xx - (a[0] + t * d[0]), yy - (a[1] + t * d[1]))
                ink = np.maximum(ink, np.clip(stroke * scale - dist + .5, 0, 1))
        cursor += advance
    return ink

# ----------------------------------------------------------------------------------- fields
def rng(seed): return np.random.default_rng(seed)

def smooth_noise(h, w, seed, cells):
    """Bilinear value noise with `cells` lattice steps across the width, wrapping."""
    r = rng(seed); gh = max(2, int(round(cells * h / w))); lattice = r.random((gh, cells))
    y = np.arange(h) / h * gh; x = np.arange(w) / w * cells
    y0 = np.floor(y).astype(int); x0 = np.floor(x).astype(int); fy = (y - y0)[:, None]; fx = (x - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = lattice[y0 % gh][:, x0 % cells]; b = lattice[y0 % gh][:, (x0 + 1) % cells]
    c = lattice[(y0 + 1) % gh][:, x0 % cells]; d = lattice[(y0 + 1) % gh][:, (x0 + 1) % cells]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def normal(height, strength):
    """Wrapped central differences -> OpenGL tangent normal in 0..1 (row 0 = top, v up)."""
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    l = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([(-dx / l) * .5 + .5, (dy / l) * .5 + .5, (1 / l) * .5 + .5], -1)

def tyre(w, h):
    """Tread: four circumferential grooves and 48 staggered blocks with sipes (periodic in v).
    Sidewalls: a raised rim protector, a smooth crown and a band of generic embossed blocks (no marks).
    Height rises smoothly from the rims to the tread, so profile changes never read as grooves."""
    u = (np.arange(w) + .5) / w; v = (np.arange(h) + .5) / h
    U, V = np.meshgrid(u, v)
    a, b = TYRE_U[4], TYRE_U[5]
    tread = (U > a) & (U < b); t = np.clip((U - a) / (b - a), 0, 1)
    blocks = 48; rib = np.minimum((t * 5).astype(int), 4)
    phase = (V * blocks + np.where(rib % 2 == 0, 0, .5)) % 1
    groove = np.zeros_like(U)
    for g in (.2, .4, .6, .8): groove = np.maximum(groove, np.clip(1.4 - abs(t - g) / .03, 0, 1))
    inner = (t * 5) % 1
    sipe = np.clip(1.5 - abs(phase - .5) / .05, 0, 1) * (inner > .15) * (inner < .85)
    slot = np.clip(1.5 - np.minimum(phase, 1 - phase) / .06, 0, 1) * ((t < .2) | (t > .8))
    cut = np.clip(groove + sipe * .5 + slot, 0, 1) * tread
    crown = np.sin(np.pi * U) ** .6                      # 0 at both rims, 1 across the tread
    side = ~tread; s = np.where(U < .5, U / TYRE_U[3], (1 - U) / (1 - TYRE_U[6]))   # 0 at the rim
    ring = np.clip(1 - abs(s - .1) / .035, 0, 1) * side
    band = side & (s > .45) & (s < .7)
    glyph = band * (np.floor(V * 150) % 6 < 4) * (np.floor(V * 150 / 6) % 7 != 6) * (abs(((s - .45) / .25) - .5) < .38)
    height = crown * .5 + ring * .12 + glyph * .05 - cut * .45
    wear = smooth_noise(h, w, 4, 12)
    col = hexrgb('1c1e20') * (.92 + wear[..., None] * .12) * (1 - cut[..., None] * .5) + glyph[..., None] * .03
    rough = np.where(tread, .88, .74) + cut * .06 - glyph * .1
    return col, height, rough

def disc(size):
    """Cast-iron rotor: brushed friction ring with concentric scoring, darker hat, drilled holes."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + .5
    dx = xx - size / 2; dy = yy - size / 2; r = np.hypot(dx, dy) / (size / 2); a = np.arctan2(dy, dx)
    score = smooth_noise(size, size, 9, 4) * 0 + (np.sin(r * 180) * .5 + .5) * .08 + rng(10).random((size, size)) * .05
    ring = (r > .58) & (r < .98)
    col = np.zeros((size, size, 3)) + hexrgb('2d2f31')
    col = np.where(ring[..., None], hexrgb('8a8d8f') * (.82 + score[..., None]), col)
    col = np.where(((r > .98) | ((r > .52) & (r <= .58)))[..., None], hexrgb('3a3632'), col)
    holes = np.zeros_like(r)
    for k in range(12):
        for rr, off in ((.68, 0), (.78, .09), (.88, .18)):
            t = 2 * np.pi * k / 12 + off; hx = np.cos(t) * rr * size / 2; hy = np.sin(t) * rr * size / 2
            holes = np.maximum(holes, np.clip(1 - (np.hypot(dx - hx, dy - hy) - size * .018) / 1.2, 0, 1))
    col = col * (1 - holes[..., None] * .9)
    height = np.where(ring, .5, .2) - holes * .5 + score * .5
    rough = np.where(ring, .42, .7) + holes * .3
    metal = np.where(ring, .85, .4) * (1 - holes)
    return col, height, rough, metal

def lamp(kind, size):
    """Lens cells mapped across a lamp's own bounds: bright LED core, segment ribs, reflector edge.
    Also used as the lamp's emissive map, so night light keeps the same structure."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + .5
    s = xx / size; t = yy / size
    core = np.exp(-((t - .5) / .22) ** 2) * np.exp(-((np.minimum(s, 1 - s)) / .06) ** -2 * .02)
    ribs = .75 + .25 * np.cos(s * np.pi * 28) ** 2
    edge = np.clip(np.minimum(np.minimum(s, 1 - s), np.minimum(t, 1 - t)) / .08, 0, 1)
    base = {'white': 'e8f2ff', 'red': 'ff2a30', 'amber': 'ffa01e', 'reverse': 'f2f6f8'}[kind]
    glow = np.clip(core * ribs * .85 + .25, 0, 1) * (.55 + .45 * edge)
    col = hexrgb(base) * glow[..., None]
    if kind == 'white':   # chrome reflector behind a clear lens
        col = np.maximum(col, hexrgb('9aa4ab') * (1 - core[..., None]) * .7)
    return col, np.full((size, size), .12)

def build():
    """Returns sRGB colour (N,N,3), normal (N,N,3) and ORM (N,N,3) float arrays."""
    col = np.zeros((N, N, 3)) + hexrgb('17191b'); height = np.zeros((N, N)); rough = np.full((N, N), .6); metal = np.zeros((N, N))
    ao = np.ones((N, N)); nrm = np.zeros((N, N, 3)) + (.5, .5, 1)
    for x, y, hexc, r, m in FLAT.values():
        col[y:y + CELL, x:x + CELL] = hexrgb(hexc); rough[y:y + CELL, x:x + CELL] = r; metal[y:y + CELL, x:x + CELL] = m
    x, y, w, h = TYRE; c, hh, r = tyre(w, h)
    col[y:y + h, x:x + w] = c; rough[y:y + h, x:x + w] = r; nrm[y:y + h, x:x + w] = normal(hh, 6.0)
    ao[y:y + h, x:x + w] = np.clip(.55 + hh, .55, 1)
    x, y, s, _ = DISC; c, hh, r, m = disc(s)
    col[y:y + s, x:x + s] = c; rough[y:y + s, x:x + s] = r; metal[y:y + s, x:x + s] = m; nrm[y:y + s, x:x + s] = normal(hh, 2.0)
    for kind, (x, y) in LAMPS.items():
        c, r = lamp(kind, CELL); col[y:y + CELL, x:x + CELL] = c; rough[y:y + CELL, x:x + CELL] = r; metal[y:y + CELL, x:x + CELL] = 0
    for style, text in PLATES.items():
        x, y, w, h = plate_cell(style); ink = text_mask(text, w, h)
        frame = np.zeros((h, w)); frame[3:5, 4:-4] = frame[-5:-3, 4:-4] = 1; frame[3:-3, 4:6] = frame[3:-3, -6:-4] = 1
        col[y:y + h, x:x + w] = hexrgb('08090a') * (1 - ink[..., None]) + hexrgb('f2f2ee') * ink[..., None]
        col[y:y + h, x:x + w] = np.maximum(col[y:y + h, x:x + w], frame[..., None] * .32)
        rough[y:y + h, x:x + w] = .5 - ink * .15; nrm[y:y + h, x:x + w] = normal(ink * .6, 1.2)
    # Generic badges: a chrome ring emblem and a slim script bar. Shapes only, no marks.
    x, y, w, h = BADGES['emblem']; yy, xx = np.mgrid[0:h, 0:w] + .5
    e = np.hypot((xx - w / 2) / (w * .44), (yy - h / 2) / (h * .30))
    ring = np.clip(1 - abs(e - .85) / .12, 0, 1) + np.clip(1 - abs(yy - h / 2) / 2.5, 0, 1) * (e < .8)
    col[y:y + h, x:x + w] = hexrgb('0d0e10') * (1 - ring[..., None]) + hexrgb('d8dfe4') * ring[..., None]
    metal[y:y + h, x:x + w] = ring; rough[y:y + h, x:x + w] = .5 - ring * .32; nrm[y:y + h, x:x + w] = normal(ring * .5, 1)
    x, y, w, h = BADGES['bar']; bar = np.zeros((h, w)); bar[26:38, 6:-6] = 1; bar[29:35, 2:-2] = 1
    col[y:y + h, x:x + w] = hexrgb('15191e') * (1 - bar[..., None]) + hexrgb('d8dfe4') * bar[..., None]
    metal[y:y + h, x:x + w] = bar; rough[y:y + h, x:x + w] = .5 - bar * .3
    x, y, w, h = BADGES['polis']; ink = text_mask('POLIS', w, h, stroke=.8)
    col[y:y + h, x:x + w] = hexrgb('0b3f8a') * (1 - ink[..., None]) + hexrgb('f4f4f0') * ink[..., None]; rough[y:y + h, x:x + w] = .4
    x, y, w, h = BADGES['roundel']; yy, xx = np.mgrid[0:h, 0:w] + .5; disc_mask = np.clip(w * .46 - np.hypot(xx - w / 2, yy - h / 2), 0, 1)
    ink = np.zeros((h, w)); ink[14:50, 14:50] = text_mask('63', 36, 36, stroke=.9); ink *= disc_mask
    col[y:y + h, x:x + w] = hexrgb('f2f2ee') * disc_mask[..., None] * (1 - ink[..., None]) + hexrgb('0a0a0a') * ink[..., None]
    rough[y:y + h, x:x + w] = .45
    orm = np.stack([ao, np.clip(rough, .04, 1), np.clip(metal, 0, 1)], -1)
    return np.clip(col, 0, 1), np.clip(nrm, 0, 1), orm

def flake(n=128):
    """Tiling metallic-flake normal for paint: sparse, randomly tilted 1-2 px platelets over a flat
    base. Sampled at ~5 cm per tile under a smooth clearcoat, mipmaps fade it to plain metallic."""
    r = rng(21); tilt = r.normal(0, .35, (n, n, 2)) * (r.random((n, n, 1)) < .45)
    l = np.sqrt(1 + (tilt ** 2).sum(-1, keepdims=True))
    return np.concatenate([tilt / l * .5 + .5, 1 / l * .5 + .5], -1)

def half(a):
    return (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4

if __name__ == '__main__':
    import time
    t = time.time(); c, n, o = build()
    assert c.shape == (N, N, 3) and n.shape == (N, N, 3) and o.shape == (N, N, 3)
    assert abs(n[0, 0, 2] - 1) < 1e-6 and 0 <= c.min() and c.max() <= 1
    # Every plate cell carries ink, and no plate string repeats.
    assert len(set(PLATES.values())) == len(PLATES)
    for style in PLATES:
        x, y, w, h = plate_cell(style); assert c[y:y + h, x:x + w].max() > .9, style
    assert all(ch in G or ch == ' ' for text in PLATES.values() for ch in text)
    print('vehicle atlas ok', round(time.time() - t, 2), 's')
