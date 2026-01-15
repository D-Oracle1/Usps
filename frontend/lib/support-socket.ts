import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSupportSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    socket = io(`${wsUrl}/support`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('Support socket connected')
    })

    socket.on('disconnect', () => {
      console.log('Support socket disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Support socket connection error:', error.message)
    })
  }

  return socket
}

export function disconnectSupportSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function isSupportSocketConnected(): boolean {
  return socket?.connected ?? false
}
