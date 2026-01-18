'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { ArrowLeft, MapPin, Truck, Clock, Navigation, Package, CheckCircle, AlertCircle, AlertTriangle, ShieldCheck, User, Phone, Mail, FileText, Scale, DollarSign, Ruler, Calendar, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { useTimeBasedShipmentMovement, type MovementState } from '@/app/hooks/useTimeBasedShipmentMovement'
import { haversineDistance } from '@/app/utils/bearing'

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

  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [originPosition, setOriginPosition] = useState<[number, number] | null>(null)
  const [destPosition, setDestPosition] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [isMoving, setIsMoving] = useState(false)
  const [speed, setSpeed] = useState(0)
  const [progress, setProgress] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const [movementReady, setMovementReady] = useState(false)
  const [initialProgress, setInitialProgress] = useState(0)
  const [tripDurationMs, setTripDurationMs] = useState(60000) // Default 1 minute for demo

  // Use refs for smooth animation (no React re-renders)
  const animatedPositionRef = useRef<[number, number]>([39.8283, -98.5795])
  const bearingRef = useRef(0)
  const truckMarkerRef = useRef<any>(null)

  // Interception state
  const [isIntercepted, setIsIntercepted] = useState(false)
  const [interceptReason, setInterceptReason] = useState<string | null>(null)
  const [interceptedAt, setInterceptedAt] = useState<string | null>(null)
  const [interceptLocation, setInterceptLocation] = useState<{ latitude: number | null; longitude: number | null; address: string | null } | null>(null)
  const [clearReason, setClearReason] = useState<string | null>(null)
  const [showInterceptNotification, setShowInterceptNotification] = useState(true)
  const [showClearNotification, setShowClearNotification] = useState(false)

  // Vehicle speed state (set by admin, received via WebSocket)
  const [vehicleSpeedKmh, setVehicleSpeedKmh] = useState(80)
  const [savedProgress, setSavedProgress] = useState(0)
  const movementRef = useRef<any>(null)

  // Movement state callback - updates position IMPERATIVELY (no React state for position)
  const handlePositionUpdate = useCallback((state: MovementState) => {
    // Store in refs (no re-render)
    animatedPositionRef.current = [state.position.lat, state.position.lng]
    bearingRef.current = state.bearing

    // IMPERATIVE: Update marker position directly (smooth, no jitter)
    if (truckMarkerRef.current) {
      truckMarkerRef.current.setLatLng([state.position.lat, state.position.lng])
    }

    // Only update these occasionally to reduce re-renders
    setProgress(state.progress * 100)
    setSpeed(state.speed)
  }, [])

  // Handle arrival
  const handleArrival = useCallback(() => {
    setIsMoving(false)
    setShipment(prev => prev ? { ...prev, currentStatus: 'DELIVERED' } : null)
  }, [])

  // Convert route to LatLng format for the hook
  const routeLatLng = useMemo(() => {
    return route.map(([lat, lng]) => ({ lat, lng }))
  }, [route])

  // Movement hook configuration
  const movementConfig = useMemo(() => {
    if (!originPosition || !destPosition || !movementReady) return null

    return {
      origin: { lat: originPosition[0], lng: originPosition[1] },
      destination: { lat: destPosition[0], lng: destPosition[1] },
      route: routeLatLng.length > 1 ? routeLatLng : undefined,
      durationMs: tripDurationMs,
      averageSpeedKmh: DEMO_SPEED_KMH,
      initialProgress: initialProgress,
      startPaused: !isMoving || isIntercepted,
      onPositionUpdate: handlePositionUpdate,
      onArrival: handleArrival,
    }
  }, [originPosition, destPosition, routeLatLng, tripDurationMs, initialProgress, isMoving, isIntercepted, handlePositionUpdate, handleArrival, movementReady])

  // Use the time-based movement hook
  const movement = useTimeBasedShipmentMovement(
    movementConfig || {
      origin: { lat: 39.8283, lng: -98.5795 },
      destination: { lat: 39.8283, lng: -98.5795 },
      durationMs: 60000,
      averageSpeedKmh: vehicleSpeedKmh,
      startPaused: true,
      onPositionUpdate: handlePositionUpdate,
    }
  )

  // Store movement ref for external updates (like speed changes from WebSocket)
  useEffect(() => {
    movementRef.current = movement
  }, [movement])

  // Load shipment data
  useEffect(() => {
    const loadShipment = async () => {
      try {
        const response = await api.get(`/tracking/public/${trackingNumber}`)
        const { shipment: shipmentData, events: eventsData } = response.data

        console.log('Tracking API response:', { shipmentData, eventsData })
        console.log('Events count:', eventsData?.length || 0)

        setShipment(shipmentData)
        setEvents(eventsData || [])

        // Check if shipment is in transit and not intercepted
        const shouldMove = shipmentData.currentStatus === 'IN_TRANSIT' &&
                          (shipmentData.movementState?.isMoving ?? true)
        const isCurrentlyIntercepted = shipmentData.movementState?.pausedBy != null

        setIsMoving(shouldMove && !isCurrentlyIntercepted)
        setIsIntercepted(isCurrentlyIntercepted)

        if (isCurrentlyIntercepted) {
          setInterceptReason(shipmentData.movementState?.interceptReason || null)
          setInterceptLocation({
            latitude: shipmentData.movementState?.interceptedLat || null,
            longitude: shipmentData.movementState?.interceptedLng || null,
            address: shipmentData.movementState?.interceptedAddress || null,
          })
        }

        // Load saved speed and progress from movementState
        if (shipmentData.movementState?.vehicleSpeedKmh) {
          setVehicleSpeedKmh(shipmentData.movementState.vehicleSpeedKmh)
        }
        if (shipmentData.movementState?.currentProgress > 0) {
          setSavedProgress(shipmentData.movementState.currentProgress)
        }

        // Try to get route info
        try {
          // Get coordinates for origin and destination
          const originCoords = getCityCoordinates(shipmentData.originLocation)
          const destCoords = getCityCoordinates(shipmentData.destinationLocation)

          setOriginPosition([originCoords.lat, originCoords.lng])
          setDestPosition([destCoords.lat, destCoords.lng])

          // Fetch actual road route from OSRM
          const routePoints = await fetchRoute(originCoords, destCoords)
          setRoute(routePoints)

          // Calculate route distance for trip duration
          let totalDistance = 0
          for (let i = 0; i < routePoints.length - 1; i++) {
            totalDistance += haversineDistance(
              { lat: routePoints[i][0], lng: routePoints[i][1] },
              { lat: routePoints[i + 1][0], lng: routePoints[i + 1][1] }
            )
          }

          // Calculate trip duration (distance / speed * 1000 for ms)
          // For demo, use a scaled duration (1 minute per 100km)
          const demoDurationMs = Math.max(30000, (totalDistance / 100) * 60000)
          setTripDurationMs(demoDurationMs)

          // Set initial position and progress
          // First check if we have saved progress from the backend
          if (shipmentData.movementState?.currentProgress > 0) {
            // Use saved progress from database
            setInitialProgress(shipmentData.movementState.currentProgress)
            // Set position based on saved progress if we have saved coordinates
            if (shipmentData.movementState?.lastPositionLat && shipmentData.movementState?.lastPositionLng) {
              animatedPositionRef.current = [shipmentData.movementState.lastPositionLat, shipmentData.movementState.lastPositionLng]
            } else if (shipmentData.currentLocation && shipmentData.currentLocation.includes(',')) {
              const [lat, lng] = shipmentData.currentLocation.split(',').map(Number)
              animatedPositionRef.current = [lat, lng]
            }
          } else if (shipmentData.currentLocation && shipmentData.currentLocation.includes(',')) {
            const [lat, lng] = shipmentData.currentLocation.split(',').map(Number)
            animatedPositionRef.current = [lat, lng]

            // Calculate current progress along route
            const originDist = haversineDistance(
              { lat: originCoords.lat, lng: originCoords.lng },
              { lat, lng }
            )
            const currentProgress = Math.min(0.95, originDist / totalDistance)
            setInitialProgress(currentProgress)
          } else {
            animatedPositionRef.current = [originCoords.lat, originCoords.lng]
            setInitialProgress(0)
          }

          // Enable movement animation after setup is complete
          setMovementReady(true)
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
      const shouldMove = data.isMoving && !data.isIntercepted
      setIsMoving(shouldMove)
      setIsIntercepted(data.isIntercepted || false)
      setInterceptReason(data.interceptReason || null)
      setInterceptedAt(data.interceptedAt || null)
      setInterceptLocation(data.interceptLocation || null)
      setClearReason(data.clearReason || null)

      // If intercepted and we have intercept location, freeze there
      if (data.isIntercepted && data.interceptLocation?.latitude && data.interceptLocation?.longitude) {
        const lat = data.interceptLocation.latitude
        const lng = data.interceptLocation.longitude
        animatedPositionRef.current = [lat, lng]
        // Update marker imperatively
        if (truckMarkerRef.current) {
          truckMarkerRef.current.setLatLng([lat, lng])
        }
        // Seek the movement to this position
        if (movement) {
          const currentState = movement.getState()
          setInitialProgress(currentState.progress)
        }
      }
    })

    socket.current.on('locationUpdate', (data) => {
      // Location updates from server - update shipment data but let local animation handle position
      if (data.remainingDistance !== undefined || data.estimatedArrival || data.eta || data.distance) {
        setShipment(prev => {
          if (!prev) return prev
          return {
            ...prev,
            remainingDistance: data.remainingDistance ?? data.distance?.remaining ?? prev.remainingDistance,
            estimatedArrival: data.estimatedArrival ?? data.eta?.arrival ?? prev.estimatedArrival,
            currentLocation: data.currentLocation ?? prev.currentLocation,
          }
        })
      }
    })

    socket.current.on('shipmentIntercepted', (data) => {
      // Pause movement - the hook will freeze at current position
      setIsMoving(false)
      setIsIntercepted(true)
      setInterceptReason(data.reason || 'Shipment held for inspection')
      setInterceptedAt(data.timestamp || new Date().toISOString())
      setShowInterceptNotification(true)

      // Store intercept location for display
      if (data.location) {
        setInterceptLocation(data.location)
        // Set the animated position to the intercept location imperatively
        if (data.location.latitude && data.location.longitude) {
          animatedPositionRef.current = [data.location.latitude, data.location.longitude]
          if (truckMarkerRef.current) {
            truckMarkerRef.current.setLatLng([data.location.latitude, data.location.longitude])
          }
        }
      }
    })

    socket.current.on('shipmentCleared', (data) => {
      // Resume movement from current position
      setIsMoving(true)
      setIsIntercepted(false)
      setClearReason(data.reason || 'Shipment cleared and in transit')
      setInterceptReason(null)
      setInterceptLocation(null)
      setShowClearNotification(true)
    })

    socket.current.on('shipmentPaused', () => setIsMoving(false))
    socket.current.on('shipmentResumed', () => setIsMoving(true))
    socket.current.on('shipmentDelivered', () => {
      setIsMoving(false)
      setIsIntercepted(false)
      setShipment(prev => prev ? { ...prev, currentStatus: 'DELIVERED' } : null)
    })

    // Listen for speed changes from admin
    socket.current.on('speedChanged', (data) => {
      console.log('Speed changed by admin:', data)
      setVehicleSpeedKmh(data.speedKmh)
      // Update the movement hook speed if available
      if (movementRef.current) {
        movementRef.current.setVehicleSpeed(data.speedKmh)
      }
      // Update ETA display
      if (data.estimatedArrival) {
        setShipment(prev => prev ? { ...prev, estimatedArrival: data.estimatedArrival } : null)
      }
    })

    return () => {
      socket.current?.emit('leaveShipment', { shipmentId: shipment.id })
      socket.current?.disconnect()
    }
  }, [shipment, movement])

  // Auto-hide interception notification after 60 seconds
  useEffect(() => {
    if (isIntercepted && showInterceptNotification) {
      const timer = setTimeout(() => {
        setShowInterceptNotification(false)
      }, 60000) // 60 seconds
      return () => clearTimeout(timer)
    }
  }, [isIntercepted, showInterceptNotification])

  // Auto-hide clear notification after 10 seconds
  useEffect(() => {
    if (showClearNotification) {
      const timer = setTimeout(() => {
        setShowClearNotification(false)
      }, 10000) // 10 seconds
      return () => clearTimeout(timer)
    }
  }, [showClearNotification])

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
      'washington': { lat: 38.9072, lng: -77.0369 },
      'detroit': { lat: 42.3314, lng: -83.0458 },
      'minneapolis': { lat: 44.9778, lng: -93.2650 },
      'portland': { lat: 45.5152, lng: -122.6784 },
      'las vegas': { lat: 36.1699, lng: -115.1398 },
      'nashville': { lat: 36.1627, lng: -86.7816 },
      'memphis': { lat: 35.1495, lng: -90.0490 },
      'baltimore': { lat: 39.2904, lng: -76.6122 },
      'milwaukee': { lat: 43.0389, lng: -87.9065 },
      'albuquerque': { lat: 35.0844, lng: -106.6504 },
      'tucson': { lat: 32.2226, lng: -110.9747 },
      'fresno': { lat: 36.7378, lng: -119.7871 },
      'sacramento': { lat: 38.5816, lng: -121.4944 },
      'kansas city': { lat: 39.0997, lng: -94.5786 },
      'mesa': { lat: 33.4152, lng: -111.8315 },
      'omaha': { lat: 41.2565, lng: -95.9345 },
      'cleveland': { lat: 41.4993, lng: -81.6944 },
      'virginia beach': { lat: 36.8529, lng: -75.9780 },
      'raleigh': { lat: 35.7796, lng: -78.6382 },
      'colorado springs': { lat: 38.8339, lng: -104.8214 },
      'long beach': { lat: 33.7701, lng: -118.1937 },
      'oakland': { lat: 37.8044, lng: -122.2712 },
      'new orleans': { lat: 29.9511, lng: -90.0715 },
      'tampa': { lat: 27.9506, lng: -82.4572 },
      'orlando': { lat: 28.5383, lng: -81.3792 },
      'st. louis': { lat: 38.6270, lng: -90.1994 },
      'pittsburgh': { lat: 40.4406, lng: -79.9959 },
      'cincinnati': { lat: 39.1031, lng: -84.5120 },
      'indianapolis': { lat: 39.7684, lng: -86.1581 },
      'charlotte': { lat: 35.2271, lng: -80.8431 },
      'san jose': { lat: 37.3382, lng: -121.8863 },
      'jacksonville': { lat: 30.3322, lng: -81.6557 },
      'columbus': { lat: 39.9612, lng: -82.9988 },
      'fort worth': { lat: 32.7555, lng: -97.3308 },
      'el paso': { lat: 31.7619, lng: -106.4850 },
    }

    const normalized = location.toLowerCase()
    for (const [city, coords] of Object.entries(cities)) {
      if (normalized.includes(city)) {
        return coords
      }
    }
    return { lat: 39.8283, lng: -98.5795 }
  }

  // Fetch actual road route from OSRM
  const fetchRoute = async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<Array<[number, number]>> => {
    try {
      // OSRM expects coordinates as lng,lat
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
      const response = await fetch(url)
      const data = await response.json()

      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        // OSRM returns coordinates as [lng, lat], we need [lat, lng] for Leaflet
        const coordinates = data.routes[0].geometry.coordinates
        return coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number])
      }
    } catch (error) {
      console.error('Failed to fetch route from OSRM:', error)
    }

    // Fallback to straight line if routing fails
    const routePoints: Array<[number, number]> = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      routePoints.push([
        origin.lat + (dest.lat - origin.lat) * t,
        origin.lng + (dest.lng - origin.lng) * t
      ])
    }
    return routePoints
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

  // Map content component with IMPERATIVE marker updates for smooth animation
  const MapContent = useCallback(() => {
    const [L, setL] = useState<any>(null)
    const [truckIcon, setTruckIcon] = useState<any>(null)
    const [originIcon, setOriginIcon] = useState<any>(null)
    const [destIcon, setDestIcon] = useState<any>(null)
    const [MapHook, setMapHook] = useState<any>(null)
    const [initialPosition] = useState<[number, number]>(animatedPositionRef.current)

    useEffect(() => {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default)

        setTruckIcon(leaflet.default.divIcon({
          className: 'truck-marker',
          html: `
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#333366 0%,#1a1a4e 100%);border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);animation:pulse 2s infinite;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <style>
              @keyframes pulse {
                0% { box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
                50% { box-shadow: 0 4px 20px rgba(51,51,102,0.6); }
                100% { box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
              }
            </style>
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

    // Map controller that handles smooth panning without jitter
    function MapController() {
      const map = MapHook ? MapHook() : null
      const lastPanRef = useRef<[number, number] | null>(null)
      const panIntervalRef = useRef<NodeJS.Timeout | null>(null)

      useEffect(() => {
        if (!map) return

        // Pan to truck position periodically (not on every frame)
        panIntervalRef.current = setInterval(() => {
          const currentPos = animatedPositionRef.current
          const lastPan = lastPanRef.current

          // Only pan if we've moved significantly (reduces jitter)
          if (lastPan) {
            const latDiff = Math.abs(currentPos[0] - lastPan[0])
            const lngDiff = Math.abs(currentPos[1] - lastPan[1])
            // Only pan if moved more than ~500 meters
            if (latDiff < 0.005 && lngDiff < 0.005) {
              return
            }
          }

          lastPanRef.current = currentPos
          map.panTo(currentPos, { animate: true, duration: 1.0, easeLinearity: 0.25 })
        }, 2000) // Pan every 2 seconds instead of every frame

        return () => {
          if (panIntervalRef.current) {
            clearInterval(panIntervalRef.current)
          }
        }
      }, [map])

      return null
    }

    // Store marker ref for imperative updates
    const handleMarkerRef = useCallback((ref: any) => {
      truckMarkerRef.current = ref
    }, [])

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
        {/* Truck marker with ref for imperative updates - position set via ref, not state */}
        <Marker position={initialPosition} icon={truckIcon} ref={handleMarkerRef} />
        {MapHook && <MapController />}
      </>
    )
  }, [route, originPosition, destPosition])

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
            center={animatedPositionRef.current}
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
               isIntercepted ? 'Held for Inspection' :
               isMoving ? 'In Transit' : 'Processing'}
            </span>
          </div>
          {isIntercepted && interceptLocation?.address && (
            <div className="text-xs text-gray-600 mt-1">
              <MapPin className="w-3 h-3 inline mr-1" />
              {interceptLocation.address}
            </div>
          )}
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
        {isIntercepted && showInterceptNotification && (
          <div className="absolute top-4 left-4 right-[240px] bg-red-600 text-white rounded-lg shadow-lg p-4 z-[1000] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-lg">Shipment Held for Inspection</h3>
                <p className="text-red-100 text-sm mt-1">
                  Your shipment has been temporarily held for inspection or verification.
                </p>
                {interceptLocation?.address && (
                  <div className="mt-2 p-2 bg-red-700/50 rounded">
                    <p className="text-xs text-red-200 font-medium">Location:</p>
                    <p className="text-sm">{interceptLocation.address}</p>
                  </div>
                )}
                {interceptReason && (
                  <div className="mt-2 p-2 bg-red-700/50 rounded">
                    <p className="text-xs text-red-200 font-medium">Reason:</p>
                    <p className="text-sm">{interceptReason}</p>
                  </div>
                )}
                <p className="text-xs text-red-200 mt-2">
                  Movement will resume once the inspection is complete.
                </p>
              </div>
              <button
                onClick={() => setShowInterceptNotification(false)}
                className="text-white/70 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Clear Notification (shows briefly when goods are cleared) */}
        {showClearNotification && !isIntercepted && isMoving && (
          <div className="absolute top-4 left-4 right-[240px] bg-emerald-600 text-white rounded-lg shadow-lg p-3 z-[1000] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">Shipment Cleared - Movement Resumed</p>
                <p className="text-emerald-100 text-xs">{clearReason}</p>
              </div>
              <button
                onClick={() => setShowClearNotification(false)}
                className="text-white/70 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
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
