"""Build SpeakEasy's original micro-controller study and export an editable blend + web GLB.
Run: blender --background --python design/blender-pad/build.py
"""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0,rough=.3,trans=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Transmission Weight'].default_value=trans;p.inputs['IOR'].default_value=1.46
    return m
silver=material('Bead blasted aluminum',(.62,.64,.66),.65,.32)
edge=material('Polished perimeter',(.68,.71,.73),1,.16)
white=material('Ceramic white',(.78,.79,.78),0,.43)
clear=material('Frosted polycarbonate',(.94,.97,.98),0,.075,.96)
black=material('Graphite elastomer',(.014,.017,.020),0,.72)
ink=material('Engraved charcoal',(.08,.13,.10),.2,.35)
light=material('Mint light pipe',(.66,.78,.72),.1,.24)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.30,.48,.40,1)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.2

def group(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return o

def parent(o,p):
    if p:o.parent=p
    return o

def box(name,loc,size,mat,bevel=.08,p=None):
    w,h,d=size; r=min(bevel,w/2-.001,h/2-.001); vertices=[]
    # Rounded XY outline independent of slab thickness.
    for z in [-d/2,d/2]:
        for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
            for j in range(9):
                angle=math.radians(start+j*90/8); vertices.append((cx+r*math.cos(angle),cy+r*math.sin(angle),z))
    n=len(vertices)//2;faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    mod=o.modifiers.new('Soft machined edge','BEVEL');mod.width=min(.065,d/3);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat);o.select_set(False);return parent(o,p)

def cylinder(name,loc,r,depth,mat,p=None,vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name
    mod=o.modifiers.new('Edge chamfer','BEVEL');mod.width=min(depth/4,.03);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    o.data.materials.append(mat);return parent(o,p)

def text(name,body,loc,size,mat,p=None):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.0008
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    return parent(o,p)

box('Body',(0,0,-.1),(4.55,4.24,.40),silver,.30)
box('Edge',(0,0,.02),(4.64,4.33,.12),edge,.30)
box('Lightpipe',(0,0,.095),(4.57,4.26,.07),light,.28)
box('Rim',(0,0,.16),(4.66,4.35,.22),clear,.32)
box('Deck',(0,0,.25),(4.40,4.09,.075),white,.24)
# Through-bolts, individually modeled heads and milled slots.
for i,(x,y) in enumerate([(-2.02,1.82),(2.02,1.82),(-2.02,-1.80),(2.02,-1.80)]):
    g=group('Bolt'+str(i),(x,y,.30));cylinder('Bolt seat',(0,0,0),.092,.025,silver,g);cylinder('Bolt head',(0,0,.028),.068,.04,black,g);box('Driver slot',(0,0,.05),(.067,.016,.006),silver,.003,g)
colors=[(.35,.72,.53),(.61,.46,.87),(.43,.63,.88),(.88,.68,.25),(.40,.71,.53),(.66,.49,.89),(.70,.79,.75),(.70,.79,.75),(.70,.79,.75)]
positions=[(-.48,1.14),(.51,1.14),(-1.47,.12),(-.48,.12),(.51,.12),(1.50,.12),(-1.47,-.91),(-.48,-.91),(.51,-.91)]
# Hollow caps expose complete mechanical switches rather than opaque inserts.
switch_top=material('Switch smoked housing',(.12,.14,.16),.35,.30)
stem_mat=material('Lavender POM stems',(.34,.23,.62),0,.38)
for i,(x,y) in enumerate(positions):
    g=group('Key'+str(i),(x,y,.33))
    box('Switch lower',(0,0,.035),(.75,.73,.09),black,.035,g)
    box('Switch upper',(0,0,.105),(.64,.62,.07),switch_top,.055,g)
    for sx in [-.29,.29]:
        box('Switch latch',(sx,0,.15),(.055,.30,.035),silver,.01,g)
    cylinder('Stem collar',(0,0,.17),.14,.075,stem_mat,g)
    box('Stem cross A',(0,0,.22),(.20,.07,.09),stem_mat,.012,g)
    box('Stem cross B',(0,0,.22),(.07,.20,.09),stem_mat,.012,g)
    cap=group('CapAssembly'+str(i));parent(cap,g)
    shell=box('Keycap shell',(0,0,.31),(.88,.86,.28),clear if i<6 else white,.16)
    cutter=box('Cap cavity',(0,0,.225),(.77,.75,.34),white,.12)
    bpy.context.view_layer.objects.active=shell
    mod=shell.modifiers.new('Hollow underside','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    # A shallow finger dish gives the opaque caps a sculpted top surface.
    if i>=6:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=20,radius=.90,location=(0,0,1.31))
        dish=bpy.context.object;bpy.context.view_layer.objects.active=shell
        mod=shell.modifiers.new('Finger dish','BOOLEAN');mod.operation='DIFFERENCE';mod.object=dish
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(dish,do_unlink=True)
    parent(shell,cap)
    if i<6:
        bpy.ops.mesh.primitive_torus_add(major_radius=.175,minor_radius=.012,major_segments=48,minor_segments=8,location=(0,0,.452))
        ring=bpy.context.object;ring.name='Cap etched ring';ring.data.materials.append(clear);parent(ring,cap)
    glyph=text('Cap glyph',['+','...','+','!','+','...','+','*','↶'][i],(0,0,.455 if i<6 else .411),.14 if i<6 else .19,ink,cap)
    if i>=6:
        for vertex in glyph.data.vertices:
            x,y=vertex.co.x,vertex.co.y
            vertex.co.z=1.31-math.sqrt(max(.01,.90**2-x*x-y*y))+.003-glyph.location.z
    # This surface appears only after the mechanical assembly becomes software.
    box('TaskTile'+str(i),(0,0,.22),(.88,.86,.06),white,.09,g)
# Turned metal knob with 64 radial knurls and a deep engraved index.
g=group('Dial',(-1.47,1.14,.34));cylinder('Dial base',(0,0,.05),.44,.12,black,g)
cylinder('Dial barrel',(0,0,.21),.415,.25,silver,g)
for j in range(64):
    a=j*math.tau/64;cylinder('Knurl',(math.cos(a)*.405,math.sin(a)*.405,.22),.014,.19,edge,g,vertices=8)
cylinder('Dial cap',(0,0,.35),.41,.05,silver,g)
box('Dial index',(0,.17,.38),(.026,.25,.007),ink,.005,g)
g=group('Joystick',(1.50,1.14,.34));cylinder('Stick socket',(0,0,.01),.30,.08,silver,g);cylinder('Stick stem',(0,0,.19),.14,.31,black,g);cylinder('Thumb rest',(0,0,.37),.29,.16,black,g);cylinder('Thumb inset',(0,0,.455),.22,.008,ink,g)
g=group('Talk',(-.49,-1.73,.36));box('Space switch',(0,0,0),(2.73,.49,.11),black,.07,g);box('Space cap',(0,0,.12),(2.88,.61,.22),white,.09,g);text('Space label','H O L D   T O   S P E A K',(0,0,.237),.10,ink,g)
for name,x,y,glyph in [('Extra',1.50,-1.73,'+'),('Command',1.50,-.91,'x')]:
    g=group(name,(x,y,.36));box('Command switch',(0,0,0),(.71,.55,.11),black,.06,g);box('Command cap',(0,0,.12),(.88,.64 if name=='Extra' else .86,.22),white,.09,g);text('Action label',glyph,(0,0,.237),.22,ink,g)
g=group('Engraving');text('Brand','S P E A K E A S Y',(-.90,-2.005,.297),.062,ink,g);text('Serial','SE-01 / MICRO',(1.04,-2.005,.297),.05,ink,g)
# Merge the identical knurls into one draw call, retaining the dial hierarchy.
bpy.ops.object.select_all(action='DESELECT')
knurls=[o for o in bpy.data.objects if o.name.startswith('Knurl')]
for o in knurls:o.select_set(True)
bpy.context.view_layer.objects.active=knurls[0];bpy.ops.object.join();bpy.context.object.name='Knurl ring'
bpy.ops.object.select_all(action='DESELECT')
# UVs carry fine surface grain into the web renderer.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.cube_project(cube_size=1);bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
# Save a usable studio scene alongside the web mesh.
bpy.ops.object.camera_add(location=(5,-7,10));camera=bpy.context.object;camera.name='Studio camera';camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8;bpy.context.scene.camera=camera
for name,loc,power,size in [('Key softbox',(-4,2,7),900,5),('Rim softbox',(4,4,5),1100,4),('Front fill',(1,-5,5),450,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'design/blender-pad/speakeasy-micro.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'landing/public/models/speakeasy-micro.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_animations=False)
print('SpeakEasy model exported.')
