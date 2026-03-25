import { useState, useEffect } from 'react'

interface Location {
  lat: number
  lng: number
  accuracy?: number
  timestamp: number
}

export const useGeolocation = (isTracking: boolean) => {
  const [location, setLocation] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingSync, setPendingSync] = useState<Location[]>([])

  useEffect(() => {
    if (!isTracking) {
      setLocation(null)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }
        
        setLocation(newLocation)
        setError(null)

        // Si estamos offline, guardamos en la cola de pendientes
        if (!navigator.onLine) {
          setPendingSync(prev => [...prev, newLocation])
          console.log('[OFFLINE] Ubicación guardada para sincronización futura')
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isTracking])

  // Escuchar cuando volvemos a estar online
  useEffect(() => {
    const handleOnline = () => {
      if (pendingSync.length > 0) {
        console.log(`[ONLINE] Sincronizando ${pendingSync.length} puntos pendientes...`)
        // Aquí iría la lógica de envío masivo a Supabase
        setPendingSync([]) // Limpiamos después de sincronizar
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [pendingSync])

  return { location, error, pendingCount: pendingSync.length }
}
