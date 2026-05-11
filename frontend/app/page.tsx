'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Shield,
  Tv2,
  Film,
  Upload,
  BarChart3,
  Lock,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Aurora canvas ─────────────────────────────────────────────────────────────

function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let tick = 0

    const orbs = [
      { ox: 0.12, oy: 0.40, r: 780, rgb: [130, 20, 255] as [number,number,number], speed: 0.00035, phase: 0.0 },
      { ox: 0.78, oy: 0.60, r: 650, rgb: [0,  195, 145] as [number,number,number], speed: 0.00028, phase: 1.6 },
      { ox: 0.48, oy: 0.12, r: 600, rgb: [15,  80, 255] as [number,number,number], speed: 0.00045, phase: 3.1 },
      { ox: 0.88, oy: 0.22, r: 440, rgb: [210, 50, 175] as [number,number,number], speed: 0.00038, phase: 0.9 },
      { ox: 0.22, oy: 0.80, r: 520, rgb: [0,  130, 220] as [number,number,number], speed: 0.00030, phase: 2.3 },
      { ox: 0.60, oy: 0.45, r: 350, rgb: [255, 140, 0]  as [number,number,number], speed: 0.00022, phase: 4.0 },
    ]

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

      for (const o of orbs) {
        const x = (o.ox + Math.sin(tick * o.speed + o.phase) * 0.22) * W
        const y = (o.oy + Math.cos(tick * o.speed * 0.68 + o.phase) * 0.18) * H
        const g = ctx.createRadialGradient(x, y, 0, x, y, o.r)
        const [r, gr, b] = o.rgb
        g.addColorStop(0,   `rgba(${r},${gr},${b},0.28)`)
        g.addColorStop(0.45,`rgba(${r},${gr},${b},0.10)`)
        g.addColorStop(1,   `rgba(${r},${gr},${b},0)`)
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
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

// ─── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Tv2,
    title: 'Series y Episodios',
    description:
      'Gestiona series completas con temporadas y episodios. Control total del catálogo con estado de publicación independiente.',
  },
  {
    icon: Film,
    title: 'Películas y Programas',
    description:
      'Catálogo unificado de películas y programas televisivos con metadatos, sinopsis y fechas de transmisión.',
  },
  {
    icon: Upload,
    title: 'Carga y Transcodificación',
    description:
      'Carga masiva de archivos de video con transcodificación automática a HLS multi-bitrate (480p, 720p, 1080p).',
  },
  {
    icon: Shield,
    title: 'Control de Permisos',
    description:
      'Asigna acceso granular por contenido a cada televisora distribuidora, con soporte para streaming y descarga.',
  },
  {
    icon: BarChart3,
    title: 'Panel de Estadísticas',
    description:
      'Métricas en tiempo real sobre el catálogo, actividad de usuarios y estado del procesamiento de archivos.',
  },
  {
    icon: Lock,
    title: 'Acceso Restringido por Rol',
    description:
      'Tres niveles de acceso: Administrador, Gestor de Contenido y Televisora distribuidora. Seguridad JWT + refresh tokens.',
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#06060f] text-white overflow-x-hidden">
      <AuroraBackground />

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* All content above canvas */}
      <div className="relative" style={{ zIndex: 2 }}>

        {/* ── Nav ── */}
        <header className="fixed top-0 inset-x-0 z-50">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-600">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
              <span className="text-sm font-semibold tracking-wide">Capital 21 Play</span>
            </div>

            {/* Nav links + CTA */}
            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
                <a href="#plataforma" className="hover:text-white transition-colors">Plataforma</a>
                <a href="#funciones" className="hover:text-white transition-colors">Funciones</a>
              </nav>
              <Button
                asChild
                size="sm"
                className="bg-white text-black hover:bg-white/90 font-medium"
              >
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            </div>
          </div>

          {/* Glass underline */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </header>

        {/* ── Hero ── */}
        <section
          id="plataforma"
          className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
        >
          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Servicio de Medios Públicos · Ciudad de México
          </div>

          {/* Title */}
          <h1 className="max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            Distribución de{' '}
            <span
              className="inline-block"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #a855f7 0%, #3b82f6 40%, #06b6d4 75%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              contenido público
            </span>{' '}
            a escala.
          </h1>

          {/* Subtitle */}
          <p className="mt-7 max-w-2xl text-base text-white/55 leading-relaxed sm:text-lg">
            Plataforma privada de gestión y distribución de video para el Servicio de Medios Públicos
            de la Ciudad de México. Sube, transcodifica, organiza y distribuye series, películas y
            programas a televisoras distribuidoras con control granular de permisos.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-900/30"
            >
              <Link href="/login">
                Acceder a la plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
            >
              <a href="#funciones">
                Ver funciones
              </a>
            </Button>
          </div>

          {/* Stat strip */}
          <div className="mt-20 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 max-w-lg w-full mx-auto">
            {[
              { value: 'HLS', label: 'Streaming adaptativo' },
              { value: '3 roles', label: 'Control de acceso' },
              { value: '5 GB', label: 'Archivos por video' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-black/30 backdrop-blur-sm px-6 py-5">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="mt-0.5 text-xs text-white/45">{label}</div>
              </div>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Conoce más</span>
            <div className="h-6 w-px bg-gradient-to-b from-white/30 to-transparent animate-bounce" />
          </div>
        </section>

        {/* ── Features ── */}
        <section id="funciones" className="px-6 py-32 mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">
              Desde la carga del archivo hasta la distribución final a televisoras, Capital 21 Play
              cubre cada paso del flujo de producción de medios.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-white/8 bg-white/3 p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/15 hover:bg-white/6"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(400px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(139,92,246,0.08), transparent 70%)',
                  }}
                />
                <div className="relative">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 border border-white/8">
                    <Icon className="h-5 w-5 text-white/70" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA banner ── */}
        <section className="px-6 pb-32">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-emerald-900/20 p-12 text-center backdrop-blur-sm">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Listo para empezar
            </h2>
            <p className="mt-4 text-white/50 max-w-md mx-auto">
              Accede con tus credenciales institucionales y gestiona el catálogo del Servicio de Medios Públicos.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 gap-2 bg-white text-black hover:bg-white/90 font-semibold"
            >
              <Link href="/login">
                Iniciar sesión
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/8 px-6 py-8">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-purple-500 to-blue-600">
                <Play className="h-2.5 w-2.5 text-white fill-white" />
              </div>
              <span>Capital 21 Play</span>
            </div>
            <span>Servicio de Medios Públicos · Ciudad de México · {new Date().getFullYear()}</span>
            <Link href="/login" className="hover:text-white/60 transition-colors">
              Portal de acceso →
            </Link>
          </div>
        </footer>

      </div>
    </div>
  )
}
