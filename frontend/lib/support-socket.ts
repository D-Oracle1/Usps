import Pusher, { Channel } from 'pusher-js'

let pusherInstance: Pusher | null = null

function getPusherInstance(): Pusher {
  if (!pusherInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2'

    pusherInstance = new Pusher(key, {
      cluster,
      forceTLS: true,
    })

    pusherInstance.connection.bind('connected', () => {
      console.log('Pusher connected')
    })

    pusherInstance.connection.bind('disconnected', () => {
      console.log('Pusher disconnected')
    })

    pusherInstance.connection.bind('error', (error: any) => {
      console.error('Pusher connection error:', error)
    })
  }

  return pusherInstance
}

export function subscribeToChannel(channelName: string): Channel {
  return getPusherInstance().subscribe(channelName)
}

export function unsubscribeFromChannel(channelName: string): void {
  getPusherInstance().unsubscribe(channelName)
}

export function getPusher(): Pusher {
  return getPusherInstance()
}

export function isPusherConnected(): boolean {
  return pusherInstance?.connection.state === 'connected'
}

export function disconnectPusher(): void {
  if (pusherInstance) {
    pusherInstance.disconnect()
    pusherInstance = null
  }
}

// Legacy alias kept so any direct callers of getSupportSocket(token)
// get a channel object for the admin-broadcast channel instead.
// All components should migrate to subscribeToChannel() directly.
export function getSupportChannel(): Channel {
  return subscribeToChannel('admin-broadcast')
}
