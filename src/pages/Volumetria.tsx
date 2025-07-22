import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Activity, Users, Clock, AlertCircle, Calendar } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";

interface VolumetriaData {
  id: string;
  EMPRESA: string;
  ESPECIALIDADE: string;
  MODALIDADE: string;
  PRIORIDADE: string;
  DATA_REALIZACAO: string;
  DATA_LAUDO: string;
  VALORES: number;
  STATUS: string;
}

interface AggregatedData {
  empresa: string;
  modalidade: string;
  especialidade: string;
  prioridade: string;
  total_exames: number;
  atrasados: number;
  percentual_atraso: number;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Volumetria() {
  const [data, setData] = useState<VolumetriaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<string>("mes_atual");
  const [cliente, setCliente] = useState<string>("todos");
  
  // Estados para dados agregados
  const [totalData, setTotalData] = useState<any>(null);
  const [empresaData, setEmpresaData] = useState<any[]>([]);
  const [modalidadeData, setModalidadeData] = useState<any[]>([]);
  const [especialidadeData, setEspecialidadeData] = useState<any[]>([]);
  const [prioridadeData, setPrioridadeData] = useState<any[]>([]);
  const [atrasosData, setAtrasosData] = useState<any>(null);
  const [crescimentoData, setCrescimentoData] = useState<any>(null);

  const [clientes, setClientes] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    loadClientes();
  }, [periodo, cliente]);

  const loadClientes = async () => {
    try {
      const { data: empresas, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA')
        .not('EMPRESA', 'is', null);

      if (error) throw error;

      const empresasUnicas = [...new Set(empresas?.map(e => e.EMPRESA) || [])];
      setClientes(empresasUnicas);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const getDateFilter = () => {
    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodo) {
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
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    }

    return {
      inicio: dataInicio.toISOString().split('T')[0],
      fim: dataFim.toISOString().split('T')[0]
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { inicio, fim } = getDateFilter();

      let query = supabase
        .from('volumetria_mobilemed')
        .select('*')
        .gte('data_referencia', inicio)
        .lte('data_referencia', fim);

      if (cliente !== "todos") {
        query = query.eq('EMPRESA', cliente);
      }

      const { data: volumetriaData, error } = await query;
      if (error) throw error;

      setData(volumetriaData || []);
      
      // Processar dados
      await processarDados(volumetriaData || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const processarDados = async (rawData: VolumetriaData[]) => {
    // Totais gerais
    const totalExames = rawData.reduce((sum, item) => sum + (item.VALORES || 0), 0);
    const totalRegistros = rawData.length;
    
    // Cálculo de atrasos (considerando DATA_LAUDO vs DATA_REALIZACAO)
    const atrasados = rawData.filter(item => {
      if (!item.DATA_LAUDO || !item.DATA_REALIZACAO) return false;
      const dataRealizacao = new Date(item.DATA_REALIZACAO);
      const dataLaudo = new Date(item.DATA_LAUDO);
      const diffDias = (dataLaudo.getTime() - dataRealizacao.getTime()) / (1000 * 60 * 60 * 24);
      return diffDias > 1; // Considerando atraso se passou de 1 dia
    });

    const totalAtrasados = atrasados.length;
    const percentualAtraso = totalRegistros > 0 ? (totalAtrasados / totalRegistros) * 100 : 0;

    setTotalData({
      total_exames: totalExames,
      total_registros: totalRegistros,
      total_atrasados: totalAtrasados,
      percentual_atraso: percentualAtraso
    });

    setAtrasosData({
      total_atrasados: totalAtrasados,
      percentual_atraso: percentualAtraso,
      total_no_prazo: totalRegistros - totalAtrasados
    });

    // Agrupar por empresa
    const porEmpresa = rawData.reduce((acc: any, item) => {
      const key = item.EMPRESA;
      if (!acc[key]) {
        acc[key] = { nome: key, total_exames: 0, total_registros: 0, atrasados: 0 };
      }
      acc[key].total_exames += item.VALORES || 0;
      acc[key].total_registros += 1;
      
      // Verificar atraso
      if (item.DATA_LAUDO && item.DATA_REALIZACAO) {
        const dataRealizacao = new Date(item.DATA_REALIZACAO);
        const dataLaudo = new Date(item.DATA_LAUDO);
        const diffDias = (dataLaudo.getTime() - dataRealizacao.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDias > 1) acc[key].atrasados += 1;
      }
      
      return acc;
    }, {});

    const empresaArray = Object.values(porEmpresa).map((item: any) => ({
      ...item,
      percentual: totalExames > 0 ? ((item.total_exames / totalExames) * 100).toFixed(1) : "0",
      percentual_atraso: item.total_registros > 0 ? ((item.atrasados / item.total_registros) * 100).toFixed(1) : "0"
    }));
    
    setEmpresaData(empresaArray);

    // Agrupar por modalidade
    const porModalidade = rawData.reduce((acc: any, item) => {
      const key = item.MODALIDADE || "Não informado";
      if (!acc[key]) {
        acc[key] = { nome: key, total_exames: 0, total_registros: 0 };
      }
      acc[key].total_exames += item.VALORES || 0;
      acc[key].total_registros += 1;
      return acc;
    }, {});

    const modalidadeArray = Object.values(porModalidade).map((item: any) => ({
      ...item,
      percentual: totalExames > 0 ? ((item.total_exames / totalExames) * 100).toFixed(1) : "0"
    }));
    
    setModalidadeData(modalidadeArray);

    // Agrupar por especialidade
    const porEspecialidade = rawData.reduce((acc: any, item) => {
      const key = item.ESPECIALIDADE || "Não informado";
      if (!acc[key]) {
        acc[key] = { nome: key, total_exames: 0, total_registros: 0 };
      }
      acc[key].total_exames += item.VALORES || 0;
      acc[key].total_registros += 1;
      return acc;
    }, {});

    const especialidadeArray = Object.values(porEspecialidade).map((item: any) => ({
      ...item,
      percentual: totalExames > 0 ? ((item.total_exames / totalExames) * 100).toFixed(1) : "0"
    }));
    
    setEspecialidadeData(especialidadeArray);

    // Agrupar por prioridade
    const porPrioridade = rawData.reduce((acc: any, item) => {
      const key = item.PRIORIDADE || "Não informado";
      if (!acc[key]) {
        acc[key] = { nome: key, total_exames: 0, total_registros: 0 };
      }
      acc[key].total_exames += item.VALORES || 0;
      acc[key].total_registros += 1;
      return acc;
    }, {});

    const prioridadeArray = Object.values(porPrioridade).map((item: any) => ({
      ...item,
      percentual: totalExames > 0 ? ((item.total_exames / totalExames) * 100).toFixed(1) : "0"
    }));
    
    setPrioridadeData(prioridadeArray);

    // Calcular crescimento (comparar com período anterior)
    await calcularCrescimento();
  };

  const calcularCrescimento = async () => {
    try {
      // Obter dados do período anterior para comparação
      const { inicio: inicioAtual, fim: fimAtual } = getDateFilter();
      
      // Calcular período anterior
      let inicioAnterior, fimAnterior;
      const inicioDate = new Date(inicioAtual);
      const fimDate = new Date(fimAtual);
      
      if (periodo.includes("mes")) {
        inicioAnterior = new Date(inicioDate.getFullYear(), inicioDate.getMonth() - 1, 1);
        fimAnterior = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), 0);
      } else {
        inicioAnterior = new Date(inicioDate.getFullYear() - 1, inicioDate.getMonth(), inicioDate.getDate());
        fimAnterior = new Date(fimDate.getFullYear() - 1, fimDate.getMonth(), fimDate.getDate());
      }

      let queryAnterior = supabase
        .from('volumetria_mobilemed')
        .select('VALORES')
        .gte('data_referencia', inicioAnterior.toISOString().split('T')[0])
        .lte('data_referencia', fimAnterior.toISOString().split('T')[0]);

      if (cliente !== "todos") {
        queryAnterior = queryAnterior.eq('EMPRESA', cliente);
      }

      const { data: dataAnterior, error } = await queryAnterior;
      
      if (error) throw error;

      const totalAnterior = dataAnterior?.reduce((sum, item) => sum + (item.VALORES || 0), 0) || 0;
      const totalAtual = totalData?.total_exames || 0;
      
      const crescimento = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;

      setCrescimentoData({
        total_atual: totalAtual,
        total_anterior: totalAnterior,
        crescimento: crescimento.toFixed(1),
        tipo: crescimento >= 0 ? "crescimento" : "queda"
      });

    } catch (error) {
      console.error('Erro ao calcular crescimento:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Volumetria</h1>
        <p className="text-muted-foreground mt-1">Análise executiva completa de volumetria</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
            <SelectItem value="ano_atual">Ano Atual</SelectItem>
            <SelectItem value="ano_anterior">Ano Anterior</SelectItem>
          </SelectContent>
        </Select>

        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Clientes</SelectItem>
            {clientes.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Volume Total</span>
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalData?.total_exames.toLocaleString() || 0}</div>
            <div className="text-sm text-muted-foreground">
              {totalData?.total_registros.toLocaleString() || 0} registros
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Taxa de Crescimento</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {crescimentoData?.crescimento || "0"}%
            </div>
            <div className="text-sm text-muted-foreground">
              vs período anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Atrasos</span>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {atrasosData?.percentual_atraso.toFixed(1) || 0}%
            </div>
            <div className="text-sm text-muted-foreground">
              {atrasosData?.total_atrasados || 0} exames
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Empresas Ativas</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empresaData.length}</div>
            <div className="text-sm text-muted-foreground">
              clientes ativos
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle>Análise de Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'No Prazo', value: atrasosData?.total_no_prazo || 0, color: '#10b981' },
                    { name: 'Atrasados', value: atrasosData?.total_atrasados || 0, color: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume por Modalidade */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modalidadeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ nome, percentual }) => `${nome} ${percentual}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_exames"
                >
                  {modalidadeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas de Análise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume por Empresa */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {empresaData.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.total_registros} registros
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{item.total_exames.toLocaleString()}</div>
                    <Badge variant="secondary">{item.percentual}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Volume por Especialidade */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Especialidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {especialidadeData.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.total_registros} registros
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{item.total_exames.toLocaleString()}</div>
                    <Badge variant="secondary">{item.percentual}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume por Prioridade */}
      <Card>
        <CardHeader>
          <CardTitle>Volume e Percentual por Prioridade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={prioridadeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_exames" fill="#3b82f6" name="Total Exames" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}