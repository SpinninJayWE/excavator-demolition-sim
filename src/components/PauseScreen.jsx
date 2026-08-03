import { formatMoney, formatTime } from '../game/constants.js'

export default function PauseScreen({ snap, onResume, onMenu, onRetry, onMute, muted }) {
  const name = snap.contractName ?? '自由拆迁'
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="slide-up glass w-[min(92vw,380px)] p-6 text-center">
        <h2 className="hud-title text-3xl font-black text-amber-300">已暂停</h2>
        <div className="mt-2 text-sm text-white/60">
          {name} · 剩余 <span className="font-mono text-white/85">{formatTime(snap.timeLeft)}</span>
        </div>
        <div className="mt-1 text-[11px] text-white/40">当前拆迁收入 {formatMoney(snap.damageValue)}</div>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onResume} className="pulse-glow rounded-xl bg-amber-500 py-2.5 font-bold text-black transition-transform hover:scale-[1.02]">
            继续施工
          </button>
          <button onClick={onRetry} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white/90 hover:bg-white/20">
            重新开始
          </button>
          <button onClick={onMenu} className="rounded-xl border border-white/10 py-2 text-sm text-white/60 hover:text-white">
            返回主菜单
          </button>
          <button onClick={onMute} className="rounded-xl border border-white/10 py-2 text-xs text-white/50 hover:text-white">
            {muted ? '🔇 开启声音' : '🔊 静音'}
          </button>
        </div>
      </div>
    </div>
  )
}
