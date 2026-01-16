'use client'

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import { useEffect, useRef, useMemo, useState, useCallback } from "react"
import L from "leaflet"
import type { Shipment, Location } from "@/lib/types"
import api from "@/lib/api"
import {
  Package,
  MapPin,
  Truck,
  Clock,
  User,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Navigation,
  AlertCircle,
  GripVertical
} from "lucide-react"

interface Props {
  shipment: Shipment
  onMovementStateChange?: () => void
}

// Status colors and labels
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  PENDING: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', label: 'Pending' },
  PICKED_UP: { color: 'text-blue-800', bgColor: 'bg-blue-100', label: 'Picked Up' },
  IN_TRANSIT: { color: 'text-indigo-800', bgColor: 'bg-indigo-100', label: 'In Transit' },
  OUT_FOR_DELIVERY: { color: 'text-purple-800', bgColor: 'bg-purple-100', label: 'Out for Delivery' },
  DELIVERED: { color: 'text-green-800', bgColor: 'bg-green-100', label: 'Delivered' },
  FAILED: { color: 'text-red-800', bgColor: 'bg-red-100', label: 'Failed' },
  CANCELLED: { color: 'text-gray-800', bgColor: 'bg-gray-100', label: 'Cancelled' },
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

const truckIcon = L.divIcon({
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
      animation: pulse 2s infinite;
    ">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
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

// Get coordinates from location string
function getCityCoordinates(location: string): L.LatLng {
  const normalized = location.toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(city)) {
      return L.latLng(coords.lat, coords.lng)
    }
  }
  // Default to center of US
  return L.latLng(39.8283, -98.5795)
}

// Inner component that handles map logic
function MapContent({ shipment, route, currentPosition, onLocationUpdate }: {
  shipment: Shipment
  route: L.LatLng[]
  currentPosition: L.LatLng | null
  onLocationUpdate: (lat: number, lng: number) => void
}) {
  const map = useMap()
  const hasInitialized = useRef(false)
  const markerRef = useRef<L.Marker | null>(null)

  // Get origin and destination from shipment location strings
  const origin = useMemo(() => getCityCoordinates(shipment.originLocation), [shipment.originLocation])
  const destination = useMemo(() => getCityCoordinates(shipment.destinationLocation), [shipment.destinationLocation])

  // Generate route line from origin to destination
  const routeLine = useMemo(() => {
    const points: L.LatLng[] = []
    const steps = 20
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      points.push(L.latLng(
        origin.lat + (destination.lat - origin.lat) * t,
        origin.lng + (destination.lng - origin.lng) * t
      ))
    }
    return points
  }, [origin, destination])

  // Fit bounds to show entire route on mount
  useEffect(() => {
    if (hasInitialized.current) return

    const bounds = L.latLngBounds([origin, destination])
    map.fitBounds(bounds, { padding: [80, 80] })
    hasInitialized.current = true
  }, [map, origin, destination])

  // Handle marker drag end
  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current
    if (marker) {
      const position = marker.getLatLng()
      onLocationUpdate(position.lat, position.lng)
    }
  }, [onLocationUpdate])

  return (
    <>
      {/* Route line from origin to destination */}
      <Polyline
        positions={routeLine}
        pathOptions={{
          color: "#333366",
          weight: 4,
          opacity: 0.6,
          dashArray: shipment.currentStatus === 'DELIVERED' ? undefined : '10, 10'
        }}
      />

      {/* Traveled path (recorded locations) */}
      {route.length >= 2 && (
        <Polyline
          positions={route}
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

      {/* Current position / truck marker - DRAGGABLE (always show for admin) */}
      {shipment.currentStatus !== 'DELIVERED' && shipment.currentStatus !== 'CANCELLED' && (
        <Marker
          position={currentPosition || origin}
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

// Shipment info panel component
function ShipmentInfoPanel({ shipment, isExpanded, onToggle }: {
  shipment: Shipment
  isExpanded: boolean
  onToggle: () => void
}) {
  const statusConfig = STATUS_CONFIG[shipment.currentStatus] || STATUS_CONFIG.PENDING
  const isPaused = shipment.movementState && !shipment.movementState.isMoving

  return (
    <div className="absolute top-4 left-4 z-[1000] w-80 bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header - always visible */}
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
                {isPaused && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                    Paused
                  </span>
                )}
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Route info */}
          <div className="p-4 space-y-3">
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
            {shipment.currentLocation && (
              <div className="flex items-start space-x-3">
                <Navigation className="w-3 h-3 mt-1.5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Current Location</p>
                  <p className="text-sm text-gray-900">{shipment.currentLocation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Distance and ETA */}
          {(shipment.totalDistance || shipment.estimatedArrival) && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              {shipment.totalDistance && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Distance</p>
                  <p className="text-sm font-medium text-gray-900">
                    {shipment.totalDistance.toFixed(1)} mi
                  </p>
                  {shipment.remainingDistance !== null && shipment.remainingDistance !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      {shipment.remainingDistance.toFixed(1)} mi remaining
                    </p>
                  )}
                </div>
              )}
              {shipment.estimatedArrival && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">ETA</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(shipment.estimatedArrival).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(shipment.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Package details */}
          {(shipment.serviceType || shipment.packageWeight) && (
            <div className="px-4 pb-4">
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                {shipment.serviceType && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Service</span>
                    <span className="font-medium text-gray-900">{shipment.serviceType.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {shipment.packageWeight && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Weight</span>
                    <span className="font-medium text-gray-900">{shipment.packageWeight} lbs</span>
                  </div>
                )}
                {shipment.packageDimensions && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Dimensions</span>
                    <span className="font-medium text-gray-900">{shipment.packageDimensions}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sender / Recipient */}
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            {shipment.senderName && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Sender</p>
                <p className="text-sm font-medium text-gray-900">{shipment.senderName}</p>
                {shipment.senderPhone && (
                  <p className="text-xs text-gray-500">{shipment.senderPhone}</p>
                )}
              </div>
            )}
            {shipment.recipientName && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Recipient</p>
                <p className="text-sm font-medium text-gray-900">{shipment.recipientName}</p>
                {shipment.recipientPhone && (
                  <p className="text-xs text-gray-500">{shipment.recipientPhone}</p>
                )}
              </div>
            )}
          </div>

          {/* Special instructions */}
          {shipment.specialInstructions && (
            <div className="px-4 pb-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-yellow-800">Special Instructions</p>
                    <p className="text-sm text-yellow-700 mt-1">{shipment.specialInstructions}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Main component
export default function ShipmentMap({ shipment, onMovementStateChange }: Props) {
  const [isInfoExpanded, setIsInfoExpanded] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Handle location update when marker is dragged
  const handleLocationUpdate = useCallback(async (lat: number, lng: number) => {
    setIsUpdating(true)
    try {
      await api.post(`/movement/${shipment.id}/update-location`, {
        latitude: lat,
        longitude: lng,
      })
      // Refresh the shipment data
      if (onMovementStateChange) {
        onMovementStateChange()
      }
    } catch (error) {
      console.error('Failed to update location:', error)
      alert('Failed to update location')
    } finally {
      setIsUpdating(false)
    }
  }, [shipment.id, onMovementStateChange])

  // Build route from locations array
  const { route, currentPosition } = useMemo(() => {
    const locations = shipment.locations || []

    if (locations.length === 0) {
      // No locations recorded yet - show empty state
      return { route: [], currentPosition: null }
    }

    // Sort locations by recordedAt time (oldest first for route)
    const sortedLocations = [...locations].sort((a, b) =>
      new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    )

    // Build route from all recorded locations
    const routePoints = sortedLocations.map(loc =>
      L.latLng(loc.latitude, loc.longitude)
    )

    // Current position is the most recent location
    const latestLocation = sortedLocations[sortedLocations.length - 1]
    const currentPos = L.latLng(latestLocation.latitude, latestLocation.longitude)

    return { route: routePoints, currentPosition: currentPos }
  }, [shipment.locations])

  // Get origin coordinates for initial center
  const originCoords = useMemo(() => getCityCoordinates(shipment.originLocation), [shipment.originLocation])
  const destCoords = useMemo(() => getCityCoordinates(shipment.destinationLocation), [shipment.destinationLocation])

  // Calculate center for the map
  const center = useMemo(() => {
    if (currentPosition) {
      return currentPosition
    }
    // Center between origin and destination
    return L.latLng(
      (originCoords.lat + destCoords.lat) / 2,
      (originCoords.lng + destCoords.lng) / 2
    )
  }, [currentPosition, originCoords, destCoords])

  // No locations message
  const hasNoLocations = !shipment.locations || shipment.locations.length === 0

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={hasNoLocations ? 4 : 10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapContent
          shipment={shipment}
          route={route}
          currentPosition={currentPosition}
          onLocationUpdate={handleLocationUpdate}
        />
      </MapContainer>

      {/* Shipment info panel */}
      <ShipmentInfoPanel
        shipment={shipment}
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
      {currentPosition && shipment.currentStatus !== 'DELIVERED' && shipment.currentStatus !== 'PENDING' && !isUpdating && (
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
            <span className="text-xs text-gray-600">Current Location</span>
          </div>
        </div>
      </div>
    </div>
  )
}
