/**
 * Hooks Index
 *
 * Export all custom hooks for shipment tracking.
 * These are additive hooks that can be used alongside existing components.
 */

export {
  useTimeBasedRouteMovement,
  type MovementState,
  type MovementConfig,
  type UseTimeBasedRouteMovementResult
} from './useTimeBasedRouteMovement'

export {
  useShipmentRouteEngine,
  type StopType,
  type ShipmentStop,
  type ShipmentRouteState,
  type UseShipmentRouteEngineConfig,
  type UseShipmentRouteEngineResult
} from './useShipmentRouteEngine'

export {
  useAdminShipmentControls,
  type AdminControlsState,
  type InterceptOptions,
  type ClearOptions,
  type RerouteOptions,
  type StartTripOptions,
  type LocationUpdateOptions,
  type UseAdminShipmentControlsResult
} from './useAdminShipmentControls'
