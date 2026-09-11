"""V5 courtyard atmosphere: low-cost festoon lights above every play route.

Coordinates are authoritative game-world metres.  The poles sit on the two flush
edge drains; cables and bulbs remain well above avatars and the gameplay furniture.
Only the existing palette is used, so this pass adds no material primitives.
"""
import bpy
import bmesh
from build_mamak_asset import ASSET, Author, CREAM, METAL, PALETTE


POLE_X = (-46.25, -11.75)
STRING_Z = (44.0, 49.0, 54.0)
TOP_Y = 5.25


def cable_height(u):
    """A deterministic parabolic sag, with u in the closed 0..1 interval."""
    return TOP_Y - 0.55 * (4 * u * (1 - u))


def add_atmosphere(a):
    # Six slim edge poles keep the open courtyard believable without occupying a
    # chair approach. Their authoritative collision footprints live in the shared
    # Mamak street layout.
    for z in STRING_Z:
        for x in POLE_X:
            a.cylinder("FestoonPole", x, TOP_Y / 2, z, .055, TOP_Y, METAL, 6)

        # Shared rings follow the sag continuously, with no horizontal steps.
        steps = 14
        span = POLE_X[1] - POLE_X[0]
        points=[]
        for index in range(steps+1):
            u=index/steps
            for dy,dz in ((-.013,-.013),(.013,-.013),(.013,.013),(-.013,.013)):
                points.append((POLE_X[0]+span*u,cable_height(u)+dy,z+dz))
        faces=[(3,2,1,0),tuple(steps*4+i for i in range(4))]
        for index in range(steps):
            for k in range(4):
                faces.append((index*4+k,index*4+(k+1)%4,(index+1)*4+(k+1)%4,(index+1)*4+k))
        a.add('FestoonCable',points,faces,METAL)

        # Round faceted bulbs use 20 triangles each. Runtime supplies warm emission.
        for index in range(6):
            u = (index + 1) / 7
            x = POLE_X[0] + span * u
            bm=bmesh.new()
            bmesh.ops.create_icosphere(bm,subdivisions=1,radius=1)
            bm.verts.ensure_lookup_table(); bm.verts.index_update()
            a.add('FestoonBulb',[(x+v.co.x*.115,cable_height(u)-.115+v.co.y*.115,z+v.co.z*.115) for v in bm.verts],
                  [tuple(v.index for v in face.verts) for face in bm.faces],CREAM)
            bm.free()


def make_atmosphere():
    """Keep festoons independently addressable so only their bulbs glow at night."""
    author = Author()
    add_atmosphere(author)
    name = f"{ASSET}_Festoon"
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(author.vertices, [], author.faces)
    for material in PALETTE:
        mesh.materials.append(bpy.data.materials[material])
    for polygon, material in zip(mesh.polygons, author.materials):
        polygon.material_index = material
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        axes = sorted(range(3), key=lambda axis: abs(polygon.normal[axis]))[:2]
        for index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (vertex[axes[0]], vertex[axes[1]])
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LM_EXPORT_Geometry"].objects.link(obj)
    for index, (part, start, count) in enumerate(author.parts):
        obj.vertex_groups.new(name=f"LM_PART_{index:03d}_{part}").add(
            list(range(start, start + count)), 1, "REPLACE")
    obj["lm_asset_id"] = name
    obj["lm_bulb_count"] = len(STRING_Z) * 6
    obj["lm_pole_count"] = len(STRING_Z) * len(POLE_X)
    obj["lm_min_clearance_m"] = min(cable_height(i / 7) - .23 for i in range(1, 7))
    return obj
