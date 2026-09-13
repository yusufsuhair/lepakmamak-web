"""Procedural textures for the PETRONAS Twin Towers (build_klcc.py), in the pbr_textures.py style:
numpy, tileable, fixed seeds, colour as sRGB and normals as OpenGL tangent space.

The curtain wall is one 1024 px tile of 8 panes x 4 game floors. The mesh lays it out with world
metres (u = distance round the plan, v = height in floors / 4), so floors line up with the
sunshade ribbons the geometry carries and a mullion falls on every star point. Each game floor
(1.75 m) stands for two real storeys: glass, a louvred stainless spandrel, glass, a sill.
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb, _norm

PANES, FLOORS = 8, 4
# Bands inside one game floor, as fractions of its height from the floor line up. The ribbon
# geometry covers the first .08.
GLASS_A, SPANDREL, GLASS_B = (.10, .47), (.47, .60), (.60, .96)

def _grid(n):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u = (xx + .5) / n; v = 1 - (yy + .5) / n          # image row 0 is the top of the tile (v = 1)
    pu = u * PANES; fv_all = v * FLOORS
    return pu % 1, np.floor(pu).astype(int), fv_all % 1, np.floor(fv_all).astype(int)

def _cells(n, seed, fu, pi, fv, fi):
    """Per-pane random numbers: one draw per (pane, floor, band), wrapped to the tile."""
    r = np.random.default_rng(seed); table = r.random((PANES, FLOORS, 2, 6))
    band = (fv >= .5).astype(int)
    return table[pi % PANES, fi % FLOORS, band]         # HxWx6

def _masks(fu, fv):
    mull = np.abs(fu - np.round(fu))                     # 0 on a mullion centre line
    glass = (((fv >= GLASS_A[0]) & (fv < GLASS_A[1])) | ((fv >= GLASS_B[0]) & (fv < GLASS_B[1]))) & (mull > .014)
    spand = (fv >= SPANDREL[0]) & (fv < SPANDREL[1])
    return mull, glass, spand

def curtain_wall(n=1024):
    """Blue-green laminated glass behind stainless mullions. Returns colour, normal, ORM
    (glTF packing: G roughness, B metalness) and the night mask (R lit interior, G floodlit steel)."""
    fu, pi, fv, fi = _grid(n); cell = _cells(n, 7, fu, pi, fv, fi)
    mull, glass, spand = _masks(fu, fv)
    streak = fractal(n, 1.3, 91, stretch=(60, 1)); grain = white(n, 92)
    steel = .9 + (streak - .5) * .16 + (blur(grain, 1) - .5) * .05
    # steel: mullions, spandrels (with three louvre blades) and sills
    col = rgb((.84, .85, .84), steel)
    col[~spand & (mull <= .014)] *= .62                   # mullions sit back in shadow; the spandrels carry the stripe
    louvre = np.sin((fv - SPANDREL[0]) / (SPANDREL[1] - SPANDREL[0]) * np.pi * 3) ** 2
    col[spand] *= (.84 + .16 * louvre[spand])[..., None]
    # glass: a tint per pane, a darker head band where the ceiling line shows through, and a few
    # blinds half drawn
    bandlo = np.where(fv < .5, GLASS_A[0], GLASS_B[0]); bandhi = np.where(fv < .5, GLASS_A[1], GLASS_B[1])
    t = (fv - bandlo) / (bandhi - bandlo)                # 0 bottom .. 1 top of this glass band
    tint = .88 + cell[..., 0] * .2
    head = 1 - .22 * np.clip((t - .82) / .1, 0, 1)
    blind = np.where((cell[..., 1] > .72) & (t > .45 + cell[..., 2] * .4), 1.18, 1.0)
    g = rgb((.34, .45, .49), tint * head * blind * (.97 + (fractal(n, 2.2, 93) - .5) * .06))
    col[glass] = g[glass]
    # a hairline shadow on one side of each mullion and under the head of each band
    col *= (1 - .3 * (glass & (mull < .024) & (fu > .5)))[..., None]
    # ORM
    rough = np.where(glass, .05 + cell[..., 3] * .07, .26 + (streak - .5) * .12)
    rough = np.where(spand, .38 + .1 * (1 - louvre), rough)
    metal = np.where(glass, .72, 1.0)
    orm = np.stack([np.ones_like(rough), rough, metal], -1)
    # normal: raised mullions and louvres from a height field, plus a slight tilt and bow per
    # pane, so reflections break from pane to pane the way real curtain walls do
    height = np.clip(.022 - mull, 0, None) / .022 * .8 + np.where(spand, louvre * .5, 0) - glass * .25
    nrm = normal_from_height(blur(height, 1), n / 256 * 1.6)
    tilt_x = (cell[..., 4] - .5) * .018 + (fu - .5) * .012 * (cell[..., 5] - .5)
    tilt_y = (cell[..., 5] - .5) * .014 + (t - .5) * .008
    vec = nrm * 2 - 1
    vec[..., 0] = np.where(glass, vec[..., 0] + tilt_x, vec[..., 0])
    vec[..., 1] = np.where(glass, vec[..., 1] + tilt_y, vec[..., 1])
    vec /= np.linalg.norm(vec, axis=-1, keepdims=True)
    # night mask: interior light brightest under the ceiling; floodlit steel
    lit = np.where(glass, .55 + .45 * np.clip(t * 1.4 - .2, 0, 1), 0) * (1 - (blind > 1) * .45)
    flood = np.where(glass, 0, .55 + .45 * steel)
    night = np.stack([lit, flood, np.zeros_like(lit)], -1)
    return np.clip(col, 0, 1), vec * .5 + .5, orm, np.clip(night, 0, 1)

def stainless(n=512):
    """Brushed stainless steel: fine streaks along u, a panel joint every half tile."""
    fu = (np.mgrid[0:n, 0:n][1] + .5) / n
    streak = fractal(n, 1.2, 101, stretch=(80, 1)) * .7 + fractal(n, 1.8, 102, stretch=(12, 1)) * .3
    joint = np.exp(-((((fu * 2) % 1) - .5) / .004) ** 2)
    col = rgb((.84, .85, .84), .9 + (streak - .5) * .18 - joint * .4 + (fractal(n, 2.4, 103) - .5) * .05)
    return np.clip(col, 0, 1), normal_from_height(streak * .9 - joint * 1.5, n / 256 * 1.3)

def cladding(n=512):
    """Polished cream granite cladding for the Suria podium on a 2.4 m tile: 1.2 x 0.6 m panels with
    a slight tint per panel, fine salt-and-pepper grain and recessed joints."""
    yy, xx = (np.mgrid[0:n, 0:n] + .5) / n
    pu, pv = xx * 2, yy * 4
    table = np.random.default_rng(111).random((4, 2))
    panel = table[np.floor(pv).astype(int) % 4, np.floor(pu).astype(int) % 2]
    grain = white(n, 112); mott = fractal(n, 1.9, 113)
    col = rgb((.86, .82, .74), .9 + (panel - .5) * .08 + (mott - .5) * .1 + (blur(grain, 1) - .5) * .12)
    col[grain > .965] *= np.array([.45, .44, .42]); col[grain < .02] *= 1.1
    joint = np.maximum(np.exp(-((np.abs(pu - np.round(pu))) / .006) ** 2), np.exp(-((np.abs(pv - np.round(pv))) / .012) ** 2))
    col *= (1 - joint * .55)[..., None]
    return np.clip(col, 0, 1), normal_from_height(-joint * 1.2 + blur(grain, 1) * .05, n / 256 * 1.5)
