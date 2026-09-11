"""Compact, deterministic table settings in authoritative world coordinates."""
import math
import json
from build_mamak_asset import CREAM, WOOD, GREEN, METAL, TILE, GAME_ROOT

LAYOUT=json.loads((GAME_ROOT/'shared/mamak-tabletop.json').read_text())


def add_tabletop(a, table, index):
    x, z = table['x'], table['z']
    yaw = LAYOUT['rotations'][table['id']]
    def point(dx, dz):
        return x+dx*math.cos(yaw)+dz*math.sin(yaw), z-dx*math.sin(yaw)+dz*math.cos(yaw)
    def box(name, dx, y, dz, w, h, d, mat, angle=0):
        px,pz=point(dx,dz)
        a.box(name,px,y,pz,w,h,d,mat,yaw+angle)
    def disk(name, dx, y, dz, radius, h, mat, n=10, top=None):
        px,pz=point(dx,dz)
        a.cylinder(name,px,y,pz,radius,h,mat,n,top)
    # Ceramic mugs have a recessed tea surface, foam spots and open rectangular handles.
    for dx,dz in LAYOUT['cups']:
        disk('TeaSaucer',dx,1.157,dz,.18,.028,CREAM)
        disk('TeaCup',dx,1.29,dz,.115,.24,WOOD,10,.125)
        disk('TeaFoam',dx,1.413,dz,.111,.007,CREAM)
        disk('TeaSurface',dx,1.418,dz,.091,.006,WOOD)
        for fx,fz in ((-.03,.03),(.03,-.04)):
            disk('FoamBubble',dx+fx,1.423,dz+fz,.019,.004,CREAM,6)
        for y in (1.22,1.36):box('MugHandleRail',dx+.155,y,dz,.10,.028,.035,CREAM)
        box('MugHandleOuter',dx+.20,1.29,dz,.028,.168,.035,CREAM)
    disk('PlateRim',-.32,1.17,.34,.30,.045,CREAM,12)
    disk('PlateWell',-.32,1.195,.34,.245,.008,WOOD,12)
    # Uneven folded roti with small toast marks, instead of a featureless cylinder.
    for j in range(2 if index%2 else 3):
        box('RotiFold',-.36+j*.045,1.212+j*.016,.33,.32,.025,.24,CREAM,j*.3)
    for dx,dz in ((-.41,.27),(-.26,.34),(-.37,.41)):
        box('RotiToast',dx,1.26 if index%2==0 else 1.245,dz,.035,.003,.026,WOOD)
    disk('DhalBowl',.17,1.208,.45,.12,.10,CREAM,10,.14)
    disk('DhalSurface',.17,1.260,.45,.118,.006,TILE,10)
    box('Spoon',.13,1.18,.23,.045,.018,.24,METAL,-.3)
    box('TissueBox',.30,1.265,-.58,.34,.23,.23,GREEN)
    box('TissueSlot',.30,1.384,-.58,.22,.008,.033,METAL)
    box('Tissue',.30,1.43,-.58,.18,.09,.015,CREAM,.12)
    box('TableMenuBase',.55,1.164,.29,.28,.035,.18,WOOD)
    box('TableMenu',.55,1.38,.29,.24,.40,.025,GREEN)
    # Graphic menu rows read cleanly at gameplay distance without more text triangles.
    for y,w in ((1.51,.17),(1.43,.13),(1.37,.15),(1.31,.10)):
        box('MenuPrint',.55,y,.307,w,.022,.004,CREAM)
    if table['id']=='meja-9':
        disk('SharingPlate',-.85,1.17,.68,.32,.045,CREAM,12)
        for j in range(3):box('SharingRoti',-.93+j*.08,1.21+j*.025,.68,.32,.026,.26,WOOD,j*.2)
