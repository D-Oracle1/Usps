import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let currentToken: string | null = null

export function getSupportSocket(token: string): Socket {
  // If token changed or socket doesn't exist/disconnected, create new connection
  if (!socket || !socket.connected || currentToken !== token) {
    // Disconnect existing socket if token changed
    if (socket && currentToken !== token) {
      socket.disconnect()
      socket = null
    }

    currentToken = token
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    socket = io(`${wsUrl}/support`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    })

    socket.on('connect', () => {
      console.log('Support socket connected, id:', socket?.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('Support socket disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('Support socket connection error:', error.message)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('Support socket reconnected after', attemptNumber, 'attempts')
    })
  }

  return socket
}

export function disconnectSupportSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    currentToken = null
  }
}

export function isSupportSocketConnected(): boolean {
  return socket?.connected ?? false
}

export function getSupportSocketInstance(): Socket | null {
  return socket
}
