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
  registros_30_dias: number;
  registros_7_dias: number;
  registros_ontem: number;
  registros_hoje: number;
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
}

interface EspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
}

export interface VolumetriaData {
  stats: DashboardStats;
  clientes: ClienteData[];
  modalidades: ModalidadeData[];
  especialidades: EspecialidadeData[];
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
      registros_30_dias: 0,
      registros_7_dias: 0,
      registros_ontem: 0,
      registros_hoje: 0
    },
    clientes: [],
    modalidades: [],
    especialidades: []
  });

  // Construir filtros de data baseado no filtro selecionado
  const buildDateFilter = useCallback(() => {
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (filters.ano !== 'todos') {
      const year = parseInt(filters.ano);
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    if (filters.trimestre !== 'todos' && filters.ano !== 'todos') {
      const year = parseInt(filters.ano);
      const quarter = parseInt(filters.trimestre);
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
      endDate = new Date(year, endMonth, 0).toISOString().split('T')[0];
    }

    if (filters.mes !== 'todos' && filters.ano !== 'todos') {
      const year = parseInt(filters.ano);
      const month = parseInt(filters.mes);
      startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

    if (filters.dia !== 'todos') {
      if (filters.dia === 'hoje') {
        startDate = endDate = now.toISOString().split('T')[0];
      } else if (filters.dia === 'ontem') {
        const ontem = new Date(now);
        ontem.setDate(ontem.getDate() - 1);
        startDate = endDate = ontem.toISOString().split('T')[0];
      } else if (filters.dia === 'anteontem') {
        const anteontem = new Date(now);
        anteontem.setDate(anteontem.getDate() - 2);
        startDate = endDate = anteontem.toISOString().split('T')[0];
      } else if (filters.dia === 'ultimos5dias') {
        const cincodiasAtras = new Date(now);
        cincodiasAtras.setDate(cincodiasAtras.getDate() - 5);
        startDate = cincodiasAtras.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (filters.dia === 'especifico' && filters.dataEspecifica) {
        startDate = endDate = filters.dataEspecifica.toISOString().split('T')[0];
      } else {
        startDate = endDate = filters.dia;
      }
    }

    // Filtros de período relativo
    if (filters.semana !== 'todos') {
      const weeksAgo = parseInt(filters.semana);
      const date = new Date(now);
      date.setDate(date.getDate() - (weeksAgo * 7));
      startDate = date.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }, [filters]);

  // Carregar dados aplicando todos os filtros no banco de dados
  const loadData = useCallback(async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      console.log('🔄 Carregando dados com filtros aplicados no banco...', filters);
      
      // Otimização: Se não há filtros específicos, usar uma query mais simples
      const hasSpecificFilters = filters.cliente !== 'todos' || 
                                filters.modalidade !== 'todos' || 
                                filters.especialidade !== 'todos' ||
                                filters.prioridade !== 'todos' ||
                                filters.medico !== 'todos' ||
                                filters.ano !== 'todos';

      // Construir query base com apenas os campos necessários para performance
      let query = supabase.from('volumetria_mobilemed').select(`
        EMPRESA, 
        MODALIDADE, 
        ESPECIALIDADE, 
        PRIORIDADE, 
        MEDICO,
        VALORES,
        DATA_LAUDO,
        HORA_LAUDO,
        DATA_PRAZO,
        HORA_PRAZO,
        data_referencia
      `);
      
      // Aplicar filtros de data
      const { startDate, endDate } = buildDateFilter();
      if (startDate && endDate) {
        query = query.gte('data_referencia', startDate).lte('data_referencia', endDate);
      }

      // Aplicar filtros específicos
      if (filters.cliente !== 'todos') {
        query = query.eq('EMPRESA', filters.cliente);
      }
      
      if (filters.modalidade !== 'todos') {
        query = query.eq('MODALIDADE', filters.modalidade);
      }
      
      if (filters.especialidade !== 'todos') {
        query = query.eq('ESPECIALIDADE', filters.especialidade);
      }
      
      if (filters.prioridade !== 'todos') {
        query = query.eq('PRIORIDADE', filters.prioridade);
      }
      
      if (filters.medico !== 'todos') {
        query = query.eq('MEDICO', filters.medico);
      }

      // Carregar todos os dados em batches para evitar limite do Supabase
      let allData: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMoreData = true;
      
      console.log('🔄 Carregando todos os dados disponíveis...');
      
      while (hasMoreData) {
        const { data: batchData, error } = await query
          .range(offset, offset + limit - 1)
          .order('data_referencia', { ascending: false });

        if (error) {
          console.error('❌ Erro ao buscar dados:', error);
          throw error;
        }

        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        allData = [...allData, ...batchData];
        console.log(`📦 Lote ${Math.floor(offset/limit) + 1}: ${batchData.length} registros (total: ${allData.length})`);

        if (batchData.length < limit) {
          hasMoreData = false;
        } else {
          offset += limit;
        }

        // Limite de segurança para evitar loop infinito
        if (allData.length > 100000) {
          console.log('⚠️ Limite de segurança atingido (100k registros)');
          hasMoreData = false;
        }
      }

      if (!allData || allData.length === 0) {
        console.log('🏁 Nenhum registro encontrado');
        setData({
          stats: {
            total_exames: 0,
            total_registros: 0,
            total_atrasados: 0,
            percentual_atraso: 0,
            total_clientes: 0,
            total_modalidades: 0,
            total_especialidades: 0,
            total_medicos: 0,
            registros_30_dias: 0,
            registros_7_dias: 0,
            registros_ontem: 0,
            registros_hoje: 0
          },
          clientes: [],
          modalidades: [],
          especialidades: []
        });
        return;
      }

      console.log(`✅ Total de registros carregados com filtros: ${allData.length}`);

      // Processar estatísticas
      const totalRegistros = allData.length;
      const totalExames = allData.reduce((sum, item) => {
        const valor = Number(item.VALORES) || 0;
        // Para arquivos "fora padrão", cada registro = 1 exame
        // Para arquivos "padrão", usa o valor do campo VALORES
        if (item.arquivo_fonte && item.arquivo_fonte.includes('fora_padrao') && valor > 0) {
          return sum + 1;
        }
        return sum + valor;
      }, 0);
      const clientesUnicos = new Set(allData.map(item => item.EMPRESA)).size;
      const modalidadesUnicas = new Set(allData.map(item => item.MODALIDADE).filter(Boolean)).size;
      const especialidadesUnicas = new Set(allData.map(item => item.ESPECIALIDADE).filter(Boolean)).size;
      const medicosUnicos = new Set(allData.map(item => item.MEDICO).filter(Boolean)).size;

      // Calcular atrasos
      const atrasados = allData.filter(item => {
        if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) {
          return false;
        }
        try {
          const dataHoraLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataHoraPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          return dataHoraLaudo > dataHoraPrazo;
        } catch {
          return false;
        }
      });

      const totalAtrasados = atrasados.length;
      const percentualAtraso = totalRegistros > 0 ? (totalAtrasados / totalRegistros) * 100 : 0;

      // Calcular dados dos últimos períodos
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const today = new Date();

      const registros30Dias = allData.filter(item => 
        item.data_referencia && new Date(item.data_referencia) >= thirtyDaysAgo
      ).length;

      const registros7Dias = allData.filter(item => 
        item.data_referencia && new Date(item.data_referencia) >= sevenDaysAgo
      ).length;

      const registrosOntem = allData.filter(item => 
        item.data_referencia === yesterday.toISOString().split('T')[0]
      ).length;

      const registrosHoje = allData.filter(item => 
        item.data_referencia === today.toISOString().split('T')[0]
      ).length;

      const stats: DashboardStats = {
        total_exames: totalExames,
        total_registros: totalRegistros,
        total_atrasados: totalAtrasados,
        percentual_atraso: percentualAtraso,
        total_clientes: clientesUnicos,
        total_modalidades: modalidadesUnicas,
        total_especialidades: especialidadesUnicas,
        total_medicos: medicosUnicos,
        registros_30_dias: registros30Dias,
        registros_7_dias: registros7Dias,
        registros_ontem: registrosOntem,
        registros_hoje: registrosHoje
      };

      // Processar dados agregados por cliente
      const clienteMap = new Map<string, { total_exames: number; total_registros: number; atrasados: number }>();
      allData.forEach(item => {
        const cliente = item.EMPRESA || 'Não Informado';
        const valor = Number(item.VALORES) || 0;
        // Para arquivos "fora padrão", cada registro = 1 exame
        const exames = (item.arquivo_fonte && item.arquivo_fonte.includes('fora_padrao') && valor > 0) ? 1 : valor;
        const isAtrasado = atrasados.some(atrasado => atrasado === item);
        
        if (!clienteMap.has(cliente)) {
          clienteMap.set(cliente, { total_exames: 0, total_registros: 0, atrasados: 0 });
        }
        
        const dados = clienteMap.get(cliente)!;
        dados.total_exames += exames;
        dados.total_registros += 1;
        if (isAtrasado) dados.atrasados += 1;
      });

      const clientesData: ClienteData[] = Array.from(clienteMap.entries())
        .map(([nome, dados]) => ({
          nome,
          total_exames: dados.total_exames,
          total_registros: dados.total_registros,
          atrasados: dados.atrasados,
          percentual_atraso: dados.total_registros > 0 ? (dados.atrasados / dados.total_registros) * 100 : 0
        }))
        .sort((a, b) => b.total_exames - a.total_exames)
        .slice(0, 10);

      // Processar dados agregados por modalidade
      const modalidadeMap = new Map<string, { total_exames: number; total_registros: number }>();
      allData.forEach(item => {
        const modalidade = item.MODALIDADE || 'Não Informado';
        const valor = Number(item.VALORES) || 0;
        // Para arquivos "fora padrão", cada registro = 1 exame
        const exames = (item.arquivo_fonte && item.arquivo_fonte.includes('fora_padrao') && valor > 0) ? 1 : valor;
        
        if (!modalidadeMap.has(modalidade)) {
          modalidadeMap.set(modalidade, { total_exames: 0, total_registros: 0 });
        }
        
        const dados = modalidadeMap.get(modalidade)!;
        dados.total_exames += exames;
        dados.total_registros += 1;
      });

      const modalidadesData: ModalidadeData[] = Array.from(modalidadeMap.entries())
        .map(([nome, dados]) => ({
          nome,
          total_exames: dados.total_exames,
          total_registros: dados.total_registros,
          percentual: totalExames > 0 ? (dados.total_exames / totalExames) * 100 : 0
        }))
        .sort((a, b) => b.total_exames - a.total_exames);

      // Processar dados agregados por especialidade
      const especialidadeMap = new Map<string, { total_exames: number; total_registros: number }>();
      allData.forEach(item => {
        const especialidade = item.ESPECIALIDADE || 'Não Informado';
        const valor = Number(item.VALORES) || 0;
        // Para arquivos "fora padrão", cada registro = 1 exame
        const exames = (item.arquivo_fonte && item.arquivo_fonte.includes('fora_padrao') && valor > 0) ? 1 : valor;
        
        if (!especialidadeMap.has(especialidade)) {
          especialidadeMap.set(especialidade, { total_exames: 0, total_registros: 0 });
        }
        
        const dados = especialidadeMap.get(especialidade)!;
        dados.total_exames += exames;
        dados.total_registros += 1;
      });

      const especialidadesData: EspecialidadeData[] = Array.from(especialidadeMap.entries())
        .map(([nome, dados]) => ({
          nome,
          total_exames: dados.total_exames,
          total_registros: dados.total_registros,
          percentual: totalExames > 0 ? (dados.total_exames / totalExames) * 100 : 0
        }))
        .sort((a, b) => b.total_exames - a.total_exames);

      setData({
        stats,
        clientes: clientesData,
        modalidades: modalidadesData,
        especialidades: especialidadesData
      });

    } catch (error) {
      console.error('❌ Erro no carregamento dos dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da volumetria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, buildDateFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...data,
    loading,
    refreshData: loadData
  };
}