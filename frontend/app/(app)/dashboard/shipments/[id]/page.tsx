'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { SERVICE_TYPES } from '@/lib/types'
import {
  MapPin,
  Clock,
  Package,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Truck,
  User,
  Phone,
  Mail,
  FileText,
  Scale,
  DollarSign,
  MessageSquare,
  Ruler,
  Map,
  Play,
  Pause,
  AlertTriangle,
  X,
  ShieldCheck,
  Loader2,
  Trash2,
  History
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [timeline, setTimeline] = useState<{ shipment: Shipment; events: TrackingEvent[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Movement control states
  const [showStartTripModal, setShowStartTripModal] = useState(false)
  const [showInterceptModal, setShowInterceptModal] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deliveryDays, setDeliveryDays] = useState(3)
  const [interceptReason, setInterceptReason] = useState('')
  const [clearReason, setClearReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    try {
      const [shipmentRes, timelineRes] = await Promise.all([
        api.get<Shipment>(`/shipments/${params.id}`),
        api.get<{ shipment: Shipment; events: TrackingEvent[] }>(`/tracking/timeline/${params.id}`),
      ])
      setShipment(shipmentRes.data)
      setTimeline(timelineRes.data)
    } catch (error) {
      console.error('Failed to load shipment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartTrip = async () => {
    if (!shipment || deliveryDays < 1) return
    setIsProcessing(true)
    try {
      await api.post(`/movement/${shipment.id}/start`, { deliveryDays })
      await loadData()
      setShowStartTripModal(false)
      setDeliveryDays(3)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start trip')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleIntercept = async () => {
    if (!shipment || !interceptReason.trim()) return
    setIsProcessing(true)
    try {
      await api.post(`/movement/${shipment.id}/pause`, { reason: interceptReason.trim() })
      await loadData()
      setShowInterceptModal(false)
      setInterceptReason('')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to intercept shipment')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearGoods = async () => {
    if (!shipment || !clearReason.trim()) return
    setIsProcessing(true)
    try {
      await api.post(`/movement/${shipment.id}/resume`, { reason: clearReason.trim() })
      await loadData()
      setShowClearModal(false)
      setClearReason('')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to clear goods')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearHistory = async () => {
    if (!shipment) return
    setIsClearingHistory(true)
    try {
      await api.post(`/movement/${shipment.id}/clear-history`)
      await loadData()
      alert('Tracking history cleared successfully')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to clear tracking history')
    } finally {
      setIsClearingHistory(false)
    }
  }

  const handleDeleteShipment = async () => {
    if (!shipment) return
    setIsProcessing(true)
    try {
      await api.delete(`/shipments/${shipment.id}`)
      router.push('/dashboard')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete shipment')
      setIsProcessing(false)
      setShowDeleteModal(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700',
      PICKED_UP: 'bg-blue-100 text-blue-700',
      IN_TRANSIT: 'bg-indigo-100 text-indigo-700',
      OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      INTERCEPTED: 'bg-red-100 text-red-700',
      AT_CLEARANCE: 'bg-orange-100 text-orange-700',
      CLEARED: 'bg-teal-100 text-teal-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getServiceTypeLabel = (value: string | null | undefined) => {
    if (!value) return 'Standard'
    const service = SERVICE_TYPES.find(s => s.value === value)
    return service ? service.label : value
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    )
  }

  if (!shipment || !timeline) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Shipment not found</h2>
        <p className="text-gray-600 mb-4">The shipment you're looking for doesn't exist.</p>
        <Link href="/dashboard" className="text-[#333366] hover:text-[#1a1a4e] font-medium">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#333366]">Shipment Details</h1>
          <p className="text-gray-600">Tracking: <span className="font-mono font-semibold">{shipment.trackingNumber}</span></p>
        </div>
        <Link
          href={`/dashboard/shipments/${shipment.id}/map`}
          className="inline-flex items-center px-5 py-2.5 bg-[#333366] text-white rounded-lg hover:bg-[#1a1a4e] shadow-lg transition-all font-medium"
        >
          <Map className="w-5 h-5 mr-2" />
          Live Tracking Map
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Movement Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Current Status & Movement</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center">
                  <div className="p-3 bg-white rounded-xl shadow-sm mr-4">
                    <Truck className="w-6 h-6 text-[#333366]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Shipment Status</p>
                    <p className="font-semibold text-gray-900">{shipment.currentStatus.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusColor(shipment.currentStatus)}`}>
                  {shipment.currentStatus.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shipment.currentLocation && (
                  <div className="flex items-center p-4 bg-blue-50 rounded-xl">
                    <MapPin className="w-5 h-5 text-blue-500 mr-3" />
                    <div>
                      <p className="text-xs text-blue-600 font-medium">CURRENT LOCATION</p>
                      <p className="font-medium text-gray-900">{shipment.currentLocation}</p>
                    </div>
                  </div>
                )}
                {shipment.movementState && (
                  <div className={`flex items-center p-4 rounded-xl ${shipment.movementState.isMoving ? 'bg-green-50' : 'bg-red-50'}`}>
                    {shipment.movementState.isMoving ? (
                      <Play className="w-5 h-5 text-green-500 mr-3" fill="currentColor" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
                    )}
                    <div>
                      <p className={`text-xs font-medium ${shipment.movementState.isMoving ? 'text-green-600' : 'text-red-600'}`}>
                        MOVEMENT STATUS
                      </p>
                      <p className={`font-medium ${shipment.movementState.isMoving ? 'text-green-700' : 'text-red-700'}`}>
                        {shipment.movementState.isMoving ? 'Active - In Motion' : 'INTERCEPTED'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Intercept Reason Display */}
              {shipment.movementState && !shipment.movementState.isMoving && shipment.movementState.interceptReason && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Interception Reason:</p>
                      <p className="text-sm text-red-600 mt-1">{shipment.movementState.interceptReason}</p>
                      {shipment.movementState.pausedAt && (
                        <p className="text-xs text-red-500 mt-2">
                          Intercepted at: {formatDate(shipment.movementState.pausedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Movement Control Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Movement Control</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {/* Start Trip Button */}
                <button
                  onClick={() => setShowStartTripModal(true)}
                  disabled={shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED' || shipment.currentStatus === 'IN_TRANSIT' || shipment.movementState !== null}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED' || shipment.currentStatus === 'IN_TRANSIT' || shipment.movementState !== null
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-green-200 bg-green-50 text-green-700 hover:border-green-400 hover:bg-green-100 cursor-pointer'
                  }`}
                >
                  <Play className="w-5 h-5 mb-1" fill="currentColor" />
                  <span className="text-sm font-semibold">Start Trip</span>
                </button>

                {/* Intercept Button */}
                <button
                  onClick={() => setShowInterceptModal(true)}
                  disabled={!shipment.movementState?.isMoving || shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED'}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    !shipment.movementState?.isMoving || shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED'
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-red-200 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100 cursor-pointer'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 mb-1" />
                  <span className="text-sm font-semibold">Intercept</span>
                </button>

                {/* Clear Goods Button */}
                <button
                  onClick={() => setShowClearModal(true)}
                  disabled={!shipment.movementState || shipment.movementState.isMoving !== false || shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED'}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    !shipment.movementState || shipment.movementState.isMoving !== false || shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED'
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 cursor-pointer'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 mb-1" />
                  <span className="text-sm font-semibold">Clear Goods</span>
                </button>
              </div>

              {/* Status Info */}
              <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 text-center">
                  {shipment.currentStatus === 'DELIVERED' && 'Shipment delivered.'}
                  {shipment.currentStatus === 'CANCELLED' && 'Shipment cancelled.'}
                  {(shipment.currentStatus === 'PENDING' || shipment.currentStatus === 'PICKED_UP') && !shipment.movementState && 'Click "Start Trip" to begin movement.'}
                  {shipment.movementState?.isMoving && 'In motion. Click "Intercept" to stop.'}
                  {shipment.movementState && !shipment.movementState.isMoving && shipment.currentStatus !== 'DELIVERED' && shipment.currentStatus !== 'CANCELLED' && 'Intercepted. Click "Clear Goods" to resume.'}
                </p>
              </div>
            </div>
          </div>

          {/* Route Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Routing Information</h2>
            </div>
            <div className="p-6">
              <div className="flex items-stretch">
                {/* Origin */}
                <div className="flex-1 p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-green-600">ORIGIN</span>
                  </div>
                  <p className="font-medium text-gray-900">{shipment.originLocation}</p>
                  {shipment.senderName && (
                    <p className="text-sm text-gray-600 mt-1">From: {shipment.senderName}</p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-0.5 bg-[#333366]"></div>
                    <ArrowRight className="w-6 h-6 text-[#333366] -mt-3" />
                    {shipment.serviceType && (
                      <span className="text-xs text-[#333366] font-medium mt-1">
                        {getServiceTypeLabel(shipment.serviceType)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Destination */}
                <div className="flex-1 p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-[#cc0000] rounded-full flex items-center justify-center mr-2">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-red-600">DESTINATION</span>
                  </div>
                  <p className="font-medium text-gray-900">{shipment.destinationLocation}</p>
                  {shipment.recipientName && (
                    <p className="text-sm text-gray-600 mt-1">To: {shipment.recipientName}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Package Details Card */}
          {(shipment.goodsDescription || shipment.packageWeight || shipment.declaredValue) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-[#333366] px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Package Details</h2>
              </div>
              <div className="p-6 space-y-4">
                {shipment.goodsDescription && (
                  <div className="flex items-start p-4 bg-gray-50 rounded-xl">
                    <FileText className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">GOODS DESCRIPTION</p>
                      <p className="text-gray-900">{shipment.goodsDescription}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {shipment.packageWeight && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                      <Scale className="w-5 h-5 text-gray-500 mr-3" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">WEIGHT</p>
                        <p className="font-medium text-gray-900">{shipment.packageWeight} lbs</p>
                      </div>
                    </div>
                  )}
                  {shipment.packageDimensions && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                      <Ruler className="w-5 h-5 text-gray-500 mr-3" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">DIMENSIONS</p>
                        <p className="font-medium text-gray-900">{shipment.packageDimensions}</p>
                      </div>
                    </div>
                  )}
                  {shipment.declaredValue && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                      <DollarSign className="w-5 h-5 text-gray-500 mr-3" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">DECLARED VALUE</p>
                        <p className="font-medium text-gray-900">${shipment.declaredValue.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {shipment.specialInstructions && (
                  <div className="flex items-start p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <MessageSquare className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                    <div>
                      <p className="text-xs text-yellow-700 font-medium mb-1">SPECIAL INSTRUCTIONS</p>
                      <p className="text-gray-900">{shipment.specialInstructions}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Tracking Timeline</h2>
            </div>
            <div className="p-6">
              {timeline.events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tracking events yet
                </div>
              ) : (
                <div className="space-y-1">
                  {timeline.events.map((event, index) => (
                    <div key={event.id} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                          index === 0
                            ? 'bg-[#333366]'
                            : 'bg-gray-200'
                        }`}>
                          {index === 0 ? (
                            <CheckCircle className="w-5 h-5 text-white" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        {index < timeline.events.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 min-h-[60px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="bg-gray-50 rounded-xl p-4 hover:bg-blue-50/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-gray-900">{event.status.replace('_', ' ')}</h3>
                            <span className="text-sm text-gray-500">{formatDate(event.eventTime)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="w-4 h-4 mr-1" />
                            {event.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Contact & Meta */}
        <div className="space-y-6">
          {/* Sender Info */}
          {(shipment.senderName || shipment.senderPhone || shipment.senderEmail) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-green-600 px-6 py-3">
                <h2 className="font-semibold text-white flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Sender Information
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {shipment.senderName && (
                  <div className="flex items-center text-sm">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.senderName}</span>
                  </div>
                )}
                {shipment.senderPhone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.senderPhone}</span>
                  </div>
                )}
                {shipment.senderEmail && (
                  <div className="flex items-center text-sm">
                    <Mail className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.senderEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recipient Info */}
          {(shipment.recipientName || shipment.recipientPhone || shipment.recipientEmail) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-[#cc0000] px-6 py-3">
                <h2 className="font-semibold text-white flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Recipient Information
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {shipment.recipientName && (
                  <div className="flex items-center text-sm">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.recipientName}</span>
                  </div>
                )}
                {shipment.recipientPhone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.recipientPhone}</span>
                  </div>
                )}
                {shipment.recipientEmail && (
                  <div className="flex items-center text-sm">
                    <Mail className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-gray-900">{shipment.recipientEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Service Type */}
          {shipment.serviceType && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <Truck className="w-5 h-5 text-[#333366] mr-3" />
                <div>
                  <p className="text-xs text-gray-500">Service Type</p>
                  <p className="font-semibold text-gray-900">{getServiceTypeLabel(shipment.serviceType)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-gray-500" />
              Timestamps
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(shipment.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(shipment.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Statistics */}
          {shipment._count && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-[#333366]">{shipment._count.trackingEvents}</p>
                  <p className="text-xs text-gray-500">Events</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-[#333366]">{shipment._count.locations}</p>
                  <p className="text-xs text-gray-500">Locations</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/dashboard/shipments/${shipment.id}/map`}
                className="flex items-center justify-center w-full px-4 py-3 bg-[#333366] text-white rounded-lg hover:bg-[#1a1a4e] transition-colors font-medium"
              >
                <Map className="w-4 h-4 mr-2" />
                Open Live Map
              </Link>
              <Link
                href={`/track/${shipment.trackingNumber}`}
                target="_blank"
                className="flex items-center justify-center w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <Package className="w-4 h-4 mr-2" />
                Public Tracking Page
              </Link>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Admin Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="flex items-center justify-center w-full px-4 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium disabled:opacity-50"
              >
                {isClearingHistory ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <History className="w-4 h-4 mr-2" />
                )}
                Clear Tracking History
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-center w-full px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Shipment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Start Trip Modal */}
      {showStartTripModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Play className="w-5 h-5 mr-2" fill="currentColor" />
                Start Trip
              </h3>
              <button onClick={() => setShowStartTripModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Set the estimated delivery time for this shipment. The tracking simulation will complete within this period.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Delivery Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The shipment will arrive at destination in approximately {deliveryDays} day{deliveryDays > 1 ? 's' : ''}.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStartTripModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartTrip}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" fill="currentColor" />
                      Start Trip
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intercept Modal */}
      {showInterceptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Intercept Shipment
              </h3>
              <button onClick={() => setShowInterceptModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                This will stop the shipment movement immediately. The user will be notified about the interception.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Interception <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={interceptReason}
                  onChange={(e) => setInterceptReason(e.target.value)}
                  placeholder="e.g., Customs inspection required, Address verification needed, Security check..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInterceptModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIntercept}
                  disabled={isProcessing || !interceptReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Intercept
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Goods Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2" />
                Clear Goods
              </h3>
              <button onClick={() => setShowClearModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                This will resume the shipment movement. The user will be notified that the goods have been cleared.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clearance Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={clearReason}
                  onChange={(e) => setClearReason(e.target.value)}
                  placeholder="e.g., Inspection completed - all clear, Documents verified, Security check passed..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearGoods}
                  disabled={isProcessing || !clearReason.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Clear Goods
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shipment Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Delete Shipment
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Are you sure?
              </h4>
              <p className="text-gray-600 text-center mb-4">
                This action cannot be undone. This will permanently delete the shipment and all associated tracking data.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tracking Number:</span>{' '}
                  <span className="font-mono">{shipment.trackingNumber}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteShipment}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
