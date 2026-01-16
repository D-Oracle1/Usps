/**
 * useAdminShipmentControls Hook
 *
 * Admin controls for shipment management:
 * - Intercept shipment (pause with reason)
 * - Clear shipment (resume after clearance)
 * - Reroute shipment (change destination)
 * - Manual location update (drag marker)
 * - Start/cancel trip
 *
 * All operations sync with backend and emit WebSocket events.
 * Existing API endpoints are used - no breaking changes.
 */

import { useState, useCallback } from 'react'
import api from '@/lib/api'
import type { Shipment } from '@/lib/types'
import { LatLng, haversineDistance } from '@/lib/geo'

export interface AdminControlsState {
  isLoading: boolean
  error: string | null
  lastAction: string | null
}

export interface InterceptOptions {
  reason: string
}

export interface ClearOptions {
  reason: string
}

export interface RerouteOptions {
  newDestination: string
  newDestinationCoords?: LatLng
}

export interface StartTripOptions {
  deliveryDays: number
}

export interface LocationUpdateOptions {
  latitude: number
  longitude: number
  addressLabel?: string
}

export interface UseAdminShipmentControlsResult {
  // State
  state: AdminControlsState
  // Actions
  intercept: (options: InterceptOptions) => Promise<boolean>
  clear: (options: ClearOptions) => Promise<boolean>
  reroute: (options: RerouteOptions) => Promise<boolean>
  updateLocation: (options: LocationUpdateOptions) => Promise<boolean>
  startTrip: (options: StartTripOptions) => Promise<boolean>
  cancelTrip: () => Promise<boolean>
  // Helpers
  clearError: () => void
  // Fee calculation
  calculateAddressChangeFee: (newDestination: string) => Promise<{
    totalFee: number
    distanceDifference: number
    newEta: Date
  } | null>
}

export function useAdminShipmentControls(
  shipment: Shipment,
  onUpdate?: () => void
): UseAdminShipmentControlsResult {
  const [state, setState] = useState<AdminControlsState>({
    isLoading: false,
    error: null,
    lastAction: null
  })

  // Helper to handle API calls
  const executeAction = useCallback(async <T>(
    actionName: string,
    apiCall: () => Promise<T>
  ): Promise<T | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await apiCall()
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastAction: actionName
      }))
      onUpdate?.()
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Operation failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return null
    }
  }, [onUpdate])

  // Intercept shipment (pause with reason)
  const intercept = useCallback(async (options: InterceptOptions): Promise<boolean> => {
    const result = await executeAction('intercept', async () => {
      const response = await api.post(`/movement/${shipment.id}/pause`, {
        reason: options.reason
      })
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Clear shipment (resume after interception/clearance)
  const clear = useCallback(async (options: ClearOptions): Promise<boolean> => {
    const result = await executeAction('clear', async () => {
      const response = await api.post(`/movement/${shipment.id}/resume`, {
        reason: options.reason
      })
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Reroute shipment (change destination with fee)
  const reroute = useCallback(async (options: RerouteOptions): Promise<boolean> => {
    const result = await executeAction('reroute', async () => {
      const response = await api.post(`/movement/${shipment.id}/address-change`, {
        newDestination: options.newDestination
      })
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Manual location update (admin drag marker)
  const updateLocation = useCallback(async (options: LocationUpdateOptions): Promise<boolean> => {
    const result = await executeAction('updateLocation', async () => {
      const response = await api.post(`/movement/${shipment.id}/update-location`, {
        latitude: options.latitude,
        longitude: options.longitude,
        addressLabel: options.addressLabel
      })
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Start trip
  const startTrip = useCallback(async (options: StartTripOptions): Promise<boolean> => {
    const result = await executeAction('startTrip', async () => {
      const response = await api.post(`/movement/${shipment.id}/start`, {
        deliveryDays: options.deliveryDays
      })
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Cancel trip
  const cancelTrip = useCallback(async (): Promise<boolean> => {
    const result = await executeAction('cancelTrip', async () => {
      const response = await api.post(`/movement/${shipment.id}/cancel`)
      return response.data
    })
    return result !== null
  }, [shipment.id, executeAction])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Calculate address change fee (preview)
  const calculateAddressChangeFee = useCallback(async (newDestination: string) => {
    try {
      const response = await api.get(`/movement/${shipment.id}/address-change-fee`, {
        params: { newDestination }
      })
      return {
        totalFee: response.data.totalFee,
        distanceDifference: response.data.distanceDifference,
        newEta: new Date(response.data.newEta)
      }
    } catch (error) {
      return null
    }
  }, [shipment.id])

  return {
    state,
    intercept,
    clear,
    reroute,
    updateLocation,
    startTrip,
    cancelTrip,
    clearError,
    calculateAddressChangeFee
  }
}

export default useAdminShipmentControls
