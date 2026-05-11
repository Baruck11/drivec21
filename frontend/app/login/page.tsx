'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Play, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import Link from 'next/link'

import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AuroraBackground } from '@/components/ui/aurora-background'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginForm) {
    try {
      await login(values.email, values.password)
      router.replace('/dashboard')
    } catch (error) {
      const description =
        error instanceof Error ? error.message : 'Verifica tu email y contraseña.'
      toast.error('No se pudo iniciar sesión', { description })
    }
  }

  return (
    <div className="relative min-h-screen bg-[#06060f] text-white overflow-hidden flex items-center justify-center">
      <AuroraBackground />

      {/* Back to home */}
      <div className="fixed top-6 left-6 z-50">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>
      </div>

      {/* Content above canvas */}
      <div className="relative w-full max-w-md px-6 py-12" style={{ zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* Card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-600">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Capital 21 Play</p>
                <p className="text-[11px] text-white/40 mt-0.5">Medios Públicos · CDMX</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7 space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Bienvenido</h1>
              <p className="text-sm text-white/45">
                Ingresa tus credenciales para acceder a la plataforma.
              </p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/60 text-xs font-medium">
                        Correo electrónico
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="usuario@capital21.mx"
                          autoComplete="email"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-purple-500/40 focus-visible:border-white/20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/60 text-xs font-medium">
                        Contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-purple-500/40 focus-visible:border-white/20 pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-900/30 font-medium"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </Button>
              </form>
            </Form>

            {/* Footer note */}
            <p className="mt-6 text-center text-[11px] text-white/25 leading-relaxed">
              Acceso restringido a personal autorizado.
              <br />
              Contacta al administrador para obtener credenciales.
            </p>
          </div>

          {/* Bottom meta */}
          <p className="mt-6 text-center text-[11px] text-white/20">
            © {new Date().getFullYear()} Gobierno de la Ciudad de México
          </p>
        </motion.div>
      </div>
    </div>
  )
}
