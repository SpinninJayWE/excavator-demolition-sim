import { CONTRACTS, formatMoney, formatTime } from '../game/constants.js'

function Stars({ n }) {
  return (
    <div className="text-4xl tracking-widest">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-white/15'}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function ResultScreen({ result, snap, isLast, onNext, onRetry, onMenu }) {
  const win = result.type === 'complete'
  const c = snap.mode === 'contract' && snap.contractIndex >= 0 ? CONTRACTS[snap.contractIndex] : null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="slide-up glass w-[min(92vw,420px)] p-6 text-center">
        <div className="text-[11px] tracking-[0.4em] text-white/45">{win ? 'CONTRACT COMPLETE' : 'MISSION FAILED'}</div>
        <h2 className={`hud-title mt-1 text-3xl font-black ${win ? 'text-amber-400' : 'text-red-400'}`}>{win ? '拆迁完成！' : '任务失败'}</h2>
        {win && (
          <>
            <div className="mt-3">
              <Stars n={result.data.stars} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-white/45">拆迁收入</div>
                <div className="mt-0.5 font-bold text-lime-300">{formatMoney(result.data.damageValue)}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-white/45">碎块数</div>
                <div className="mt-0.5 font-bold text-white/90">{result.data.bricksBroken}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-white/45">清理</div>
                <div className="mt-0.5 font-bold text-white/90">{result.data.cleared}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-white/70">
                <span>基础奖励</span>
                <span className="font-bold text-amber-300">+{formatMoney(c?.reward ?? 0)}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>时间奖励</span>
                <span className="font-bold text-lime-300">+{formatMoney(result.data.timeBonus)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 text-base">
                <span className="text-white/85">入账</span>
                <span className="font-black text-amber-300">+{formatMoney(result.data.reward)}</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/40">
              余额 {formatMoney(snap.money)} · 剩余时间 {formatTime(snap.timeLeft)}
            </div>
          </>
        )}
        {!win && (
          <div className="mt-4 text-sm leading-relaxed text-white/60">
            时间用完了！当前进度 <span className="font-bold text-white/85">{Math.floor(snap.percent * 100)}%</span>
            {snap.countTarget > 0 && <> · 回收 {snap.count}/{snap.countTarget}</>}
            {snap.damageTarget > 0 && <> · 收入 {formatMoney(snap.damageValue)}/{formatMoney(snap.damageTarget)}</>}
            <br />
            再接再厉，挖机手！
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          {win && !isLast && (
            <button onClick={onNext} className="pulse-glow rounded-xl bg-amber-500 py-2.5 font-bold text-black transition-transform hover:scale-[1.02]">
              下一合约 →
            </button>
          )}
          <button onClick={onRetry} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white/90 hover:bg-white/20">
            {win ? '再玩一次' : '重新挑战'}
          </button>
          <button onClick={onMenu} className="rounded-xl border border-white/10 py-2 text-sm text-white/60 hover:text-white">
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  )
}
