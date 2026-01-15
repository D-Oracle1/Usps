import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { SupportAuthProvider } from '@/lib/support-auth-context'
import ChatWidget from '@/components/support/ChatWidget'
import '../globals.css'
import 'leaflet/dist/leaflet.css'

const inter = Inter({ subsets: ['latin'] })

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={inter.className}>
      <AuthProvider>
        <SupportAuthProvider>
          {children}
          <ChatWidget />
        </SupportAuthProvider>
      </AuthProvider>
    </div>
  )
}
