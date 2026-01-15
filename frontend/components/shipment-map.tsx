'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Shipment, Location as LocationType, AddressChangeFeeCalculation } from '@/lib/types'
import { Play, Pause, Square, MapPin, Navigation, Truck, AlertCircle, CheckCircle, Search, X, Clock, Route, DollarSign } from 'lucide-react'
import api from '@/lib/api'
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

interface ShipmentMapProps {
  shipment: Shipment
  onMovementStateChange?: () => void
}

// OSRM routing service (free, no API key needed)
async function getRouteFromOSRM(
  origin: [number, number],
  destination: [number, number]
): Promise<Array<[number, number]>> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`
    const response = await fetch(url)
    const data = await response.json()

    if (data.routes && data.routes[0] && data.routes[0].geometry) {
      // OSRM returns [lng, lat], we need [lat, lng]
      return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]])
    }
  } catch (error) {
    console.error('OSRM routing failed:', error)
  }
  return []
}

// Geocoding service using Nominatim (free, no API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'USPS-Tracking-App' }
    })
    const data = await response.json()

    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }
  } catch (error) {
    console.error('Geocoding failed:', error)
  }
  return null
}

export default function ShipmentMap({ shipment, onMovementStateChange }: ShipmentMapProps) {
  const socket = useRef<Socket | null>(null)
  const animationRef = useRef<number | null>(null)
  const targetPositionRef = useRef<[number, number]>([39.8283, -98.5795])

  const [isMoving, setIsMoving] = useState(shipment.movementState?.isMoving ?? false)
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null)
  const [position, setPosition] = useState<[number, number]>([39.8283, -98.5795])
  const [animatedPosition, setAnimatedPosition] = useState<[number, number]>([39.8283, -98.5795])
  const [isLoading, setIsLoading] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [originPosition, setOriginPosition] = useState<[number, number] | null>(null)
  const [destPosition, setDestPosition] = useState<[number, number] | null>(null)
  const [progress, setProgress] = useState(0)
  const [shipmentStatus, setShipmentStatus] = useState(shipment.currentStatus)
  const [error, setError] = useState('')
  const [hasStarted, setHasStarted] = useState(false)

  // Address input state
  const [showAddressInput, setShowAddressInput] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false)

  // ETA and Distance tracking state
  const [eta, setEta] = useState<{ arrival: Date | null; minutesRemaining: number }>({
    arrival: null,
    minutesRemaining: 0,
  })
  const [distance, setDistance] = useState<{
    total: number
    remaining: number
    covered: number
  }>({ total: 0, remaining: 0, covered: 0 })

  // Address change modal state
  const [showAddressChangeModal, setShowAddressChangeModal] = useState(false)
  const [newDestination, setNewDestination] = useState('')
  const [feeCalculation, setFeeCalculation] = useState<AddressChangeFeeCalculation | null>(null)
  const [isCalculatingFee, setIsCalculatingFee] = useState(false)
  const [isApplyingChange, setIsApplyingChange] = useState(false)

  // Delivery timeframe state
  const [showStartModal, setShowStartModal] = useState(false)
  const [deliveryDays, setDeliveryDays] = useState<string>('1')

  // Intercept/Clear reason modal state
  const [showInterceptModal, setShowInterceptModal] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [interceptReason, setInterceptReason] = useState('')
  const [clearReason, setClearReason] = useState('')

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

  // Load initial route on mount
  useEffect(() => {
    const loadRoute = async () => {
      try {
        const response = await api.get(`/movement/${shipment.id}/route`)
        const { origin, destination, currentPosition } = response.data

        const originCoords: [number, number] = [origin.lat, origin.lng]
        const destCoords: [number, number] = [destination.lat, destination.lng]

        setOriginPosition(originCoords)
        setDestPosition(destCoords)

        // Get actual road route from OSRM
        const roadRoute = await getRouteFromOSRM(originCoords, destCoords)
        if (roadRoute.length > 0) {
          setRoute(roadRoute)
        } else {
          // Fallback to simple line
          setRoute([originCoords, destCoords])
        }

        // Set initial position
        if (currentPosition) {
          setPosition([currentPosition.lat, currentPosition.lng])
          setAnimatedPosition([currentPosition.lat, currentPosition.lng])
        } else {
          setPosition(originCoords)
          setAnimatedPosition(originCoords)
        }

        // Check if movement has already started
        if (shipment.currentStatus === 'IN_TRANSIT') {
          setHasStarted(true)
        }
      } catch (err) {
        console.error('Failed to load route:', err)
        setPosition([39.8283, -98.5795])
        setAnimatedPosition([39.8283, -98.5795])
      }
      setMapReady(true)
    }

    loadRoute()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [shipment.id, shipment.currentStatus])

  // WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

    socket.current = io(`${wsUrl}/tracking`, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.current.on('connect', () => {
      setWsConnected(true)
      socket.current?.emit('joinShipment', { shipmentId: shipment.id })
    })

    socket.current.on('disconnect', () => {
      setWsConnected(false)
    })

    socket.current.on('joinedShipment', (data) => {
      setIsMoving(data.isMoving)
      if (data.isMoving || data.shipment?.currentStatus === 'IN_TRANSIT') {
        setHasStarted(true)
      }
      if (data.currentLocation) {
        const lat = data.currentLocation.latitude
        const lng = data.currentLocation.longitude
        setPosition([lat, lng])
        animateToPosition(lat, lng)
        setCurrentLocation(data.currentLocation)
      }
    })

    socket.current.on('locationUpdate', (data) => {
      const lat = data.latitude
      const lng = data.longitude

      animateToPosition(lat, lng)
      setPosition([lat, lng])

      setCurrentLocation({
        id: 'current',
        shipmentId: shipment.id,
        latitude: lat,
        longitude: lng,
        speed: data.speed ?? null,
        heading: data.heading ?? null,
        recordedAt: new Date().toISOString()
      })

      if (data.progress) {
        setProgress(data.progress.percentComplete)
      }

      // Update distance and ETA from WebSocket data
      if (data.distance) {
        setDistance(data.distance)
      }
      if (data.eta) {
        setEta({
          arrival: new Date(data.eta.arrival),
          minutesRemaining: data.eta.minutesRemaining,
        })
      }
    })

    // Listen for address change events
    socket.current.on('addressChanged', (data) => {
      setEta({
        arrival: new Date(data.newEta),
        minutesRemaining: Math.round((data.newRemainingDistance / 45) * 60),
      })
      setDistance((prev) => ({
        ...prev,
        remaining: data.newRemainingDistance,
      }))
    })

    socket.current.on('shipmentIntercepted', (data) => {
      setIsMoving(false)
      setShowAddressInput(true) // Show address input when intercepted
      if (onMovementStateChange) onMovementStateChange()
    })

    socket.current.on('shipmentCleared', (data) => {
      setIsMoving(true)
      setShowAddressInput(false)
      if (onMovementStateChange) onMovementStateChange()
    })

    // Keep legacy event handlers for backwards compatibility
    socket.current.on('shipmentPaused', () => {
      setIsMoving(false)
      setShowAddressInput(true)
      if (onMovementStateChange) onMovementStateChange()
    })

    socket.current.on('shipmentResumed', () => {
      setIsMoving(true)
      setShowAddressInput(false)
      if (onMovementStateChange) onMovementStateChange()
    })

    socket.current.on('shipmentCancelled', () => {
      setIsMoving(false)
      setShipmentStatus('CANCELLED')
      setShowAddressInput(false)
      if (onMovementStateChange) onMovementStateChange()
    })

    socket.current.on('shipmentDelivered', () => {
      setIsMoving(false)
      setShipmentStatus('DELIVERED')
      setShowAddressInput(false)
      if (onMovementStateChange) onMovementStateChange()
    })

    return () => {
      socket.current?.emit('leaveShipment', { shipmentId: shipment.id })
      socket.current?.disconnect()
    }
  }, [shipment.id, onMovementStateChange, animateToPosition])

  // Handle Start Trip
  const handleStart = async () => {
    setIsLoading(true)
    setError('')
    try {
      const days = parseFloat(deliveryDays) || 1
      const response = await api.post(`/movement/${shipment.id}/start`, { deliveryDays: days })
      setIsMoving(true)
      setHasStarted(true)
      setShipmentStatus('IN_TRANSIT')

      // Update route with road routing
      if (response.data.origin && response.data.destination) {
        const originCoords: [number, number] = [response.data.origin.lat, response.data.origin.lng]
        const destCoords: [number, number] = [response.data.destination.lat, response.data.destination.lng]

        setOriginPosition(originCoords)
        setDestPosition(destCoords)
        setPosition(originCoords)
        setAnimatedPosition(originCoords)

        // Get road route
        const roadRoute = await getRouteFromOSRM(originCoords, destCoords)
        if (roadRoute.length > 0) {
          setRoute(roadRoute)
        }
      }

      // Set initial distance and ETA from response
      if (response.data.totalDistance) {
        setDistance({
          total: response.data.totalDistance,
          remaining: response.data.remainingDistance || response.data.totalDistance,
          covered: 0,
        })
      }
      if (response.data.estimatedArrival) {
        const arrivalDate = new Date(response.data.estimatedArrival)
        setEta({
          arrival: arrivalDate,
          minutesRemaining: response.data.estimatedTravelTime || Math.round((response.data.totalDistance / 45) * 60),
        })
      }

      setShowStartModal(false)
      if (onMovementStateChange) onMovementStateChange()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start trip')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Intercept (Pause)
  const handleIntercept = async () => {
    if (!interceptReason.trim()) {
      setError('Please provide a reason for interception')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await api.post(`/movement/${shipment.id}/pause`, { reason: interceptReason.trim() })
      setIsMoving(false)
      setShowAddressInput(true)
      setShowInterceptModal(false)
      setInterceptReason('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to intercept')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Clear (Resume)
  const handleClear = async () => {
    if (!clearReason.trim()) {
      setError('Please provide a reason for clearance')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await api.post(`/movement/${shipment.id}/resume`, { reason: clearReason.trim() })
      setIsMoving(true)
      setShowAddressInput(false)
      setShowClearModal(false)
      setClearReason('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Cancel
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this shipment?')) return

    setIsLoading(true)
    setError('')
    try {
      await api.post(`/movement/${shipment.id}/cancel`)
      setIsMoving(false)
      setShipmentStatus('CANCELLED')
      setShowAddressInput(false)
      if (onMovementStateChange) onMovementStateChange()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Manual Address Entry
  const handleAddressSubmit = async () => {
    if (!addressInput.trim()) return

    setIsGeocodingAddress(true)
    setError('')

    try {
      const coords = await geocodeAddress(addressInput)
      if (coords) {
        // Update position
        setPosition([coords.lat, coords.lng])
        animateToPosition(coords.lat, coords.lng)

        // Send location update to backend with forceUpdate flag
        try {
          await api.post(`/locations`, {
            shipmentId: shipment.id,
            latitude: coords.lat,
            longitude: coords.lng,
            speed: 0,
            heading: 0,
            forceUpdate: true,
            addressLabel: addressInput.trim()
          })
        } catch (e) {
          console.error('Failed to save location:', e)
          setError('Failed to save location to server')
        }

        setCurrentLocation({
          id: 'manual',
          shipmentId: shipment.id,
          latitude: coords.lat,
          longitude: coords.lng,
          speed: 0,
          heading: null,
          recordedAt: new Date().toISOString()
        })

        setAddressInput('')
        setError('')
      } else {
        setError('Could not find address. Please try a different format.')
      }
    } catch (err) {
      setError('Failed to geocode address')
    } finally {
      setIsGeocodingAddress(false)
    }
  }

  // Format ETA time
  const formatEta = (date: Date | null): string => {
    if (!date) return '--:--'
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Format minutes to hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Calculate address change fee
  const handleCalculateFee = async () => {
    if (!newDestination.trim()) return

    setIsCalculatingFee(true)
    setError('')
    try {
      const response = await api.post(
        `/movement/${shipment.id}/calculate-address-change-fee`,
        { newDestination: newDestination.trim() }
      )
      setFeeCalculation(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate fee')
    } finally {
      setIsCalculatingFee(false)
    }
  }

  // Apply address change
  const handleApplyAddressChange = async () => {
    if (!feeCalculation) return

    setIsApplyingChange(true)
    setError('')
    try {
      await api.post(`/movement/${shipment.id}/change-address`, {
        newDestination: feeCalculation.newDestination,
      })
      setShowAddressChangeModal(false)
      setFeeCalculation(null)
      setNewDestination('')
      if (onMovementStateChange) onMovementStateChange()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to apply address change')
    } finally {
      setIsApplyingChange(false)
    }
  }

  // Map Content Component
  const MapContent = useCallback(() => {
    const [L, setL] = useState<any>(null)
    const [truckIcon, setTruckIcon] = useState<any>(null)
    const [originIcon, setOriginIcon] = useState<any>(null)
    const [destIcon, setDestIcon] = useState<any>(null)
    const [MapHook, setMapHook] = useState<any>(null)

    useEffect(() => {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default)

        // Truck marker
        setTruckIcon(leaflet.default.divIcon({
          className: 'truck-marker',
          html: `
            <div style="
              width: 48px;
              height: 48px;
              background: linear-gradient(135deg, #333366 0%, #1a1a4e 100%);
              border: 4px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            ">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }))

        // Origin marker (green pin)
        setOriginIcon(leaflet.default.divIcon({
          className: 'origin-marker',
          html: `
            <div style="
              width: 36px;
              height: 36px;
              background: #22c55e;
              border: 4px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        }))

        // Destination marker (red flag)
        setDestIcon(leaflet.default.divIcon({
          className: 'dest-marker',
          html: `
            <div style="position: relative;">
              <div style="
                width: 4px;
                height: 40px;
                background: #333;
                position: absolute;
                left: 0;
                bottom: 0;
              "></div>
              <div style="
                width: 30px;
                height: 20px;
                background: #cc0000;
                position: absolute;
                left: 4px;
                bottom: 20px;
                clip-path: polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%);
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
              "></div>
            </div>
          `,
          iconSize: [34, 40],
          iconAnchor: [2, 40],
        }))
      })

      import('react-leaflet').then((mod) => {
        setMapHook(() => mod.useMap)
      })
    }, [])

    // Map controller for panning
    function MapController() {
      const map = MapHook ? MapHook() : null

      useEffect(() => {
        if (map && animatedPosition) {
          map.setView(animatedPosition, map.getZoom(), { animate: true, duration: 0.5 })
        }
      }, [map])

      // Fit bounds to show full route
      useEffect(() => {
        if (map && route.length > 0) {
          try {
            const bounds = L.latLngBounds(route)
            map.fitBounds(bounds, { padding: [50, 50] })
          } catch (e) {
            console.error('Failed to fit bounds:', e)
          }
        }
      }, [map, route.length])

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

        {/* Route line - actual road path */}
        {route.length > 0 && (
          <Polyline
            positions={route}
            color="#333366"
            weight={5}
            opacity={0.8}
          />
        )}

        {/* Origin marker */}
        {originPosition && (
          <Marker position={originPosition} icon={originIcon} />
        )}

        {/* Destination marker */}
        {destPosition && (
          <Marker position={destPosition} icon={destIcon} />
        )}

        {/* Truck marker */}
        <Marker position={animatedPosition} icon={truckIcon} />

        {/* Pulse effect when moving */}
        {isMoving && (
          <Circle
            center={animatedPosition}
            radius={800}
            pathOptions={{
              color: '#333366',
              fillColor: '#333366',
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}

        {MapHook && <MapController />}
      </>
    )
  }, [animatedPosition, route, originPosition, destPosition, isMoving])

  const isDelivered = shipmentStatus === 'DELIVERED'
  const isCancelled = shipmentStatus === 'CANCELLED'
  const isPaused = hasStarted && !isMoving && !isDelivered && !isCancelled

  return (
    <div className="relative h-full">
      {/* Map */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        {mapReady && (
          <MapContainer
            center={position}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapContent />
          </MapContainer>
        )}
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-3 z-[1000] min-w-[240px] max-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#333366]" />
            <span className="font-semibold text-gray-900">Movement Control</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
               title={wsConnected ? 'Connected' : 'Disconnected'} />
        </div>

        {/* Error */}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Status Badges */}
        {isDelivered && (
          <div className="p-3 bg-green-50 border border-green-200 rounded flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-700">Delivered</span>
          </div>
        )}

        {isCancelled && (
          <div className="p-3 bg-gray-100 border border-gray-300 rounded flex items-center gap-2">
            <Square className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-700">Cancelled</span>
          </div>
        )}

        {/* Action Buttons */}
        {!isDelivered && !isCancelled && (
          <div className="space-y-2">
            {/* Start Button - show when not started */}
            {!hasStarted && (
              <button
                onClick={() => setShowStartModal(true)}
                disabled={isLoading}
                className="flex items-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 w-full justify-center font-semibold transition-all shadow-md"
              >
                <Play className="w-5 h-5 mr-2" fill="white" />
                Start Trip
              </button>
            )}

            {/* Intercept Button - show when moving */}
            {hasStarted && isMoving && (
              <button
                onClick={() => setShowInterceptModal(true)}
                disabled={isLoading}
                className="flex items-center px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 w-full justify-center font-semibold transition-all shadow-md"
              >
                <Pause className="w-5 h-5 mr-2" fill="white" />
                Intercept Shipment
              </button>
            )}

            {/* Clear Button - show when intercepted */}
            {isPaused && (
              <button
                onClick={() => setShowClearModal(true)}
                disabled={isLoading}
                className="flex items-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 w-full justify-center font-semibold transition-all shadow-md"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Clear Shipment
              </button>
            )}

            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-white text-red-600 border-2 border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 w-full justify-center font-medium transition-all"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel Shipment
            </button>
          </div>
        )}

        {/* Address Input - show when paused */}
        {isPaused && showAddressInput && (
          <div className="pt-3 border-t space-y-2">
            <div className="text-sm font-medium text-gray-700">Set Current Location</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSubmit()}
                placeholder="Enter address..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
              />
              <button
                onClick={handleAddressSubmit}
                disabled={isGeocodingAddress || !addressInput.trim()}
                className="px-3 py-2 bg-[#333366] text-white rounded-lg hover:bg-[#1a1a4e] disabled:opacity-50 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Enter a city or address to reposition the marker
            </p>
          </div>
        )}

        {/* Progress */}
        {hasStarted && !isDelivered && !isCancelled && (
          <div className="pt-3 border-t">
            <div className="text-xs text-gray-500 mb-2">Delivery Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-[#333366] to-[#4a4a8a] h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <div className="text-sm text-gray-700 mt-1 text-right font-medium">{progress}%</div>
          </div>
        )}

        {/* Trip Information - ETA and Distance */}
        {hasStarted && !isDelivered && !isCancelled && (
          <div className="pt-3 border-t space-y-2">
            <div className="text-xs text-gray-500 mb-2">Trip Information</div>

            {/* ETA */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center">
                <Clock className="w-4 h-4 mr-1 text-[#333366]" />
                ETA:
              </span>
              <span className="text-sm font-semibold text-[#333366]">
                {formatEta(eta.arrival)}
              </span>
            </div>

            {/* Time Remaining */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Time Left:</span>
              <span className="text-sm font-medium text-gray-700">
                {formatMinutes(eta.minutesRemaining)}
              </span>
            </div>

            {/* Distance */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center">
                <Route className="w-4 h-4 mr-1 text-[#333366]" />
                Distance:
              </span>
              <span className="text-sm font-medium text-gray-700">
                {distance.remaining.toFixed(1)} / {distance.total.toFixed(1)} km
              </span>
            </div>

            {/* Change Address Button (only during transit, not paused) */}
            {isMoving && (
              <button
                onClick={() => setShowAddressChangeModal(true)}
                className="w-full mt-2 px-3 py-2 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center"
              >
                <MapPin className="w-4 h-4 mr-1" />
                Change Destination Address
              </button>
            )}
          </div>
        )}

        {/* Status */}
        <div className="pt-3 border-t">
          <div className="text-xs text-gray-500 mb-2">Status</div>
          <div className={`flex items-center ${
            isMoving ? 'text-green-600' :
            isDelivered ? 'text-green-600' :
            isCancelled ? 'text-gray-600' :
            isPaused ? 'text-yellow-600' :
            'text-blue-600'
          }`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${
              isMoving ? 'bg-green-500 animate-pulse' :
              isDelivered ? 'bg-green-500' :
              isCancelled ? 'bg-gray-500' :
              isPaused ? 'bg-yellow-500' :
              'bg-blue-500'
            }`} />
            <span className="text-sm font-semibold">
              {isMoving ? 'In Transit' :
               isDelivered ? 'Delivered' :
               isCancelled ? 'Cancelled' :
               isPaused ? 'Intercepted' :
               'Ready'}
            </span>
          </div>
        </div>

        {/* Current Location Data */}
        {currentLocation && (
          <div className="pt-3 border-t space-y-2">
            <div className="text-xs text-gray-500">Current Position</div>
            <div className="flex items-center text-sm">
              <MapPin className="w-4 h-4 text-[#333366] mr-2" />
              <span className="text-gray-700 font-mono text-xs">
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </span>
            </div>
            {currentLocation.speed !== null && currentLocation.speed > 0 && (
              <div className="flex items-center text-sm">
                <Navigation className="w-4 h-4 text-[#333366] mr-2" />
                <span className="text-gray-700">{Math.round(currentLocation.speed)} km/h</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              Origin
            </div>
            <div className="text-sm font-medium text-gray-900">{shipment.originLocation}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Tracking #</div>
            <div className="text-sm font-mono font-bold text-[#333366]">{shipment.trackingNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 flex items-center justify-end gap-1 mb-1">
              <div className="w-3 h-3 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%)' }} />
              Destination
            </div>
            <div className="text-sm font-medium text-gray-900">{shipment.destinationLocation}</div>
          </div>
        </div>
      </div>

      {/* Address Change Modal */}
      {showAddressChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-[#333366]" />
              Change Destination Address
            </h3>

            {!feeCalculation ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Destination
                  </label>
                  <p className="text-gray-600 bg-gray-50 p-2 rounded">
                    {shipment.destinationLocation}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Destination
                  </label>
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    placeholder="Enter new destination address..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#333366]"
                  />
                </div>

                {error && (
                  <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddressChangeModal(false)
                      setNewDestination('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCalculateFee}
                    disabled={isCalculatingFee || !newDestination.trim()}
                    className="flex-1 px-4 py-2 bg-[#333366] text-white rounded-lg hover:bg-[#1a1a4e] disabled:opacity-50"
                  >
                    {isCalculatingFee ? 'Calculating...' : 'Calculate Fee'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    Fee Calculation
                  </h4>
                  <div className="space-y-1 text-sm text-blue-700">
                    <div className="flex justify-between">
                      <span>Base Fee:</span>
                      <span>${feeCalculation.baseFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        Extra Miles ({(feeCalculation.distanceDifference * 0.621).toFixed(1)} mi @ $0.50):
                      </span>
                      <span>${feeCalculation.extraMilesFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-blue-200 pt-1 mt-1">
                      <span>Total Fee:</span>
                      <span>${feeCalculation.totalFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4 text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>From:</strong> {feeCalculation.previousDestination}
                  </p>
                  <p>
                    <strong>To:</strong> {feeCalculation.newDestination}
                  </p>
                  <p>
                    <strong>New ETA:</strong>{' '}
                    {new Date(feeCalculation.newEta).toLocaleString()}
                  </p>
                  <p>
                    <strong>Time Difference:</strong>{' '}
                    {feeCalculation.timeDifference > 0 ? '+' : ''}
                    {Math.round(feeCalculation.timeDifference)} minutes
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setFeeCalculation(null)
                      setNewDestination('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleApplyAddressChange}
                    disabled={isApplyingChange}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {isApplyingChange ? 'Applying...' : 'Confirm & Apply'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Start Trip Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Play className="w-5 h-5 mr-2 text-green-600" />
              Start Trip
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Delivery Period (Days)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="e.g., 2 for 2 days"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the expected delivery timeframe. The shipment will be simulated to arrive within this period.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStartModal(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={isLoading || !deliveryDays || parseFloat(deliveryDays) <= 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Starting...' : 'Start Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intercept Modal */}
      {showInterceptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
              Intercept Shipment
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Interception *
              </label>
              <textarea
                value={interceptReason}
                onChange={(e) => setInterceptReason(e.target.value)}
                placeholder="e.g., Customs inspection required, Security check, Address verification needed..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInterceptModal(false)
                  setInterceptReason('')
                  setError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleIntercept}
                disabled={isLoading || !interceptReason.trim()}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {isLoading ? 'Intercepting...' : 'Intercept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Clear Shipment
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Clearance *
              </label>
              <textarea
                value={clearReason}
                onChange={(e) => setClearReason(e.target.value)}
                placeholder="e.g., Inspection passed, Documents verified, Issue resolved..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowClearModal(false)
                  setClearReason('')
                  setError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={isLoading || !clearReason.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Clearing...' : 'Clear & Resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
