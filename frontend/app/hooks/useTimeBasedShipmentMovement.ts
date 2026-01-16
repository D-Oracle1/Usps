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
  /** Get current state snapshot */
  getState: () => MovementState
  /** Whether currently moving */
  isMoving: () => boolean
}

export function useTimeBasedShipmentMovement(
  config: MovementConfig
): UseTimeBasedShipmentMovementResult {
  const {
    origin,
    destination,
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
  const durationRef = useRef<number>(durationMs)
  const speedRef = useRef<number>(averageSpeedKmh)

  // Animation timing refs
  const startTimeRef = useRef<number | null>(null)
  const pausedTimeRef = useRef<number | null>(null)
  const totalPausedDurationRef = useRef<number>(0)
  const initialProgressRef = useRef<number>(initialProgress)

  // Animation control refs
  const isRunningRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(startPaused)
  const hasArrivedRef = useRef<boolean>(false)
  const rafIdRef = useRef<number | null>(null)

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
    durationRef.current = durationMs
    speedRef.current = averageSpeedKmh
  }, [origin, destination, durationMs, averageSpeedKmh])

  /**
   * Calculate current movement state at a given progress
   */
  const calculateState = useCallback((progress: number): MovementState => {
    progress = Math.max(0, Math.min(1, progress))

    const orig = originRef.current
    const dest = destinationRef.current
    const speed = speedRef.current

    const position = interpolatePosition(orig, dest, progress)
    const bearing = calculateBearing(position, dest)
    const totalDistance = haversineDistance(orig, dest)
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

    // Calculate elapsed time (accounting for pauses)
    const elapsed = timestamp - startTimeRef.current - totalPausedDurationRef.current

    // Calculate progress based on time
    const duration = durationRef.current
    const baseProgress = elapsed / duration
    const initialProg = initialProgressRef.current

    // Map progress: starts from initialProgress, moves to 1
    const currentProgress = Math.min(1, initialProg + baseProgress * (1 - initialProg))

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
   * Get current state snapshot
   */
  const getState = useCallback((): MovementState => {
    if (!isRunningRef.current) {
      return calculateState(initialProgressRef.current)
    }

    const elapsed = performance.now() - (startTimeRef.current || 0) - totalPausedDurationRef.current
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

  // Auto-start if not paused
  useEffect(() => {
    if (!startPaused && !hasArrivedRef.current) {
      start()
    }
  }, [startPaused, start])

  return {
    start,
    pause,
    resume,
    reset,
    seekTo,
    setDestination,
    getState,
    isMoving
  }
}

export default useTimeBasedShipmentMovement
