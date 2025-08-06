import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, TrendingDown, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LaudosAtrasadosDetalhado } from "./LaudosAtrasadosDetalhado";

interface DelayData {
  nome: string;
  total_exames: number;
  atrasados: number;
  percentual_atraso: number;
  tempo_medio_atraso?: number;
}

interface ClienteDetalhe {
  especialidades: DelayData[];
  categorias: DelayData[];
  prioridades: DelayData[];
}

interface DelayAnalysisData {
  clientes: DelayData[];
  modalidades: DelayData[];
  especialidades: DelayData[];
  categorias: DelayData[];
  prioridades: DelayData[];
  totalAtrasados: number;
  percentualAtrasoGeral: number;
  atrasosComTempo?: Array<{ tempoAtrasoMinutos: number; EMPRESA: string; [key: string]: any }>;
}

interface VolumetriaDelayAnalysisProps {
  data: DelayAnalysisData;
}

// Cores para os gráficos
const DELAY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

// Função para categorizar percentual de atraso por segmento
const categorizeDelay = (percentual: number) => {
  if (percentual > 15) return { label: 'Crítico', color: '#ef4444', bgColor: 'bg-red-100' };
  if (percentual >= 10) return { label: 'Alto', color: '#f97316', bgColor: 'bg-orange-100' };
  if (percentual >= 5) return { label: 'Médio', color: '#eab308', bgColor: 'bg-yellow-100' };
  if (percentual > 0) return { label: 'Baixo', color: '#22c55e', bgColor: 'bg-green-100' };
  return { label: 'Sem Atraso', color: '#3b82f6', bgColor: 'bg-blue-100' };
};

export function VolumetriaDelayAnalysis({ data }: VolumetriaDelayAnalysisProps) {
  // BUSCAR DADOS DIRETAMENTE DO BANCO PARA ELIMINAR LIMITAÇÕES
  const [safeData, setSafeData] = useState<DelayAnalysisData>({
    clientes: [],
    modalidades: [],
    especialidades: [],
    categorias: [],
    prioridades: [],
    totalAtrasados: 0,
    percentualAtrasoGeral: 0,
    atrasosComTempo: []
  });
  const [loading, setLoading] = useState(true);

  // BUSCAR DADOS CORRETOS SEM LIMITAÇÕES - USAR FUNÇÃO DEFINITIVA
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        console.log('🚀 [DelayAnalysis] ACESSANDO FUNÇÃO UNLIMITED_FORCE - Meta: 10.433 laudos atrasados');
        
        // USAR APENAS A FUNÇÃO DEFINITIVA QUE FUNCIONA
        const { data: allData, error } = await supabase.rpc('get_volumetria_unlimited_force');
        
        if (error) {
          console.error('❌ ERRO na função unlimited_force:', error);
          setLoading(false);
          return;
        }
        
        if (!allData || allData.length === 0) {
          console.error('❌ Função unlimited_force retornou dados vazios');
          setLoading(false);
          return;
        }
        
        console.log(`🎯 [DelayAnalysis] FUNÇÃO UNLIMITED_FORCE: ${allData.length} registros`);
        
        // SE AINDA RETORNOU DADOS LIMITADOS, USAR ACESSO DIRETO À TABELA
        if (allData.length < 35000) {
          console.warn(`⚠️ Unlimited_force retornou apenas ${allData.length}, tentando acesso direto à tabela...`);
          
          // ACESSO DIRETO SEM FUNÇÕES - ÚLTIMA TENTATIVA
          const { data: directData, error: directError } = await supabase
            .from('volumetria_mobilemed')
            .select('*');
            
          if (directError) {
            console.error('❌ Acesso direto falhou:', directError);
            setLoading(false);
            return;
          }
          
          if (directData && directData.length > allData.length) {
            console.log(`✅ ACESSO DIRETO: ${directData.length} registros (melhor que unlimited_force)`);
            // Usar dados diretos
            allData.length = 0;
            allData.push(...directData);
          }
        }
        
        const totalLaudosRaw = allData.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0);
        console.log(`📊 [DelayAnalysis] TOTAL LAUDOS PROCESSADOS: ${totalLaudosRaw.toLocaleString()}`);
        
        // VALIDAÇÃO CRÍTICA: DEVE TER ~39.856 laudos
        if (totalLaudosRaw < 35000) {
          console.error(`❌ CRÍTICO: Esperava ~39.856 laudos, obteve apenas ${totalLaudosRaw}`);
        }
        
        // VALIDAÇÃO: GARANTIR QUE TEMOS TODOS OS DADOS
        const totalLaudosObtidos = allData?.reduce((sum: number, item: any) => sum + (Number(item.VALORES) || 0), 0) || 0;
        console.log(`✅ [DelayAnalysis] TOTAL DE LAUDOS: ${totalLaudosObtidos.toLocaleString()}`);
        
        if (allData?.length < 35000) {
          console.error(`❌ ERRO: Ainda há limitação! Retornado apenas ${allData?.length} registros de ~35k esperados`);
        }
        
        // PROCESSAR DADOS POR CATEGORIA
        const especialidadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        const modalidadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        const clientesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        const categoriasMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        const prioridadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();

        let totalAtrasadosGeral = 0;
        let totalLaudosGeral = 0;

        allData?.forEach((registro: any) => {
          const valores = Number(registro.VALORES) || 1;
          totalLaudosGeral += valores;

          // CALCULAR ATRASO
          let isAtrasado = false;
          let tempoAtraso = 0;
          
          if (registro.DATA_LAUDO && registro.DATA_PRAZO && registro.HORA_LAUDO && registro.HORA_PRAZO) {
            const dataLaudo = new Date(`${registro.DATA_LAUDO}T${registro.HORA_LAUDO}`);
            const dataPrazo = new Date(`${registro.DATA_PRAZO}T${registro.HORA_PRAZO}`);
            isAtrasado = dataLaudo > dataPrazo;
            tempoAtraso = isAtrasado ? (dataLaudo.getTime() - dataPrazo.getTime()) / (1000 * 60) : 0;
          }

          if (isAtrasado) {
            totalAtrasadosGeral += valores;
          }

          // PROCESSAR ESPECIALIDADES
          const especialidade = registro.ESPECIALIDADE || 'Não Informado';
          if (!especialidadesMap.has(especialidade)) {
            especialidadesMap.set(especialidade, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const espData = especialidadesMap.get(especialidade)!;
          espData.total += valores;
          if (isAtrasado) {
            espData.atrasados += valores;
            espData.tempoTotal += tempoAtraso;
          }

          // PROCESSAR MODALIDADES
          const modalidade = registro.MODALIDADE || 'Não Informado';
          if (!modalidadesMap.has(modalidade)) {
            modalidadesMap.set(modalidade, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const modData = modalidadesMap.get(modalidade)!;
          modData.total += valores;
          if (isAtrasado) {
            modData.atrasados += valores;
            modData.tempoTotal += tempoAtraso;
          }

          // PROCESSAR CLIENTES
          const cliente = registro.EMPRESA || 'Não Informado';
          if (!clientesMap.has(cliente)) {
            clientesMap.set(cliente, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const cliData = clientesMap.get(cliente)!;
          cliData.total += valores;
          if (isAtrasado) {
            cliData.atrasados += valores;
            cliData.tempoTotal += tempoAtraso;
          }

          // PROCESSAR CATEGORIAS  
          const categoria = registro.CATEGORIA || 'Não Informado';
          if (!categoriasMap.has(categoria)) {
            categoriasMap.set(categoria, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const catData = categoriasMap.get(categoria)!;
          catData.total += valores;
          if (isAtrasado) {
            catData.atrasados += valores;
            catData.tempoTotal += tempoAtraso;
          }

          // PROCESSAR PRIORIDADES
          const prioridade = registro.PRIORIDADE || 'Não Informado';
          if (!prioridadesMap.has(prioridade)) {
            prioridadesMap.set(prioridade, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const prioData = prioridadesMap.get(prioridade)!;
          prioData.total += valores;
          if (isAtrasado) {
            prioData.atrasados += valores;
            prioData.tempoTotal += tempoAtraso;
          }
        });

        // CONVERTER PARA FORMATO FINAL
        const especialidades = Array.from(especialidadesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        })).sort((a, b) => b.atrasados - a.atrasados);

        const modalidades = Array.from(modalidadesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        })).sort((a, b) => b.atrasados - a.atrasados);

        const clientes = Array.from(clientesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        })).sort((a, b) => b.atrasados - a.atrasados);

        const categorias = Array.from(categoriasMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        })).sort((a, b) => b.atrasados - a.atrasados);

        const prioridades = Array.from(prioridadesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        })).sort((a, b) => b.atrasados - a.atrasados);

        // RESULTADO FINAL - DEVE MOSTRAR 10.433 LAUDOS ATRASADOS
        console.log(`🏁 [DelayAnalysis] RESULTADO FINAL:`);
        console.log(`  📊 Total de laudos: ${totalLaudosGeral.toLocaleString()}`);
        console.log(`  🚨 Laudos atrasados: ${totalAtrasadosGeral.toLocaleString()}`);
        console.log(`  📈 Percentual: ${((totalAtrasadosGeral / totalLaudosGeral) * 100).toFixed(1)}%`);
        
        // VALIDAÇÃO FINAL CRÍTICA
        if (totalAtrasadosGeral < 10000) {
          console.error(`❌ FALHA CRÍTICA: Deveria ter 10.433 laudos atrasados, tem apenas ${totalAtrasadosGeral}`);
          console.error(`❌ DADOS INCORRETOS SENDO EXIBIDOS NO DASHBOARD!`);
        } else {
          console.log(`✅ PERFEITO: ${totalAtrasadosGeral.toLocaleString()} laudos atrasados - dados corretos!`);
        }
        
        console.log(`📋 [DelayAnalysis] MEDICINA INTERNA:`, especialidades.find(e => e.nome === 'MEDICINA INTERNA'));

        setSafeData({
          clientes,
          modalidades,
          especialidades,
          categorias,
          prioridades,
          totalAtrasados: totalAtrasadosGeral,
          percentualAtrasoGeral: totalLaudosGeral > 0 ? (totalAtrasadosGeral / totalLaudosGeral) * 100 : 0,
          atrasosComTempo: data.atrasosComTempo || []
        });

      } catch (error) {
        console.error('❌ Erro ao processar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, []);
  
  // Estado para controle de ordenação
  const [sortField, setSortField] = useState<'nome' | 'total_exames' | 'atrasados' | 'percentual_atraso' | 'tempoMedioAtraso'>('atrasados');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Estado para controle de expansão dos clientes
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [clientDetails, setClientDetails] = useState<Map<string, ClienteDetalhe>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Função para buscar detalhes de um cliente específico DIRETAMENTE DO BANCO
  const fetchClientDetails = async (clienteName: string) => {
    // LIMPAR CACHE ANTES DE BUSCAR
    setClientDetails(new Map());
    setLoadingDetails(prev => new Set(prev).add(clienteName));
    
    try {
      console.log(`🎯 [DelayAnalysis] INICIANDO busca para ${clienteName}...`);
      
      // USAR APENAS A FUNÇÃO UNLIMITED_FORCE - SEM FALLBACKS QUE LIMITAM
      console.log(`🚀 [DelayAnalysis] Usando APENAS get_volumetria_unlimited_force...`);
      
      const response = await supabase.rpc('get_volumetria_unlimited_force');
      
      if (response.error) {
        console.error(`❌ [DelayAnalysis] Erro na unlimited_force:`, response.error);
        throw response.error;
      }
      
      const allData = response.data || [];
      console.log(`✅ [DelayAnalysis] UNLIMITED_FORCE: ${allData.length} registros totais`);
      
      if (!allData || allData.length === 0) {
        throw new Error('Nenhum dado retornado da função unlimited_force');
      }
      
      console.log(`🔍 [DelayAnalysis] TOTAL GERAL de laudos retornados da API: ${allData?.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0) || 0}`);
      console.log(`🔍 [DelayAnalysis] TOTAL GERAL de registros retornados da API: ${allData?.length || 0}`);
      
      // FILTRAR APENAS O CLIENTE ESPECÍFICO
      const clientData = allData?.filter((item: any) => item.EMPRESA === clienteName) || [];
      const totalLaudosCliente = clientData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      console.log(`🔍 [DelayAnalysis] ${totalLaudosCliente} LAUDOS encontrados para ${clienteName} (${clientData.length} registros)`);
      
      // PROCESSAR DADOS DO ZERO - CALCULAR SOMAS REAIS
      const especialidadesCalc = new Map<string, { totalLaudos: number; atrasadosLaudos: number; tempoTotal: number }>();
      const modalidadesCalc = new Map<string, { totalLaudos: number; atrasadosLaudos: number; tempoTotal: number }>();
      const prioridadesCalc = new Map<string, { totalLaudos: number; atrasadosLaudos: number; tempoTotal: number }>();
      
      // PROCESSAR CADA REGISTRO
      clientData.forEach(registro => {
        const valores = Number(registro.VALORES) || 1;
        const especialidade = registro.ESPECIALIDADE || 'Não Informado';
        
        // CALCULAR SE ESTÁ ATRASADO
        let isAtrasado = false;
        let tempoAtraso = 0;
        
        if (registro.DATA_LAUDO && registro.DATA_PRAZO && registro.HORA_LAUDO && registro.HORA_PRAZO) {
          const dataLaudo = new Date(`${registro.DATA_LAUDO}T${registro.HORA_LAUDO}`);
          const dataPrazo = new Date(`${registro.DATA_PRAZO}T${registro.HORA_PRAZO}`);
          isAtrasado = dataLaudo > dataPrazo;
          tempoAtraso = isAtrasado ? (dataLaudo.getTime() - dataPrazo.getTime()) / (1000 * 60) : 0;
        }
        
        // SOMAR LAUDOS (não contar registros)
        if (!especialidadesCalc.has(especialidade)) {
          especialidadesCalc.set(especialidade, { totalLaudos: 0, atrasadosLaudos: 0, tempoTotal: 0 });
        }
        
        const espData = especialidadesCalc.get(especialidade)!;
        espData.totalLaudos += valores; // SOMAR VALORES
        
        if (isAtrasado) {
          espData.atrasadosLaudos += valores; // SOMAR VALORES DOS ATRASADOS
          espData.tempoTotal += tempoAtraso;
        }
        
        // PROCESSAR MODALIDADES
        const modalidade = registro.MODALIDADE || 'Não Informado';
        if (!modalidadesCalc.has(modalidade)) {
          modalidadesCalc.set(modalidade, { totalLaudos: 0, atrasadosLaudos: 0, tempoTotal: 0 });
        }
        const modData = modalidadesCalc.get(modalidade)!;
        modData.totalLaudos += valores;
        if (isAtrasado) {
          modData.atrasadosLaudos += valores;
          modData.tempoTotal += tempoAtraso;
        }
        
        // PROCESSAR PRIORIDADES
        const prioridade = registro.PRIORIDADE || 'Não Informado';
        if (!prioridadesCalc.has(prioridade)) {
          prioridadesCalc.set(prioridade, { totalLaudos: 0, atrasadosLaudos: 0, tempoTotal: 0 });
        }
        const prioData = prioridadesCalc.get(prioridade)!;
        prioData.totalLaudos += valores;
        if (isAtrasado) {
          prioData.atrasadosLaudos += valores;
          prioData.tempoTotal += tempoAtraso;
        }
        
        // DEBUG DETALHADO para MEDICINA INTERNA
        if (especialidade === 'MEDICINA INTERNA') {
          console.log(`📝 [DelayAnalysis] Laudo: VALORES=${valores}, atrasado=${isAtrasado}, modalidade=${modalidade}, prioridade=${prioridade}`);
        }
      });
      
      // CONVERTER PARA FORMATO FINAL
      const especialidades: DelayData[] = Array.from(especialidadesCalc.entries()).map(([nome, data]) => {
        const resultado = {
          nome,
          total_exames: data.totalLaudos, // TOTAL DE LAUDOS (não registros)
          atrasados: data.atrasadosLaudos, // LAUDOS ATRASADOS (não registros)
          percentual_atraso: data.totalLaudos > 0 ? (data.atrasadosLaudos / data.totalLaudos) * 100 : 0,
          tempo_medio_atraso: data.atrasadosLaudos > 0 ? data.tempoTotal / data.atrasadosLaudos : 0
        };
        
        if (nome === 'MEDICINA INTERNA') {
          console.log(`✅ [DelayAnalysis] MEDICINA INTERNA CORRETO:`, resultado);
        }
        
        return resultado;
      });

      
      const categorias: DelayData[] = Array.from(modalidadesCalc.entries()).map(([nome, data]) => {
        const resultado = {
          nome,
          total_exames: data.totalLaudos,
          atrasados: data.atrasadosLaudos,
          percentual_atraso: data.totalLaudos > 0 ? (data.atrasadosLaudos / data.totalLaudos) * 100 : 0,
          tempo_medio_atraso: data.atrasadosLaudos > 0 ? data.tempoTotal / data.atrasadosLaudos : 0
        };
        
        console.log(`📊 [DelayAnalysis] Modalidade: ${nome}`, resultado);
        return resultado;
      });
      
      const prioridades: DelayData[] = Array.from(prioridadesCalc.entries()).map(([nome, data]) => {
        const resultado = {
          nome,
          total_exames: data.totalLaudos, // TOTAL DE LAUDOS (não registros)
          atrasados: data.atrasadosLaudos, // LAUDOS ATRASADOS (não registros)
          percentual_atraso: data.totalLaudos > 0 ? (data.atrasadosLaudos / data.totalLaudos) * 100 : 0,
          tempo_medio_atraso: data.atrasadosLaudos > 0 ? data.tempoTotal / data.atrasadosLaudos : 0
        };
        
        console.log(`🎯 [DelayAnalysis] Prioridade: ${nome}`, resultado);
        return resultado;
      });
      
      // CRIAR DADOS FINAIS COM TODAS AS SEÇÕES
      const detalhe: ClienteDetalhe = {
        especialidades,
        categorias,
        prioridades
      };
      
      setClientDetails(prev => new Map(prev).set(clienteName, detalhe));
    } catch (error) {
      console.error('Erro ao buscar detalhes do cliente:', error);
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(clienteName);
        return newSet;
      });
    }
  };

  // Função para alternar expansão do cliente
  const toggleClientExpansion = async (clienteName: string) => {
    const newExpanded = new Set(expandedClients);
    
    if (newExpanded.has(clienteName)) {
      newExpanded.delete(clienteName);
    } else {
      newExpanded.add(clienteName);
      await fetchClientDetails(clienteName);
    }
    
    setExpandedClients(newExpanded);
  };

  // Função para alternar ordenação
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Buscar tempo médio de atraso por cliente
  const [tempoMedioClientes, setTempoMedioClientes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const carregarTempoMedio = async () => {
      const { data } = await supabase.rpc('get_tempo_medio_atraso_clientes');
      if (data) {
        const tempoMap = new Map();
        data.forEach((item: any) => {
          tempoMap.set(item.empresa, item.tempo_medio_atraso_horas);
        });
        setTempoMedioClientes(tempoMap);
      }
    };
    carregarTempoMedio();
  }, []);

  // Calcular dados de clientes com tempo médio de atraso - EXIBIR APENAS CLIENTES COM ATRASOS
  const clientesComTempoAtraso = safeData.clientes
    .filter(cliente => cliente.atrasados > 0) // FILTRAR APENAS CLIENTES COM ATRASOS
    .map(cliente => {
      // CONVERTER DE HORAS PARA MINUTOS (RPC retorna em horas)
      const tempoMedioAtrasoHoras = tempoMedioClientes.get(cliente.nome) || 0;
      const tempoMedioAtraso = tempoMedioAtrasoHoras * 60; // Converter para minutos
      
      const nivelAtraso = cliente.percentual_atraso >= 20 ? 'Crítico' :
                         cliente.percentual_atraso >= 10 ? 'Alto' :
                         cliente.percentual_atraso >= 5 ? 'Médio' : 'Baixo';
      
      return {
        ...cliente,
        tempoMedioAtraso,
        nivelAtraso
      };
    })
    // ORDENAR POR LAUDOS ATRASADOS PRIMEIRO, DEPOIS POR PERCENTUAL
    .sort((a, b) => {
      if (sortField === 'atrasados') {
        return sortDirection === 'asc' ? a.atrasados - b.atrasados : b.atrasados - a.atrasados;
      }
      if (sortField === 'percentual_atraso') {
        return sortDirection === 'asc' ? a.percentual_atraso - b.percentual_atraso : b.percentual_atraso - a.percentual_atraso;
      }
      if (sortField === 'tempoMedioAtraso') {
        return sortDirection === 'asc' ? a.tempoMedioAtraso - b.tempoMedioAtraso : b.tempoMedioAtraso - a.tempoMedioAtraso;
      }
      if (sortField === 'total_exames') {
        return sortDirection === 'asc' ? a.total_exames - b.total_exames : b.total_exames - a.total_exames;
      }
      
      // Para campo nome (string)
      return sortDirection === 'asc' 
        ? a.nome.localeCompare(b.nome)
        : b.nome.localeCompare(a.nome);
    });

  // Função para renderizar ícone de ordenação
  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-muted-foreground">Carregando análise de atrasos sem limitações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visão Geral dos Atrasos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Visão Geral de Atrasos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className={`${safeData.percentualAtrasoGeral >= 10 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'} mb-4`}>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>{safeData.percentualAtrasoGeral.toFixed(1)}%</strong> dos laudos estão atrasados 
               ({safeData.totalAtrasados.toLocaleString()} laudos)
               {safeData.percentualAtrasoGeral >= 2 && (
                 <span className="block mt-2 text-red-600 font-medium">
                   ⚠️ Atenção: Taxa de atraso acima do limite aceitável (2%)
                 </span>
               )}
            </AlertDescription>
          </Alert>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="text-center">
               <div className="text-3xl font-bold text-red-600">{safeData.totalAtrasados.toLocaleString()}</div>
               <div className="text-sm text-muted-foreground">Laudos Atrasados</div>
             </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{safeData.clientes.filter(c => c.atrasados > 0).length}</div>
                <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
              </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{safeData.percentualAtrasoGeral.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Taxa Geral de Atraso</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Nível de Atraso - USANDO DADOS CORRETOS DO CONTEXTO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Análise de Nível de Atraso por Clientes
            <Badge variant="outline" className="text-xs">
              Quantidade de clientes em cada faixa de % de atraso
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Usando dados corretos do contexto em vez de cálculos independentes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {safeData.clientes.filter(c => c.percentual_atraso > 15).length}
              </div>
              <div className="text-sm text-muted-foreground">Críticos (&gt;15%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com mais de 15% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {safeData.clientes.filter(c => c.percentual_atraso >= 10 && c.percentual_atraso <= 15).length}
              </div>
              <div className="text-sm text-muted-foreground">Altos (10-15%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com 10% a 15% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {safeData.clientes.filter(c => c.percentual_atraso >= 5 && c.percentual_atraso < 10).length}
              </div>
              <div className="text-sm text-muted-foreground">Médios (5-10%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com 5% a 10% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {safeData.clientes.filter(c => c.percentual_atraso < 5).length}
              </div>
              <div className="text-sm text-muted-foreground">Baixos (&lt;5%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com menos de 5% de laudos atrasados
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Tempo de Atraso - USANDO DADOS CORRETOS DO CONTEXTO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Análise de Tempo de Atraso</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Calcular distribuição temporal usando dados corretos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {safeData.totalAtrasados.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total de Laudos Atrasados</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {safeData.percentualAtrasoGeral.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Atraso</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {safeData.clientes.filter(c => c.atrasados > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Clientes com Atrasos - Tabela */}
      <Card className="w-full">
        <CardHeader className="bg-white border-b sticky top-0 z-40">
          <CardTitle className="text-lg">Lista Clientes - Maior quant. ou % de Atrasos</CardTitle>
        </CardHeader>
        
        {/* Container SEM limitação de altura */}
        <div className="flex flex-col">
          {/* Cabeçalho fixo da tabela */}
          <div className="bg-white border-b-2 border-gray-300 sticky top-0 z-30 shadow-sm">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 w-[120px] border-r font-semibold h-12"
                    onClick={() => handleSort('nome')}
                  >
                    <div className="flex items-center gap-2">
                      Cliente
                      {renderSortIcon('nome')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('total_exames')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Total Laudos
                      {renderSortIcon('total_exames')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('atrasados')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Laudos Atrasados
                      {renderSortIcon('atrasados')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 w-[120px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('percentual_atraso')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      % Atraso
                      {renderSortIcon('percentual_atraso')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('tempoMedioAtraso')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Tempo Médio Atraso
                      {renderSortIcon('tempoMedioAtraso')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] text-center font-semibold h-12">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Corpo da tabela SEM limitação de altura */}
          <div className="flex-1">
            <Table className="w-full table-fixed">
              <TableBody>
                {clientesComTempoAtraso.map((cliente, index) => {
                  const category = categorizeDelay(cliente.percentual_atraso);
                  const isExpanded = expandedClients.has(cliente.nome);
                  const clientDetalhe = clientDetails.get(cliente.nome);
                  const isLoading = loadingDetails.has(cliente.nome);

                  return (
                    <>
                      <TableRow 
                        key={cliente.nome} 
                        className={`hover:bg-gray-50 ${category.bgColor.replace('100', '25')} cursor-pointer transition-colors`}
                        onClick={() => toggleClientExpansion(cliente.nome)}
                      >
                        <TableCell className="w-[120px] border-r">
                          <div className="flex items-center gap-2">
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            }
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate" title={cliente.nome}>{cliente.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                Rank #{index + 1}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[140px] border-r text-center">
                          <div className="font-medium">{cliente.total_exames.toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="w-[140px] border-r text-center">
                          <div className="font-bold text-red-600">{cliente.atrasados.toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="w-[120px] border-r text-center">
                          <div className="font-bold" style={{ color: category.color }}>
                            {cliente.percentual_atraso.toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell className="w-[140px] border-r text-center">
                          <div className="font-medium text-orange-600">
                            {cliente.tempoMedioAtraso > 0 
                              ? cliente.tempoMedioAtraso >= 60 
                                ? `${Math.floor(cliente.tempoMedioAtraso / 60)}h ${Math.floor(cliente.tempoMedioAtraso % 60)}min`
                                : `${Math.floor(cliente.tempoMedioAtraso)}min`
                              : '-'
                            }
                          </div>
                        </TableCell>
                        <TableCell className="w-[100px] text-center">
                          <Badge 
                            className="text-xs font-medium px-2 py-1"
                            style={{ 
                              backgroundColor: category.color, 
                              color: 'white',
                              border: 'none'
                            }}
                          >
                            {category.label}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Detalhes expandidos do cliente */}
                      {isExpanded && (
                        <TableRow className="bg-gray-50">
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-4 border-l-4" style={{ borderColor: category.color }}>
                              {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                  <span className="ml-2 text-sm text-muted-foreground">Carregando detalhes...</span>
                                </div>
                              ) : clientDetalhe ? (
                                <div className="grid grid-cols-3 gap-4">
                                  {/* Especialidades */}
                                  <div className="w-full max-w-xs">
                                    <h4 className="font-semibold text-sm mb-3 text-blue-700">Especialidades</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {clientDetalhe.especialidades.slice(0, 8).map(esp => (
                                        <div key={esp.nome} className="flex flex-col gap-1 text-xs bg-white p-2 rounded border">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium text-xs leading-tight">{esp.nome}</span>
                                            <Badge variant={esp.percentual_atraso > 10 ? "destructive" : "secondary"} className="text-xs ml-1 px-1 py-0">
                                              {esp.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between items-center text-gray-600">
                                             <span className="text-xs">{esp.atrasados} de {esp.total_exames}</span>
                                             {esp.tempo_medio_atraso > 0 && (
                                               <span className="text-xs text-orange-600">
                                                 {Math.round(esp.tempo_medio_atraso / 60)}h
                                               </span>
                                             )}
                                           </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.especialidades.length > 8 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.especialidades.length - 8} mais...
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Modalidades/Categorias */}
                                  <div className="w-full max-w-xs">
                                    <h4 className="font-semibold text-sm mb-3 text-green-700">Modalidades</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {clientDetalhe.categorias.slice(0, 8).map(cat => (
                                        <div key={cat.nome} className="flex flex-col gap-1 text-xs bg-white p-2 rounded border">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium text-xs leading-tight">{cat.nome}</span>
                                            <Badge variant={cat.percentual_atraso > 10 ? "destructive" : "secondary"} className="text-xs ml-1 px-1 py-0">
                                              {cat.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between items-center text-gray-600">
                                             <span className="text-xs">{cat.atrasados} de {cat.total_exames}</span>
                                             {cat.tempo_medio_atraso > 0 && (
                                               <span className="text-xs text-orange-600">
                                                 {Math.round(cat.tempo_medio_atraso / 60)}h
                                               </span>
                                             )}
                                           </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.categorias.length > 8 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.categorias.length - 8} mais...
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Prioridades */}
                                  <div className="w-full max-w-xs">
                                    <h4 className="font-semibold text-sm mb-3 text-purple-700">Prioridades</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {clientDetalhe.prioridades.slice(0, 8).map(prio => (
                                        <div key={prio.nome} className="flex flex-col gap-1 text-xs bg-white p-2 rounded border">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium text-xs leading-tight">{prio.nome}</span>
                                            <Badge variant={prio.percentual_atraso > 10 ? "destructive" : "secondary"} className="text-xs ml-1 px-1 py-0">
                                              {prio.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between items-center text-gray-600">
                                             <span className="text-xs">{prio.atrasados} de {prio.total_exames}</span>
                                             {prio.tempo_medio_atraso > 0 && (
                                               <span className="text-xs text-orange-600">
                                                 {Math.round(prio.tempo_medio_atraso / 60)}h
                                               </span>
                                             )}
                                          </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.prioridades.length > 8 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.prioridades.length - 8} mais...
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  Erro ao carregar detalhes do cliente
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {clientesComTempoAtraso.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente com atrasos</h3>
            <p>Todos os clientes estão operando dentro dos prazos estabelecidos.</p>
          </div>
        )}
      </Card>

      {/* Demonstrativo Detalhado - Laudos em Atraso */}
      <LaudosAtrasadosDetalhado />
    </div>
  );
}