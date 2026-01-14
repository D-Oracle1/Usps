'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { TrendingUp, Package, CheckCircle, Clock, Activity, ArrowRight, BarChart3, Truck, XCircle } from 'lucide-react'

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, trendsRes, routesRes, activityRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/analytics/trends?days=30'),
        api.get('/analytics/routes?limit=5'),
        api.get('/analytics/activity?limit=10'),
      ])

      setStats(statsRes.data)
      setTrends(trendsRes.data)
      setRoutes(routesRes.data)
      setActivity(activityRes.data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#333366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#333366]">Analytics Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">System performance and insights</p>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Shipments</p>
                <p className="text-2xl font-bold text-[#333366] mt-1">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.deliveryRate}% delivery rate</p>
              </div>
              <div className="p-2 bg-[#333366] rounded">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Week</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.weekShipments}</p>
                <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
              </div>
              <div className="p-2 bg-green-100 rounded">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Delivered</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.delivered}</p>
                <p className="text-xs text-gray-500 mt-1">Successfully completed</p>
              </div>
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Delivery</p>
                <p className="text-2xl font-bold text-[#336699] mt-1">{stats.avgDeliveryTime}h</p>
                <p className="text-xs text-gray-500 mt-1">Average duration</p>
              </div>
              <div className="p-2 bg-blue-100 rounded">
                <Clock className="w-5 h-5 text-[#336699]" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-[#333366] px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Top Routes</h2>
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="p-5">
            {routes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No route data available</div>
            ) : (
              <div className="space-y-3">
                {routes.map((route, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center flex-1">
                      <div className="w-8 h-8 rounded-full bg-[#333366] flex items-center justify-center text-white text-sm font-semibold mr-3">
                        {index + 1}
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-900">{route.origin}</span>
                        <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
                        <span className="font-medium text-gray-900">{route.destination}</span>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-[#333366] text-white rounded text-sm font-semibold">
                      {route.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-[#333366] px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="p-5">
            {activity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No recent activity</div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {activity.map((event) => (
                  <div key={event.id} className="flex items-start p-4 bg-gray-50 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div className="p-2 bg-white rounded border border-gray-200 mr-3">
                      <Truck className="w-4 h-4 text-[#333366]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#336699]">
                        {event.shipment?.trackingNumber || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600 truncate">{event.description}</div>
                      <div className="text-xs text-gray-500 mt-1">{event.location}</div>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap ml-2">
                      {new Date(event.eventTime).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      {stats && (
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-[#333366] px-5 py-4">
            <h2 className="text-lg font-semibold text-white">Status Distribution</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-yellow-50 rounded border border-yellow-200">
                <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
                <p className="text-xs text-gray-600 font-medium">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded border border-blue-200">
                <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{stats.pickedUp || 0}</p>
                <p className="text-xs text-gray-600 font-medium">Picked Up</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded border border-purple-200">
                <Truck className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">{stats.inTransit || 0}</p>
                <p className="text-xs text-gray-600 font-medium">In Transit</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded border border-green-200">
                <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{stats.delivered || 0}</p>
                <p className="text-xs text-gray-600 font-medium">Delivered</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded border border-red-200">
                <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{stats.failed || 0}</p>
                <p className="text-xs text-gray-600 font-medium">Failed</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
