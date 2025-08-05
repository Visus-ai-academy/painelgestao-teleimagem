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
    // Evitar chamadas duplicadas mas permitir forçar reload
    const now = Date.now();
    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    lastLoadTime.current = now;
    
    try {
      console.log('🔄 Carregando estatísticas DEFINITIVAS da volumetria (TODOS OS DADOS)...');
      
      // Carregar dados de volumetria diretamente da tabela SEM LIMITAÇÕES
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

      // Carregar dados detalhados para análises - SEM LIMITAÇÕES DE FORMA ALGUMA
      console.log('📋 Carregando TODOS os dados detalhados SEM QUALQUER LIMITAÇÃO...');
      let allDetailedData: any[] = [];
      
      try {
        console.log('🚀 Executando query COMPLETA DEFINITIVA sem qualquer limitação...');
        
        // SOLUÇÃO DEFINITIVA: Usar contagem e depois carregar tudo de uma vez
        const { count: totalCount } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true });
          
        console.log(`📊 Total de registros no banco: ${totalCount}`);
        
        if (totalCount === 0) {
          console.log('⚠️ Nenhum registro encontrado na volumetria');
          allDetailedData = [];
        } else {
          // PAGINAÇÃO DEFINITIVA FORÇADA PARA CARREGAR TODOS OS DADOS
          let offset = 0;
          const batchSize = 10000;
          let hasMoreData = true;
          
          while (hasMoreData && allDetailedData.length < totalCount) {
            console.log(`📦 [DEFINITIVO] Carregando lote ${Math.floor(offset/batchSize) + 1}: registros ${offset} a ${offset + batchSize - 1}...`);
            
            const { data: batchData, error: batchError } = await supabase
              .from('volumetria_mobilemed')
              .select(`
                "EMPRESA",
                "MODALIDADE", 
                "ESPECIALIDADE",
                "MEDICO",
                "PRIORIDADE",
                "CATEGORIA",
                "VALORES",
                "DATA_LAUDO",
                "HORA_LAUDO", 
                "DATA_PRAZO",
                "HORA_PRAZO",
                data_referencia
              `)
              .range(offset, offset + batchSize - 1)
              .order('id');
              
            if (batchError) {
              console.error('❌ Erro ao carregar lote:', batchError);
              break;
            }
            
            if (!batchData || batchData.length === 0) {
              console.log('✅ Fim dos dados alcançado (lote vazio)');
              break;
            }
            
            allDetailedData = [...allDetailedData, ...batchData];
            console.log(`✅ Lote ${Math.floor(offset/batchSize) + 1} carregado: ${batchData.length} registros, total acumulado: ${allDetailedData.length}/${totalCount}`);
            
            // Verificação dupla para garantir que todos os dados foram carregados
            if (batchData.length < batchSize || allDetailedData.length >= totalCount) {
              console.log(`🎯 Todos os dados carregados: ${allDetailedData.length}/${totalCount}`);
              hasMoreData = false;
            } else {
              offset += batchSize;
            }
            
            // Proteção contra loop infinito
            if (offset > totalCount + batchSize) {
              console.log('⚠️ Proteção contra loop infinito ativada');
              break;
            }
          }
        }
        
        console.log(`🎉 CARREGAMENTO DEFINITIVO COMPLETO: ${allDetailedData.length} registros de ${totalCount} total`);
        console.log(`💯 Percentual carregado: ${totalCount > 0 ? ((allDetailedData.length / totalCount) * 100).toFixed(1) : 0}%`);
      } catch (error) {
        console.error('❌ Erro crítico ao carregar dados detalhados:', error);
        allDetailedData = [];
      }

      // Processar listas únicas e estatísticas
      const clientesUnicos = [...new Set(allDetailedData.map(item => item.EMPRESA).filter(Boolean))];
      const modalidadesUnicas = [...new Set(allDetailedData.map(item => item.MODALIDADE).filter(Boolean))];
      const especialidadesUnicas = [...new Set(allDetailedData.map(item => item.ESPECIALIDADE).filter(Boolean))];
      const prioridadesUnicas = [...new Set(allDetailedData.map(item => item.PRIORIDADE).filter(Boolean))];
      const medicosUnicos = [...new Set(allDetailedData.map(item => item.MEDICO).filter(Boolean))];

      // Calcular atrasos
      const atrasados = allDetailedData.filter(item => {
        if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) return false;
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          return dataLaudo > dataPrazo;
        } catch {
          return false;
        }
      });

      const totalExamesCalculado = allDetailedData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      const totalRegistrosCalculado = allDetailedData.length;
      const totalAtrasadosCalculado = atrasados.length;
      const percentualAtrasoCalculado = totalRegistrosCalculado > 0 ? (totalAtrasadosCalculado / totalRegistrosCalculado) * 100 : 0;

      console.log('✅ Dados detalhados carregados:', allDetailedData.length);
      console.log('📊 Total calculado:', totalExamesCalculado, 'exames');
      console.log('👥 Clientes únicos:', clientesUnicos.length);
      console.log('⏰ Atrasos:', totalAtrasadosCalculado, `(${percentualAtrasoCalculado.toFixed(1)}%)`);

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
        detailedData: allDetailedData,
        clientes: clientesUnicos,
        modalidades: modalidadesUnicas,
        especialidades: especialidadesUnicas,
        prioridades: prioridadesUnicas,
        medicos: medicosUnicos,
        dashboardStats: {
          total_exames: totalExamesCalculado,
          total_registros: totalRegistrosCalculado,
          total_atrasados: totalAtrasadosCalculado,
          percentual_atraso: percentualAtrasoCalculado,
          total_clientes: clientesUnicos.length,
          total_clientes_volumetria: clientesUnicos.length,
          total_modalidades: modalidadesUnicas.length,
          total_especialidades: especialidadesUnicas.length,
          total_medicos: medicosUnicos.length,
          total_prioridades: prioridadesUnicas.length
        },
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