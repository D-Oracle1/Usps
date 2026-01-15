'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Package, Plus, ArrowLeft } from 'lucide-react'
import { useSupportAuth } from '@/lib/support-auth-context'
import { getSupportSocket, disconnectSupportSocket } from '@/lib/support-socket'
import { Conversation, Message } from '@/lib/support-types'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import api from '@/lib/api'

export default function ChatWindow() {
  const { user, token } = useSupportAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null)

  // Load conversations on mount
  useEffect(() => {
    if (token) {
      loadConversations()
    }
  }, [token])

  // Setup WebSocket
  useEffect(() => {
    if (!token) return

    const socket = getSupportSocket(token)

    socket.on('newMessage', (message: Message) => {
      if (activeConversation && message.conversationId === activeConversation.id) {
        setMessages(prev => [...prev, message])
      }
      // Refresh conversations list
      loadConversations()
    })

    socket.on('userTyping', (data: { isTyping: boolean; userType: string }) => {
      if (data.userType === 'ADMIN' || data.userType === 'admin') {
        setIsTyping(data.isTyping)
      }
    })

    socket.on('messagesRead', () => {
      setMessages(prev => prev.map(m => ({ ...m, isRead: true })))
    })

    return () => {
      disconnectSupportSocket()
    }
  }, [token, activeConversation])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const response = await api.get('/support/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setConversations(response.data)

      // If no active conversation and there are conversations, open the first one
      if (response.data.length > 0 && !activeConversation) {
        selectConversation(response.data[0])
      } else if (response.data.length === 0) {
        setShowNewChat(true)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv)
    setShowNewChat(false)

    try {
      const response = await api.get(`/support/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setMessages(response.data.messages || [])

      // Join WebSocket room
      const socket = getSupportSocket(token!)
      socket.emit('joinConversation', { conversationId: conv.id })
      socket.emit('markAsRead', { conversationId: conv.id })
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const handleSend = useCallback(() => {
    if (!newMessage.trim() || !activeConversation || !token) return

    const socket = getSupportSocket(token)
    socket.emit('sendMessage', {
      conversationId: activeConversation.id,
      content: newMessage.trim(),
    })

    setNewMessage('')

    // Clear typing indicator
    socket.emit('typing', { conversationId: activeConversation.id, isTyping: false })
  }, [newMessage, activeConversation, token])

  const handleTyping = useCallback(() => {
    if (!activeConversation || !token) return

    const socket = getSupportSocket(token)
    socket.emit('typing', { conversationId: activeConversation.id, isTyping: true })

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId: activeConversation.id, isTyping: false })
    }, 2000)
  }, [activeConversation, token])

  const startNewConversation = async () => {
    if (!newMessage.trim() || !token) return

    try {
      const response = await api.post(
        '/support/conversations',
        {
          trackingNumber: trackingNumber || undefined,
          initialMessage: newMessage.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setConversations(prev => [response.data, ...prev])
      selectConversation(response.data)
      setNewMessage('')
      setTrackingNumber('')
      setShowNewChat(false)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#333366] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // New chat form
  if (showNewChat || conversations.length === 0) {
    return (
      <div className="h-96 flex flex-col">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {conversations.length > 0 && (
            <button
              onClick={() => setShowNewChat(false)}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to conversations
            </button>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Start a conversation</h3>
            <p className="text-sm text-gray-500 mb-4">
              Hi {user?.name}! How can we help you today?
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Tracking Number <span className="text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="USPS123456789"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Your Message
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              className="w-full h-28 px-3 py-2.5 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
            />
          </div>

          <button
            onClick={startNewConversation}
            disabled={!newMessage.trim()}
            className="w-full py-2.5 bg-[#333366] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1a4e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Chat
          </button>
        </div>
      </div>
    )
  }

  // Chat view
  return (
    <div className="h-96 flex flex-col">
      {/* Conversation selector (if multiple) */}
      {conversations.length > 1 && (
        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <select
            value={activeConversation?.id || ''}
            onChange={(e) => {
              const conv = conversations.find(c => c.id === e.target.value)
              if (conv) selectConversation(conv)
            }}
            className="flex-1 text-sm bg-transparent border-none focus:outline-none cursor-pointer"
          >
            {conversations.map(conv => (
              <option key={conv.id} value={conv.id}>
                {conv.trackingNumber ? `#${conv.trackingNumber}` : `Chat ${conv.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-1.5 text-gray-500 hover:text-[#333366] hover:bg-gray-200 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderType === 'USER'}
            />
          ))
        )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              handleTyping()
            }}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="p-2.5 bg-[#333366] text-white rounded-full hover:bg-[#1a1a4e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
