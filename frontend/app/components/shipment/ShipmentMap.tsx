/**
 * ShipmentMap Component
 *
 * BOLT/UBER GRADE Real-Time Tracking Map
 *
 * Key Features:
 * 1. Imperative Leaflet marker updates (NO React state for position)
 * 2. requestAnimationFrame-based smooth animation
 * 3. Real-time ETA display
 * 4. Draggable marker for admin location updates
 * 5. Dynamic truck icon rotation based on heading
 */

'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Shipment } from '@/lib/types'
import api from '@/lib/api'
import {
  Package,
  ChevronDown,
  ChevronUp,
  Navigation,
  AlertCircle,
  GripVertical,
  Clock,
  MapPin,
  Crosshair,
  Gauge
} from 'lucide-react'
import { useTimeBasedShipmentMovement, type MovementState } from '../../hooks/useTimeBasedShipmentMovement'
import { haversineDistance, type LatLng } from '../../utils/bearing'
import { formatDistance, kmhToMph } from '../../utils/etaCalculator'

interface Props {
  shipment: Shipment
  onMovementStateChange?: () => void
}

// City coordinates lookup
const CITY_COORDINATES: Record<string, LatLng> = {
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
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'portland': { lat: 45.5152, lng: -122.6784 },
  'detroit': { lat: 42.3314, lng: -83.0458 },
  'minneapolis': { lat: 44.9778, lng: -93.2650 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
  'cleveland': { lat: 41.4993, lng: -81.6944 },
  'pittsburgh': { lat: 40.4406, lng: -79.9959 },
  'charlotte': { lat: 35.2271, lng: -80.8431 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'memphis': { lat: 35.1495, lng: -90.0490 },
  'new orleans': { lat: 29.9511, lng: -90.0715 },
  'baltimore': { lat: 39.2904, lng: -76.6122 },
  'milwaukee': { lat: 43.0389, lng: -87.9065 },
  'albuquerque': { lat: 35.0844, lng: -106.6504 },
  'tucson': { lat: 32.2226, lng: -110.9747 },
  'fresno': { lat: 36.7378, lng: -119.7871 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'kansas city': { lat: 39.0997, lng: -94.5786 },
  'omaha': { lat: 41.2565, lng: -95.9345 },
  'raleigh': { lat: 35.7796, lng: -78.6382 },
  'colorado springs': { lat: 38.8339, lng: -104.8214 },
  'st. louis': { lat: 38.6270, lng: -90.1994 },
  'cincinnati': { lat: 39.1031, lng: -84.5120 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  'jacksonville': { lat: 30.3322, lng: -81.6557 },
  'columbus': { lat: 39.9612, lng: -82.9988 },
  'fort worth': { lat: 32.7555, lng: -97.3308 },
  'el paso': { lat: 31.7619, lng: -106.4850 },
}

// Fetch actual road route from OSRM
async function fetchRouteFromOSRM(origin: LatLng, dest: LatLng): Promise<L.LatLng[]> {
  try {
    // OSRM expects coordinates as lng,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
    const response = await fetch(url)
    const data = await response.json()

    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      // OSRM returns coordinates as [lng, lat], we need [lat, lng] for Leaflet
      const coordinates = data.routes[0].geometry.coordinates
      return coordinates.map((coord: [number, number]) => L.latLng(coord[1], coord[0]))
    }
  } catch (error) {
    console.error('Failed to fetch route from OSRM:', error)
  }

  // Fallback to straight line if routing fails
  const points: L.LatLng[] = []
  const steps = 50
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(L.latLng(
      origin.lat + (dest.lat - origin.lat) * t,
      origin.lng + (dest.lng - origin.lng) * t
    ))
  }
  return points
}

// Find the nearest point on a polyline to a given point
function findNearestPointOnRoute(
  point: L.LatLng,
  route: L.LatLng[]
): { point: L.LatLng; index: number; progress: number } {
  if (route.length === 0) {
    return { point, index: 0, progress: 0 }
  }

  if (route.length === 1) {
    return { point: route[0], index: 0, progress: 0 }
  }

  let nearestPoint = route[0]
  let nearestDistance = Infinity
  let nearestIndex = 0
  let nearestProgress = 0

  // Calculate total route length for progress calculation
  let totalLength = 0
  const segmentLengths: number[] = []
  for (let i = 0; i < route.length - 1; i++) {
    const segmentLength = route[i].distanceTo(route[i + 1])
    segmentLengths.push(segmentLength)
    totalLength += segmentLength
  }

  let cumulativeLength = 0

  // Check each segment of the route
  for (let i = 0; i < route.length - 1; i++) {
    const segmentStart = route[i]
    const segmentEnd = route[i + 1]

    // Find nearest point on this segment
    const nearest = nearestPointOnSegment(point, segmentStart, segmentEnd)
    const distance = point.distanceTo(nearest)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestPoint = nearest
      nearestIndex = i

      // Calculate progress along the route
      const distanceAlongSegment = segmentStart.distanceTo(nearest)
      nearestProgress = (cumulativeLength + distanceAlongSegment) / totalLength
    }

    cumulativeLength += segmentLengths[i]
  }

  return {
    point: nearestPoint,
    index: nearestIndex,
    progress: Math.min(1, Math.max(0, nearestProgress))
  }
}

// Find the nearest point on a line segment
function nearestPointOnSegment(
  point: L.LatLng,
  segmentStart: L.LatLng,
  segmentEnd: L.LatLng
): L.LatLng {
  const dx = segmentEnd.lng - segmentStart.lng
  const dy = segmentEnd.lat - segmentStart.lat

  if (dx === 0 && dy === 0) {
    return segmentStart
  }

  // Calculate the projection of the point onto the line
  const t = Math.max(0, Math.min(1,
    ((point.lng - segmentStart.lng) * dx + (point.lat - segmentStart.lat) * dy) /
    (dx * dx + dy * dy)
  ))

  return L.latLng(
    segmentStart.lat + t * dy,
    segmentStart.lng + t * dx
  )
}

function getCityCoordinates(location: string): LatLng {
  const normalized = location.toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(city)) {
      return coords
    }
  }
  return { lat: 39.8283, lng: -98.5795 } // Default US center
}

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  PENDING: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', label: 'Pending' },
  PICKED_UP: { color: 'text-blue-800', bgColor: 'bg-blue-100', label: 'Picked Up' },
  IN_TRANSIT: { color: 'text-indigo-800', bgColor: 'bg-indigo-100', label: 'In Transit' },
  OUT_FOR_DELIVERY: { color: 'text-purple-800', bgColor: 'bg-purple-100', label: 'Out for Delivery' },
  DELIVERED: { color: 'text-green-800', bgColor: 'bg-green-100', label: 'Delivered' },
  FAILED: { color: 'text-red-800', bgColor: 'bg-red-100', label: 'Failed' },
  CANCELLED: { color: 'text-gray-800', bgColor: 'bg-gray-100', label: 'Cancelled' },
  INTERCEPTED: { color: 'text-orange-800', bgColor: 'bg-orange-100', label: 'Intercepted' },
  AT_CLEARANCE: { color: 'text-amber-800', bgColor: 'bg-amber-100', label: 'At Clearance' },
  CLEARED: { color: 'text-emerald-800', bgColor: 'bg-emerald-100', label: 'Cleared' },
}

// Create marker icons
const createIcon = (color: string, svg: string) => L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      ${svg}
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const originIcon = createIcon('#22c55e', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>')
const destinationIcon = createIcon('#ef4444', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>')

// Create truck icon with rotation
function createTruckIcon(bearing: number = 0, isPaused: boolean = false, isDragging: boolean = false): L.DivIcon {
  return L.divIcon({
    className: 'truck-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, ${isPaused ? '#dc2626' : isDragging ? '#059669' : '#333366'} 0%, ${isPaused ? '#991b1b' : isDragging ? '#047857' : '#1a1a4e'} 100%);
        border: 4px solid ${isDragging ? '#10b981' : 'white'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${isDragging ? '0 4px 20px rgba(16,185,129,0.6)' : '0 4px 15px rgba(0,0,0,0.4)'};
        transform: rotate(${bearing}deg) ${isDragging ? 'scale(1.1)' : ''};
        cursor: ${isDragging ? 'grabbing' : 'grab'};
        transition: transform 0.1s, border-color 0.2s, box-shadow 0.2s;
        ${isPaused ? '' : 'animation: pulse 2s infinite;'}
      ">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white" style="transform: rotate(-${bearing}deg);">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      </div>
      <style>
        @keyframes pulse {
          0% { box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 4px 25px rgba(51,51,102,0.6); }
          100% { box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        }
        .truck-marker:hover > div {
          transform: rotate(${bearing}deg) scale(1.05);
          cursor: grab;
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

// Map content component with imperative marker updates
function MapContent({
  origin,
  destination,
  routeLine,
  initialPosition,
  isPaused,
  showTruck,
  followTruck,
  truckPosition,
  onLocationUpdate,
  onMarkerRef,
  onProgressUpdate,
  onMapRef,
  onDragStateChange
}: {
  origin: L.LatLng
  destination: L.LatLng
  routeLine: L.LatLng[]
  initialPosition: L.LatLng
  isPaused: boolean
  showTruck: boolean
  followTruck: boolean
  truckPosition: L.LatLng | null
  onLocationUpdate: (lat: number, lng: number, progress: number) => void
  onMarkerRef: (marker: L.Marker | null) => void
  onProgressUpdate?: (progress: number) => void
  onMapRef?: (map: L.Map) => void
  onDragStateChange?: (isDragging: boolean) => void
}) {
  const map = useMap()
  const hasInitialized = useRef(false)
  const markerRef = useRef<L.Marker | null>(null)
  const isDraggingRef = useRef(false)

  // Store map ref
  useEffect(() => {
    onMapRef?.(map)
  }, [map, onMapRef])

  // Follow truck when enabled
  useEffect(() => {
    if (followTruck && truckPosition && showTruck) {
      map.panTo(truckPosition, { animate: true, duration: 0.5 })
    }
  }, [followTruck, truckPosition, showTruck, map])

  // Fit bounds on mount
  useEffect(() => {
    if (hasInitialized.current) return

    const bounds = L.latLngBounds([origin, destination])
    map.fitBounds(bounds, { padding: [80, 80] })
    hasInitialized.current = true
  }, [map, origin, destination])

  // Handle marker drag start
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
    onDragStateChange?.(true)
    const marker = markerRef.current
    if (marker) {
      marker.setIcon(createTruckIcon(0, isPaused, true))
    }
  }, [isPaused, onDragStateChange])

  // Handle marker drag - snap to route
  const handleDrag = useCallback(() => {
    const marker = markerRef.current
    if (marker && routeLine.length > 0) {
      const pos = marker.getLatLng()
      // Find nearest point on route
      const { point: snappedPoint } = findNearestPointOnRoute(pos, routeLine)
      // Update marker position to snapped point
      marker.setLatLng(snappedPoint)
    }
  }, [routeLine])

  // Handle marker drag end - snap to route and update
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    onDragStateChange?.(false)
    const marker = markerRef.current
    if (marker && routeLine.length > 0) {
      const pos = marker.getLatLng()
      // Find nearest point on route and progress
      const { point: snappedPoint, progress } = findNearestPointOnRoute(pos, routeLine)
      // Update marker to snapped position
      marker.setLatLng(snappedPoint)
      // Reset icon to normal
      marker.setIcon(createTruckIcon(0, isPaused, false))
      // Notify parent with snapped coordinates and progress
      onLocationUpdate(snappedPoint.lat, snappedPoint.lng, progress)
      if (onProgressUpdate) {
        onProgressUpdate(progress)
      }
    }
  }, [routeLine, onLocationUpdate, onProgressUpdate, isPaused, onDragStateChange])

  // Store marker ref
  useEffect(() => {
    return () => {
      onMarkerRef(null)
    }
  }, [onMarkerRef])

  return (
    <>
      {/* Route line (dashed) */}
      <Polyline
        positions={routeLine}
        pathOptions={{
          color: '#333366',
          weight: 4,
          opacity: 0.6,
          dashArray: '10, 10'
        }}
      />

      {/* Origin marker */}
      <Marker position={origin} icon={originIcon} />

      {/* Destination marker */}
      <Marker position={destination} icon={destinationIcon} />

      {/* Truck marker - IMPERATIVE UPDATES - Draggable by admin */}
      {showTruck && (
        <Marker
          position={initialPosition}
          icon={createTruckIcon(0, isPaused, false)}
          draggable={true}
          ref={(ref) => {
            markerRef.current = ref
            onMarkerRef(ref)
          }}
          eventHandlers={{
            dragstart: handleDragStart,
            drag: handleDrag,
            dragend: handleDragEnd,
          }}
        />
      )}
    </>
  )
}

// Info panel component
function InfoPanel({
  shipment,
  movementState,
  isExpanded,
  onToggle
}: {
  shipment: Shipment
  movementState: MovementState | null
  isExpanded: boolean
  onToggle: () => void
}) {
  const statusConfig = STATUS_CONFIG[shipment.currentStatus] || STATUS_CONFIG.PENDING

  return (
    <div className="absolute top-4 left-4 z-[1000] w-80 bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Package className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{shipment.trackingNumber}</p>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Route info */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-green-500" />
              <div>
                <p className="text-xs text-gray-500">Origin</p>
                <p className="text-sm text-gray-900">{shipment.originLocation}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-red-500" />
              <div>
                <p className="text-xs text-gray-500">Destination</p>
                <p className="text-sm text-gray-900">{shipment.destinationLocation}</p>
              </div>
            </div>
          </div>

          {/* Live stats */}
          {movementState && !movementState.hasArrived && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                  <Navigation className="w-3 h-3" />
                  <span>Distance</span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {formatDistance(movementState.distanceRemaining)}
                </p>
                <p className="text-xs text-gray-400">
                  {Math.round(movementState.progress * 100)}% complete
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                  <Clock className="w-3 h-3" />
                  <span>ETA</span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {movementState.eta.formattedRemaining}
                </p>
                <p className="text-xs text-gray-400">
                  {movementState.eta.formattedETA}
                </p>
              </div>
            </div>
          )}

          {/* Speed indicator */}
          {movementState && !movementState.hasArrived && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Speed</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(kmhToMph(movementState.speed))} mph
                </span>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {movementState && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round(movementState.progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${movementState.progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Animation speed presets (multiplier)
const SPEED_PRESETS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
]

// Vehicle speed presets in MPH
const VEHICLE_SPEED_PRESETS = [
  { label: '5 mph', value: 8 },      // ~8 km/h
  { label: '15 mph', value: 24 },    // ~24 km/h
  { label: '25 mph', value: 40 },    // ~40 km/h
  { label: '35 mph', value: 56 },    // ~56 km/h
  { label: '45 mph', value: 72 },    // ~72 km/h
  { label: '55 mph', value: 89 },    // ~89 km/h
  { label: '65 mph', value: 105 },   // ~105 km/h
]

// Convert mph to km/h
const mphToKmh = (mph: number) => mph * 1.60934

// Main component
export default function ShipmentMap({ shipment, onMovementStateChange }: Props) {
  const [isInfoExpanded, setIsInfoExpanded] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [movementState, setMovementState] = useState<MovementState | null>(null)
  const [routeLine, setRouteLine] = useState<L.LatLng[]>([])
  const [isRouteLoading, setIsRouteLoading] = useState(true)
  const [followTruck, setFollowTruck] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [vehicleSpeedKmh, setVehicleSpeedKmh] = useState(105) // Default ~65 mph
  const [truckPosition, setTruckPosition] = useState<L.LatLng | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Marker ref for imperative updates
  const markerRef = useRef<L.Marker | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const lastBearingRef = useRef<number>(0)

  // Calculate origin and destination coordinates
  const origin = useMemo(() => getCityCoordinates(shipment.originLocation), [shipment.originLocation])
  const destination = useMemo(() => getCityCoordinates(shipment.destinationLocation), [shipment.destinationLocation])

  // Fetch real route on mount
  useEffect(() => {
    const loadRoute = async () => {
      setIsRouteLoading(true)
      const route = await fetchRouteFromOSRM(origin, destination)
      setRouteLine(route)
      setIsRouteLoading(false)
    }
    loadRoute()
  }, [origin, destination])

  // Calculate total distance
  const totalDistance = useMemo(() => haversineDistance(origin, destination), [origin, destination])

  // Calculate average speed (from shipment or default)
  const averageSpeed = shipment.averageSpeed || 65 // km/h

  // Calculate trip duration
  const tripDuration = useMemo(() => {
    if (shipment.estimatedArrival && shipment.tripStartedAt) {
      return new Date(shipment.estimatedArrival).getTime() - new Date(shipment.tripStartedAt).getTime()
    }
    return (totalDistance / averageSpeed) * 60 * 60 * 1000 // hours to ms
  }, [totalDistance, averageSpeed, shipment.estimatedArrival, shipment.tripStartedAt])

  // Calculate initial progress from existing locations
  const initialProgress = useMemo(() => {
    if (shipment.remainingDistance && shipment.totalDistance) {
      const covered = shipment.totalDistance - shipment.remainingDistance
      return Math.min(1, covered / shipment.totalDistance)
    }
    return 0
  }, [shipment.remainingDistance, shipment.totalDistance])

  // Check if movement should be paused
  const isPaused = shipment.movementState ? !shipment.movementState.isMoving : false

  // Should show truck
  const showTruck = shipment.currentStatus !== 'DELIVERED' &&
                   shipment.currentStatus !== 'CANCELLED' &&
                   shipment.currentStatus !== 'PENDING'

  // Handle position updates from animation (IMPERATIVE MARKER UPDATE)
  const handlePositionUpdate = useCallback((state: MovementState) => {
    setMovementState(state)

    // Update truck position for following
    const newTruckPos = L.latLng(state.position.lat, state.position.lng)
    setTruckPosition(newTruckPos)

    // IMPERATIVE: Update marker position directly
    const marker = markerRef.current
    if (marker) {
      marker.setLatLng(newTruckPos)

      // Update icon if bearing changed significantly (> 5 degrees)
      if (Math.abs(state.bearing - lastBearingRef.current) > 5) {
        marker.setIcon(createTruckIcon(state.bearing, state.isPaused))
        lastBearingRef.current = state.bearing
      }
    }
  }, [])

  // Handle arrival
  const handleArrival = useCallback(() => {
    console.log('Shipment arrived at destination')
    // Could trigger a status update here
  }, [])

  // Handle map ref
  const handleMapRef = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  // Center on truck
  const centerOnTruck = useCallback(() => {
    if (mapRef.current && truckPosition) {
      mapRef.current.flyTo(truckPosition, 10, { animate: true, duration: 0.5 })
    }
  }, [truckPosition])

  // Convert routeLine (L.LatLng[]) to LatLng[] for the movement hook
  const routeAsLatLng = useMemo(() => {
    return routeLine.map(point => ({ lat: point.lat, lng: point.lng }))
  }, [routeLine])

  // Initialize movement hook with route for path-following movement
  const movement = useTimeBasedShipmentMovement({
    origin,
    destination,
    route: routeAsLatLng.length > 1 ? routeAsLatLng : undefined,
    durationMs: tripDuration,
    averageSpeedKmh: averageSpeed,
    initialProgress,
    startPaused: isPaused || !showTruck,
    onPositionUpdate: handlePositionUpdate,
    onArrival: handleArrival
  })

  // Handle animation speed change (multiplier)
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeedMultiplier(newSpeed)
    movement.setSpeedMultiplier(newSpeed)
  }, [movement])

  // Handle vehicle speed change (actual vehicle speed in km/h)
  const handleVehicleSpeedChange = useCallback((speedKmh: number) => {
    setVehicleSpeedKmh(speedKmh)
    movement.setVehicleSpeed(speedKmh)
  }, [movement])

  // Handle drag state change
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setIsDragging(dragging)
  }, [])

  // Handle location update from marker drag (with route snapping)
  const handleLocationUpdate = useCallback(async (lat: number, lng: number, progress: number) => {
    setIsUpdating(true)
    try {
      await api.post(`/movement/${shipment.id}/update-location`, {
        latitude: lat,
        longitude: lng,
      })

      // Use the progress from route snapping (more accurate than distance-based)
      movement.seekTo(progress)

      if (onMovementStateChange) {
        onMovementStateChange()
      }
    } catch (error) {
      console.error('Failed to update location:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [shipment.id, onMovementStateChange, movement])

  // Store marker ref
  const handleMarkerRef = useCallback((marker: L.Marker | null) => {
    markerRef.current = marker
  }, [])

  // Calculate center
  const center = useMemo(() => {
    if (movementState && !movementState.hasArrived) {
      return L.latLng(movementState.position.lat, movementState.position.lng)
    }
    return L.latLng(
      (origin.lat + destination.lat) / 2,
      (origin.lng + destination.lng) / 2
    )
  }, [origin, destination, movementState])

  // Leaflet LatLng conversions
  const originLatLng = useMemo(() => L.latLng(origin.lat, origin.lng), [origin])
  const destinationLatLng = useMemo(() => L.latLng(destination.lat, destination.lng), [destination])
  const initialPosition = useMemo(() => L.latLng(origin.lat, origin.lng), [origin])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapContent
          origin={originLatLng}
          destination={destinationLatLng}
          routeLine={routeLine}
          initialPosition={initialPosition}
          isPaused={isPaused}
          showTruck={showTruck}
          followTruck={followTruck}
          truckPosition={truckPosition}
          onLocationUpdate={handleLocationUpdate}
          onMarkerRef={handleMarkerRef}
          onMapRef={handleMapRef}
          onDragStateChange={handleDragStateChange}
        />
      </MapContainer>

      {/* Info panel */}
      <InfoPanel
        shipment={shipment}
        movementState={movementState}
        isExpanded={isInfoExpanded}
        onToggle={() => setIsInfoExpanded(!isInfoExpanded)}
      />

      {/* Updating indicator */}
      {isUpdating && (
        <div className="absolute top-4 right-4 z-[1000] bg-blue-600 text-white rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Updating location...</span>
          </div>
        </div>
      )}

      {/* Drag hint */}
      {showTruck && !isUpdating && (
        <div className={`absolute top-4 right-4 z-[1000] rounded-lg shadow-lg px-3 py-2 transition-colors ${
          isDragging ? 'bg-green-500 text-white' : 'bg-white'
        }`}>
          <div className="flex items-center space-x-2">
            <GripVertical className={`w-4 h-4 ${isDragging ? 'text-white' : 'text-gray-500'}`} />
            <span className={`text-xs ${isDragging ? 'text-white font-medium' : 'text-gray-600'}`}>
              {isDragging ? 'Release to set new position...' : 'Drag truck along route to reposition'}
            </span>
          </div>
        </div>
      )}

      {/* Speed Control Panel */}
      {showTruck && (
        <div className="absolute top-16 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 w-48">
          {/* Vehicle Speed Control */}
          <div className="mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-700">Vehicle Speed</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {VEHICLE_SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleVehicleSpeedChange(preset.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    vehicleSpeedKmh === preset.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-blue-600 text-center font-medium">
              {Math.round(kmhToMph(vehicleSpeedKmh))} mph
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-2"></div>

          {/* Animation Speed Control */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Navigation className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">Animation Speed</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleSpeedChange(preset.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    speedMultiplier === preset.value
                      ? 'bg-[#333366] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500 text-center">
              {speedMultiplier}x animation
            </div>
          </div>
        </div>
      )}

      {/* Truck Tracking Controls */}
      {showTruck && (
        <div className="absolute top-[340px] right-4 z-[1000] flex flex-col gap-2">
          {/* Center on truck button */}
          <button
            onClick={centerOnTruck}
            className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
            title="Center on truck"
          >
            <Crosshair className="w-5 h-5 text-gray-700" />
          </button>

          {/* Follow truck toggle */}
          <button
            onClick={() => setFollowTruck(!followTruck)}
            className={`rounded-lg shadow-lg p-2 transition-colors ${
              followTruck
                ? 'bg-[#333366] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title={followTruck ? 'Stop following truck' : 'Follow truck'}
          >
            <Navigation className={`w-5 h-5 ${followTruck ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      )}

      {/* Route loading indicator */}
      {isRouteLoading && (
        <div className="absolute bottom-20 right-4 z-[1000] bg-blue-600 text-white rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading route...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3">
        <p className="text-xs font-medium text-gray-700 mb-2">Legend</p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600">Origin</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-600">Destination</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-indigo-900" />
            <span className="text-xs text-gray-600">Current</span>
          </div>
        </div>
      </div>
    </div>
  )
}
