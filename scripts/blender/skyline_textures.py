"""Procedural textures for the KL skyline pack (build_skyline.py), in the klcc_textures.py style:
numpy, tileable, fixed seeds, colour as sRGB, normals as OpenGL tangent space.

A facade tile is `cols` bays x `rows` floors. The mesh lays it out in world metres (u = distance
round the plan, v = height), so floor lines meet the geometry and the per-bay random numbers are
the same ones src/skyline.ts hashes for lit windows. Each facade returns colour, normal, ORM
(glTF packing: G roughness, B metalness) and a night mask (R lit interior, G floodlit frame).
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb
from klcc_textures import stainless as _stainless

def _grid(n, cols, rows):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u = (xx + .5) / n; v = 1 - (yy + .5) / n          # image row 0 is the top of the tile (v = 1)
    pu, pv = u * cols, v * rows
    return pu % 1, np.floor(pu).astype(int), pv % 1, np.floor(pv).astype(int)

def _cells(seed, cols, rows, ci, ri, sub=1):
    """One row of random numbers per (bay, floor, sub-band), wrapped to the tile."""
    table = np.random.default_rng(seed).random((cols, rows, sub, 8))
    return table, lambda s: table[ci % cols, ri % rows, s]

def _near(f, w):
    """1 on a module edge (f near 0 or 1) fading to 0 at distance w."""
    return np.clip(1 - np.minimum(f, 1 - f) / w, 0, 1)

def _pack(n, col, rough, metal, height, glass, cell, t, lit, flood, strength=1.6, tilt=(.02, .016)):
    nrm = normal_from_height(blur(height, 1), n / 256 * strength)
    vec = nrm * 2 - 1
    vec[..., 0] = np.where(glass, vec[..., 0] + (cell[..., 4] - .5) * tilt[0], vec[..., 0])
    vec[..., 1] = np.where(glass, vec[..., 1] + (cell[..., 5] - .5) * tilt[1] + (t - .5) * .006, vec[..., 1])
    vec /= np.linalg.norm(vec, axis=-1, keepdims=True)
    one = np.ones_like(rough)
    orm = np.stack([one, rough, metal], -1)
    night = np.stack([lit, flood, np.zeros_like(lit)], -1)
    return np.clip(col, 0, 1), vec * .5 + .5, orm, np.clip(night, 0, 1)

def _interior(glass, t, cell, blind_at=.74):
    """Glass colour factor: a darker head band where the ceiling shows, blinds half drawn in some bays."""
    head = 1 - .24 * np.clip((t - .8) / .12, 0, 1)
    blind = np.where((cell[..., 1] > blind_at) & (t > .4 + cell[..., 2] * .45), 1.14, 1.0)
    return head * blind, blind

# ------------------------------------------------------------------ Exchange 106
TRX = dict(cols=8, rows=4, pane=.75, floor=1.75)
def trx_wall(n=512):
    """Silver-blue glass behind the tower's fine vertical fins: a proud aluminium fin on every
    bay line, a slim mullion mid-bay, and a fritted slab edge per storey (two storeys a floor)."""
    fu, ci, fv, ri = _grid(n, TRX['cols'], TRX['rows']); sv = (fv * 2) % 1; sub = (fv >= .5).astype(int)
    _, pick = _cells(106, TRX['cols'], TRX['rows'], ci, ri, 2); cell = np.where(sub[..., None] == 0, pick(0), pick(1))
    fin = _near(fu, .075); mid = np.clip(1 - np.abs(fu - .5) / .018, 0, 1)
    slab = (sv < .1)
    glass = (fin < .5) & (mid < .5) & ~slab
    t = np.clip((sv - .1) / .9, 0, 1)
    streak = fractal(n, 1.3, 1061, stretch=(1, 60))
    col = rgb((.80, .83, .84), .92 + (streak - .5) * .1)
    col[slab] = rgb((.30, .36, .40), np.ones_like(fu))[slab] * (.95 + .1 * cell[..., 6][slab])[..., None]
    shade, blind = _interior(glass, t, cell, .8)
    g = rgb((.44, .54, .60), (.93 + cell[..., 0] * .12) * shade * (.97 + (fractal(n, 2.2, 1062) - .5) * .05))
    col[glass] = g[glass]
    col *= (1 - .35 * glass * np.clip(1 - np.abs(fu - .09) / .03, 0, 1))[..., None]   # the fin's shadow line
    rough = np.where(glass, .05 + cell[..., 3] * .06, .3); rough = np.where(slab, .22, rough)
    metal = np.where(glass, .75, 1.0); metal = np.where(slab, .55, metal)
    height = fin * 1.1 + mid * .3 - slab * .15
    lit = np.where(glass, .55 + .45 * np.clip(t * 1.3 - .1, 0, 1), 0) * (1 - (blind > 1) * .4)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, fin * .9, 1.8)

# ------------------------------------------------------------------ Merdeka 118
M118 = dict(cols=8, rows=4, pane=.8, floor=1.75)
def m118_wall(n=512):
    """Blue-green reflective glass cut into triangles: every bay carries a diagonal mullion that
    flips direction bay to bay and storey to storey, so the panes build the songket diamonds the
    tower's facets repeat at large scale."""
    fu, ci, fv, ri = _grid(n, M118['cols'], M118['rows']); sv = (fv * 2) % 1; si = np.floor(fv * 2).astype(int)
    table = np.random.default_rng(118).random((M118['cols'], M118['rows'], 2, 2, 8))
    flip = (ci + si) % 2 == 1                         # alternate per bay and storey: a diamond lattice
    diag = np.where(flip, fu - sv, fu - (1 - sv))
    side = (diag > 0).astype(int)
    cell = table[ci % M118['cols'], ri % M118['rows'], si % 2, side]
    mull = np.maximum(_near(fu, .012) * .6, np.clip(1 - np.abs(diag) / .026, 0, 1))
    transom = np.clip(1 - np.minimum(sv, 1 - sv) / .022, 0, 1) * .8
    frame = np.maximum(mull, transom)
    glass = frame < .5
    t = sv
    col = rgb((.78, .81, .81), .94 + (white(n, 1181) - .5) * .03)
    shade, blind = _interior(glass, t, cell, .8)
    g = rgb((.35, .48, .52), (.88 + cell[..., 0] * .2) * shade * (.97 + (fractal(n, 2.0, 1182) - .5) * .06))
    col[glass] = g[glass]
    rough = np.where(glass, .04 + cell[..., 3] * .06, .28)
    metal = np.where(glass, .78, 1.0)
    height = frame * .9
    lit = np.where(glass, .5 + .5 * cell[..., 7], 0) * (1 - (blind > 1) * .4)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, frame, 1.5, (.03, .025))

# ------------------------------------------------------------------ Menara KL
POD = dict(cols=12, rows=2)
def klt_pod(n=256):
    """The head's glazed underside: a lozenge lattice of blue-green glass in white frames, each
    lozenge holding a smaller glazed-tile diamond, the Islamic tile patterning of the real pod."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    p = (xx + .5) / n * POD['cols']; q = (1 - (yy + .5) / n) * POD['rows'] * 2
    a, b = p + q, p - q
    fa, fb = a % 1, b % 1
    ia, ib = np.floor(a).astype(int), np.floor(b).astype(int)
    table = np.random.default_rng(421).random((64, 64, 8)); cell = table[ia % 64, ib % 64]
    frame = np.maximum(_near(fa, .06), _near(fb, .06))
    inner = np.maximum(np.abs(fa - .5), np.abs(fb - .5)) < .2   # a square in (a, b) is a lozenge on the pod
    glass = (frame < .5) & ~inner
    col = rgb((.88, .88, .85), np.ones_like(p))
    g = rgb((.26, .50, .53), .88 + cell[..., 0] * .2)
    col[glass] = g[glass]
    tile = rgb((.58, .76, .74), .95 + cell[..., 1] * .1)
    col[inner & (frame < .5)] = tile[inner & (frame < .5)]
    rough = np.where(glass, .06, np.where(inner, .2, .45)); metal = np.where(glass, .7, 0.0)
    height = frame * .8 + inner * .3
    lit = np.where(glass, .6 + .4 * cell[..., 2], 0)
    return _pack(n, col, rough, metal, height, glass, cell, np.full_like(p, .5), lit, frame, 1.2, (0, 0))

DECK = dict(cols=16, rows=1)
def klt_deck(n=256):
    """Observation deck and revolving restaurant glazing: dark glass, white mullions, a transom."""
    fu, ci, fv, ri = _grid(n, DECK['cols'], DECK['rows'])
    _, pick = _cells(4212, DECK['cols'], DECK['rows'], ci, ri); cell = pick(0)
    frame = np.maximum(_near(fu, .07), np.clip(1 - np.abs(fv - .2) / .02, 0, 1))
    frame = np.maximum(frame, (fv < .04) | (fv > .97))
    glass = frame < .5
    col = rgb((.74, .76, .76), np.ones_like(fu))
    g = rgb((.16, .24, .28), (.9 + cell[..., 0] * .2) * (1 - .2 * np.clip((fv - .8) / .12, 0, 1)))
    col[glass] = g[glass]
    rough = np.where(glass, .05, .4); metal = np.where(glass, .8, 0.0)
    lit = np.where(glass, .8 + .2 * cell[..., 2], 0)
    return _pack(n, col, rough, metal, frame * .8, glass, cell, fv, lit, frame, 1.0)

def concrete(n=256):
    """Menara KL's off-white concrete on a 4 m tile: pour joints, formwork ties, soft rain streaks."""
    yy, xx = (np.mgrid[0:n, 0:n] + .5) / n
    streaks = fractal(n, 1.6, 4213, stretch=(1, 14)); mott = fractal(n, 2.0, 4214); grain = white(n, 4215)
    joint = np.exp(-(np.minimum(yy * 4 % 1, 1 - yy * 4 % 1) / .01) ** 2)
    col = rgb((.86, .85, .80), .9 + (mott - .5) * .12 - np.clip(streaks - .6, 0, 1) * .25 + (blur(grain, 1) - .5) * .08)
    col *= (1 - joint * .08)[..., None]
    return np.clip(col, 0, 1), normal_from_height(-joint * .3 + blur(grain, 1) * .08, n / 256 * 1.2)

# ------------------------------------------------------------------ the four city towers
CITY = dict(cols=4, rows=4, bay=1.6, floor=3.2)

def _city(n, seed):
    fu, ci, fv, ri = _grid(n, CITY['cols'], CITY['rows'])
    _, pick = _cells(seed, CITY['cols'], CITY['rows'], ci, ri)
    return fu, fv, pick(0)

def office_ribbon(n=512):
    """UOB: unitised curtain wall. Dark painted-glass spandrel, blue-grey vision glass, a silver
    mullion on each bay line and a slimmer one mid-bay."""
    fu, fv, cell = _city(n, 301)
    mull = np.maximum(_near(fu, .045), np.clip(1 - np.abs(fu - .5) / .02, 0, 1))
    spand = (fv < .3); head = (fv > .94)
    glass = (mull < .5) & ~spand & ~head
    t = np.clip((fv - .3) / .64, 0, 1)
    col = rgb((.78, .80, .81), np.ones_like(fu))
    col[spand] = rgb((.19, .24, .28), .95 + cell[..., 6] * .08)[spand]
    shade, blind = _interior(glass, t, cell)
    g = rgb((.36, .46, .53), (.9 + cell[..., 0] * .16) * shade)
    col[glass] = g[glass]
    rough = np.where(glass, .06 + cell[..., 3] * .05, np.where(spand, .2, .32)); metal = np.where(glass, .72, np.where(spand, .5, 1.0))
    height = mull * .9 + head * .4
    lit = np.where(glass, .6 + .4 * np.clip(t * 1.4, 0, 1), 0) * (1 - (blind > 1) * .4)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, mull * .4, 1.6)

def granite_punched(n=512):
    """HSBC: a pale granite grid with deep punched windows, a split mullion in each, and panel
    joints at every floor; the reveals throw a shadow down and to one side."""
    fu, fv, cell = _city(n, 302)
    win = (fu > .16) & (fu < .84) & (fv > .26) & (fv < .88)
    mull = win & (np.abs(fu - .5) < .018)
    glass = win & ~mull
    t = np.clip((fv - .26) / .62, 0, 1)
    grain = white(n, 3021); mott = fractal(n, 1.9, 3022)
    col = rgb((.76, .75, .72), .9 + (mott - .5) * .1 + (blur(grain, 3) - .5) * .06)
    col[grain > .993] *= np.array([.6, .6, .58])
    joint = np.clip(1 - np.minimum(fv, 1 - fv) / .01, 0, 1) + np.clip(1 - np.minimum(fu, 1 - fu) / .006, 0, 1) * .6
    col *= (1 - np.clip(joint, 0, 1) * .4)[..., None]
    shade, blind = _interior(glass, t, cell, .7)
    g = rgb((.20, .27, .28), (.9 + cell[..., 0] * .2) * shade)
    col[glass] = g[glass]; col[mull] = [.42, .43, .42]
    reveal = win & ((fv > .8) | (fu < .22))
    col *= (1 - .35 * reveal)[..., None]
    rough = np.where(glass, .08, .5); metal = np.where(glass, .6, 0.0)
    height = -1.0 * win + mull * .6 - np.clip(joint, 0, 1) * .2
    lit = np.where(glass, .6 + .4 * t, 0) * (1 - (blind > 1) * .4)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, np.zeros_like(fu), 2.2)

def civic_concrete(n=512):
    """Pusat Komuniti: tropical-modern white concrete frame, green-tinted glass set well back, and a
    light sunshade shelf across each window."""
    fu, fv, cell = _city(n, 303)
    col_mask = _near(fu, .07) > .5
    slab = fv < .16; shelf = (fv > .58) & (fv < .63)
    glass = ~col_mask & ~slab & ~shelf
    t = np.clip((fv - .16) / .84, 0, 1)
    mott = fractal(n, 2.0, 3031); streak = fractal(n, 1.5, 3032, stretch=(1, 10))
    col = rgb((.90, .89, .85), .92 + (mott - .5) * .08 - np.clip(streak - .62, 0, 1) * .2)
    louvre = glass & (cell[..., 1] > .6) & ((fv * 40) % 1 < .45)
    shade, _ = _interior(glass, t, cell, 1.1)
    g = rgb((.30, .42, .39), (.9 + cell[..., 0] * .18) * shade)
    col[glass] = g[glass]; col[louvre] *= 1.35
    col *= (1 - .3 * (glass & (fv > .9)))[..., None]
    rough = np.where(glass, .1, .8); metal = np.where(glass, .55, 0.0)
    height = col_mask * .7 + slab * .5 + shelf * .9 - glass * .4
    lit = np.where(glass, .7 + .3 * cell[..., 2], 0) * np.where(louvre, .5, 1)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, np.zeros_like(fu), 1.8)

def hotel_precast(n=512):
    """Hotel Mahkota: cream precast with proud pilasters on every bay, bronze glass room windows
    with curtains drawn to different widths, and a darker band at each floor."""
    fu, fv, cell = _city(n, 304)
    pil = _near(fu, .09) > .5
    band = (fv < .12)
    opening = ~pil & (fu > .2) & (fu < .8) & (fv > .28) & (fv < .86)
    win = opening & (fu > .23) & (fu < .77) & (fv > .31) & (fv < .83)
    t = np.clip((fv - .28) / .58, 0, 1)
    mott = fractal(n, 1.9, 3041); grain = white(n, 3042)
    col = rgb((.88, .82, .70), .92 + (mott - .5) * .08 + (blur(grain, 1) - .5) * .06)
    col[pil] *= 1.04; col[band] *= .86
    curtain = np.abs(fu - .5) > (.3 - cell[..., 1] * .3)
    g = rgb((.34, .29, .23), .9 + cell[..., 0] * .2)
    c = rgb((.70, .58, .42), .9 + cell[..., 2] * .12)
    col[opening & ~win] = [.33, .27, .2]                  # bronze window frame
    col[win] = np.where(curtain[..., None], c, g)[win]
    col *= (1 - .3 * (win & (fv > .8)))[..., None]
    glass = win & ~curtain
    rough = np.where(win, np.where(curtain, .7, .08), .75); metal = np.where(glass, .55, 0.0)
    height = pil * .8 - opening * .6 + band * .2
    lit = np.where(win, np.where(curtain, .75, .9), 0)
    return _pack(n, col, rough, metal, height, glass, cell, t, lit, pil * .25, 1.8)

# ------------------------------------------------------------------ shared small finishes
def metal():
    return _stainless(256)

def stone(n=256):
    """Podium granite cladding on a 2.4 m tile: 1.2 x 0.6 m panels, a tint per panel, soft mottling and
    recessed joints. klcc_textures.cladding's salt-and-pepper grain is left out: at 256 px it is noise that
    costs every tower 20 KB and cannot be seen from the street."""
    yy, xx = (np.mgrid[0:n, 0:n] + .5) / n
    pu, pv = xx * 2, yy * 4
    panel = np.random.default_rng(111).random((4, 2))[np.floor(pv).astype(int) % 4, np.floor(pu).astype(int) % 2]
    col = rgb((.86, .82, .74), .92 + (panel - .5) * .08 + (fractal(n, 2.4, 113) - .5) * .08)
    joint = np.maximum(np.exp(-((np.abs(pu - np.round(pu))) / .008) ** 2), np.exp(-((np.abs(pv - np.round(pv))) / .016) ** 2))
    col *= (1 - joint * .5)[..., None]
    return np.clip(col, 0, 1), normal_from_height(-joint * 1.2, n / 256 * 1.5)
