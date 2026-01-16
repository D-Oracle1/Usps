/**
 * Enhanced Shipment Map Component
 *
 * Drop-in replacement for shipment-map.tsx with advanced tracking features:
 * - Time-based smooth animation using requestAnimationFrame
 * - Great-circle interpolation for accurate long-distance paths
 * - Route polyline following
 * - Multi-stop support
 * - Admin controls (intercept, clear, reroute)
 * - Real-time ETA updates
 *
 * Backward Compatibility:
 * - Works with existing shipments (no route/stops data)
 * - Falls back to simple interpolation for legacy shipments
 * - All existing props and callbacks preserved
 */

'use client'

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import { useEffect, useRef, useMemo, useState, useCallback } from "react"
import L from "leaflet"
import type { Shipment, Location, ShipmentStop } from "@/lib/types"
import api from "@/lib/api"
import {
  Package,
  MapPin,
  Truck,
  Clock,
  Navigation,
  AlertCircle,
  GripVertical,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  useShipmentRouteEngine,
  useAdminShipmentControls,
  type ShipmentRouteState
} from "@/hooks"
import {
  LatLng,
  formatDistance,
  formatETA,
  kmToMiles
} from "@/lib/geo"

interface Props {
  shipment: Shipment
  onMovementStateChange?: () => void
  // New optional props for enhanced features
  enableAnimation?: boolean
  showAdminControls?: boolean
  onPositionUpdate?: (state: ShipmentRouteState) => void
  onArrival?: () => void
}

// Status colors and labels (extended)
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  PENDING: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', label: 'Pending' },
  PICKED_UP: { color: 'text-blue-800', bgColor: 'bg-blue-100', label: 'Picked Up' },
  IN_TRANSIT: { color: 'text-indigo-800', bgColor: 'bg-indigo-100', label: 'In Transit' },
  OUT_FOR_DELIVERY: { color: 'text-purple-800', bgColor: 'bg-purple-100', label: 'Out for Delivery' },
  DELIVERED: { color: 'text-green-800', bgColor: 'bg-green-100', label: 'Delivered' },
  FAILED: { color: 'text-red-800', bgColor: 'bg-red-100', label: 'Failed' },
  CANCELLED: { color: 'text-gray-800', bgColor: 'bg-gray-100', label: 'Cancelled' },
  // Extended statuses
  INTERCEPTED: { color: 'text-orange-800', bgColor: 'bg-orange-100', label: 'Intercepted' },
  AT_CLEARANCE: { color: 'text-amber-800', bgColor: 'bg-amber-100', label: 'At Clearance' },
  CLEARED: { color: 'text-emerald-800', bgColor: 'bg-emerald-100', label: 'Cleared' },
}

// Create custom marker icons
const createIcon = (color: string, icon: string) => L.divIcon({
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
      ${icon}
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const originIcon = createIcon('#22c55e', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>')
const destinationIcon = createIcon('#ef4444', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>')
const stopIcon = createIcon('#f59e0b', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>')
const interceptIcon = createIcon('#dc2626', '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>')

// Animated truck icon with rotation support
const createTruckIcon = (bearing: number = 0, isPaused: boolean = false) => L.divIcon({
  className: 'truck-marker',
  html: `
    <div style="
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, ${isPaused ? '#dc2626' : '#333366'} 0%, ${isPaused ? '#991b1b' : '#1a1a4e'} 100%);
      border: 4px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      transform: rotate(${bearing}deg);
      transition: transform 0.3s ease-out;
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
    </style>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
})

// City coordinates for mapping location strings
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
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
}

function getCityCoordinates(location: string): L.LatLng {
  const normalized = location.toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(city)) {
      return L.latLng(coords.lat, coords.lng)
    }
  }
  return L.latLng(39.8283, -98.5795)
}

// Map content component
function MapContent({
  shipment,
  routeState,
  onLocationUpdate,
  showStops = false
}: {
  shipment: Shipment
  routeState: ShipmentRouteState
  onLocationUpdate: (lat: number, lng: number) => void
  showStops?: boolean
}) {
  const map = useMap()
  const hasInitialized = useRef(false)
  const markerRef = useRef<L.Marker | null>(null)

  const origin = useMemo(() => getCityCoordinates(shipment.originLocation), [shipment.originLocation])
  const destination = useMemo(() => getCityCoordinates(shipment.destinationLocation), [shipment.destinationLocation])

  // Convert route state to Leaflet positions
  const routePositions = useMemo(() =>
    routeState.route.map(p => L.latLng(p.lat, p.lng)),
    [routeState.route]
  )

  // Current position from route engine
  const currentPosition = useMemo(() =>
    L.latLng(routeState.position.lat, routeState.position.lng),
    [routeState.position]
  )

  // Fit bounds on mount
  useEffect(() => {
    if (hasInitialized.current) return

    const bounds = L.latLngBounds([origin, destination])
    map.fitBounds(bounds, { padding: [80, 80] })
    hasInitialized.current = true
  }, [map, origin, destination])

  // Handle marker drag
  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current
    if (marker) {
      const position = marker.getLatLng()
      onLocationUpdate(position.lat, position.lng)
    }
  }, [onLocationUpdate])

  // Dynamic truck icon based on bearing and pause state
  const truckIcon = useMemo(() =>
    createTruckIcon(routeState.bearing, routeState.isPaused || routeState.isIntercepted),
    [routeState.bearing, routeState.isPaused, routeState.isIntercepted]
  )

  return (
    <>
      {/* Route polyline */}
      <Polyline
        positions={routePositions}
        pathOptions={{
          color: "#333366",
          weight: 4,
          opacity: 0.6,
          dashArray: routeState.hasArrived ? undefined : '10, 10'
        }}
      />

      {/* Traveled path (solid line showing progress) */}
      {routeState.progress > 0 && (
        <Polyline
          positions={routePositions.slice(0, Math.ceil(routePositions.length * routeState.progress) + 1)}
          pathOptions={{
            color: "#2563eb",
            weight: 5,
            opacity: 0.9,
          }}
        />
      )}

      {/* Origin marker */}
      <Marker position={origin} icon={originIcon} />

      {/* Destination marker */}
      <Marker position={destination} icon={destinationIcon} />

      {/* Stop markers */}
      {showStops && shipment.stops?.map((stop) => (
        <Marker
          key={stop.id}
          position={L.latLng(stop.lat, stop.lng)}
          icon={stop.type === 'INTERCEPTION' ? interceptIcon : stopIcon}
        />
      ))}

      {/* Truck marker - draggable for admin */}
      {!routeState.hasArrived && shipment.currentStatus !== 'CANCELLED' && (
        <Marker
          position={currentPosition}
          icon={truckIcon}
          draggable={true}
          ref={markerRef}
          eventHandlers={{
            dragend: handleDragEnd,
          }}
        />
      )}
    </>
  )
}

// Admin controls panel
function AdminControlsPanel({
  shipment,
  routeState,
  onIntercept,
  onClear,
  isLoading
}: {
  shipment: Shipment
  routeState: ShipmentRouteState
  onIntercept: (reason: string) => void
  onClear: (reason: string) => void
  isLoading: boolean
}) {
  const [interceptReason, setInterceptReason] = useState('')
  const [clearReason, setClearReason] = useState('')

  const isPaused = routeState.isPaused || routeState.isIntercepted

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4 w-72">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Admin Controls</h3>

      {isPaused ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Shipment Paused</span>
          </div>
          <input
            type="text"
            placeholder="Clear reason..."
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={() => {
              onClear(clearReason || 'Cleared by admin')
              setClearReason('')
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>Clear & Resume</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Intercept reason..."
            value={interceptReason}
            onChange={(e) => setInterceptReason(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => {
              onIntercept(interceptReason || 'Intercepted by admin')
              setInterceptReason('')
            }}
            disabled={isLoading || !routeState.isMoving}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            <Pause className="w-4 h-4" />
            <span>Intercept Shipment</span>
          </button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{Math.round(routeState.progress * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${routeState.progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Info panel component
function ShipmentInfoPanel({
  shipment,
  routeState,
  isExpanded,
  onToggle
}: {
  shipment: Shipment
  routeState: ShipmentRouteState
  isExpanded: boolean
  onToggle: () => void
}) {
  const statusConfig = STATUS_CONFIG[shipment.currentStatus] || STATUS_CONFIG.PENDING

  return (
    <div className="absolute top-4 left-4 z-[1000] w-80 bg-white rounded-lg shadow-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Package className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {shipment.trackingNumber}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {routeState.isPaused && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                    Paused
                  </span>
                )}
                {routeState.isIntercepted && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    Intercepted
                  </span>
                )}
              </div>
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Route info */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-green-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Origin</p>
                <p className="text-sm text-gray-900">{shipment.originLocation}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-red-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Destination</p>
                <p className="text-sm text-gray-900">{shipment.destinationLocation}</p>
              </div>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Distance</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDistance(routeState.distanceRemaining)}
              </p>
              <p className="text-xs text-gray-400">
                of {formatDistance(routeState.totalDistance)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">ETA</p>
              <p className="text-sm font-medium text-gray-900">
                {routeState.eta ? formatETA(routeState.eta) : 'N/A'}
              </p>
              <p className="text-xs text-gray-400">
                {routeState.etaMinutes > 0 ? `${Math.round(routeState.etaMinutes)} min` : ''}
              </p>
            </div>
          </div>

          {/* Speed */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Current Speed</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round(kmToMiles(routeState.speed))} mph
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main component
export default function EnhancedShipmentMap({
  shipment,
  onMovementStateChange,
  enableAnimation = true,
  showAdminControls = true,
  onPositionUpdate,
  onArrival
}: Props) {
  const [isInfoExpanded, setIsInfoExpanded] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Use the shipment route engine
  const routeEngine = useShipmentRouteEngine({
    shipment,
    route: shipment.route?.map(p => ({ lat: p.lat, lng: p.lng })),
    stops: shipment.stops,
    onPositionUpdate,
    onArrival
  })

  // Admin controls
  const adminControls = useAdminShipmentControls(shipment, onMovementStateChange)

  // Handle location update from marker drag
  const handleLocationUpdate = useCallback(async (lat: number, lng: number) => {
    setIsUpdating(true)
    try {
      await adminControls.updateLocation({ latitude: lat, longitude: lng })
      routeEngine.setPosition({ lat, lng })
    } catch (error) {
      console.error('Failed to update location:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [adminControls, routeEngine])

  // Handle intercept
  const handleIntercept = useCallback(async (reason: string) => {
    await adminControls.intercept({ reason })
    routeEngine.pause()
  }, [adminControls, routeEngine])

  // Handle clear
  const handleClear = useCallback(async (reason: string) => {
    await adminControls.clear({ reason })
    routeEngine.resume()
  }, [adminControls, routeEngine])

  // Get origin for initial center
  const origin = useMemo(() => getCityCoordinates(shipment.originLocation), [shipment.originLocation])
  const destination = useMemo(() => getCityCoordinates(shipment.destinationLocation), [shipment.destinationLocation])

  // Center calculation
  const center = useMemo(() => {
    if (routeEngine.state.progress > 0) {
      return L.latLng(routeEngine.state.position.lat, routeEngine.state.position.lng)
    }
    return L.latLng(
      (origin.lat + destination.lat) / 2,
      (origin.lng + destination.lng) / 2
    )
  }, [routeEngine.state.position, routeEngine.state.progress, origin, destination])

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
          shipment={shipment}
          routeState={routeEngine.state}
          onLocationUpdate={handleLocationUpdate}
          showStops={!!shipment.stops?.length}
        />
      </MapContainer>

      {/* Info panel */}
      <ShipmentInfoPanel
        shipment={shipment}
        routeState={routeEngine.state}
        isExpanded={isInfoExpanded}
        onToggle={() => setIsInfoExpanded(!isInfoExpanded)}
      />

      {/* Admin controls */}
      {showAdminControls && (
        <AdminControlsPanel
          shipment={shipment}
          routeState={routeEngine.state}
          onIntercept={handleIntercept}
          onClear={handleClear}
          isLoading={adminControls.state.isLoading}
        />
      )}

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
      {!routeEngine.state.hasArrived && shipment.currentStatus !== 'PENDING' && !isUpdating && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="flex items-center space-x-2">
            <GripVertical className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Drag truck to update location</span>
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
          {shipment.stops?.length && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-600">Stop</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
