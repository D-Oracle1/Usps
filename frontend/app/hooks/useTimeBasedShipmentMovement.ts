/**
 * useTimeBasedShipmentMovement Hook
 *
 * BOLT/UBER GRADE Time-Based Movement System
 *
 * Core Principles:
 * 1. Uses requestAnimationFrame - NOT setInterval
 * 2. NO React state for position - imperative marker updates
 * 3. Time-based interpolation for consistent speed
 * 4. Pause/resume preserves elapsed time
 *
 * The animation runs in a ref-based loop, avoiding React re-renders.
 * Position updates are pushed to a callback for imperative Leaflet marker updates.
 */

import { useRef, useCallback, useEffect } from 'react'
import { calculateBearing, interpolatePosition, haversineDistance, type LatLng } from '../utils/bearing'
import { calculateETA, type ETAResult } from '../utils/etaCalculator'

export interface MovementState {
  position: LatLng
  bearing: number
  progress: number
  distanceRemaining: number
  speed: number
  eta: ETAResult
  isPaused: boolean
  hasArrived: boolean
}

export interface MovementConfig {
  origin: LatLng
  destination: LatLng
  /** Optional route line to follow (if not provided, moves in straight line) */
  route?: LatLng[]
  /** Trip duration in milliseconds */
  durationMs: number
  /** Average speed in km/h (for ETA calculations) */
  averageSpeedKmh: number
  /** Initial progress (0-1) for resuming trips */
  initialProgress?: number
  /** Whether to start paused */
  startPaused?: boolean
  /** Callback for position updates (called every frame) */
  onPositionUpdate: (state: MovementState) => void
  /** Callback when destination is reached */
  onArrival?: () => void
}

export interface UseTimeBasedShipmentMovementResult {
  /** Start or resume movement */
  start: () => void
  /** Pause movement (preserves elapsed time) */
  pause: () => void
  /** Resume from pause */
  resume: () => void
  /** Stop and reset to origin */
  reset: () => void
  /** Seek to specific progress (0-1) */
  seekTo: (progress: number) => void
  /** Set new destination (for admin rerouting) */
  setDestination: (newDestination: LatLng) => void
  /** Set speed multiplier (1 = normal, 2 = 2x faster, 0.5 = half speed) */
  setSpeedMultiplier: (multiplier: number) => void
  /** Get current speed multiplier */
  getSpeedMultiplier: () => number
  /** Get current state snapshot */
  getState: () => MovementState
  /** Whether currently moving */
  isMoving: () => boolean
}

// Interpolate position along a route at a given progress (0-1)
function interpolateAlongRoute(route: LatLng[], progress: number): LatLng {
  if (route.length === 0) {
    return { lat: 0, lng: 0 }
  }
  if (route.length === 1 || progress <= 0) {
    return route[0]
  }
  if (progress >= 1) {
    return route[route.length - 1]
  }

  // Calculate total route length
  let totalLength = 0
  const segmentLengths: number[] = []
  for (let i = 0; i < route.length - 1; i++) {
    const segmentLength = haversineDistance(route[i], route[i + 1])
    segmentLengths.push(segmentLength)
    totalLength += segmentLength
  }

  // Find the target distance along the route
  const targetDistance = progress * totalLength

  // Find the segment containing this distance
  let cumulativeDistance = 0
  for (let i = 0; i < segmentLengths.length; i++) {
    const segmentLength = segmentLengths[i]
    if (cumulativeDistance + segmentLength >= targetDistance) {
      // Interpolate within this segment
      const segmentProgress = (targetDistance - cumulativeDistance) / segmentLength
      return interpolatePosition(route[i], route[i + 1], segmentProgress)
    }
    cumulativeDistance += segmentLength
  }

  return route[route.length - 1]
}

export function useTimeBasedShipmentMovement(
  config: MovementConfig
): UseTimeBasedShipmentMovementResult {
  const {
    origin,
    destination,
    route,
    durationMs,
    averageSpeedKmh,
    initialProgress = 0,
    startPaused = false,
    onPositionUpdate,
    onArrival
  } = config

  // All animation state is stored in refs to avoid re-renders
  const originRef = useRef<LatLng>(origin)
  const destinationRef = useRef<LatLng>(destination)
  const routeRef = useRef<LatLng[] | undefined>(route)
  const durationRef = useRef<number>(durationMs)
  const speedRef = useRef<number>(averageSpeedKmh)
  const speedMultiplierRef = useRef<number>(1)

  // Animation timing refs
  const startTimeRef = useRef<number | null>(null)
  const pausedTimeRef = useRef<number | null>(null)
  const totalPausedDurationRef = useRef<number>(0)
  const initialProgressRef = useRef<number>(initialProgress)

  // Current progress tracking (updated every frame, used for pause/resume)
  const currentProgressRef = useRef<number>(initialProgress)

  // Animation control refs
  const isRunningRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(startPaused)
  const hasArrivedRef = useRef<boolean>(false)
  const rafIdRef = useRef<number | null>(null)
  const isInitializedRef = useRef<boolean>(false)

  // Callbacks ref (to avoid stale closures)
  const onPositionUpdateRef = useRef(onPositionUpdate)
  const onArrivalRef = useRef(onArrival)

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate
    onArrivalRef.current = onArrival
  }, [onPositionUpdate, onArrival])

  // Update config refs when props change
  useEffect(() => {
    originRef.current = origin
    destinationRef.current = destination
    routeRef.current = route
    durationRef.current = durationMs
    speedRef.current = averageSpeedKmh
  }, [origin, destination, route, durationMs, averageSpeedKmh])

  /**
   * Calculate current movement state at a given progress
   */
  const calculateState = useCallback((progress: number): MovementState => {
    progress = Math.max(0, Math.min(1, progress))

    const orig = originRef.current
    const dest = destinationRef.current
    const currentRoute = routeRef.current
    const speed = speedRef.current

    // Use route-based interpolation if route is available, otherwise straight line
    let position: LatLng
    let bearing: number
    let totalDistance: number

    if (currentRoute && currentRoute.length > 1) {
      // Follow the route
      position = interpolateAlongRoute(currentRoute, progress)

      // Calculate bearing to next point on route
      const nextProgress = Math.min(1, progress + 0.01)
      const nextPosition = interpolateAlongRoute(currentRoute, nextProgress)
      bearing = calculateBearing(position, nextPosition)

      // Calculate total route distance
      totalDistance = 0
      for (let i = 0; i < currentRoute.length - 1; i++) {
        totalDistance += haversineDistance(currentRoute[i], currentRoute[i + 1])
      }
    } else {
      // Straight line fallback
      position = interpolatePosition(orig, dest, progress)
      bearing = calculateBearing(position, dest)
      totalDistance = haversineDistance(orig, dest)
    }

    const distanceRemaining = totalDistance * (1 - progress)
    const eta = calculateETA(distanceRemaining, speed)

    return {
      position,
      bearing,
      progress,
      distanceRemaining,
      speed,
      eta,
      isPaused: isPausedRef.current,
      hasArrived: progress >= 1
    }
  }, [])

  /**
   * Animation frame loop - runs at display refresh rate
   */
  const animate = useCallback((timestamp: number) => {
    if (!isRunningRef.current || isPausedRef.current || hasArrivedRef.current) {
      rafIdRef.current = null
      return
    }

    // Initialize start time on first frame
    if (startTimeRef.current === null) {
      startTimeRef.current = timestamp
    }

    // Calculate elapsed time (accounting for pauses and speed multiplier)
    const rawElapsed = timestamp - startTimeRef.current - totalPausedDurationRef.current
    const elapsed = rawElapsed * speedMultiplierRef.current

    // Calculate progress based on time
    const duration = durationRef.current
    const baseProgress = elapsed / duration
    const initialProg = initialProgressRef.current

    // Map progress: starts from initialProgress, moves to 1
    const currentProgress = Math.min(1, initialProg + baseProgress * (1 - initialProg))

    // Store current progress for pause/resume
    currentProgressRef.current = currentProgress

    // Calculate current state
    const state = calculateState(currentProgress)

    // Push update to callback (imperative marker update)
    onPositionUpdateRef.current(state)

    // Check for arrival
    if (currentProgress >= 1) {
      hasArrivedRef.current = true
      isRunningRef.current = false
      onArrivalRef.current?.()
      rafIdRef.current = null
      return
    }

    // Continue animation
    rafIdRef.current = requestAnimationFrame(animate)
  }, [calculateState])

  /**
   * Start movement from current position
   */
  const start = useCallback(() => {
    if (hasArrivedRef.current) return

    isRunningRef.current = true
    isPausedRef.current = false
    startTimeRef.current = null // Will be set on first frame
    totalPausedDurationRef.current = 0

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  /**
   * Pause movement (preserves elapsed time)
   */
  const pause = useCallback(() => {
    if (!isRunningRef.current || isPausedRef.current) return

    isPausedRef.current = true
    pausedTimeRef.current = performance.now()

    // Notify of pause
    const elapsed = performance.now() - (startTimeRef.current || 0) - totalPausedDurationRef.current
    const progress = Math.min(1, initialProgressRef.current + (elapsed / durationRef.current) * (1 - initialProgressRef.current))
    const state = calculateState(progress)
    onPositionUpdateRef.current({ ...state, isPaused: true })
  }, [calculateState])

  /**
   * Resume from pause
   */
  const resume = useCallback(() => {
    if (!isRunningRef.current || !isPausedRef.current) return

    // Add paused duration to total
    if (pausedTimeRef.current !== null) {
      totalPausedDurationRef.current += performance.now() - pausedTimeRef.current
    }

    isPausedRef.current = false
    pausedTimeRef.current = null

    // Resume animation loop
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  /**
   * Stop and reset to origin
   */
  const reset = useCallback(() => {
    isRunningRef.current = false
    isPausedRef.current = false
    hasArrivedRef.current = false
    startTimeRef.current = null
    pausedTimeRef.current = null
    totalPausedDurationRef.current = 0
    initialProgressRef.current = 0

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    // Notify of reset position
    const state = calculateState(0)
    onPositionUpdateRef.current(state)
  }, [calculateState])

  /**
   * Seek to specific progress (0-1)
   */
  const seekTo = useCallback((progress: number) => {
    progress = Math.max(0, Math.min(1, progress))
    initialProgressRef.current = progress

    // Reset timing if currently running
    if (isRunningRef.current) {
      startTimeRef.current = performance.now()
      totalPausedDurationRef.current = 0
    }

    // Check for arrival
    if (progress >= 1) {
      hasArrivedRef.current = true
      isRunningRef.current = false
    }

    // Notify of new position
    const state = calculateState(progress)
    onPositionUpdateRef.current(state)
  }, [calculateState])

  /**
   * Set new destination (for admin rerouting)
   */
  const setDestination = useCallback((newDestination: LatLng) => {
    // Calculate current position before changing destination
    const elapsed = performance.now() - (startTimeRef.current || 0) - totalPausedDurationRef.current
    const currentProgress = Math.min(1, initialProgressRef.current + (elapsed / durationRef.current) * (1 - initialProgressRef.current))
    const currentPos = interpolatePosition(originRef.current, destinationRef.current, currentProgress)

    // Update origin to current position
    originRef.current = currentPos
    destinationRef.current = newDestination

    // Reset progress to start from new origin
    initialProgressRef.current = 0
    if (isRunningRef.current) {
      startTimeRef.current = performance.now()
      totalPausedDurationRef.current = 0
    }

    // Recalculate duration based on new distance
    const newDistance = haversineDistance(currentPos, newDestination)
    durationRef.current = (newDistance / speedRef.current) * 60 * 60 * 1000

    // Notify of new route
    const state = calculateState(0)
    onPositionUpdateRef.current(state)
  }, [calculateState])

  /**
   * Set speed multiplier (1 = normal, 2 = 2x faster, 0.5 = half speed)
   */
  const setSpeedMultiplier = useCallback((multiplier: number) => {
    // Clamp multiplier to reasonable range
    multiplier = Math.max(0.1, Math.min(10, multiplier))

    // When changing speed, we need to adjust timing to maintain current position
    if (isRunningRef.current && startTimeRef.current !== null) {
      const now = performance.now()
      const rawElapsed = now - startTimeRef.current - totalPausedDurationRef.current
      const currentEffectiveElapsed = rawElapsed * speedMultiplierRef.current

      // Calculate new start time so that current position is preserved
      // newRawElapsed * newMultiplier = currentEffectiveElapsed
      // newRawElapsed = currentEffectiveElapsed / newMultiplier
      // now - newStartTime - totalPaused = newRawElapsed
      // newStartTime = now - totalPaused - newRawElapsed
      const newRawElapsed = currentEffectiveElapsed / multiplier
      startTimeRef.current = now - totalPausedDurationRef.current - newRawElapsed
    }

    speedMultiplierRef.current = multiplier
  }, [])

  /**
   * Get current speed multiplier
   */
  const getSpeedMultiplier = useCallback((): number => {
    return speedMultiplierRef.current
  }, [])

  /**
   * Get current state snapshot
   */
  const getState = useCallback((): MovementState => {
    if (!isRunningRef.current) {
      return calculateState(initialProgressRef.current)
    }

    const rawElapsed = performance.now() - (startTimeRef.current || 0) - totalPausedDurationRef.current
    const elapsed = rawElapsed * speedMultiplierRef.current
    const progress = Math.min(1, initialProgressRef.current + (elapsed / durationRef.current) * (1 - initialProgressRef.current))
    return calculateState(progress)
  }, [calculateState])

  /**
   * Check if currently moving
   */
  const isMoving = useCallback((): boolean => {
    return isRunningRef.current && !isPausedRef.current && !hasArrivedRef.current
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // Track previous paused state to detect changes
  const prevStartPausedRef = useRef<boolean>(startPaused)

  // Initialize on mount - set up initial state based on props
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    // Set initial progress
    initialProgressRef.current = initialProgress
    currentProgressRef.current = initialProgress

    // Notify of initial position
    const state = calculateState(initialProgress)
    onPositionUpdateRef.current({ ...state, isPaused: startPaused })

    // Auto-start if not paused
    if (!startPaused && !hasArrivedRef.current) {
      isRunningRef.current = true
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, []) // Only run on mount

  // Handle startPaused prop changes (pause/resume based on external state)
  useEffect(() => {
    // Skip if this is the initial render or no change
    if (prevStartPausedRef.current === startPaused) {
      return
    }

    prevStartPausedRef.current = startPaused

    if (startPaused) {
      // Pause the animation but preserve current progress
      if (isRunningRef.current && !isPausedRef.current) {
        // Use the tracked current progress (more reliable than recalculating)
        const currentProgress = currentProgressRef.current

        // Store current progress for when we resume
        initialProgressRef.current = currentProgress

        isPausedRef.current = true
        pausedTimeRef.current = performance.now()

        // Notify of pause at current position
        const state = calculateState(currentProgress)
        onPositionUpdateRef.current({ ...state, isPaused: true })
      } else if (!isRunningRef.current) {
        // Not running yet but need to be paused
        isPausedRef.current = true
      }
    } else {
      // Resume the animation from current progress
      if (isPausedRef.current) {
        // Use stored progress (initialProgressRef was set when pausing)
        const resumeProgress = initialProgressRef.current

        isPausedRef.current = false
        pausedTimeRef.current = null

        // Reset timing to start fresh from the stored progress
        startTimeRef.current = null
        totalPausedDurationRef.current = 0

        // Ensure animation is running
        isRunningRef.current = true
        hasArrivedRef.current = false

        // Resume animation loop
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(animate)
        }
      } else if (!isRunningRef.current && !hasArrivedRef.current) {
        // Start fresh if not running yet
        start()
      }
    }
  }, [startPaused, animate, calculateState, start])

  return {
    start,
    pause,
    resume,
    reset,
    seekTo,
    setDestination,
    setSpeedMultiplier,
    getSpeedMultiplier,
    getState,
    isMoving
  }
}

export default useTimeBasedShipmentMovement
