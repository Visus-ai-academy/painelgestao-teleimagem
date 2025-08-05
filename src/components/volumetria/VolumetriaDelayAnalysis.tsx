import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, TrendingDown, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { useVolumetriaProcessedData } from "@/hooks/useVolumetriaProcessedData";
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
  // USAR DADOS PROCESSADOS CORRETOS - FONTE ÚNICA
  const { data: volumetriaData } = useVolumetria();
  const processedData = useVolumetriaProcessedData();
  
  // USAR DADOS PROCESSADOS CORRETOS EM VEZ DE PROPS (com conversão de tipos)
  const safeData = {
    clientes: processedData.clientes.map(c => ({
      nome: c.nome,
      total_exames: c.total_exames,
      atrasados: c.atrasados,
      percentual_atraso: c.percentual_atraso,
      tempo_medio_atraso: 0
    })) as DelayData[],
    modalidades: processedData.modalidades.map(m => ({
      nome: m.nome,
      total_exames: m.total_exames,
      atrasados: m.atrasados || 0,
      percentual_atraso: m.percentual_atraso || 0,
      tempo_medio_atraso: 0
    })) as DelayData[],
    especialidades: processedData.especialidades.map(e => ({
      nome: e.nome,
      total_exames: e.total_exames,
      atrasados: e.atrasados || 0,
      percentual_atraso: e.percentual_atraso || 0,
      tempo_medio_atraso: 0
    })) as DelayData[],
    categorias: processedData.categorias.map(c => ({
      nome: c.nome,
      total_exames: c.total_exames,
      atrasados: 0,
      percentual_atraso: 0,
      tempo_medio_atraso: 0
    })) as DelayData[],
    prioridades: processedData.prioridades.map(p => ({
      nome: p.nome,
      total_exames: p.total_exames,
      atrasados: 0,
      percentual_atraso: 0,
      tempo_medio_atraso: 0
    })) as DelayData[],
    totalAtrasados: volumetriaData.dashboardStats.total_atrasados || 0,
    percentualAtrasoGeral: volumetriaData.dashboardStats.percentual_atraso || 0,
    atrasosComTempo: data.atrasosComTempo || []
  };
  
  // Estado para controle de ordenação
  const [sortField, setSortField] = useState<'nome' | 'total_exames' | 'atrasados' | 'percentual_atraso' | 'tempoMedioAtraso'>('atrasados');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Estado para controle de expansão dos clientes
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [clientDetails, setClientDetails] = useState<Map<string, ClienteDetalhe>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Função para buscar detalhes de um cliente específico USANDO CONTEXTO
  const fetchClientDetails = async (clienteName: string) => {
    if (clientDetails.has(clienteName) || loadingDetails.has(clienteName)) return;
    
    setLoadingDetails(prev => new Set(prev).add(clienteName));
    
    try {
      // USAR DADOS DO CONTEXTO EM VEZ DE CONSULTA DIRETA
      const clientData = volumetriaData.detailedData.filter(item => item.EMPRESA === clienteName);
      
      console.log(`🎯 [DelayAnalysis] Processando ${clientData.length} registros para cliente ${clienteName}`);

      if (clientData && clientData.length > 0) {
        // Processar especialidades
        const especialidadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        
        // Processar categorias (baseado na modalidade para simplificar)
        const categoriasMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        
        // Processar prioridades (vamos usar uma lógica baseada no tempo de atraso)
        const prioridadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();

        clientData.forEach(row => {
          // Calcular atraso apenas se houver dados válidos
          let isAtrasado = false;
          let tempoAtraso = 0;
          
          if (row.DATA_LAUDO && row.DATA_PRAZO && row.HORA_LAUDO && row.HORA_PRAZO) {
            // Combinar data e hora para comparação precisa
            const dataLaudoCompleta = new Date(`${row.DATA_LAUDO}T${row.HORA_LAUDO}`);
            const dataPrazoCompleta = new Date(`${row.DATA_PRAZO}T${row.HORA_PRAZO}`);
            
            isAtrasado = dataLaudoCompleta > dataPrazoCompleta;
            tempoAtraso = isAtrasado ? (dataLaudoCompleta.getTime() - dataPrazoCompleta.getTime()) / (1000 * 60) : 0;
          }

          // Processar especialidades - INCLUIR TODOS OS REGISTROS
          const esp = row.ESPECIALIDADE || 'Não Informado';
          if (!especialidadesMap.has(esp)) {
            especialidadesMap.set(esp, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const espData = especialidadesMap.get(esp)!;
          espData.total++;
          if (isAtrasado) {
            espData.atrasados++;
            espData.tempoTotal += tempoAtraso;
          }

          // Processar categorias (usando modalidade) - INCLUIR TODOS OS REGISTROS
          const cat = row.MODALIDADE || 'Não Informado';
          if (!categoriasMap.has(cat)) {
            categoriasMap.set(cat, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const catData = categoriasMap.get(cat)!;
          catData.total++;
          if (isAtrasado) {
            catData.atrasados++;
            catData.tempoTotal += tempoAtraso;
          }

          // Processar prioridades - INCLUIR TODOS OS REGISTROS
          const prioridade = row.PRIORIDADE || 'Não Informado';
          
          if (!prioridadesMap.has(prioridade)) {
            prioridadesMap.set(prioridade, { total: 0, atrasados: 0, tempoTotal: 0 });
          }
          const prioData = prioridadesMap.get(prioridade)!;
          prioData.total++;
          if (isAtrasado) {
            prioData.atrasados++;
            prioData.tempoTotal += tempoAtraso;
          }
        });

        // Converter para formato DelayData
        const especialidades: DelayData[] = Array.from(especialidadesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        }));

        const categorias: DelayData[] = Array.from(categoriasMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        }));

        const prioridades: DelayData[] = Array.from(prioridadesMap.entries()).map(([nome, data]) => ({
          nome,
          total_exames: data.total,
          atrasados: data.atrasados,
          percentual_atraso: data.total > 0 ? (data.atrasados / data.total) * 100 : 0,
          tempo_medio_atraso: data.atrasados > 0 ? data.tempoTotal / data.atrasados : 0
        }));

        const detalhe: ClienteDetalhe = {
          especialidades,
          categorias,
          prioridades
        };

        setClientDetails(prev => new Map(prev).set(clienteName, detalhe));
      }
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
          <Alert className={`${volumetriaData.dashboardStats.percentual_atraso >= 10 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'} mb-4`}>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>{volumetriaData.dashboardStats.percentual_atraso.toFixed(1)}%</strong> dos laudos estão atrasados 
               ({volumetriaData.dashboardStats.total_atrasados.toLocaleString()} de {volumetriaData.dashboardStats.total_exames.toLocaleString()} laudos)
               {volumetriaData.dashboardStats.percentual_atraso >= 2 && (
                 <span className="block mt-2 text-red-600 font-medium">
                   ⚠️ Atenção: Taxa de atraso acima do limite aceitável (2%)
                 </span>
               )}
            </AlertDescription>
          </Alert>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="text-center">
               <div className="text-3xl font-bold text-red-600">{volumetriaData.dashboardStats.total_atrasados.toLocaleString()}</div>
               <div className="text-sm text-muted-foreground">Laudos Atrasados</div>
             </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{processedData.clientes.filter(c => c.atrasados > 0).length}</div>
                <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
              </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{volumetriaData.dashboardStats.percentual_atraso.toFixed(1)}%</div>
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
                {processedData.clientes.filter(c => c.percentual_atraso > 15).length}
              </div>
              <div className="text-sm text-muted-foreground">Críticos (&gt;15%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com mais de 15% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {processedData.clientes.filter(c => c.percentual_atraso >= 10 && c.percentual_atraso <= 15).length}
              </div>
              <div className="text-sm text-muted-foreground">Altos (10-15%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com 10% a 15% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {processedData.clientes.filter(c => c.percentual_atraso >= 5 && c.percentual_atraso < 10).length}
              </div>
              <div className="text-sm text-muted-foreground">Médios (5-10%)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clientes com 5% a 10% de laudos atrasados
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {processedData.clientes.filter(c => c.percentual_atraso < 5).length}
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
                {volumetriaData.dashboardStats.total_atrasados.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total de Laudos Atrasados</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {volumetriaData.dashboardStats.percentual_atraso.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Atraso</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {processedData.clientes.filter(c => c.atrasados > 0).length}
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
        
        {/* Container fixo com altura definida e scroll interno */}
        <div className="h-96 flex flex-col">
          {/* Cabeçalho fixo da tabela */}
          <div className="bg-white border-b-2 border-gray-300 sticky top-0 z-30 shadow-sm overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 min-w-[400px] border-r font-semibold h-12"
                    onClick={() => handleSort('nome')}
                  >
                    <div className="flex items-center gap-2">
                      Cliente
                      {renderSortIcon('nome')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 min-w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('total_exames')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Total Laudos
                      {renderSortIcon('total_exames')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 min-w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('atrasados')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Laudos Atrasados
                      {renderSortIcon('atrasados')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 min-w-[120px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('percentual_atraso')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      % Atraso
                      {renderSortIcon('percentual_atraso')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-200 min-w-[140px] border-r text-center font-semibold h-12"
                    onClick={() => handleSort('tempoMedioAtraso')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Tempo Médio Atraso
                      {renderSortIcon('tempoMedioAtraso')}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[100px] text-center font-semibold h-12">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Corpo da tabela com scroll */}
          <div className="flex-1 overflow-y-auto">
            <Table className="w-full">
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
                        <TableCell className="min-w-[400px] border-r">
                          <div className="flex items-center gap-2">
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            }
                            <div>
                              <div className="font-medium text-sm">{cliente.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                Rank #{index + 1}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[140px] border-r text-center">
                          <div className="font-medium">{cliente.total_exames.toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="min-w-[140px] border-r text-center">
                          <div className="font-bold text-red-600">{cliente.atrasados.toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="min-w-[120px] border-r text-center">
                          <div className="font-bold" style={{ color: category.color }}>
                            {cliente.percentual_atraso.toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[140px] border-r text-center">
                          <div className="font-medium text-orange-600">
                            {cliente.tempoMedioAtraso > 0 
                              ? cliente.tempoMedioAtraso >= 60 
                                ? `${Math.floor(cliente.tempoMedioAtraso / 60)}h ${Math.floor(cliente.tempoMedioAtraso % 60)}min`
                                : `${Math.floor(cliente.tempoMedioAtraso)}min`
                              : '-'
                            }
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[100px] text-center">
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
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  {/* Especialidades */}
                                  <div>
                                    <h4 className="font-semibold text-sm mb-3 text-blue-700">Especialidades</h4>
                                    <div className="space-y-2">
                                      {clientDetalhe.especialidades.slice(0, 5).map(esp => (
                                        <div key={esp.nome} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                                          <span className="font-medium truncate flex-1">{esp.nome}</span>
                                          <div className="text-right ml-2">
                                            <div className="font-bold text-red-600">{esp.atrasados}</div>
                                            <div className="text-muted-foreground">{esp.percentual_atraso.toFixed(1)}%</div>
                                          </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.especialidades.length > 5 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.especialidades.length - 5} especialidades...
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Modalidades/Categorias */}
                                  <div>
                                    <h4 className="font-semibold text-sm mb-3 text-green-700">Modalidades</h4>
                                    <div className="space-y-2">
                                      {clientDetalhe.categorias.slice(0, 5).map(cat => (
                                        <div key={cat.nome} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                                          <span className="font-medium truncate flex-1">{cat.nome}</span>
                                          <div className="text-right ml-2">
                                            <div className="font-bold text-red-600">{cat.atrasados}</div>
                                            <div className="text-muted-foreground">{cat.percentual_atraso.toFixed(1)}%</div>
                                          </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.categorias.length > 5 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.categorias.length - 5} modalidades...
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Prioridades */}
                                  <div>
                                    <h4 className="font-semibold text-sm mb-3 text-purple-700">Prioridades</h4>
                                    <div className="space-y-2">
                                      {clientDetalhe.prioridades.slice(0, 5).map(prio => (
                                        <div key={prio.nome} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                                          <span className="font-medium truncate flex-1">{prio.nome}</span>
                                          <div className="text-right ml-2">
                                            <div className="font-bold text-red-600">{prio.atrasados}</div>
                                            <div className="text-muted-foreground">{prio.percentual_atraso.toFixed(1)}%</div>
                                          </div>
                                        </div>
                                      ))}
                                      {clientDetalhe.prioridades.length > 5 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{clientDetalhe.prioridades.length - 5} prioridades...
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