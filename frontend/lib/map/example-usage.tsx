import React, { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { calculateRouteDistances, formatDistance } from './calculateRouteDistances'
import { getPositionAlongRoute, getRouteProgress } from './getPositionAlongRoute'
import { useRouteMovement } from './useRouteMovement'

// Example component showing how to use the route utilities
export function RouteAnimationExample() {
  // Example route: New York to Los Angeles with a stop in Chicago
  const route = [
    L.latLng(40.7128, -74.0060),    // New York
    L.latLng(41.8781, -87.6298),    // Chicago  
    L.latLng(34.0522, -118.2437),   // Los Angeles
  ]

  const [isPaused, setIsPaused] = useState(false)
  const [durationDays, setDurationDays] = useState(2)

  // Calculate route statistics
  const { distances, total } = calculateRouteDistances(route)
  const progress = getRouteProgress(distances, total * 0.5) // 50% progress example

  // Use the route movement hook
  const currentPosition = useRouteMovement({
    route,
    durationMs: durationDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
    isPaused,
    onPositionUpdate: (position, progress) => {
      console.log(`Truck at: ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`)
      console.log(`Progress: ${(progress * 100).toFixed(1)}%`)
    },
    onComplete: () => {
      console.log('Delivery complete!')
    }
  })

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Route Animation Example</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Route Statistics</h3>
          <p>Total Distance: {formatDistance(total)}</p>
          <p>Number of Waypoints: {route.length}</p>
          <p>Current Position: {currentPosition.lat.toFixed(4)}, {currentPosition.lng.toFixed(4)}</p>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Controls</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium">Duration (days):</label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                className="border rounded px-2 py-1"
                min="1"
                max="7"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-4 py-2 rounded ${
                  isPaused ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => setDurationDays(1)}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                1 Day
              </button>
              <button
                onClick={() => setDurationDays(3)}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                3 Days
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-96">
        <MapContainer
          center={route[0]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {/* Route and markers would be rendered here */}
        </MapContainer>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Key Features:</strong></p>
        <ul className="list-disc list-inside">
          <li>Smooth, time-based animation using requestAnimationFrame</li>
          <li>Pause/resume functionality for package intercepts</li>
          <li>Accurate distance calculations using Leaflet's built-in methods</li>
          <li>Linear interpolation within route segments for performance</li>
          <li>Tab visibility handling for consistent timing</li>
        </ul>
      </div>
    </div>
  )
}

export default RouteAnimationExample
