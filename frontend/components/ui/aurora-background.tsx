'use client'

import { useEffect, useRef } from 'react'

const ORBS = [
  { ox: 0.12, oy: 0.40, r: 780, rgb: [130, 20, 255] as [number, number, number], speed: 0.00035, phase: 0.0 },
  { ox: 0.78, oy: 0.60, r: 650, rgb: [0, 195, 145]  as [number, number, number], speed: 0.00028, phase: 1.6 },
  { ox: 0.48, oy: 0.12, r: 600, rgb: [15, 80, 255]  as [number, number, number], speed: 0.00045, phase: 3.1 },
  { ox: 0.88, oy: 0.22, r: 440, rgb: [210, 50, 175]  as [number, number, number], speed: 0.00038, phase: 0.9 },
  { ox: 0.22, oy: 0.80, r: 520, rgb: [0, 130, 220]   as [number, number, number], speed: 0.00030, phase: 2.3 },
  { ox: 0.60, oy: 0.45, r: 350, rgb: [255, 140, 0]   as [number, number, number], speed: 0.00022, phase: 4.0 },
]

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let tick = 0

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      tick++
      const { width: W, height: H } = canvas

      ctx.fillStyle = '#06060f'
      ctx.fillRect(0, 0, W, H)

      ctx.globalCompositeOperation = 'screen'

      for (const o of ORBS) {
        const x = (o.ox + Math.sin(tick * o.speed + o.phase) * 0.22) * W
        const y = (o.oy + Math.cos(tick * o.speed * 0.68 + o.phase) * 0.18) * H
        const g = ctx.createRadialGradient(x, y, 0, x, y, o.r)
        const [r, gr, b] = o.rgb
        g.addColorStop(0,    `rgba(${r},${gr},${b},0.28)`)
        g.addColorStop(0.45, `rgba(${r},${gr},${b},0.10)`)
        g.addColorStop(1,    `rgba(${r},${gr},${b},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, o.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      {/* Animated gradient orbs */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* Grid overlay */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </>
  )
}
