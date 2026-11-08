"""Export the PATHOS hardware-detail scene for the web.

- Removes the Blender editorial HUD (titles are rebuilt in HTML) and the studio lights.
- Converts curves/text to meshes, applies modifiers on meshes without shape keys.
- Joins static meshes per rigid group (each animated module empty, plus the static root)
  so the browser draws far fewer objects. Animated meshes, shape-keyed wires and FX keep
  their own nodes.
- Exports a Draco-compressed GLB with the whole timeline baked into one clip.
"""
import bpy, sys
src, out = sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene

def animated(o):
    return bool(o.animation_data and o.animation_data.action)
def has_sk(o):
    return o.type == 'MESH' and o.data.shape_keys is not None

# 1. drop HUD + lights
hud = bpy.data.objects.get('Editorial_HUD')
kill = []
if hud: kill += [hud] + list(hud.children_recursive)
kill += [o for o in bpy.data.objects if o.type == 'LIGHT']
for o in kill: bpy.data.objects.remove(o, do_unlink=True)
# remove hidden-from-render objects too
for o in [o for o in bpy.data.objects if o.hide_render and o.type not in ('CAMERA','EMPTY')]:
    bpy.data.objects.remove(o, do_unlink=True)

# make everything selectable/visible
for o in bpy.data.objects:
    o.hide_set(False); o.hide_viewport = False; o.hide_select = False

# 2. convert curves/fonts that are NOT animated into meshes
bpy.ops.object.select_all(action='DESELECT')
conv = [o for o in bpy.data.objects if o.type in ('CURVE','FONT') and not animated(o)]
for o in conv: o.select_set(True)
if conv:
    bpy.context.view_layer.objects.active = conv[0]
    bpy.ops.object.convert(target='MESH')
# animated curves (highlight rings) -> mesh too, keeping their animation
for o in [o for o in bpy.data.objects if o.type == 'CURVE']:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH', keep_original=False)

# 3. apply modifiers where possible
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.modifiers and not has_sk(o)]:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e: o.modifiers.remove(m)

# 4. join static meshes per rigid group
def group_of(o):
    p = o.parent
    while p is not None:
        if animated(p) or p.name in ('PATHOS_ROOT',): return p
        p = p.parent
    return None
groups = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or animated(o) or has_sk(o): continue
    if o.parent and o.parent.name == 'Presentation_FX': continue
    g = group_of(o)
    if g is None: continue
    # never join something whose own children are animated
    if any(animated(c) for c in o.children_recursive): continue
    groups.setdefault(g.name, []).append(o)
joined = 0
for gname, objs in groups.items():
    if len(objs) < 2: continue
    g = bpy.data.objects[gname]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        # bake world transform relative to group, then parent directly to group
        mw = o.matrix_world.copy()
        o.parent = g
        o.matrix_parent_inverse = g.matrix_world.inverted()
        o.matrix_world = mw
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        if o.data.users > 1: o.data = o.data.copy()
    bpy.ops.object.join()
    objs[0].name = gname + '__static'
    joined += len(objs)
print('joined', joined, 'meshes into', len([g for g in groups.values() if len(g) > 1]), 'groups')

# remove now-empty empties that are not animated and have no children (cleanup)
for o in [o for o in bpy.data.objects if o.type == 'EMPTY' and not o.children and not animated(o) and o.name not in ('Camera_Focus',)]:
    bpy.data.objects.remove(o, do_unlink=True)

print('objects', len(bpy.data.objects), 'meshes', len([o for o in bpy.data.objects if o.type=='MESH']))
sc.frame_start, sc.frame_end = 1, 2880
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB',
    export_apply=False, export_yup=True,
    export_texcoords=False, export_normals=True,
    export_materials='EXPORT', export_cameras=True, export_lights=False,
    export_animations=True, export_animation_mode='SCENE', export_frame_range=True,
    export_force_sampling=True, export_frame_step=2, export_optimize_animation_size=True,
    export_morph=True, export_morph_normal=False, export_morph_animation=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
    export_extras=False)
print('EXPORTED', out)
