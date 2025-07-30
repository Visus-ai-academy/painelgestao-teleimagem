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
        .from('upload_logs')
        .select('status, records_processed, updated_at, created_at')
        .in('status', ['processing', 'completed']) // Incluir concluídos também
        .gte('updated_at', cutoffTime); // Últimos 3 minutos
      
      // Aplicar filtro de tipo(s)
      if (Array.isArray(fileType)) {
        query = query.in('file_type', fileType);
      } else {
        query = query.eq('file_type', fileType);
      }
      
      const { data: uploads, error } = await query;

      if (error) {
        console.error('Erro ao buscar status dos uploads:', error);
        return;
      }

      const activeUploads = uploads || [];
      const totalUploads = activeUploads.length;
      const completedUploads = activeUploads.filter(u => u.status === 'completed').length;
      const processingUploads = activeUploads.filter(u => u.status === 'processing').length;
      const errorUploads = 0;
      const totalRecordsProcessed = activeUploads.reduce((sum, u) => sum + (u.records_processed || 0), 0);
      
      const isProcessing = processingUploads > 0;
      
      // Cálculo de progresso
      let progressPercentage = 0;
      if (processingUploads > 0) {
        // Há processamento ativo
        const uploadAtual = activeUploads.find(u => u.status === 'processing');
        if (uploadAtual && uploadAtual.records_processed > 0) {
          const estimatedTotal = 2000;
          progressPercentage = Math.min(Math.round((uploadAtual.records_processed / estimatedTotal) * 100), 99);
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
        ? activeUploads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
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

    // Configurar realtime subscription
    const fileTypeFilter = Array.isArray(fileType) 
      ? fileType.map(ft => `file_type=eq.${ft}`).join(',')
      : `file_type=eq.${fileType}`;
    
    const channel = supabase
      .channel('upload_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'upload_logs',
          filter: Array.isArray(fileType) ? `file_type=in.(${fileType.join(',')})` : `file_type=eq.${fileType}`
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