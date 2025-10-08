import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";

export interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  dataEspecifica?: Date | null;
  cliente: string;
  tipoCliente: string; // CO, NC
  tipoFaturamento: string; // CO-FT, NC-FT, NC-NF
  modalidade: string;
  especialidade: string;
  categoria?: string;
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
    categorias: { [key: string]: { exames: number; registros: number } };
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
  const { data: contextoData, getFilteredData } = useVolumetria();
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
    if (contextoData.loading) {
      console.log('⏳ [useVolumetriaDataFiltered] Aguardando contexto...');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔍 [useVolumetriaDataFiltered] Usando dados do contexto');
      console.log('📅 [useVolumetriaDataFiltered] Filtros aplicados:', filters);
      console.log('🎯 [useVolumetriaDataFiltered] Total de dados do contexto:', contextoData.detailedData.length);
      
      // USAR DADOS DO CONTEXTO EM VEZ DE CONSULTAS DIRETAS
      let allData = contextoData.detailedData;
      
      // Aplicar filtros nos dados do contexto
      if (filters.cliente !== 'todos') {
        allData = allData.filter(item => item.EMPRESA === filters.cliente);
        console.log(`🏢 Filtro cliente aplicado: ${filters.cliente}, restaram ${allData.length} registros`);
      }
      
      if (filters.modalidade !== 'todos') {
        allData = allData.filter(item => item.MODALIDADE === filters.modalidade);
        console.log(`🔬 Filtro modalidade aplicado: ${filters.modalidade}, restaram ${allData.length} registros`);
      }
      
      if (filters.especialidade !== 'todos') {
        allData = allData.filter(item => item.ESPECIALIDADE === filters.especialidade);
        console.log(`👨‍⚕️ Filtro especialidade aplicado: ${filters.especialidade}, restaram ${allData.length} registros`);
      }
      
      if (filters.categoria && filters.categoria !== 'todos') {
        allData = allData.filter(item => item.CATEGORIA === filters.categoria);
        console.log(`🏷️ Filtro categoria aplicado: ${filters.categoria}, restaram ${allData.length} registros`);
      }
      
      if (filters.prioridade !== 'todos') {
        allData = allData.filter(item => item.PRIORIDADE === filters.prioridade);
        console.log(`⚡ Filtro prioridade aplicado: ${filters.prioridade}, restaram ${allData.length} registros`);
      }
      
      if (filters.medico !== 'todos') {
        allData = allData.filter(item => item.MEDICO === filters.medico);
        console.log(`👩‍⚕️ Filtro médico aplicado: ${filters.medico}, restaram ${allData.length} registros`);
      }
      
      // ✅ NOVOS FILTROS: Tipo de Cliente e Tipo de Faturamento
      if (filters.tipoCliente !== 'todos') {
        allData = allData.filter(item => item.tipo_cliente === filters.tipoCliente);
        console.log(`🏷️ Filtro tipo cliente aplicado: ${filters.tipoCliente}, restaram ${allData.length} registros`);
      }
      
      if (filters.tipoFaturamento !== 'todos') {
        allData = allData.filter(item => {
          // Mapear o tipo de faturamento selecionado para o campo do banco
          if (filters.tipoFaturamento === 'CO-FT') {
            return item.tipo_cliente === 'CO'; // Clientes CO sempre são faturados
          } else if (filters.tipoFaturamento === 'NC-FT') {
            return item.tipo_cliente === 'NC' && item.tipo_faturamento !== 'padrao';
          } else if (filters.tipoFaturamento === 'NC-NF') {
            return item.tipo_cliente === 'NC' && item.tipo_faturamento === 'padrao';
          }
          return true;
        });
        console.log(`💰 Filtro tipo faturamento aplicado: ${filters.tipoFaturamento}, restaram ${allData.length} registros`);
      }
      
      // Aplicar filtros de data: para recorte mensal, usar janela de DATA_LAUDO (1º dia do mês até dia 7 do mês seguinte)
      const { startDate, endDate } = buildDateFilter();
      if (filters.ano !== 'todos' && filters.mes !== 'todos') {
        const year = parseInt(filters.ano);
        const month = parseInt(filters.mes); // 1-12
        const laudoStart = new Date(year, month - 1, 1); // 1º dia do mês
        const laudoEnd = new Date(year, month, 7); // dia 7 do mês seguinte
        allData = allData.filter(item => {
          if (!item.DATA_LAUDO) return false;
          try {
            const laudoDate = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO || '00:00:00'}`);
            return laudoStart <= laudoDate && laudoDate <= laudoEnd;
          } catch {
            return false;
          }
        });
        console.log(`📅 Filtro por janela de DATA_LAUDO aplicado: ${laudoStart.toISOString().slice(0,10)} - ${laudoEnd.toISOString().slice(0,10)}, restaram ${allData.length} registros`);
      } else if (startDate && endDate && filters.ano !== 'todos') {
        allData = allData.filter(item => {
          if (!item.data_referencia) return false;
          return item.data_referencia >= startDate && item.data_referencia <= endDate;
        });
        console.log(`📅 Filtro de data_referencia aplicado: ${startDate} - ${endDate}, restaram ${allData.length} registros`);
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

      console.log(`✅ [useVolumetriaDataFiltered] Processando ${allData.length} registros filtrados`);
      const totalLaudosCorreto = allData.reduce((sum, item) => sum + (item.VALORES || 0), 0);
      console.log(`📈 [useVolumetriaDataFiltered] Total de laudos filtrados: ${totalLaudosCorreto}`);

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
      const totalAtrasados = atrasados.reduce((sum, item) => sum + (item.VALORES || 0), 0);
      const percentualAtraso = totalLaudos > 0 ? (totalAtrasados / totalLaudos) * 100 : 0;
      
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
          if (isAtrasado) current.atrasados += item.VALORES || 0;
          clientesMap.set(item.EMPRESA, current);
        }

        // Modalidades
        if (item.MODALIDADE) {
          const current = modalidadesMap.get(item.MODALIDADE) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += item.VALORES || 0;
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
          if (isAtrasado) current.atrasados += item.VALORES || 0;
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
          if (isAtrasado) current.atrasados += item.VALORES || 0;
          prioridadesMap.set(item.PRIORIDADE, current);
        }

        // Médicos com detalhes
        if (item.MEDICO) {
          const current = medicosMap.get(item.MEDICO) || { 
            total_exames: 0, 
            total_registros: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {},
            categorias: {}
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
          
          // Detalhes por categoria (usando o campo CATEGORIA específico)
          if (item.CATEGORIA) {
            if (!current.categorias[item.CATEGORIA]) {
              current.categorias[item.CATEGORIA] = { exames: 0, registros: 0 };
            }
            current.categorias[item.CATEGORIA].exames += item.VALORES || 0;
            current.categorias[item.CATEGORIA].registros += 1;
          }
          
          medicosMap.set(item.MEDICO, current);
        }
      });

      // Converter para arrays
      const clientes = Array.from(clientesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, ...data, percentual_atraso: data.total_exames > 0 ? (data.atrasados / data.total_exames) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const modalidades = Array.from(modalidadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_exames > 0 ? (data.atrasados / data.total_exames) * 100 : 0,
        total_medicos: modalidadeMedicosMap.get(nome)?.size || 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const especialidades = Array.from(especialidadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_exames > 0 ? (data.atrasados / data.total_exames) * 100 : 0,
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
          prioridades: data.prioridades,
          categorias: data.categorias
        }
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Categorias vazias (não existem na tabela atual)
      const categorias: any[] = [];
      
      // Prioridades processadas
      const prioridades = Array.from(prioridadesMap.entries()).map(([nome, data]: [string, any]) => ({
        nome, 
        ...data, 
        percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_exames > 0 ? (data.atrasados / data.total_exames) * 100 : 0,
        total_medicos: 0 // TODO: implementar contagem de médicos por prioridade se necessário
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Usar dados do contexto para clientes
      const totalClientesCadastrados = contextoData.dashboardStats.total_clientes;
      console.log('👥 [useVolumetriaDataFiltered] Total de clientes do contexto:', totalClientesCadastrados);

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
  }, [filters, buildDateFilter, toast, contextoData]);

  useEffect(() => {
    if (!contextoData.loading && contextoData.detailedData.length > 0) {
      console.log('🔄 [useVolumetriaDataFiltered] Contexto carregado, processando dados...');
      loadData();
    }
  }, [loadData, contextoData.loading, contextoData.detailedData.length]);

  // Refresh manual disponível
  const refreshData = useCallback(async () => {
    console.log('🔄 [useVolumetriaDataFiltered] Refresh manual solicitado...');
    await loadData();
  }, [loadData]);

  return { ...data, loading, refreshData };
}