'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { ArrowLeft, MapPin, Package, Clock, Truck, CheckCircle, AlertCircle, AlertTriangle, ShieldCheck, User, Phone, Mail, FileText, Scale, DollarSign, Ruler, Calendar, Map } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const getStatusConfig = (status: string) => {
  const config: Record<string, { color: string; bgColor: string; label: string }> = {
    PENDING: { color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Pending' },
    PICKED_UP: { color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Picked Up' },
    IN_TRANSIT: { color: 'text-indigo-700', bgColor: 'bg-indigo-100', label: 'In Transit' },
    OUT_FOR_DELIVERY: { color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'Out for Delivery' },
    DELIVERED: { color: 'text-emerald-700', bgColor: 'bg-emerald-100', label: 'Delivered' },
    FAILED: { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Failed' },
    CANCELLED: { color: 'text-gray-700', bgColor: 'bg-gray-100', label: 'Cancelled' },
    INTERCEPTED: { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Intercepted' },
    AT_CLEARANCE: { color: 'text-orange-700', bgColor: 'bg-orange-100', label: 'At Clearance' },
    CLEARED: { color: 'text-teal-700', bgColor: 'bg-teal-100', label: 'Cleared' },
  }
  return config[status] || config.PENDING
}

export default function UserShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadShipment()
  }, [params.id])

  const loadShipment = async () => {
    try {
      const response = await api.get(`/shipments/${params.id}`)
      setShipment(response.data)
    } catch (error) {
      console.error('Failed to load shipment:', error)
      router.push('/my-shipments')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return null
  }

  const statusConfig = getStatusConfig(shipment.currentStatus)
  const events = shipment.trackingEvents || []
  const showLiveTracking = ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'INTERCEPTED'].includes(shipment.currentStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/my-shipments"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{shipment.trackingNumber}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {showLiveTracking && (
                  <Link
                    href={`/track/${shipment.trackingNumber}/map`}
                    className="inline-flex items-center px-3 py-1 bg-[#333366] text-white text-sm font-medium rounded-full hover:bg-[#1a1a4e] transition-colors"
                  >
                    <Map className="w-4 h-4 mr-1" />
                    Live Map
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route Card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2 text-[#333366]" />
              Shipment Route
            </h2>
            <div className="flex items-stretch">
              {/* Origin */}
              <div className="flex-1 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center mr-2">
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">FROM</span>
                </div>
                <p className="font-medium text-gray-900">{shipment.originLocation}</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center px-4">
                <div className="w-8 h-0.5 bg-[#333366]"></div>
                <div className="w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent border-l-[#333366]"></div>
              </div>

              {/* Destination */}
              <div className="flex-1 p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mr-2">
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-red-600">TO</span>
                </div>
                <p className="font-medium text-gray-900">{shipment.destinationLocation}</p>
              </div>
            </div>

            {/* ETA */}
            {shipment.estimatedArrival && shipment.currentStatus !== 'DELIVERED' && (
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-center">
                <p className="text-sm text-indigo-600">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Estimated arrival: <span className="font-semibold">{formatDate(shipment.estimatedArrival)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Package Details */}
          {(shipment.goodsDescription || shipment.packageWeight || shipment.declaredValue) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-[#333366]" />
                Package Details
              </h2>

              {shipment.goodsDescription && (
                <div className="flex items-start p-3 bg-gray-50 rounded-lg mb-3">
                  <FileText className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">CONTENTS</p>
                    <p className="text-gray-900">{shipment.goodsDescription}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {shipment.packageWeight && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Scale className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Weight</p>
                      <p className="font-medium text-gray-900">{shipment.packageWeight} lbs</p>
                    </div>
                  </div>
                )}
                {shipment.packageDimensions && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Ruler className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Dimensions</p>
                      <p className="font-medium text-gray-900">{shipment.packageDimensions}</p>
                    </div>
                  </div>
                )}
                {shipment.declaredValue && (
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <DollarSign className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Declared Value</p>
                      <p className="font-medium text-gray-900">${shipment.declaredValue.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tracking History */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-[#333366]" />
              Tracking History
            </h2>

            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tracking events yet
              </div>
            ) : (
              <div className="space-y-1">
                {events.map((event, index) => (
                  <div key={event.id} className="flex">
                    <div className="flex flex-col items-center mr-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-[#333366]' :
                        event.status === 'INTERCEPTED' ? 'bg-red-500' :
                        event.status === 'CLEARED' || event.status === 'IN_TRANSIT' ? 'bg-emerald-500' :
                        event.status === 'DELIVERED' ? 'bg-green-500' :
                        'bg-gray-300'
                      }`}>
                        {event.status === 'INTERCEPTED' ? (
                          <AlertTriangle className="w-4 h-4 text-white" />
                        ) : event.status === 'CLEARED' ? (
                          <ShieldCheck className="w-4 h-4 text-white" />
                        ) : event.status === 'DELIVERED' ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <Package className="w-4 h-4 text-white" />
                        )}
                      </div>
                      {index < events.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 min-h-[40px]" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className={`p-3 rounded-lg ${
                        event.status === 'INTERCEPTED' ? 'bg-red-50 border border-red-100' :
                        event.status === 'CLEARED' ? 'bg-emerald-50 border border-emerald-100' :
                        event.status === 'DELIVERED' ? 'bg-green-50 border border-green-100' :
                        'bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${
                            event.status === 'INTERCEPTED' ? 'text-red-700' :
                            event.status === 'CLEARED' ? 'text-emerald-700' :
                            event.status === 'DELIVERED' ? 'text-green-700' :
                            'text-gray-900'
                          }`}>
                            {event.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(event.eventTime)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{event.description}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
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

        {/* Right Column */}
        <div className="space-y-6">
          {/* Sender Info */}
          {(shipment.senderName || shipment.senderPhone || shipment.senderEmail) && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-emerald-600 px-4 py-3">
                <h3 className="font-semibold text-white flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Sender
                </h3>
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-red-600 px-4 py-3">
                <h3 className="font-semibold text-white flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Recipient
                </h3>
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

          {/* Shipment Info */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
              Shipment Info
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(shipment.createdAt)}</span>
              </div>
              {shipment.serviceType && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Service</span>
                  <span className="text-sm font-medium text-gray-900">{shipment.serviceType.replace(/_/g, ' ')}</span>
                </div>
              )}
              {shipment.totalDistance && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">Distance</span>
                  <span className="text-sm font-medium text-gray-900">{Math.round(shipment.totalDistance)} km</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
