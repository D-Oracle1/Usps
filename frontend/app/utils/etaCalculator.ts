/**
 * ETA Calculator Utility
 *
 * Calculates estimated time of arrival based on:
 * - Remaining distance
 * - Current speed or average speed
 * - Elapsed time
 */

import { haversineDistance, type LatLng } from './bearing'

export interface ETAResult {
  eta: Date
  remainingMinutes: number
  remainingHours: number
  formattedETA: string
  formattedRemaining: string
}

export interface ProgressInfo {
  distanceCovered: number
  distanceRemaining: number
  percentComplete: number
  currentSpeed: number
}

/**
 * Calculate ETA based on remaining distance and speed
 *
 * @param remainingDistanceKm - Distance remaining in kilometers
 * @param speedKmh - Speed in kilometers per hour
 * @returns ETAResult object with formatted values
 */
export function calculateETA(remainingDistanceKm: number, speedKmh: number): ETAResult {
  if (speedKmh <= 0 || remainingDistanceKm <= 0) {
    const now = new Date()
    return {
      eta: now,
      remainingMinutes: 0,
      remainingHours: 0,
      formattedETA: 'Arrived',
      formattedRemaining: 'Arrived'
    }
  }

  const remainingHours = remainingDistanceKm / speedKmh
  const remainingMinutes = remainingHours * 60
  const remainingMs = remainingHours * 60 * 60 * 1000

  const eta = new Date(Date.now() + remainingMs)

  return {
    eta,
    remainingMinutes,
    remainingHours,
    formattedETA: formatETATime(eta),
    formattedRemaining: formatRemainingTime(remainingMinutes)
  }
}

/**
 * Calculate progress along a route
 *
 * @param origin - Starting point
 * @param destination - Ending point
 * @param currentPosition - Current position
 * @param speedKmh - Current speed in km/h
 * @returns Progress information
 */
export function calculateProgress(
  origin: LatLng,
  destination: LatLng,
  currentPosition: LatLng,
  speedKmh: number
): ProgressInfo {
  const totalDistance = haversineDistance(origin, destination)
  const distanceFromOrigin = haversineDistance(origin, currentPosition)
  const distanceToDestination = haversineDistance(currentPosition, destination)

  const distanceCovered = Math.min(distanceFromOrigin, totalDistance)
  const distanceRemaining = Math.max(0, distanceToDestination)
  const percentComplete = totalDistance > 0 ? (distanceCovered / totalDistance) * 100 : 0

  return {
    distanceCovered,
    distanceRemaining,
    percentComplete: Math.min(100, Math.max(0, percentComplete)),
    currentSpeed: speedKmh
  }
}

/**
 * Calculate trip duration based on total distance and speed
 *
 * @param totalDistanceKm - Total distance in kilometers
 * @param averageSpeedKmh - Average speed in km/h
 * @returns Duration in milliseconds
 */
export function calculateTripDuration(totalDistanceKm: number, averageSpeedKmh: number): number {
  if (averageSpeedKmh <= 0) return 0
  const hours = totalDistanceKm / averageSpeedKmh
  return hours * 60 * 60 * 1000
}

/**
 * Format ETA as a time string
 */
function formatETATime(eta: Date): string {
  const now = new Date()
  const isToday = eta.toDateString() === now.toDateString()

  if (isToday) {
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = eta.toDateString() === tomorrow.toDateString()

  if (isTomorrow) {
    return `Tomorrow ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  return eta.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format remaining time as human-readable string
 */
function formatRemainingTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Arrived'
  if (totalMinutes < 1) return 'Less than 1 min'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`
    }
    return `${days} day${days > 1 ? 's' : ''}`
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${hours}h`
  }

  return `${minutes} min`
}

/**
 * Format distance for display (km to miles)
 */
export function formatDistance(km: number, useMiles: boolean = true): string {
  const value = useMiles ? km * 0.621371 : km
  const unit = useMiles ? 'mi' : 'km'

  if (value < 0.1) {
    const feet = useMiles ? value * 5280 : value * 1000
    return `${Math.round(feet)} ${useMiles ? 'ft' : 'm'}`
  }

  if (value < 10) {
    return `${value.toFixed(1)} ${unit}`
  }

  return `${Math.round(value)} ${unit}`
}

/**
 * Convert km/h to mph
 */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371
}
