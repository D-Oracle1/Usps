'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { SupportAuthProvider } from '@/lib/support-auth-context'
import UserLayout from '@/components/user-layout'
import ChatWidget from '@/components/support/ChatWidget'
import '../globals.css'
import 'leaflet/dist/leaflet.css'

function UserLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
    // Redirect admins to admin dashboard
    if (!isLoading && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return null
  }

  return <UserLayout>{children}</UserLayout>
}

export default function UserRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SupportAuthProvider>
        <UserLayoutContent>{children}</UserLayoutContent>
        <ChatWidget />
      </SupportAuthProvider>
    </AuthProvider>
  )
}
