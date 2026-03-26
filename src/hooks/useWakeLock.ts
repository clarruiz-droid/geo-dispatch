import { useState, useEffect, useCallback } from 'react';

export const useWakeLock = (isActive: boolean) => {
  const [sentinel, setSentinel] = useState<any>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && isActive) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setSentinel(lock);
        console.log('[WakeLock] Pantalla forzada a encendido');
        
        lock.addEventListener('release', () => {
          console.log('[WakeLock] Bloqueo liberado');
        });
      } catch (err: any) {
        console.warn(`[WakeLock] No se pudo activar: ${err.message}`);
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      requestWakeLock();
    } else {
      if (sentinel) {
        sentinel.release().then(() => setSentinel(null));
      }
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel) sentinel.release();
    };
  }, [isActive, requestWakeLock]);
};
