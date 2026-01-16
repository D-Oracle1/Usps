/**
 * Bearing Utility Module
 *
 * Calculates heading/bearing between two geographic points.
 * Used for rotating the truck icon to face the direction of travel.
 */

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Calculate the initial bearing from point A to point B
 * Returns bearing in degrees [0, 360)
 *
 * @param from - Starting point
 * @param to - Destination point
 * @returns Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
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
 * Calculate the Haversine distance between two points in kilometers
 */
export function haversineDistance(from: LatLng, to: LatLng): number {
  const R = 6371 // Earth's radius in km
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Interpolate between two points using great-circle interpolation
 *
 * @param from - Starting point
 * @param to - Ending point
 * @param t - Interpolation factor [0, 1]
 * @returns Interpolated position
 */
export function interpolatePosition(from: LatLng, to: LatLng, t: number): LatLng {
  t = Math.max(0, Math.min(1, t))

  // For short distances, use linear interpolation
  const distance = haversineDistance(from, to)
  if (distance < 100) {
    return {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t
    }
  }

  // Great-circle interpolation for longer distances
  const lat1 = toRadians(from.lat)
  const lng1 = toRadians(from.lng)
  const lat2 = toRadians(to.lat)
  const lng2 = toRadians(to.lng)

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng2 - lng1) / 2), 2)
  ))

  if (d < 1e-10) {
    return { lat: from.lat, lng: from.lng }
  }

  const a = Math.sin((1 - t) * d) / Math.sin(d)
  const b = Math.sin(t * d) / Math.sin(d)

  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
  const z = a * Math.sin(lat1) + b * Math.sin(lat2)

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDegrees(Math.atan2(y, x))
  }
}
