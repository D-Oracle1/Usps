import { describe, it, expect, vi } from 'vitest'
import { getPositionAlongRoute, getRouteProgress, getRemainingDistance } from '../getPositionAlongRoute'

// Mock Leaflet
const mockLatLng = (lat: number, lng: number) => ({
  lat,
  lng,
})

vi.mock('leaflet', () => ({
  default: {
    latLng: (lat: number, lng: number) => mockLatLng(lat, lng)
  }
}))

describe('getPositionAlongRoute', () => {
  it('returns origin (0, 0) for empty route', () => {
    const result = getPositionAlongRoute([], [], 100)
    expect(result.lat).toBe(0)
    expect(result.lng).toBe(0)
  })

  it('returns single point for single-point route', () => {
    const route = [mockLatLng(40.7128, -74.0060)] as any[]
    const result = getPositionAlongRoute(route, [0], 100)
    expect(result.lat).toBe(40.7128)
    expect(result.lng).toBe(-74.0060)
  })

  it('returns start point when traveled distance is 0', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(10, 10),
    ] as any[]
    const distances = [0, 1000]

    const result = getPositionAlongRoute(route, distances, 0)
    expect(result.lat).toBe(0)
    expect(result.lng).toBe(0)
  })

  it('returns end point when traveled distance equals or exceeds total', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(10, 10),
    ] as any[]
    const distances = [0, 1000]

    const result = getPositionAlongRoute(route, distances, 1000)
    expect(result.lat).toBe(10)
    expect(result.lng).toBe(10)

    const overResult = getPositionAlongRoute(route, distances, 2000)
    expect(overResult.lat).toBe(10)
    expect(overResult.lng).toBe(10)
  })

  it('interpolates correctly at midpoint of segment', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(10, 10),
    ] as any[]
    const distances = [0, 1000]

    const result = getPositionAlongRoute(route, distances, 500)
    expect(result.lat).toBe(5)
    expect(result.lng).toBe(5)
  })

  it('interpolates correctly at 25% of segment', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(100, 200),
    ] as any[]
    const distances = [0, 1000]

    const result = getPositionAlongRoute(route, distances, 250)
    expect(result.lat).toBe(25)
    expect(result.lng).toBe(50)
  })

  it('handles multi-segment routes correctly', () => {
    const route = [
      mockLatLng(0, 0),     // Start
      mockLatLng(10, 10),   // Waypoint 1
      mockLatLng(20, 20),   // End
    ] as any[]
    const distances = [0, 1000, 2000]

    // At start of first segment
    let result = getPositionAlongRoute(route, distances, 0)
    expect(result.lat).toBe(0)
    expect(result.lng).toBe(0)

    // Midpoint of first segment
    result = getPositionAlongRoute(route, distances, 500)
    expect(result.lat).toBe(5)
    expect(result.lng).toBe(5)

    // At waypoint
    result = getPositionAlongRoute(route, distances, 1000)
    expect(result.lat).toBe(10)
    expect(result.lng).toBe(10)

    // Midpoint of second segment
    result = getPositionAlongRoute(route, distances, 1500)
    expect(result.lat).toBe(15)
    expect(result.lng).toBe(15)

    // At end
    result = getPositionAlongRoute(route, distances, 2000)
    expect(result.lat).toBe(20)
    expect(result.lng).toBe(20)
  })

  it('clamps negative traveled distance to 0', () => {
    const route = [
      mockLatLng(0, 0),
      mockLatLng(10, 10),
    ] as any[]
    const distances = [0, 1000]

    const result = getPositionAlongRoute(route, distances, -500)
    expect(result.lat).toBe(0)
    expect(result.lng).toBe(0)
  })
})

describe('getRouteProgress', () => {
  it('returns 0 for empty distances array', () => {
    expect(getRouteProgress([], 100)).toBe(0)
  })

  it('returns 0 when total distance is 0', () => {
    expect(getRouteProgress([0], 100)).toBe(0)
  })

  it('returns correct progress percentage', () => {
    const distances = [0, 500, 1000]
    expect(getRouteProgress(distances, 0)).toBe(0)
    expect(getRouteProgress(distances, 250)).toBe(0.25)
    expect(getRouteProgress(distances, 500)).toBe(0.5)
    expect(getRouteProgress(distances, 750)).toBe(0.75)
    expect(getRouteProgress(distances, 1000)).toBe(1)
  })

  it('clamps progress between 0 and 1', () => {
    const distances = [0, 1000]
    expect(getRouteProgress(distances, -100)).toBe(0)
    expect(getRouteProgress(distances, 2000)).toBe(1)
  })
})

describe('getRemainingDistance', () => {
  it('returns 0 for empty distances array', () => {
    expect(getRemainingDistance([], 100)).toBe(0)
  })

  it('returns total distance when traveled is 0', () => {
    const distances = [0, 1000]
    expect(getRemainingDistance(distances, 0)).toBe(1000)
  })

  it('returns 0 when traveled equals total', () => {
    const distances = [0, 1000]
    expect(getRemainingDistance(distances, 1000)).toBe(0)
  })

  it('calculates remaining distance correctly', () => {
    const distances = [0, 1000]
    expect(getRemainingDistance(distances, 250)).toBe(750)
    expect(getRemainingDistance(distances, 500)).toBe(500)
    expect(getRemainingDistance(distances, 750)).toBe(250)
  })

  it('clamps to 0 when traveled exceeds total', () => {
    const distances = [0, 1000]
    expect(getRemainingDistance(distances, 2000)).toBe(0)
  })
})
