import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { calculateRouteDistances } from "./calculateRouteDistances"
import { getPositionAlongRoute } from "./getPositionAlongRoute"

interface RouteMovementState {
  position: L.LatLng
  progress: number // 0-1
  isMoving: boolean
  isPaused: boolean
  isComplete: boolean
  elapsedMs: number
  remainingMs: number
}

interface UseRouteMovementOptions {
  route: L.LatLng[]
  durationMs: number
  isPaused: boolean
  onPositionUpdate?: (position: L.LatLng, progress: number) => void
  onComplete?: () => void
}

/**
 * Time-based route movement hook for smooth marker animation
 * 
 * This hook manages the animation of a marker along a polyline route using
 * time-based calculations to ensure smooth, jitter-free movement.
 * 
 * Key features:
 * - Time-based animation using requestAnimationFrame
 * - Imperative marker updates to avoid React re-renders
 * - Pause/resume functionality for package intercepts
 * - Automatic completion detection
 * - Tab visibility handling for consistent timing
 * 
 * @param options - Configuration object with route, duration, and pause state
 * @returns Current position and movement state
 */
export function useRouteMovement(options: UseRouteMovementOptions): L.LatLng {
  const {
    route,
    durationMs,
    isPaused,
    onPositionUpdate,
    onComplete,
  } = options

  const [position, setPosition] = useState<L.LatLng>(route[0] || L.latLng(0, 0))
  
  // Animation state refs (avoid stale closures)
  const startTime = useRef<number | null>(null)
  const pausedAt = useRef<number>(0) // Accumulated paused time
  const rafId = useRef<number | null>(null)
  const isMovingRef = useRef<boolean>(true)
  const onPositionUpdateRef = useRef(onPositionUpdate)
  const onCompleteRef = useRef(onComplete)

  // Update refs when callbacks change
  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate
    onCompleteRef.current = onComplete
  }, [onPositionUpdate, onComplete])

  // Calculate route distances once when route changes
  const { distances, total } = calculateRouteDistances(route)

  // Main animation loop
  const animate = (time: number) => {
    if (!isMovingRef.current) return

    // Calculate elapsed time with pause handling
    const rawElapsed = time - (startTime.current ?? time)
    const totalElapsed = pausedAt.current + rawElapsed

    // Calculate progress (0-1)
    const progress = Math.min(totalElapsed / durationMs, 1)
    
    // Calculate distance traveled
    const traveled = total * progress

    // Get current position along route
    const currentPosition = getPositionAlongRoute(route, distances, traveled)

    // Update state
    setPosition(currentPosition)

    // Notify callback
    if (onPositionUpdateRef.current) {
      onPositionUpdateRef.current(currentPosition, progress)
    }

    // Check completion
    if (progress >= 1) {
      isMovingRef.current = false
      if (onCompleteRef.current) {
        onCompleteRef.current()
      }
      return
    }

    // Continue animation
    rafId.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    // Handle pause/resume
    if (isPaused) {
      // Pause animation
      isMovingRef.current = false
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      
      // Store elapsed time at pause point
      if (startTime.current) {
        const rawElapsed = performance.now() - startTime.current
        pausedAt.current += rawElapsed
        startTime.current = null
      }
      return
    }

    // Resume or start animation
    isMovingRef.current = true
    
    if (!startTime.current) {
      // Starting fresh
      startTime.current = performance.now()
    } else {
      // Resuming from pause - reset start time for new segment
      startTime.current = performance.now()
    }

    // Start animation loop
    rafId.current = requestAnimationFrame(animate)

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [isPaused, route, durationMs])

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isMovingRef.current && !isPaused) {
        // Tab became visible - restart animation to recalculate position
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
        startTime.current = performance.now()
        rafId.current = requestAnimationFrame(animate)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPaused, animate])

  // Reset position when route changes
  useEffect(() => {
    setPosition(route[0] || L.latLng(0, 0))
    pausedAt.current = 0
    startTime.current = null
  }, [route])

  return position
}

/**
 * Enhanced version with additional state information
 */
export function useRouteMovementWithState(options: UseRouteMovementOptions): {
  position: L.LatLng
  state: RouteMovementState
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
} {
  const {
    route,
    durationMs,
    isPaused,
    onPositionUpdate,
    onComplete,
  } = options

  const [state, setState] = useState<RouteMovementState>({
    position: route[0] || L.latLng(0, 0),
    progress: 0,
    isMoving: true,
    isPaused: false,
    isComplete: false,
    elapsedMs: 0,
    remainingMs: durationMs,
  })

  const startTime = useRef<number | null>(null)
  const pausedAt = useRef<number>(0)
  const rafId = useRef<number | null>(null)
  const isMovingRef = useRef<boolean>(true)

  const { distances, total } = calculateRouteDistances(route)

  const animate = (time: number) => {
    if (!isMovingRef.current) return

    const rawElapsed = time - (startTime.current ?? time)
    const totalElapsed = pausedAt.current + rawElapsed
    const progress = Math.min(totalElapsed / durationMs, 1)
    const traveled = total * progress

    const currentPosition = getPositionAlongRoute(route, distances, traveled)
    const remainingMs = Math.max(0, durationMs - totalElapsed)

    setState({
      position: currentPosition,
      progress,
      isMoving: true,
      isPaused: false,
      isComplete: progress >= 1,
      elapsedMs: totalElapsed,
      remainingMs,
    })

    if (onPositionUpdate) {
      onPositionUpdate(currentPosition, progress)
    }

    if (progress >= 1) {
      isMovingRef.current = false
      if (onComplete) {
        onComplete()
      }
      return
    }

    rafId.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    if (isPaused) {
      isMovingRef.current = false
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
      
      if (startTime.current) {
        const rawElapsed = performance.now() - startTime.current
        pausedAt.current += rawElapsed
        startTime.current = null
      }
      return
    }

    isMovingRef.current = true
    if (!startTime.current) {
      startTime.current = performance.now()
    } else {
      startTime.current = performance.now()
    }

    rafId.current = requestAnimationFrame(animate)

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [isPaused, route, durationMs])

  const start = () => {
    isMovingRef.current = true
    pausedAt.current = 0
    startTime.current = performance.now()
    rafId.current = requestAnimationFrame(animate)
  }

  const pause = () => {
    isMovingRef.current = false
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }
    if (startTime.current) {
      const rawElapsed = performance.now() - startTime.current
      pausedAt.current += rawElapsed
      startTime.current = null
    }
  }

  const resume = () => {
    isMovingRef.current = true
    startTime.current = performance.now()
    rafId.current = requestAnimationFrame(animate)
  }

  const reset = () => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }
    isMovingRef.current = false
    pausedAt.current = 0
    startTime.current = null
    setState({
      position: route[0] || L.latLng(0, 0),
      progress: 0,
      isMoving: false,
      isPaused: false,
      isComplete: false,
      elapsedMs: 0,
      remainingMs: durationMs,
    })
  }

  return {
    position: state.position,
    state,
    start,
    pause,
    resume,
    reset,
  }
}
