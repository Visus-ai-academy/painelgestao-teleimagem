import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Activity, Users, Clock, AlertCircle, Calendar, Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ControlePeriodoVolumetria } from '@/components/ControlePeriodoVolumetria';
import { stringParaPeriodo } from '@/lib/periodoUtils';
import { useToast } from "@/hooks/use-toast";
import { VolumetriaUpload } from '@/components/VolumetriaUpload';

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

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Volumetria() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<string>("todos");
  const [cliente, setCliente] = useState<string>("todos");
  
  // Estados principais
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total_exames: 0,
    total_registros: 0,
    total_atrasados: 0,
    percentual_atraso: 0,
    total_clientes: 0
  });
  
  const [clientesData, setClientesData] = useState<ClienteData[]>([]);
  const [modalidadesData, setModalidadesData] = useState<ModalidadeData[]>([]);
  const [especialidadesData, setEspecialidadesData] = useState<EspecialidadeData[]>([]);
  const [listaClientes, setListaClientes] = useState<string[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [periodo, cliente]);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      console.log('🔍 Carregando lista completa de clientes...');
      
      const { data, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA')
        .not('EMPRESA', 'is', null);

      if (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        return;
      }

      // Extrair clientes únicos
      const clientesUnicos = [...new Set(data.map(item => item.EMPRESA))].sort();
      console.log(`✅ ${clientesUnicos.length} clientes únicos carregados`);
      
      setListaClientes(clientesUnicos);
      
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de clientes",
        variant: "destructive",
      });
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
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      console.log('⚡ Carregando dashboard completo...');
      
      const dateFilter = getDateFilter();
      console.log('📅 Filtro de data:', dateFilter);
      console.log('👤 Cliente selecionado:', cliente);

      // Query base para estatísticas principais - SEM LIMITAÇÃO
      let statsQuery = supabase
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
        `);

      // Aplicar filtros
      if (dateFilter) {
        statsQuery = statsQuery
          .gte('data_referencia', dateFilter.inicio)
          .lte('data_referencia', dateFilter.fim);
      }

      if (cliente !== "todos") {
        statsQuery = statsQuery.eq('EMPRESA', cliente);
      }

      console.log('📊 Executando query principal...');
      const { data: rawData, error } = await statsQuery;

      if (error) {
        console.error('❌ Erro na query principal:', error);
        throw error;
      }

      console.log(`✅ Carregados ${rawData?.length || 0} registros`);

      if (!rawData || rawData.length === 0) {
        // Resetar dados quando não há resultados
        setDashboardStats({
          total_exames: 0,
          total_registros: 0,
          total_atrasados: 0,
          percentual_atraso: 0,
          total_clientes: 0
        });
        setClientesData([]);
        setModalidadesData([]);
        setEspecialidadesData([]);
        return;
      }

      // Calcular estatísticas principais
      const totalExames = rawData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      const totalRegistros = rawData.length;
      const clientesUnicos = new Set(rawData.map(item => item.EMPRESA)).size;

      // Calcular atrasos
      const atrasados = rawData.filter(item => {
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

      console.log(`💰 Total de exames: ${totalExames.toLocaleString()}`);
      console.log(`📋 Total de registros: ${totalRegistros.toLocaleString()}`);
      console.log(`👥 Total de clientes: ${clientesUnicos}`);
      console.log(`⏰ Total atrasados: ${totalAtrasados.toLocaleString()}`);

      setDashboardStats({
        total_exames: totalExames,
        total_registros: totalRegistros,
        total_atrasados: totalAtrasados,
        percentual_atraso: percentualAtraso,
        total_clientes: clientesUnicos
      });

      // Processar dados por cliente
      const clientesMap = new Map<string, ClienteData>();
      
      rawData.forEach(item => {
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
          clienteData.atrasados += 1;
        }
      });

      // Calcular percentual de atraso para cada cliente
      const clientesArray = Array.from(clientesMap.values()).map(cliente => ({
        ...cliente,
        percentual_atraso: cliente.total_registros > 0 ? (cliente.atrasados / cliente.total_registros) * 100 : 0
      })).sort((a, b) => b.total_exames - a.total_exames);

      setClientesData(clientesArray);

      // Processar dados por modalidade
      const modalidadesMap = new Map<string, ModalidadeData>();
      
      rawData.forEach(item => {
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

      setModalidadesData(modalidadesArray);

      // Processar dados por especialidade
      const especialidadesMap = new Map<string, EspecialidadeData>();
      
      rawData.forEach(item => {
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

      setEspecialidadesData(especialidadesArray);

      console.log('✅ Dashboard carregado com sucesso!');
      
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
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Volumetria</h1>
        <p className="text-muted-foreground mt-1">
          Análise executiva completa de volumetria - 
          {dashboardStats.total_registros.toLocaleString()} registros | 
          {dashboardStats.total_clientes} clientes
        </p>
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
                <SelectValue>
                  {cliente === "todos" ? "Todos os Clientes" : cliente}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-auto">
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {listaClientes.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground mt-2">
              {listaClientes.length} clientes disponíveis
            </div>
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
            <div className="text-2xl font-bold text-primary">
              {dashboardStats.total_exames.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de exames processados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Registros</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboardStats.total_registros.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de registros na base
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Clientes</span>
              <Users className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboardStats.total_clientes}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clientes únicos ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Atrasos</span>
              <Clock className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboardStats.percentual_atraso.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardStats.total_atrasados.toLocaleString()} registros atrasados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Clientes por Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientesData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name === 'total_exames' ? 'Exames' : 'Registros'
                  ]}
                />
                <Legend />
                <Bar dataKey="total_exames" fill="#3b82f6" name="Exames" />
                <Bar dataKey="total_registros" fill="#10b981" name="Registros" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Modalidades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Distribuição por Modalidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modalidadesData.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({nome, percentual}) => `${nome}: ${percentual.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_exames"
                >
                  {modalidadesData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Especialidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Top 15 Especialidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={especialidadesData.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="nome" 
                tick={{fontSize: 10}}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']}
              />
              <Bar dataKey="total_exames" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Upload Component */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload - Data Laudo</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumetriaUpload 
              arquivoFonte="data_laudo" 
              onSuccess={() => {
                loadDashboard();
                loadClientes();
              }} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload - Data Exame</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumetriaUpload 
              arquivoFonte="data_exame" 
              onSuccess={() => {
                loadDashboard();
                loadClientes();
              }} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}