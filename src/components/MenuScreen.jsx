import { CONTRACTS, FREE_MODE, formatMoney, KEYMAP } from '../game/constants.js'

export default function MenuScreen({ snap, onStart, onFree, onMute, muted }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-black/70 via-black/45 to-black/75">
      <div className="slide-up flex w-[min(94vw,860px)] flex-col gap-4 py-6">
        <div className="text-center">
          <div className="text-[11px] tracking-[0.5em] text-amber-200/60">HEAVY DUTY DEMOLITION</div>
          <h1 className="hud-title mt-1 text-4xl font-black text-amber-400 md:text-5xl">挖掘机拆迁模拟器</h1>
          <div className="mt-1.5 text-sm text-white/60">开上 20 吨级挖机 · 铲平一切</div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="glass flex-1 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-white/85">合约任务</div>
              <div className="text-xs text-amber-300">余额 {formatMoney(snap.money)}</div>
            </div>
            <div className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto pr-1">
              {CONTRACTS.map((c, i) => {
                const locked = i >= snap.unlocked
                return (
                  <button
                    key={c.id}
                    disabled={locked}
                    onClick={() => onStart(i)}
                    className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      locked
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.03] opacity-45'
                        : 'border-amber-300/25 bg-white/[0.05] hover:border-amber-300/70 hover:bg-amber-400/10'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black ${
                        locked ? 'bg-white/5 text-white/30' : 'bg-amber-400/20 text-amber-300'
                      }`}
                    >
                      {locked ? '🔒' : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white/90">{c.name}</div>
                      <div className="mt-0.5 truncate text-xs text-white/50">{c.desc}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-lime-300">+{formatMoney(c.reward)}</div>
                      <div className="text-[11px] text-white/45">限时 {Math.floor(c.time / 60)} 分钟</div>
                    </div>
                  </button>
                )
              })}
              <button
                onClick={onFree}
                className="group flex items-center gap-3 rounded-xl border border-sky-300/25 bg-white/[0.05] p-3 text-left transition-all hover:border-sky-300/70 hover:bg-sky-400/10"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-400/20 text-lg font-black text-sky-300">
                  🏗️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white/90">{FREE_MODE.name}</div>
                  <div className="mt-0.5 truncate text-xs text-white/50">{FREE_MODE.desc}</div>
                </div>
                <div className="shrink-0 text-[11px] text-white/45">无时间限制</div>
              </button>
            </div>
          </div>

          <div className="glass w-full shrink-0 p-4 lg:w-64">
            <div className="text-sm font-bold text-white/85">操作说明</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {KEYMAP.map(([k, d]) => (
                <div key={k} className="flex items-center gap-2 text-[11px]">
                  <span className="key">{k}</span>
                  <span className="text-white/60">{d}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/45">
              铲斗对准建筑挥舞即可拆解。碎块带真实物理，注意上层结构会随支撑损毁而坍塌。
            </div>
            <button onClick={onMute} className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-white/70 hover:text-amber-300">
              {muted ? '🔇 开启声音' : '🔊 静音'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
