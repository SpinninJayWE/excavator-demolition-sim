import * as THREE from 'three'
import { GROUP } from './physics.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const YELLOW = 0xf0a81f
const YELLOW_D = 0xc8871a
const DARK = 0x27282b
const BLACK = 0x141518
const STEEL = 0x9aa3ab

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.15,
    flatShading: opts.flatShading ?? true,
  })
}

function box(w, h, d, mat, castShadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = castShadow
  return m
}

function cyl(r, h, mat, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)
  m.castShadow = true
  return m
}

function treadTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#191a1c'
  g.fillRect(0, 0, 128, 64)
  g.fillStyle = '#232528'
  for (let x = 0; x < 128; x += 12) {
    g.fillRect(x, 0, 6, 64)
  }
  g.fillStyle = '#0f1012'
  for (let x = 6; x < 128; x += 12) {
    g.fillRect(x, 0, 2, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _fwd = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _c1 = new THREE.Vector3()
const _c2 = new THREE.Vector3()
const _c3 = new THREE.Vector3()
const _c4 = new THREE.Vector3()
const _c5 = new THREE.Vector3()
const _c6 = new THREE.Vector3()
const _c7 = new THREE.Vector3()
const _c8 = new THREE.Vector3()
const _cM = new THREE.Vector3()
const _cN = new THREE.Vector3()

export class Excavator {
  constructor(scene, physics) {
    this.scene = scene
    this.physics = physics

    this.group = new THREE.Group()
    scene.add(this.group)

    this.yaw = 0
    this.pos = new THREE.Vector3(0, 0, -6)
    this.cabYaw = Math.PI / 2
    this.boomAng = -0.25
    this.armAng = -1.35
    this.bucketAng = -0.65

    this.speed = 0
    this._curL = 0
    this._curR = 0
    this._prevTeeth = new THREE.Vector3()
    this._teethWorld = new THREE.Vector3()
    this.teethVel = new THREE.Vector3()

    this._buildTracks()
    this._buildHull()
    this._buildCab()

    this.body = physics.addKinematic(this.pos, { x: 1.6, y: 0.9, z: 1.5 }, GROUP.MACHINE | GROUP.WORLD | GROUP.BUILDING | GROUP.DEBRIS).body
    this.bucketBody = physics.addKinematicBall(this.pos, 0.42, GROUP.BUCKET | GROUP.BUILDING | GROUP.DEBRIS).body

    this.update(1 / 60, { get: () => 0 }, 0)
  }

  _buildTracks() {
    const trackMat = stdMat(BLACK, { roughness: 0.9 })
    const treadMat = stdMat('#232528', { roughness: 0.92 })
    treadMat.map = treadTexture()
    const sprocketMat = stdMat('#111214', { roughness: 0.8 })
    for (const z of [-1.0, 1.0]) {
      const g = new THREE.Group()
      const body = box(3.1, 0.85, 0.55, trackMat)
      body.position.y = 0.42
      const tread = box(3.25, 0.55, 0.62, treadMat)
      tread.position.y = 0.42
      for (const sx of [-1.45, 1.45]) {
        const sp = cyl(0.3, 0.62, sprocketMat, 12)
        sp.rotation.x = Math.PI / 2
        sp.position.set(sx, 0.42, 0)
        g.add(sp)
      }
      for (const rx of [-0.9, -0.3, 0.3, 0.9]) {
        const r = cyl(0.13, 0.58, sprocketMat, 8)
        r.rotation.x = Math.PI / 2
        r.position.set(rx, 0.42, 0)
        g.add(r)
      }
      g.add(body, tread)
      g.position.z = z
      this.group.add(g)
    }
  }

  _buildHull() {
    const hullMat = stdMat(YELLOW)
    const darkMat = stdMat(DARK, { roughness: 0.8 })
    const steelMat = stdMat(STEEL, { metalness: 0.5, roughness: 0.4, flatShading: false })

    const tub = box(1.7, 0.5, 2.0, hullMat)
    tub.position.set(0.1, 1.0, 0)
    this.group.add(tub)

    const cw = box(1.0, 0.95, 2.0, darkMat)
    cw.position.set(-1.15, 1.3, 0)
    this.group.add(cw)

    const engine = box(1.25, 0.62, 1.5, darkMat)
    engine.position.set(-0.15, 1.52, 0)
    this.group.add(engine)

    const exhaust = cyl(0.07, 0.75, darkMat, 8)
    exhaust.position.set(-1.05, 2.0, 0.75)
    this.group.add(exhaust)

    for (const z of [-1.0, 1.0]) {
      const fender = box(2.8, 0.06, 1.15, darkMat)
      fender.position.set(0.05, 0.98, z)
      this.group.add(fender)
    }

    const blade = box(2.1, 0.52, 0.09, steelMat)
    blade.position.set(1.85, 0.55, 0)
    blade.rotation.z = -0.06
    this.group.add(blade)
    for (const z of [-0.5, 0.5]) {
      const arm = box(0.09, 0.09, 1.15, darkMat)
      arm.position.set(1.15, 0.85, z)
      arm.rotation.x = 0.08
      this.group.add(arm)
    }
  }

  _buildCab() {
    const hullMat = stdMat(YELLOW)
    const darkMat = stdMat(DARK, { roughness: 0.8 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8e8,
      roughness: 0.08,
      metalness: 0.3,
      transparent: true,
      opacity: 0.42,
      flatShading: false,
    })
    const steelMat = stdMat(STEEL, { metalness: 0.5, roughness: 0.4, flatShading: false })
    const bucketMat = stdMat('#6d737a', { metalness: 0.5, roughness: 0.45 })
    const teethMat = stdMat('#17181a', { roughness: 0.55 })

    const cab = new THREE.Group()
    cab.position.set(0.55, 1.15, 0)
    this.cab = cab
    this.group.add(cab)

    const cabBody = box(0.95, 0.78, 1.0, hullMat)
    cabBody.position.y = 0.35
    const glass = box(0.88, 0.42, 0.94, glassMat)
    glass.position.y = 0.68
    const roof = box(1.08, 0.09, 1.14, darkMat)
    roof.position.y = 0.94
    cab.add(cabBody, glass, roof)
    for (const [cx, cz] of [[-0.46, -0.47], [0.46, -0.47], [-0.46, 0.47], [0.46, 0.47]]) {
      const post = box(0.05, 0.86, 0.05, darkMat)
      post.position.set(cx, 0.44, cz)
      cab.add(post)
    }
    const mirror = box(0.3, 0.16, 0.02, steelMat)
    mirror.position.set(0.55, 0.62, 0.4)
    cab.add(mirror)
    const bucketCyl = new THREE.Group()
    cab.add(bucketCyl)

    // ---- 大臂 ----
    const boomPivot = new THREE.Group()
    boomPivot.position.set(0.62, 0.62, 0)
    this.boomPivot = boomPivot
    cab.add(boomPivot)

    const boomMesh = box(3.5, 0.42, 0.5, hullMat)
    boomMesh.position.set(1.75, -0.05, 0)
    const boomTip = box(0.5, 0.34, 0.4, hullMat)
    boomTip.position.set(3.35, -0.06, 0)
    boomPivot.add(boomMesh, boomTip)

    // ---- 斗杆 ----
    const armPivot = new THREE.Group()
    armPivot.position.set(3.5, 0, 0)
    this.armPivot = armPivot
    boomPivot.add(armPivot)

    const armMesh = box(2.9, 0.32, 0.38, hullMat)
    armMesh.position.set(1.45, -0.08, 0)
    armPivot.add(armMesh)

    // ---- 铲斗 ----
    const bucketPivot = new THREE.Group()
    bucketPivot.position.set(2.9, 0, 0)
    this.bucketPivot = bucketPivot
    armPivot.add(bucketPivot)

    const sideL = box(0.76, 0.62, 0.07, bucketMat)
    sideL.position.set(0.44, -0.26, 0.55)
    const sideR = box(0.76, 0.62, 0.07, bucketMat)
    sideR.position.set(0.44, -0.26, -0.55)
    const back = box(0.18, 0.6, 1.14, bucketMat)
    back.position.set(0.1, -0.3, 0)
    const floor = box(0.55, 0.08, 1.14, bucketMat)
    floor.position.set(0.42, -0.56, 0)
    const lip = box(0.1, 0.14, 1.14, bucketMat)
    lip.position.set(0.68, -0.53, 0)
    bucketPivot.add(sideL, sideR, back, floor, lip)
    for (let i = -2; i <= 2; i++) {
      const tooth = box(0.18, 0.16, 0.1, teethMat)
      tooth.position.set(0.82, -0.52, i * 0.24)
      tooth.rotation.z = -0.12
      bucketPivot.add(tooth)
    }
    const linkPlate = box(0.26, 0.52, 0.12, darkMat)
    linkPlate.position.set(0.02, -0.08, 0)
    bucketPivot.add(linkPlate)

    // ---- 液压缸 ----
    this.cylBoom = cyl(0.09, 1, YELLOW_D, 8)
    this.cylBoomRod = cyl(0.05, 1, steelMat, 8)
    this.cylArm = cyl(0.08, 1, YELLOW_D, 8)
    this.cylArmRod = cyl(0.045, 1, steelMat, 8)
    this.cylBucket = cyl(0.07, 1, YELLOW_D, 8)
    this.cylBucketRod = cyl(0.04, 1, steelMat, 8)
    this.group.add(this.cylBoom, this.cylBoomRod, this.cylArm, this.cylArmRod, this.cylBucket, this.cylBucketRod)

    this.rodL = cyl(0.035, 1, darkMat, 6)
    this.rodR = cyl(0.035, 1, darkMat, 6)
    this.group.add(this.rodL, this.rodR)
  }

  _cabToMachineVec(x, y, out) {
    const c = Math.cos(this.cabYaw)
    const s = Math.sin(this.cabYaw)
    out.set(0.55 + x * c, 1.15 + y, -x * s)
    return out
  }

  _placeCylinder(mesh, a, b, r) {
    _dir.subVectors(b, a)
    const len = _dir.length() || 0.001
    mesh.position.copy(a).addScaledVector(_dir, 0.5)
    mesh.scale.set(r * 2, len, r * 2)
    mesh.quaternion.setFromUnitVectors(_up, _dir.clone().normalize())
  }

  _cabToWorldVec(x, y, out) {
    const cc = Math.cos(this.cabYaw)
    const ss = Math.sin(this.cabYaw)
    const mx = 0.55 + x * cc
    const mz = -x * ss
    const cy = Math.cos(this.yaw)
    const sy = Math.sin(this.yaw)
    out.set(this.pos.x + mx * cy + mz * sy, this.pos.y + 1.15 + y, this.pos.z - mx * sy + mz * cy)
    return out
  }

  update(dt, input, time) {
    const driveY = input.get('driveY')
    const turn = input.get('driveX')

    const tl = clamp(driveY - turn, -1, 1)
    const tr = clamp(driveY + turn, -1, 1)
    const ease = Math.min(1, dt * 3.2)
    this._curL += (tl * 2.4 - this._curL) * ease
    this._curR += (tr * 2.4 - this._curR) * ease
    const v = (this._curL + this._curR) / 2
    const omega = (this._curR - this._curL) / 2.0
    this.speed = v

    this.yaw += omega * dt
    this.pos.addScaledVector(_fwd.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), v * dt)

    this.group.position.copy(this.pos)
    this.group.rotation.y = this.yaw

    this.cabYaw += input.get('swing') * 1.5 * dt
    this.cab.rotation.y = this.cabYaw

    this.boomAng = clamp(this.boomAng + input.get('boom') * 0.8 * dt, -0.55, 1.05)
    this.armAng = clamp(this.armAng + input.get('arm') * 1.05 * dt, -1.75, 0.65)
    this.bucketAng = clamp(this.bucketAng + input.get('bucket') * 1.25 * dt, -1.2, 1.2)

    this.boomPivot.rotation.z = this.boomAng
    this.armPivot.rotation.z = this.armAng
    this.bucketPivot.rotation.z = this.bucketAng

    const a1 = this.boomAng
    const a2 = this.armAng
    const a3 = this.bucketAng
    const L1 = 3.5
    const L2 = 2.9

    // 关节位置（驾驶室空间，纯标量）
    const cosA1 = Math.cos(a1)
    const sinA1 = Math.sin(a1)
    const cosA12 = Math.cos(a1 + a2)
    const sinA12 = Math.sin(a1 + a2)
    const cosTot = Math.cos(a1 + a2 + a3)
    const sinTot = Math.sin(a1 + a2 + a3)
    const tip1x = L1 * cosA1
    const tip1y = 0.62 + L1 * sinA1
    const tip2x = tip1x + L2 * cosA12
    const tip2y = tip1y + L2 * sinA12
    const teethCx = tip2x + 0.95 * cosTot + 0.5 * sinTot
    const teethCy = tip2y + 0.95 * sinTot - 0.5 * cosTot

    // 液压缸锚点（驾驶室空间）
    this._cabToMachineVec(0.2, 0.14, _c1) // 大臂缸底
    this._cabToMachineVec(0.62 + 1.05 * cosA1, 0.62 + 1.05 * sinA1 - 0.1, _c2) // 大臂缸顶
    this._cabToMachineVec(0.62 + 2.35 * cosA1, 0.62 + 2.35 * sinA1 + 0.1, _c3) // 斗杆缸底
    this._cabToMachineVec(tip1x + 1.05 * cosA12, tip1y + 1.05 * sinA12 - 0.16, _c4) // 斗杆缸顶
    this._cabToMachineVec(tip1x + 1.75 * cosA12, tip1y + 1.75 * sinA12 + 0.17, _c5) // 铲斗缸底
    this._cabToMachineVec(tip2x + 0.42 * cosTot + 0.3 * sinTot, tip2y + 0.42 * sinTot - 0.3 * cosTot, _c6) // 连杆点
    this._cabToMachineVec(tip1x + 0.55 * cosA12, tip1y + 0.55 * sinA12 + 0.14, _c7) // 拉杆点

    this._placeCylinder(this.cylBoom, _c1, _c2, 0.09)
    this._placeCylinder(this.cylBoomRod, _cM.copy(_c1).lerp(_c2, 0.42), _c2, 0.05)
    this._placeCylinder(this.cylArm, _c3, _c4, 0.08)
    this._placeCylinder(this.cylArmRod, _cM.copy(_c3).lerp(_c4, 0.4), _c4, 0.045)
    this._placeCylinder(this.cylBucket, _c5, _c6, 0.07)
    this._placeCylinder(this.cylBucketRod, _cM.copy(_c5).lerp(_c6, 0.38), _c6, 0.04)
    this._placeCylinder(this.rodL, _cM.copy(_c7).add(_c8.set(0, 0, 0.31)), _cN.copy(_c6).add(_c8.set(0, 0, 0.31)), 0.035)
    this._placeCylinder(this.rodR, _cM.copy(_c7).add(_c8.set(0, 0, -0.31)), _cN.copy(_c6).add(_c8.set(0, 0, -0.31)), 0.035)

    // 铲斗齿世界坐标
    this._cabToWorldVec(teethCx, teethCy, this._teethWorld)
    _dir.subVectors(this._teethWorld, this._prevTeeth)
    const dist = _dir.length()
    this.teethVel.set(0, 0, 0)
    if (dt > 0) {
      const spd = dist / dt
      this.teethVel.copy(_dir).normalize().multiplyScalar(Math.min(14, spd))
    }
    this._prevTeeth.copy(this._teethWorld)

    // 物理体
    this.physics.moveKinematic(this.body, this.pos, _q.setFromAxisAngle(_up, this.yaw))
    this.physics.moveKinematic(this.bucketBody, this._teethWorld, _q.setFromAxisAngle(_up, 0))

    // 细微震动
    if (Math.abs(v) > 0.4) {
      const s = 0.0035
      this.group.position.y = Math.sin(time * 42) * s + Math.abs(Math.sin(time * 19)) * s * 0.5
    }
  }

  getTeethPos(out) {
    return out.copy(this._teethWorld)
  }

  getCabForward(out) {
    const m = _v1.set(1, 0, 0)
    m.applyAxisAngle(_up, this.cabYaw)
    m.applyAxisAngle(_up, this.yaw)
    return out.copy(m).normalize()
  }

  getCabPos(out) {
    const c = _v2.set(0.55, 1.15, 0)
    c.applyAxisAngle(_up, this.yaw)
    c.add(this.pos)
    return out.copy(c)
  }

  getPos(out) {
    return out.copy(this.pos)
  }

  getSpeed() {
    return this.speed
  }

  reset() {
    this.pos.set(0, 0, -6)
    this.yaw = 0
    this.cabYaw = Math.PI / 2
    this.boomAng = -0.25
    this.armAng = -1.35
    this.bucketAng = -0.65
    this._curL = 0
    this._curR = 0
    this.speed = 0
    this._prevTeeth.copy(this.pos)
    this.update(1 / 60, { get: () => 0 }, 0)
  }

  dispose() {
    this.scene.remove(this.group)
  }
}
