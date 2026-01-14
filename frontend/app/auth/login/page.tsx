'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Eye, EyeOff, Mail, MapPin, Stamp, Inbox, Pause, Calendar, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Header Bar */}
      <div className="bg-[#d5d5d5] border-b border-[#ccc]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-sm">
            <Link href="/" className="text-[#333366] hover:underline font-medium">
              Back to USPS.com
            </Link>
            <Link href="#" className="text-[#333366] hover:underline flex items-center gap-1">
              <span className="text-gray-500">○</span> Support
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Login Form Section */}
            <div className="lg:w-1/2">
              <h1 className="text-2xl font-bold text-[#333366] mb-2">
                Sign in to Your<br />USPS.com Account
              </h1>
              <p className="text-sm text-gray-600 mb-6">
                Your USPS.com account provides access to all of your applications and services on USPS.com. Usernames and Passwords are case sensitive.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm text-gray-700 mb-1">
                    User Name
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-[#333366] rounded focus:outline-none focus:ring-2 focus:ring-[#333366]"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 pr-10 border border-[#333366] rounded focus:outline-none focus:ring-2 focus:ring-[#333366]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full max-w-[200px] bg-[#333366] text-white py-2.5 px-6 font-medium rounded hover:bg-[#1a1a4e] focus:outline-none focus:ring-2 focus:ring-[#333366] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 space-y-1">
                <Link href="#" className="block text-[#333366] text-sm hover:underline">
                  Forgot your username?
                </Link>
                <Link href="#" className="block text-[#333366] text-sm hover:underline">
                  Forgot your password?
                </Link>
              </div>

              <div className="mt-6">
                <Link
                  href="/auth/register"
                  className="inline-block border-2 border-[#333366] text-[#333366] py-2 px-6 font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  Create New Account
                </Link>
              </div>

              <p className="mt-6 text-xs text-gray-600">
                The United States Postal Service is serious about protecting your personal information. <strong>For added security, please consider changing your password periodically.</strong>
              </p>
            </div>

            {/* Benefits Section */}
            <div className="lg:w-1/2">
              <div className="bg-[#f7f7f7] p-6 rounded">
                <h2 className="text-xl font-bold text-[#333366] mb-3">
                  Benefits of a USPS.com Account
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Your USPS.com account allows you to access a variety of services across our digital platforms. In addition to this application, you can do everything from manage your PO Box to purchase stamps and other shipping materials.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <Mail className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">PO Boxes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">Change My Address</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <Stamp className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">Buy Stamps</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">Informed Delivery<sup>®</sup></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <Pause className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">Hold Mail</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#333366]">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-gray-700">Schedule a Pickup</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#f5f5f5] border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* USPS Logo */}
          <div className="mb-6">
            <span className="text-2xl font-bold text-[#333366]">
              <span className="text-[#cc0000]">✉</span>USPS.COM
            </span>
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase">Helpful Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="text-[#333366] hover:underline">Contact Us</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Site Index</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">FAQs</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase">On About USPS.com</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="text-[#333366] hover:underline">About USPS Home</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Newsroom</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">USPS Service Updates</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Forms & Publications</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Government Services</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase">Other USPS Sites</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="text-[#333366] hover:underline">Business Customer Gateway</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Postal Inspectors</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Inspector General</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Postal Explorer</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">National Postal Museum</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Resources for Developers</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">PostalPro</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase">Legal Information</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="text-[#333366] hover:underline">Privacy Policy</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Terms of Use</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">FOIA</Link></li>
                <li><Link href="#" className="text-[#cc0000] hover:underline">No FEAR Act/EEO Contacts</Link></li>
                <li><Link href="#" className="text-[#cc0000] hover:underline">Fair Chance Act</Link></li>
                <li><Link href="#" className="text-[#333366] hover:underline">Accessibility Statement</Link></li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-500 mb-4">
            Copyright © {new Date().getFullYear()} USPS. All Rights Reserved.
          </div>

          {/* Social Icons */}
          <div className="flex gap-4">
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </Link>
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </Link>
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>
            </Link>
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm4.441 16.892c-2.102.144-6.784.144-8.883 0-2.276-.156-2.541-1.27-2.558-4.892.017-3.629.285-4.736 2.558-4.892 2.099-.144 6.782-.144 8.883 0 2.277.156 2.541 1.27 2.559 4.892-.018 3.629-.285 4.736-2.559 4.892zm-6.441-7.234l4.917 2.338-4.917 2.346v-4.684z"/></svg>
            </Link>
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </Link>
            <Link href="#" className="text-[#333366] hover:text-[#1a1a4e]">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
