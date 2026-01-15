'use client'

import { Check, CheckCheck } from 'lucide-react'
import { Message } from '@/lib/support-types'

interface Props {
  message: Message
  isOwn: boolean
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MessageBubble({ message, isOwn }: Props) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl shadow-sm ${
          isOwn
            ? 'bg-[#333366] text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div
          className={`flex items-center justify-end mt-1.5 space-x-1 ${
            isOwn ? 'text-white/60' : 'text-gray-400'
          }`}
        >
          <span className="text-xs">{formatTime(message.createdAt)}</span>
          {isOwn && (
            message.isRead
              ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
              : <Check className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  )
}
