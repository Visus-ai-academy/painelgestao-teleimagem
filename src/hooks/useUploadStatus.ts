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
      // Buscar apenas uploads recentes (últimos 10 minutos) e não cancelados
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutos atrás
      
      const { data: uploads, error } = await supabase
        .from('upload_logs')
        .select('status, records_processed, updated_at, created_at')
        .eq('file_type', fileType)
        .neq('status', 'cancelled') // Excluir uploads cancelados
        .gte('created_at', cutoffTime); // Apenas uploads dos últimos 10 minutos

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      // Filtrar uploads órfãos: se está "processing" há mais de 5 minutos, ignorar
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const activeUploads = uploads?.filter(u => {
        if (u.status === 'processing') {
          return new Date(u.updated_at).toISOString() >= recentTime;
        }
        return true; // Manter outros status
      }) || [];

      const totalUploads = activeUploads.length;
      const completedUploads = activeUploads.filter(u => u.status === 'completed').length;
      const processingUploads = activeUploads.filter(u => u.status === 'processing').length;
      const errorUploads = activeUploads.filter(u => u.status === 'error').length;
      const totalRecordsProcessed = activeUploads.reduce((sum, u) => sum + (u.records_processed || 0), 0);
      
      const isProcessing = processingUploads > 0;
      
      // Melhor cálculo de progresso
      let progressPercentage = 0;
      if (totalUploads === 0) {
        progressPercentage = 0; // Nenhum upload ativo
      } else if (processingUploads > 0) {
        // Se há processamento ativo, mostrar progresso baseado nos dados processados
        const uploadAtual = activeUploads.find(u => u.status === 'processing');
        if (uploadAtual && uploadAtual.records_processed > 0) {
          // Estimar progresso baseado em registros processados (assumindo ~1000 total para teste)
          const estimatedTotal = 1000;
          progressPercentage = Math.min(Math.round((uploadAtual.records_processed / estimatedTotal) * 100), 99);
        } else {
          progressPercentage = 5; // Iniciando processamento
        }
      } else {
        // Nenhum processamento ativo, mostrar baseado em uploads completos
        progressPercentage = totalUploads > 0 ? Math.round((completedUploads / totalUploads) * 100) : 0;
      }
      
      const lastUpdate = activeUploads.length > 0 
        ? activeUploads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
        : null;

      console.log('Upload Status Debug:', {
        totalUploads,
        processingUploads,
        completedUploads,
        progressPercentage,
        isProcessing
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