"""Wall-side service details, kept inside shared collision footprints."""
import json
from build_mamak_asset import GAME_ROOT, CREAM, WOOD, GREEN, METAL, TILE


def add_service(a):
    layout=json.loads((GAME_ROOT/'shared/mamak-streets.json').read_text())
    for item in layout['serviceProps']:
        x,z=item['x'],item['z']
        if item['kind']=='crates':
            for level in range(2):
                y=.29+level*.43
                a.box('DrinkCrateBase',x,y,z,1.12,.10,.58,GREEN)
                for dz in (-.26,.26):
                    for dy in (.12,.29):
                        a.box('DrinkCrateRail',x,y+dy,z+dz,1.12,.07,.06,GREEN)
                for dx in (-.52,.52):
                    a.box('DrinkCrateEnd',x+dx,y+.20,z,.08,.35,.58,GREEN)
            for dx in (-.34,0,.34):
                a.cylinder('DrinkBottle',x+dx,1.11,z,.09,.42,WOOD,6,.045)
        elif item['kind']=='bin':
            a.cylinder('ServiceBin',x,.72,z,.34,1.0,METAL,8,.38)
            a.cylinder('BinLid',x,1.24,z,.39,.10,GREEN,8)
            a.box('BinHandle',x,1.33,z,.23,.09,.08,METAL)
            a.box('BinLabel',x,.86,z+.365,.27,.22,.015,CREAM)
        else:
            a.box('WashStand',x,.64,z,.78,.86,.48,GREEN)
            a.box('WashBasin',x,1.14,z,.92,.16,.60,CREAM)
            a.box('BasinInset',x,1.225,z+.025,.69,.012,.37,METAL)
            a.box('WashTapStem',x,1.39,z-.22,.065,.32,.065,METAL)
            a.box('WashTapSpout',x,1.53,z-.10,.065,.065,.29,METAL)
            a.cylinder('SoapBottle',x+.31,1.38,z-.13,.065,.29,TILE,6)
            a.box('SoapPump',x+.31,1.55,z-.10,.11,.04,.04,METAL)
