import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateRouteDistances, calculateDistance, formatDistance } from '../calculateRouteDistances'

// Mock Leaflet
const mockLatLng = (lat: number, lng: number) => ({
  lat,
  lng,
  distanceTo: vi.fn((other: any) => {
    // Simplified distance calculation for testing (not accurate for real-world use)
    const R = 6371000 // Earth's radius in meters
    const dLat = (other.lat - lat) * Math.PI / 180
    const dLng = (other.lng - lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  })
})

vi.mock('leaflet', () => ({
  default: {
    latLng: (lat: number, lng: number) => mockLatLng(lat, lng)
  }
}))

describe('calculateRouteDistances', () => {
  it('returns empty distances for empty route', () => {
    const result = calculateRouteDistances([])
    expect(result.distances).toEqual([])
    expect(result.total).toBe(0)
  })

  it('returns zero distance for single point route', () => {
    const route = [mockLatLng(40.7128, -74.0060)] as any[]
    const result = calculateRouteDistances(route)
    expect(result.distances).toEqual([0])
    expect(result.total).toBe(0)
  })

  it('calculates cumulative distances for multi-point route', () => {
    const route = [
      mockLatLng(40.7128, -74.0060),  // New York
      mockLatLng(41.8781, -87.6298),  // Chicago
      mockLatLng(34.0522, -118.2437), // Los Angeles
    ] as any[]

    const result = calculateRouteDistances(route)

    // Should have 3 distances (one per point)
    expect(result.distances.length).toBe(3)

    // First distance should be 0
    expect(result.distances[0]).toBe(0)

    // Subsequent distances should be cumulative and increasing
    expect(result.distances[1]).toBeGreaterThan(0)
    expect(result.distances[2]).toBeGreaterThan(result.distances[1])

    // Total should equal the last cumulative distance
    expect(result.total).toBe(result.distances[2])
  })

  it('handles route with two points', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(1, 1),
    ] as any[]

    const result = calculateRouteDistances(route)

    expect(result.distances.length).toBe(2)
    expect(result.distances[0]).toBe(0)
    expect(result.distances[1]).toBeGreaterThan(0)
    expect(result.total).toBe(result.distances[1])
  })
})

describe('formatDistance', () => {
  it('formats meters for distances under 1km', () => {
    expect(formatDistance(500)).toBe('500 m')
    expect(formatDistance(999)).toBe('999 m')
    expect(formatDistance(50)).toBe('50 m')
  })

  it('formats kilometers for distances >= 1km', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(10000)).toBe('10.0 km')
  })

  it('rounds meters to nearest whole number', () => {
    expect(formatDistance(123.4)).toBe('123 m')
    expect(formatDistance(567.8)).toBe('568 m')
  })

  it('rounds kilometers to one decimal place', () => {
    expect(formatDistance(1234)).toBe('1.2 km')
    expect(formatDistance(9876)).toBe('9.9 km')
  })
})
