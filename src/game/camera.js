import * as THREE from 'three'
import { CAMERA_MODES, CAMERA_NAMES } from './constants.js'

const _target = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export class CameraRig {
  constructor(camera, canvas) {
    this.camera = camera
    this.canvas = canvas
    this.modeIndex = 0
    this.mode = CAMERA_MODES[0]
    this.yawOffset = 0.6
    this.pitch = 0.4
    this.dist = 9.5
    this._look = new THREE.Vector3(0, 1.6, -6)
    this._smooth = new THREE.Vector3()
    this._lookSmooth = new THREE.Vector3()
    this._cockpitYaw = 0
    this._lastX = 0
    this._lastY = 0
    this._dragging = false
    this._onPointerDown = (e) => {
      this._dragging = true
      this._lastX = e.clientX
      this._lastY = e.clientY
      canvas.classList.add('dragging')
      canvas.setPointerCapture?.(e.pointerId)
    }
    this._onPointerMove = (e) => {
      if (!this._dragging) return
      const dx = e.clientX - this._lastX
      const dy = e.clientY - this._lastY
      this._lastX = e.clientX
      this._lastY = e.clientY
      this.yawOffset -= dx * 0.006
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, -0.25, 1.25)
    }
    this._onPointerUp = () => {
      this._dragging = false
      canvas.classList.remove('dragging')
    }
    this._onWheel = (e) => {
      e.preventDefault()
      this.dist = THREE.MathUtils.clamp(this.dist + e.deltaY * 0.012, 3.5, 26)
    }
    canvas.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('pointerup', this._onPointerUp)
    canvas.addEventListener('wheel', this._onWheel, { passive: false })
  }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length
    this.mode = CAMERA_MODES[this.modeIndex]
    return CAMERA_NAMES[this.modeIndex]
  }

  getName() {
    return CAMERA_NAMES[this.modeIndex]
  }

  update(dt, excavator) {
    const cam = this.camera
    excavator.getPos(_pos)
    excavator.getCabPos(_fwd)

    if (this.mode === 'chase') {
      const baseYaw = excavator.yaw
      const yaw = baseYaw + this.yawOffset
      _target.set(_pos.x, _pos.y + 1.8, _pos.z)
      cam.position.set(
        _target.x - Math.cos(yaw) * this.dist,
        _target.y + Math.sin(this.pitch) * this.dist,
        _target.z + Math.sin(yaw) * this.dist,
      )
      this._smooth.lerp(cam.position, Math.min(1, dt * 5))
      cam.position.copy(this._smooth)
      cam.lookAt(_target)
    } else if (this.mode === 'orbit') {
      const yaw = this.yawOffset + Math.PI
      _target.set(_pos.x, _pos.y + 1.6, _pos.z)
      cam.position.set(
        _target.x - Math.sin(yaw) * Math.cos(this.pitch) * this.dist,
        _target.y + Math.sin(this.pitch) * this.dist,
        _target.z - Math.cos(yaw) * Math.cos(this.pitch) * this.dist,
      )
      this._smooth.lerp(cam.position, Math.min(1, dt * 4))
      cam.position.copy(this._smooth)
      cam.lookAt(_target)
    } else {
      // 驾驶舱
      excavator.getCabForward(_fwd)
      _pos.set(_fwd.x * 0.3, 0, _fwd.z * 0.3)
      excavator.getCabPos(_pos).add(_pos)
      _pos.y += 0.75
      cam.position.lerp(_pos, Math.min(1, dt * 10))
      excavator.getCabForward(_fwd)
      const look = _target.copy(cam.position).addScaledVector(_fwd, 8).setY(cam.position.y - 0.9)
      this._lookSmooth.lerp(look, Math.min(1, dt * 6))
      cam.lookAt(this._lookSmooth)
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup', this._onPointerUp)
    this.canvas.removeEventListener('wheel', this._onWheel)
  }
}
