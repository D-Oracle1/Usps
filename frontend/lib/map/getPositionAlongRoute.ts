import L from "leaflet"

/**
 * Get position along a route based on distance traveled
 * 
 * This function finds the exact position along a multi-segment polyline route
 * by determining which segment the traveled distance falls within and then
 * interpolating within that segment.
 * 
 * @param route - Array of Leaflet LatLng points representing the route
 * @param distances - Cumulative distances array from calculateRouteDistances
 * @param traveled - Distance traveled from the start (in meters)
 * @returns LatLng position along the route
 */
export function getPositionAlongRoute(
  route: L.LatLng[],
  distances: number[],
  traveled: number
): L.LatLng {
  // Handle edge cases
  if (!route || route.length === 0) {
    return L.latLng(0, 0)
  }

  if (route.length === 1) {
    return route[0]
  }

  // Clamp traveled distance to route bounds
  const totalDistance = distances[distances.length - 1]
  const clampedTraveled = Math.max(0, Math.min(traveled, totalDistance))

  // If at the start or beyond the end, return appropriate point
  if (clampedTraveled === 0) {
    return route[0]
  }
  
  if (clampedTraveled >= totalDistance) {
    return route[route.length - 1]
  }

  // Find which segment the traveled distance falls within
  for (let i = 1; i < distances.length; i++) {
    if (clampedTraveled <= distances[i]) {
      // Calculate progress within this segment
      const segmentStartDistance = distances[i - 1]
      const segmentEndDistance = distances[i]
      const segmentDistance = segmentEndDistance - segmentStartDistance
      
      const segmentProgress = (clampedTraveled - segmentStartDistance) / segmentDistance

      // Get the start and end points of this segment
      const from = route[i - 1]
      const to = route[i]

      // Linear interpolation within the segment
      // For short distances (< 1000km), linear interpolation is sufficient and performant
      const lat = from.lat + (to.lat - from.lat) * segmentProgress
      const lng = from.lng + (to.lng - from.lng) * segmentProgress

      return L.latLng(lat, lng)
    }
  }

  // Fallback (should not reach here with proper input)
  return route[route.length - 1]
}

/**
 * Get progress percentage along route
 * 
 * @param distances - Cumulative distances array from calculateRouteDistances
 * @param traveled - Distance traveled from the start (in meters)
 * @returns Progress as a percentage (0-1)
 */
export function getRouteProgress(
  distances: number[],
  traveled: number
): number {
  if (!distances || distances.length === 0) {
    return 0
  }

  const totalDistance = distances[distances.length - 1]
  
  if (totalDistance === 0) {
    return 0
  }

  return Math.max(0, Math.min(traveled / totalDistance, 1))
}

/**
 * Get remaining distance to destination
 * 
 * @param distances - Cumulative distances array from calculateRouteDistances
 * @param traveled - Distance traveled from the start (in meters)
 * @returns Remaining distance in meters
 */
export function getRemainingDistance(
  distances: number[],
  traveled: number
): number {
  if (!distances || distances.length === 0) {
    return 0
  }

  const totalDistance = distances[distances.length - 1]
  return Math.max(0, totalDistance - Math.min(traveled, totalDistance))
}
