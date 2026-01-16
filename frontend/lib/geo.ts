/**
 * Geo Utility Module
 *
 * Provides geographic calculations for shipment tracking:
 * - Haversine distance calculation
 * - Great-circle interpolation for smooth movement
 * - Route distance calculations
 * - Bearing/heading calculations
 *
 * This module is additive and does not modify existing code.
 * Legacy shipments continue to work with simple linear interpolation.
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371

// Threshold for switching between great-circle and linear interpolation (km)
const GREAT_CIRCLE_THRESHOLD_KM = 100

export interface LatLng {
  lat: number
  lng: number
}

export interface RoutePoint extends LatLng {
  distanceFromStart?: number
  cumulativeDistance?: number
}

export interface InterpolationResult {
  position: LatLng
  bearing: number
  distanceCovered: number
  distanceRemaining: number
  progress: number
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Calculate the Haversine distance between two points in kilometers
 * This is the great-circle distance - the shortest path over the Earth's surface
 */
export function haversineDistance(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Calculate the initial bearing from one point to another (in degrees)
 * Returns bearing in range [0, 360)
 */
export function calculateBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const deltaLng = toRadians(to.lng - from.lng)

  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)

  const bearing = toDegrees(Math.atan2(y, x))
  return (bearing + 360) % 360
}

/**
 * Great-circle interpolation between two points
 * Uses spherical linear interpolation (slerp) for accurate paths over long distances
 *
 * @param from - Starting point
 * @param to - Ending point
 * @param t - Interpolation factor [0, 1]
 * @returns Interpolated position
 */
export function greatCircleInterpolate(from: LatLng, to: LatLng, t: number): LatLng {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t))

  const lat1 = toRadians(from.lat)
  const lng1 = toRadians(from.lng)
  const lat2 = toRadians(to.lat)
  const lng2 = toRadians(to.lng)

  // Calculate the angular distance
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng2 - lng1) / 2), 2)
  ))

  // Handle very small distances (avoid division by zero)
  if (d < 1e-10) {
    return { lat: from.lat, lng: from.lng }
  }

  const a = Math.sin((1 - t) * d) / Math.sin(d)
  const b = Math.sin(t * d) / Math.sin(d)

  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
  const z = a * Math.sin(lat1) + b * Math.sin(lat2)

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lng = Math.atan2(y, x)

  return {
    lat: toDegrees(lat),
    lng: toDegrees(lng)
  }
}

/**
 * Linear interpolation between two points
 * Used for short distances where great-circle overhead isn't needed
 */
export function linearInterpolate(from: LatLng, to: LatLng, t: number): LatLng {
  t = Math.max(0, Math.min(1, t))
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t
  }
}

/**
 * Smart interpolation that chooses between great-circle and linear
 * based on distance. Falls back to linear for short distances for performance.
 */
export function interpolatePosition(from: LatLng, to: LatLng, t: number): LatLng {
  const distance = haversineDistance(from, to)

  if (distance < GREAT_CIRCLE_THRESHOLD_KM) {
    return linearInterpolate(from, to, t)
  }

  return greatCircleInterpolate(from, to, t)
}

/**
 * Calculate the total distance of a route
 */
export function calculateRouteDistance(route: LatLng[]): number {
  if (route.length < 2) return 0

  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineDistance(route[i], route[i + 1])
  }
  return total
}

/**
 * Build a route with cumulative distances for efficient position lookup
 */
export function buildRouteWithDistances(route: LatLng[]): RoutePoint[] {
  if (route.length === 0) return []

  const result: RoutePoint[] = [{
    ...route[0],
    distanceFromStart: 0,
    cumulativeDistance: 0
  }]

  let cumulative = 0
  for (let i = 1; i < route.length; i++) {
    const segmentDistance = haversineDistance(route[i - 1], route[i])
    cumulative += segmentDistance
    result.push({
      ...route[i],
      distanceFromStart: segmentDistance,
      cumulativeDistance: cumulative
    })
  }

  return result
}

/**
 * Find position along a route at a given distance from start
 * Returns interpolated position between route points
 */
export function getPositionAtDistance(
  route: RoutePoint[],
  distance: number
): InterpolationResult {
  if (route.length === 0) {
    throw new Error('Route is empty')
  }

  if (route.length === 1) {
    return {
      position: { lat: route[0].lat, lng: route[0].lng },
      bearing: 0,
      distanceCovered: 0,
      distanceRemaining: 0,
      progress: 1
    }
  }

  const totalDistance = route[route.length - 1].cumulativeDistance || 0

  // Clamp distance
  distance = Math.max(0, Math.min(distance, totalDistance))

  // Find segment containing this distance
  let segmentIndex = 0
  for (let i = 1; i < route.length; i++) {
    if ((route[i].cumulativeDistance || 0) >= distance) {
      segmentIndex = i - 1
      break
    }
    segmentIndex = i - 1
  }

  const segmentStart = route[segmentIndex]
  const segmentEnd = route[Math.min(segmentIndex + 1, route.length - 1)]

  const segmentStartDist = segmentStart.cumulativeDistance || 0
  const segmentEndDist = segmentEnd.cumulativeDistance || 0
  const segmentLength = segmentEndDist - segmentStartDist

  // Calculate interpolation factor within segment
  const t = segmentLength > 0
    ? (distance - segmentStartDist) / segmentLength
    : 0

  const position = interpolatePosition(segmentStart, segmentEnd, t)
  const bearing = calculateBearing(segmentStart, segmentEnd)

  return {
    position,
    bearing,
    distanceCovered: distance,
    distanceRemaining: totalDistance - distance,
    progress: totalDistance > 0 ? distance / totalDistance : 1
  }
}

/**
 * Find position along a route at a given progress (0-1)
 */
export function getPositionAtProgress(
  route: RoutePoint[],
  progress: number
): InterpolationResult {
  if (route.length === 0) {
    throw new Error('Route is empty')
  }

  const totalDistance = route[route.length - 1].cumulativeDistance || 0
  const targetDistance = totalDistance * Math.max(0, Math.min(1, progress))

  return getPositionAtDistance(route, targetDistance)
}

/**
 * Calculate ETA based on remaining distance and speed
 * @param remainingDistance - Distance in km
 * @param speedKmh - Speed in km/h
 * @returns ETA as Date
 */
export function calculateETA(remainingDistance: number, speedKmh: number): Date {
  if (speedKmh <= 0) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000) // Default to 24 hours
  }

  const hoursRemaining = remainingDistance / speedKmh
  const msRemaining = hoursRemaining * 60 * 60 * 1000

  return new Date(Date.now() + msRemaining)
}

/**
 * Calculate remaining time in minutes
 */
export function calculateRemainingMinutes(remainingDistance: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0
  return (remainingDistance / speedKmh) * 60
}

/**
 * Generate intermediate points along a route for smoother animation
 * Useful when route has few points but needs smoother movement
 */
export function densifyRoute(route: LatLng[], maxSegmentKm: number = 50): LatLng[] {
  if (route.length < 2) return [...route]

  const result: LatLng[] = [route[0]]

  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1]
    const to = route[i]
    const distance = haversineDistance(from, to)

    if (distance > maxSegmentKm) {
      // Add intermediate points
      const segments = Math.ceil(distance / maxSegmentKm)
      for (let j = 1; j < segments; j++) {
        const t = j / segments
        result.push(interpolatePosition(from, to, t))
      }
    }

    result.push(to)
  }

  return result
}

/**
 * Convert km to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371
}

/**
 * Convert miles to km
 */
export function milesToKm(miles: number): number {
  return miles / 0.621371
}

/**
 * Format distance for display
 */
export function formatDistance(km: number, useMiles: boolean = true): string {
  const value = useMiles ? kmToMiles(km) : km
  const unit = useMiles ? 'mi' : 'km'

  if (value < 1) {
    return `${(value * (useMiles ? 5280 : 1000)).toFixed(0)} ${useMiles ? 'ft' : 'm'}`
  }

  return `${value.toFixed(1)} ${unit}`
}

/**
 * Format ETA for display
 */
export function formatETA(eta: Date): string {
  const now = new Date()
  const diffMs = eta.getTime() - now.getTime()

  if (diffMs <= 0) return 'Arrived'

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes} min`
}
