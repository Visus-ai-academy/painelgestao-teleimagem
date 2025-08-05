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
        
        // SOLUÇÃO DEFINITIVA: Usar a função RPC que retorna dados corretos
        const { data: aggregateStats, error } = await supabase.rpc('get_volumetria_aggregated_stats');
        
        if (error) {
          console.error(`❌ Erro na função RPC:`, error);
          // Fallback para contagem manual se RPC falhar
          const { count: totalRecordsCount } = await supabase
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact', head: true })
            .eq('arquivo_fonte', tipo);
            
          statsResult[tipo] = {
            totalRecords: totalRecordsCount || 0,
            recordsWithValue: 0,
            recordsZeroed: 0,
            totalValue: 0
          };
        } else {
          // Encontrar dados para este tipo específico
          const tipoStats = aggregateStats?.find((stat: any) => stat.arquivo_fonte === tipo);
          
          if (tipoStats) {
            statsResult[tipo] = {
              totalRecords: Number(tipoStats.total_records),
              recordsWithValue: Number(tipoStats.records_with_value),
              recordsZeroed: Number(tipoStats.records_zeroed),
              totalValue: Number(tipoStats.total_value)
            };
            
            console.log(`✅ ${tipo} (via RPC): ${tipoStats.total_records} registros, ${tipoStats.records_with_value} com valores, ${tipoStats.records_zeroed} zerados, ${tipoStats.total_value} TOTAL EXAMES`);
          } else {
            console.log(`⚠️ ${tipo}: Não encontrado na função RPC`);
            statsResult[tipo] = { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 };
          }
        }
      }

      console.log('📊 DADOS FINAIS DE STATS:', statsResult);

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

      console.log('🔄 Atualizando estado do contexto...');
      setData({
        stats: statsResult,
        lastUploads: lastUploadsResult,
        loading: false
      });
      
      console.log('✅ CONTEXTO ATUALIZADO COM SUCESSO!');
      console.log('📈 Resumo dos totais:');
      Object.entries(statsResult).forEach(([tipo, dados]: [string, any]) => {
        console.log(`- ${tipo}: ${dados.totalValue} exames`);
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
    console.log('🔥 USEEFFECT DO CONTEXTO EXECUTADO - Chamando loadStats...');
    loadStats();
    
    // Disponibilizar contexto globalmente para atualização após upload
    (window as any).volumetriaContext = { refreshData };
    console.log('🌍 Contexto disponibilizado globalmente');
  }, []);

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