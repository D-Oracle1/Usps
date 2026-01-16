'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, BarChart3, LogOut, Menu, X, Home, Plus, Truck, Search, Bell, User, ChevronDown, MapPin, MessageCircle } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { getSupportSocket } from '@/lib/support-socket'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Create Shipment', href: '/dashboard/shipments/new', icon: Plus },
  { name: 'Support Chat', href: '/dashboard/support', icon: MessageCircle },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, token } = useAuth()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/support/admin/statistics')
      setUnreadCount(response.data.unreadMessages || 0)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }, [])

  // Load unread count on mount and set up WebSocket for real-time updates
  useEffect(() => {
    fetchUnreadCount()

    // Set up interval to refresh count periodically
    const interval = setInterval(fetchUnreadCount, 30000)

    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Listen to WebSocket for real-time notification updates
  useEffect(() => {
    if (!token) return

    const socket = getSupportSocket(token)

    const handleNewMessage = () => {
      // Refresh unread count when new message arrives
      fetchUnreadCount()
    }

    const handleConversationUpdated = () => {
      fetchUnreadCount()
    }

    socket.on('newMessage', handleNewMessage)
    socket.on('conversationUpdated', handleConversationUpdated)

    return () => {
      socket.off('newMessage', handleNewMessage)
      socket.off('conversationUpdated', handleConversationUpdated)
    }
  }, [token, fetchUnreadCount])

  // Reset unread count when on support page
  useEffect(() => {
    if (pathname === '/dashboard/support') {
      // Delay slightly to let the page mark messages as read
      const timeout = setTimeout(fetchUnreadCount, 1000)
      return () => clearTimeout(timeout)
    }
  }, [pathname, fetchUnreadCount])

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* USPS Top Header Bar */}
      <div className="bg-[#333366] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-8 text-xs">
            <div className="flex items-center space-x-4">
              <span>USPS Admin Portal</span>
              <span className="text-gray-300">|</span>
              <Link href="/track" className="hover:underline">Public Tracking</Link>
            </div>
            <div className="flex items-center space-x-4">
              <span>English</span>
              <span className="text-gray-300">|</span>
              <button onClick={logout} className="hover:underline flex items-center">
                <LogOut className="w-3 h-3 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <div className="flex items-center">
                  <div className="bg-[#333366] p-2 rounded">
                    <Truck className="w-8 h-8 text-white" />
                  </div>
                  <div className="ml-3">
                    <div className="text-xl font-bold text-[#333366]">USPS</div>
                    <div className="text-xs text-gray-500 -mt-1">Admin Dashboard</div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const showBadge = item.name === 'Support Chat' && unreadCount > 0
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex items-center px-4 py-2 text-sm font-medium rounded transition-colors ${
                      isActive
                        ? 'bg-[#333366] text-white'
                        : 'text-[#333366] hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-[#cc0000] text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden lg:flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tracking #"
                    className="pl-10 pr-4 py-2 w-48 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#333366]"
                  />
                </div>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#333366] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <p className="text-xs text-[#cc0000] font-medium mt-1">{user?.role}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const showBadge = item.name === 'Support Chat' && unreadCount > 0
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative flex items-center px-4 py-3 text-sm font-medium rounded ${
                      isActive
                        ? 'bg-[#333366] text-white'
                        : 'text-[#333366] hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                    {showBadge && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-[#cc0000] text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumb / Page Title Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center text-sm text-gray-500">
            <Link href="/dashboard" className="hover:text-[#333366]">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-[#333366] font-medium">
              {pathname === '/dashboard' && 'Dashboard'}
              {pathname === '/dashboard/analytics' && 'Analytics'}
              {pathname === '/dashboard/support' && 'Support Chat'}
              {pathname === '/dashboard/shipments/new' && 'Create Shipment'}
              {pathname.includes('/dashboard/shipments/') && !pathname.includes('/new') && !pathname.includes('/map') && 'Shipment Details'}
              {pathname.includes('/map') && 'Live Tracking'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#333366] text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                <li><Link href="/dashboard/shipments/new" className="hover:text-white">Create Shipment</Link></li>
                <li><Link href="/dashboard/analytics" className="hover:text-white">Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">FAQs</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Use</a></li>
                <li><a href="#" className="hover:text-white">Accessibility</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contact</h3>
              <p className="text-sm text-gray-300">
                1-800-ASK-USPS<br />
                (1-800-275-8777)
              </p>
            </div>
          </div>
          <div className="border-t border-gray-500 mt-8 pt-6 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} United States Postal Service. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  )
}
