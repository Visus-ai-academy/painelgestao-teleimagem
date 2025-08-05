import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stringParaPeriodo } from '@/lib/periodoUtils';
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  total_exames: number;
  total_registros: number;
  total_atrasados: number;
  percentual_atraso: number;
  total_clientes: number;
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
  listaClientes: string[];
  loading: boolean;
}

export function useVolumetriaData(periodo: string, cliente: string) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VolumetriaData>({
    stats: {
      total_exames: 0,
      total_registros: 0,
      total_atrasados: 0,
      percentual_atraso: 0,
      total_clientes: 0
    },
    clientes: [],
    modalidades: [],
    especialidades: [],
    listaClientes: [],
    loading: true
  });

  const getDateFilter = useCallback(() => {
    if (periodo.match(/^\d{4}-\d{2}$/)) {
      try {
        const periodoObj = stringParaPeriodo(periodo);
        return {
          inicio: periodoObj.inicioPeriodo.toISOString().split('T')[0],
          fim: periodoObj.fimPeriodo.toISOString().split('T')[0]
        };
      } catch (error) {
        console.error('Erro ao processar período de faturamento:', error);
        return null;
      }
    }

    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodo) {
      case "todos":
        return null;
      case "hoje":
        dataInicio = new Date(hoje);
        dataFim = new Date(hoje);
        break;
      case "ultimos_5_dias":
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 4);
        dataFim = new Date(hoje);
        break;
      case "semana_atual":
        const inicioSemana = new Date(hoje);
        const primeiroDiaSemana = hoje.getDate() - hoje.getDay();
        inicioSemana.setDate(primeiroDiaSemana);
        dataInicio = new Date(inicioSemana);
        dataFim = new Date(inicioSemana);
        dataFim.setDate(inicioSemana.getDate() + 6);
        break;
      case "mes_atual":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case "mes_anterior":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case "ano_atual":
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = new Date(hoje.getFullYear(), 11, 31);
        break;
      case "ano_anterior":
        dataInicio = new Date(hoje.getFullYear() - 1, 0, 1);
        dataFim = new Date(hoje.getFullYear() - 1, 11, 31);
        break;
      default:
        return null;
    }

    return {
      inicio: dataInicio.toISOString().split('T')[0],
      fim: dataFim.toISOString().split('T')[0]
    };
  }, [periodo]);

  const loadClientes = useCallback(async () => {
    try {
      console.log('🔍 Carregando TODOS os clientes...');
      
      // Usar múltiplas queries para garantir que todos os dados sejam carregados
      const queries = [];
      let allClientes: string[] = [];
      let offset = 0;
      const limit = 50000; // Aumentado significativamente para processar grandes volumes
      
      while (true) {
        const { data, error } = await supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA')
          .not('EMPRESA', 'is', null)
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('❌ Erro ao carregar clientes:', error);
          break;
        }

        if (!data || data.length === 0) {
          break;
        }

        const clientesBatch = data.map(item => item.EMPRESA).filter(Boolean);
        allClientes = [...allClientes, ...clientesBatch];
        
        console.log(`📦 Carregados ${clientesBatch.length} clientes no lote (offset: ${offset})`);
        
        if (data.length < limit) {
          break;
        }
        
        offset += limit;
      }

      const clientesUnicos = [...new Set(allClientes)].sort();
      console.log(`✅ ${clientesUnicos.length} clientes únicos carregados no total`);
      
      setData(prev => ({ ...prev, listaClientes: clientesUnicos }));
      
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de clientes",
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      console.log('⚡ Carregando dashboard otimizado...');
      
      const dateFilter = getDateFilter();
      console.log('📅 Filtro de data:', dateFilter);
      console.log('👤 Cliente selecionado:', cliente);

      // Carregar todos os dados de forma otimizada em batches
      let allData: any[] = [];
      let offset = 0;
      const limit = 2000;
      let hasMoreData = true;
      
      while (hasMoreData) {
        let query = supabase
          .from('volumetria_mobilemed')
          .select(`
            EMPRESA, 
            MODALIDADE, 
            ESPECIALIDADE, 
            PRIORIDADE, 
            VALORES, 
            DATA_LAUDO, 
            HORA_LAUDO, 
            DATA_PRAZO, 
            HORA_PRAZO,
            data_referencia
          `)
          .range(offset, offset + limit - 1);

        // Aplicar filtros
        if (dateFilter) {
          query = query
            .gte('data_referencia', dateFilter.inicio)
            .lte('data_referencia', dateFilter.fim);
        }

        if (cliente !== "todos") {
          query = query.eq('EMPRESA', cliente);
        }

        const { data: batchData, error } = await query;

        if (error) {
          console.error('❌ Erro na query:', error);
          throw error;
        }

        if (!batchData || batchData.length === 0) {
          break;
        }

        allData = [...allData, ...batchData];
        console.log(`📦 Carregados ${batchData.length} registros no lote (offset: ${offset}), total: ${allData.length}`);
        
        if (batchData.length < limit) {
          hasMoreData = false;
        } else {
          offset += limit;
        }

        // Timeout de segurança para evitar travamento
        if (offset > 500000) {
          console.log('⚠️ Limite de segurança atingido (500k registros) - finalizando...');
          hasMoreData = false;
        }

        // Pequena pausa para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ TOTAL carregado: ${allData.length} registros`);

      if (allData.length === 0) {
        setData(prev => ({
          ...prev,
          stats: {
            total_exames: 0,
            total_registros: 0,
            total_atrasados: 0,
            percentual_atraso: 0,
            total_clientes: 0
          },
          clientes: [],
          modalidades: [],
          especialidades: []
        }));
        return;
      }

      // Calcular estatísticas principais
      const totalExames = allData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      const totalRegistros = allData.length;
      const clientesUnicos = new Set(allData.map(item => item.EMPRESA)).size;

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

      const totalAtrasados = atrasados.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      const percentualAtraso = totalExames > 0 ? (totalAtrasados / totalExames) * 100 : 0;

      console.log(`💰 Total de exames: ${totalExames.toLocaleString()}`);
      console.log(`📋 Total de registros: ${totalRegistros.toLocaleString()}`);
      console.log(`👥 Total de clientes: ${clientesUnicos}`);
      console.log(`⏰ Total atrasados: ${totalAtrasados.toLocaleString()}`);

      // Processar dados por cliente
      const clientesMap = new Map<string, ClienteData>();
      
      allData.forEach(item => {
        const empresa = item.EMPRESA || "Não informado";
        if (!clientesMap.has(empresa)) {
          clientesMap.set(empresa, {
            nome: empresa,
            total_exames: 0,
            total_registros: 0,
            atrasados: 0,
            percentual_atraso: 0
          });
        }
        
        const clienteData = clientesMap.get(empresa)!;
        clienteData.total_exames += Number(item.VALORES) || 0;
        clienteData.total_registros += 1;
        
        // Verificar se está atrasado
        if (atrasados.some(a => 
          a.EMPRESA === item.EMPRESA && 
          a.DATA_LAUDO === item.DATA_LAUDO && 
          a.HORA_LAUDO === item.HORA_LAUDO
        )) {
          clienteData.atrasados += Number(item.VALORES) || 0;
        }
      });

      const clientesArray = Array.from(clientesMap.values()).map(cliente => ({
        ...cliente,
        percentual_atraso: cliente.total_exames > 0 ? (cliente.atrasados / cliente.total_exames) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Processar dados por modalidade
      const modalidadesMap = new Map<string, ModalidadeData>();
      
      allData.forEach(item => {
        const modalidade = item.MODALIDADE || "Não informado";
        if (!modalidadesMap.has(modalidade)) {
          modalidadesMap.set(modalidade, {
            nome: modalidade,
            total_exames: 0,
            total_registros: 0,
            percentual: 0
          });
        }
        
        const modalidadeData = modalidadesMap.get(modalidade)!;
        modalidadeData.total_exames += Number(item.VALORES) || 0;
        modalidadeData.total_registros += 1;
      });

      const modalidadesArray = Array.from(modalidadesMap.values()).map(modalidade => ({
        ...modalidade,
        percentual: totalExames > 0 ? (modalidade.total_exames / totalExames) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      // Processar dados por especialidade
      const especialidadesMap = new Map<string, EspecialidadeData>();
      
      allData.forEach(item => {
        const especialidade = item.ESPECIALIDADE || "Não informado";
        if (!especialidadesMap.has(especialidade)) {
          especialidadesMap.set(especialidade, {
            nome: especialidade,
            total_exames: 0,
            total_registros: 0,
            percentual: 0
          });
        }
        
        const especialidadeData = especialidadesMap.get(especialidade)!;
        especialidadeData.total_exames += Number(item.VALORES) || 0;
        especialidadeData.total_registros += 1;
      });

      const especialidadesArray = Array.from(especialidadesMap.values()).map(especialidade => ({
        ...especialidade,
        percentual: totalExames > 0 ? (especialidade.total_exames / totalExames) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      setData(prev => ({
        ...prev,
        stats: {
          total_exames: totalExames,
          total_registros: totalRegistros,
          total_atrasados: totalAtrasados,
          percentual_atraso: percentualAtraso,
          total_clientes: clientesUnicos
        },
        clientes: clientesArray,
        modalidades: modalidadesArray,
        especialidades: especialidadesArray
      }));

      console.log('✅ Dashboard carregado com TODOS os dados!');
      
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da volumetria.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [periodo, cliente, getDateFilter, toast]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    ...data,
    loading,
    refreshData: () => {
      loadDashboard();
      loadClientes();
    }
  };
}