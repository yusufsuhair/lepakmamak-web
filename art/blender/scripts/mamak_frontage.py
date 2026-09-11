"""V4 frontage kit: shallow facade relief and flush courtyard detailing.

World coordinates, metres. No furniture moves and no new walkable-area obstacles.
Uses only the existing six-colour palette; no extra runtime draw calls or textures.
"""
from build_mamak_asset import CREAM, TILE, WOOD, METAL, GREEN


def add_frontage(a):
    def inlay(name, x, y, z, width, depth, material):
        # Only the upward face is visible. Avoid six-sided boxes for flush inlays.
        a.add(name, [(x-width/2,y,z-depth/2), (x-width/2,y,z+depth/2),
                     (x+width/2,y,z+depth/2), (x+width/2,y,z-depth/2)],
              [(0,1,2,3)], material, closed=False)
    # Thin grout lines break up the large blank courtyard without raised trip edges.
    # These are above the .20 m paving surface, below the .215 m paving border.
    for x in range(-46, -11, 3):
        inlay("CourtyardGrout", x, .206, 44.5, .016, 22, WOOD)
    for i in range(8):
        inlay("CourtyardGrout", -29, .207, 34.5+i*3, 35.5, .016, WOOD)
    for x in range(-40, -27, 3):
        inlay("AnnexGrout", x, .206, 60.75, .016, 9.45, WOOD)
    for z in (57, 60, 63):
        inlay("AnnexGrout", -34, .207, z, 14.9, .016, WOOD)
    # A flush terracotta threshold ties the service bays together.
    a.box("ServiceThreshold", -29, .205, 35.35, 29.6, .012, .62, TILE)
    for x in range(-43, -14):
        inlay("ThresholdJoint", x, .214, 35.35, .018, .60, CREAM)
    # Covered drain along the outside edge, never across chair approach paths.
    for x in (-46.45, -11.55):
        a.box("DrainBed", x, .205, 44.5, .26, .012, 21.8, METAL)
        for i in range(23):
            inlay("DrainCrossbar", x, .214, 34+i*.94, .29, .048, WOOD)
    # Recessed-look panes: dark backing with deeper reveals, shutters and transoms.
    for x in (-39, -29, -19):
        for dx in (-2.52, 2.52):
            a.box("WindowReveal", x+dx, 6.85, 34.87, .17, 2.68, .35, CREAM)
        a.box("WindowLintel", x, 8.17, 34.87, 5.42, .18, .38, CREAM)
        a.box("WindowApron", x, 5.34, 34.72, 5.05, .28, .16, GREEN)
        for dx in (-1.19, 1.19):
            a.box("WindowUpright", x+dx, 6.85, 34.86, .065, 2.23, .08, WOOD)
        a.box("WindowTransom", x, 7.57, 34.87, 4.72, .075, .09, WOOD)
        for dx in (-3.05, 3.05):
            a.box("ShutterBacking", x+dx, 6.86, 34.72, .69, 2.46, .14, GREEN)
            for i in range(6):
                a.box("ShutterLouvre", x+dx, 5.91+i*.37, 34.82, .61, .055, .12, WOOD)
        # Small corbels give a readable overhang at the scale of the street.
        for dx in (-2.0, 2.0):
            a.box("SillCorbel", x+dx, 5.39, 34.82, .17, .30, .28, WOOD)
    # Upper cornice and pilaster caps retain the original building envelope.
    a.box("FacadeCornice", -29, 8.69, 34.80, 30.35, .18, .39, CREAM)
    a.box("CorniceShadow", -29, 8.56, 34.72, 30.1, .06, .22, WOOD)
    for x in (-44, -34, -24, -14):
        a.box("PilasterCapital", x, 8.42, 34.82, .58, .25, .38, CREAM)
        a.box("PilasterBase", x, .72, 34.80, .52, 1.34, .35, GREEN)
    # Timber transom slats and plate displays make the dark service bays feel occupied.
    for x in (-39, -29, -19):
        a.box("ServiceLintel", x, 3.83, 34.86, 8.15, .14, .29, WOOD)
        for i in range(9):
            a.box("ServiceTransomSlat", x-3.6+i*.9, 3.51, 34.84, .045, .43, .08, WOOD)
        for i in range(4):
            a.box("ShelfTeaTin", x-2.1+i*1.4, 1.48, 34.92, .36, .56, .24, GREEN if i%2 else TILE)
            a.box("TeaTinLabel", x-2.1+i*1.4, 1.50, 35.047, .23, .19, .012, CREAM)
    # Canopy undersides: a believable structure visible from player-height cameras.
    for x in (-39, -29, -19):
        a.box("CanopyRafter", x, 4.39, 38.35, .10, .15, 7.48, WOOD)
    a.box("CanopyFrontBeam", -29, 4.40, 41.91, 30.7, .20, .16, WOOD)
    # Nameboard stays the primary focal point; a fine inner border frames the lettering.
    for y in (3.85, 4.61):
        a.box("NameboardPinstripe", -29, y, 42.499, 17.1, .024, .012, CREAM)
    for x in (-37.48, -20.52):
        a.box("NameboardPinstripe", x, 4.23, 42.499, .024, .74, .012, CREAM)
