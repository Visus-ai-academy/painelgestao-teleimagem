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
  total_clientes: number; // Total de clientes cadastrados
  total_clientes_volumetria: number; // Clientes únicos com volumetria
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
      total_clientes_volumetria: 0,
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
      
      // FORÇAR CARREGAMENTO DIRETO SEM RANGE PARA DEBUG
      console.log('🚀 [DASHBOARD] FORÇANDO QUERY DIRETA SEM LIMITAÇÃO...');
      
      // CARREGAR DADOS EM BATCHES PARA GARANTIR TODOS OS REGISTROS
      let allData: any[] = [];
      let offset = 0;
      const limit = 50000; // Aumentado significativamente para volumes altos
      let hasMoreData = true;
      
      const { startDate, endDate } = buildDateFilter();
      console.log('📊 Período selecionado:', { startDate, endDate });
      
      while (hasMoreData) {
        console.log(`📦 [DASHBOARD] Carregando batch offset ${offset}...`);
        
        let query = supabase
          .from('volumetria_mobilemed')
          .select(`
            EMPRESA, MODALIDADE, ESPECIALIDADE, MEDICO, PRIORIDADE, CATEGORIA,
            VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO, data_referencia
          `)
          .range(offset, offset + limit - 1);

        // Aplicar filtros se necessário
        if (startDate && endDate && filters.ano !== 'todos') {
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
        
        if (error) {
          console.error('❌ [DASHBOARD] Erro na query do batch:', error);
          throw error;
        }

        if (!batchData || batchData.length === 0) {
          break;
        }

        allData = [...allData, ...batchData];
        console.log(`✅ [DASHBOARD] Batch carregado: ${batchData.length} registros, total acumulado: ${allData.length}`);
        
        if (batchData.length < limit) {
          hasMoreData = false;
        } else {
          offset += limit;
        }

        // Limite de segurança para evitar loops infinitos
        if (offset > 1000000) {
          console.log('⚠️ [DASHBOARD] Limite de segurança atingido - finalizando...');
          hasMoreData = false;
        }
      }

      if (!allData || allData.length === 0) {
        console.log('⚠️ [DASHBOARD] Nenhum dado retornado');
         setData({
           stats: {
             total_exames: 0, total_registros: 0, total_atrasados: 0, percentual_atraso: 0,
             total_clientes: 0, total_clientes_volumetria: 0, total_modalidades: 0, total_especialidades: 0, total_medicos: 0,
             total_prioridades: 0
           },
           clientes: [], modalidades: [], especialidades: [], prioridades: [], medicos: [],
           atrasoClientes: [], atrasoModalidades: [], atrasoEspecialidades: [], atrasoPrioridades: []
         });
        return;
      }

      console.log('✅ [DASHBOARD] Query direta retornou:', allData.length, 'registros');
      console.log('📈 [DASHBOARD] Total de laudos:', allData.reduce((sum, item) => sum + (item.VALORES || 0), 0));

      // VERIFICAR E CARREGAR DADOS ADICIONAIS PARA GARANTIR COMPLETUDE
      console.log('🎯 [DASHBOARD] Verificando dados agregados para validação...');
      
      try {
        // Verificar total de registros reais na tabela
        const { count, error: countError } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true });
          
        if (!countError && count) {
          console.log(`📊 [DASHBOARD] Total de registros na tabela: ${count}`);
          console.log(`📊 [DASHBOARD] Registros carregados até agora: ${allData.length}`);
          
          // Se ainda faltam dados significativos e não temos filtros específicos
          if (count > allData.length && filters.ano === 'todos' && filters.cliente === 'todos') {
            console.log('⚠️ [DASHBOARD] Discrepância detectada - carregando dados adicionais...');
            
            // Carregar em lotes menores para garantir todos os dados
            let additionalOffset = allData.length;
            const smallerBatchSize = 100000; // Aumentado para volumes altos
            
            while (additionalOffset < count && additionalOffset < 10000000) { // Aumentado limite de segurança para 10M
              console.log(`📦 [DASHBOARD] Carregando lote adicional offset ${additionalOffset}...`);
              
              let additionalQuery = supabase
                .from('volumetria_mobilemed')
                .select(`
                  EMPRESA, MODALIDADE, ESPECIALIDADE, MEDICO, PRIORIDADE, CATEGORIA,
                  VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO, data_referencia
                `)
                .range(additionalOffset, additionalOffset + smallerBatchSize - 1);

              // Aplicar os mesmos filtros
              if (startDate && endDate && filters.ano !== 'todos') {
                additionalQuery = additionalQuery.gte('data_referencia', startDate).lte('data_referencia', endDate);
              }
              if (filters.cliente !== 'todos') {
                additionalQuery = additionalQuery.eq('EMPRESA', filters.cliente);
              }
              if (filters.modalidade !== 'todos') {
                additionalQuery = additionalQuery.eq('MODALIDADE', filters.modalidade);
              }
              if (filters.especialidade !== 'todos') {
                additionalQuery = additionalQuery.eq('ESPECIALIDADE', filters.especialidade);
              }
              if (filters.prioridade !== 'todos') {
                additionalQuery = additionalQuery.eq('PRIORIDADE', filters.prioridade);
              }
              if (filters.medico !== 'todos') {
                additionalQuery = additionalQuery.eq('MEDICO', filters.medico);
              }

              const { data: additionalData, error: additionalError } = await additionalQuery;
              
              if (additionalError) {
                console.error('❌ [DASHBOARD] Erro ao carregar dados adicionais:', additionalError);
                break;
              }
              
              if (!additionalData || additionalData.length === 0) {
                break;
              }
              
              allData = [...allData, ...additionalData];
              console.log(`✅ [DASHBOARD] Lote adicional carregado: ${additionalData.length} registros, total: ${allData.length}`);
              
              if (additionalData.length < smallerBatchSize) {
                break;
              }
              
              additionalOffset += smallerBatchSize;
              
              // Pequena pausa
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ [DASHBOARD] Erro ao verificar total de registros:', error);
      }

      if (!allData || allData.length === 0) {
        setData({
          stats: {
            total_exames: 0, total_registros: 0, total_atrasados: 0, percentual_atraso: 0,
            total_clientes: 0, total_clientes_volumetria: 0, total_modalidades: 0, total_especialidades: 0, total_medicos: 0,
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

      // Buscar total de clientes cadastrados
      let totalClientesCadastrados = 0;
      try {
        const { count: totalClientes } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true);
        totalClientesCadastrados = totalClientes || 0;
        console.log('👥 [DASHBOARD] Total de clientes cadastrados:', totalClientesCadastrados);
      } catch (error) {
        console.warn('⚠️ [DASHBOARD] Erro ao buscar total de clientes:', error);
      }

      setData({
        stats: {
          total_exames: totalLaudos,
          total_registros: totalRegistros, // Corrigido: usar a contagem real de registros
          total_atrasados: totalAtrasados,
          percentual_atraso: percentualAtraso,
          total_clientes: totalClientesCadastrados, // Total de clientes cadastrados
          total_clientes_volumetria: clientesMap.size, // Clientes únicos com volumetria
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