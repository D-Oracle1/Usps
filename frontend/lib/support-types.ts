export interface SupportUser {
  id: string
  name: string
  email: string
  phone?: string
  isOnline?: boolean
  lastSeenAt?: string
}

export interface Conversation {
  id: string
  supportUserId: string
  trackingNumber?: string
  subject?: string
  status: ConversationStatus
  priority: ConversationPriority
  assignedAdminId?: string
  lastMessageAt?: string
  createdAt: string
  updatedAt: string
  supportUser?: SupportUser
  assignedAdmin?: { id: string; name: string }
  messages?: Message[]
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  messageType: MessageType
  isRead: boolean
  readAt?: string
  createdAt: string
}

export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type ConversationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type SenderType = 'USER' | 'ADMIN' | 'SYSTEM'
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'

export interface ChatStatistics {
  total: number
  open: number
  pending: number
  resolved: number
  closed: number
  unreadMessages: number
}
