'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import api from '@/lib/api'
import type { Shipment } from '@/lib/types'
import { Package, Search, MapPin, Clock, Truck, ChevronRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const getStatusConfig = (status: string) => {
  const config: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
    PENDING: { color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Clock, label: 'Pending' },
    PICKED_UP: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Package, label: 'Picked Up' },
    IN_TRANSIT: { color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: Truck, label: 'In Transit' },
    OUT_FOR_DELIVERY: { color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Truck, label: 'Out for Delivery' },
    DELIVERED: { color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle, label: 'Delivered' },
    FAILED: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle, label: 'Failed' },
    CANCELLED: { color: 'text-gray-700', bgColor: 'bg-gray-100', icon: XCircle, label: 'Cancelled' },
    INTERCEPTED: { color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertCircle, label: 'Intercepted' },
    AT_CLEARANCE: { color: 'text-orange-700', bgColor: 'bg-orange-100', icon: AlertCircle, label: 'At Clearance' },
    CLEARED: { color: 'text-teal-700', bgColor: 'bg-teal-100', icon: CheckCircle, label: 'Cleared' },
  }
  return config[status] || config.PENDING
}

export default function MyShipmentsPage() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered'>('all')

  useEffect(() => {
    loadShipments()
  }, [])

  const loadShipments = async () => {
    try {
      // Fetch shipments associated with user's email
      const response = await api.get('/shipments/my-shipments')
      setShipments(response.data || [])
    } catch (error) {
      console.error('Failed to load shipments:', error)
      setShipments([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredShipments = shipments.filter(shipment => {
    // Filter by search
    const matchesSearch = !searchQuery ||
      shipment.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.originLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase())

    // Filter by tab
    if (activeTab === 'active') {
      return matchesSearch && !['DELIVERED', 'CANCELLED', 'FAILED'].includes(shipment.currentStatus)
    } else if (activeTab === 'delivered') {
      return matchesSearch && shipment.currentStatus === 'DELIVERED'
    }
    return matchesSearch
  })

  const stats = {
    total: shipments.length,
    active: shipments.filter(s => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(s.currentStatus)).length,
    delivered: shipments.filter(s => s.currentStatus === 'DELIVERED').length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your shipments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-gray-600 mt-1">Track and manage your shipments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`bg-white rounded-lg shadow-sm p-5 cursor-pointer border-2 transition-colors ${activeTab === 'all' ? 'border-[#333366]' : 'border-transparent hover:border-gray-200'}`}
          onClick={() => setActiveTab('all')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Shipments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-[#333366]/10 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-[#333366]" />
            </div>
          </div>
        </div>

        <div
          className={`bg-white rounded-lg shadow-sm p-5 cursor-pointer border-2 transition-colors ${activeTab === 'active' ? 'border-[#333366]' : 'border-transparent hover:border-gray-200'}`}
          onClick={() => setActiveTab('active')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div
          className={`bg-white rounded-lg shadow-sm p-5 cursor-pointer border-2 transition-colors ${activeTab === 'delivered' ? 'border-[#333366]' : 'border-transparent hover:border-gray-200'}`}
          onClick={() => setActiveTab('delivered')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.delivered}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by tracking number or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#333366] focus:border-transparent"
          />
        </div>
      </div>

      {/* Shipments List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeTab === 'all' && 'All Shipments'}
            {activeTab === 'active' && 'Active Shipments'}
            {activeTab === 'delivered' && 'Delivered Shipments'}
            <span className="text-gray-500 font-normal ml-2">({filteredShipments.length})</span>
          </h2>
        </div>

        {filteredShipments.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No shipments found</h3>
            <p className="text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Your shipments will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredShipments.map((shipment) => {
              const statusConfig = getStatusConfig(shipment.currentStatus)
              const StatusIcon = statusConfig.icon

              return (
                <Link
                  key={shipment.id}
                  href={`/my-shipments/${shipment.id}`}
                  className="block hover:bg-gray-50 transition-colors"
                >
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Tracking Number & Status */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-semibold text-[#333366]">
                            {shipment.trackingNumber}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Route */}
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <MapPin className="w-4 h-4 text-emerald-500 mr-1 flex-shrink-0" />
                          <span className="truncate">{shipment.originLocation}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <MapPin className="w-4 h-4 text-red-500 mr-1 flex-shrink-0" />
                          <span className="truncate">{shipment.destinationLocation}</span>
                        </div>

                        {/* Date & ETA */}
                        <div className="flex items-center text-xs text-gray-500 gap-4">
                          <span>Created {formatDate(shipment.createdAt)}</span>
                          {shipment.estimatedArrival && shipment.currentStatus !== 'DELIVERED' && (
                            <span className="text-indigo-600">
                              ETA: {formatDate(shipment.estimatedArrival)}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
