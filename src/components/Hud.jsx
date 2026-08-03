import { formatMoney, formatTime } from '../game/constants.js'

function Objective({ snap }) {
  const c = snap.mode === 'contract' && snap.contractName ? snap.contractName : '自由拆迁'
  let pct = snap.percent
  let label = `${Math.floor(pct * 100)}%`
  if (snap.mode === 'contract') {
    if (snap.countTarget > 0) {
      pct = Math.min(1, snap.count / snap.countTarget)
      label = `${snap.count} / ${snap.countTarget} 块`
    } else if (snap.damageTarget > 0) {
      pct = Math.min(1, snap.damageValue / snap.damageTarget)
      label = `${formatMoney(snap.damageValue)} / ${formatMoney(snap.damageTarget)}`
    }
  }
  return (
    <div className="glass pointer-events-none w-72 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold tracking-wider text-amber-300">{c}</div>
        <div className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-sm text-lime-300">{formatTime(snap.timeLeft)}</div>
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-white/65">{snap.contractDesc ?? '无时间限制，想拆就拆，实时结算拆迁费'}</div>
      <div className="progress-track mt-2.5 h-2.5">
        <div className="progress-fill" style={{ width: `${Math.max(2, pct * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span>
        <span>已拆 {snap.bricksBroken} 块</span>
      </div>
      {snap.mode === 'contract' && (
        <div className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] text-amber-200/80">
          完成奖励 {formatMoney(snap.mode === 'contract' ? snap.contractReward ?? 0 : 0)} + 时间奖励
        </div>
      )}
    </div>
  )
}

export default function Hud({ snap, cameraName, muted, onPause, onMute, onCamera }) {
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-4 z-20">
        <Objective snap={snap} />
      </div>

      <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
        <div className="glass px-4 py-2 text-right">
          <div className="text-[11px] text-white/50">账户余额</div>
          <div className="text-xl font-black text-amber-300">{formatMoney(snap.money)}</div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onCamera} className="glass px-3 py-1.5 text-xs text-white/80 hover:text-amber-300" title="切换视角 (C)">
            {cameraName}
          </button>
          <button onClick={onMute} className="glass px-3 py-1.5 text-xs text-white/80 hover:text-amber-300" title="静音 (M)">
            {muted ? '🔇' : '🔊'}
          </button>
          <button onClick={onPause} className="glass px-3 py-1.5 text-xs text-white/80 hover:text-amber-300" title="暂停 (P)">
            ⏸
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden md:block">
        <div className="glass px-3 py-2 text-[10px] leading-relaxed text-white/55">
          <div className="mb-1 font-bold text-white/70">操作</div>
          <div>W/S 前进后退 · A/D 转向</div>
          <div>Q/E 回转 · R/F 大臂</div>
          <div>T/G 斗杆 · Y/H 铲斗</div>
          <div>C 视角 · 拖拽旋转镜头 · 滚轮缩放</div>
        </div>
      </div>
    </>
  )
}
