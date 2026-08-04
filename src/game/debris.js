import * as THREE from 'three'
import { MAX_DEBRIS, MATERIALS } from './constants.js'
import { GROUP } from './physics.js'

export class DebrisSystem {
  constructor(scene, physics, onCounted) {
    this.scene = scene
    this.physics = physics
    this.onCounted = onCounted
    this.pools = new Map()
    this.chunks = []
    this._nextId = 0
  }

  _pool(matKey) {
    let pool = this.pools.get(matKey)
    if (pool) return pool
    const mat = MATERIALS[matKey]
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: mat.base,
        roughness: mat.roughness ?? 0.9,
        metalness: mat.metalness ?? 0.05,
        flatShading: true,
      }),
      MAX_DEBRIS,
    )
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    inst.castShadow = true
    inst.count = 0
    inst.frustumCulled = false
    this.scene.add(inst)
    pool = { inst, free: [], color: mat.base, metalness: mat.metalness ?? 0.05 }
    this.pools.set(matKey, pool)
    return pool
  }

  spawn(matKey, pos, half, vel, angVel) {
    if (this.chunks.length >= MAX_DEBRIS) {
      this._evictOldest()
    }
    const pool = this._pool(matKey)
    let index
    if (pool.free.length) {
      index = pool.free.pop()
    } else {
      index = pool.inst.count
      pool.inst.count++
    }
    const chunkBody = this.physics.addDebrisChunk(pos, half, MATERIALS[matKey].density, GROUP.DEBRIS)
    const body = chunkBody.body
    body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true)
    body.setAngvel({ x: angVel.x, y: angVel.y, z: angVel.z }, true)
    const tint = new THREE.Color(pool.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.14)
    pool.inst.setColorAt(index, tint)
    const dummy = new THREE.Matrix4()
    dummy.compose(pos, { x: 0, y: 0, z: 0, w: 1 }, new THREE.Vector3(half.x * 2, half.y * 2, half.z * 2))
    pool.inst.setMatrixAt(index, dummy)
    pool.inst.instanceMatrix.needsUpdate = true

    const chunk = {
      id: this._nextId++,
      index,
      pool,
      body,
      collider: body.collider(0),
      half,
      matKey,
      sleepingSince: null,
      counted: false,
      live: true,
    }
    this.chunks.push(chunk)
    return chunk
  }

  _evictOldest() {
    let best = null
    for (const c of this.chunks) {
      if (!c.live) continue
      if (c.body.isSleeping()) {
        if (!best || (c.sleepingSince && c.sleepingSince < best.sleepingSince)) best = c
      }
    }
    if (best) this.remove(best)
    else {
      const c = this.chunks.find((x) => x.live)
      if (c) this.remove(c)
    }
  }

  remove(chunk) {
    if (!chunk.live) return
    chunk.live = false
    chunk.pool.free.push(chunk.index)
    chunk.pool.inst.setMatrixAt(chunk.index, new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001))
    chunk.pool.inst.instanceMatrix.needsUpdate = true
    this.physics.world.removeRigidBody(chunk.body)
  }

  clear() {
    for (const c of [...this.chunks]) this.remove(c)
    this.chunks.length = 0
    for (const pool of this.pools.values()) {
      this.scene.remove(pool.inst)
    }
    this.pools.clear()
  }

  update(dt, time) {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (const c of this.chunks) {
      if (!c.live) continue
      const body = c.body
      if (body.isSleeping()) {
        if (c.sleepingSince == null) c.sleepingSince = time
        if (time - c.sleepingSince > 7) {
          this.remove(c)
          continue
        }
        // 已入睡且矩阵已同步过，位置不再变化，跳过矩阵写入
        if (c.sleepingSince !== time) continue
      } else {
        c.sleepingSince = null
      }
      const pos = body.translation()
      const rot = body.rotation()
      p.set(pos.x, pos.y, pos.z)
      q.set(rot.x, rot.y, rot.z, rot.w)
      s.set(c.half.x * 2, c.half.y * 2, c.half.z * 2)
      m.compose(p, q, s)
      c.pool.inst.setMatrixAt(c.index, m)
      c.pool.inst.instanceMatrix.needsUpdate = true
    }
  }

  checkSensor(sensorHandle) {
    this.physics.drainContacts((h1, h2, started) => {
      if (!started) return
      let chunk = null
      if (h1 === sensorHandle || h2 === sensorHandle) {
        const other = h1 === sensorHandle ? h2 : h1
        const collider = this.physics.world.getCollider(other)
        if (!collider) return
        const body = collider.parent()
        if (!body) return
        chunk = this.chunks.find((c) => c.live && !c.counted && c.body.handle === body.handle)
        if (chunk) {
          chunk.counted = true
          if (this.onCounted) this.onCounted(chunk)
          this.remove(chunk)
        }
      }
    })
  }
}
