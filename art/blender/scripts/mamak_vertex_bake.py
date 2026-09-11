"""Cycles ambient occlusion baked into portable COLOR_0, without another texture."""
import bpy
from lm_pipeline import write_json


def bake_site(obj, output):
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=32;scene.cycles.seed=17;scene.cycles.use_adaptive_sampling=False
    scene.render.bake.target='VERTEX_COLORS'
    scene.render.bake.use_selected_to_active=False
    color=obj.data.color_attributes.new(name='LM_Baked_Occlusion',type='FLOAT_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color=color
    original=list(obj.data.materials)
    bake=bpy.data.materials.new('LM_BAKE_Occlusion');bake.use_nodes=True
    nodes,links=bake.node_tree.nodes,bake.node_tree.links
    ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=1.25;ao.samples=32
    emission=nodes.new('ShaderNodeEmission')
    links.new(ao.outputs['AO'],emission.inputs['Color'])
    links.new(emission.outputs[0],nodes['Material Output'].inputs['Surface'])
    for i in range(len(original)):obj.data.materials[i]=bake
    # Preview ground is not part of this portable bake.
    ground=bpy.data.objects['LM_PREVIEW_Ground'];old_hidden=ground.hide_render;ground.hide_render=True
    try:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.bake(type='EMIT')
    finally:
        for i,mat in enumerate(original):obj.data.materials[i]=mat
        ground.hide_render=old_hidden;bpy.data.materials.remove(bake)
        scene.render.bake.target='IMAGE_TEXTURES';scene.render.engine='BLENDER_EEVEE'
    raw=[c.color[0] for c in color.data]
    assert max(raw)-min(raw)>.1,'AO bake is flat'
    # Gentle contact shading keeps the approved cream/red palette readable at night.
    for c in color.data:
        value=.58+.42*max(0,min(1,c.color[0]));c.color=(value,value,value,1)
    obj['lm_vertex_bake']='cycles-ao-1.25m-v1'
    for mat in original:
        nodes,links=mat.node_tree.nodes,mat.node_tree.links;bsdf=nodes['Principled BSDF']
        attr=nodes.new('ShaderNodeVertexColor');attr.name='LM_Baked_Occlusion';attr.layer_name=color.name
        multiply=nodes.new('ShaderNodeMixRGB');multiply.name='LM_Occlusion_Tint';multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=1;multiply.inputs[1].default_value=bsdf.inputs['Base Color'].default_value
        links.new(attr.outputs['Color'],multiply.inputs[2]);links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
    # Festoon shares palette materials: explicit white prevents dark missing-attribute previews.
    festoon=bpy.data.objects['LM_ENV_MamakMaju_Festoon']
    white=festoon.data.color_attributes.new(name=color.name,type='FLOAT_COLOR',domain='CORNER')
    festoon.data.color_attributes.active_color=white
    for c in white.data:c.color=(1,1,1,1)
    write_json(output/'reports/vertex-baking.json',{'passed':True,'engine':'CYCLES','device':'CPU',
        'samples':32,'seed':17,'distance_m':1.25,'raw_range':[min(raw),max(raw)],
        'export_range':[min(c.color[0] for c in color.data),max(c.color[0] for c in color.data)],
        'loops':len(color.data),'direct_lighting_baked':False,'additional_textures':0})
