import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  // Check if this is a support admin endpoint (requires admin auth)
  const isSupportAdminEndpoint = config.url?.includes('/support/admin')
  // Check if this is a support auth linking endpoint (requires main user auth)
  const isSupportLinkEndpoint = config.url?.includes('/support/auth/auto-create') ||
                                 config.url?.includes('/support/auth/link-account')
  // Check if this is a regular support endpoint (for customers)
  const isSupportEndpoint = config.url?.includes('/support/') &&
                            !isSupportAdminEndpoint &&
                            !isSupportLinkEndpoint

  if (isSupportEndpoint) {
    // Use support auth token for customer support endpoints
    const supportToken = localStorage.getItem('support_auth_token')
    if (supportToken) {
      config.headers.Authorization = `Bearer ${supportToken}`
    }
  } else {
    // Use admin auth token for admin endpoints, support admin, and linking endpoints
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login for admin endpoints, not support endpoints
    const isSupportEndpoint = error.config?.url?.includes('/support/')

    if (error.response?.status === 401 && !isSupportEndpoint) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      // Only redirect if we're on an admin page
      if (window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
