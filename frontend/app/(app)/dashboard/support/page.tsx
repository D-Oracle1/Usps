'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Circle,
  CheckCheck,
  Check,
  Send,
  Package,
  User,
  MessageSquare,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getSupportSocket, disconnectSupportSocket } from '@/lib/support-socket'
import { Conversation, Message, ChatStatistics } from '@/lib/support-types'
import api from '@/lib/api'

function formatTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AdminSupportPage() {
  const { token, user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isTyping, setIsTyping] = useState(false)
  const [statistics, setStatistics] = useState<ChatStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null)
  const activeConversationRef = useRef<string | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    activeConversationRef.current = activeConversation?.id || null
  }, [activeConversation])

  // Load initial data
  useEffect(() => {
    loadConversations()
    loadStatistics()
  }, [])

  // Setup WebSocket - separate effect to avoid stale closures
  useEffect(() => {
    if (!token) return

    const socket = getSupportSocket(token)

    const handleConnect = () => {
      setIsConnected(true)
      // Rejoin conversation room if we have one
      if (activeConversationRef.current) {
        socket.emit('joinConversation', { conversationId: activeConversationRef.current })
      }
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    const handleNewMessage = (message: Message) => {
      // Update messages if in active conversation
      if (activeConversationRef.current && message.conversationId === activeConversationRef.current) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev
          }
          return [...prev, message]
        })
      }
      // Refresh conversation list
      loadConversations()
      loadStatistics()
    }

    const handleUserTyping = (data: { conversationId: string; isTyping: boolean; userType: string }) => {
      if (activeConversationRef.current === data.conversationId && data.userType !== 'admin') {
        setIsTyping(data.isTyping)
      }
    }

    const handleMessagesRead = (data: { conversationId: string; readByType: string }) => {
      if (activeConversationRef.current === data.conversationId && data.readByType === 'support_user') {
        setMessages(prev => prev.map(m =>
          m.senderType === 'ADMIN' ? { ...m, isRead: true } : m
        ))
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('newMessage', handleNewMessage)
    socket.on('userTyping', handleUserTyping)
    socket.on('messagesRead', handleMessagesRead)
    socket.on('userOnline', () => loadConversations())
    socket.on('userOffline', () => loadConversations())
    socket.on('conversationUpdated', () => loadConversations())

    if (socket.connected) {
      setIsConnected(true)
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('newMessage', handleNewMessage)
      socket.off('userTyping', handleUserTyping)
      socket.off('messagesRead', handleMessagesRead)
      socket.off('userOnline')
      socket.off('userOffline')
      socket.off('conversationUpdated')
    }
  }, [token])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const response = await api.get('/support/admin/conversations')
      setConversations(response.data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await api.get('/support/admin/statistics')
      setStatistics(response.data)
    } catch (error) {
      console.error('Failed to load statistics:', error)
    }
  }

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv)
    setIsTyping(false)

    try {
      const response = await api.get(`/support/admin/conversations/${conv.id}/messages`)
      setMessages(response.data.messages || [])

      // Join WebSocket room and mark as read
      if (token) {
        const socket = getSupportSocket(token)
        socket.emit('joinConversation', { conversationId: conv.id })
        socket.emit('markAsRead', { conversationId: conv.id })
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !activeConversation || !token || isSending) return

    const messageContent = newMessage.trim()
    setNewMessage('')
    setIsSending(true)

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversation.id,
      senderId: user?.id || '',
      senderType: 'ADMIN',
      content: messageContent,
      messageType: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    }

    // Add optimistic message to UI immediately
    setMessages(prev => [...prev, optimisticMessage])

    try {
      // Send via REST API for reliability
      const response = await api.post(`/support/admin/conversations/${activeConversation.id}/messages`, {
        content: messageContent,
      })

      // Replace optimistic message with real one
      setMessages(prev => prev.map(m =>
        m.id === optimisticMessage.id ? response.data : m
      ))

      // Also emit via WebSocket for real-time sync to user
      const socket = getSupportSocket(token)
      socket.emit('typing', { conversationId: activeConversation.id, isTyping: false })

      // Refresh conversation list
      loadConversations()
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      // Restore the message to input
      setNewMessage(messageContent)
    } finally {
      setIsSending(false)
    }
  }, [newMessage, activeConversation, token, user, isSending])

  const handleTyping = useCallback(() => {
    if (!activeConversation || !token) return

    const socket = getSupportSocket(token)
    socket.emit('typing', { conversationId: activeConversation.id, isTyping: true })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId: activeConversation.id, isTyping: false })
    }, 2000)
  }, [activeConversation, token])

  const updateStatus = async (status: string) => {
    if (!activeConversation) return
    try {
      await api.patch(`/support/admin/conversations/${activeConversation.id}/status`, { status })
      loadConversations()
      setActiveConversation(prev => prev ? { ...prev, status: status as any } : null)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const matchesSearch =
      c.supportUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.supportUser?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-700 border-green-200'
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'RESOLVED': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'CLOSED': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#333366] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] flex bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        {/* Header with connection status */}
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={() => {
              loadConversations()
              loadStatistics()
            }}
            className="p-1.5 text-gray-500 hover:text-[#333366] hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#333366] to-[#1a1a4e]">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white/10 rounded-lg p-2">
                <div className="font-bold text-white text-lg">{statistics.total}</div>
                <div className="text-white/70 text-xs">Total</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <div className="font-bold text-green-300 text-lg">{statistics.open}</div>
                <div className="text-white/70 text-xs">Open</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <div className="font-bold text-yellow-300 text-lg">{statistics.pending}</div>
                <div className="text-white/70 text-xs">Pending</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <div className="font-bold text-blue-300 text-lg">{statistics.resolved}</div>
                <div className="text-white/70 text-xs">Resolved</div>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  activeConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-[#333366]' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <div className="relative">
                      <div className="w-10 h-10 bg-[#333366] rounded-full flex items-center justify-center text-white font-semibold">
                        {conv.supportUser?.name?.charAt(0) || '?'}
                      </div>
                      <Circle
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full ${
                          conv.supportUser?.isOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'
                        }`}
                      />
                    </div>
                    <div className="ml-3">
                      <div className="font-semibold text-sm text-gray-900 truncate max-w-[120px]">
                        {conv.supportUser?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[120px]">
                        {conv.supportUser?.email}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(conv.status)}`}>
                    {conv.status}
                  </span>
                </div>

                {conv.trackingNumber && (
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <Package className="w-3 h-3 mr-1" />
                    {conv.trackingNumber}
                  </div>
                )}

                {conv.messages?.[0] && (
                  <p className="text-sm text-gray-600 truncate mb-2">
                    {conv.messages[0].senderType === 'ADMIN' && <span className="text-gray-400">You: </span>}
                    {conv.messages[0].content}
                  </p>
                )}

                <div className="flex items-center text-xs text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(conv.lastMessageAt || conv.createdAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-11 h-11 bg-[#333366] rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {activeConversation.supportUser?.name?.charAt(0) || '?'}
                  </div>
                  <Circle
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full ${
                      activeConversation.supportUser?.isOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'
                    }`}
                  />
                </div>
                <div className="ml-3">
                  <div className="font-semibold text-gray-900">
                    {activeConversation.supportUser?.name}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center">
                    {activeConversation.supportUser?.isOnline ? (
                      <><Circle className="w-2 h-2 mr-1.5 text-green-500 fill-green-500" /> Online</>
                    ) : (
                      <><Circle className="w-2 h-2 mr-1.5 text-gray-400 fill-gray-400" /> Offline</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {activeConversation.trackingNumber && (
                  <span className="flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    <Package className="w-4 h-4 mr-1.5" />
                    {activeConversation.trackingNumber}
                  </span>
                )}
                <select
                  value={activeConversation.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#333366] ${getStatusColor(activeConversation.status)}`}
                >
                  <option value="OPEN">Open</option>
                  <option value="PENDING">Pending</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${
                        msg.senderType === 'ADMIN'
                          ? 'bg-[#333366] text-white rounded-br-md'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className={`flex items-center justify-end mt-1.5 space-x-1 text-xs ${
                        msg.senderType === 'ADMIN' ? 'text-white/60' : 'text-gray-400'
                      }`}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {msg.senderType === 'ADMIN' && (
                          msg.isRead
                            ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                            : <Check className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type your reply..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className="p-3 bg-[#333366] text-white rounded-full hover:bg-[#1a1a4e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a conversation</h3>
              <p className="text-gray-500 text-sm">Choose a customer from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
