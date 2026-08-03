import * as THREE from 'three'

const rand = (a, b) => a + Math.random() * (b - a)

function canvasTexture(size, draw, repeat) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  draw(c.getContext('2d'), size)
  const tex = new THREE.CanvasTexture(c)
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
  }
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function dirtTexture() {
  return canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = '#6b5a3e'
      g.fillRect(0, 0, s, s)
      for (let i = 0; i < 900; i++) {
        const v = Math.random()
        g.fillStyle = v < 0.5 ? '#5d4d34' : v < 0.8 ? '#7a6748' : '#8a7653'
        g.globalAlpha = 0.25 + Math.random() * 0.3
        g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 5)
      }
      g.globalAlpha = 1
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `rgba(60,48,30,${0.25 + Math.random() * 0.2})`
        g.lineWidth = 1 + Math.random() * 2
        const x = Math.random() * s
        const y = Math.random() * s
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + rand(-24, 24), y + rand(-24, 24))
        g.stroke()
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(200,180,140,${0.1 + Math.random() * 0.15})`
        g.beginPath()
        g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 0, 7)
        g.fill()
      }
    },
    40,
  )
}

function stripesTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#202020'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#f2b31c'
    for (let i = 0; i < 8; i++) {
      g.save()
      g.translate(0, i * 16)
      g.transform(1, 0, -0.8, 1, 0, 0)
      g.fillRect(0, 0, s, 8)
      g.restore()
    }
  })
}

function gridTexture() {
  return canvasTexture(128, (g, s) => {
    g.clearRect(0, 0, s, s)
    g.strokeStyle = 'rgba(140,150,150,0.85)'
    g.lineWidth = 2
    const step = 16
    for (let i = 0; i <= s / step; i++) {
      g.beginPath()
      g.moveTo(i * step, 0)
      g.lineTo(i * step, s)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i * step)
      g.lineTo(s, i * step)
      g.stroke()
    }
  })
}

function makeCloudTexture() {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s)
    for (let i = 0; i < 40; i++) {
      const r = 14 + Math.random() * 46
      g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`
      g.beginPath()
      g.arc(s / 2 + rand(-60, 60), s / 2 + rand(-28, 28), r, 0, 7)
      g.fill()
    }
  })
}

function skyDome() {
  const geo = new THREE.SphereGeometry(240, 24, 16)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const zenith = new THREE.Color('#3f6fa8')
  const horizon = new THREE.Color('#e9c793')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = THREE.MathUtils.clamp((y / 240 + 1) / 2, 0, 1)
    c.copy(horizon).lerp(zenith, Math.pow(t, 0.75))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  return new THREE.Mesh(geo, mat)
}

function clouds(scene) {
  const group = new THREE.Group()
  const tex = makeCloudTexture()
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, fog: false, depthWrite: false })
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(mat)
    const r = 30 + Math.random() * 55
    const a = Math.random() * Math.PI * 2
    sp.position.set(Math.cos(a) * r, 26 + Math.random() * 16, Math.sin(a) * r)
    sp.scale.set(26 + Math.random() * 22, 7 + Math.random() * 5, 1)
    sp.material = mat.clone()
    sp.material.opacity = 0.3 + Math.random() * 0.3
    group.add(sp)
  }
  scene.add(group)
  return group
}

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0.05,
      flatShading: opts.flatShading ?? true,
    }),
  )
  m.castShadow = opts.castShadow ?? true
  m.receiveShadow = opts.receiveShadow ?? false
  return m
}

function addProp(scene, mesh, x, y, z, ry = 0) {
  mesh.position.set(x, y, z)
  mesh.rotation.y = ry
  scene.add(mesh)
  return mesh
}

function coneProp(scene, x, z) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0xe2571f, roughness: 0.7, flatShading: true }),
  )
  body.position.y = 0.25
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.11, 0.07, 10),
    new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.7 }),
  )
  band.position.y = 0.24
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.05, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xe2571f, roughness: 0.8 }),
  )
  base.position.y = 0.025
  g.add(body, band, base)
  g.rotation.y = Math.random() * Math.PI
  return addProp(scene, g, x, 0, z)
}

function barrier(scene, x, z, ry) {
  const g = new THREE.Group()
  const tex = stripesTexture()
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(4, 1)
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.34, 0.06),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
  )
  plank.position.y = 0.36
  plank.castShadow = true
  const legL = box(0.06, 0.36, 0.3, 0xd8d2c4)
  const legR = legL.clone()
  legL.position.set(-0.7, 0.18, 0)
  legR.position.set(0.7, 0.18, 0)
  g.add(plank, legL, legR)
  return addProp(scene, g, x, 0, z, ry)
}

function fencePanel(scene, x, z, ry, height = 1.3, width = 4) {
  const g = new THREE.Group()
  const frame = box(width, 0.06, 0.06, 0x4a4f55)
  frame.position.y = height / 2
  const postL = box(0.06, height, 0.06, 0x3c4147)
  const postR = box(0.06, height, 0.06, 0x3c4147)
  postL.position.set(-width / 2, height / 2, 0)
  postR.position.set(width / 2, height / 2, 0)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.05, height - 0.06),
    new THREE.MeshStandardMaterial({
      map: gridTexture(),
      transparent: true,
      opacity: 0.55,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  )
  mesh.position.y = height / 2
  mesh.rotation.y = 0
  g.add(frame, postL, postR, mesh)
  return addProp(scene, g, x, 0, z, ry)
}

function dumpTruck(scene, x, z, ry) {
  const g = new THREE.Group()
  const cab = box(1.1, 0.95, 0.9, 0x33586e, { metalness: 0.3 })
  cab.position.set(-0.75, 0.75, 0)
  const bed = box(2.1, 0.85, 1.1, 0x8a6a3a, { metalness: 0.35 })
  bed.position.set(0.85, 0.95, 0)
  const chassis = box(2.6, 0.35, 0.7, 0x22262b, { metalness: 0.6 })
  chassis.position.set(0.15, 0.32, 0)
  const wheels = []
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }),
      )
      w.rotation.z = Math.PI / 2
      w.position.set(-1.15 + i * 1.15, 0.3, side * 0.55)
      wheels.push(w)
    }
  }
  g.add(cab, bed, chassis, ...wheels)
  return addProp(scene, g, x, 0, z, ry)
}

function craneTower(scene, x, z, ry) {
  const g = new THREE.Group()
  const mast = box(0.8, 18, 0.8, 0x2f353c, { metalness: 0.45, flatShading: false })
  mast.position.y = 9
  const jib = box(14, 0.9, 0.7, 0x2f353c, { metalness: 0.45, flatShading: false })
  jib.position.set(7, 17.8, 0)
  const cab = box(1.2, 1.1, 1.2, 0xf0a81f, { metalness: 0.3 })
  cab.position.set(-0.6, 16.9, 0)
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 12, 4),
    new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.6, metalness: 0.5 }),
  )
  cable.position.set(12.6, 11.8, 0)
  const hook = box(0.35, 0.35, 0.35, 0x1c1e20, { metalness: 0.6 })
  hook.position.set(12.6, 5.6, 0)
  g.add(mast, jib, cab, cable, hook)
  return addProp(scene, g, x, 0, z, ry)
}

function rubblePile(scene, x, z, scale = 1) {
  const g = new THREE.Group()
  const mats = [0x8a6d55, 0x9a8f85, 0x6d6155, 0xa0452f, 0x7c8087]
  for (let i = 0; i < 26 * scale; i++) {
    const s = 0.16 + Math.random() * 0.42
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(s, s * rand(0.5, 1.1), s),
      new THREE.MeshStandardMaterial({
        color: mats[Math.floor(Math.random() * mats.length)],
        roughness: 0.95,
        flatShading: true,
      }),
    )
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * 2.4 * scale
    b.position.set(Math.cos(a) * r, s * 0.4 + Math.pow(Math.random(), 2) * 1.5, Math.sin(a) * r)
    b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    b.castShadow = true
    g.add(b)
  }
  return addProp(scene, g, x, 0, z)
}

function pallet(scene, x, z, ry) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 })
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.18), mat)
    plank.position.set(0, 0.12, -0.42 + i * 0.42)
    plank.rotation.y = Math.PI / 2
    g.add(plank)
  }
  for (let i = 0; i < 3; i++) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.9), mat)
    runner.position.set(-0.45 + i * 0.45, 0.05, 0)
    g.add(runner)
  }
  return addProp(scene, g, x, 0, z, ry)
}

function lampPost(scene, x, z) {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.7, metalness: 0.4 }),
  )
  pole.position.y = 2.7
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.7, metalness: 0.4, emissive: 0xffdf9e, emissiveIntensity: 0.35 }),
  )
  head.position.set(0.22, 5.2, 0)
  g.add(pole, head)
  return addProp(scene, g, x, 0, z)
}

export function buildWorld(scene, physics) {
  scene.fog = new THREE.Fog(0xe3c9a2, 55, 160)

  const hemi = new THREE.HemisphereLight(0xbdd4ea, 0x7a6247, 0.95)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe6c2, 2.0)
  sun.position.set(42, 55, 28)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -55
  sun.shadow.camera.right = 55
  sun.shadow.camera.top = 55
  sun.shadow.camera.bottom = -55
  sun.shadow.camera.near = 5
  sun.shadow.camera.far = 160
  sun.shadow.bias = -0.0006
  scene.add(sun)

  const fill = new THREE.DirectionalLight(0xffc18a, 0.5)
  fill.position.set(-30, 18, -25)
  scene.add(fill)

  scene.add(skyDome())

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 0.96, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(220, 44, 0xb0a78f, 0x8d846c)
  grid.position.y = 0.012
  grid.material.transparent = true
  grid.material.opacity = 0.22
  scene.add(grid)

  const cloudsGrp = clouds(scene)

  physics.addGround()

  // ---- 宸ュ湴閬撳叿 ----
  const props = new THREE.Group()
  scene.add(props)
  const fenceL = fencePanel(scene, -40, 0, 0)
  const fenceR = fencePanel(scene, 40, 0, 0)
  const fenceB = fencePanel(scene, 0, -40, Math.PI / 2)
  const fenceT = fencePanel(scene, 0, 40, Math.PI / 2)
  for (let i = 1; i < 6; i++) {
    fencePanel(scene, -40 + i * 4, 0, 0)
    fencePanel(scene, 40 - i * 4, 0, 0)
    fencePanel(scene, 0, -40 + i * 4, Math.PI / 2)
    fencePanel(scene, 0, 40 - i * 4, Math.PI / 2)
  }

  for (const [x, z] of [
    [-36, -36],
    [36, -36],
    [-36, 36],
    [36, 36],
  ]) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.7 }),
    )
    p.position.set(x, 0.45, z)
    p.castShadow = true
    scene.add(p)
  }

  const propsList = []
  for (let i = 0; i < 7; i++) propsList.push(coneProp(scene, rand(-34, 34), rand(-30, 34)))
  for (let i = 0; i < 6; i++) propsList.push(barrier(scene, rand(-32, 32), rand(-32, 34), rand(0, Math.PI)))
  dumpTruck(scene, -26, -12, Math.PI / 2 + 0.3)
  dumpTruck(scene, 28, -18, -0.4)
  craneTower(scene, 24, 26, -0.35)
  rubblePile(scene, -20, 14, 1.2)
  rubblePile(scene, 18, 12, 0.8)
  rubblePile(scene, -28, -24, 0.9)
  for (let i = 0; i < 3; i++) pallet(scene, rand(-30, 30), rand(-26, 30), rand(0, Math.PI))
  lampPost(scene, -12, -30)
  lampPost(scene, 12, -30)

  const pit = {
    pos: new THREE.Vector3(0, 0, 27),
    half: new THREE.Vector3(4.5, 3, 4.5),
  }

  const rimMat = new THREE.MeshStandardMaterial({ map: stripesTexture(), roughness: 0.8 })
  const rimA = new THREE.Mesh(new THREE.BoxGeometry(pit.half.x * 2 + 1, 0.5, 0.7), rimMat)
  const rimB = new THREE.Mesh(new THREE.BoxGeometry(pit.half.x * 2 + 1, 0.5, 0.7), rimMat)
  const rimC = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, pit.half.z * 2 + 1), rimMat)
  const rimD = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, pit.half.z * 2 + 1), rimMat)
  rimA.position.set(pit.pos.x, 0.25, pit.pos.z - pit.half.z - 0.35)
  rimB.position.set(pit.pos.x, 0.25, pit.pos.z + pit.half.z + 0.35)
  rimC.position.set(pit.pos.x - pit.half.x - 0.35, 0.25, pit.pos.z)
  rimD.position.set(pit.pos.x + pit.half.x + 0.35, 0.25, pit.pos.z)
  const rim = new THREE.Group()
  rim.add(rimA, rimB, rimC, rimD)
  scene.add(rim)

  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(pit.half.x * 2, pit.half.z * 2),
    new THREE.MeshStandardMaterial({ color: 0x221a10, roughness: 1 }),
  )
  hole.rotation.x = -Math.PI / 2
  hole.position.set(pit.pos.x, 0.02, pit.pos.z)
  scene.add(hole)

  const dirtWalls = new THREE.Mesh(
    new THREE.BoxGeometry(pit.half.x * 2, 2.4, pit.half.z * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a3c28, roughness: 1 }),
  )
  dirtWalls.position.set(pit.pos.x, -1.2, pit.pos.z)
  scene.add(dirtWalls)

  const pitSensor = physics.addSensor(pit.pos, pit.half)

  const targetMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.35, 28),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  )
  targetMarker.rotation.x = -Math.PI / 2
  targetMarker.position.set(pit.pos.x, 0.08, pit.pos.z)
  scene.add(targetMarker)

  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.1, 8),
    new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  )
  beacon.position.set(pit.pos.x + pit.half.x - 0.6, 2.4, pit.pos.z - pit.half.z + 0.6)
  scene.add(beacon)

  return { ground, grid, props, propsList, pit, pitSensor, cloudsGrp, fenceL, fenceR, fenceB, fenceT }
}
