'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { SERVICE_TYPES } from '@/lib/types'
import {
  ArrowLeft,
  Package,
  MapPin,
  Loader2,
  Sparkles,
  AlertCircle,
  User,
  Phone,
  Mail,
  FileText,
  Scale,
  DollarSign,
  Truck,
  MessageSquare,
  Ruler,
  CheckCircle
} from 'lucide-react'

export default function NewShipmentPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<'shipment' | 'sender' | 'recipient' | 'package'>('shipment')
  const [formData, setFormData] = useState({
    // Shipment details
    trackingNumber: '',
    originLocation: '',
    destinationLocation: '',
    currentStatus: 'PENDING',
    // Package details
    goodsDescription: '',
    packageWeight: '',
    packageDimensions: '',
    declaredValue: '',
    serviceType: 'PRIORITY_MAIL',
    // Sender info
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    // Recipient info
    recipientName: '',
    recipientPhone: '',
    recipientEmail: '',
    // Special instructions
    specialInstructions: '',
  })

  const generateTrackingNumber = () => {
    const prefix = 'USPS'
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    const timestamp = Date.now().toString(36).toUpperCase()
    setFormData(prev => ({ ...prev, trackingNumber: `${prefix}${random}${timestamp}` }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        packageWeight: formData.packageWeight ? parseFloat(formData.packageWeight) : undefined,
        declaredValue: formData.declaredValue ? parseFloat(formData.declaredValue) : undefined,
      }

      const response = await api.post('/shipments', payload)
      router.push(`/dashboard/shipments/${response.data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create shipment')
    } finally {
      setIsLoading(false)
    }
  }

  const sections = [
    { id: 'shipment', label: 'Shipment', icon: Truck },
    { id: 'sender', label: 'Sender', icon: User },
    { id: 'recipient', label: 'Recipient', icon: User },
    { id: 'package', label: 'Package', icon: Package },
  ] as const

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#333366]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#333366]">Create New Shipment</h1>
          <p className="text-gray-600 text-sm">Fill in the shipment details below</p>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-1 flex gap-1">
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all ${
                isActive
                  ? 'bg-[#333366] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          )
        })}
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Shipment Details Section */}
          {activeSection === 'shipment' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Truck className="w-5 h-5 text-[#333366]" />
                <h2 className="text-lg font-semibold text-gray-900">Shipment Details</h2>
              </div>

              {/* Tracking Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Tracking Number <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-3">
                  <div className="relative flex-1">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, trackingNumber: e.target.value.toUpperCase() }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                      placeholder="USPS123456789"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateTrackingNumber}
                    className="inline-flex items-center px-4 py-3 text-sm font-medium text-[#333366] bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </button>
                </div>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Service Type
                </label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20 bg-white"
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Origin Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Origin Location <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                  <input
                    type="text"
                    value={formData.originLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, originLocation: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="e.g., New York, NY or 123 Main St, New York, NY 10001"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter city, state or full address</p>
              </div>

              {/* Destination Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Destination Location <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#cc0000]" />
                  <input
                    type="text"
                    value={formData.destinationLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, destinationLocation: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="e.g., Los Angeles, CA or 456 Oak Ave, Los Angeles, CA 90001"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter city, state or full address</p>
              </div>

              {/* Initial Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Initial Status
                </label>
                <select
                  value={formData.currentStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStatus: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20 bg-white"
                >
                  <option value="PENDING">Pending</option>
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="IN_TRANSIT">In Transit</option>
                </select>
              </div>
            </div>
          )}

          {/* Sender Details Section */}
          {activeSection === 'sender' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <User className="w-5 h-5 text-[#333366]" />
                <h2 className="text-lg font-semibold text-gray-900">Sender Information</h2>
              </div>

              {/* Sender Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sender Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.senderName}
                    onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Sender Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sender Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, senderPhone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              {/* Sender Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sender Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="sender@example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Recipient Details Section */}
          {activeSection === 'recipient' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <User className="w-5 h-5 text-[#333366]" />
                <h2 className="text-lg font-semibold text-gray-900">Recipient Information</h2>
              </div>

              {/* Recipient Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Recipient Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.recipientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="Jane Smith"
                  />
                </div>
              </div>

              {/* Recipient Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Recipient Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.recipientPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientPhone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>

              {/* Recipient Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Recipient Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="recipient@example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Package Details Section */}
          {activeSection === 'package' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Package className="w-5 h-5 text-[#333366]" />
                <h2 className="text-lg font-semibold text-gray-900">Package Details</h2>
              </div>

              {/* Goods Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Goods Description <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    value={formData.goodsDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, goodsDescription: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20 min-h-[100px] resize-y"
                    placeholder="Describe the contents of the package (e.g., Electronics - Laptop Computer, Documents, Clothing items, etc.)"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Provide a detailed description of the package contents</p>
              </div>

              {/* Weight and Dimensions Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Package Weight */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Package Weight (lbs)
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.packageWeight}
                      onChange={(e) => setFormData(prev => ({ ...prev, packageWeight: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Package Dimensions */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Dimensions (L x W x H in)
                  </label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.packageDimensions}
                      onChange={(e) => setFormData(prev => ({ ...prev, packageDimensions: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                      placeholder="12 x 8 x 6"
                    />
                  </div>
                </div>
              </div>

              {/* Declared Value */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Declared Value (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.declaredValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, declaredValue: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Value for insurance purposes</p>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Special Instructions
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    value={formData.specialInstructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#333366] focus:ring-2 focus:ring-[#333366]/20 min-h-[80px] resize-y"
                    placeholder="e.g., Fragile - Handle with care, Leave at back door, Signature required, etc."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Summary */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2">
                {formData.trackingNumber ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={formData.trackingNumber ? 'text-gray-900' : 'text-gray-500'}>Tracking #</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.originLocation && formData.destinationLocation ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={formData.originLocation && formData.destinationLocation ? 'text-gray-900' : 'text-gray-500'}>Locations</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.senderName || formData.senderPhone || formData.senderEmail ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={formData.senderName || formData.senderPhone || formData.senderEmail ? 'text-gray-900' : 'text-gray-500'}>Sender</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.recipientName || formData.recipientPhone || formData.recipientEmail ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={formData.recipientName || formData.recipientPhone || formData.recipientEmail ? 'text-gray-900' : 'text-gray-500'}>Recipient</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.goodsDescription ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={formData.goodsDescription ? 'text-gray-900' : 'text-gray-500'}>Package</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 p-6 border-t border-gray-200 bg-white">
            <Link
              href="/dashboard"
              className="flex-1 px-6 py-3 text-center text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading || !formData.trackingNumber || !formData.originLocation || !formData.destinationLocation || !formData.goodsDescription}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-[#cc0000] text-white rounded-lg hover:bg-[#990000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Package className="w-5 h-5 mr-2" />
                  Create Shipment
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
