'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) return
    if (user.role === 'ADMIN') router.replace('/dashboard/admin')
    else if (user.role === 'CONTENT_MANAGER') router.replace('/dashboard/content')
    else if (user.role === 'BROADCASTER_VIEWER') router.replace('/dashboard/viewer')
  }, [user, router])

  return null
}
