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
      // Buscar apenas uploads em processamento ativo (últimos 2 minutos)
      const cutoffTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutos atrás
      
      const { data: uploads, error } = await supabase
        .from('upload_logs')
        .select('status, records_processed, updated_at, created_at')
        .eq('file_type', fileType)
        .in('status', ['processing']) // Apenas uploads em processamento
        .gte('updated_at', cutoffTime); // Apenas uploads atualizados nos últimos 2 minutos

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      const activeUploads = uploads || [];
      const totalUploads = activeUploads.length;
      const completedUploads = 0; // Não há uploads completos aqui
      const processingUploads = activeUploads.filter(u => u.status === 'processing').length;
      const errorUploads = 0; // Não há uploads com erro aqui
      const totalRecordsProcessed = activeUploads.reduce((sum, u) => sum + (u.records_processed || 0), 0);
      
      const isProcessing = processingUploads > 0;
      
      // Cálculo de progresso apenas para uploads ativos
      let progressPercentage = 0;
      if (processingUploads > 0) {
        const uploadAtual = activeUploads.find(u => u.status === 'processing');
        if (uploadAtual && uploadAtual.records_processed > 0) {
          // Estimar progresso baseado em registros processados
          const estimatedTotal = 2000; // Assumir 2000 registros como padrão
          progressPercentage = Math.min(Math.round((uploadAtual.records_processed / estimatedTotal) * 100), 99);
        } else {
          progressPercentage = 5; // Iniciando processamento
        }
      } else {
        progressPercentage = 0; // Nenhum processamento ativo = 0%
      }
      
      const lastUpdate = activeUploads.length > 0 
        ? activeUploads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
        : null;

      console.log('Upload Status Debug:', {
        totalUploads,
        processingUploads,
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