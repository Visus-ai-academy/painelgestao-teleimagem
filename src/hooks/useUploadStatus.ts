import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadStatus {
  totalUploads: number;
  completedUploads: number;
  processingUploads: number;
  errorUploads: number;
  totalRecordsProcessed: number;
  isProcessing: boolean;
  progressPercentage: number;
  lastUpdate: string | null;
}

export function useUploadStatus(fileType: string | string[] = 'faturamento') {
  const [status, setStatus] = useState<UploadStatus>({
    totalUploads: 0,
    completedUploads: 0,
    processingUploads: 0,
    errorUploads: 0,
    totalRecordsProcessed: 0,
    isProcessing: false,
    progressPercentage: 0,
    lastUpdate: null
  });

  const fetchStatus = async () => {
    try {
      // Buscar uploads ativos (processando) E recém-concluídos (últimos 3 minutos)
      const cutoffTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      
      let query = supabase
        .from('processamento_uploads')
        .select('status, registros_processados, registros_inseridos, registros_atualizados, registros_erro, created_at')
        .in('status', ['processando', 'concluido']) // Incluir concluídos também
        .gte('created_at', cutoffTime); // Últimos 3 minutos
      
      // Aplicar filtro de tipo(s)
      if (Array.isArray(fileType)) {
        query = query.in('tipo_arquivo', fileType);
      } else {
        query = query.eq('tipo_arquivo', fileType);
      }
      
      const { data: uploads, error } = await query;

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      const activeUploads = uploads || [];
      const totalUploads = activeUploads.length;
      const completedUploads = activeUploads.filter(u => u.status === 'concluido').length;
      const processingUploads = activeUploads.filter(u => u.status === 'processando').length;
      const errorUploads = activeUploads.filter(u => u.status === 'erro').length;
      const totalRecordsProcessed = activeUploads.reduce((sum, u) => sum + (u.registros_processados || 0), 0);
      
      const isProcessing = processingUploads > 0;
      
      // Cálculo de progresso
      let progressPercentage = 0;
      if (processingUploads > 0) {
        // Há processamento ativo
        const uploadAtual = activeUploads.find(u => u.status === 'processando');
        if (uploadAtual && uploadAtual.registros_processados > 0) {
          // Usar o total real baseado no progresso atual, não limitado a 1000
          const estimatedTotal = Math.max(uploadAtual.registros_processados, uploadAtual.registros_inseridos);
          progressPercentage = Math.min(Math.round((uploadAtual.registros_inseridos / estimatedTotal) * 100), 99);
        } else {
          progressPercentage = 5; // Iniciando
        }
      } else if (completedUploads > 0) {
        // Há uploads recém-concluídos - mostrar 100%
        progressPercentage = 100;
      } else {
        // Nenhum upload ativo ou recente
        progressPercentage = 0;
      }
      
      const lastUpdate = activeUploads.length > 0 
        ? activeUploads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
        : null;

      console.log('Upload Status Debug:', {
        totalUploads,
        processingUploads,
        completedUploads,
        progressPercentage,
        isProcessing,
        activeUploads: activeUploads.length
      });

      setStatus({
        totalUploads,
        completedUploads,
        processingUploads,
        errorUploads,
        totalRecordsProcessed,
        isProcessing,
        progressPercentage,
        lastUpdate
      });

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  useEffect(() => {
    // Buscar status inicial
    fetchStatus();

    // Configurar realtime subscription para processamento_uploads
    const channel = supabase
      .channel('processamento_uploads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads',
          filter: Array.isArray(fileType) ? `tipo_arquivo=in.(${fileType.join(',')})` : `tipo_arquivo=eq.${fileType}`
        },
        (payload) => {
          console.log('Upload status changed:', payload);
          fetchStatus(); // Atualizar status quando houver mudanças
        }
      )
      .subscribe();

    // Também configurar subscription para volumetria_mobilemed
    const volumetriaChannel = supabase
      .channel('volumetria_mobilemed_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'volumetria_mobilemed'
        },
        (payload) => {
          console.log('Volumetria data changed:', payload);
          fetchStatus(); // Atualizar status quando houver mudanças nos dados
        }
      )
      .subscribe();

    // Polling adicional a cada 30 segundos para garantir atualizações
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(volumetriaChannel);
      clearInterval(interval);
    };
  }, [fileType]);

  return { status, refresh: fetchStatus };
}