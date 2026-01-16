'use client'

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import { useEffect, useRef, useMemo, useState } from "react"
import L from "leaflet"
import type { Shipment, Location } from "@/lib/types"
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
  AlertCircle
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

// Inner component that handles map logic
function MapContent({ shipment, route, currentPosition }: {
  shipment: Shipment
  route: L.LatLng[]
  currentPosition: L.LatLng | null
}) {
  const map = useMap()
  const hasInitialized = useRef(false)

  // Fit bounds to show entire route on mount
  useEffect(() => {
    if (hasInitialized.current) return

    if (route.length >= 2) {
      const bounds = L.latLngBounds(route)
      map.fitBounds(bounds, { padding: [80, 80] })
      hasInitialized.current = true
    } else if (currentPosition) {
      map.setView(currentPosition, 12)
      hasInitialized.current = true
    }
  }, [map, route, currentPosition])

  // Get origin and destination from route
  const origin = route.length > 0 ? route[0] : null
  const destination = route.length > 1 ? route[route.length - 1] : null

  return (
    <>
      {/* Route line showing the path */}
      {route.length >= 2 && (
        <Polyline
          positions={route}
          pathOptions={{
            color: "#2563eb",
            weight: 4,
            opacity: 0.8,
            dashArray: shipment.currentStatus === 'DELIVERED' ? undefined : '10, 10'
          }}
        />
      )}

      {/* Origin marker */}
      {origin && (
        <Marker position={origin} icon={originIcon} />
      )}

      {/* Destination marker */}
      {destination && (
        <Marker position={destination} icon={destinationIcon} />
      )}

      {/* Current position / truck marker */}
      {currentPosition && shipment.currentStatus !== 'DELIVERED' && shipment.currentStatus !== 'PENDING' && (
        <Marker position={currentPosition} icon={truckIcon} />
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

  // Calculate center for the map
  const center = useMemo(() => {
    if (currentPosition) {
      return currentPosition
    }
    if (route.length > 0) {
      return route[0]
    }
    // Default to center of US
    return L.latLng(39.8283, -98.5795)
  }, [route, currentPosition])

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
        />
      </MapContainer>

      {/* Shipment info panel */}
      <ShipmentInfoPanel
        shipment={shipment}
        isExpanded={isInfoExpanded}
        onToggle={() => setIsInfoExpanded(!isInfoExpanded)}
      />

      {/* No locations warning */}
      {hasNoLocations && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                No location data recorded yet. The map will update once tracking begins.
              </p>
            </div>
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
