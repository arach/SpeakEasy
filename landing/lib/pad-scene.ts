import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

/** Blender-authored meshes, with a deterministic scroll playhead. */
export async function mountPadScene(stage: HTMLElement) {
  if (stage.querySelector('canvas')) return
  const canvas = document.createElement('canvas')
  canvas.className = 'pad-webgl'
  canvas.setAttribute('aria-hidden', 'true')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  const scene = new THREE.Scene()
  scene.background=new THREE.Color(getComputedStyle(stage).getPropertyValue('--bg2').trim() || '#f0efeb')
  const camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 60)
  camera.position.set(0, 0, 15)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new THREE.Scene()
  room.background=new THREE.Color(0x555b64)
  const cards:THREE.Mesh[]=[]
  for(const [x,y,z,w,h,intensity] of [[-4,5,5,5,6,3.5],[5,1,3,1.5,5,2],[0,7,1,5,2,1.6]]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(intensity,intensity,intensity),side:THREE.DoubleSide}))
    card.position.set(x,y,z);card.lookAt(0,0,0);room.add(card);cards.push(card)
  }
  const environment = pmrem.fromScene(room, .035)
  scene.environment = environment.texture
  cards.forEach(card=>{card.geometry.dispose();(card.material as THREE.Material).dispose()}); pmrem.dispose()
  // Broad area sources supply soft surface gradients. A low-energy shadow
  // light preserves contact beneath the switches without hard black cutouts.
  RectAreaLightUniformsLib.init()
  const softbox=new THREE.RectAreaLight(0xfff7ed,7,6,5)
  softbox.position.set(-4,5,7);softbox.lookAt(0,0,0);scene.add(softbox)
  const edgebox=new THREE.RectAreaLight(0xe4edff,4,2,5)
  edgebox.position.set(5,1,3);edgebox.lookAt(0,0,0);scene.add(edgebox)
  const keyLight = new THREE.DirectionalLight(0xfffaf3, .85)
  keyLight.position.set(-3, 7, 10)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  Object.assign(keyLight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 30 })
  keyLight.shadow.normalBias = .008
  keyLight.shadow.bias = -.0002
  keyLight.shadow.radius = 18
  keyLight.shadow.blurSamples = 16
  scene.add(keyLight, new THREE.HemisphereLight(0xf6f7ff, 0x343941, .18))
  const fill = new THREE.DirectionalLight(0xe5ecff, .42)
  fill.position.set(5, -2, 5); scene.add(fill)
  let gltf
  try { gltf = await new GLTFLoader().loadAsync('/models/speakeasy-micro.glb') } catch(error) { renderer.dispose();environment.dispose();throw error }
  if (!stage.isConnected) { renderer.dispose(); environment.dispose(); return }
  const model = gltf.scene
  scene.add(model)
  // Separate manufacturing finishes, with deterministic mipmapped surface maps.
  function surfaceMap(kind:'plastic'|'rubber'|'brushed'|'albedo') {
    const size=512,data=new Uint8Array(size*size*4)
    let seed=731
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967295}
    const lines=Array.from({length:size},()=>random())
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const noise=random()
      const value=kind==='albedo' ? 205+45*noise : kind==='brushed' ? 145+80*lines[y]+15*noise : kind==='rubber' ? 105+135*noise : 175+65*noise+10*Math.sin(x*.071)*Math.sin(y*.053)
      const v=Math.round(value);data.set([v,v,v,255],(y*size+x)*4)
    }
    const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat)
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(kind==='brushed'?.3:.22,kind==='brushed'?.22:.22)
    map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());map.needsUpdate=true
    return map
  }
  const grain=surfaceMap('plastic'),rubberGrain=surfaceMap('rubber'),brush=surfaceMap('brushed'),plasticColor=surfaceMap('albedo')
  const finishes=new Map<THREE.Material,THREE.MeshPhysicalMaterial>()
  const nodes = new Map<string, THREE.Object3D>()
  model.traverse(o => {
    nodes.set(o.name, o)
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial))return
    o.castShadow=true;o.receiveShadow=true
    const source=o.material
    let m=finishes.get(source)
    if(!m){
      m=new THREE.MeshPhysicalMaterial()
      THREE.MeshStandardMaterial.prototype.copy.call(m,source)
      if(source instanceof THREE.MeshPhysicalMaterial)m.copy(source)
      m.envMapIntensity=.65
      if(/Ceramic/.test(m.name)){
        m.map=plasticColor;m.roughness=.56;m.roughnessMap=grain;m.bumpMap=grain;m.bumpScale=.014
        m.metalness=0;m.clearcoat=.22;m.clearcoatRoughness=.35
      } else if(/aluminum|Polished/.test(m.name)){
        m.roughness=.32;m.roughnessMap=brush;m.bumpMap=brush;m.bumpScale=.005
        m.anisotropy=.6;m.anisotropyRotation=Math.PI/2;m.envMapIntensity=.95
      } else if(/Thumb rubber/.test(m.name)){
        m.roughness=.62;m.bumpMap=rubberGrain;m.bumpScale=.004;m.metalness=0;m.envMapIntensity=.9
      } else if(/elastomer/.test(m.name)){
        m.roughness=.92;m.bumpMap=rubberGrain;m.bumpScale=.012;m.metalness=0
      }
      finishes.set(source,m)
    }
    o.material=m
    if(source.name==='Frosted polycarbonate'){
      // The frame diffuses light; the optical caps expose the mechanisms.
      const glass=m.clone();o.material=glass;glass.side=THREE.FrontSide
      const frame=o.name==='Rim'
      glass.color.set(frame?0xe9eeeb:0xffffff)
      glass.transmission=frame?.70:1;glass.roughness=frame?.28:.028
      glass.thickness=frame?.18:.065;glass.ior=1.49
      glass.attenuationColor.set(0xe1ebe6);glass.attenuationDistance=frame?.65:2.5
      glass.clearcoat=frame?.08:.35;glass.clearcoatRoughness=.08
      glass.envMapIntensity=frame?.85:1.6
      if(frame){glass.bumpMap=grain;glass.bumpScale=.005;glass.roughnessMap=grain}
      o.castShadow=false
    }
  })
  model.traverse(o => {
    if (o instanceof THREE.Mesh && /Lens_highlight/.test(o.name)) {
      const m=(o.material as THREE.MeshPhysicalMaterial).clone();m.transmission=.92;m.roughness=.12;m.metalness=0;o.material=m
    }
  })
  const lensMaterials = new Set<THREE.Material>()
  model.traverse(o => {
    if(o instanceof THREE.Mesh && /Status_lens|Lens_highlight|Lens_surround/.test(o.name)) {
      const m=(o.material as THREE.Material).clone();m.transparent=true;o.material=m;lensMaterials.add(m)
    }
  })
  const originals = new Map<string, { position: THREE.Vector3; scale: THREE.Vector3 }>()
  for (const [name, node] of nodes) originals.set(name, { position: node.position.clone(), scale: node.scale.clone() })
  const screenShape=new THREE.Shape(), sw=7.83/2, sh=5.32/2, sr=.34
  screenShape.moveTo(-sw+sr,-sh);screenShape.lineTo(sw-sr,-sh);screenShape.quadraticCurveTo(sw,-sh,sw,-sh+sr)
  screenShape.lineTo(sw,sh-sr);screenShape.quadraticCurveTo(sw,sh,sw-sr,sh)
  screenShape.lineTo(-sw+sr,sh);screenShape.quadraticCurveTo(-sw,sh,-sw,sh-sr)
  screenShape.lineTo(-sw,-sh+sr);screenShape.quadraticCurveTo(-sw,-sh,-sw+sr,-sh)
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(screenShape,24), new THREE.MeshPhysicalMaterial({ color: 0x0c171a, roughness: .36, metalness: .02, transparent: true, opacity: 0 }))
  panel.rotation.x = -Math.PI / 2; panel.position.y = .302; model.add(panel)
  const texture = await makeScreenTexture()
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 5.7), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }))
  ink.rotation.x = -Math.PI / 2; ink.position.y = .36; ink.renderOrder = 3; model.add(ink)
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256
  const shadowContext=shadowCanvas.getContext('2d')!
  const gradient=shadowContext.createRadialGradient(128,128,12,128,128,128)
  gradient.addColorStop(0,'rgba(30,34,39,.38)');gradient.addColorStop(.35,'rgba(30,34,39,.20)');gradient.addColorStop(1,'rgba(30,34,39,0)')
  shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,256,256)
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2,5.2), new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}))
  shadow.position.set(.18,-.62,-1.1);scene.add(shadow)
  const slotMap = [1,2,0,3,4,5,6,7,8]
  const hiddenHardware = ['Dial','Joystick','Extra','Command','Engraving', 'Bolt0','Bolt1','Bolt2','Bolt3']
  const rim = nodes.get('Rim') as THREE.Mesh
  const rimMaterial = (rim.material as THREE.MeshPhysicalMaterial).clone()
  rim.material = rimMaterial
  const originalRim = rimMaterial.color.clone()
  const deck = nodes.get('Deck') as THREE.Mesh
  deck.material = (deck.material as THREE.Material).clone()
  const deckMaterial = deck.material as THREE.MeshStandardMaterial
  const originalDeck = deckMaterial.color.clone()
  const mix = THREE.MathUtils.lerp
  const smooth = (v: number) => { v=THREE.MathUtils.clamp(v,0,1); return v*v*(3-2*v) }
  let lastProgress = -1
  let raf = 0
  let disposed = false
  let currentRaw = 0
  let inputRaw = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  function pose(raw: number) {
    if (disposed) return
    inputRaw=raw
    currentRaw = reduced.matches ? 1 : raw
    if (lastProgress === currentRaw) return
    lastProgress = currentRaw
    scene.background=new THREE.Color(getComputedStyle(stage).getPropertyValue('--bg2').trim() || '#f0efeb')
    const t = smooth((currentRaw-.32)/.57)
    const explode = smooth((currentRaw-.065)/.18)*(1-smooth((currentRaw-.34)/.20))
    const collapse = smooth((currentRaw-.40)/.30)
    const digital = smooth((currentRaw-.75)/.14)
    model.rotation.set(Math.PI/2 - mix(.69,0,t) - .22*explode, mix(-.22,0,t), mix(-.30,0,t))
    model.position.y = mix(.10,0,t)-.55*explode
    const aspect=stage.clientWidth/stage.clientHeight
    const viewHeight=Math.max(6.5+1.0*explode,mix(6.8,9.3,t)/aspect)
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2
    camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix()
    model.scale.setScalar(mix(1.12,1,t))
    shadow.scale.set(mix(1,1.3,t),1,1)
    for (const name of ['Body','Edge','Rim','Lightpipe','Deck']) {
      const node=nodes.get(name)!, original=originals.get(name)!
      node.scale.set(original.scale.x*mix(1,8.2/4.55,t),original.scale.y*mix(1,.55,t),original.scale.z*mix(1,5.7/4.24,t))
    }
    rimMaterial.color.copy(originalRim).lerp(new THREE.Color(0xe5e4df),smooth((currentRaw-.4)/.4))
    rimMaterial.transmission=mix(.70,0,smooth((currentRaw-.4)/.4))
    rimMaterial.bumpScale=mix(.005,0,t)
    rimMaterial.roughness=mix(.28,.38,t)
    deckMaterial.color.copy(originalDeck).lerp(new THREE.Color(0xf0efeb),t)
    const lightpipe=nodes.get('Lightpipe')!
    lightpipe.visible=currentRaw<.65
    for (const name of hiddenHardware) {
      const node=nodes.get(name)!, original=originals.get(name)!
      const shrink=1-collapse
      node.scale.copy(original.scale).multiplyScalar(Math.max(.001,shrink))
      node.visible=shrink>.005
    }
    for(let i=0;i<9;i++) {
      const node=nodes.get('Key'+i)!, original=originals.get('Key'+i)!, slot=slotMap[i]
      const x=(slot%3-1)*2.59, y=1.43-Math.floor(slot/3)*1.30
      node.position.set(mix(original.position.x,x,t),mix(original.position.y,.31,t)+.30*Math.sin(Math.PI*t),mix(original.position.z,-y,t))
      const shrink=smooth(t/.30), expand=smooth((t-.60)/.40)
      node.scale.set(1-.43*shrink+(2.42/.88-.57)*expand,mix(1,.025,collapse),1-.43*shrink+(1.12/.86-.57)*expand)
      const cap=nodes.get('CapAssembly'+i)!, capOriginal=originals.get('CapAssembly'+i)!
      cap.position.copy(capOriginal.position);cap.position.y+=3.0*explode
      cap.visible=collapse<.94
      const tile=nodes.get('TaskTile'+i)!
      tile.visible=collapse>=.94 && digital<.02
      node.children.forEach(child=>{if(/Switch|Stem/i.test(child.name))child.visible=collapse<.94})
    }
    lensMaterials.forEach(m=>{m.opacity=1-digital})
    const talk=nodes.get('Talk')!, talkOrig=originals.get('Talk')!
    talk.visible=digital<.02
    talk.position.set(mix(talkOrig.position.x,0,t),mix(talkOrig.position.y,.31,t),mix(talkOrig.position.z,2.28,t))
    talk.scale.set(mix(1,7.6/2.88,t),mix(1,.035,collapse),mix(1,.46/.61,t))
    talk.children.forEach(child=>{if(/label|switch/i.test(child.name))child.visible=collapse<.95})
    panel.material.opacity=smooth((currentRaw-.50)/.25)
    panel.scale.set(mix(4.4/7.83,1,t),mix(4.09/5.32,1,t),1)
    ink.material.opacity=digital
    if (!raf) raf=requestAnimationFrame(()=>{raf=0;renderer.render(scene,camera)})
  }
  function resize() {
    const width=stage.clientWidth,height=stage.clientHeight
    renderer.setSize(width,height,false)
    const aspect=width/height
    const viewHeight=Math.max(6.5,9.3/aspect)
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2
    camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix()
    lastProgress=-1;pose(currentRaw)
  }
  const onProgress=(event: Event)=>pose((event as CustomEvent<number>).detail)
  stage.addEventListener('pad-progress',onProgress)
  const onReduced=()=>{lastProgress=-1;pose(inputRaw)}
  reduced.addEventListener('change',onReduced)
  const themeObserver=new MutationObserver(()=>{lastProgress=-1;pose(currentRaw)})
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-mode']})
  const observer=new ResizeObserver(resize);observer.observe(stage)
  stage.appendChild(canvas)
  currentRaw=Number(stage.dataset.progress || 0)
  resize()
  renderer.render(scene,camera)
  stage.classList.add('has-webgl')
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stage.classList.remove('has-webgl')})
  canvas.addEventListener('webglcontextrestored',()=>{lastProgress=-1;pose(currentRaw);stage.classList.add('has-webgl')})
  function dispose() {
    if(disposed)return;disposed=true
    cancelAnimationFrame(raf);themeObserver.disconnect();observer.disconnect();reduced.removeEventListener('change',onReduced)
    stage.removeEventListener('pad-progress',onProgress)
    scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}})
    grain.dispose();rubberGrain.dispose();brush.dispose();plasticColor.dispose();texture.dispose();shadowTexture.dispose();environment.dispose();renderer.dispose();canvas.remove()
  }
  // The mock may be replaced by Next navigation; release GPU resources at that boundary.
  const removal=new MutationObserver(()=>{if(!stage.isConnected){dispose();removal.disconnect()}})
  removal.observe(document.body,{childList:true,subtree:true})
}

/** Presentation snapshot of the Pad's Console layout (pad/src/app.ts + styles.css). */
/** Actual Deck demo capture at 2× resolution, without stretching the interface. */
async function makeScreenTexture() {
  const screenshot = new Image()
  screenshot.src = '/implementation/deck-screen-light.png'
  await screenshot.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 2460
  canvas.height = 1710
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.roundRect(56, 57, 2348, 1596, 92)
  ctx.clip()
  ctx.drawImage(screenshot, 56, 57, 2348, 1596)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
