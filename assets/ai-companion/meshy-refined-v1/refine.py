import bpy,math,json
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'comparison-baseline.blend'))
scene=bpy.context.scene;o=bpy.data.objects['Mesh_0'];o.name='Companion • Meshy original geometry'
m=o.data.materials[0];m.name='Midnight Elegance • reference material refinement'
ns=m.node_tree.nodes;lk=m.node_tree.links;ns.clear()
def node(typ,name):
    n=ns.new(typ);n.label=name;n.name=name;return n
def mathn(op,a,b=0,name=None):
    n=node('ShaderNodeMath',name or op);n.operation=op
    for i,v in enumerate([a,b]):
        if hasattr(v,'node'):lk.new(v,n.inputs[i])
        else:n.inputs[i].default_value=v
    return n.outputs[0]
def ramp(value,lo,hi,name):
    n=node('ShaderNodeMapRange',name);n.clamp=True;n.interpolation_type='SMOOTHSTEP';lk.new(value,n.inputs['Value']);n.inputs['From Min'].default_value=lo;n.inputs['From Max'].default_value=hi
    return n.outputs['Result']
def mix(a,b,fac,name):
    n=node('ShaderNodeMixRGB',name);n.blend_type='MIX'
    for i,v in enumerate([fac,a,b]):
        if hasattr(v,'node'):lk.new(v,n.inputs[i])
        else:n.inputs[i].default_value=v if isinstance(v,tuple) else (v,v,v,1) if i else v
    return n.outputs[0]
def multiply(color,rgb,name):
    n=node('ShaderNodeMixRGB',name);n.blend_type='MULTIPLY';n.inputs[0].default_value=1;lk.new(color,n.inputs[1]);n.inputs[2].default_value=(*rgb,1);return n.outputs[0]
def texture(suffix,colorspace,name):
    p=next(p for p in (out/'source').rglob('*'+suffix+'.png') if '.fbm' not in str(p))
    im=bpy.data.images.load(str(p),check_existing=False);im.colorspace_settings.name=colorspace;im.name=name
    n=node('ShaderNodeTexImage',name);n.image=im;return n.outputs['Color']
base=texture('_texture','sRGB','SOURCE • lossless 4K color')
rough=texture('_roughness','Non-Color','SOURCE • roughness')
metal=texture('_metallic','Non-Color','SOURCE • metallic')
normal=texture('_normal','Non-Color','SOURCE • lossless tangent normal')
sep=node('ShaderNodeSeparateColor','Color analysis');sep.mode='RGB';lk.new(base,sep.inputs[0])
gray=node('ShaderNodeRGBToBW','Luminance');lk.new(base,gray.inputs[0])
geo=node('ShaderNodeNewGeometry','World position');xyz=node('ShaderNodeSeparateXYZ','Height in meters');lk.new(geo.outputs['Position'],xyz.inputs[0]);z=xyz.outputs['Z']
# Soft material masks stay on the imported UVs and avoid hard material seams.
metalMask=ramp(metal,.015,.20,'Jewelry mask')
warm=ramp(mathn('SUBTRACT',sep.outputs[0],sep.outputs[2]),.025,.105,'Warm skin chroma')
light=ramp(gray.outputs[0],.075,.23,'Skin luminance')
skin=mathn('MULTIPLY',mathn('MULTIPLY',warm,light),mathn('SUBTRACT',1,metalMask),'SKIN MASK')
notSkin=mathn('SUBTRACT',1,skin)
brown=ramp(mathn('DIVIDE',sep.outputs[0],mathn('ADD',sep.outputs[2],.0006)),1.3,2.1,'Espresso chroma')
hair=mathn('MULTIPLY',mathn('MULTIPLY',notSkin,brown),ramp(z,1.10,1.32,'Hair height'),'HAIR MASK')
heel=mathn('MULTIPLY',notSkin,mathn('SUBTRACT',1,ramp(z,.10,.17,'Footwear height')),'HEEL MASK')
# Color multipliers are in linear light, preserving the source photographic detail.
clothColor=multiply(base,(.62,.66,.72),'Deep neutral black cotton')
skinColor=multiply(base,(.82,.73,.65),'Warm natural complexion')
hairColor=multiply(base,(.52,.46,.40),'Dark espresso hair')
col=mix(clothColor,skinColor,skin,'Skin color selection')
col=mix(col,hairColor,hair,'Hair color selection')
col=mix(col,multiply(base,(.72,.72,.74),'Black polished pumps'),heel,'Pump color selection')
col=mix(col,mix(base,(.58,.32,.085,1),.35,'Warm gold tint'),metalMask,'Jewelry color selection')
# Preserve variation from source roughness, with surface-specific response.
clothR=mathn('ADD',.69,mathn('MULTIPLY',rough,.18),'Matte woven cloth roughness')
skinR=mathn('ADD',.37,mathn('MULTIPLY',rough,.17),'Natural skin roughness')
hairR=mathn('ADD',.53,mathn('MULTIPLY',rough,.10),'Soft hair roughness')
r=mix(clothR,skinR,skin,'Skin roughness selection');r=mix(r,hairR,hair,'Hair roughness selection');r=mix(r,.27,heel,'Pump roughness selection');r=mix(r,.25,metalMask,'Jewelry roughness selection')
met=mathn('MULTIPLY',metalMask,.88,'Gold metallic response')
# Re-normalized tangent vectors reduce the coarse generated surface effect.
strength=mix(.45,.20,skin,'Gentle skin normal');strength=mix(strength,.3,hair,'Hair normal strength');strength=mix(strength,.7,heel,'Pumps normal strength')
decode=node('ShaderNodeVectorMath','Decode tangent normal');decode.operation='MULTIPLY_ADD';lk.new(normal,decode.inputs[0]);decode.inputs[1].default_value=(2,2,2);decode.inputs[2].default_value=(-1,-1,-1)
vsep=node('ShaderNodeSeparateXYZ','Tangent components');lk.new(decode.outputs[0],vsep.inputs[0])
vjoin=node('ShaderNodeCombineXYZ','Adjust XY strength');lk.new(mathn('MULTIPLY',vsep.outputs[0],strength),vjoin.inputs[0]);lk.new(mathn('MULTIPLY',vsep.outputs[1],strength),vjoin.inputs[1]);lk.new(vsep.outputs[2],vjoin.inputs[2])
norm=node('ShaderNodeVectorMath','Unit tangent normal');norm.operation='NORMALIZE';lk.new(vjoin.outputs[0],norm.inputs[0])
encode=node('ShaderNodeVectorMath','REFINED NORMAL');encode.operation='MULTIPLY_ADD';lk.new(norm.outputs[0],encode.inputs[0]);encode.inputs[1].default_value=(.5,.5,.5);encode.inputs[2].default_value=(.5,.5,.5)
nmap=node('ShaderNodeNormalMap','Refined tangent normal');lk.new(encode.outputs[0],nmap.inputs['Color'])
p=node('ShaderNodeBsdfPrincipled','Reference finish');lk.new(col,p.inputs['Base Color']);lk.new(r,p.inputs['Roughness']);lk.new(met,p.inputs['Metallic']);lk.new(nmap.outputs[0],p.inputs['Normal']);p.inputs['IOR'].default_value=1.43
lk.new(mathn('MULTIPLY',skin,.045,'Skin subsurface weight'),p.inputs['Subsurface Weight']);p.inputs['Subsurface Radius'].default_value=(1,.42,.23);p.inputs['Subsurface Scale'].default_value=.035
lk.new(mathn('MULTIPLY',hair,.16,'Hair anisotropy'),p.inputs['Anisotropic'])
output=node('ShaderNodeOutputMaterial','Material Output');lk.new(p.outputs[0],output.inputs[0])
lk.new(mix(.5,.28,hair,'Controlled hair specular'),p.inputs['Specular IOR Level'])
# Named reroute sockets are stable bake inputs.
for name,socket in [('BAKE_BASECOLOR',col),('BAKE_ROUGHNESS',r),('BAKE_METALLIC',met),('BAKE_NORMAL',encode.outputs[0]),('BAKE_SKIN_MASK',skin),('BAKE_HAIR_MASK',hair)]:
    n=node('NodeReroute',name);lk.new(socket,n.inputs[0])
# Organize the node editor without altering shader evaluation.
for i,n in enumerate(ns):n.location=((i%8)*230,-(i//8)*220)
scene['height_m']=1.7;scene['reference']='approved-black-tank.png';scene['source']='Meshy_AI_Midnight_Elegance_0912154937_texture_fbx.zip'
scene['changes']='Lossless PBR sources; warmer skin; matte cotton/twill; espresso hair; gold and pumps response; normal cleanup. Geometry and UV unchanged except 1.70m scale.'
scene.camera=bpy.data.objects['CAM_Front'];scene.cycles.samples=24
for im in bpy.data.images:
    if im.name.startswith('SOURCE'):im.pack()
ref=bpy.data.images.load(str(out/'reference/approved-black-tank.png'));ref.pack();ref.name='APPROVED REFERENCE';ref.use_fake_user=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'meshy-reference-refined.blend'))
for cam,name in [('CAM_Front','after-front.png'),('CAM_Back','after-back.png'),('CAM_Face','after-face.png')]:
    scene.camera=bpy.data.objects[cam];scene.render.filepath=str(out/name)
    if cam=='CAM_Face':
        scene.camera.location.z=1.9;scene.camera.rotation_euler=(Vector((0,0,1.47))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    if cam=='CAM_Face':scene.render.resolution_x=1000;scene.render.resolution_y=1000
    bpy.ops.render.render(write_still=True)
print('REFINEMENT_PREVIEW_COMPLETE',flush=True)
