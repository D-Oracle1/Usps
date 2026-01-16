'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { ArrowLeft, MapPin, Truck, Clock, Navigation, Package, CheckCircle, AlertCircle, AlertTriangle, ShieldCheck, User, Phone, Mail, FileText, Scale, DollarSign, Ruler, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
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

  // Interception state
  const [isIntercepted, setIsIntercepted] = useState(false)
  const [interceptReason, setInterceptReason] = useState<string | null>(null)
  const [interceptedAt, setInterceptedAt] = useState<string | null>(null)
  const [clearReason, setClearReason] = useState<string | null>(null)

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
      setIsIntercepted(data.isIntercepted || false)
      setInterceptReason(data.interceptReason || null)
      setInterceptedAt(data.interceptedAt || null)
      setClearReason(data.clearReason || null)
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

    socket.current.on('shipmentIntercepted', (data) => {
      setIsMoving(false)
      setIsIntercepted(true)
      setInterceptReason(data.reason || 'Shipment intercepted')
      setInterceptedAt(data.timestamp || new Date().toISOString())
    })

    socket.current.on('shipmentCleared', (data) => {
      setIsMoving(true)
      setIsIntercepted(false)
      setClearReason(data.reason || 'Shipment cleared')
      setInterceptReason(null)
    })

    socket.current.on('shipmentPaused', () => setIsMoving(false))
    socket.current.on('shipmentResumed', () => setIsMoving(true))
    socket.current.on('shipmentDelivered', () => {
      setIsMoving(false)
      setIsIntercepted(false)
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
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              shipment.currentStatus === 'DELIVERED' ? 'bg-green-500' :
              isIntercepted ? 'bg-red-500 animate-pulse' :
              isMoving ? 'bg-green-500 animate-pulse' : 'bg-blue-500'
            }`} />
            <span className={`font-medium ${isIntercepted ? 'text-red-700' : 'text-gray-900'}`}>
              {shipment.currentStatus === 'DELIVERED' ? 'Delivered' :
               shipment.currentStatus === 'PENDING' ? 'Pending Pickup' :
               isIntercepted ? 'INTERCEPTED' :
               isMoving ? 'In Transit' : 'Processing'}
            </span>
          </div>
          {isMoving && speed > 0 && !isIntercepted && (
            <div className="flex items-center text-sm text-gray-600">
              <Navigation className="w-4 h-4 mr-1" />
              {Math.round(speed)} km/h
            </div>
          )}
          {progress > 0 && !isIntercepted && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Progress</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-[#333366] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Interception Alert Banner */}
        {isIntercepted && (
          <div className="absolute top-4 left-4 right-[240px] bg-red-600 text-white rounded-lg shadow-lg p-4 z-[1000]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-lg">Shipment Intercepted</h3>
                <p className="text-red-100 text-sm mt-1">
                  Your shipment has been temporarily held for inspection or verification.
                </p>
                {interceptReason && (
                  <div className="mt-2 p-2 bg-red-700/50 rounded">
                    <p className="text-xs text-red-200 font-medium">Reason:</p>
                    <p className="text-sm">{interceptReason}</p>
                  </div>
                )}
                <p className="text-xs text-red-200 mt-2">
                  Movement will resume once the goods are cleared.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Clear Notification (shows briefly when goods are cleared) */}
        {clearReason && !isIntercepted && isMoving && (
          <div className="absolute top-4 left-4 right-[240px] bg-emerald-600 text-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Shipment Cleared - Movement Resumed</p>
                <p className="text-emerald-100 text-xs">{clearReason}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Shipment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Route Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Truck className="w-5 h-5 mr-2 text-[#333366]" />
                Shipment Route
              </h3>
              <div className="flex items-stretch">
                {/* Origin */}
                <div className="flex-1 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-2">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-green-600">ORIGIN</span>
                  </div>
                  <p className="font-medium text-gray-900">{shipment.originLocation}</p>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-4">
                  <div className="w-8 h-0.5 bg-[#333366]"></div>
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent border-l-[#333366]"></div>
                </div>

                {/* Destination */}
                <div className="flex-1 p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-[#cc0000] rounded-full flex items-center justify-center mr-2">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-red-600">DESTINATION</span>
                  </div>
                  <p className="font-medium text-gray-900">{shipment.destinationLocation}</p>
                </div>
              </div>

              {/* Tracking Number */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">Tracking Number</div>
                <div className="font-mono font-bold text-lg text-[#333366]">{shipment.trackingNumber}</div>
              </div>
            </div>

            {/* Package Details */}
            {(shipment.goodsDescription || shipment.packageWeight || shipment.declaredValue) && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-[#333366]" />
                  Package Details
                </h3>

                {shipment.goodsDescription && (
                  <div className="flex items-start p-3 bg-gray-50 rounded-lg mb-3">
                    <FileText className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">CONTENTS</p>
                      <p className="text-gray-900">{shipment.goodsDescription}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {shipment.packageWeight && (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Scale className="w-4 h-4 text-gray-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Weight</p>
                        <p className="font-medium text-gray-900">{shipment.packageWeight} lbs</p>
                      </div>
                    </div>
                  )}
                  {shipment.packageDimensions && (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Ruler className="w-4 h-4 text-gray-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Dimensions</p>
                        <p className="font-medium text-gray-900">{shipment.packageDimensions}</p>
                      </div>
                    </div>
                  )}
                  {shipment.declaredValue && (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <DollarSign className="w-4 h-4 text-gray-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Declared Value</p>
                        <p className="font-medium text-gray-900">${shipment.declaredValue.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                  {shipment.serviceType && (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Truck className="w-4 h-4 text-gray-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Service</p>
                        <p className="font-medium text-gray-900">{shipment.serviceType.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shipment History */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-[#333366]" />
                Shipment History
              </h3>
              {events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tracking events yet
                </div>
              ) : (
                <div className="space-y-1">
                  {events.map((event, index) => (
                    <div key={event.id} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-[#333366]' :
                          event.status === 'INTERCEPTED' ? 'bg-red-500' :
                          event.status === 'CLEARED' ? 'bg-emerald-500' :
                          event.status === 'DELIVERED' ? 'bg-green-500' :
                          'bg-gray-300'
                        }`}>
                          {event.status === 'INTERCEPTED' ? (
                            <AlertTriangle className="w-4 h-4 text-white" />
                          ) : event.status === 'CLEARED' ? (
                            <ShieldCheck className="w-4 h-4 text-white" />
                          ) : event.status === 'DELIVERED' ? (
                            <CheckCircle className="w-4 h-4 text-white" />
                          ) : (
                            <Package className="w-4 h-4 text-white" />
                          )}
                        </div>
                        {index < events.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 min-h-[40px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className={`p-3 rounded-lg ${
                          event.status === 'INTERCEPTED' ? 'bg-red-50 border border-red-100' :
                          event.status === 'CLEARED' ? 'bg-emerald-50 border border-emerald-100' :
                          event.status === 'DELIVERED' ? 'bg-green-50 border border-green-100' :
                          'bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-semibold ${
                              event.status === 'INTERCEPTED' ? 'text-red-700' :
                              event.status === 'CLEARED' ? 'text-emerald-700' :
                              event.status === 'DELIVERED' ? 'text-green-700' :
                              'text-gray-900'
                            }`}>
                              {event.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-500">{formatDate(event.eventTime)}</span>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {event.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sender/Recipient Info */}
          <div className="space-y-6">
            {/* Sender Info */}
            {(shipment.senderName || shipment.senderPhone || shipment.senderEmail) && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-green-600 px-4 py-3">
                  <h3 className="font-semibold text-white flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Sender
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {shipment.senderName && (
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.senderName}</span>
                    </div>
                  )}
                  {shipment.senderPhone && (
                    <div className="flex items-center text-sm">
                      <Phone className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.senderPhone}</span>
                    </div>
                  )}
                  {shipment.senderEmail && (
                    <div className="flex items-center text-sm">
                      <Mail className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.senderEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recipient Info */}
            {(shipment.recipientName || shipment.recipientPhone || shipment.recipientEmail) && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-[#cc0000] px-4 py-3">
                  <h3 className="font-semibold text-white flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Recipient
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {shipment.recipientName && (
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.recipientName}</span>
                    </div>
                  )}
                  {shipment.recipientPhone && (
                    <div className="flex items-center text-sm">
                      <Phone className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.recipientPhone}</span>
                    </div>
                  )}
                  {shipment.recipientEmail && (
                    <div className="flex items-center text-sm">
                      <Mail className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-900">{shipment.recipientEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status & Dates */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                Status & Dates
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    shipment.currentStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    shipment.currentStatus === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                    shipment.currentStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {shipment.currentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Created</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(shipment.createdAt)}</span>
                </div>
                {shipment.estimatedArrival && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">Est. Arrival</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(shipment.estimatedArrival)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Distance Info */}
            {(shipment.totalDistance || shipment.remainingDistance) && (
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Navigation className="w-4 h-4 mr-2 text-gray-500" />
                  Distance
                </h3>
                <div className="space-y-2">
                  {shipment.totalDistance && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Distance</span>
                      <span className="text-sm font-medium">{Math.round(shipment.totalDistance)} km</span>
                    </div>
                  )}
                  {shipment.remainingDistance && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Remaining</span>
                      <span className="text-sm font-medium">{Math.round(shipment.remainingDistance)} km</span>
                    </div>
                  )}
                  {shipment.totalDistance && shipment.remainingDistance && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#333366] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, ((shipment.totalDistance - shipment.remainingDistance) / shipment.totalDistance) * 100))}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-1">
                        {Math.round(((shipment.totalDistance - shipment.remainingDistance) / shipment.totalDistance) * 100)}% Complete
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
