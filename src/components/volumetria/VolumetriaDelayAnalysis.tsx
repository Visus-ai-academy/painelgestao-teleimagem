import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, TrendingDown, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Função para categorizar tempo de atraso
const categorizeDelay = (percentual: number) => {
  if (percentual >= 20) return { label: 'Crítico', color: '#ef4444', bgColor: 'bg-red-100' };
  if (percentual >= 10) return { label: 'Alto', color: '#f97316', bgColor: 'bg-orange-100' };
  if (percentual >= 5) return { label: 'Médio', color: '#eab308', bgColor: 'bg-yellow-100' };
  if (percentual > 0) return { label: 'Baixo', color: '#22c55e', bgColor: 'bg-green-100' };
  return { label: 'Sem Atraso', color: '#3b82f6', bgColor: 'bg-blue-100' };
};

// Função para criar segmentação por tempo de atraso
const createDelaySegments = (data: DelayData[]) => {
  const segments = {
    'Crítico (>20%)': data.filter(item => item.percentual_atraso >= 20).length,
    'Alto (10-20%)': data.filter(item => item.percentual_atraso >= 10 && item.percentual_atraso < 20).length,
    'Médio (5-10%)': data.filter(item => item.percentual_atraso >= 5 && item.percentual_atraso < 10).length,
    'Baixo (1-5%)': data.filter(item => item.percentual_atraso > 0 && item.percentual_atraso < 5).length,
    'Sem Atraso': data.filter(item => item.percentual_atraso === 0).length
  };

  return Object.entries(segments).map(([name, value], index) => ({
    name,
    value,
    percentage: data.length > 0 ? (value / data.length) * 100 : 0,
    color: DELAY_COLORS[index]
  }));
};

// Função para criar segmentação por tempo de atraso em minutos/horas
const createTimeDelaySegments = (atrasosComTempo: Array<{ tempoAtrasoMinutos: number; [key: string]: any }> = []) => {
  const segments = {
    'Até 30 min': atrasosComTempo.filter(item => item.tempoAtrasoMinutos <= 30).length,
    '30 min - 1h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 30 && item.tempoAtrasoMinutos <= 60).length,
    '1h - 2h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 60 && item.tempoAtrasoMinutos <= 120).length,
    '2h - 5h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 120 && item.tempoAtrasoMinutos <= 300).length,
    '5h - 12h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 300 && item.tempoAtrasoMinutos <= 720).length,
    '12h - 24h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 720 && item.tempoAtrasoMinutos <= 1440).length,
    'Mais de 24h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 1440).length
  };

  return Object.entries(segments).map(([name, value], index) => ({
    name,
    value,
    percentage: atrasosComTempo.length > 0 ? (value / atrasosComTempo.length) * 100 : 0,
    color: DELAY_COLORS[index % DELAY_COLORS.length]
  }));
};

export function VolumetriaDelayAnalysis({ data }: VolumetriaDelayAnalysisProps) {
  // Estado para controle de ordenação
  const [sortField, setSortField] = useState<'nome' | 'total_exames' | 'atrasados' | 'percentual_atraso' | 'tempoMedioAtraso'>('atrasados');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Estado para controle de expansão dos clientes
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [clientDetails, setClientDetails] = useState<Map<string, ClienteDetalhe>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Função para buscar detalhes de um cliente específico
  const fetchClientDetails = async (clienteName: string) => {
    if (clientDetails.has(clienteName) || loadingDetails.has(clienteName)) return;
    
    setLoadingDetails(prev => new Set(prev).add(clienteName));
    
    try {
      // Buscar dados do cliente específico
      const { data: clientData, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, ESPECIALIDADE, MODALIDADE, VALORES, DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, DATA_REALIZACAO')
        .eq('EMPRESA', clienteName);

      if (error) throw error;

      if (clientData) {
        // Processar especialidades
        const especialidadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        
        // Processar categorias (baseado na modalidade para simplificar)
        const categoriasMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();
        
        // Processar prioridades (vamos usar uma lógica baseada no tempo de atraso)
        const prioridadesMap = new Map<string, { total: number; atrasados: number; tempoTotal: number }>();

        clientData.forEach(row => {
          // Verificar se há dados válidos para calcular atraso
          if (!row.DATA_LAUDO || !row.DATA_PRAZO || !row.HORA_LAUDO || !row.HORA_PRAZO) {
            return; // Skip registros sem dados completos
          }

          // Combinar data e hora para comparação precisa
          const dataLaudoCompleta = new Date(`${row.DATA_LAUDO}T${row.HORA_LAUDO}`);
          const dataPrazoCompleta = new Date(`${row.DATA_PRAZO}T${row.HORA_PRAZO}`);
          
          const isAtrasado = dataLaudoCompleta > dataPrazoCompleta;
          const tempoAtraso = isAtrasado ? (dataLaudoCompleta.getTime() - dataPrazoCompleta.getTime()) / (1000 * 60) : 0;

          // Processar especialidades
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

          // Processar categorias (usando modalidade)
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

          // Processar prioridades (baseado no tempo de atraso)
          let prioridade = 'Normal';
          if (tempoAtraso > 1440) prioridade = 'Crítica'; // Mais de 24h
          else if (tempoAtraso > 480) prioridade = 'Alta'; // Mais de 8h
          else if (tempoAtraso > 120) prioridade = 'Média'; // Mais de 2h
          
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

  // Calcular tempo médio de atraso por cliente
  const clientesComTempoAtraso = data.clientes
    .filter(c => c.atrasados > 0)
    .map(cliente => {
      const atrasosCliente = data.atrasosComTempo?.filter(atraso => atraso.EMPRESA === cliente.nome) || [];
      const tempoMedioAtraso = atrasosCliente.length > 0 
        ? atrasosCliente.reduce((sum, atraso) => sum + atraso.tempoAtrasoMinutos, 0) / atrasosCliente.length 
        : 0;
      
      const nivelAtraso = cliente.percentual_atraso >= 20 ? 'Crítico' :
                         cliente.percentual_atraso >= 10 ? 'Alto' :
                         cliente.percentual_atraso >= 5 ? 'Médio' : 'Baixo';
      
      return {
        ...cliente,
        tempoMedioAtraso,
        nivelAtraso
      };
    })
    .sort((a, b) => {
      const fieldA = a[sortField];
      const fieldB = b[sortField];
      
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return sortDirection === 'asc' 
          ? fieldA.localeCompare(fieldB)
          : fieldB.localeCompare(fieldA);
      }
      
      return sortDirection === 'asc' 
        ? (fieldA as number) - (fieldB as number)
      : (fieldB as number) - (fieldA as number);
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

  // Top 5 modalidades com mais atrasos
  const topDelayModalidades = data.modalidades
    .filter(m => m.atrasados > 0)
    .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
    .slice(0, 5);

  // Top 5 especialidades com mais atrasos
  const topDelayEspecialidades = data.especialidades
    .filter(e => e.atrasados > 0)
    .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
    .slice(0, 5);

  // Segmentação por tempo de atraso
  const clienteSegments = createDelaySegments(data.clientes);
  const modalidadeSegments = createDelaySegments(data.modalidades);
  const timeDelaySegments = createTimeDelaySegments(data.atrasosComTempo);

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
          <Alert className={`${data.percentualAtrasoGeral >= 10 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'} mb-4`}>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>{data.percentualAtrasoGeral.toFixed(1)}%</strong> dos laudos estão atrasados 
              ({data.totalAtrasados.toLocaleString()} de {(data.totalAtrasados / (data.percentualAtrasoGeral/100)).toLocaleString()} laudos)
              {data.percentualAtrasoGeral >= 15 && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Atenção: Taxa de atraso acima do limite aceitável (15%)
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{data.totalAtrasados.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Laudos Atrasados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.clientes.filter(c => c.atrasados > 0).length}</div>
              <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.percentualAtrasoGeral.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Taxa Geral de Atraso</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de Análise */}
      <div className="grid grid-cols-1 gap-6">
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
                      className="text-center cursor-pointer hover:bg-gray-200 min-w-[200px] border-r font-semibold h-12"
                      onClick={() => handleSort('total_exames')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Total
                        {renderSortIcon('total_exames')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-gray-200 min-w-[200px] border-r font-semibold h-12"
                      onClick={() => handleSort('atrasados')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Atrasos
                        {renderSortIcon('atrasados')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-gray-200 min-w-[240px] border-r font-semibold h-12"
                      onClick={() => handleSort('percentual_atraso')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        % Atraso
                        {renderSortIcon('percentual_atraso')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-gray-200 min-w-[240px] border-r font-semibold h-12"
                      onClick={() => handleSort('tempoMedioAtraso')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Tempo Médio
                        {renderSortIcon('tempoMedioAtraso')}
                      </div>
                    </TableHead>
                    <TableHead className="text-center min-w-[200px] font-semibold h-12">
                      Nível
                    </TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
            
            {/* Área de scroll com conteúdo da tabela */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <Table className="w-full">
                <TableBody>
                  {clientesComTempoAtraso.map((cliente, index) => {
                    const formatarTempo = (minutos: number) => {
                      if (minutos < 60) return `${Math.round(minutos)}min`;
                      if (minutos < 1440) return `${Math.round(minutos / 60)}h`;
                      return `${Math.round(minutos / 1440)}d`;
                    };

                    // Função específica para detalhes expandidos (sem dias)
                    const formatarTempoDetalhes = (minutos: number) => {
                      if (minutos < 60) return `${Math.round(minutos)}min`;
                      return `${Math.round(minutos / 60)}h`;
                    };
                    
                    const isExpanded = expandedClients.has(cliente.nome);
                    const isLoading = loadingDetails.has(cliente.nome);
                    const details = clientDetails.get(cliente.nome);
                    
                    return (
                      <>
                        <TableRow key={cliente.nome} className="hover:bg-gray-50 border-b">
                          <TableCell className="font-medium border-r min-w-[400px]">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleClientExpansion(cliente.nome)}
                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 transition-colors"
                                disabled={isLoading}
                              >
                                {isLoading ? (
                                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                              <span className="cursor-pointer" onClick={() => toggleClientExpansion(cliente.nome)}>
                                {cliente.nome}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center border-r min-w-[200px]">{cliente.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-center border-r min-w-[200px]">{cliente.atrasados.toLocaleString()}</TableCell>
                          <TableCell className="text-center border-r min-w-[240px]">
                            <Badge variant={cliente.percentual_atraso >= 20 ? "destructive" : cliente.percentual_atraso >= 10 ? "secondary" : "outline"}>
                              {cliente.percentual_atraso.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center border-r min-w-[240px]">{formatarTempo(cliente.tempoMedioAtraso)}</TableCell>
                          <TableCell className="text-center min-w-[200px]">
                            <Badge variant={
                              cliente.nivelAtraso === 'Crítico' ? "destructive" :
                              cliente.nivelAtraso === 'Alto' ? "secondary" :
                              cliente.nivelAtraso === 'Médio' ? "outline" : "default"
                            }>
                              {cliente.nivelAtraso}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        
                        {/* Linha expandida com detalhes */}
                        {isExpanded && details && (
                          <TableRow>
                            <TableCell colSpan={6} className="p-0 bg-gray-50">
                              <div className="p-6 space-y-6">
                                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                                  Detalhes de Atrasos - {cliente.nome}
                                </h4>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  {/* Especialidades */}
                                  <div>
                                    <h5 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                      Especialidades
                                    </h5>
                                    <div className="space-y-2">
                                      {details.especialidades.slice(0, 5).map((esp) => (
                                        <div key={esp.nome} className="bg-white p-3 rounded-lg border">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-sm">{esp.nome}</span>
                                            <Badge variant={esp.percentual_atraso >= 20 ? "destructive" : esp.percentual_atraso >= 10 ? "secondary" : "outline"} className="text-xs">
                                              {esp.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between text-xs text-gray-600">
                                             <span>{esp.atrasados}/{esp.total_exames}</span>
                                             <span>{formatarTempoDetalhes(esp.tempo_medio_atraso || 0)}</span>
                                           </div>
                                        </div>
                                      ))}
                                      {details.especialidades.length > 5 && (
                                        <div className="text-xs text-gray-500 text-center">
                                          +{details.especialidades.length - 5} outras especialidades
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Categorias */}
                                  <div>
                                    <h5 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                      Categorias
                                    </h5>
                                    <div className="space-y-2">
                                      {details.categorias.slice(0, 5).map((cat) => (
                                        <div key={cat.nome} className="bg-white p-3 rounded-lg border">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-sm">{cat.nome}</span>
                                            <Badge variant={cat.percentual_atraso >= 20 ? "destructive" : cat.percentual_atraso >= 10 ? "secondary" : "outline"} className="text-xs">
                                              {cat.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between text-xs text-gray-600">
                                             <span>{cat.atrasados}/{cat.total_exames}</span>
                                             <span>{formatarTempoDetalhes(cat.tempo_medio_atraso || 0)}</span>
                                           </div>
                                        </div>
                                      ))}
                                      {details.categorias.length > 5 && (
                                        <div className="text-xs text-gray-500 text-center">
                                          +{details.categorias.length - 5} outras categorias
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Prioridades */}
                                  <div>
                                    <h5 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                      Prioridades
                                    </h5>
                                    <div className="space-y-2">
                                      {details.prioridades.map((prio) => (
                                        <div key={prio.nome} className="bg-white p-3 rounded-lg border">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-sm">{prio.nome}</span>
                                            <Badge variant={prio.percentual_atraso >= 20 ? "destructive" : prio.percentual_atraso >= 10 ? "secondary" : "outline"} className="text-xs">
                                              {prio.percentual_atraso.toFixed(1)}%
                                            </Badge>
                                          </div>
                                           <div className="flex justify-between text-xs text-gray-600">
                                             <span>{prio.atrasados}/{prio.total_exames}</span>
                                             <span>{formatarTempoDetalhes(prio.tempo_medio_atraso || 0)}</span>
                                           </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
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
          
          <div className="p-4 border-t bg-gray-50">
            <div className="text-sm text-muted-foreground text-center">
              Exibindo {clientesComTempoAtraso.length} clientes com atrasos
            </div>
          </div>
        </Card>

        {/* Top Modalidades com Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Modalidades - Maior % de Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDelayModalidades}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`, 
                    'Taxa de Atraso'
                  ]}
                />
                <Bar dataKey="percentual_atraso" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análise Detalhada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Atrasos - Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Atrasos - Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clienteSegments}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {clienteSegments.map((entry, index) => (
                    <Cell key={`client-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} clientes`, 'Quantidade']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumo por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo - Clientes Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientesComTempoAtraso.map((cliente, index) => {
                const category = categorizeDelay(cliente.percentual_atraso);
                return (
                  <div key={cliente.nome} className={`p-3 rounded-lg ${category.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                        <span className="font-medium text-sm">{cliente.nome}</span>
                      </div>
                      <Badge style={{ backgroundColor: category.color, color: 'white' }}>
                        {category.label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{cliente.atrasados} atrasados de {cliente.total_exames} laudos</span>
                      <span className="font-bold">{cliente.percentual_atraso.toFixed(1)}%</span>
                    </div>
                    <Progress value={cliente.percentual_atraso} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Nível de Atraso */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Nível de Atraso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {clienteSegments.find(s => s.name === 'Crítico (>20%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Críticos</div>
              <div className="text-xs text-red-600 mt-1">&gt;20% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {clienteSegments.find(s => s.name === 'Alto (10-20%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Alto Risco</div>
              <div className="text-xs text-orange-600 mt-1">10-20% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {clienteSegments.find(s => s.name === 'Médio (5-10%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Atenção</div>
              <div className="text-xs text-yellow-600 mt-1">5-10% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {clienteSegments.find(s => s.name === 'Sem Atraso')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes OK</div>
              <div className="text-xs text-green-600 mt-1">Sem atrasos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Tempo de Atraso */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Tempo de Atraso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Pizza - Distribuição por Tempo */}
            <div>
              <h4 className="text-lg font-medium mb-4">Distribuição por Tempo de Atraso</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={timeDelaySegments}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {timeDelaySegments.map((entry, index) => (
                      <Cell key={`time-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} laudos`, 'Quantidade']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cards de Estatísticas por Tempo */}
            <div>
              <h4 className="text-lg font-medium mb-4">Detalhamento por Faixa de Tempo</h4>
              <div className="grid grid-cols-1 gap-3">
                {timeDelaySegments.map((segment, index) => (
                  <div key={segment.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: segment.color }}
                      ></div>
                      <span className="font-medium text-sm">{segment.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{segment.value}</div>
                      <div className="text-xs text-muted-foreground">{segment.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}