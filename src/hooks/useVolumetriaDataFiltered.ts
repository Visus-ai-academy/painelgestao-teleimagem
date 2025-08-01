import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  dataEspecifica?: Date | null;
  cliente: string;
  modalidade: string;
  especialidade: string;
  prioridade: string;
  medico: string;
}

interface DashboardStats {
  total_exames: number;
  total_registros: number;
  total_atrasados: number;
  percentual_atraso: number;
  total_clientes: number;
  total_modalidades: number;
  total_especialidades: number;
  total_medicos: number;
  total_prioridades: number;
}

interface ClienteData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
}

interface ModalidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  total_medicos: number;
  atrasados?: number;
  percentual_atraso?: number;
}

interface EspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  total_medicos: number;
  atrasados?: number;
  percentual_atraso?: number;
}

interface MedicoData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  detalhes?: {
    modalidades: { [key: string]: { exames: number; registros: number } };
    especialidades: { [key: string]: { exames: number; registros: number } };
    prioridades: { [key: string]: { exames: number; registros: number } };
  };
}

export interface VolumetriaData {
  stats: DashboardStats;
  clientes: ClienteData[];
  modalidades: ModalidadeData[];
  especialidades: EspecialidadeData[];
  prioridades: ModalidadeData[];
  medicos: MedicoData[];
  atrasoClientes: ClienteData[];
  atrasoModalidades: ModalidadeData[];
  atrasoEspecialidades: EspecialidadeData[];
  atrasoPrioridades: ModalidadeData[];
  atrasosComTempo?: Array<{ tempoAtrasoMinutos: number; EMPRESA: string; [key: string]: any }>;
}

export function useVolumetriaDataFiltered(filters: VolumetriaFilters) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VolumetriaData>({
    stats: {
      total_exames: 0,
      total_registros: 0,
      total_atrasados: 0,
      percentual_atraso: 0,
      total_clientes: 0,
      total_modalidades: 0,
      total_especialidades: 0,
      total_medicos: 0,
      total_prioridades: 0
    },
    clientes: [],
    modalidades: [],
    especialidades: [],
    prioridades: [],
    medicos: [],
    atrasoClientes: [],
    atrasoModalidades: [],
    atrasoEspecialidades: [],
    atrasoPrioridades: []
  });

  const buildDateFilter = useCallback(() => {
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (filters.ano !== 'todos') {
      const year = parseInt(filters.ano);
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    if (filters.mes !== 'todos' && filters.ano !== 'todos') {
      const year = parseInt(filters.ano);
      const month = parseInt(filters.mes);
      startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

    if (filters.dataEspecifica) {
      startDate = endDate = filters.dataEspecifica.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }, [filters]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      console.log('🔍 [DASHBOARD] Iniciando carregamento de dados volumetria');
      console.log('📅 [DASHBOARD] Filtros aplicados:', filters);
      console.log('🎯 [DASHBOARD] Ano selecionado:', filters.ano);
      console.log('🏢 [DASHBOARD] Cliente selecionado:', filters.cliente);
      
      // Fazer query em lotes para carregar TODOS os dados sem limitação
      let allData: any[] = [];
      let from = 0;
      const batchSize = 5000; // Reduzido para melhor performance
      let hasMore = true;

      const { startDate, endDate } = buildDateFilter();
      console.log('📊 Período selecionado:', { startDate, endDate });

      while (hasMore) {
        let query = supabase.from('volumetria_mobilemed').select(`
          EMPRESA, MODALIDADE, ESPECIALIDADE, MEDICO, PRIORIDADE, CATEGORIA,
          VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO, data_referencia
        `).range(from, from + batchSize - 1);
        
        // Só aplicar filtro de data se AMBOS startDate E endDate existirem E não forem 'todos'
        if (startDate && endDate && filters.ano !== 'todos') {
          // Usar data_referencia ao invés de DATA_REALIZACAO para melhor cobertura
          query = query.gte('data_referencia', startDate).lte('data_referencia', endDate);
          console.log('🎯 Filtro de data aplicado na data_referencia:', startDate, 'até', endDate);
        } else {
          console.log('📊 BUSCANDO TODOS OS REGISTROS (sem filtro de data)');
        }

        if (filters.cliente !== 'todos') {
          query = query.eq('EMPRESA', filters.cliente);
          console.log('🏢 Filtro cliente aplicado:', filters.cliente);
        }
        if (filters.modalidade !== 'todos') {
          query = query.eq('MODALIDADE', filters.modalidade);
          console.log('🔬 Filtro modalidade aplicado:', filters.modalidade);
        }
        if (filters.especialidade !== 'todos') {
          query = query.eq('ESPECIALIDADE', filters.especialidade);
          console.log('👨‍⚕️ Filtro especialidade aplicado:', filters.especialidade);
        }
        if (filters.prioridade !== 'todos') {
          query = query.eq('PRIORIDADE', filters.prioridade);
          console.log('⚡ Filtro prioridade aplicado:', filters.prioridade);
        }
        if (filters.medico !== 'todos') {
          query = query.eq('MEDICO', filters.medico);
          console.log('👩‍⚕️ Filtro médico aplicado:', filters.medico);
        }

        const { data: batchData, error } = await query;
        
        if (error) throw error;

        if (batchData && batchData.length > 0) {
          allData = allData.concat(batchData);
          from += batchSize;
          
          console.log(`📦 [DASHBOARD] Lote ${Math.floor(from/batchSize)}: ${batchData.length} registros, total: ${allData.length}`);
          
          // Se recebeu menos que o batchSize, não há mais dados
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        
        // Removido limitador artificial - carregará todos os dados disponíveis
      }
      
      console.log('📈 [DASHBOARD] Resultado total da query paginada:', {
        totalRegistros: allData.length,
        totalLaudos: allData.reduce((sum, item) => sum + (item.VALORES || 0), 0),
        temErro: false
      });

      // Se não temos filtros específicos, usar dados da função agregada do BD para maior precisão
      if (filters.ano === 'todos' && filters.cliente === 'todos' && 
          filters.modalidade === 'todos' && filters.especialidade === 'todos' && 
          filters.medico === 'todos' && !filters.dataEspecifica) {
        console.log('🎯 [DASHBOARD] Usando dados agregados do BD para maior precisão...');
        try {
          const { data: aggregatedData, error: aggError } = await supabase.rpc('get_volumetria_aggregated_stats');
          if (!aggError && aggregatedData && aggregatedData.length > 0) {
            const totalFromAggregate = aggregatedData.reduce((acc: any, item: any) => ({
              total_exames: acc.total_exames + (item.total_value || 0),
              total_registros: acc.total_registros + (item.total_records || 0),
            }), { total_exames: 0, total_registros: 0 });
            
            console.log('📊 [DASHBOARD] Dados agregados do BD:', totalFromAggregate);
            console.log('📊 [DASHBOARD] Dados da query atual:', { registros: allData.length });
            
            // Se há discrepância significativa, buscar todos os dados SEM LIMITAÇÃO
            if (totalFromAggregate.total_registros > allData.length * 1.1) {
              console.log('⚠️ [DASHBOARD] Discrepância detectada - buscando TODOS os dados SEM LIMITAÇÃO...');
              console.log(`📊 BD indica ${totalFromAggregate.total_registros} registros, query retornou ${allData.length}`);
              
              // Usar query sem range para garantir TODOS os dados
              const { data: allDataComplete, error } = await supabase
                .from('volumetria_mobilemed')
                .select(`
                  EMPRESA, MODALIDADE, ESPECIALIDADE, MEDICO, PRIORIDADE, CATEGORIA,
                  VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO, data_referencia
                `);

              if (error) {
                console.error('❌ [DASHBOARD] Erro na query completa sem limitação:', error);
              } else if (allDataComplete && allDataComplete.length > allData.length) {
                console.log(`✅ [DASHBOARD] Dados completos carregados SEM LIMITAÇÃO: ${allDataComplete.length} registros`);
                allData = allDataComplete;
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ [DASHBOARD] Erro ao buscar dados agregados:', error);
        }
      }

      if (!allData || allData.length === 0) {
        setData({
          stats: {
            total_exames: 0, total_registros: 0, total_atrasados: 0, percentual_atraso: 0,
            total_clientes: 0, total_modalidades: 0, total_especialidades: 0, total_medicos: 0,
            total_prioridades: 0
          },
          clientes: [], modalidades: [], especialidades: [], prioridades: [], medicos: [],
          atrasoClientes: [], atrasoModalidades: [], atrasoEspecialidades: [], atrasoPrioridades: []
        });
        return;
      }

      // Calcular atrasos com tempo de atraso
      const atrasados = allData.filter(item => {
        if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) return false;
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          return dataLaudo > dataPrazo;
        } catch {
          return false;
        }
      });

      // Calcular tempos de atraso em minutos
      const atrasosComTempo = atrasados.map(item => {
        const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
        const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
        const tempoAtrasoMinutos = Math.floor((dataLaudo.getTime() - dataPrazo.getTime()) / (1000 * 60));
        return { ...item, tempoAtrasoMinutos };
      });

      console.log('📅 Debug datas:', {
        totalRegistros: allData.length,
        registrosComDatas: allData.filter(item => item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO).length,
        totalAtrasados: atrasados.length,
        amostraDatas: allData.slice(0, 3).map(item => ({
          DATA_LAUDO: item.DATA_LAUDO,
          HORA_LAUDO: item.HORA_LAUDO,
          DATA_PRAZO: item.DATA_PRAZO,
          HORA_PRAZO: item.HORA_PRAZO,
          EMPRESA: item.EMPRESA
        }))
      });

      const totalLaudos = allData.reduce((sum, item) => sum + (item.VALORES || 0), 0);
      const totalRegistros = allData.length;
      const totalAtrasados = atrasados.length;
      const percentualAtraso = totalRegistros > 0 ? (totalAtrasados / totalRegistros) * 100 : 0;
      
      console.log('💰 Cálculos finais:', {
        totalLaudos,
        totalRegistros,
        totalAtrasados,
        percentualAtraso,
        amostraValores: allData.slice(0, 5).map(item => ({ VALORES: item.VALORES, DATA_REALIZACAO: item.DATA_REALIZACAO }))
      });

      // Agrupar dados
      const clientesMap = new Map<string, any>();
      const modalidadesMap = new Map<string, any>();
      const especialidadesMap = new Map<string, any>();
      const prioridadesMap = new Map<string, any>();
      const medicosMap = new Map<string, any>();
      
      // Maps para rastrear médicos únicos por segmento
      const modalidadeMedicosMap = new Map<string, Set<string>>();
      const especialidadeMedicosMap = new Map<string, Set<string>>();

      allData.forEach(item => {
        const isAtrasado = atrasados.includes(item);
        
        // Clientes
        if (item.EMPRESA) {
          const current = clientesMap.get(item.EMPRESA) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += 1;
          clientesMap.set(item.EMPRESA, current);
        }

        // Modalidades
        if (item.MODALIDADE) {
          const current = modalidadesMap.get(item.MODALIDADE) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += 1;
          modalidadesMap.set(item.MODALIDADE, current);
          
           // Rastrear médicos únicos por modalidade
           if (item.MEDICO) {
             if (!modalidadeMedicosMap.has(item.MODALIDADE)) {
               modalidadeMedicosMap.set(item.MODALIDADE, new Set<string>());
             }
             modalidadeMedicosMap.get(item.MODALIDADE)?.add(item.MEDICO);
           }
        }

        // Especialidades apenas
        if (item.ESPECIALIDADE) {
          const current = especialidadesMap.get(item.ESPECIALIDADE) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += 1;
          especialidadesMap.set(item.ESPECIALIDADE, current);
          
           // Rastrear médicos únicos por especialidade
           if (item.MEDICO) {
             if (!especialidadeMedicosMap.has(item.ESPECIALIDADE)) {
               especialidadeMedicosMap.set(item.ESPECIALIDADE, new Set<string>());
             }
             especialidadeMedicosMap.get(item.ESPECIALIDADE)?.add(item.MEDICO);
           }
        }

        // Prioridades
        if (item.PRIORIDADE) {
          const current = prioridadesMap.get(item.PRIORIDADE) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += 1;
          prioridadesMap.set(item.PRIORIDADE, current);
        }

        // Médicos com detalhes
        if (item.MEDICO) {
          const current = medicosMap.get(item.MEDICO) || { 
            total_exames: 0, 
            total_registros: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {}
          };
          
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          
          // Detalhes por modalidade
          if (item.MODALIDADE) {
            if (!current.modalidades[item.MODALIDADE]) {
              current.modalidades[item.MODALIDADE] = { exames: 0, registros: 0 };
            }
            current.modalidades[item.MODALIDADE].exames += item.VALORES || 0;
            current.modalidades[item.MODALIDADE].registros += 1;
          }
          
          // Detalhes por especialidade
          if (item.ESPECIALIDADE) {
            if (!current.especialidades[item.ESPECIALIDADE]) {
              current.especialidades[item.ESPECIALIDADE] = { exames: 0, registros: 0 };
            }
            current.especialidades[item.ESPECIALIDADE].exames += item.VALORES || 0;
            current.especialidades[item.ESPECIALIDADE].registros += 1;
          }
          
          // Detalhes por prioridade
          if (item.PRIORIDADE) {
            if (!current.prioridades[item.PRIORIDADE]) {
              current.prioridades[item.PRIORIDADE] = { exames: 0, registros: 0 };
            }
            current.prioridades[item.PRIORIDADE].exames += item.VALORES || 0;
            current.prioridades[item.PRIORIDADE].registros += 1;
          }
          
          medicosMap.set(item.MEDICO, current);
        }
      });

      // Converter para arrays
      const clientes = Array.from(clientesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, ...data, percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const modalidades = Array.from(modalidadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0,
        total_medicos: modalidadeMedicosMap.get(nome)?.size || 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const especialidades = Array.from(especialidadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0,
        total_medicos: especialidadeMedicosMap.get(nome)?.size || 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const medicos = Array.from(medicosMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        total_exames: data.total_exames,
        total_registros: data.total_registros,
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        detalhes: {
          modalidades: data.modalidades,
          especialidades: data.especialidades,
          prioridades: data.prioridades
        }
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Categorias vazias (não existem na tabela atual)
      const categorias: any[] = [];
      
      // Prioridades processadas
      const prioridades = Array.from(prioridadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0,
        total_medicos: 0 // TODO: implementar contagem de médicos por prioridade se necessário
      })).sort((a, b) => b.total_exames - a.total_exames);

      setData({
        stats: {
          total_exames: totalLaudos,
          total_registros: totalRegistros, // Corrigido: usar a contagem real de registros
          total_atrasados: totalAtrasados,
          percentual_atraso: percentualAtraso,
          total_clientes: clientesMap.size,
          total_modalidades: modalidadesMap.size,
          total_especialidades: especialidadesMap.size,
          total_medicos: medicosMap.size,
          total_prioridades: prioridadesMap.size
        },
        clientes, modalidades, especialidades, prioridades, medicos,
        atrasoClientes: clientes.filter(c => c.atrasados > 0),
        atrasoModalidades: modalidades.filter(m => m.atrasados && m.atrasados > 0),
        atrasoEspecialidades: especialidades.filter(e => e.atrasados && e.atrasados > 0),
        atrasoPrioridades: prioridades.filter(p => p.atrasados && p.atrasados > 0),
        atrasosComTempo
      });

      // Debug dos dados de atraso
      console.log('🚨 Debug atrasos:', {
        totalClientesComDados: clientes.length,
        clientesComAtraso: clientes.filter(c => c.atrasados > 0).length,
        amostraClientes: clientes.slice(0, 5).map(c => ({ nome: c.nome, atrasados: c.atrasados, percentual_atraso: c.percentual_atraso })),
        totalAtrasados,
        percentualAtraso
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: "Erro", description: "Falha ao carregar dados da volumetria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, buildDateFilter, toast]);

  useEffect(() => {
    console.log('🔄 [useVolumetriaDataFiltered] Carregando dados iniciais...');
    loadData();
  }, [loadData]);

  // Refresh manual disponível
  const refreshData = useCallback(async () => {
    console.log('🔄 [useVolumetriaDataFiltered] Refresh manual solicitado...');
    await loadData();
  }, [loadData]);

  return { ...data, loading, refreshData };
}