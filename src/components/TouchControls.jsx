import { useEffect, useRef, useState } from 'react'

const STICK_R = 46

function Stick({ onMove, label }) {
  const ref = useRef(null)
  const active = useRef(null)
  const origin = useRef({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const move = (e) => {
    if (!active.current) return
    let dx = e.clientX - origin.current.x
    let dy = e.clientY - origin.current.y
    const len = Math.hypot(dx, dy)
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R
      dy = (dy / len) * STICK_R
    }
    setKnob({ x: dx, y: dy })
    onMove(dx / STICK_R, -dy / STICK_R)
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onMove(0, 0)
  }

  return (
    <div
      ref={ref}
      className="pointer-events-auto relative h-28 w-28 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        active.current = e.pointerId
        const r = ref.current.getBoundingClientRect()
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        e.currentTarget.setPointerCapture?.(e.pointerId)
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] text-white/35">{label}</div>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-amber-300/60 bg-amber-400/25"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}

function HoldButton({ active, onHold, onRelease, children, cls = '' }) {
  return (
    <button
      className={`pointer-events-auto flex h-12 min-w-12 items-center justify-center rounded-xl border px-2 text-[11px] font-bold backdrop-blur-sm transition-colors ${active ? 'border-amber-300 bg-amber-400/40 text-amber-100' : 'border-white/25 bg-black/35 text-white/85'} ${cls}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onHold()
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onPointerLeave={onRelease}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

export default function TouchControls({ engine, onCamera, onPause }) {
  const [boomDir, setBoomDir] = useState(0)
  const [bucketDir, setBucketDir] = useState(0)
  useEffect(() => {
    engine?.setTouchMode()
  }, [engine])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute bottom-6 left-5">
        <Stick
          label="行驶"
          onMove={(x, y) => {
            engine?.input?.setVirtual('driveX', x)
            engine?.input?.setVirtual('driveY', y)
          }}
        />
      </div>

      <div className="absolute bottom-6 right-5">
        <Stick
          label="回转·斗杆"
          onMove={(x, y) => {
            engine?.input?.setVirtual('swing', x)
            engine?.input?.setVirtual('arm', y)
          }}
        />
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        <HoldButton active={boomDir < 0} onHold={() => { setBoomDir(-1); engine?.input?.setVirtual('boom', -1) }} onRelease={() => { setBoomDir(0); engine?.input?.setVirtual('boom', 0) }}>
          大臂↑
        </HoldButton>
        <HoldButton active={boomDir > 0} onHold={() => { setBoomDir(1); engine?.input?.setVirtual('boom', 1) }} onRelease={() => { setBoomDir(0); engine?.input?.setVirtual('boom', 0) }}>
          大臂↓
        </HoldButton>
        <HoldButton active={bucketDir > 0} onHold={() => { setBucketDir(1); engine?.input?.setVirtual('bucket', 1) }} onRelease={() => { setBucketDir(0); engine?.input?.setVirtual('bucket', 0) }}>
          铲斗收
        </HoldButton>
        <HoldButton active={bucketDir < 0} onHold={() => { setBucketDir(-1); engine?.input?.setVirtual('bucket', -1) }} onRelease={() => { setBucketDir(0); engine?.input?.setVirtual('bucket', 0) }}>
          铲斗放
        </HoldButton>
      </div>

      <div className="absolute right-5 top-20 flex flex-col gap-2">
        <button
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/35 text-sm text-white/85 backdrop-blur-sm"
          onClick={onCamera}
          title="切换视角"
        >
          📷
        </button>
        <button
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/35 text-sm text-white/85 backdrop-blur-sm"
          onClick={onPause}
          title="暂停"
        >
          ⏸
        </button>
      </div>
    </div>
  )
}
