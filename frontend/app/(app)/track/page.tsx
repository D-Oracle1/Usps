'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Package, MapPin, Clock, Truck, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import type { Shipment, TrackingEvent } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

// Inner component that uses useSearchParams
function TrackingPageContent() {
  const searchParams = useSearchParams()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-search when tracking number is provided via URL params
  useEffect(() => {
    const urlTrackingNumber = searchParams.get('trackingNumber') || searchParams.get('keyword')
    if (urlTrackingNumber) {
      setTrackingNumber(urlTrackingNumber)
      performSearch(urlTrackingNumber)
    }
  }, [searchParams])

  const performSearch = async (number: string) => {
    setError('')
    setIsLoading(true)
    setShipment(null)
    setEvents([])

    try {
      const response = await api.get<{ shipment: Shipment; events: TrackingEvent[] }>(
        `/tracking/public/${number}`
      )
      setShipment(response.data.shipment)
      setEvents(response.data.events)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Shipment not found')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(trackingNumber)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      PICKED_UP: 'bg-blue-100 text-blue-800 border-blue-300',
      IN_TRANSIT: 'bg-purple-100 text-purple-800 border-purple-300',
      OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      DELIVERED: 'bg-green-100 text-green-800 border-green-300',
      FAILED: 'bg-red-100 text-red-800 border-red-300',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* USPS Top Header Bar */}
      <div className="bg-[#333366] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-8 text-xs">
            <div className="flex items-center space-x-4">
              <span>USPS.COM</span>
              <span className="text-gray-300">|</span>
              <span>English</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="hover:underline">Admin Portal</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="bg-[#333366] p-2 rounded">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold text-[#333366]">USPS</div>
                <div className="text-xs text-gray-500 -mt-1">United States Postal Service</div>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-sm font-medium text-[#333366] hover:text-[#cc0000]">Send</a>
              <a href="#" className="text-sm font-medium text-[#333366] hover:text-[#cc0000]">Receive</a>
              <a href="#" className="text-sm font-medium text-[#cc0000] border-b-2 border-[#cc0000] pb-1">Track</a>
              <a href="#" className="text-sm font-medium text-[#333366] hover:text-[#cc0000]">Shop</a>
              <a href="#" className="text-sm font-medium text-[#333366] hover:text-[#cc0000]">Help</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-[#333366] text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Track Your Package</h1>
          <p className="text-gray-300 text-lg">Enter your USPS tracking number to get real-time updates</p>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <div className="bg-white rounded shadow-lg border border-gray-200 p-6">
          <form onSubmit={handleSearch}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Package className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number (e.g., USPS1234567890)"
                  className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-[#cc0000] text-white font-semibold rounded hover:bg-[#990000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Search className="w-5 h-5 mr-2" />
                {isLoading ? 'Searching...' : 'Track'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {shipment && (
        <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-xl font-bold text-white">Tracking Details</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Tracking Number</div>
                  <div className="text-xl font-bold text-[#333366]">{shipment.trackingNumber}</div>
                </div>
                <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded border ${getStatusColor(shipment.currentStatus)}`}>
                  {shipment.currentStatus.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-sm text-gray-500 mb-2">Origin</div>
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="font-medium text-gray-900">{shipment.originLocation}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Destination</div>
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-[#cc0000] mr-2 mt-0.5 flex-shrink-0" />
                    <div className="font-medium text-gray-900">{shipment.destinationLocation}</div>
                  </div>
                </div>
              </div>

              {shipment.goodsDescription && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500 mb-2">Package Contents</div>
                  <div className="flex items-start">
                    <Package className="w-5 h-5 text-[#336699] mr-2 mt-0.5 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{shipment.goodsDescription}</span>
                  </div>
                </div>
              )}

              {shipment.currentLocation && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500 mb-2">Current Location</div>
                  <div className="flex items-center">
                    <Truck className="w-5 h-5 text-[#336699] mr-2" />
                    <span className="font-medium text-gray-900">{shipment.currentLocation}</span>
                  </div>
                </div>
              )}

              {/* View Live Map Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link
                  href={`/track/${shipment.trackingNumber}/map`}
                  className="flex items-center justify-center px-6 py-3 bg-[#333366] text-white font-semibold rounded hover:bg-[#1a1a4e] transition-colors"
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  View Live Map
                </Link>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-[#333366] px-6 py-4">
              <h2 className="text-xl font-bold text-white">Shipment History</h2>
            </div>
            <div className="p-6">
              {events.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No tracking events yet</p>
              ) : (
                <div className="space-y-6">
                  {events.map((event, index) => (
                    <div key={event.id} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-[#333366]' : 'bg-gray-300'
                        }`}>
                          <Clock className={`w-5 h-5 ${index === 0 ? 'text-white' : 'text-gray-600'}`} />
                        </div>
                        {index < events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-300 min-h-[40px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                          <h3 className="font-semibold text-[#333366]">{event.status.replace('_', ' ')}</h3>
                          <span className="text-sm text-gray-500">{formatDate(event.eventTime)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="w-4 h-4 mr-1" />
                          {event.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      {!shipment && (
        <div className="max-w-4xl mx-auto px-4 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded shadow border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-[#333366] rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-[#333366] mb-2">Track Packages</h3>
              <p className="text-sm text-gray-600">Get real-time updates on your shipment status and location.</p>
            </div>
            <div className="bg-white rounded shadow border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-[#333366] rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-[#333366] mb-2">Delivery Updates</h3>
              <p className="text-sm text-gray-600">Know exactly when your package will arrive at its destination.</p>
            </div>
            <div className="bg-white rounded shadow border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-[#333366] rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-[#333366] mb-2">Location History</h3>
              <p className="text-sm text-gray-600">View the complete journey of your package from origin to destination.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#333366] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Quick Tools</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Track a Package</a></li>
                <li><a href="#" className="hover:text-white">Calculate a Price</a></li>
                <li><a href="#" className="hover:text-white">Find USPS Locations</a></li>
                <li><a href="#" className="hover:text-white">Schedule a Pickup</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Mail & Ship</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Priority Mail</a></li>
                <li><a href="#" className="hover:text-white">Priority Mail Express</a></li>
                <li><a href="#" className="hover:text-white">First-Class Mail</a></li>
                <li><a href="#" className="hover:text-white">USPS Ground Advantage</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Help</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">FAQs</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">File a Claim</a></li>
                <li><a href="#" className="hover:text-white">Site Index</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contact</h3>
              <p className="text-sm text-gray-300">
                1-800-ASK-USPS<br />
                (1-800-275-8777)
              </p>
              <p className="text-sm text-gray-300 mt-4">
                Mon-Fri 8am-8:30pm ET<br />
                Sat 8am-6pm ET
              </p>
            </div>
          </div>
          <div className="border-t border-gray-500 mt-8 pt-6 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} United States Postal Service. All Rights Reserved.</p>
            <div className="mt-2 space-x-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <span>|</span>
              <a href="#" className="hover:text-white">Terms of Use</a>
              <span>|</span>
              <a href="#" className="hover:text-white">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Main component wrapped with Suspense for useSearchParams
export default function PublicTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#333366] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TrackingPageContent />
    </Suspense>
  )
}
