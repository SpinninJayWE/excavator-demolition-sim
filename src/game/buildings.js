import * as THREE from 'three'
import { MATERIALS } from './constants.js'
import { GROUP } from './physics.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _v = new THREE.Vector3()

const HP_BASE = {
  brick: 45, concrete: 120, steel: 70, wood: 25, block: 35, frame: 90,
  red: 35, orange: 35, yellow: 35, green: 35, blue: 35, purple: 35, teal: 35,
  white: 45, stone: 75,
}

function tint(matKey) {
  const c = new THREE.Color(MATERIALS[matKey].base)
  c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.13)
  c.multiplyScalar(0.9 + Math.random() * 0.18)
  return c
}

export class BuildingManager {
  constructor(scene, physics, debris, onBreak) {
    this.scene = scene
    this.physics = physics
    this.debris = debris
    this.onBreak = onBreak
    this.buildings = []
    this.bricks = []
    this.cascadeQueue = []
    this.unitGeo = new THREE.BoxGeometry(1, 1, 1)
  }

  _group(building, matKey) {
    let g = building.groups.get(matKey)
    if (g) return g
    const mat = MATERIALS[matKey]
    const inst = new THREE.InstancedMesh(
      this.unitGeo,
      new THREE.MeshStandardMaterial({
        color: mat.base,
        roughness: mat.roughness ?? 0.9,
        metalness: mat.metalness ?? 0.05,
        flatShading: true,
      }),
      2600,
    )
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    inst.castShadow = true
    inst.receiveShadow = true
    inst.frustumCulled = false
    this.scene.add(inst)
    g = { inst, count: 0, matKey }
    building.groups.set(matKey, g)
    return g
  }

  addBrick(building, matKey, pos, half, opts = {}) {
    const g = this._group(building, matKey)
    const idx = g.count++
    if (opts.rotZ) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), opts.rotZ)
    } else {
      _q.identity()
    }
    _m.compose(pos, _q, _s.set(half.x * 2, half.y * 2, half.z * 2))
    g.inst.setMatrixAt(idx, _m)
    g.inst.setColorAt(idx, tint(matKey))

    const hp = (HP_BASE[matKey] ?? 40) * (opts.hpScale ?? 1)
    const brick = {
      building,
      matKey,
      pos: pos.clone(),
      half: half.clone(),
      hp,
      maxHp: hp,
      value: MATERIALS[matKey].value * (opts.valueScale ?? 1),
      supporters: [],
      dependents: [],
      group: g,
      index: idx,
      body: null,
      collider: null,
      broken: false,
      decorative: !!opts.decorative,
      grounded: opts.grounded ?? pos.y - half.y <= 0.03,
    }
    const { body, collider } = this.physics.addFixedCuboid(pos, half, GROUP.BUILDING)
    brick.body = body
    brick.collider = collider
    building.bricks.push(brick)
    this.bricks.push(brick)
    return brick
  }

  computeSupport(building) {
    const bricks = building.bricks
    for (const b of bricks) {
      if (b.decorative || b.grounded) {
        b.supportCount = 999
        continue
      }
      const bottom = b.pos.y - b.half.y
      const supporters = []
      for (const o of bricks) {
        if (o === b || o.broken) continue
        if (Math.abs(o.pos.y - b.pos.y) < 0.05) continue
        const oTop = o.pos.y + o.half.y
        if (oTop < bottom - 0.45 || oTop > b.pos.y + 0.02) continue
        if (Math.abs(o.pos.x - b.pos.x) > b.half.x + o.half.x + 0.03) continue
        if (Math.abs(o.pos.z - b.pos.z) > b.half.z + o.half.z + 0.03) continue
        supporters.push(o)
      }
      b.supporters = supporters
      b.supportCount = Math.max(1, supporters.length)
      for (const o of supporters) o.dependents.push(b)
    }
  }

  _hideInstance(brick) {
    _m.makeScale(0.0001, 0.0001, 0.0001)
    brick.group.inst.setMatrixAt(brick.index, _m)
    brick.group.inst.instanceMatrix.needsUpdate = true
  }

  breakBrick(brick, opts = {}) {
    if (brick.broken) return
    brick.broken = true
    this._hideInstance(brick)
    this.physics.removeFixed(brick)
    if (!opts.noDebris) {
      const vel = opts.vel || _v.set(0, 0, 0)
      const ang = opts.angVel || _v.set(0, 0, 0)
      this.debris.spawn(brick.matKey, brick.pos, brick.half, vel, ang)
    }
    brick.building.hpLost += brick.maxHp
    this.onBreak?.(brick, opts.source ?? 'hit', opts.speed)
    for (const d of brick.dependents) {
      d.supportCount--
      if (d.supportCount <= 0 && !d.broken) {
        this.cascadeQueue.push({ brick: d, delay: 0.08 + Math.random() * 0.14 })
      }
    }
    return true
  }

  update(dt) {
    for (let i = this.cascadeQueue.length - 1; i >= 0; i--) {
      const item = this.cascadeQueue[i]
      item.delay -= dt
      if (item.delay <= 0) {
        this.cascadeQueue.splice(i, 1)
        const impulse = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6)
        const ang = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)
        this.breakBrick(item.brick, { vel: impulse, angVel: ang, source: 'cascade' })
      }
    }
    if (this._pulseTime != null) {
      this._pulseTime += dt
      const o = 0.3 + Math.sin(this._pulseTime * 3.2) * 0.25
      for (const b of this.buildings) {
        if (b.outlineVisible) b.outline.material.opacity = o * (1 - b.damageRatio() * 0.9)
      }
    }
  }

  damageRatio(type) {
    let lost = 0
    let total = 0
    for (const b of this.buildings) {
      if (b.type !== type) continue
      lost += b.hpLost
      total += b.totalHp
    }
    return total > 0 ? lost / total : 1
  }

  damageAll() {
    let lost = 0
    let total = 0
    for (const b of this.buildings) {
      lost += b.hpLost
      total += b.totalHp
    }
    return total > 0 ? lost / total : 1
  }

  setTargets(types) {
    for (const b of this.buildings) {
      const isTarget = types.includes(b.type)
      b.outline.visible = isTarget
      b.outlineVisible = isTarget
    }
  }

  _makeBuilding(type, x, z) {
    const building = {
      type,
      bricks: [],
      groups: new Map(),
      totalHp: 0,
      hpLost: 0,
      outline: null,
      outlineVisible: false,
    }
    this.buildings.push(building)
    const gen = GENERATORS[type]
    gen(this, building, x, z)
    building.totalHp = building.bricks.reduce((s, b) => s + b.maxHp, 0)
    this.computeSupport(building)
    this._addOutline(building)
    return building
  }

  _addOutline(building) {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (const b of building.bricks) {
      minX = Math.min(minX, b.pos.x - b.half.x)
      minY = Math.min(minY, b.pos.y - b.half.y)
      minZ = Math.min(minZ, b.pos.z - b.half.z)
      maxX = Math.max(maxX, b.pos.x + b.half.x)
      maxY = Math.max(maxY, b.pos.y + b.half.y)
      maxZ = Math.max(maxZ, b.pos.z + b.half.z)
    }
    const w = maxX - minX
    const h = maxY - minY
    const d = maxZ - minZ
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.4, h + 0.4, d + 0.4)),
      new THREE.LineBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.55, depthTest: false }),
    )
    edges.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
    edges.renderOrder = 5
    edges.visible = false
    this.scene.add(edges)
    building.outline = edges
  }

  clear() {
    for (const b of this.buildings) {
      for (const g of b.groups.values()) {
        this.scene.remove(g.inst)
        g.inst.dispose()
      }
      this.scene.remove(b.outline)
      b.outline.geometry.dispose()
      b.outline.material.dispose()
    }
    this.buildings.length = 0
    this.bricks.length = 0
    this.cascadeQueue.length = 0
  }

  buildLayout() {
    this.clear()
    this._makeBuilding('house', 4, 6)
    this._makeBuilding('warehouse', -11, -13)
    this._makeBuilding('tower', 9, -18)
    this._makeBuilding('garage', -17, 11)
    this._makeBuilding('fence', -28, 0)
    this._makeBuilding('chimney', 20, 9)
    this._makeBuilding('blockPile', -14, 24)
    this._makeBuilding('woodStack', 14, 20)
    this._makeBuilding('rainbowWall', 30, 2)
    this._makeBuilding('containers', 26, -28)
    this._makeBuilding('castle', -2, -28)
    this._makeBuilding('pyramid', 18, -40)
    this._makeBuilding('windmill', -24, -32)
    this._makeBuilding('lighthouse', 22, 20)
    this._makeBuilding('pagoda', -24, 18)
    this._makeBuilding('church', 24, -12)
  }
}

function brickAt(gen, bld, matKey, cx, cy, cz, hx, hy, hz, opts) {
  gen.addBrick(bld, matKey, new THREE.Vector3(cx, cy, cz), new THREE.Vector3(hx, hy, hz), opts)
}

const GENERATORS = {
  house(bm, bld, bx, bz) {
    const W = 9, D = 7, H = 3.3
    const bxh = 0.25, byh = 0.11, bzh = 0.12
    const skipFront = (x, y) =>
      (x > 3.0 && x < 4.5 && y < 2.1) ||
      (x > 5.5 && x < 7.0 && y > 1.2 && y < 2.3)
    const skipBack = (x, y) => (x > 1.5 && x < 3.0 && y > 1.2 && y < 2.3) || (x > 5.5 && x < 7.0 && y > 1.2 && y < 2.3)
    const skipSide = (z, y) => z > 2.5 && z < 4.0 && y > 1.2 && y < 2.3
    for (let j = 0; j < 15; j++) {
      const y = 0.11 + j * 0.22
      for (let i = 0; i < 18; i++) {
        const x = 0.25 + i * 0.5
        if (skipFront(x, y)) continue
        brickAt(bm, bld, 'brick', bx + x, y, bz, bxh, byh, bzh)
      }
      for (let i = 0; i < 18; i++) {
        const x = 0.25 + i * 0.5
        if (skipBack(x, y)) continue
        brickAt(bm, bld, 'brick', bx + x, y, bz + D - 0.12, bxh, byh, bzh)
      }
      for (let i = 0; i < 14; i++) {
        const z = 0.24 + i * 0.5
        if (skipSide(z, y)) continue
        brickAt(bm, bld, 'brick', bx, y, bz + z, bzh, byh, bxh)
        brickAt(bm, bld, 'brick', bx + W - 0.12, y, bz + z, bzh, byh, bxh)
      }
    }
    // 门窗框（装饰）
    const fr = (x, z, w, h, t) => brickAt(bm, bld, 'frame', bx + x, 0.9, bz + z, w, h, t, { decorative: true, hpScale: 0.5 })
    fr(4.45, 0.12, 0.05, 1.05, 0.08)
    fr(3.75, 0.12, 0.75, 0.05, 0.08)
    for (const [wx, wz] of [[6.25, 0.12], [2.25, 6.88], [6.25, 6.88], [0.12, 3.25], [8.88, 3.25]]) {
      fr(wx, wz, 0.05, 0.6, 0.08)
      fr(wx, wz, 0.8, 0.05, 0.08)
    }
    // 灞嬮《
    const ridgeY = H + 2.0
    const theta = Math.atan2(2.0, W / 2)
    const slopeLen = Math.sqrt((W / 2) ** 2 + 2.0 ** 2)
    for (const sign of [1, -1]) {
      // 妾╂潯
      for (const zc of [1.5, 5.5]) {
        const cx = bx + W / 2 + sign * (slopeLen / 2) * Math.cos(theta)
        const cy = H + (slopeLen / 2) * Math.sin(theta)
        brickAt(bm, bld, 'wood', cx, cy, bz + zc, slopeLen / 2, 0.09, 0.12, { rotZ: -sign * theta, valueScale: 0.9 })
      }
    }
    // 屋顶板
    const rows = 10
    const plankW = slopeLen / rows
    for (let row = 0; row < rows; row++) {
      const s = (row + 0.5) * plankW
      for (const sign of [1, -1]) {
        const wx = bx + W / 2 + sign * s * Math.cos(theta)
        const wy = H + s * Math.sin(theta) + 0.12
        brickAt(bm, bld, 'wood', wx, wy, bz + D / 2, plankW / 2, 0.04, D / 2 + 0.3, { rotZ: -sign * theta, valueScale: 0.9 })
      }
    }
    brickAt(bm, bld, 'wood', bx + W / 2, ridgeY + 0.2, bz + D / 2, 0.35, 0.08, D / 2 + 0.4, { valueScale: 0.9 })
  },

  warehouse(bm, bld, bx, bz) {
    const W = 14, D = 10
    const ph = 0.03
    for (let row = 0; row < 3; row++) {
      const y = 0.75 + row * 1.5
      for (let i = 0; i < 10; i++) {
        const x = 0.7 + i * 1.4
        brickAt(bm, bld, 'steel', bx + x, y, bz, 0.7, 0.75, ph)
        brickAt(bm, bld, 'steel', bx + x, y, bz + D, 0.7, 0.75, ph)
      }
      for (let i = 0; i < 6; i++) {
        const z = 0.7 + i * 1.4
        brickAt(bm, bld, 'steel', bx, y, bz + z, ph, 0.75, 0.7)
        brickAt(bm, bld, 'steel', bx + W, y, bz + z, ph, 0.75, 0.7)
      }
    }
    for (const [cx, cz] of [
      [0, 0], [0, D], [W, 0], [W, D],
      [3.5, 0], [3.5, D], [7, 0], [7, D], [10.5, 0], [10.5, D],
      [0, 5], [W, 5],
    ]) {
      brickAt(bm, bld, 'frame', bx + cx, 2.25, bz + cz, 0.15, 2.25, 0.15, { valueScale: 0.6 })
    }
    for (const zc of [0, D]) {
      for (const x of [0.7, 4.2, 7.7, 11.2]) {
        brickAt(bm, bld, 'frame', bx + x + 1.75, 4.55, bz + zc, 1.75, 0.15, 0.12, { valueScale: 0.6 })
      }
    }
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 6; j++) {
        brickAt(bm, bld, 'steel', bx + 0.7 + i * 1.4, 4.75, bz + 0.7 + j * 1.4, 0.7, 0.03, 0.7)
      }
    }
  },

  tower(bm, bld, bx, bz) {
    for (let f = 0; f < 5; f++) {
      brickAt(bm, bld, 'concrete', bx + 3, f * 3 + 0.15, bz + 3, 3, 0.15, 3, { valueScale: 0.8 })
      if (f < 4) {
        for (const [cx, cz] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
          brickAt(bm, bld, 'concrete', bx + cx, f * 3 + 1.5, bz + cz, 0.18, 1.35, 0.18, { valueScale: 0.8 })
        }
        for (const [cx, cz] of [[2.2, 3], [3.8, 3], [3, 2.2], [3, 3.8]]) {
          brickAt(bm, bld, 'concrete', bx + cx, f * 3 + 1.55, bz + cz, 0.8, 0.5, 0.14, { valueScale: 0.6, hpScale: 0.7 })
        }
      }
    }
  },

  garage(bm, bld, bx, bz) {
    const W = 6, D = 5
    const bh = 0.3, byh = 0.15, bzh = 0.1
    for (let j = 0; j < 9; j++) {
      const y = 0.15 + j * 0.3
      for (let i = 0; i < 10; i++) {
        const x = 0.3 + i * 0.6
        if (x > 2.4 && x < 3.6 && y < 2.4) continue
        brickAt(bm, bld, 'block', bx + x, y, bz, bh, byh, bzh)
        brickAt(bm, bld, 'block', bx + x, y, bz + D, bh, byh, bzh)
      }
      for (let i = 0; i < 8; i++) {
        const z = 0.2 + i * 0.6
        brickAt(bm, bld, 'block', bx, y, bz + z, bzh, byh, bh)
        brickAt(bm, bld, 'block', bx + W, y, bz + z, bzh, byh, bh)
      }
    }
    brickAt(bm, bld, 'steel', bx + 2.7, 1.2, bz + 0.06, 0.6, 1.2, 0.05, { valueScale: 1.2 })
    brickAt(bm, bld, 'steel', bx + 3.3, 1.2, bz + 0.06, 0.6, 1.2, 0.05, { valueScale: 1.2 })
    for (let i = 0; i < 3; i++) {
      brickAt(bm, bld, 'steel', bx + 0.5 + i * 2.5, 2.75, bz + 2.5, 1.2, 0.06, 2.5, { valueScale: 0.8 })
    }
  },

  fence(bm, bld, bx, bz) {
    for (let i = 0; i < 6; i++) {
      brickAt(bm, bld, 'brick', bx + i * 2, 0.6, bz, 0.15, 0.6, 0.15, { valueScale: 0.8 })
    }
    for (const y of [0.36, 0.96]) {
      for (let i = 0; i < 20; i++) {
        brickAt(bm, bld, 'brick', bx + 0.25 + i * 0.5, y, bz, 0.25, 0.12, 0.06, { valueScale: 0.6 })
      }
    }
  },

  chimney(bm, bld, bx, bz) {
    for (let i = 0; i < 12; i++) {
      brickAt(bm, bld, 'concrete', bx, 0.35 + i * 0.35, bz, 0.5, 0.175, 0.5, { valueScale: 0.9 })
    }
    brickAt(bm, bld, 'concrete', bx, 4.6, bz, 0.6, 0.12, 0.6, { valueScale: 0.9 })
  },

  blockPile(bm, bld, bx, bz) {
    for (let i = 0; i < 40; i++) {
      const x = bx + (Math.random() - 0.5) * 5
      const z = bz + (Math.random() - 0.5) * 5
      const h = 0.15 + Math.random() * 1.2
      brickAt(bm, bld, 'block', x, h / 2, z, 0.3, h / 2, 0.15, { hpScale: 0.8 })
    }
  },

  woodStack(bm, bld, bx, bz) {
    for (let i = 0; i < 30; i++) {
      const x = bx + (Math.random() - 0.5) * 4
      const z = bz + (Math.random() - 0.5) * 4
      const h = 0.1 + Math.random() * 0.5
      brickAt(bm, bld, 'wood', x, h / 2, z, 0.5, h / 2, 0.5, { hpScale: 0.8 })
    }
  },

  // 彩虹墙：一排色彩鲜艳的面板墙，撞起来非常解压
  rainbowWall(bm, bld, bx, bz) {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'teal']
    for (let j = 0; j < 3; j++) {
      const y = 0.5 + j * 1.0
      for (let i = 0; i < 10; i++) {
        const x = 0.5 + i * 1.0
        brickAt(bm, bld, colors[(i + j) % colors.length], bx + x, y, bz, 0.5, 0.5, 0.35)
      }
    }
    for (let i = 0; i < 10; i++) {
      brickAt(bm, bld, 'block', bx + 0.5 + i * 1.0, 0.15, bz, 0.5, 0.15, 0.35)
    }
  },

  // 集装箱堆：两堆五颜六色的大集装箱，一铲子就能掀翻
  containers(bm, bld, bx, bz) {
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'teal']
    for (const dz of [-3, 3]) {
      const stack = dz > 0 ? 3 : 0
      for (let layer = 0; layer < 3; layer++) {
        const y = 1.1 + layer * 2.2
        const count = layer === 2 ? 1 : 2
        for (let k = 0; k < count; k++) {
          const zOff = layer === 2 ? 0 : k === 0 ? -1.3 : 1.3
          const mat = colors[(stack + layer + k) % colors.length]
          brickAt(bm, bld, mat, bx, y, bz + dz + zOff, 2.2, 1.1, 1.25, { hpScale: 1.1, valueScale: 1.2 })
        }
      }
    }
  },

  // 城堡：城墙 + 城齿 + 四角塔楼，带彩旗
  castle(bm, bld, bx, bz) {
    const W = 10, D = 8
    for (let y = 0; y < 2; y++) {
      const cy = 0.4 + y * 1.4
      for (let i = 0; i < 10; i++) {
        const x = 0.35 + i * 1.0
        brickAt(bm, bld, 'stone', bx + x, cy, bz, 0.5, 0.4, 0.35)
        brickAt(bm, bld, 'stone', bx + x, cy, bz + D, 0.5, 0.4, 0.35)
      }
      for (let i = 0; i < 8; i++) {
        const z = 0.35 + i * 1.0
        brickAt(bm, bld, 'stone', bx, cy, bz + z, 0.35, 0.4, 0.5)
        brickAt(bm, bld, 'stone', bx + W, cy, bz + z, 0.35, 0.4, 0.5)
      }
    }
    for (let i = 0; i < 10; i += 2) {
      brickAt(bm, bld, 'stone', bx + 0.35 + i * 1.0, 3.15, bz, 0.45, 0.35, 0.35)
      brickAt(bm, bld, 'stone', bx + 0.35 + i * 1.0, 3.15, bz + D, 0.45, 0.35, 0.35)
    }
    const corners = [[0, 0], [W, 0], [0, D], [W, D]]
    for (let t = 0; t < corners.length; t++) {
      const [cx, cz] = corners[t]
      for (let i = 0; i < 6; i++) {
        brickAt(bm, bld, 'stone', bx + cx, 0.4 + i * 0.7, bz + cz, 0.55, 0.35, 0.55, { hpScale: 1.2 })
      }
      brickAt(bm, bld, t % 2 ? 'red' : 'yellow', bx + cx, 5.15, bz + cz, 0.08, 0.5, 0.2)
    }
    // 城门
    brickAt(bm, bld, 'wood', bx + 4.4, 0.7, bz, 0.6, 0.7, 0.08, { decorative: true })
  },

  // 金字塔：层层堆叠，顶上是金色塔尖
  pyramid(bm, bld, bx, bz) {
    const layers = 6
    for (let l = 0; l < layers; l++) {
      const n = layers - l
      const y = 0.5 + l * 0.9
      const off = l * 0.45
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const mat = l === layers - 1 ? 'yellow' : l % 2 ? 'block' : 'concrete'
          brickAt(bm, bld, mat, bx + off + 0.5 + i * 1.0, y, bz + off + 0.5 + j * 1.0, 0.5, 0.45, 0.5, { hpScale: 0.9 })
        }
      }
    }
  },

  // 风车：条纹塔身 + 四片风叶
  windmill(bm, bld, bx, bz) {
    for (let i = 0; i < 7; i++) {
      const s = 1.0 - i * 0.09
      brickAt(bm, bld, i % 2 ? 'white' : 'block', bx, 0.45 + i * 0.8, bz, s, 0.4, s, { hpScale: 1.1 })
    }
    for (let k = 0; k < 4; k++) {
      const th = (k * Math.PI) / 2
      brickAt(bm, bld, 'wood', bx + Math.sin(th) * 1.3, 6.3 + Math.cos(th) * 1.3, bz, 0.18, 1.3, 0.18, { rotZ: th, hpScale: 0.8, valueScale: 0.8 })
    }
    brickAt(bm, bld, 'red', bx, 6.3, bz, 0.45, 0.4, 0.45)
    brickAt(bm, bld, 'red', bx, 0.5, bz + 0.85, 0.22, 0.5, 0.06, { decorative: true })
  },

  // 灯塔：红白相间的条纹塔，顶端发光
  lighthouse(bm, bld, bx, bz) {
    for (let i = 0; i < 12; i++) {
      brickAt(bm, bld, i % 2 ? 'red' : 'white', bx, 0.4 + i * 0.5, bz, 0.55, 0.25, 0.55, { hpScale: 0.9 })
    }
    brickAt(bm, bld, 'yellow', bx, 6.8, bz, 0.62, 0.18, 0.62, { hpScale: 0.9 })
    brickAt(bm, bld, 'yellow', bx, 7.25, bz, 0.3, 0.25, 0.3)
  },

  // 宝塔：三层中式楼阁，红柱 + 飞檐 + 金顶
  pagoda(bm, bld, bx, bz) {
    const tiers = 3
    for (let t = 0; t < tiers; t++) {
      const yBase = 1.0 + t * 1.7
      const s = 2.0 - t * 0.5
      for (const [cx, cz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
        brickAt(bm, bld, 'red', bx + cx, yBase, bz + cz, 0.28, 1.2, 0.28, { hpScale: 0.9 })
      }
      for (let i = -1; i <= 1; i++) {
        brickAt(bm, bld, 'block', bx + i * (s * 0.7), yBase, bz - s, 0.25, 0.3, 0.08, { decorative: i !== 0 })
        brickAt(bm, bld, 'block', bx + i * (s * 0.7), yBase, bz + s, 0.25, 0.3, 0.08, { decorative: i !== 0 })
        brickAt(bm, bld, 'block', bx - s, yBase, bz + i * (s * 0.7), 0.08, 0.3, 0.25, { decorative: i !== 0 })
        brickAt(bm, bld, 'block', bx + s, yBase, bz + i * (s * 0.7), 0.08, 0.3, 0.25, { decorative: i !== 0 })
      }
      const roofW = s + 1.0
      brickAt(bm, bld, 'wood', bx, yBase + 1.3, bz, roofW / 2, 0.14, roofW / 2, { hpScale: 0.8 })
      brickAt(bm, bld, 'wood', bx, yBase + 1.18, bz - roofW / 2 + 0.1, roofW / 2, 0.08, 0.3, { rotZ: 0.4, hpScale: 0.8 })
      brickAt(bm, bld, 'wood', bx, yBase + 1.18, bz + roofW / 2 - 0.1, roofW / 2, 0.08, 0.3, { rotZ: -0.4, hpScale: 0.8 })
      brickAt(bm, bld, 'wood', bx - roofW / 2 + 0.1, yBase + 1.18, bz, 0.3, 0.08, roofW / 2, { hpScale: 0.8 })
      brickAt(bm, bld, 'wood', bx + roofW / 2 - 0.1, yBase + 1.18, bz, 0.3, 0.08, roofW / 2, { hpScale: 0.8 })
      brickAt(bm, bld, 'yellow', bx, yBase + 1.55, bz, 0.18, 0.3, 0.18, { valueScale: 1.2 })
    }
    brickAt(bm, bld, 'stone', bx, 0.25, bz, 2.3, 0.25, 2.3)
  },

  // 教堂：大厅 + 彩色玻璃窗 + 钟楼
  church(bm, bld, bx, bz) {
    const W = 8, D = 6
    for (let j = 0; j < 6; j++) {
      const y = 0.2 + j * 0.4
      for (let i = 0; i < 12; i++) {
        const x = 0.3 + i * 0.6
        if (x > 3.4 && x < 4.6 && y < 1.6) continue
        brickAt(bm, bld, 'block', bx + x, y, bz, 0.3, 0.2, 0.12)
        brickAt(bm, bld, 'block', bx + x, y, bz + D, 0.3, 0.2, 0.12)
      }
      for (let i = 0; i < 10; i++) {
        const z = 0.3 + i * 0.6
        brickAt(bm, bld, 'block', bx, y, bz + z, 0.12, 0.2, 0.3)
        brickAt(bm, bld, 'block', bx + W, y, bz + z, 0.12, 0.2, 0.3)
      }
    }
    const glass = ['red', 'blue', 'yellow', 'green', 'purple']
    for (let i = 0; i < 4; i++) {
      brickAt(bm, bld, glass[i], bx + 1.3 + i * 1.7, 1.6, bz, 0.22, 0.45, 0.06, { decorative: true })
      brickAt(bm, bld, glass[i + 1], bx + 1.3 + i * 1.7, 1.6, bz + D, 0.22, 0.45, 0.06, { decorative: true })
    }
    for (let i = 0; i < 10; i++) {
      brickAt(bm, bld, 'wood', bx + 0.3 + i * 0.6, 2.8, bz + D / 2, 0.3, 0.1, D / 2 + 0.2, { hpScale: 0.8 })
    }
    for (let i = 0; i < 7; i++) {
      brickAt(bm, bld, 'block', bx + 0.7, 0.2 + i * 0.7, bz + D / 2, 0.45, 0.35, 0.45, { hpScale: 1.1 })
    }
    brickAt(bm, bld, 'red', bx + 0.7, 5.45, bz + D / 2, 0.18, 0.6, 0.18, { valueScale: 1.2 })
  },
}
