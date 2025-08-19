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
      // Buscar uploads ativos (processando) E recém-concluídos (últimos 5 minutos)
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      let query = supabase
        .from('processamento_uploads')
        .select('status, registros_processados, registros_inseridos, registros_atualizados, registros_erro, created_at, detalhes_erro')
        .in('status', ['processando', 'staging_concluido', 'concluido', 'erro']) // Incluir mais status
        .gte('created_at', cutoffTime); // Últimos 5 minutos
      
      // Aplicar filtro de tipo(s)
      if (Array.isArray(fileType)) {
        query = query.in('tipo_arquivo', fileType);
      } else {
        query = query.eq('tipo_arquivo', fileType);
      }
      
      const { data: uploads, error } = await query.order('created_at', { ascending: false }).limit(10);

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      const activeUploads = uploads || [];
      const totalUploads = activeUploads.length;
      const completedUploads = activeUploads.filter(u => u.status === 'concluido').length;
      const processingUploads = activeUploads.filter(u => u.status === 'processando' || u.status === 'staging_concluido').length;
      const errorUploads = activeUploads.filter(u => u.status === 'erro').length;
      const totalRecordsProcessed = activeUploads.reduce((sum, u) => sum + (u.registros_processados || 0), 0);
      
      const isProcessing = processingUploads > 0;
      
      // Cálculo de progresso melhorado
      let progressPercentage = 0;
      if (processingUploads > 0) {
        // Há processamento ativo
        const uploadAtual = activeUploads.find(u => u.status === 'processando' || u.status === 'staging_concluido');
        if (uploadAtual) {
          if (uploadAtual.status === 'staging_concluido') {
            progressPercentage = 75; // Staging concluído, aguardando background
          } else if (uploadAtual.registros_processados > 0) {
            // Progresso baseado nos registros processados
            const estimatedTotal = Math.max(uploadAtual.registros_processados, uploadAtual.registros_inseridos);
            progressPercentage = Math.min(Math.round((uploadAtual.registros_inseridos / estimatedTotal) * 70), 70);
          } else {
            progressPercentage = 10; // Iniciando
          }
        }
      } else if (completedUploads > 0) {
        // Há uploads recém-concluídos - mostrar 100%
        progressPercentage = 100;
      }
      
      const lastUpdate = activeUploads.length > 0 
        ? activeUploads[0].created_at
        : null;

      console.log('Upload Status Debug:', {
        totalUploads,
        processingUploads,
        completedUploads,
        errorUploads,
        progressPercentage,
        isProcessing,
        activeUploads: activeUploads.length,
        lastStatuses: activeUploads.map(u => u.status)
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

    // Configurar realtime subscription apenas para processamento_uploads (removida volumetria)
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
          fetchStatus(); // Atualizar status apenas quando houver mudanças no processamento
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fileType]);

  return { status, refresh: fetchStatus };
}