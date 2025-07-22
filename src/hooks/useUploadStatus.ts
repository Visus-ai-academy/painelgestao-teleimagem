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

export function useUploadStatus(fileType: string = 'faturamento') {
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
      // Buscar apenas uploads não cancelados (ativos)
      const { data: uploads, error } = await supabase
        .from('upload_logs')
        .select('status, records_processed, updated_at')
        .eq('file_type', fileType)
        .neq('status', 'cancelled'); // Excluir uploads cancelados

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      const totalUploads = uploads?.length || 0;
      const completedUploads = uploads?.filter(u => u.status === 'completed').length || 0;
      const processingUploads = uploads?.filter(u => u.status === 'processing').length || 0;
      const errorUploads = uploads?.filter(u => u.status === 'error').length || 0;
      const totalRecordsProcessed = uploads?.reduce((sum, u) => sum + (u.records_processed || 0), 0) || 0;
      
      const isProcessing = processingUploads > 0;
      
      // Melhor cálculo de progresso
      let progressPercentage = 0;
      if (totalUploads === 0) {
        progressPercentage = 0; // Nenhum upload
      } else if (processingUploads > 0) {
        // Se há processamento ativo, mostrar progresso baseado nos dados processados
        const uploadAtual = uploads.find(u => u.status === 'processing');
        if (uploadAtual && uploadAtual.records_processed > 0) {
          // Estimar progresso baseado em registros processados (assumindo ~26k total)
          const estimatedTotal = 26000;
          progressPercentage = Math.min(Math.round((uploadAtual.records_processed / estimatedTotal) * 100), 99);
        } else {
          progressPercentage = 5; // Iniciando processamento
        }
      } else {
        // Nenhum processamento ativo, mostrar baseado em uploads completos
        progressPercentage = totalUploads > 0 ? Math.round((completedUploads / totalUploads) * 100) : 0;
      }
      
      const lastUpdate = uploads?.length > 0 
        ? uploads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
        : null;

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

    // Configurar realtime subscription
    const channel = supabase
      .channel('upload_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'upload_logs',
          filter: `file_type=eq.${fileType}`
        },
        (payload) => {
          console.log('Upload status changed:', payload);
          fetchStatus(); // Atualizar status quando houver mudanças
        }
      )
      .subscribe();

    // Polling adicional a cada 30 segundos para garantir atualizações
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fileType]);

  return { status, refresh: fetchStatus };
}