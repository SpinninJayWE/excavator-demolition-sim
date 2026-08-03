
export class Input {
  constructor() {
    this.axis = { driveY: 0, driveX: 0, swing: 0, boom: 0, arm: 0, bucket: 0 }
    this.pressed = new Set()
    this.just = new Set()
    this.hornHeld = false
    this.touch = false
    this.onKeyDown = (e) => this._down(e)
    this.onKeyUp = (e) => this._up(e)
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  _down(e) {
    if (e.repeat) return
    if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
    this.pressed.add(e.code)
    this.just.add(e.code)
    if (e.code === 'Space') this.hornHeld = true
  }

  _up(e) {
    this.pressed.delete(e.code)
    if (e.code === 'Space') this.hornHeld = false
  }

  justPressed(code) {
    if (this.just.has(code)) {
      this.just.delete(code)
      return true
    }
    return false
  }

  clearJust() {
    this.just.clear()
  }

  setVirtual(axis, value) {
    if (axis in this.axis) this.axis[axis] = value
  }

  get(k) {
    return this.axis[k]
  }

  update() {
    const up = (this.pressed.has('KeyW') || this.pressed.has('ArrowUp') ? 1 : 0)
    const dn = (this.pressed.has('KeyS') || this.pressed.has('ArrowDown') ? 1 : 0)
    const lt = (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft') ? 1 : 0)
    const rt = (this.pressed.has('KeyD') || this.pressed.has('ArrowRight') ? 1 : 0)
    if (!this.touch) {
      this.axis.driveY = up - dn
      this.axis.driveX = lt - rt
    }
    this.axis.swing = (this.pressed.has('KeyQ') ? 1 : 0) - (this.pressed.has('KeyE') ? 1 : 0)
    this.axis.boom = (this.pressed.has('KeyR') ? 1 : 0) - (this.pressed.has('KeyF') ? 1 : 0)
    this.axis.arm = (this.pressed.has('KeyT') ? 1 : 0) - (this.pressed.has('KeyG') ? 1 : 0)
    this.axis.bucket = (this.pressed.has('KeyY') ? 1 : 0) - (this.pressed.has('KeyH') ? 1 : 0)
  }
}
