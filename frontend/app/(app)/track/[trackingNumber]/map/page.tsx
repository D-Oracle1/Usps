'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { ArrowLeft, MapPin, Truck, Clock, Navigation, Package, CheckCircle, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
)

export default function PublicTrackingMapPage() {
  const params = useParams()
  const router = useRouter()
  const trackingNumber = params.trackingNumber as string

  const socket = useRef<Socket | null>(null)
  const animationRef = useRef<number | null>(null)
  const targetPositionRef = useRef<[number, number]>([39.8283, -98.5795])

  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [position, setPosition] = useState<[number, number]>([39.8283, -98.5795])
  const [animatedPosition, setAnimatedPosition] = useState<[number, number]>([39.8283, -98.5795])
  const [originPosition, setOriginPosition] = useState<[number, number] | null>(null)
  const [destPosition, setDestPosition] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [isMoving, setIsMoving] = useState(false)
  const [speed, setSpeed] = useState(0)
  const [progress, setProgress] = useState(0)
  const [mapReady, setMapReady] = useState(false)

  // Smooth position interpolation with improved stability
  const animateToPosition = useCallback((targetLat: number, targetLng: number) => {
    targetPositionRef.current = [targetLat, targetLng]

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    let lastTime = performance.now()

    const animate = (currentTime: number) => {
      // Throttle to ~30fps for stability
      const deltaTime = currentTime - lastTime
      if (deltaTime < 33) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastTime = currentTime

      setAnimatedPosition(current => {
        const [currentLat, currentLng] = current
        const [tLat, tLng] = targetPositionRef.current

        const diffLat = tLat - currentLat
        const diffLng = tLng - currentLng

        // Use smaller factor for smoother, more stable animation
        const factor = 0.08

        // Check if we're close enough to snap to target
        if (Math.abs(diffLat) < 0.00001 && Math.abs(diffLng) < 0.00001) {
          return [tLat, tLng]
        }

        return [
          currentLat + diffLat * factor,
          currentLng + diffLng * factor
        ]
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [])

  // Load shipment data
  useEffect(() => {
    const loadShipment = async () => {
      try {
        const response = await api.get(`/tracking/public/${trackingNumber}`)
        const { shipment: shipmentData, events: eventsData } = response.data

        setShipment(shipmentData)
        setEvents(eventsData)
        setIsMoving(shipmentData.movementState?.isMoving ?? false)

        // Try to get route info
        try {
          // Use a simulated route based on locations
          const originCoords = getCityCoordinates(shipmentData.originLocation)
          const destCoords = getCityCoordinates(shipmentData.destinationLocation)

          setOriginPosition([originCoords.lat, originCoords.lng])
          setDestPosition([destCoords.lat, destCoords.lng])

          // Generate a simple route
          const routePoints: Array<[number, number]> = []
          for (let i = 0; i <= 10; i++) {
            const t = i / 10
            routePoints.push([
              originCoords.lat + (destCoords.lat - originCoords.lat) * t,
              originCoords.lng + (destCoords.lng - originCoords.lng) * t
            ])
          }
          setRoute(routePoints)

          // Set initial position
          if (shipmentData.currentLocation && shipmentData.currentLocation.includes(',')) {
            const [lat, lng] = shipmentData.currentLocation.split(',').map(Number)
            setPosition([lat, lng])
            setAnimatedPosition([lat, lng])
          } else {
            setPosition([originCoords.lat, originCoords.lng])
            setAnimatedPosition([originCoords.lat, originCoords.lng])
          }
        } catch (err) {
          console.error('Failed to load route:', err)
        }

        setMapReady(true)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Shipment not found')
      } finally {
        setIsLoading(false)
      }
    }

    loadShipment()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [trackingNumber])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!shipment) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000'

    socket.current = io(`${wsUrl}/tracking`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.current.on('connect', () => {
      socket.current?.emit('joinShipment', { shipmentId: shipment.id })
    })

    socket.current.on('joinedShipment', (data) => {
      setIsMoving(data.isMoving)
      if (data.currentLocation) {
        const lat = data.currentLocation.latitude
        const lng = data.currentLocation.longitude
        setPosition([lat, lng])
        animateToPosition(lat, lng)
      }
    })

    socket.current.on('locationUpdate', (data) => {
      const lat = data.latitude
      const lng = data.longitude
      animateToPosition(lat, lng)
      setPosition([lat, lng])
      if (data.speed) setSpeed(data.speed)
      if (data.progress) setProgress(data.progress.percentComplete)
    })

    socket.current.on('shipmentPaused', () => setIsMoving(false))
    socket.current.on('shipmentResumed', () => setIsMoving(true))
    socket.current.on('shipmentDelivered', () => {
      setIsMoving(false)
      setShipment(prev => prev ? { ...prev, currentStatus: 'DELIVERED' } : null)
    })

    return () => {
      socket.current?.emit('leaveShipment', { shipmentId: shipment.id })
      socket.current?.disconnect()
    }
  }, [shipment, animateToPosition])

  // Helper to get city coordinates
  const getCityCoordinates = (location: string): { lat: number; lng: number } => {
    const cities: Record<string, { lat: number; lng: number }> = {
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 },
      'san antonio': { lat: 29.4241, lng: -98.4936 },
      'san diego': { lat: 32.7157, lng: -117.1611 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'austin': { lat: 30.2672, lng: -97.7431 },
      'san francisco': { lat: 37.7749, lng: -122.4194 },
      'seattle': { lat: 47.6062, lng: -122.3321 },
      'denver': { lat: 39.7392, lng: -104.9903 },
      'boston': { lat: 42.3601, lng: -71.0589 },
      'miami': { lat: 25.7617, lng: -80.1918 },
      'atlanta': { lat: 33.7490, lng: -84.3880 },
    }

    const normalized = location.toLowerCase()
    for (const [city, coords] of Object.entries(cities)) {
      if (normalized.includes(city)) {
        return coords
      }
    }
    return { lat: 39.8283, lng: -98.5795 }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      IN_TRANSIT: 'bg-blue-100 text-blue-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // Map content component
  const MapContent = useCallback(() => {
    const [L, setL] = useState<any>(null)
    const [truckIcon, setTruckIcon] = useState<any>(null)
    const [originIcon, setOriginIcon] = useState<any>(null)
    const [destIcon, setDestIcon] = useState<any>(null)
    const [MapHook, setMapHook] = useState<any>(null)

    useEffect(() => {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default)

        setTruckIcon(leaflet.default.divIcon({
          className: 'truck-marker',
          html: `
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#333366 0%,#1a1a4e 100%);border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }))

        setOriginIcon(leaflet.default.divIcon({
          className: 'origin-marker',
          html: `<div style="width:28px;height:28px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }))

        setDestIcon(leaflet.default.divIcon({
          className: 'dest-marker',
          html: `<div style="width:28px;height:28px;background:#cc0000;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }))
      })

      import('react-leaflet').then((mod) => {
        setMapHook(() => mod.useMap)
      })
    }, [])

    function MapController() {
      const map = MapHook ? MapHook() : null
      useEffect(() => {
        if (map && animatedPosition) {
          map.panTo(animatedPosition, { animate: true, duration: 0.5 })
        }
      }, [map])
      return null
    }

    if (!L || !truckIcon) {
      return <div className="h-full flex items-center justify-center bg-gray-100">Loading map...</div>
    }

    return (
      <>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 0 && (
          <Polyline positions={route} color="#333366" weight={4} opacity={0.6} dashArray="10, 10" />
        )}
        {originPosition && <Marker position={originPosition} icon={originIcon} />}
        {destPosition && <Marker position={destPosition} icon={destIcon} />}
        <Marker position={animatedPosition} icon={truckIcon} />
        {isMoving && (
          <Circle center={animatedPosition} radius={500} pathOptions={{ color: '#333366', fillColor: '#333366', fillOpacity: 0.1, weight: 2 }} />
        )}
        {MapHook && <MapController />}
      </>
    )
  }, [animatedPosition, route, originPosition, destPosition, isMoving])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading tracking information...</div>
      </div>
    )
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Shipment Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'Unable to find tracking information'}</p>
          <Link href="/track" className="text-[#333366] hover:underline">
            Back to Tracking
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#333366] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/track`} className="p-2 hover:bg-white/10 rounded transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Live Tracking</h1>
                <p className="text-sm text-gray-300">{trackingNumber}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(shipment.currentStatus)}`}>
              {shipment.currentStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="h-[60vh] relative">
        {mapReady && (
          <MapContainer
            center={position}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapContent />
          </MapContainer>
        )}

        {/* Status Overlay */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] min-w-[180px]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              shipment.currentStatus === 'DELIVERED' ? 'bg-green-500' :
              isMoving ? 'bg-green-500 animate-pulse' : 'bg-blue-500'
            }`} />
            <span className="font-medium text-gray-900">
              {shipment.currentStatus === 'DELIVERED' ? 'Delivered' :
               shipment.currentStatus === 'PENDING' ? 'Pending Pickup' :
               isMoving ? 'In Transit' : 'Processing'}
            </span>
          </div>
          {isMoving && speed > 0 && (
            <div className="flex items-center text-sm text-gray-600">
              <Navigation className="w-4 h-4 mr-1" />
              {Math.round(speed)} km/h
            </div>
          )}
          {progress > 0 && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Progress</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-[#333366] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500" /> Origin
              </div>
              <div className="font-medium text-gray-900">{shipment.originLocation}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Tracking Number</div>
              <div className="font-mono font-bold text-[#333366]">{shipment.trackingNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 flex items-center justify-end gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Destination
              </div>
              <div className="font-medium text-gray-900">{shipment.destinationLocation}</div>
            </div>
          </div>

          {/* Recent Events */}
          {events.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Updates</h3>
              <div className="space-y-3">
                {events.slice(0, 3).map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{event.status.replace('_', ' ')}</div>
                      <div className="text-xs text-gray-500">{event.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
