'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import type { Shipment, Statistics, PaginatedResponse } from '@/lib/types'
import { Package, TrendingUp, CheckCircle, XCircle, Plus, MapPin, Clock, ArrowRight, Search, Truck, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [page])

  const loadData = async () => {
    try {
      const [shipmentsRes, statsRes] = await Promise.allSettled([
        api.get(`/shipments?page=${page}&limit=10`),
        api.get('/shipments/statistics'),
      ])

      if (shipmentsRes.status === 'fulfilled') {
        setShipments(shipmentsRes.value.data)
      }

      if (statsRes.status === 'fulfilled') {
        setStatistics(statsRes.value.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }


  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      PICKED_UP: 'bg-blue-100 text-blue-800 border-blue-300',
      IN_TRANSIT: 'bg-purple-100 text-purple-800 border-purple-300',
      OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      DELIVERED: 'bg-green-100 text-green-800 border-green-300',
      FAILED: 'bg-red-100 text-red-800 border-red-300',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
    }
    return styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const filteredShipments = shipments.filter(s =>
    s.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.originLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#333366]">Shipments Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">Manage and track all shipments</p>
        </div>
        <Link
          href="/dashboard/shipments/new"
          className="inline-flex items-center px-5 py-2.5 bg-[#cc0000] text-white font-semibold rounded hover:bg-[#990000] transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Shipment
        </Link>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-[#333366] mt-1">{statistics.total}</p>
              </div>
              <div className="p-2 bg-[#333366] rounded">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{statistics.pending}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">In Transit</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{statistics.inTransit}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Delivered</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{statistics.delivered}</p>
              </div>
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Failed</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{statistics.failed}</p>
              </div>
              <div className="p-2 bg-red-100 rounded">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipments Table */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#333366]">Recent Shipments</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tracking #, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded w-full sm:w-64 focus:outline-none focus:border-[#333366]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tracking Number</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {searchQuery ? 'No shipments match your search' : 'No shipments found'}
                    </p>
                    {!searchQuery && (
                      <Link href="/dashboard/shipments/new" className="text-[#cc0000] font-medium hover:underline mt-2 inline-block">
                        Create your first shipment
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/shipments/${shipment.id}`} className="font-medium text-[#336699] hover:text-[#333366] hover:underline">
                        {shipment.trackingNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-green-500 mr-1 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{shipment.originLocation}</span>
                        <ArrowRight className="w-4 h-4 mx-1 text-gray-400 flex-shrink-0" />
                        <MapPin className="w-4 h-4 text-red-500 mr-1 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{shipment.destinationLocation}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded border ${getStatusBadge(shipment.currentStatus)}`}>
                        {shipment.currentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {formatDate(shipment.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-[#333366] border border-[#333366] rounded hover:bg-[#333366] hover:text-white transition-colors"
                        >
                          Details
                        </Link>
                        <Link
                          href={`/dashboard/shipments/${shipment.id}/map`}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#333366] rounded hover:bg-[#1a1a4e] transition-colors"
                        >
                          Track
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-[#333366] bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-[#333366] bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
