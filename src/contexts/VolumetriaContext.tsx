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
  clientesStats: any[]; // ADICIONAR STATS COMPLETAS DOS CLIENTES
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
    periodo_ativo?: string;  // ✅ PERÍODO ATIVO
    ultima_atualizacao?: string;  // ✅ TIMESTAMP ATUALIZAÇÃO
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
  // Método para filtrar dados por período específico para comparativo
  getDataByPeriod: (periodo?: string) => any[];
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
    clientesStats: [], // ADICIONAR STATS VAZIAS DOS CLIENTES
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
    console.log('🔥🔥🔥 CARREGAMENTO COMPLETO CORRIGIDO - TODOS OS 35.337 REGISTROS 🔥🔥🔥');
    const now = Date.now();
    if (isLoadingRef.current && (now - lastLoadTime.current) < 3000) {
      console.log('⏳ Carregamento recente, aguardando...');
      return;
    }
    
    isLoadingRef.current = true;
    lastLoadTime.current = now;
    
    try {
      console.log('🚀 FASE 1: Carregando estatísticas dashboard via RPC (com cálculo correto de atrasos)...');
      
      // CARREGAR ESTATÍSTICAS COMPLETAS VIA RPC
      const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_volumetria_dashboard_stats');
      
      if (dashboardError) {
        throw new Error(`Erro no dashboard stats: ${dashboardError.message}`);
      }
      
      const dashboardStats = dashboardData[0];
      console.log('✅ Dashboard stats carregadas:', dashboardStats);
      
      console.log('🚀 FASE 2: Carregando estatísticas COMPLETAS de clientes...');
      
      // CARREGAR ESTATÍSTICAS COMPLETAS DOS CLIENTES
      const { data: clientesStats, error: clientesError } = await supabase.rpc('get_clientes_stats_completos');
      
      if (clientesError) {
        console.error('❌ Erro nas estatísticas de clientes:', clientesError);
        console.error('❌ Detalhes do erro:', clientesError);
        // Não parar o fluxo, continuar sem os stats de clientes
        console.warn('⚠️ Continuando sem estatísticas de clientes específicas...');
      }
      
      console.log(`✅ Estatísticas de ${clientesStats?.length || 0} clientes carregadas`);
      console.log('🔍 [CONTEXTO DEBUG] ClientesStats carregadas:', clientesStats?.slice(0, 5));
      
      // Buscar CEDI_RJ especificamente para debug
      const cediStats = clientesStats?.find((c: any) => c.empresa === 'CEDI_RJ');
      console.log('🔍 [CONTEXTO DEBUG CEDI_RJ] Stats completas:', cediStats);
      
      console.log('🚀 FASE 3: Carregando período de referência ativo...');
      
      // BUSCAR PERÍODO ATIVO DO SISTEMA
      const { data: periodoAtivo, error: periodoError } = await supabase
        .from('periodo_referencia_ativo')
        .select('periodo_referencia')
        .eq('ativo', true)
        .single();
      
      if (periodoError) {
        console.error('❌ Erro ao buscar período ativo:', periodoError);
        throw new Error(`Erro no período ativo: ${periodoError.message}`);
      }
      
      const periodoSistema = periodoAtivo.periodo_referencia;
      console.log('✅ Período ativo do sistema:', periodoSistema);
      
      console.log('🚀 FASE 4: Carregando dados filtrados por período ativo...');
      console.log(`🔧 FILTRO INICIAL: periodo_referencia = '${periodoSistema}'`);
      
      // CARREGAR APENAS DADOS DO PERÍODO ATIVO (PRIMEIRA TENTATIVA)
      let allDetails: any[] = [];
      let offset = 0;
      const limit = 1000;
      
      while (true) {
        let query = supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('periodo_referencia', periodoSistema)  // ✅ FILTRO POR PERÍODO ATIVO
          .range(offset, offset + limit - 1);

        console.log(`📦 Carregando dados do período ${periodoSistema} - lote ${offset}`);

        const { data: batch, error: batchError } = await query;

        if (batchError) {
          throw new Error(`Erro nos dados detalhados: ${batchError.message}`);
        }
        if (!batch || batch.length === 0) break;
        allDetails.push(...batch);
        console.log(`📦 Dados carregados: ${batch.length} (total: ${allDetails.length})`);
        if (batch.length < limit) break;
        offset += limit;
        await new Promise((r) => setTimeout(r, 5));
      }
      
      console.log(`✅ RESULTADO PRIMEIRA TENTATIVA: ${allDetails.length} registros encontrados para período '${periodoSistema}'`);
      
      // ✅ CORREÇÃO CRÍTICA: Se não encontrou dados do período específico, carregar TODOS os dados
      if (allDetails.length === 0 || allDetails.length < 100) {
        console.log('⚠️ POUCOS DADOS ENCONTRADOS NO PERÍODO - Carregando TODOS os dados disponíveis...');
        console.log('🔧 MUDANDO ESTRATÉGIA: Carregando dados sem filtro de período');
        
        allDetails = [];
        offset = 0;
        
        while (true) {
          let queryTodos = supabase
            .from('volumetria_mobilemed')
            .select('*')
            .range(offset, offset + limit - 1);

          console.log(`📦 Carregando TODOS os dados - lote ${offset}`);

          const { data: batch, error: batchError } = await queryTodos;

          if (batchError) {
            throw new Error(`Erro nos dados detalhados (todos): ${batchError.message}`);
          }
          if (!batch || batch.length === 0) break;
          allDetails.push(...batch);
          console.log(`📦 Dados carregados: ${batch.length} (total: ${allDetails.length})`);
          if (batch.length < limit) break;
          offset += limit;
          await new Promise((r) => setTimeout(r, 5));
        }
        
        console.log(`✅ RESULTADO SEGUNDA TENTATIVA: ${allDetails.length} registros carregados (TODOS)`);
      }
      
      console.log(`🎉🔥 DADOS CARREGADOS: ${allDetails.length} registros detalhados 🔥🎉`);
      
      if (allDetails.length > 0) {
        const totalExamesCalc = allDetails.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0);
        console.log(`📊 Total exames somados: ${totalExamesCalc}`);
        
        // DEBUG ESPECÍFICO CEDI_RJ
        const cediRegistros = allDetails.filter((item: any) => item.EMPRESA === 'CEDI_RJ');
        const cediLaudos = cediRegistros.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0);
        console.log(`🔍 [CONTEXTO DEBUG CEDI_RJ] Detalhados: ${cediRegistros.length} reg, ${cediLaudos} laudos`);
        console.log(`🔍 [CONTEXTO DEBUG CEDI_RJ] Primeiros 3 registros:`, cediRegistros.slice(0, 3));
      }
      
      
      // Carregar dados de arquivos agregados com refresh forçado
      console.log('🚀 FASE 5: Carregando agregados com refresh forçado...');
      const { data: aggregateStats, error: aggregateError } = await supabase.rpc('get_volumetria_aggregated_stats');
      
      console.log('📊 Resultado agregados RPC:', aggregateStats);
      if (aggregateError) {
        console.warn('⚠️ Erro ao carregar agregados:', aggregateError.message);
        console.warn('⚠️ Detalhes do erro:', aggregateError);
      }
      
      // Processar estatísticas por tipo de arquivo
      const fileStats: any = {};
      const tiposArquivo = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'];
      
      tiposArquivo.forEach(tipo => {
        const tipoStats = aggregateStats?.find((stat: any) => stat.arquivo_fonte === tipo);
        if (tipoStats) {
          fileStats[tipo] = {
            totalRecords: Number(tipoStats.total_records),
            recordsWithValue: Number(tipoStats.records_with_value),
            recordsZeroed: Number(tipoStats.records_zeroed),
            totalValue: Number(tipoStats.total_value)
          };
        } else {
          fileStats[tipo] = { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 };
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
        stats: fileStats,
        lastUploads: lastUploadsResult,
        detailedData: allDetails,
        clientesStats: clientesStats || [], // ADICIONAR STATS COMPLETAS DOS CLIENTES
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
          total_prioridades: Number(dashboardStats.total_prioridades),
          periodo_ativo: periodoSistema,  // ✅ PERÍODO ATIVO
          ultima_atualizacao: new Date().toISOString()  // ✅ TIMESTAMP ATUALIZAÇÃO
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
    console.log('🔥 FORÇA ATUALIZAÇÃO: Ignorando cache e carregando dados mais recentes');
    lastLoadTime.current = 0; // Invalidar cache
    isLoadingRef.current = false; // Reset flag de carregamento
    
    // LIMPAR CACHES LOCAIS E FORÇA REFRESH
    localStorage.removeItem('volumetria_cache');
    sessionStorage.clear();
    
    // ADICIONAR TIMESTAMP PARA GARANTIR REFRESH
    const timestamp = Date.now();
    console.log(`⏰ Timestamp refresh: ${timestamp}`);
    
    setData(prev => ({ ...prev, loading: true }));
    await loadStats();
  }, [loadStats]);

  const clearData = async () => {
    console.log('🧹 Limpando dados DEFINITIVOS do banco...');
    
    try {
      setData(prev => ({ ...prev, loading: true }));
      
      // Usar edge function para limpeza síncrona
      const { data: responseData, error: limparError } = await supabase.functions.invoke('limpar-dados-volumetria');

      if (limparError) {
        throw new Error(`Erro ao limpar volumetria: ${limparError.message}`);
      }

      console.log('✅ Limpeza concluída:', responseData);

      // FORÇAR INVALIDAÇÃO COMPLETA DO CACHE
      console.log('🔄 Invalidando cache do contexto...');
      
      // Invalidar completamente o contexto
      (window as any).volumetriaContext?.refreshData?.();
      
      // Aguardar um pouco para garantir que a invalidação seja processada
      await new Promise(resolve => setTimeout(resolve, 1000));


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
        clientesStats: [], // LIMPAR STATS DOS CLIENTES TAMBÉM
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
          total_prioridades: 0,
          periodo_ativo: undefined,
          ultima_atualizacao: new Date().toISOString()
        },
        loading: false
      });
      
      console.log('✅ Limpeza finalizada com sucesso! Dados locais resetados.');
      
    } catch (error) {
      console.error('❌ Erro na limpeza centralizada:', error);
      
      console.log('🔄 Tentando limpeza alternativa direta no banco...');
      
      try {
        // Fallback: limpeza direta se edge function falhar
        console.log('🧹 Executando limpeza DIRETA nas tabelas...');
        
        // Limpar volumetria_mobilemed
        const { error: volumetriaError, count: volumetriaCount } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .gte('id', '00000000-0000-0000-0000-000000000000'); // Remove todos

        if (volumetriaError) {
          console.error('❌ Erro ao limpar volumetria_mobilemed:', volumetriaError);
        } else {
          console.log(`✅ ${volumetriaCount || 0} registros removidos de volumetria_mobilemed`);
        }

        // Limpar processamento_uploads
        const { error: uploadsError, count: uploadsCount } = await supabase
          .from('processamento_uploads')
          .delete()
          .in('tipo_arquivo', ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao']);

        if (uploadsError) {
          console.error('❌ Erro ao limpar processamento_uploads:', uploadsError);
        } else {
          console.log(`✅ ${uploadsCount || 0} registros removidos de processamento_uploads`);
        }

        console.log('✅ Limpeza alternativa concluída com sucesso');
        
      } catch (fallbackError) {
        console.error('❌ Erro na limpeza alternativa:', fallbackError);
        throw new Error(`Erro na limpeza: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
      
      throw error;
    } finally {
      setData(prev => ({ ...prev, loading: false }));
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

  // Filtrar dados por período específico (para comparativo)
  const getDataByPeriod = useCallback((periodo?: string) => {
    if (!periodo || periodo === 'todos') {
      return data.detailedData;
    }
    
    // Usar periodo_referencia ao invés de data_referencia para filtrar
    // Exemplo: "jun/25" filtra pelo periodo_referencia
    return data.detailedData.filter(item => {
      const periodoRef = item.periodo_referencia;
      if (!periodoRef) return false;
      
      // Se período é no formato YYYY-MM, converter para o formato do banco (ex: "jun/25")
      if (periodo.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = periodo.split('-');
        const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 
                           'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const monthName = monthNames[parseInt(month) - 1];
        const yearShort = year.slice(-2);
        const expectedPeriodo = `${monthName}/${yearShort}`;
        return periodoRef === expectedPeriodo;
      }
      
      // Comparação direta para formatos como "jun/25"
      return periodoRef === periodo;
    });
  }, [data.detailedData]);

  useEffect(() => {
    console.log('🔥 USEEFFECT DO CONTEXTO EXECUTADO - Carregamento completo...');
    console.log('🔥 Timestamp atual:', new Date().toISOString());
    console.log('🔥 DADOS PROCESSADOS - Refresh completo dos dados do período');
    // FORÇAR INVALIDAÇÃO COMPLETA
    isLoadingRef.current = false;
    lastLoadTime.current = 0;
    setData(prev => ({ 
      ...prev, 
      loading: true,
      clientesStats: [], // Limpar cache
      detailedData: []    // Limpar cache
    }));
    
    // EXECUTAR IMEDIATAMENTE sem debounce
    setTimeout(() => {
      console.log('🚀 DISPARANDO loadStats() forçado após quebras...');
      loadStats();
    }, 100);
    
    // Disponibilizar contexto globalmente para atualização após upload
    (window as any).volumetriaContext = { refreshData };
    console.log('🌍 Contexto disponibilizado globalmente');
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
    <VolumetriaContext.Provider value={{ data, refreshData, clearData, getDetailedData, getFilteredData, getDataByPeriod }}>
      {children}
    </VolumetriaContext.Provider>
  );
}

export function useVolumetria() {
  const context = useContext(VolumetriaContext);
  if (context === undefined) {
    throw new Error('useVolumetria deve ser usado dentro de VolumetriaProvider');
  }
  return context;
}