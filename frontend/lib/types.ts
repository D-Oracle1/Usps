export interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  createdAt: string
}

export interface Shipment {
  id: string
  trackingNumber: string
  originLocation: string
  destinationLocation: string
  currentStatus: ShipmentStatus
  currentLocation: string | null
  createdAt: string
  updatedAt: string

  // Package details
  goodsDescription?: string | null
  packageWeight?: number | null
  packageDimensions?: string | null
  declaredValue?: number | null
  serviceType?: string | null

  // Sender info
  senderName?: string | null
  senderPhone?: string | null
  senderEmail?: string | null

  // Recipient info
  recipientName?: string | null
  recipientPhone?: string | null
  recipientEmail?: string | null

  // Special instructions
  specialInstructions?: string | null

  // Distance and ETA tracking
  totalDistance?: number | null
  remainingDistance?: number | null
  estimatedArrival?: string | null
  tripStartedAt?: string | null
  averageSpeed?: number | null

  // Relations
  movementState?: MovementState
  trackingEvents?: TrackingEvent[]
  locations?: Location[]
  addressChangeFees?: AddressChangeFee[]
  _count?: {
    trackingEvents: number
    locations: number
  }
}

export type ShipmentStatus =
  | 'PENDING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED'

export interface TrackingEvent {
  id: string
  shipmentId: string
  status: string
  description: string
  location: string
  eventTime: string
  createdAt: string
  admin?: {
    id: string
    name: string
    email: string
  }
}

export interface Location {
  id: string
  shipmentId: string
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  recordedAt: string
}

export interface MovementState {
  id: string
  shipmentId: string
  isMoving: boolean
  pausedBy: string | null
  pausedAt: string | null
  resumedAt: string | null
  updatedAt: string
  pausedByAdmin?: {
    id: string
    name: string
    email: string
  }
}

export interface Statistics {
  total: number
  pending: number
  inTransit: number
  delivered: number
  failed: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface CreateShipmentData {
  trackingNumber: string
  originLocation: string
  destinationLocation: string
  currentStatus?: ShipmentStatus
  goodsDescription?: string
  packageWeight?: number
  packageDimensions?: string
  declaredValue?: number
  serviceType?: string
  senderName?: string
  senderPhone?: string
  senderEmail?: string
  recipientName?: string
  recipientPhone?: string
  recipientEmail?: string
  specialInstructions?: string
}

export const SERVICE_TYPES = [
  { value: 'PRIORITY_MAIL', label: 'Priority Mail' },
  { value: 'PRIORITY_MAIL_EXPRESS', label: 'Priority Mail Express' },
  { value: 'FIRST_CLASS', label: 'First-Class Mail' },
  { value: 'GROUND_ADVANTAGE', label: 'USPS Ground Advantage' },
  { value: 'MEDIA_MAIL', label: 'Media Mail' },
  { value: 'RETAIL_GROUND', label: 'Retail Ground' },
  { value: 'PARCEL_SELECT', label: 'Parcel Select' },
] as const

// Address Change Fee types
export interface AddressChangeFee {
  id: string
  shipmentId: string
  previousDestination: string
  newDestination: string
  distanceDifference: number
  timeDifference: number
  baseFee: number
  perMileFee: number
  totalFee: number
  appliedAt: string
  admin?: {
    id: string
    name: string
    email: string
  }
}

export interface AddressChangeFeeCalculation {
  previousDestination: string
  newDestination: string
  previousDistance: number
  newDistance: number
  distanceDifference: number
  timeDifference: number
  baseFee: number
  perMileFee: number
  extraMilesFee: number
  totalFee: number
  newEta: string
}

export interface TripInfo {
  totalDistance: number | null
  remainingDistance: number | null
  estimatedArrival: string | null
  tripStartedAt: string | null
  averageSpeed: number | null
  simulationProgress: {
    currentIndex: number
    totalPoints: number
    isPaused: boolean
    percentComplete: number
  } | null
  addressChangeFees: AddressChangeFee[]
}

export interface LocationUpdateWithEta {
  shipmentId: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  timestamp: string
  progress: {
    currentIndex: number
    totalPoints: number
    percentComplete: number
  }
  distance: {
    total: number
    remaining: number
    covered: number
  }
  eta: {
    arrival: string
    minutesRemaining: number
  }
}
