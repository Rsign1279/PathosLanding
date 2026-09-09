import bpy, json, os
scene = bpy.context.scene
scene.frame_set(1)
paths = {}
for obj in scene.objects:
    if obj.type != 'MESH' or 'net' not in obj or len(obj.data.vertices) != 650:
        continue
    def centers(vertices):
        result=[]
        for i in range(65):
            vs=[obj.matrix_world @ vertices[i*10+j].co for j in range(10)]
            p=sum(vs, vs[0]*0)/10
            result.append([p.x,p.z,-p.y])
        return result
    paths[obj.name]={'points':centers(obj.data.vertices), 'targets':{}}
    if obj.data.shape_keys:
        for key in list(obj.data.shape_keys.key_blocks)[1:]:
            paths[obj.name]['targets'][key.name]=centers(key.data)
out=os.path.join(os.path.dirname(os.path.dirname(bpy.data.filepath)), '..', 'assets', 'prototype-paths.json')
with open(out,'w') as f: json.dump(paths,f)
print('WEB_INSPECTION',json.dumps({'fps':scene.render.fps,'frames':[scene.frame_start,scene.frame_end],'paths':len(paths),'markers':[(m.name,m.frame) for m in scene.timeline_markers]}))
