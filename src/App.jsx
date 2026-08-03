import { useCallback, useEffect, useRef, useState } from 'react'
import { GameEngine } from './game/engine.js'
import Hud from './components/Hud.jsx'
import MenuScreen from './components/MenuScreen.jsx'
import ResultScreen from './components/ResultScreen.jsx'
import PauseScreen from './components/PauseScreen.jsx'
import TouchControls from './components/TouchControls.jsx'
import { CONTRACTS, GAME_VERSION } from './game/constants.js'

const INITIAL_SNAP = {
  state: 'menu',
  mode: null,
  contractIndex: -1,
  money: 0,
  unlocked: 1,
  timeLeft: 0,
  countdown: 0,
  percent: 0,
  count: 0,
  damageValue: 0,
  bricksBroken: 0,
  totalStats: { bricks: 0, earned: 0 },
}

export default function App() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const [snap, setSnap] = useState(INITIAL_SNAP)
  const [toasts, setToasts] = useState([])
  const [result, setResult] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraName, setCameraName] = useState('跟随视角')
  const [touchUi, setTouchUi] = useState(false)
  const toastId = useRef(0)

  useEffect(() => {
    let disposed = false
    const engine = new GameEngine({
      onSnapshot: (s) => {
        setSnap(s)
        setMuted(engine.isMuted())
        setCameraName(engine.cameraRig?.getName() ?? '跟随视角')
      },
      onEvent: (e) => {
        if (e.type === 'toast') {
          const id = ++toastId.current
          setToasts((t) => [...t, { id, text: e.text }])
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
        } else if (e.type === 'complete') {
          setResult({ type: 'complete', data: e.data })
        } else if (e.type === 'failed') {
          setResult({ type: 'failed', data: e.data })
        } else if (e.type === 'toMenu') {
          setResult(null)
        }
      },
    })
    engineRef.current = engine
    engine
      .init(canvasRef.current)
      .then(() => {
        if (disposed) engine.dispose()
      })
      .catch((err) => {
        console.error('[EDM] init failed:', err)
        setSnap((s) => ({ ...s, fatalError: String(err && err.stack ? err.stack : err) }))
      })
    setTouchUi(window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
    return () => {
      disposed = true
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [])

  const eng = () => engineRef.current
  const cb = useCallback((fn) => fn(eng()), [])

  const screen = snap.state
  const inGame = screen === 'playing' || screen === 'countdown'

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#171310]">
      <canvas ref={canvasRef} className="game-canvas" />

      {inGame && (
        <Hud
          snap={snap}
          cameraName={cameraName}
          muted={muted}
          onPause={() => cb((e) => e.pause())}
          onMute={() => cb((e) => e.toggleMute())}
          onCamera={() => cb((e) => e.cycleCamera())}
        />
      )}

      {screen === 'countdown' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div key={snap.countdown} className="hud-title fade-in text-8xl font-black text-amber-400 drop-shadow-[0_4px_24px_rgba(255,170,40,0.6)]">
            {snap.countdown}
          </div>
        </div>
      )}

      {screen === 'menu' && <MenuScreen snap={snap} muted={muted} onStart={(i) => cb((e) => e.startContract(i))} onFree={() => cb((e) => e.startFree())} onMute={() => cb((e) => e.toggleMute())} />}

      {screen === 'paused' && (
        <PauseScreen snap={snap} onResume={() => cb((e) => e.resume())} onMenu={() => cb((e) => e.toMenu())} onRetry={() => cb((e) => e.retry())} onMute={() => cb((e) => e.toggleMute())} muted={muted} />
      )}

      {(screen === 'complete' || screen === 'failed') && result && (
        <ResultScreen
          result={result}
          snap={snap}
          isLast={snap.contractIndex >= CONTRACTS.length - 1}
          onNext={() => cb((e) => e.nextContract())}
          onRetry={() => cb((e) => e.retry())}
          onMenu={() => cb((e) => e.toMenu())}
        />
      )}

      {inGame && touchUi && (
        <TouchControls
          engine={engineRef.current}
          onCamera={() => cb((e) => e.cycleCamera())}
          onPause={() => cb((e) => e.pause())}
          cameraName={cameraName}
        />
      )}

      {/* 提示 toast */}
      <div className="pointer-events-none absolute left-1/2 top-20 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast glass px-4 py-1.5 text-sm text-amber-100">
            {t.text}
          </div>
        ))}
      </div>

      {screen === 'menu' && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 text-[11px] text-white/35">
          挖掘机拆迁模拟器 v{GAME_VERSION} · 全部模型与音效程序化生成 · 支持触屏
        </div>
      )}

      {snap.fatalError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="glass max-w-lg p-5 text-sm text-red-300">
            初始化失败：<br />
            <span className="break-all text-xs text-white/60">{snap.fatalError}</span>
          </div>
        </div>
      )}
    </div>
  )
}
