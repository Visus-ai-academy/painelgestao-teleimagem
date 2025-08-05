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
  // Dados detalhados para análises
  detailedData: any[];
  clientes: string[];
  modalidades: string[];
  especialidades: string[];
  prioridades: string[];
  medicos: string[];
  // Estatísticas calculadas
  dashboardStats: {
    total_exames: number;
    total_registros: number;
    total_atrasados: number;
    percentual_atraso: number;
    total_clientes: number;
    total_clientes_volumetria: number;
    total_modalidades: number;
    total_especialidades: number;
    total_medicos: number;
    total_prioridades: number;
  };
  loading: boolean;
}

interface VolumetriaContextType {
  data: VolumetriaData;
  refreshData: () => Promise<void>;
  clearData: () => Promise<void>;
  // Expor dados detalhados para componentes
  getDetailedData: () => any[];
  getFilteredData: (filters?: any) => any[];
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
    detailedData: [],
    clientes: [],
    modalidades: [],
    especialidades: [],
    prioridades: [],
    medicos: [],
    dashboardStats: {
      total_exames: 0,
      total_registros: 0,
      total_atrasados: 0,
      percentual_atraso: 0,
      total_clientes: 0,
      total_clientes_volumetria: 0,
      total_modalidades: 0,
      total_especialidades: 0,
      total_medicos: 0,
      total_prioridades: 0
    },
    loading: true
  });

  // Usar ref para controlar se já está carregando para evitar chamadas duplicadas
  const isLoadingRef = useRef(false);
  const lastLoadTime = useRef(0);

  const loadStats = useCallback(async () => {
    console.log('🔥🔥🔥 CARREGAMENTO DEFINITIVO INICIADO - USANDO FUNÇÕES RPC 🔥🔥🔥');
    const now = Date.now();
    if (isLoadingRef.current && (now - lastLoadTime.current) < 5000) {
      console.log('⏳ Carregamento recente, aguardando...');
      return;
    }
    
    isLoadingRef.current = true;
    lastLoadTime.current = now;
    
    try {
      console.log('🚀 FASE 1: Carregando estatísticas dashboard via RPC...');
      
      // CARREGAR ESTATÍSTICAS COMPLETAS VIA RPC
      const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_volumetria_dashboard_stats');
      
      if (dashboardError) {
        throw new Error(`Erro no dashboard stats: ${dashboardError.message}`);
      }
      
      const dashboardStats = dashboardData[0];
      console.log('✅ Dashboard stats carregadas:', dashboardStats);
      
      console.log('🚀 FASE 2: Carregando TODOS os dados detalhados via RPC...');
      
      // CARREGAR TODOS OS DADOS DETALHADOS VIA RPC (SEM LIMITAÇÃO)
      const { data: detailedData, error: detailedError } = await supabase.rpc('get_volumetria_complete_data');
      
      if (detailedError) {
        throw new Error(`Erro nos dados detalhados: ${detailedError.message}`);
      }
      
      console.log(`🎉🔥 DADOS COMPLETOS CARREGADOS VIA RPC: ${detailedData.length} registros 🔥🎉`);
      console.log(`📊 Total exames somados: ${detailedData.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0)}`);
      
      // Carregar dados de arquivos agregados
      const { data: aggregateStats, error: aggregateError } = await supabase.rpc('get_volumetria_aggregated_stats');
      
      if (aggregateError) {
        console.warn('⚠️ Erro ao carregar agregados:', aggregateError.message);
      }
      
      // Processar estatísticas por tipo de arquivo
      const statsResult: any = {};
      const tiposArquivo = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'];
      
      tiposArquivo.forEach(tipo => {
        const tipoStats = aggregateStats?.find((stat: any) => stat.arquivo_fonte === tipo);
        if (tipoStats) {
          statsResult[tipo] = {
            totalRecords: Number(tipoStats.total_records),
            recordsWithValue: Number(tipoStats.records_with_value),
            recordsZeroed: Number(tipoStats.records_zeroed),
            totalValue: Number(tipoStats.total_value)
          };
        } else {
          statsResult[tipo] = { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 };
        }
      });
      
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

      console.log('🔄 Atualizando estado do contexto com dados RPC...');
      setData({
        stats: statsResult,
        lastUploads: lastUploadsResult,
        detailedData: detailedData,
        clientes: dashboardStats.clientes_unicos || [],
        modalidades: dashboardStats.modalidades_unicas || [],
        especialidades: dashboardStats.especialidades_unicas || [],
        prioridades: dashboardStats.prioridades_unicas || [],
        medicos: dashboardStats.medicos_unicos || [],
        dashboardStats: {
          total_exames: Number(dashboardStats.total_exames),
          total_registros: Number(dashboardStats.total_registros),
          total_atrasados: Number(dashboardStats.total_atrasados),
          percentual_atraso: Number(dashboardStats.percentual_atraso),
          total_clientes: Number(dashboardStats.total_clientes),
          total_clientes_volumetria: Number(dashboardStats.total_clientes_volumetria),
          total_modalidades: Number(dashboardStats.total_modalidades),
          total_especialidades: Number(dashboardStats.total_especialidades),
          total_medicos: Number(dashboardStats.total_medicos),
          total_prioridades: Number(dashboardStats.total_prioridades)
        },
        loading: false
      });
      
      console.log('✅🔥 CONTEXTO ATUALIZADO COM SUCESSO VIA RPC! 🔥✅');
      console.log(`📈 Resumo final: ${Number(dashboardStats.total_exames)} exames, ${Number(dashboardStats.total_registros)} registros`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas via RPC:', error);
      setData(prev => ({ ...prev, loading: false }));
    } finally {
      isLoadingRef.current = false;
    }

  }, []);

  const refreshData = useCallback(async () => {
    console.log('🔄 Forçando refresh COMPLETO dos dados DEFINITIVOS do banco...');
    lastLoadTime.current = 0; // Invalidar cache
    isLoadingRef.current = false; // Reset flag de carregamento
    
    // LIMPAR CACHES LOCAIS
    localStorage.removeItem('volumetria_cache');
    sessionStorage.clear();
    
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
        detailedData: [],
        clientes: [],
        modalidades: [],
        especialidades: [],
        prioridades: [],
        medicos: [],
        dashboardStats: {
          total_exames: 0,
          total_registros: 0,
          total_atrasados: 0,
          percentual_atraso: 0,
          total_clientes: 0,
          total_clientes_volumetria: 0,
          total_modalidades: 0,
          total_especialidades: 0,
          total_medicos: 0,
          total_prioridades: 0
        },
        loading: false
      });
      
      console.log('✅ Limpeza FÍSICA do banco concluída');
      
    } catch (error) {
      console.error('❌ Erro na limpeza centralizada:', error);
      throw error;
    }
  };

  // Funções para expor dados detalhados
  const getDetailedData = useCallback(() => {
    return data.detailedData;
  }, [data.detailedData]);

  const getFilteredData = useCallback((filters?: any) => {
    if (!filters) return data.detailedData;
    
    return data.detailedData.filter(item => {
      if (filters.cliente && filters.cliente !== 'todos' && item.EMPRESA !== filters.cliente) return false;
      if (filters.modalidade && filters.modalidade !== 'todos' && item.MODALIDADE !== filters.modalidade) return false;
      if (filters.especialidade && filters.especialidade !== 'todos' && item.ESPECIALIDADE !== filters.especialidade) return false;
      if (filters.prioridade && filters.prioridade !== 'todos' && item.PRIORIDADE !== filters.prioridade) return false;
      if (filters.medico && filters.medico !== 'todos' && item.MEDICO !== filters.medico) return false;
      return true;
    });
  }, [data.detailedData]);

  useEffect(() => {
    console.log('🔥 USEEFFECT DO CONTEXTO EXECUTADO - Forçando carregamento DEFINITIVO...');
    // FORÇAR INVALIDAÇÃO COMPLETA
    isLoadingRef.current = false;
    lastLoadTime.current = 0;
    setData(prev => ({ ...prev, loading: true }));
    
    // EXECUTAR IMEDIATAMENTE sem debounce
    setTimeout(() => {
      console.log('🚀 TIMEOUT EXECUTADO - Chamando loadStats com força total');
      loadStats();
    }, 100);
    
    // Disponibilizar contexto globalmente para atualização após upload
    (window as any).volumetriaContext = { refreshData };
    console.log('🌍 Contexto disponibilizado globalmente');
  }, [loadStats]);

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
    <VolumetriaContext.Provider value={{ data, refreshData, clearData, getDetailedData, getFilteredData }}>
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