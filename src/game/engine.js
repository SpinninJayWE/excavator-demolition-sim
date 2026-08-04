import * as THREE from 'three'
import * as RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapier, Physics } from './physics.js'
import { createRenderer } from './renderer.js'
import { AudioSys } from './audio.js'
import { Input } from './input.js'
import { Excavator } from './excavator.js'
import { BuildingManager } from './buildings.js'
import { DebrisSystem } from './debris.js'
import { ParticleSystem } from './particles.js'
import { CameraRig } from './camera.js'
import { MissionManager } from './mission.js'
import { buildWorld } from './world.js'
import { FIXED_STEP, loadLS, saveLS, CONTRACTS } from './constants.js'

const BALL_RADIUS = 0.55

// 各部件伤害参数：外接半径、击碎速度阈值、每帧伤害系数
const PART_DEFS = [
  { radius: BALL_RADIUS, breakSpeed: 7.2, dmg: 0.9 }, // 铲斗齿（保留原有逻辑）
  { radius: 0.78, breakSpeed: 7.2, dmg: 0.9 }, // 铲斗箱体
  { radius: 1.78, breakSpeed: 5.5, dmg: 1.0 }, // 大臂
  { radius: 1.47, breakSpeed: 5.5, dmg: 1.0 }, // 小臂
  { radius: 2.37, breakSpeed: 4.2, dmg: 1.1 }, // 车身
]

const _imp = new THREE.Vector3()
const _ang = new THREE.Vector3()
const _pos = new THREE.Vector3()

export class GameEngine {
  constructor(ui) {
    this.ui = ui
    this.time = 0
    this.acc = 0
    this._snapshotTimer = 0
    this._impactCd = 0
    this._dustCd = 0
    this._stepCount = 0
    this._trackDustCd = 0
    this._prevHorn = false
    this._muted = loadLS('muted', false)
    this._raf = 0
    this.running = false
  }

  async init(canvas) {
    await ensureRapier()
    if (this.r || this.disposed) return
    this.disposed = false
    try {
      this._initScene(canvas)
    } catch (err) {
      console.error('[EDM] _initScene failed:', err)
      throw err
    }
    this.running = true
    this._lastTime = performance.now()
    this._raf = requestAnimationFrame((t) => this._loop(t))
  }

  _initScene(canvas) {
    this.canvas = canvas
    this.r = createRenderer(canvas)
    this.scene = this.r.scene
    this.camera = this.r.camera

    this.physics = new Physics()

    // 各部件伤害碰撞形状（与视觉网格对齐，由 Excavator.fillParts 每帧填充位置/朝向/速度）
    this._parts = PART_DEFS.map((d) => ({
      shape: null,
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      dir: new THREE.Vector3(),
      speed: 0,
      radius: d.radius,
      breakSpeed: d.breakSpeed,
      dmg: d.dmg,
    }))
    const partShapes = [
      new RAPIER.Ball(BALL_RADIUS),
      new RAPIER.Cuboid(0.4, 0.32, 0.58),
      new RAPIER.Cuboid(1.75, 0.21, 0.25),
      new RAPIER.Cuboid(1.45, 0.16, 0.19),
      new RAPIER.Cuboid(1.6, 0.9, 1.5),
    ]
    for (let i = 0; i < this._parts.length; i++) this._parts[i].shape = partShapes[i]

    this.audio = new AudioSys()
    this.audio.setMuted(this._muted)
    this.input = new Input()
    this.input.attach()

    this.world = buildWorld(this.scene, this.physics)

    this.particles = new ParticleSystem(this.scene, 0xb8a88c)
    this.sparks = new ParticleSystem(this.scene, 0xffb347)

    this.debris = new DebrisSystem(this.scene, this.physics, () => this._onDebrisCounted())

    this.buildings = new BuildingManager(this.scene, this.physics, this.debris, (brick, source) => this._onBrickBreak(brick, source))
    this.buildings.buildLayout()

    this.excavator = new Excavator(this.scene, this.physics)

    this.mission = new MissionManager(
      {
        onEvent: (e) => this._emit(e),
        audio: this.audio,
      },
      this.buildings,
    )

    this.cameraRig = new CameraRig(this.camera, canvas)
  }

  _emit(event) {
    this.ui.onEvent?.(event)
  }

  _onBrickBreak(brick, source, speed) {
    this.mission.onBrickBreak(brick.value)
    const metal = brick.matKey === 'steel' || brick.matKey === 'frame'
    const pos = brick.pos
    if (source === 'hit') {
      const s = Math.min(1, (speed ?? this.excavator.teethVel.length()) / 9)
      this.particles.burst(pos, 10 + Math.floor(s * 14), 1.6 + s * 2, { color: metal ? 0xcfd4d8 : 0xb8a88c, spread: 1.6, up: 1.8 })
      if (metal) this.sparks.burst(pos, 6, 3.2, { spread: 1.2, up: 2.2, color: 0xffb347 })
      this.audio.crack(0.6 + s * 0.4)
      if (metal) this.audio.clank()
    } else {
      this.particles.burst(pos, 5, 1.2, { color: 0xb8a88c, spread: 1.0, up: 1.2 })
      this.audio.crack(0.3)
    }
  }

  _onDebrisCounted() {
    this.mission.onDebrisCounted()
    this.audio.impact(0.5, true)
  }

  _machineDamage() {
    this.excavator.fillParts(this._parts)
    const bricks = this.buildings.bricks
    const step = this._stepCount
    let hits = 0
    let anyHit = false
    let hitMetal = false
    let maxSpeed = 0
    let impact = null

    for (let p = 0; p < this._parts.length; p++) {
      const part = this._parts[p]
      const speed = part.speed
      if (speed < 0.45) continue
      if (speed > maxSpeed) maxSpeed = speed
      const r2 = part.radius
      for (let i = 0; i < bricks.length; i++) {
        const brick = bricks[i]
        if (brick.broken || brick._hitStep === step) continue
        const b = brick.pos
        const dx = b.x - part.pos.x
        const dy = b.y - part.pos.y
        const dz = b.z - part.pos.z
        const far = brick.radius + r2
        if (dx * dx + dy * dy + dz * dz > far * far) continue
        if (!brick.collider.intersectsShape(part.shape, part.pos, part.quat)) continue
        brick._hitStep = step
        anyHit = true
        if (!impact) impact = part.pos
        if (brick.matKey === 'steel' || brick.matKey === 'frame') hitMetal = true
        if (speed > part.breakSpeed) {
          _imp.copy(part.dir).multiplyScalar(0.3 * speed + 1.8)
          _ang.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9)
          this.buildings.breakBrick(brick, { vel: _imp, angVel: _ang, source: 'hit', speed })
          hits++
        } else {
          brick.hp -= speed * part.dmg
          if (brick.hp <= 0) {
            _imp.copy(part.dir).multiplyScalar(0.28 * speed + 1.4)
            _ang.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
            this.buildings.breakBrick(brick, { vel: _imp, angVel: _ang, source: 'hit', speed })
            hits++
          }
        }
        if (hits >= 8) break
      }
      if (hits >= 8) break
    }

    if (anyHit) {
      if (this._impactCd <= 0) {
        this.audio.impact(Math.min(1, maxSpeed / 7), hitMetal)
        this._impactCd = 0.09
      }
      if (this._dustCd <= 0) {
        this.particles.burst(impact, Math.min(14, 3 + maxSpeed * 2), 1.2 + maxSpeed * 1.6, { spread: 1.2, up: 1.4 })
        this._dustCd = 0.06
      }
    }
  }

  _step(dt) {
    this._stepCount++
    this.input.update()
    const inp = this.input

    const isPlaying = this.mission.state === 'playing' || this.mission.state === 'countdown'
    if (isPlaying) {
      this.excavator.update(dt, inp, this.time)
      this._machineDamage()
    }
    this.mission.update(dt)
    this.buildings.update(dt)
    this.physics.step(dt)
    this.debris.checkSensor(this.world.pitSensor.collider.handle)

    const moving = Math.abs(this.excavator.speed) > 0.5
    const busy = Math.abs(inp.get('boom')) > 0.05 || Math.abs(inp.get('arm')) > 0.05 || Math.abs(inp.get('bucket')) > 0.05 || Math.abs(inp.get('swing')) > 0.05
    this.audio.update(dt, {
      throttle: Math.abs(inp.get('driveY')),
      moving,
      jointBusy: busy,
      speed: this.excavator.speed,
    })

    // 履带扬尘
    this._trackDustCd -= dt
    if (moving && this._trackDustCd <= 0) {
      this._trackDustCd = 0.16
      const rnd = (Math.random() - 0.5) * 2.4
      this.particles.burst(this.excavator.getPos(_pos).set(_pos.x + rnd, 0.15, _pos.z + (Math.random() - 0.5) * 3), 2, 0.9, { spread: 0.8, up: 0.8, maxLife: 0.7 })
    }

    this._impactCd -= dt
    this._dustCd -= dt

    // 键盘快捷键
    if (inp.justPressed('KeyC')) {
      const name = this.cameraRig.cycle()
      this.ui.onEvent?.({ type: 'toast', text: `视角：${name}` })
    }
    if (inp.justPressed('KeyM')) {
      this.toggleMute()
    }
    if (inp.justPressed('KeyP') || inp.justPressed('Escape')) {
      if (this.mission.state === 'playing') this.pause()
      else if (this.mission.state === 'paused') this.resume()
    }
    if (inp.hornHeld && !this._prevHorn) {
      this.audio.horn()
    }
    this._prevHorn = inp.hornHeld
  }

  _loop(now) {
    if (!this.running) return
    this._raf = requestAnimationFrame((t) => this._loop(t))
    const dt = Math.min(0.1, (now - this._lastTime) / 1000)
    this._lastTime = now
    this.time += dt

    const state = this.mission.state
    if (state !== 'menu' && state !== 'paused' && state !== 'complete' && state !== 'failed') {
      this.acc += dt
      let steps = 0
      while (this.acc >= FIXED_STEP && steps < 3) {
        this._step(FIXED_STEP)
        this.acc -= FIXED_STEP
        steps++
      }
      if (steps === 3) this.acc = 0
    } else if (state === 'menu') {
      this._menuOrbit(dt)
    } else {
      this.audio.update(dt, { throttle: 0, moving: false, jointBusy: false, speed: 0 })
    }

    this.cameraRig.update(dt, this.excavator)
    this.particles.update(dt, this.time)
    this.sparks.update(dt, this.time)
    this.debris.update(dt, this.time)

    this._snapshotTimer -= dt
    if (this._snapshotTimer <= 0) {
      this._snapshotTimer = 0.15
      this.ui.onSnapshot?.(this.mission.snapshot())
    }
    this.r.composer.render()
  }

  _menuOrbit(dt) {
    this.cameraRig.yawOffset += dt * 0.18
    this.cameraRig.pitch = 0.34
    this.cameraRig.dist = 24
  }

  _ensureAudio() {
    this.audio.ensure()
  }

  startContract(index) {
    this._ensureAudio()
    this.audio.click()
    this.mission.startContract(index)
  }

  startFree() {
    this._ensureAudio()
    this.audio.click()
    this.mission.startFree()
  }

  pause() {
    this._ensureAudio()
    this.mission.pause()
    this.audio.click()
  }

  resume() {
    this._ensureAudio()
    this.mission.resume()
    this.audio.click()
  }

  toMenu() {
    this.audio.click()
    this.mission.toMenu()
  }

  retry() {
    this._ensureAudio()
    this.audio.click()
    this._resetWorld()
    this.mission.retry()
  }

  nextContract() {
    this._ensureAudio()
    this.audio.click()
    const idx = this.mission.contractIndex + 1
    if (idx < CONTRACTS.length && this.mission.unlocked > idx) {
      this._resetWorld()
      this.mission.startContract(idx)
    } else {
      this._resetWorld()
      this.mission.toMenu()
    }
  }

  _resetWorld() {
    this.debris.clear()
    this.buildings.buildLayout()
    this.excavator.reset()
  }

  cycleCamera() {
    this._ensureAudio()
    const name = this.cameraRig.cycle()
    this.ui.onEvent?.({ type: 'toast', text: `视角：${name}` })
    return name
  }

  setTouchMode() {
    this.input.touch = true
  }

  toggleMute() {
    this._muted = !this._muted
    this.audio.ensure()
    this.audio.setMuted(this._muted)
    saveLS('muted', this._muted)
    this.ui.onEvent?.({ type: 'toast', text: this._muted ? '已静音' : '声音开启' })
  }

  isMuted() {
    return this._muted
  }

  dispose() {
    this.disposed = true
    this.running = false
    cancelAnimationFrame(this._raf)
    this.input?.detach()
    this.cameraRig?.dispose()
    this.r?.dispose()
    try {
      this.audio?.ctx?.close()
    } catch {
      /* ignore */
    }
  }
}
