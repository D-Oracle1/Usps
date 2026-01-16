/**
 * useShipmentRouteEngine Hook
 *
 * Integrates time-based movement with shipment data.
 * Handles route generation, multi-stop support, and real-time updates.
 *
 * Features:
 * - Automatic route generation from origin/destination
 * - Multi-stop support (optional, backward-compatible)
 * - Real-time ETA calculation
 * - WebSocket integration for live updates
 * - Pause/resume state sync with backend
 *
 * Legacy Support:
 * - Shipments without route data use generated routes
 * - Existing shipment fields remain unchanged
 */

import { useRef, useCallback, useEffect, useMemo } from 'react'
import type { Shipment, Location } from '@/lib/types'
import {
  LatLng,
  haversineDistance,
  calculateETA,
  calculateRemainingMinutes,
  buildRouteWithDistances,
  getPositionAtProgress,
  interpolatePosition
} from '@/lib/geo'
import { useTimeBasedRouteMovement, MovementState } from './useTimeBasedRouteMovement'

// Stop types for multi-stop shipments
export type StopType = 'PICKUP' | 'INTERCEPTION' | 'CLEARANCE' | 'DELIVERY' | 'WAYPOINT'

export interface ShipmentStop {
  id: string
  type: StopType
  lat: number
  lng: number
  label?: string
  dwellTimeMs?: number
  completed?: boolean
  completedAt?: Date
}

export interface ShipmentRouteState {
  // Current position
  position: LatLng
  bearing: number
  speed: number
  // Progress
  progress: number
  distanceCovered: number
  distanceRemaining: number
  // ETA
  eta: Date | null
  etaMinutes: number
  // Status
  isMoving: boolean
  isPaused: boolean
  hasArrived: boolean
  isIntercepted: boolean
  // Multi-stop (optional)
  currentStop?: ShipmentStop
  nextStop?: ShipmentStop
  stopsCompleted: number
  totalStops: number
  // Route info
  totalDistance: number
  route: LatLng[]
}

export interface UseShipmentRouteEngineConfig {
  // Shipment data
  shipment: Shipment
  // Optional pre-defined route (overrides auto-generation)
  route?: LatLng[]
  // Optional stops for multi-stop shipments
  stops?: ShipmentStop[]
  // Average speed in km/h (default from shipment or 65)
  averageSpeed?: number
  // Position update callback (throttled)
  onPositionUpdate?: (state: ShipmentRouteState) => void
  // Arrival callback
  onArrival?: () => void
  // Stop reached callback
  onStopReached?: (stop: ShipmentStop) => void
  // ETA update callback
  onETAUpdate?: (eta: Date, remainingMinutes: number) => void
}

export interface UseShipmentRouteEngineResult {
  // Current state
  state: ShipmentRouteState
  // Computed route
  route: LatLng[]
  // Control methods
  start: () => void
  pause: (reason?: string) => void
  resume: (reason?: string) => void
  stop: () => void
  // Admin reroute - updates destination while preserving position
  reroute: (newDestination: LatLng, label?: string) => void
  // Manually set position (admin drag)
  setPosition: (position: LatLng) => void
  // Add stop mid-route
  addStop: (stop: ShipmentStop) => void
  // Mark stop as completed
  completeStop: (stopId: string) => void
  // Get ETA at current state
  getCurrentETA: () => Date | null
}

// City coordinates lookup (matches backend)
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
}

// Default US center
const DEFAULT_COORDINATES: LatLng = { lat: 39.8283, lng: -98.5795 }

function getCityCoordinates(location: string): LatLng {
  const normalized = location.toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(city)) {
      return coords
    }
  }
  return DEFAULT_COORDINATES
}

function generateRoute(origin: LatLng, destination: LatLng, stops?: ShipmentStop[]): LatLng[] {
  const route: LatLng[] = [origin]

  // Add stops in order
  if (stops && stops.length > 0) {
    const sortedStops = [...stops].sort((a, b) => {
      // Delivery always last
      if (a.type === 'DELIVERY') return 1
      if (b.type === 'DELIVERY') return -1
      // Pickup always first
      if (a.type === 'PICKUP') return -1
      if (b.type === 'PICKUP') return 1
      return 0
    })

    for (const stop of sortedStops) {
      route.push({ lat: stop.lat, lng: stop.lng })
    }
  }

  // Add intermediate points for smooth animation
  const points: LatLng[] = [origin]
  const segments = stops ? route.length - 1 : 1
  const pointsPerSegment = Math.max(5, Math.floor(20 / segments))

  if (stops && stops.length > 0) {
    // Multi-stop: interpolate between each stop
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i]
      const to = route[i + 1]
      for (let j = 1; j <= pointsPerSegment; j++) {
        const t = j / pointsPerSegment
        points.push(interpolatePosition(from, to, t))
      }
    }
  } else {
    // Direct route: generate curved path
    const distance = haversineDistance(origin, destination)
    const curveAmount = distance < 100 ? 0.01 : Math.min(0.1, distance / 5000)

    for (let i = 1; i <= 20; i++) {
      const t = i / 20
      const lat = origin.lat + (destination.lat - origin.lat) * t
      const lng = origin.lng + (destination.lng - origin.lng) * t

      // Add slight curve
      const curveOffset = curveAmount * Math.sin(t * Math.PI)
      const angle = Math.atan2(destination.lng - origin.lng, destination.lat - origin.lat)

      points.push({
        lat: lat + curveOffset * Math.cos(angle + Math.PI / 2),
        lng: lng + curveOffset * Math.sin(angle + Math.PI / 2)
      })
    }
  }

  if (points[points.length - 1].lat !== destination.lat ||
      points[points.length - 1].lng !== destination.lng) {
    points.push(destination)
  }

  return points
}

export function useShipmentRouteEngine(
  config: UseShipmentRouteEngineConfig
): UseShipmentRouteEngineResult {
  const {
    shipment,
    route: providedRoute,
    stops: providedStops,
    averageSpeed,
    onPositionUpdate,
    onArrival,
    onStopReached,
    onETAUpdate
  } = config

  // Compute origin and destination
  const origin = useMemo(() =>
    getCityCoordinates(shipment.originLocation),
    [shipment.originLocation]
  )

  const destination = useMemo(() =>
    getCityCoordinates(shipment.destinationLocation),
    [shipment.destinationLocation]
  )

  // Build or use provided route
  const route = useMemo(() => {
    if (providedRoute && providedRoute.length >= 2) {
      return providedRoute
    }
    return generateRoute(origin, destination, providedStops)
  }, [providedRoute, origin, destination, providedStops])

  // Calculate total distance
  const totalDistance = useMemo(() => {
    if (shipment.totalDistance) return shipment.totalDistance
    let total = 0
    for (let i = 0; i < route.length - 1; i++) {
      total += haversineDistance(route[i], route[i + 1])
    }
    return total
  }, [route, shipment.totalDistance])

  // Calculate trip duration based on speed or existing ETA
  const tripDurationMs = useMemo(() => {
    if (shipment.estimatedArrival && shipment.tripStartedAt) {
      const eta = new Date(shipment.estimatedArrival)
      const started = new Date(shipment.tripStartedAt)
      return eta.getTime() - started.getTime()
    }
    const speed = averageSpeed || shipment.averageSpeed || 65
    const hours = totalDistance / speed
    return hours * 60 * 60 * 1000
  }, [shipment.estimatedArrival, shipment.tripStartedAt, totalDistance, averageSpeed, shipment.averageSpeed])

  // Calculate initial progress from existing location
  const initialProgress = useMemo(() => {
    if (!shipment.locations || shipment.locations.length === 0) return 0
    if (shipment.remainingDistance && shipment.totalDistance) {
      const covered = shipment.totalDistance - shipment.remainingDistance
      return Math.min(1, covered / shipment.totalDistance)
    }
    return 0
  }, [shipment.locations, shipment.remainingDistance, shipment.totalDistance])

  // Determine if movement should start paused
  const isPaused = shipment.movementState ? !shipment.movementState.isMoving : false

  // Stops management
  const stopsRef = useRef<ShipmentStop[]>(providedStops || [])
  const completedStopsRef = useRef<Set<string>>(new Set())

  // Use the time-based movement hook
  const movement = useTimeBasedRouteMovement(route, {
    durationMs: tripDurationMs,
    startProgress: initialProgress,
    startPaused: isPaused,
    updateThrottleMs: 33,
    onPositionUpdate: (movementState) => {
      // Check for stop proximity
      const currentPos = movementState.position
      for (const stop of stopsRef.current) {
        if (completedStopsRef.current.has(stop.id)) continue

        const distToStop = haversineDistance(currentPos, { lat: stop.lat, lng: stop.lng })
        if (distToStop < 1) { // Within 1km
          completedStopsRef.current.add(stop.id)
          onStopReached?.(stop)
        }
      }

      // Calculate ETA
      const speed = averageSpeed || shipment.averageSpeed || 65
      const eta = calculateETA(movementState.distanceRemaining, speed)
      const etaMinutes = calculateRemainingMinutes(movementState.distanceRemaining, speed)

      onETAUpdate?.(eta, etaMinutes)

      // Build full state
      const state: ShipmentRouteState = {
        position: movementState.position,
        bearing: movementState.bearing,
        speed: movementState.speed,
        progress: movementState.progress,
        distanceCovered: movementState.distanceCovered,
        distanceRemaining: movementState.distanceRemaining,
        eta,
        etaMinutes,
        isMoving: movementState.isMoving,
        isPaused: movementState.isPaused,
        hasArrived: movementState.hasArrived,
        isIntercepted: shipment.movementState?.interceptReason ? true : false,
        stopsCompleted: completedStopsRef.current.size,
        totalStops: stopsRef.current.length,
        totalDistance,
        route
      }

      onPositionUpdate?.(state)
    },
    onArrival
  })

  // Build current state
  const state: ShipmentRouteState = useMemo(() => {
    const speed = averageSpeed || shipment.averageSpeed || 65
    const eta = calculateETA(movement.state.distanceRemaining, speed)
    const etaMinutes = calculateRemainingMinutes(movement.state.distanceRemaining, speed)

    return {
      position: movement.state.position,
      bearing: movement.state.bearing,
      speed: movement.state.speed,
      progress: movement.state.progress,
      distanceCovered: movement.state.distanceCovered,
      distanceRemaining: movement.state.distanceRemaining,
      eta,
      etaMinutes,
      isMoving: movement.state.isMoving,
      isPaused: movement.state.isPaused,
      hasArrived: movement.state.hasArrived,
      isIntercepted: !!shipment.movementState?.interceptReason,
      stopsCompleted: completedStopsRef.current.size,
      totalStops: stopsRef.current.length,
      totalDistance,
      route
    }
  }, [movement.state, shipment.movementState, totalDistance, route, averageSpeed, shipment.averageSpeed])

  // Reroute to new destination
  const reroute = useCallback((newDestination: LatLng, label?: string) => {
    const currentPos = movement.state.position
    const newRoute = generateRoute(currentPos, newDestination, stopsRef.current)

    // Calculate new progress (start from beginning of new route)
    movement.updateRoute(newRoute)

    // Recalculate duration based on new distance
    const newDistance = haversineDistance(currentPos, newDestination)
    const speed = averageSpeed || shipment.averageSpeed || 65
    const newDurationMs = (newDistance / speed) * 60 * 60 * 1000
    movement.updateDuration(newDurationMs)
  }, [movement, averageSpeed, shipment.averageSpeed])

  // Manually set position (admin drag)
  const setPosition = useCallback((position: LatLng) => {
    // Calculate progress based on distance from start
    const distanceFromStart = haversineDistance(origin, position)
    const newProgress = Math.min(1, distanceFromStart / totalDistance)
    movement.seekTo(newProgress)
  }, [movement, origin, totalDistance])

  // Add stop mid-route
  const addStop = useCallback((stop: ShipmentStop) => {
    stopsRef.current = [...stopsRef.current, stop]
    // Regenerate route with new stop
    const currentPos = movement.state.position
    const newRoute = generateRoute(currentPos, destination, stopsRef.current)
    movement.updateRoute(newRoute)
  }, [movement, destination])

  // Complete a stop
  const completeStop = useCallback((stopId: string) => {
    completedStopsRef.current.add(stopId)
    const stop = stopsRef.current.find(s => s.id === stopId)
    if (stop) {
      onStopReached?.(stop)
    }
  }, [onStopReached])

  // Get current ETA
  const getCurrentETA = useCallback(() => {
    const speed = averageSpeed || shipment.averageSpeed || 65
    return calculateETA(movement.state.distanceRemaining, speed)
  }, [movement.state.distanceRemaining, averageSpeed, shipment.averageSpeed])

  // Auto-start if shipment is in transit
  useEffect(() => {
    if (shipment.currentStatus === 'IN_TRANSIT' && !isPaused && !movement.state.isMoving) {
      movement.start()
    }
  }, [shipment.currentStatus, isPaused, movement])

  return {
    state,
    route,
    start: movement.start,
    pause: movement.pause,
    resume: movement.resume,
    stop: movement.stop,
    reroute,
    setPosition,
    addStop,
    completeStop,
    getCurrentETA
  }
}

export default useShipmentRouteEngine
