'use client'

import { useEffect, useRef } from 'react'

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let startTime: number | null = null

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Smooth wave path via quadratic bezier
    const buildPoints = (W: number, H: number, t: number): [number, number][] => {
      const N = 90
      const baseY   = H * 0.52
      const amp     = H * 0.19
      const breathe = 1 + 0.11 * Math.sin(t * 0.31)
      const pts: [number, number][] = []
      for (let i = 0; i <= N; i++) {
        const nx = i / N
        const x  = nx * W
        // Three harmonics — different speeds/phases for organic, non-mechanical motion
        const y  = baseY + amp * breathe * (
          0.50 * Math.sin(nx * 2.5 * Math.PI + t * 0.40) +
          0.30 * Math.sin(nx * 5.2 * Math.PI - t * 0.25 + 1.3) +
          0.20 * Math.sin(nx * 9.0 * Math.PI + t * 0.15 + 2.8)
        )
        pts.push([x, y])
      }
      return pts
    }

    const tracePath = (pts: [number, number][]) => {
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2
        const my = (pts[i][1] + pts[i + 1][1]) / 2
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
    }

    const pass = (
      pts: [number, number][],
      width: number,
      style: string | CanvasGradient,
      alpha: number,
      blur: number,
      shadowCol: string,
    ) => {
      ctx.save()
      tracePath(pts)
      ctx.strokeStyle   = style
      ctx.lineWidth     = width
      ctx.lineCap       = 'round'
      ctx.lineJoin      = 'round'
      ctx.globalAlpha   = alpha
      ctx.shadowBlur    = blur
      ctx.shadowColor   = shadowCol
      ctx.stroke()
      ctx.restore()
    }

    const draw = (ts: number) => {
      if (startTime === null) startTime = ts
      const t = (ts - startTime) / 1000

      const { width: W, height: H } = canvas

      // Deep black background
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, W, H)

      const pts = buildPoints(W, H, t)

      // Horizontal gradient — emerald → electric green → aqua → cyan
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0,    '#00c853')
      grad.addColorStop(0.33, '#00ff88')
      grad.addColorStop(0.66, '#00ffcc')
      grad.addColorStop(1,    '#00e5ff')

      // ── 5 glow layers, outside-in ─────────────────────────────────────────
      // 1. Volumetric outer halo
      pass(pts, 110, 'rgba(0,255,136,0.04)', 1, 90,  '#00ff88')
      // 2. Mid-range glow
      pass(pts,  45, 'rgba(0,255,200,0.10)', 1, 50,  '#00ffcc')
      // 3. Inner atmospheric glow
      pass(pts,  14, grad,                   0.55, 28, '#00ffcc')
      // 4. Sharp core line
      pass(pts,   2.5, grad,                 0.92, 14, '#00ffee')
      // 5. Ultra-bright specular highlight
      pass(pts,   0.9, 'rgba(220,255,240,0.80)', 1, 7, '#ffffff')

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* 30% edge bevel — darkens the outer 30% on all sides */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: `radial-gradient(ellipse 80% 80% at 50% 50%,
            transparent 40%,
            rgba(5,5,5,0.55) 70%,
            rgba(5,5,5,0.85) 85%,
            #050505 100%)`,
        }}
      />
    </>
  )
}
