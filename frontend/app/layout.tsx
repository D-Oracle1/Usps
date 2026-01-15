import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { AuthProvider } from '@/lib/auth-context'
import { SupportAuthProvider } from '@/lib/support-auth-context'
import ChatWidget from '@/components/support/ChatWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Courier Tracking System - Admin Portal',
  description: 'Real-time shipment tracking and management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SupportAuthProvider>
            {children}
            <ChatWidget />
          </SupportAuthProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
