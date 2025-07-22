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
      // Buscar estatísticas dos uploads
      const { data: uploads, error } = await supabase
        .from('upload_logs')
        .select('status, records_processed, updated_at')
        .eq('file_type', fileType);

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
      const progressPercentage = totalUploads > 0 ? Math.round((completedUploads / totalUploads) * 100) : 0;
      
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