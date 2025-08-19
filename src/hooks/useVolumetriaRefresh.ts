import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVolumetria } from '@/contexts/VolumetriaContext';

/**
 * Hook para refresh automático da UI após processamento de dados
 * Monitora mudanças em processamento_uploads e atualiza automaticamente
 */
export function useVolumetriaRefresh() {
  const { refreshData } = useVolumetria();

  const handleRealTimeUpdate = useCallback((payload: any) => {
    console.log('🔄 [REFRESH] Detectada mudança em processamento_uploads:', payload);
    
    // Verificar se é um status final (concluído ou erro)
    if (payload.new && ['concluido', 'erro', 'rollback_executado'].includes(payload.new.status)) {
      console.log('🔄 [REFRESH] Status final detectado, atualizando dados...');
      
      // Aguardar 2 segundos para garantir que o processamento terminou
      setTimeout(() => {
        refreshData();
      }, 2000);
    }
  }, [refreshData]);

  useEffect(() => {
    console.log('🔄 [REFRESH] Configurando listener automático...');
    
    const channel = supabase
      .channel('volumetria_refresh_auto')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'tipo_arquivo=in.(volumetria_padrao,volumetria_fora_padrao,volumetria_padrao_retroativo,volumetria_fora_padrao_retroativo,volumetria_onco_padrao)'
        },
        handleRealTimeUpdate
      )
      .subscribe();

    return () => {
      console.log('🔄 [REFRESH] Desconectando listener automático...');
      supabase.removeChannel(channel);
    };
  }, [handleRealTimeUpdate]);
}