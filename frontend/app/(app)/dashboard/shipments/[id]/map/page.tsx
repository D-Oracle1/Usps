'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import type { Shipment } from '@/lib/types'
import ShipmentMap from '@/components/shipment-map'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ShipmentMapPage() {
  const params = useParams()
  const router = useRouter()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadShipment()
  }, [params.id])

  const loadShipment = async () => {
    try {
      const response = await api.get<Shipment>(`/shipments/${params.id}`)
      setShipment(response.data)
    } catch (error) {
      console.error('Failed to load shipment:', error)
      alert('Failed to load shipment')
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading map...</div>
      </div>
    )
  }

  if (!shipment) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/shipments/${shipment.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
            <p className="text-sm text-gray-600">Tracking: {shipment.trackingNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Status:</span>
          <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
            {shipment.currentStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="h-[calc(100vh-12rem)] bg-white rounded-lg shadow">
        <ShipmentMap shipment={shipment} onMovementStateChange={loadShipment} />
      </div>
    </div>
  )
}
