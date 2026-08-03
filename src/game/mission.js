import { CONTRACTS, loadLS, saveLS } from './constants.js'

export class MissionManager {
  constructor(ui, buildings) {
    this.ui = ui
    this.buildings = buildings
    this.state = 'menu' // menu | countdown | playing | paused | complete | failed
    this.mode = null // 'contract' | 'free'
    this.contractIndex = -1
    this.timeLeft = 0
    this.countdown = 0
    this._lastN = -1
    this.stats = { damageValue: 0, bricksBroken: 0, clearedCount: 0 }
    this.money = loadLS('money', 0)
    this.unlocked = loadLS('unlocked', 1)
    this.totalStats = loadLS('stats', { bricks: 0, earned: 0 })
    this.combo = 0
    this._lastBreakTime = 0
  }

  startContract(index) {
    this.mode = 'contract'
    this.contractIndex = index
    this.state = 'countdown'
    this.countdown = 3.5
    this._lastN = -1
    this._resetStats()
    const c = CONTRACTS[index]
    this.timeLeft = c.time
    this.buildings.setTargets(c.target ? [c.target] : [])
    this.ui.onEvent({ type: 'contractStarted', index })
  }

  startFree() {
    this.mode = 'free'
    this.contractIndex = -1
    this.state = 'countdown'
    this.countdown = 3.5
    this._lastN = -1
    this._resetStats()
    this.buildings.setTargets([])
    this.ui.onEvent({ type: 'freeStarted' })
  }

  _resetStats() {
    this.stats = { damageValue: 0, bricksBroken: 0, clearedCount: 0 }
    this.combo = 0
  }

  onBrickBreak(value) {
    if (this.state !== 'playing') return
    this.stats.damageValue += value
    this.stats.bricksBroken++
    const now = performance.now() / 1000
    if (now - this._lastBreakTime < 1.4) {
      this.combo++
      if (this.combo > 0 && this.combo % 8 === 0) {
        this.ui.onEvent({ type: 'toast', text: `连击 x${this.combo}！+${this.combo * 20} 元` })
      }
    } else {
      this.combo = 1
    }
    this._lastBreakTime = now
  }

  onDebrisCounted() {
    if (this.state !== 'playing') return
    this.stats.clearedCount++
    this.stats.damageValue += 150
    this.ui.onEvent({ type: 'toast', text: `碎块已回收 +150 元 (${this.stats.clearedCount})` })
  }

  _contractProgress(c) {
    if (c.percent != null) {
      const ratio = this.buildings.damageRatio(c.target)
      return { percent: ratio, met: ratio >= c.percent }
    }
    if (c.count != null) {
      return { count: this.stats.clearedCount, met: this.stats.clearedCount >= c.count }
    }
    if (c.damageValue != null) {
      return { damageValue: this.stats.damageValue, met: this.stats.damageValue >= c.damageValue }
    }
    return { percent: this.buildings.damageAll(), met: false }
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt
      const n = Math.ceil(this.countdown)
      if (n !== this._lastN) {
        this._lastN = n
        this.ui.onEvent({ type: 'countdown', n: Math.max(0, n) })
      }
      if (this.countdown <= 0) {
        this.state = 'playing'
        this.ui.onEvent({ type: 'toast', text: this.mode === 'free' ? '自由拆迁开始！' : '任务开始，抓紧时间！' })
        this.ui.onEvent({ type: 'playing' })
      }
      return
    }
    if (this.state !== 'playing') return

    if (this.mode === 'contract') {
      this.timeLeft -= dt
      const c = CONTRACTS[this.contractIndex]
      const prog = this._contractProgress(c)
      if (prog.met) {
        this._complete(c, prog)
        return
      }
      if (this.timeLeft <= 0) {
        this.state = 'failed'
        this.ui.audio?.fail()
        this.ui.onEvent({ type: 'failed', data: { progress: prog } })
        return
      }
    }
  }

  _complete(c, prog) {
    this.state = 'complete'
    let reward = c.reward
    let stars = 1
    if (c.percent != null && prog.percent >= c.percent + 0.15) stars = 2
    if (c.count != null && prog.count >= c.count + 15) stars = 2
    if (c.damageValue != null && prog.damageValue >= c.damageValue + 5000) stars = 2
    const timeBonus = Math.max(0, Math.floor(this.timeLeft)) * 10
    if (timeBonus > 0) stars = 3
    reward += timeBonus
    this.money += reward
    this.totalStats.earned += reward
    if (this.mode === 'contract') {
      this.unlocked = Math.max(this.unlocked, this.contractIndex + 2)
      saveLS('unlocked', this.unlocked)
    }
    saveLS('money', this.money)
    saveLS('stats', this.totalStats)
    this.ui.audio?.success()
    this.ui.onEvent({
      type: 'complete',
      data: {
        reward,
        timeBonus,
        stars,
        damageValue: this.stats.damageValue,
        bricksBroken: this.stats.bricksBroken,
        cleared: this.stats.clearedCount,
      },
    })
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused'
      this.ui.onEvent({ type: 'paused' })
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.ui.onEvent({ type: 'resumed' })
    }
  }

  toMenu() {
    this.state = 'menu'
    this.buildings.setTargets([])
    this.ui.onEvent({ type: 'toMenu' })
  }

  retry() {
    if (this.mode === 'contract') this.startContract(this.contractIndex)
    else this.startFree()
  }

  snapshot() {
    const c = this.mode === 'contract' && this.contractIndex >= 0 ? CONTRACTS[this.contractIndex] : null
    const prog = c ? this._contractProgress(c) : null
    return {
      state: this.state,
      mode: this.mode,
      contractIndex: this.contractIndex,
      contractName: c?.name ?? null,
      contractDesc: c?.desc ?? null,
      contractReward: c?.reward ?? 0,
      timeLeft: this.timeLeft,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      percent: prog?.percent ?? 0,
      count: prog?.count ?? 0,
      countTarget: c?.count ?? 0,
      damageValue: this.stats.damageValue,
      damageTarget: c?.damageValue ?? 0,
      money: this.money,
      unlocked: this.unlocked,
      bricksBroken: this.stats.bricksBroken,
      totalStats: this.totalStats,
      combo: this.combo,
    }
  }
}
