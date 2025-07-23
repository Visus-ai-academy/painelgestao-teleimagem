import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Activity, Users, Clock, AlertCircle, Calendar } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ControlePeriodoVolumetria } from '@/components/ControlePeriodoVolumetria';
import { stringParaPeriodo } from '@/lib/periodoUtils';
import { useToast } from "@/hooks/use-toast";

interface VolumetriaData {
  id: string;
  EMPRESA: string;
  ESPECIALIDADE: string;
  MODALIDADE: string;
  PRIORIDADE: string;
  DATA_REALIZACAO: string;
  DATA_LAUDO: string;
  HORA_LAUDO: string;
  DATA_PRAZO: string;
  HORA_PRAZO: string;
  VALORES: number;
  STATUS: string;
  data_referencia: string;
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
  const { toast } = useToast();
  const [data, setData] = useState<VolumetriaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<string>("todos");
  const [cliente, setCliente] = useState<string>("todos");
  
  // Estados para dados agregados
  const [totalData, setTotalData] = useState<any>(null);
  const [empresaData, setEmpresaData] = useState<any[]>([]);
  const [modalidadeData, setModalidadeData] = useState<any[]>([]);
  const [especialidadeData, setEspecialidadeData] = useState<any[]>([]);
  const [prioridadeData, setPrioridadeData] = useState<any[]>([]);
  const [atrasosData, setAtrasosData] = useState<any>(null);
  const [crescimentoData, setCrescimentoData] = useState<any>(null);
  
  // Estados para análise de atrasos por dimensão
  const [atrasosModalidade, setAtrasosModalidade] = useState<any[]>([]);
  const [atrasosEspecialidade, setAtrasosEspecialidade] = useState<any[]>([]);
  const [atrasosCliente, setAtrasosCliente] = useState<any[]>([]);

  const [clientes, setClientes] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    loadClientes();
  }, [periodo, cliente]);

  const loadClientes = async () => {
    try {
      console.log('🔍 Carregando clientes únicos de forma otimizada...');
      
      // Consulta simples com limite controlado para evitar timeout
      const { data: empresas, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA')
        .not('EMPRESA', 'is', null)
        .limit(10000); // Limite para evitar timeout

      if (error) throw error;
      
      const empresasUnicas = [...new Set(empresas?.map(e => e.EMPRESA) || [])];
      console.log(`📊 Clientes únicos encontrados: ${empresasUnicas.length}`);
      setClientes(empresasUnicas.sort());
      
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      // Fallback de emergência - usar dados já carregados
      if (data.length > 0) {
        const empresasFromData = [...new Set(data.map(d => d.EMPRESA))];
        console.log('🚨 Usando clientes dos dados já carregados:', empresasFromData.length);
        setClientes(empresasFromData.sort());
      }
    }
  };

  const getDateFilter = () => {
    // Verificar se é um período de faturamento específico (formato YYYY-MM)
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

    // Períodos tradicionais do sistema
    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodo) {
      case "todos":
        return null; // Sem filtro de data
      case "ultimos_5_dias":
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 4);
        dataFim = new Date(hoje);
        break;
      case "hoje":
        dataInicio = new Date(hoje);
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
        return null; // Sem filtro de data
    }

    return {
      inicio: dataInicio.toISOString().split('T')[0],
      fim: dataFim.toISOString().split('T')[0]
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados de forma otimizada...');
      
      const dateFilter = getDateFilter();
      console.log('📅 Filtro de data:', dateFilter);
      console.log('👤 Cliente selecionado:', cliente);

      // Estratégia otimizada: usar limite controlado para evitar timeout
      let query = supabase
        .from('volumetria_mobilemed')
        .select('*')
        .order('data_referencia', { ascending: false })
        .limit(25000); // Limite seguro para evitar timeout

      // Aplicar filtros
      if (dateFilter) {
        query = query.gte('data_referencia', dateFilter.inicio)
                     .lte('data_referencia', dateFilter.fim);
      }

      if (cliente !== "todos") {
        query = query.eq('EMPRESA', cliente);
      }

      const { data: rawData, error } = await query;
      if (error) throw error;

      console.log(`✅ Carregados ${rawData?.length || 0} registros (limite otimizado)`);
      console.log('📋 Amostra dos primeiros 3 registros:', rawData?.slice(0, 3).map(r => ({ 
        empresa: r.EMPRESA, 
        data: r.data_referencia, 
        valores: r.VALORES 
      })));
      
      setData(rawData || []);
      
      // Processar dados se houver
      if (rawData && rawData.length > 0) {
        console.log('⚙️ Processando dados...');
        await processarDados(rawData);
        
        // Extrair clientes únicos dos dados carregados se não foram carregados ainda
        if (clientes.length === 0) {
          const empresasFromData = [...new Set(rawData.map(d => d.EMPRESA))];
          console.log('🔄 Extraindo clientes dos dados carregados:', empresasFromData.length);
          setClientes(empresasFromData.sort());
        }
      } else {
        console.log('⚠️ Nenhum dado encontrado');
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da volumetria. Tente filtrar por período.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processarDados = async (rawData: VolumetriaData[]) => {
    console.log('🔍 Iniciando processamento de dados...');
    console.log(`📊 Total de registros para processar: ${rawData.length}`);
    
    // Totais gerais
    const totalExames = rawData.reduce((sum, item) => sum + (item.VALORES || 0), 0);
    const totalRegistros = rawData.length;
    
    console.log(`💰 Total de exames (soma VALORES): ${totalExames.toLocaleString()}`);
    console.log(`📋 Total de registros: ${totalRegistros.toLocaleString()}`);
    
    // Cálculo de atrasos (DATA_LAUDO + HORA_LAUDO > DATA_PRAZO + HORA_PRAZO)
    const atrasados = rawData.filter(item => {
      if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) return false;
      
      // Combinar data e hora do laudo
      const dataHoraLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
      
      // Combinar data e hora do prazo
      const dataHoraPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
      
      // Verificar se laudo foi entregue após o prazo
      return dataHoraLaudo > dataHoraPrazo;
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
      
      // Verificar atraso usando critério correto (DATA_LAUDO + HORA_LAUDO > DATA_PRAZO + HORA_PRAZO)
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        const dataHoraLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
        const dataHoraPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
        if (dataHoraLaudo > dataHoraPrazo) acc[key].atrasados += 1;
      }
      
      return acc;
    }, {});

    const empresaArray = Object.values(porEmpresa).map((item: any) => ({
      ...item,
      percentual: totalExames > 0 ? ((item.total_exames / totalExames) * 100).toFixed(1) : "0",
      percentual_atraso: item.total_registros > 0 ? ((item.atrasados / item.total_registros) * 100).toFixed(1) : "0"
    })).sort((a, b) => b.total_exames - a.total_exames);
    
    console.log('Empresas únicas encontradas:', Object.keys(porEmpresa).length);
    console.log('Total de empresas no array final:', empresaArray.length);
    console.log('Primeiras 10 empresas:', empresaArray.slice(0, 10).map(e => ({ nome: e.nome, exames: e.total_exames })));
    
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

    // Análise de atrasos por dimensão
    processarAtrasosDetalhados(rawData, atrasados);

    // Calcular crescimento (comparar com período anterior)
    await calcularCrescimento();
  };

  const processarAtrasosDetalhados = (rawData: VolumetriaData[], atrasados: VolumetriaData[]) => {
    // Atrasos por Modalidade
    const atrasosPorModalidade = rawData.reduce((acc: any, item) => {
      const key = item.MODALIDADE || "Não informado";
      if (!acc[key]) {
        acc[key] = { nome: key, total_registros: 0, atrasados: 0 };
      }
      acc[key].total_registros += 1;
      
      // Verificar se está atrasado
      if (atrasados.some(a => a.id === item.id)) {
        acc[key].atrasados += 1;
      }
      
      return acc;
    }, {});

    const modalidadeAtrasosArray = Object.values(atrasosPorModalidade).map((item: any) => ({
      ...item,
      percentual_atraso: item.total_registros > 0 ? ((item.atrasados / item.total_registros) * 100).toFixed(1) : "0"
    }));

    setAtrasosModalidade(modalidadeAtrasosArray);

    // Atrasos por Especialidade
    const atrasosPorEspecialidade = rawData.reduce((acc: any, item) => {
      const key = item.ESPECIALIDADE || "Não informado";
      if (!acc[key]) {
        acc[key] = { nome: key, total_registros: 0, atrasados: 0 };
      }
      acc[key].total_registros += 1;
      
      // Verificar se está atrasado
      if (atrasados.some(a => a.id === item.id)) {
        acc[key].atrasados += 1;
      }
      
      return acc;
    }, {});

    const especialidadeAtrasosArray = Object.values(atrasosPorEspecialidade).map((item: any) => ({
      ...item,
      percentual_atraso: item.total_registros > 0 ? ((item.atrasados / item.total_registros) * 100).toFixed(1) : "0"
    }));

    setAtrasosEspecialidade(especialidadeAtrasosArray);

    // Atrasos por Cliente
    const atrasosPorCliente = rawData.reduce((acc: any, item) => {
      const key = item.EMPRESA;
      if (!acc[key]) {
        acc[key] = { nome: key, total_registros: 0, atrasados: 0 };
      }
      acc[key].total_registros += 1;
      
      // Verificar se está atrasado
      if (atrasados.some(a => a.id === item.id)) {
        acc[key].atrasados += 1;
      }
      
      return acc;
    }, {});

    const clienteAtrasosArray = Object.values(atrasosPorCliente).map((item: any) => ({
      ...item,
      percentual_atraso: item.total_registros > 0 ? ((item.atrasados / item.total_registros) * 100).toFixed(1) : "0"
    }));

    setAtrasosCliente(clienteAtrasosArray);
  };

  const calcularCrescimento = async () => {
    try {
      const dateFilter = getDateFilter();
      
      // Se não há filtro de data, não calcular crescimento
      if (!dateFilter) {
        setCrescimentoData({
          total_atual: totalData?.total_exames || 0,
          total_anterior: 0,
          crescimento: "0",
          tipo: "crescimento"
        });
        return;
      }

      // Calcular período anterior
      let inicioAnterior, fimAnterior;
      const inicioDate = new Date(dateFilter.inicio);
      const fimDate = new Date(dateFilter.fim);
      
      switch (periodo) {
        case "mes_atual":
          inicioAnterior = new Date(inicioDate.getFullYear(), inicioDate.getMonth() - 1, 1);
          fimAnterior = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), 0);
          break;
        default:
          // Para outros períodos, calcular baseado na diferença de dias
          const dias = Math.ceil((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24));
          inicioAnterior = new Date(inicioDate);
          inicioAnterior.setDate(inicioDate.getDate() - dias);
          fimAnterior = new Date(fimDate);
          fimAnterior.setDate(fimDate.getDate() - dias);
      }

      // Buscar dados do período anterior de forma otimizada
      let queryAnterior = supabase
        .from('volumetria_mobilemed')
        .select('VALORES')
        .gte('data_referencia', inicioAnterior.toISOString().split('T')[0])
        .lte('data_referencia', fimAnterior.toISOString().split('T')[0])
        .limit(10000); // Limite para evitar timeout

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
      // Fallback: sem crescimento em caso de erro
      setCrescimentoData({
        total_atual: totalData?.total_exames || 0,
        total_anterior: 0,
        crescimento: "0",
        tipo: "crescimento"
      });
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

      {/* Controles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ControlePeriodoVolumetria 
          periodo={periodo} 
          onPeriodoChange={setPeriodo}
          showStatus={true}
          showDetails={true}
        />
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Filtro por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {clientes.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
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

      {/* Análise Detalhada de Atrasos */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            Análise Detalhada de Atrasos
          </h2>
          <p className="text-muted-foreground">Desdobramento dos atrasos por dimensão</p>
        </div>

        {/* Atrasos por Modalidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Atrasos por Modalidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico */}
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={atrasosModalidade}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="atrasados" fill="#ef4444" name="Atrasados" />
                    <Bar dataKey="total_registros" fill="#3b82f6" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Tabela */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {atrasosModalidade.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.atrasados} de {item.total_registros} exames
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={parseFloat(item.percentual_atraso) > 20 ? "destructive" : 
                                parseFloat(item.percentual_atraso) > 10 ? "default" : "secondary"}
                      >
                        {item.percentual_atraso}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atrasos por Especialidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Atrasos por Especialidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico */}
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={atrasosEspecialidade}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="atrasados" fill="#ef4444" name="Atrasados" />
                    <Bar dataKey="total_registros" fill="#3b82f6" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Tabela */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {atrasosEspecialidade.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.atrasados} de {item.total_registros} exames
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={parseFloat(item.percentual_atraso) > 20 ? "destructive" : 
                                parseFloat(item.percentual_atraso) > 10 ? "default" : "secondary"}
                      >
                        {item.percentual_atraso}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atrasos por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Atrasos por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico */}
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={atrasosCliente}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="atrasados" fill="#ef4444" name="Atrasados" />
                    <Bar dataKey="total_registros" fill="#3b82f6" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Tabela */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {atrasosCliente.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.atrasados} de {item.total_registros} exames
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={parseFloat(item.percentual_atraso) > 20 ? "destructive" : 
                                parseFloat(item.percentual_atraso) > 10 ? "default" : "secondary"}
                      >
                        {item.percentual_atraso}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}