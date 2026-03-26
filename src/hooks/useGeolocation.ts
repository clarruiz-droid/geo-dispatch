import { useState, useEffect, useRef } from 'react'

export interface GPSLocation {
  lat: number
  lng: number
  accuracy?: number
  timestamp: number
}

const STORAGE_KEY = 'gd_pending_gps'

export const useGeolocation = (isTracking: boolean) => {
  const [location, setLocation] = useState<GPSLocation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const lastCaptureTime = useRef<number>(0)

  // Cargar contador inicial de pendientes
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const pending = JSON.parse(saved)
      setPendingCount(pending.length)
    }
  }, [])

  useEffect(() => {
    if (!isTracking) {
      setLocation(null)
      return
    }

    const captureLocation = () => {
      const now = Date.now()
      // Solo capturar si ha pasado al menos 55 segundos (margen para el minuto)
      if (now - lastCaptureTime.current < 55000) return

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: GPSLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }
          
          setLocation(newLocation)
          setError(null)
          lastCaptureTime.current = now

          // Lógica Store and Forward
          if (!navigator.onLine) {
            const saved = localStorage.getItem(STORAGE_KEY)
            const pending = saved ? JSON.parse(saved) : []
            const updated = [...pending, newLocation]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            setPendingCount(updated.length)
            console.log('[GPS] Offline: Punto guardado localmente')
          }
        },
        (err) => setError(err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    }

    // Captura inicial inmediata
    captureLocation()

    // Intervalo de revisión cada 10 segundos para ver si toca capturar
    const interval = setInterval(captureLocation, 10000)

    return () => clearInterval(interval)
  }, [isTracking])

  const clearPending = () => {
    localStorage.removeItem(STORAGE_KEY)
    setPendingCount(0)
  }

  const getPendingData = (): GPSLocation[] => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  }

  return { location, error, pendingCount, getPendingData, clearPending }
}
