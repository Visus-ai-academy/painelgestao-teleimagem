import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VolumetriaData {
  stats: {
    volumetria_padrao: {
      totalRecords: number;
      recordsWithValue: number;
      recordsZeroed: number;
      totalValue: number;
    };
    volumetria_fora_padrao: {
      totalRecords: number;
      recordsWithValue: number;
      recordsZeroed: number;
      totalValue: number;
    };
    volumetria_padrao_retroativo: {
      totalRecords: number;
      recordsWithValue: number;
      recordsZeroed: number;
      totalValue: number;
    };
    volumetria_fora_padrao_retroativo: {
      totalRecords: number;
      recordsWithValue: number;
      recordsZeroed: number;
      totalValue: number;
    };
    volumetria_onco_padrao: {
      totalRecords: number;
      recordsWithValue: number;
      recordsZeroed: number;
      totalValue: number;
    };
  };
  lastUploads: Record<string, any>;
  loading: boolean;
}

interface VolumetriaContextType {
  data: VolumetriaData;
  refreshData: () => Promise<void>;
  clearData: () => Promise<void>;
}

const VolumetriaContext = createContext<VolumetriaContextType | undefined>(undefined);

export function VolumetriaProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<VolumetriaData>({
    stats: {
      volumetria_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
      volumetria_fora_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
      volumetria_padrao_retroativo: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
      volumetria_fora_padrao_retroativo: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
      volumetria_onco_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
    },
    lastUploads: {},
    loading: true
  });

  const loadStats = async () => {
    try {
      console.log('🔄 Carregando estatísticas centralizadas...');
      
      // Carregar dados de volumetria diretamente da tabela
      const tiposArquivo = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'];
      const statsResult: any = {};
      
      for (const tipo of tiposArquivo) {
        console.log(`📊 Carregando dados para: ${tipo}`);
        
        const { data: volumetriaData, error } = await supabase
          .from('volumetria_mobilemed')
          .select('VALORES')
          .eq('arquivo_fonte', tipo);

        if (!error && volumetriaData) {
          const totalRecords = volumetriaData.length;
          const recordsWithValue = volumetriaData.filter(item => item.VALORES && item.VALORES > 0).length;
          const recordsZeroed = totalRecords - recordsWithValue;
          const totalValue = volumetriaData.reduce((sum, item) => sum + (item.VALORES || 0), 0);

          statsResult[tipo] = {
            totalRecords,
            recordsWithValue,
            recordsZeroed,
            totalValue
          };
          
          console.log(`✅ ${tipo}: ${totalRecords} registros, ${recordsWithValue} com valores, ${totalValue} total`);
        } else {
          console.log(`⚠️ ${tipo}: nenhum dado encontrado`);
          statsResult[tipo] = { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 };
        }
      }

      // Carregar últimos uploads
      const lastUploadsResult: Record<string, any> = {};
      for (const tipo of tiposArquivo) {
        const { data: uploadData, error } = await supabase
          .from('processamento_uploads')
          .select('*')
          .eq('tipo_arquivo', tipo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && uploadData && uploadData.length > 0) {
          lastUploadsResult[tipo] = uploadData[0];
        }
      }

      setData({
        stats: statsResult,
        lastUploads: lastUploadsResult,
        loading: false
      });

      console.log('✅ Estatísticas carregadas:', statsResult);
      
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas centralizadas:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  const refreshData = async () => {
    setData(prev => ({ ...prev, loading: true }));
    await loadStats();
  };

  const clearData = async () => {
    console.log('🧹 Limpando dados centralizados...');
    
    try {
      // Limpar dados de volumetria
      const { error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (volumetriaError) {
        throw new Error(`Erro ao limpar volumetria: ${volumetriaError.message}`);
      }

      // Limpar status de processamento
      const { error: statusError } = await supabase
        .from('processamento_uploads')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (statusError) {
        console.warn('Aviso ao limpar status:', statusError.message);
      }

      // Limpar import_history
      const { error: importError } = await supabase
        .from('import_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (importError) {
        console.warn('Aviso ao limpar import history:', importError.message);
      }


      // Resetar dados locais imediatamente
      setData({
        stats: {
          volumetria_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
          volumetria_fora_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
          volumetria_padrao_retroativo: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
          volumetria_fora_padrao_retroativo: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
          volumetria_onco_padrao: { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 },
        },
        lastUploads: {},
        loading: false
      });
      
      console.log('✅ Limpeza centralizada concluída');
      
    } catch (error) {
      console.error('❌ Erro na limpeza centralizada:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    
    // Disponibilizar contexto globalmente para atualização após upload
    (window as any).volumetriaContext = { refreshData };

    // Setup real-time subscription para atualizações automáticas
    const channel = supabase
      .channel('volumetria-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'volumetria_mobilemed'
        },
        () => {
          console.log('🔄 Dados alterados - atualizando estatísticas...');
          setTimeout(() => loadStats(), 1000); // Delay para garantir que os dados estejam salvos
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-refresh inteligente - só atualiza se não há uploads em andamento
  useEffect(() => {
    const interval = setInterval(async () => {
      // Verificar se há uploads em andamento antes de atualizar
      try {
        const { data: activeUploads } = await supabase
          .from('processamento_uploads')
          .select('status')
          .in('status', ['processando', 'iniciado'])
          .limit(1);
        
        if (!activeUploads || activeUploads.length === 0) {
          console.log('🔄 Auto-refresh das estatísticas (nenhum upload ativo)...');
          loadStats();
        } else {
          console.log('⏸️ Auto-refresh pausado - upload em andamento');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar uploads ativos:', error);
      }
    }, 15000); // Reduzido para 15 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <VolumetriaContext.Provider value={{ data, refreshData, clearData }}>
      {children}
    </VolumetriaContext.Provider>
  );
}

export function useVolumetria() {
  const context = useContext(VolumetriaContext);
  if (!context) {
    throw new Error('useVolumetria deve ser usado dentro de VolumetriaProvider');
  }
  return context;
}