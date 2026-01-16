'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Truck, AlertCircle } from 'lucide-react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      await register(name, email, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* USPS Header */}
      <div className="bg-[#333366] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-sm">
            <span>USPS.COM</span>
            <Link href="/track" className="hover:underline">Track a Package</Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16">
            <div className="flex items-center">
              <div className="bg-[#333366] p-2 rounded">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold text-[#333366]">USPS</div>
                <div className="text-xs text-gray-500 -mt-1">United States Postal Service</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Register Form */}
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#333366] px-6 py-4">
            <h1 className="text-xl font-bold text-white">Create Account</h1>
            <p className="text-sm text-gray-300 mt-1">Register to track and manage your shipments</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#333366] focus:ring-1 focus:ring-[#333366]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#cc0000] text-white py-3 px-4 font-semibold rounded hover:bg-[#990000] focus:outline-none focus:ring-2 focus:ring-[#cc0000] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#336699] font-medium hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/track" className="text-sm text-[#336699] hover:underline">
            &larr; Back to Public Tracking
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#333366] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-300">
          <p>&copy; {new Date().getFullYear()} United States Postal Service. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  )
}
