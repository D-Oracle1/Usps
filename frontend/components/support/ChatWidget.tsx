'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, X, Minimize2, Maximize2, LogOut } from 'lucide-react'
import { useSupportAuth } from '@/lib/support-auth-context'
import { useAuth } from '@/lib/auth-context'
import { getSupportSocket } from '@/lib/support-socket'
import ChatAuthModal from './ChatAuthModal'
import ChatWindow from './ChatWindow'

export default function ChatWidget() {
  const { user, logout, isLoading, token, autoLinkFromMainAuth } = useSupportAuth()
  const { user: mainUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isAutoLinking, setIsAutoLinking] = useState(false)
  const hasAttemptedAutoLink = useRef(false)

  // Auto-link support account when main user is logged in but support is not
  useEffect(() => {
    const tryAutoLink = async () => {
      // Only try once per session and when conditions are right
      if (
        hasAttemptedAutoLink.current ||
        isLoading ||
        user ||
        !mainUser ||
        isAutoLinking
      ) {
        return
      }

      hasAttemptedAutoLink.current = true
      setIsAutoLinking(true)
      await autoLinkFromMainAuth()
      setIsAutoLinking(false)
    }

    tryAutoLink()
  }, [mainUser, user, isLoading, isAutoLinking, autoLinkFromMainAuth])

  // Reset unread when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0)
    }
  }, [isOpen, isMinimized])

  // Listen for new messages via WebSocket when user is logged in but chat is closed
  useEffect(() => {
    if (!token || !user) return

    const socket = getSupportSocket(token)

    const handleNewMessage = (message: any) => {
      // Only count messages from admin when chat is closed or minimized
      if (message.senderType === 'ADMIN' && (!isOpen || isMinimized)) {
        setUnreadCount(prev => prev + 1)
      }
    }

    socket.on('newMessage', handleNewMessage)

    return () => {
      socket.off('newMessage', handleNewMessage)
    }
  }, [token, user, isOpen, isMinimized])

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      // If main user is logged in, try auto-linking first
      if (mainUser && !hasAttemptedAutoLink.current) {
        setIsAutoLinking(true)
        hasAttemptedAutoLink.current = true
        const success = await autoLinkFromMainAuth()
        setIsAutoLinking(false)
        if (success) {
          setIsOpen(true)
          return
        }
      }
      setShowAuthModal(true)
    } else {
      setIsOpen(!isOpen)
    }
  }

  const handleLogout = () => {
    logout()
    setIsOpen(false)
  }

  // Don't render during initial load
  if (isLoading || isAutoLinking) {
    return null
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#333366] text-white rounded-full shadow-lg hover:bg-[#1a1a4e] hover:scale-105 transition-all flex items-center justify-center z-[9999] group"
          aria-label="Open support chat"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#cc0000] rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Need help?
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && user && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-200 ${
            isMinimized ? 'w-72' : 'w-96'
          }`}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-[#333366] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#333366] rounded-full" />
                </div>
                <div className="ml-3">
                  <span className="text-white font-semibold text-sm">USPS Support</span>
                  <p className="text-white/60 text-xs">We typically reply instantly</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* User info bar */}
            {!isMinimized && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Signed in as <span className="font-medium">{user.name}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center text-xs text-gray-500 hover:text-[#cc0000] transition-colors"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Sign out
                </button>
              </div>
            )}

            {/* Chat Content */}
            {!isMinimized && <ChatWindow />}

            {/* Minimized state */}
            {isMinimized && (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-600">Chat minimized</p>
                <button
                  onClick={() => setIsMinimized(false)}
                  className="mt-2 text-sm text-[#333366] hover:underline"
                >
                  Click to expand
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <ChatAuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false)
            setIsOpen(true)
          }}
        />
      )}
    </>
  )
}
