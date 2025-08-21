import { useCallback } from 'react';

export const useForceRefresh = () => {
  const clearAllCache = useCallback(() => {
    // Limpar todos os storages
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpar cache do navegador se disponível
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    
    console.log('🧹 TODOS OS CACHES LIMPOS');
  }, []);

  const forceReload = useCallback(() => {
    clearAllCache();
    // Recarregamento forçado sem cache
    window.location.reload();
  }, [clearAllCache]);

  return { clearAllCache, forceReload };
};