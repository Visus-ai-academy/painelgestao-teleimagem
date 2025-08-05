import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

  // Usar ref para controlar se já está carregando para evitar chamadas duplicadas
  const isLoadingRef = useRef(false);
  const lastLoadTime = useRef(0);

  const loadStats = useCallback(async () => {
    // Evitar chamadas duplicadas mas permitir forçar reload
    const now = Date.now();
    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    lastLoadTime.current = now;
    
    try {
      console.log('🔄 Carregando estatísticas DEFINITIVAS da volumetria (SOMENTE dados que restaram no banco APÓS todas as exclusões físicas)...');
      
      // Carregar dados de volumetria diretamente da tabela
      const tiposArquivo = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'];
      const statsResult: any = {};
      
      for (const tipo of tiposArquivo) {
        console.log(`📊 Carregando TODOS os dados para: ${tipo}`);
        
        // SOLUÇÃO DEFINITIVA: Usar agregação manual completa sem limitações
        const [countResult, valueCountResult] = await Promise.all([
          // Total de registros usando count exato
          supabase
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact', head: true })
            .eq('arquivo_fonte', tipo),
          
          // Registros com valores > 0 usando count exato
          supabase
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact', head: true })
            .eq('arquivo_fonte', tipo)
            .gt('VALORES', 0)
        ]);

        const totalRecordsCount = countResult.count || 0;
        const recordsWithValueCount = valueCountResult.count || 0;
        const recordsZeroed = totalRecordsCount - recordsWithValueCount;
        
        // Carregar TODOS os valores em lotes grandes para calcular soma correta
        let totalValue = 0;
        let offset = 0;
        const batchSize = 50000; // Lotes grandes para eficiência
        
        console.log(`📊 ${tipo}: Carregando ${totalRecordsCount} registros para soma...`);
        
        while (offset < totalRecordsCount) {
          const { data: batch } = await supabase
            .from('volumetria_mobilemed')
            .select('VALORES')
            .eq('arquivo_fonte', tipo)
            .range(offset, offset + batchSize - 1);
            
          if (!batch || batch.length === 0) {
            console.log(`📦 ${tipo}: Nenhum dado no offset ${offset}, finalizando...`);
            break;
          }
          
          const batchSum = batch.reduce((sum: number, item: any) => sum + (item.VALORES || 0), 0);
          totalValue += batchSum;
          offset += batch.length;
          
          console.log(`📦 ${tipo}: Lote de ${batch.length} registros, soma do lote: ${batchSum}, soma total: ${totalValue}, progresso: ${offset}/${totalRecordsCount}`);
          
          // Se carregou menos que o lote completo, terminou
          if (batch.length < batchSize) break;
        }

        console.log(`🔍 RESULTADO FINAL ${tipo}:`);
        console.log(`- Total registros: ${totalRecordsCount}`);
        console.log(`- Com valores: ${recordsWithValueCount}`);
        console.log(`- Soma total: ${totalValue}`);

        statsResult[tipo] = {
          totalRecords: totalRecordsCount,
          recordsWithValue: recordsWithValueCount,
          recordsZeroed,
          totalValue
        };
        
        console.log(`✅ ${tipo}: ${totalRecordsCount} registros, ${recordsWithValueCount} com valores, ${recordsZeroed} zerados, ${totalValue} TOTAL EXAMES`);
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

      console.log('✅ Estatísticas DEFINITIVAS carregadas (dados físicos do banco):', statsResult);
      
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas centralizadas:', error);
      setData(prev => ({ ...prev, loading: false }));
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  const refreshData = useCallback(async () => {
    console.log('🔄 Forçando refresh dos dados DEFINITIVOS do banco...');
    lastLoadTime.current = 0; // Invalidar cache
    setData(prev => ({ ...prev, loading: true }));
    await loadStats();
  }, [loadStats]);

  const clearData = async () => {
    console.log('🧹 Limpando dados DEFINITIVOS do banco...');
    
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
      
      console.log('✅ Limpeza FÍSICA do banco concluída');
      
    } catch (error) {
      console.error('❌ Erro na limpeza centralizada:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    
    // Disponibilizar contexto globalmente para atualização após upload
    (window as any).volumetriaContext = { refreshData };
  }, [loadStats, refreshData]);

  // Real-time subscription otimizada - com debounce
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    
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
          console.log('🔄 Dados de volumetria alterados FISICAMENTE no banco - atualizando imediatamente...');
          // Invalidar cache e recarregar imediatamente
          lastLoadTime.current = 0;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            loadStats();
          }, 1000); // Reduzido para 1 segundo
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads'
        },
        (payload) => {
          console.log('🔄 Status de upload alterado - dados DEFINITIVOS sendo atualizados...', payload);
          // Invalidar cache e recarregar quando upload finaliza
          if (payload.new && (payload.new as any).status === 'concluido') {
            lastLoadTime.current = 0;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              loadStats(); // Carregará dados DEFINITIVOS do banco após todas as regras
            }, 3000); // Aumentar delay para garantir que regras foram aplicadas
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  // Auto-refresh removido - atualização apenas via realtime e upload manual

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