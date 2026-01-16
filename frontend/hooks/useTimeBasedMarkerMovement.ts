/**
 * useTimeBasedMarkerMovement Hook
 *
 * A production-quality React hook for smooth, time-based marker animation on Leaflet maps.
 *
 * ALGORITHM EXPLANATION:
 * ----------------------
 * 1. The admin inputs delivery duration in days (e.g., 2 days)
 * 2. This is converted to milliseconds: durationMs = days * 24 * 60 * 60 * 1000
 * 3. We track the START TIME and calculate ELAPSED TIME on each frame
 * 4. Progress = elapsedTime / totalDuration (clamped to 0-1)
 * 5. Current position = lerp(startPosition, endPosition, progress)
 *
 * WHY TIME-BASED INSTEAD OF INTERVAL-BASED:
 * -----------------------------------------
 * - setInterval runs at fixed intervals regardless of actual time passed
 * - If the browser tab loses focus, intervals may be throttled or paused
 * - When the tab regains focus, interval-based animation "catches up" causing jumps
 * - Time-based animation always calculates position from actual elapsed time
 * - This ensures smooth animation even after tab focus loss
 *
 * LINEAR VS GREAT-CIRCLE INTERPOLATION:
 * -------------------------------------
 * For short distances (< 1000km), linear interpolation is sufficient.
 * For longer distances, great-circle interpolation follows the Earth's curvature.
 * This implementation uses linear interpolation for simplicity and performance.
 * The visual difference is negligible for courier tracking scenarios.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface Position {
  lat: number
  lng: number
}

interface MovementState {
  currentPosition: Position
  progress: number // 0-1
  isMoving: boolean
  isPaused: boolean
  isComplete: boolean
  elapsedMs: number
  remainingMs: number
}

interface UseTimeBasedMarkerMovementOptions {
  startPosition: Position
  endPosition: Position
  durationMs: number // Total duration in milliseconds
  speedMultiplier?: number // For testing: 1 = normal, 10 = 10x faster
  onPositionUpdate?: (position: Position, progress: number) => void
  onComplete?: () => void
  autoStart?: boolean
}

interface UseTimeBasedMarkerMovementReturn {
  state: MovementState
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setSpeedMultiplier: (multiplier: number) => void
  jumpToProgress: (progress: number) => void
}

/**
 * Linear interpolation between two positions
 * For short-to-medium distances, this provides smooth, predictable movement
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Interpolate position based on progress (0-1)
 */
function interpolatePosition(start: Position, end: Position, progress: number): Position {
  // Clamp progress to 0-1
  const t = Math.max(0, Math.min(1, progress))

  return {
    lat: lerp(start.lat, end.lat, t),
    lng: lerp(start.lng, end.lng, t),
  }
}

/**
 * Calculate great-circle distance between two points (Haversine formula)
 * Used for distance display, not animation
 */
export function haversineDistance(pos1: Position, pos2: Position): number {
  const R = 6371 // Earth's radius in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180
  const dLon = (pos2.lng - pos1.lng) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function useTimeBasedMarkerMovement(
  options: UseTimeBasedMarkerMovementOptions
): UseTimeBasedMarkerMovementReturn {
  const {
    startPosition,
    endPosition,
    durationMs,
    speedMultiplier: initialSpeedMultiplier = 1,
    onPositionUpdate,
    onComplete,
    autoStart = false,
  } = options

  // State for movement tracking
  const [state, setState] = useState<MovementState>({
    currentPosition: startPosition,
    progress: 0,
    isMoving: false,
    isPaused: false,
    isComplete: false,
    elapsedMs: 0,
    remainingMs: durationMs,
  })

  // Refs for animation state (avoid stale closures)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0) // Elapsed time when paused
  const speedMultiplierRef = useRef<number>(initialSpeedMultiplier)
  const isMovingRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Callbacks stored in refs to avoid recreation
  const onPositionUpdateRef = useRef(onPositionUpdate)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate
    onCompleteRef.current = onComplete
  }, [onPositionUpdate, onComplete])

  // Main animation loop using requestAnimationFrame
  const animate = useCallback((currentTime: number) => {
    if (!isMovingRef.current || isPausedRef.current) {
      return
    }

    // Calculate elapsed time with speed multiplier
    const rawElapsed = currentTime - startTimeRef.current
    const adjustedElapsed = rawElapsed * speedMultiplierRef.current
    const totalElapsed = pausedAtRef.current + adjustedElapsed

    // Calculate progress (0-1)
    const progress = Math.min(totalElapsed / durationMs, 1)

    // Calculate current position
    const currentPosition = interpolatePosition(startPosition, endPosition, progress)

    // Calculate remaining time
    const remainingMs = Math.max(0, durationMs - totalElapsed)

    // Update state
    setState({
      currentPosition,
      progress,
      isMoving: true,
      isPaused: false,
      isComplete: progress >= 1,
      elapsedMs: totalElapsed,
      remainingMs,
    })

    // Notify callback
    if (onPositionUpdateRef.current) {
      onPositionUpdateRef.current(currentPosition, progress)
    }

    // Check if complete
    if (progress >= 1) {
      isMovingRef.current = false
      if (onCompleteRef.current) {
        onCompleteRef.current()
      }
      return
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [startPosition, endPosition, durationMs])

  // Start animation
  const start = useCallback(() => {
    if (isMovingRef.current) return

    isMovingRef.current = true
    isPausedRef.current = false
    pausedAtRef.current = 0
    startTimeRef.current = performance.now()

    setState(prev => ({
      ...prev,
      isMoving: true,
      isPaused: false,
      isComplete: false,
    }))

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [animate])

  // Pause animation
  const pause = useCallback(() => {
    if (!isMovingRef.current || isPausedRef.current) return

    // Store elapsed time at pause point
    const rawElapsed = performance.now() - startTimeRef.current
    const adjustedElapsed = rawElapsed * speedMultiplierRef.current
    pausedAtRef.current += adjustedElapsed

    isPausedRef.current = true

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setState(prev => ({
      ...prev,
      isPaused: true,
    }))
  }, [])

  // Resume animation
  const resume = useCallback(() => {
    if (!isMovingRef.current || !isPausedRef.current) return

    isPausedRef.current = false
    startTimeRef.current = performance.now() // Reset start time for new segment

    setState(prev => ({
      ...prev,
      isPaused: false,
    }))

    // Resume animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [animate])

  // Reset animation
  const reset = useCallback(() => {
    // Cancel any running animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    isMovingRef.current = false
    isPausedRef.current = false
    pausedAtRef.current = 0
    startTimeRef.current = 0

    setState({
      currentPosition: startPosition,
      progress: 0,
      isMoving: false,
      isPaused: false,
      isComplete: false,
      elapsedMs: 0,
      remainingMs: durationMs,
    })
  }, [startPosition, durationMs])

  // Set speed multiplier
  const setSpeedMultiplier = useCallback((multiplier: number) => {
    // If currently moving, we need to account for time already elapsed at old speed
    if (isMovingRef.current && !isPausedRef.current) {
      const rawElapsed = performance.now() - startTimeRef.current
      const adjustedElapsed = rawElapsed * speedMultiplierRef.current
      pausedAtRef.current += adjustedElapsed
      startTimeRef.current = performance.now()
    }

    speedMultiplierRef.current = multiplier
  }, [])

  // Jump to specific progress
  const jumpToProgress = useCallback((targetProgress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, targetProgress))
    const newPosition = interpolatePosition(startPosition, endPosition, clampedProgress)
    const newElapsedMs = clampedProgress * durationMs

    // Update pause reference if moving
    if (isMovingRef.current) {
      pausedAtRef.current = newElapsedMs
      startTimeRef.current = performance.now()
    }

    setState(prev => ({
      ...prev,
      currentPosition: newPosition,
      progress: clampedProgress,
      elapsedMs: newElapsedMs,
      remainingMs: durationMs - newElapsedMs,
      isComplete: clampedProgress >= 1,
    }))

    if (onPositionUpdateRef.current) {
      onPositionUpdateRef.current(newPosition, clampedProgress)
    }
  }, [startPosition, endPosition, durationMs])

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isMovingRef.current) {
      start()
    }
  }, [autoStart, start])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Handle visibility change - pause when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - we don't pause automatically
        // The time-based system handles this naturally
      } else {
        // Tab is now visible - recalculate position based on elapsed time
        if (isMovingRef.current && !isPausedRef.current) {
          // Force a position recalculation
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [animate])

  return {
    state,
    start,
    pause,
    resume,
    reset,
    setSpeedMultiplier,
    jumpToProgress,
  }
}

/**
 * Example Usage with react-leaflet:
 *
 * ```tsx
 * import { useTimeBasedMarkerMovement } from '@/hooks/useTimeBasedMarkerMovement'
 * import { Marker } from 'react-leaflet'
 *
 * function AnimatedMarker() {
 *   const { state, start, pause, resume } = useTimeBasedMarkerMovement({
 *     startPosition: { lat: 40.7128, lng: -74.0060 }, // New York
 *     endPosition: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
 *     durationMs: 2 * 24 * 60 * 60 * 1000, // 2 days in ms
 *     speedMultiplier: 1000, // 1000x speed for demo
 *     onPositionUpdate: (pos, progress) => {
 *       console.log(`Progress: ${(progress * 100).toFixed(1)}%`)
 *     },
 *     onComplete: () => {
 *       console.log('Delivery complete!')
 *     }
 *   })
 *
 *   return (
 *     <>
 *       <Marker position={[state.currentPosition.lat, state.currentPosition.lng]} />
 *       <button onClick={start}>Start</button>
 *       <button onClick={pause}>Pause (Intercept)</button>
 *       <button onClick={resume}>Resume (Clear)</button>
 *     </>
 *   )
 * }
 * ```
 *
 * WHY THIS AVOIDS LEAFLET GLITCHES:
 * ---------------------------------
 * 1. We use requestAnimationFrame which syncs with the browser's refresh rate
 * 2. Position updates are smooth and continuous, not discrete jumps
 * 3. Time-based calculation means no accumulated errors from missed intervals
 * 4. Tab visibility handling prevents position jumps when tab regains focus
 * 5. No dependency on setInterval which can be throttled by the browser
 */

export default useTimeBasedMarkerMovement
