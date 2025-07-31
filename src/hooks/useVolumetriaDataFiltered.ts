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
  categoria: string;
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
  total_categorias: number;
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
  atrasados?: number;
  percentual_atraso?: number;
}

interface EspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  atrasados?: number;
  percentual_atraso?: number;
}

export interface VolumetriaData {
  stats: DashboardStats;
  clientes: ClienteData[];
  modalidades: ModalidadeData[];
  especialidades: EspecialidadeData[];
  categorias: ModalidadeData[];
  prioridades: ModalidadeData[];
  atrasoClientes: ClienteData[];
  atrasoModalidades: ModalidadeData[];
  atrasoEspecialidades: EspecialidadeData[];
  atrasoCategorias: ModalidadeData[];
  atrasoPrioridades: ModalidadeData[];
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
      total_categorias: 0,
      total_prioridades: 0
    },
    clientes: [],
    modalidades: [],
    especialidades: [],
    categorias: [],
    prioridades: [],
    atrasoClientes: [],
    atrasoModalidades: [],
    atrasoEspecialidades: [],
    atrasoCategorias: [],
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
      console.log('🔍 Iniciando carregamento de dados volumetria');
      console.log('📅 Filtros aplicados:', filters);
      
      // Fazer query em lotes para evitar limitações
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      const { startDate, endDate } = buildDateFilter();
      console.log('📊 Período selecionado:', { startDate, endDate });

      while (hasMore) {
        let query = supabase.from('volumetria_mobilemed').select(`
          EMPRESA, MODALIDADE, ESPECIALIDADE, MEDICO,
          VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO
        `).range(from, from + batchSize - 1);
        
        // CORREÇÃO: Só aplicar filtro de data se startDate E endDate existirem
        if (startDate && endDate) {
          query = query.gte('DATA_REALIZACAO', startDate).lte('DATA_REALIZACAO', endDate);
          console.log('🎯 Filtro de data aplicado na DATA_REALIZACAO:', startDate, 'até', endDate);
        } else {
          console.log('⚠️ Nenhum filtro de data aplicado - buscando TODOS os registros');
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
        if (filters.medico !== 'todos') {
          query = query.eq('MEDICO', filters.medico);
          console.log('👩‍⚕️ Filtro médico aplicado:', filters.medico);
        }

        const { data: batchData, error } = await query;
        
        if (error) throw error;

        if (batchData && batchData.length > 0) {
          allData = allData.concat(batchData);
          from += batchSize;
          
          // Se recebeu menos que o batchSize, não há mais dados
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log('📈 Resultado total da query paginada:', {
        totalRegistros: allData.length,
        temErro: false
      });

      if (!allData || allData.length === 0) {
        setData({
          stats: {
            total_exames: 0, total_registros: 0, total_atrasados: 0, percentual_atraso: 0,
            total_clientes: 0, total_modalidades: 0, total_especialidades: 0, total_medicos: 0,
            total_categorias: 0, total_prioridades: 0
          },
          clientes: [], modalidades: [], especialidades: [], categorias: [], prioridades: [],
          atrasoClientes: [], atrasoModalidades: [], atrasoEspecialidades: [], atrasoCategorias: [], atrasoPrioridades: []
        });
        return;
      }

      // Calcular atrasos
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
      const clientesMap = new Map();
      const modalidadesMap = new Map();
      const especialidadesMap = new Map();
      const categoriasMap = new Map();
      const prioridadesMap = new Map();
      const medicosSet = new Set();

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
        }

        // Especialidades apenas
        if (item.ESPECIALIDADE) {
          const current = especialidadesMap.get(item.ESPECIALIDADE) || { total_exames: 0, total_registros: 0, atrasados: 0 };
          current.total_exames += item.VALORES || 0;
          current.total_registros += 1;
          if (isAtrasado) current.atrasados += 1;
          especialidadesMap.set(item.ESPECIALIDADE, current);
        }

        if (item.MEDICO) medicosSet.add(item.MEDICO);
      });

      // Converter para arrays
      const clientes = Array.from(clientesMap.entries()).map(([nome, data]) => ({
        nome, ...data, percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const modalidades = Array.from(modalidadesMap.entries()).map(([nome, data]) => ({
        nome, ...data, percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      const especialidades = Array.from(especialidadesMap.entries()).map(([nome, data]) => ({
        nome, ...data, percentual: totalLaudos > 0 ? (data.total_exames / totalLaudos) * 100 : 0,
        percentual_atraso: data.total_registros > 0 ? (data.atrasados / data.total_registros) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Categorias e prioridades vazias (não existem na tabela atual)
      const categorias: any[] = [];
      const prioridades: any[] = [];

      setData({
        stats: {
          total_exames: totalLaudos,
          total_registros: totalLaudos,
          total_atrasados: totalAtrasados,
          percentual_atraso: percentualAtraso,
          total_clientes: clientesMap.size,
          total_modalidades: modalidadesMap.size,
          total_especialidades: especialidadesMap.size,
          total_medicos: medicosSet.size,
          total_categorias: 0,
          total_prioridades: 0
        },
        clientes, modalidades, especialidades, categorias, prioridades,
        atrasoClientes: clientes.filter(c => c.atrasados > 0),
        atrasoModalidades: modalidades.filter(m => m.atrasados && m.atrasados > 0),
        atrasoEspecialidades: especialidades.filter(e => e.atrasados && e.atrasados > 0),
        atrasoCategorias: [],
        atrasoPrioridades: []
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: "Erro", description: "Falha ao carregar dados da volumetria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, buildDateFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { ...data, loading, refreshData: loadData };
}