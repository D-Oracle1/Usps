'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api from './api'
import { SupportUser } from './support-types'

interface SupportAuthContextType {
  user: SupportUser | null
  token: string | null
  isLoading: boolean
  isLinkedFromMain: boolean
  needsAccountCreation: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>
  logout: () => void
  autoLinkFromMainAuth: () => Promise<boolean>
}

const SupportAuthContext = createContext<SupportAuthContextType | undefined>(undefined)

export function SupportAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupportUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLinkedFromMain, setIsLinkedFromMain] = useState(false)
  const [needsAccountCreation, setNeedsAccountCreation] = useState(false)

  useEffect(() => {
    // Load from localStorage on mount
    const storedToken = localStorage.getItem('support_auth_token')
    const storedUser = localStorage.getItem('support_user')

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        // Clear invalid data
        localStorage.removeItem('support_auth_token')
        localStorage.removeItem('support_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/support/auth/login', { email, password })
    const { access_token, user: userData } = response.data

    localStorage.setItem('support_auth_token', access_token)
    localStorage.setItem('support_user', JSON.stringify(userData))

    setToken(access_token)
    setUser(userData)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const response = await api.post('/support/auth/register', { name, email, password, phone })
    const { access_token, user: userData } = response.data

    localStorage.setItem('support_auth_token', access_token)
    localStorage.setItem('support_user', JSON.stringify(userData))

    setToken(access_token)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('support_auth_token')
    localStorage.removeItem('support_user')
    setToken(null)
    setUser(null)
    setIsLinkedFromMain(false)
    setNeedsAccountCreation(false)
  }, [])

  const autoLinkFromMainAuth = useCallback(async (): Promise<boolean> => {
    // Check if main auth token exists
    const mainToken = localStorage.getItem('auth_token')
    if (!mainToken) {
      return false
    }

    try {
      // Try to auto-create/link the support account
      const response = await api.post('/support/auth/auto-create')
      const { access_token, user: userData, isNewAccount } = response.data

      if (access_token && userData) {
        localStorage.setItem('support_auth_token', access_token)
        localStorage.setItem('support_user', JSON.stringify(userData))
        setToken(access_token)
        setUser(userData)
        setIsLinkedFromMain(true)
        setNeedsAccountCreation(false)
        return true
      }

      // No existing account - user needs to create one
      setNeedsAccountCreation(true)
      return false
    } catch (error) {
      console.error('Failed to auto-link support account:', error)
      return false
    }
  }, [])

  return (
    <SupportAuthContext.Provider value={{
      user,
      token,
      isLoading,
      isLinkedFromMain,
      needsAccountCreation,
      login,
      register,
      logout,
      autoLinkFromMainAuth
    }}>
      {children}
    </SupportAuthContext.Provider>
  )
}

export function useSupportAuth() {
  const context = useContext(SupportAuthContext)
  if (!context) {
    throw new Error('useSupportAuth must be used within SupportAuthProvider')
  }
  return context
}
