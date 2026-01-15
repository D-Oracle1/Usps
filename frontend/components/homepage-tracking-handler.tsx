'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Pattern to detect USPS tracking numbers
const isTrackingNumber = (input: string): boolean => {
  const trimmed = input.trim().toUpperCase()

  // Check for our custom USPS prefix format (e.g., USPS7T17XRSFMKFUZZGU)
  if (/^USPS[A-Z0-9]+$/i.test(trimmed)) {
    return true
  }

  // Check for standard USPS 20-22 digit tracking numbers
  if (/^\d{20,22}$/.test(trimmed)) {
    return true
  }

  // Check for 13-character international format
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trimmed)) {
    return true
  }

  // Check for any alphanumeric string that looks like a tracking number
  // (at least 10 characters, mix of letters and numbers)
  if (/^[A-Z0-9]{10,}$/i.test(trimmed) && /[A-Z]/i.test(trimmed) && /\d/.test(trimmed)) {
    return true
  }

  return false
}

export default function HomepageTrackingHandler() {
  const router = useRouter()

  useEffect(() => {
    // Find all search inputs on the homepage (desktop and mobile)
    const searchInputIds = ['home-input', 'home-input-mob']
    const cleanupFunctions: (() => void)[] = []

    searchInputIds.forEach(inputId => {
      const searchInput = document.getElementById(inputId) as HTMLInputElement
      if (!searchInput) return

      // Find the form that contains this input
      const searchForm = searchInput.closest('form') as HTMLFormElement
      if (!searchForm) return

      const handleSubmit = (e: Event) => {
        const inputValue = searchInput.value.trim()

        if (inputValue && isTrackingNumber(inputValue)) {
          e.preventDefault()
          e.stopPropagation()
          // Navigate to the track page with the tracking number
          router.push(`/track?trackingNumber=${encodeURIComponent(inputValue)}`)
        }
        // If not a tracking number, let the form submit normally to /search
      }

      searchForm.addEventListener('submit', handleSubmit)
      cleanupFunctions.push(() => searchForm.removeEventListener('submit', handleSubmit))
    })

    // Also handle all search forms with tracking inputs
    const allSearchForms = document.querySelectorAll('form.search')
    allSearchForms.forEach(form => {
      const input = form.querySelector('input[name="keyword"], input[name="q"]') as HTMLInputElement
      if (!input) return

      const handleSubmit = (e: Event) => {
        const inputValue = input.value.trim()

        if (inputValue && isTrackingNumber(inputValue)) {
          e.preventDefault()
          e.stopPropagation()
          router.push(`/track?trackingNumber=${encodeURIComponent(inputValue)}`)
        }
      }

      form.addEventListener('submit', handleSubmit)
      cleanupFunctions.push(() => form.removeEventListener('submit', handleSubmit))
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [router])

  return null
}
