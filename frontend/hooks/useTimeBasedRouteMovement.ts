/**
 * useTimeBasedRouteMovement Hook
 *
 * Time-based smooth movement animation for shipment tracking.
 * Uses requestAnimationFrame for smooth, zoom-independent animation.
 *
 * Features:
 * - Time-based interpolation (not frame-based)
 * - Great-circle interpolation for long distances
 * - Pause/resume support with time preservation
 * - Smooth animation regardless of frame rate
 * - Zero setInterval usage
 *
 * This hook is additive - existing shipments without routes
 * will fall back to simple position display.
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import {
  LatLng,
  RoutePoint,
  InterpolationResult,
  buildRouteWithDistances,
  getPositionAtProgress,
  haversineDistance,
  calculateBearing,
  interpolatePosition
} from '@/lib/geo'

export interface MovementState {
  position: LatLng
  bearing: number
  speed: number
  progress: number
  distanceCovered: number
  distanceRemaining: number
  isMoving: boolean
  isPaused: boolean
  hasArrived: boolean
}

export interface MovementConfig {
  // Total duration for the trip in milliseconds
  durationMs: number
  // Optional start progress (0-1) for resuming trips
  startProgress?: number
  // Whether to start paused
  startPaused?: boolean
  // Callback when position updates (throttled)
  onPositionUpdate?: (state: MovementState) => void
  // Callback when destination reached
  onArrival?: () => void
  // Callback when movement pauses
  onPause?: () => void
  // Callback when movement resumes
  onResume?: () => void
  // Update throttle in ms (default 33ms = ~30fps)
  updateThrottleMs?: number
}

export interface UseTimeBasedRouteMovementResult {
  // Current movement state
  state: MovementState
  // Start or resume movement
  start: () => void
  // Pause movement (preserves elapsed time)
  pause: () => void
  // Resume from pause
  resume: () => void
  // Stop and reset
  stop: () => void
  // Seek to specific progress (0-1)
  seekTo: (progress: number) => void
  // Update route without resetting progress
  updateRoute: (route: LatLng[]) => void
  // Update duration without resetting progress
  updateDuration: (durationMs: number) => void
  // Get current interpolated position for a given time offset
  getPositionAt: (timeOffsetMs: number) => InterpolationResult | null
}

const DEFAULT_STATE: MovementState = {
  position: { lat: 0, lng: 0 },
  bearing: 0,
  speed: 0,
  progress: 0,
  distanceCovered: 0,
  distanceRemaining: 0,
  isMoving: false,
  isPaused: false,
  hasArrived: false
}

export function useTimeBasedRouteMovement(
  route: LatLng[] | null,
  config: MovementConfig
): UseTimeBasedRouteMovementResult {
  const {
    durationMs,
    startProgress = 0,
    startPaused = false,
    onPositionUpdate,
    onArrival,
    onPause,
    onResume,
    updateThrottleMs = 33
  } = config

  // State
  const [state, setState] = useState<MovementState>(() => {
    if (!route || route.length === 0) return DEFAULT_STATE
    const routeWithDist = buildRouteWithDistances(route)
    const totalDistance = routeWithDist[routeWithDist.length - 1]?.cumulativeDistance || 0
    return {
      ...DEFAULT_STATE,
      position: route[0],
      distanceRemaining: totalDistance
    }
  })

  // Refs for animation state (avoid re-renders during animation)
  const routeRef = useRef<RoutePoint[]>([])
  const totalDistanceRef = useRef(0)
  const durationRef = useRef(durationMs)
  const startTimeRef = useRef<number | null>(null)
  const pausedTimeRef = useRef<number | null>(null)
  const totalPausedTimeRef = useRef(0)
  const isMovingRef = useRef(false)
  const isPausedRef = useRef(startPaused)
  const hasArrivedRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef(0)
  const initialProgressRef = useRef(startProgress)

  // Process route when it changes
  useEffect(() => {
    if (!route || route.length === 0) {
      routeRef.current = []
      totalDistanceRef.current = 0
      return
    }

    routeRef.current = buildRouteWithDistances(route)
    totalDistanceRef.current = routeRef.current[routeRef.current.length - 1]?.cumulativeDistance || 0

    // Update initial state
    const initialResult = getPositionAtProgress(routeRef.current, initialProgressRef.current)
    setState(prev => ({
      ...prev,
      position: initialResult.position,
      bearing: initialResult.bearing,
      progress: initialResult.progress,
      distanceCovered: initialResult.distanceCovered,
      distanceRemaining: initialResult.distanceRemaining
    }))
  }, [route])

  // Update duration ref when config changes
  useEffect(() => {
    durationRef.current = durationMs
  }, [durationMs])

  // Animation frame loop
  const animate = useCallback((timestamp: number) => {
    if (!isMovingRef.current || isPausedRef.current || hasArrivedRef.current) {
      rafIdRef.current = null
      return
    }

    if (routeRef.current.length < 2) {
      rafIdRef.current = null
      return
    }

    // Calculate elapsed time (accounting for pauses)
    const elapsedMs = timestamp - (startTimeRef.current || timestamp) - totalPausedTimeRef.current

    // Calculate progress based on time and initial offset
    const baseProgress = elapsedMs / durationRef.current
    const currentProgress = Math.min(1, initialProgressRef.current + baseProgress * (1 - initialProgressRef.current))

    // Get position at current progress
    const result = getPositionAtProgress(routeRef.current, currentProgress)

    // Calculate speed (km/h)
    const speed = totalDistanceRef.current / (durationRef.current / (1000 * 60 * 60))

    // Throttle state updates
    const shouldUpdate = timestamp - lastUpdateTimeRef.current >= updateThrottleMs
    if (shouldUpdate) {
      lastUpdateTimeRef.current = timestamp

      const newState: MovementState = {
        position: result.position,
        bearing: result.bearing,
        speed,
        progress: currentProgress,
        distanceCovered: result.distanceCovered,
        distanceRemaining: result.distanceRemaining,
        isMoving: true,
        isPaused: false,
        hasArrived: false
      }

      setState(newState)
      onPositionUpdate?.(newState)
    }

    // Check for arrival
    if (currentProgress >= 1) {
      hasArrivedRef.current = true
      isMovingRef.current = false

      const finalState: MovementState = {
        position: result.position,
        bearing: result.bearing,
        speed: 0,
        progress: 1,
        distanceCovered: totalDistanceRef.current,
        distanceRemaining: 0,
        isMoving: false,
        isPaused: false,
        hasArrived: true
      }

      setState(finalState)
      onPositionUpdate?.(finalState)
      onArrival?.()
      rafIdRef.current = null
      return
    }

    // Continue animation
    rafIdRef.current = requestAnimationFrame(animate)
  }, [onPositionUpdate, onArrival, updateThrottleMs])

  // Start movement
  const start = useCallback(() => {
    if (routeRef.current.length < 2) return

    isMovingRef.current = true
    isPausedRef.current = false
    hasArrivedRef.current = false
    startTimeRef.current = performance.now()
    totalPausedTimeRef.current = 0
    pausedTimeRef.current = null

    // Start animation
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  // Pause movement
  const pause = useCallback(() => {
    if (!isMovingRef.current || isPausedRef.current) return

    isPausedRef.current = true
    pausedTimeRef.current = performance.now()

    setState(prev => ({ ...prev, isPaused: true, isMoving: true }))
    onPause?.()
  }, [onPause])

  // Resume movement
  const resume = useCallback(() => {
    if (!isMovingRef.current || !isPausedRef.current) return

    // Calculate pause duration and add to total
    if (pausedTimeRef.current !== null) {
      totalPausedTimeRef.current += performance.now() - pausedTimeRef.current
    }

    isPausedRef.current = false
    pausedTimeRef.current = null

    setState(prev => ({ ...prev, isPaused: false }))
    onResume?.()

    // Resume animation
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, [animate, onResume])

  // Stop and reset
  const stop = useCallback(() => {
    isMovingRef.current = false
    isPausedRef.current = false
    hasArrivedRef.current = false
    startTimeRef.current = null
    pausedTimeRef.current = null
    totalPausedTimeRef.current = 0
    initialProgressRef.current = 0

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    // Reset to start position
    if (routeRef.current.length > 0) {
      const result = getPositionAtProgress(routeRef.current, 0)
      setState({
        position: result.position,
        bearing: result.bearing,
        speed: 0,
        progress: 0,
        distanceCovered: 0,
        distanceRemaining: totalDistanceRef.current,
        isMoving: false,
        isPaused: false,
        hasArrived: false
      })
    } else {
      setState(DEFAULT_STATE)
    }
  }, [])

  // Seek to specific progress
  const seekTo = useCallback((progress: number) => {
    if (routeRef.current.length < 2) return

    progress = Math.max(0, Math.min(1, progress))
    initialProgressRef.current = progress

    // Reset timing
    if (isMovingRef.current) {
      startTimeRef.current = performance.now()
      totalPausedTimeRef.current = 0
    }

    const result = getPositionAtProgress(routeRef.current, progress)
    const speed = isMovingRef.current
      ? totalDistanceRef.current / (durationRef.current / (1000 * 60 * 60))
      : 0

    setState(prev => ({
      ...prev,
      position: result.position,
      bearing: result.bearing,
      speed,
      progress,
      distanceCovered: result.distanceCovered,
      distanceRemaining: result.distanceRemaining,
      hasArrived: progress >= 1
    }))
  }, [])

  // Update route without resetting progress
  const updateRoute = useCallback((newRoute: LatLng[]) => {
    if (newRoute.length === 0) return

    const currentProgress = state.progress
    routeRef.current = buildRouteWithDistances(newRoute)
    totalDistanceRef.current = routeRef.current[routeRef.current.length - 1]?.cumulativeDistance || 0

    // Maintain progress position on new route
    const result = getPositionAtProgress(routeRef.current, currentProgress)
    setState(prev => ({
      ...prev,
      position: result.position,
      bearing: result.bearing,
      distanceCovered: result.distanceCovered,
      distanceRemaining: result.distanceRemaining
    }))
  }, [state.progress])

  // Update duration without resetting progress
  const updateDuration = useCallback((newDurationMs: number) => {
    durationRef.current = newDurationMs
  }, [])

  // Get position at a given time offset (for preview/seeking)
  const getPositionAt = useCallback((timeOffsetMs: number): InterpolationResult | null => {
    if (routeRef.current.length < 2) return null

    const progress = Math.min(1, timeOffsetMs / durationRef.current)
    return getPositionAtProgress(routeRef.current, progress)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  return {
    state,
    start,
    pause,
    resume,
    stop,
    seekTo,
    updateRoute,
    updateDuration,
    getPositionAt
  }
}

export default useTimeBasedRouteMovement
