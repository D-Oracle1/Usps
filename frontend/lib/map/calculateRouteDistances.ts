import L from "leaflet"

interface RouteDistances {
  distances: number[]
  total: number
}

/**
 * Calculate cumulative distances along a polyline route
 * 
 * This function computes the distance from the start of the route to each point,
 * creating a cumulative distance array that can be used for smooth interpolation.
 * 
 * @param route - Array of Leaflet LatLng points representing the route
 * @returns Object containing distances array and total route distance
 */
export function calculateRouteDistances(route: L.LatLng[]): RouteDistances {
  if (!route || route.length === 0) {
    return { distances: [], total: 0 }
  }

  if (route.length === 1) {
    return { distances: [0], total: 0 }
  }

  const distances: number[] = [0] // Start distance is always 0
  let total = 0

  // Calculate cumulative distance for each segment
  for (let i = 1; i < route.length; i++) {
    // Use Leaflet's built-in distance calculation (accounts for Earth's curvature)
    const segmentDistance = route[i - 1].distanceTo(route[i])
    total += segmentDistance
    distances.push(total)
  }

  return { distances, total }
}

/**
 * Calculate distance between two LatLng points
 * 
 * @param from - Starting point
 * @param to - Ending point
 * @returns Distance in meters
 */
export function calculateDistance(from: L.LatLng, to: L.LatLng): number {
  return from.distanceTo(to)
}

/**
 * Format distance for display
 * 
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "1.2 km" or "850 m")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}
