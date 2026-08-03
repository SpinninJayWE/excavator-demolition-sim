export class AudioSys {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.noiseBuf = null
    this.engineOn = false
    this._engine = null
    this._hydraulic = null
    this._hydraulicGain = 0
    this._hornGain = 0
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.85
    this.master.connect(this.ctx.destination)
    const len = this.ctx.sampleRate * 1.2
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this._buildEngine()
    this._buildHydraulic()
    this._buildHorn()
  }

  setMuted(m) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05)
    }
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    return src
  }

  _buildEngine() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 1.4

    const o1 = this.ctx.createOscillator()
    o1.type = 'sawtooth'
    o1.frequency.value = 42
    const o2 = this.ctx.createOscillator()
    o2.type = 'sawtooth'
    o2.frequency.value = 43.2
    const o3 = this.ctx.createOscillator()
    o3.type = 'triangle'
    o3.frequency.value = 21
    const g1 = this.ctx.createGain()
    g1.gain.value = 0.5
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.35
    const g3 = this.ctx.createGain()
    g3.gain.value = 0.7

    o1.connect(g1).connect(lp)
    o2.connect(g2).connect(lp)
    o3.connect(g3).connect(lp)

    const nSrc = this._noiseSource()
    const nG = this.ctx.createGain()
    nG.gain.value = 0.14
    const nLp = this.ctx.createBiquadFilter()
    nLp.type = 'lowpass'
    nLp.frequency.value = 260
    nSrc.connect(nG).connect(nLp)
    nLp.connect(lp)
    nSrc.start()

    lp.connect(g)
    g.connect(this.master)
    o1.start()
    o2.start()
    o3.start()
    this._engine = { g, lp, o1, o2, o3, nG }
  }

  _buildHydraulic() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 620
    bp.Q.value = 1.1
    const src = this._noiseSource()
    src.connect(bp).connect(g)
    g.connect(this.master)
    src.start()
    this._hydraulic = { g, bp }
  }

  _buildHorn() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    const o1 = this.ctx.createOscillator()
    o1.type = 'square'
    o1.frequency.value = 196
    const o2 = this.ctx.createOscillator()
    o2.type = 'square'
    o2.frequency.value = 294
    const g1 = this.ctx.createGain()
    g1.gain.value = 0.5
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.3
    o1.connect(g1).connect(lp)
    o2.connect(g2).connect(lp)
    lp.connect(g)
    g.connect(this.master)
    o1.start()
    o2.start()
    this._hornGain = g
  }

  update(dt, { throttle, moving, jointBusy, speed }) {
    if (!this.ctx || !this._engine) return
    const t = this.ctx.currentTime
    const eng = this._engine
    const rpm = 0.45 + Math.abs(throttle) * 0.55 + Math.min(0.3, Math.abs(speed) * 0.12)
    eng.o1.frequency.setTargetAtTime(38 + rpm * 58, t, 0.08)
    eng.o2.frequency.setTargetAtTime(39 + rpm * 60, t, 0.08)
    eng.o3.frequency.setTargetAtTime(19 + rpm * 26, t, 0.08)
    eng.lp.frequency.setTargetAtTime(380 + rpm * 520, t, 0.1)
    const load = 0.55 + rpm * 0.45
    eng.g.gain.setTargetAtTime(this.engineOn ? 0.16 * load : 0, t, 0.12)
    eng.nG.gain.setTargetAtTime(this.engineOn ? 0.05 + (moving ? 0.09 : 0) : 0, t, 0.12)

    const h = this._hydraulic
    const target = jointBusy ? 0.12 : 0
    h.g.gain.setTargetAtTime(target, t, 0.07)
    h.bp.frequency.setTargetAtTime(480 + Math.random() * 320, t, 0.05)

    const horn = this._hornGain
    horn.gain.setTargetAtTime(0, t, 0.03)
  }

  horn() {
    if (!this.ctx || !this._hornGain) return
    const t = this.ctx.currentTime
    this._hornGain.gain.setTargetAtTime(0.1, t, 0.01)
  }

  _burst(dur, filterType, filterFreq, gainPeak) {
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.9 + Math.random() * 0.3
    const f = this.ctx.createBiquadFilter()
    f.type = filterType
    f.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gainPeak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start()
    src.stop(t + dur + 0.05)
  }

  impact(intensity, metal) {
    if (!this.ctx || intensity <= 0) return
    const t = this.ctx.currentTime
    const v = Math.min(1, intensity)
    if (metal) {
      this._burst(0.12 + v * 0.15, 'bandpass', 1400 + Math.random() * 800, 0.5 * v)
    } else {
      this._burst(0.1 + v * 0.18, 'lowpass', 500 + Math.random() * 300, 0.55 * v)
    }
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.5 * v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.connect(g).connect(this.master)
    osc.start()
    osc.stop(t + 0.25)
  }

  crack(intensity) {
    if (!this.ctx) return
    const v = Math.min(1, intensity)
    const n = 3 + Math.floor(v * 5)
    for (let i = 0; i < n; i++) {
      setTimeout(() => this._burst(0.04 + Math.random() * 0.08, 'bandpass', 1800 + Math.random() * 2200, 0.16 * v), i * 18)
    }
    this._burst(0.25, 'lowpass', 700, 0.3 * v)
  }

  clank() {
    if (!this.ctx) return
    this._burst(0.2, 'bandpass', 900 + Math.random() * 500, 0.25)
  }

  click() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 720
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    osc.connect(g).connect(this.master)
    osc.start()
    osc.stop(t + 0.09)
  }

  success() {
    if (!this.ctx) return
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => {
      setTimeout(() => {
        const t = this.ctx.currentTime
        const osc = this.ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0.12, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
        osc.connect(g).connect(this.master)
        osc.start()
        osc.stop(t + 0.45)
      }, i * 130)
    })
  }

  fail() {
    if (!this.ctx) return
    const notes = [330, 262, 196]
    notes.forEach((f, i) => {
      setTimeout(() => {
        const t = this.ctx.currentTime
        const osc = this.ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = f
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0.1, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
        osc.connect(g).connect(this.master)
        osc.start()
        osc.stop(t + 0.4)
      }, i * 160)
    })
  }
}
