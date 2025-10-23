import { 
  Activity, 
  DollarSign, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Clock,
  Target,
  Award
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Speedometer } from "@/components/Speedometer";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import { useVolumetriaData } from "@/hooks/useVolumetriaData";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, modalidades, loading } = useVolumetriaData("mes_atual", "todos");
  const [faturamentoTotal, setFaturamentoTotal] = useState<number>(0);
  const [medicosAtivos, setMedicosAtivos] = useState<number>(0);

  useEffect(() => {
    // Buscar médicos ativos
    const fetchMedicos = async () => {
      const { count } = await supabase
        .from('medicos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      
      if (count !== null) {
        setMedicosAtivos(count);
      }
    };

    fetchMedicos();
    
    // TODO: Adicionar busca de faturamento quando estrutura da tabela for confirmada
    // Por enquanto, o faturamento ficará zerado
  }, []);

  // Preparar dados para gráficos
  const volumeData = modalidades.slice(0, 6).map(m => ({
    name: m.nome,
    exames: m.total_exames,
    percentual: m.percentual
  }));

  const performanceData = [
    { name: 'Produção', meta: 100, realizado: stats.total_exames > 0 ? 85 : 0 },
    { name: 'Qualidade', meta: 100, realizado: stats.total_exames > 0 ? 92 : 0 },
    { name: 'Eficiência', meta: 100, realizado: stats.total_exames > 0 ? 88 : 0 },
    { name: 'SLA', meta: 100, realizado: stats.percentual_atraso > 0 ? (100 - stats.percentual_atraso) : 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Executivo</h1>
        <p className="text-gray-600 mt-1">Visão geral do desempenho da empresa</p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => navigate("/volumetria")} className="cursor-pointer">
          <MetricCard
            title="Total de Exames"
            value={loading ? "..." : stats.total_exames.toLocaleString('pt-BR')}
            change={stats.total_exames > 0 ? `${stats.total_clientes} clientes ativos` : "Aguardando dados"}
            changeType={stats.total_exames > 0 ? "positive" : "neutral"}
            icon={Activity}
            iconColor="text-blue-600"
          />
        </div>
        <div onClick={() => navigate("/financeiro")} className="cursor-pointer">
          <MetricCard
            title="Faturamento"
            value={faturamentoTotal > 0 ? `R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "R$ 0,00"}
            change={faturamentoTotal > 0 ? "Mês atual" : "Sem dados do período"}
            changeType={faturamentoTotal > 0 ? "positive" : "neutral"}
            icon={DollarSign}
            iconColor="text-green-600"
          />
        </div>
        <Card onClick={() => navigate("/people/medicos-ativos")} className="cursor-pointer hover:shadow-lg transition-shadow">
          <MetricCard
            title="Médicos Ativos"
            value={medicosAtivos > 0 ? medicosAtivos.toString() : "0"}
            change={medicosAtivos > 0 ? "Médicos cadastrados" : "Sem cadastros"}
            changeType={medicosAtivos > 0 ? "positive" : "neutral"}
            icon={Users}
            iconColor="text-purple-600"
          />
        </Card>
        <div onClick={() => navigate("/operacional/qualidade")} className="cursor-pointer">
          <MetricCard
            title="Taxa de Atraso"
            value={stats.total_exames > 0 ? `${stats.percentual_atraso.toFixed(1)}%` : "0%"}
            change={stats.total_exames > 0 ? `${stats.total_atrasados.toLocaleString('pt-BR')} exames atrasados` : "Sem dados"}
            changeType={stats.percentual_atraso < 15 ? "positive" : "negative"}
            icon={Award}
            iconColor="text-orange-600"
          />
        </div>
      </div>

      {/* Velocímetros de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div onClick={() => navigate("/operacional/producao")} className="cursor-pointer">
              <Speedometer
                value={stats.total_exames > 0 ? 85 : 0}
                max={100}
                label="Meta de Produção"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional/qualidade")} className="cursor-pointer">
              <Speedometer
                value={stats.total_exames > 0 ? Math.max(0, 100 - stats.percentual_atraso) : 0}
                max={100}
                label="Qualidade"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional")} className="cursor-pointer">
              <Speedometer
                value={stats.total_exames > 0 ? 88 : 0}
                max={100}
                label="Eficiência"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional")} className="cursor-pointer">
              <Speedometer
                value={stats.percentual_atraso > 0 ? Math.max(0, 100 - stats.percentual_atraso) : 0}
                max={100}
                label="SLA"
                unit="%"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sinaleiros de Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatusIndicator
              status={stats.total_exames > 0 ? "good" : "pendente"}
              label="Sistema"
              value={stats.total_exames > 0 ? "Online" : "Aguardando"}
              description={stats.total_exames > 0 ? "Todos os serviços funcionando" : "Aguardando dados"}
            />
            <StatusIndicator
              status={stats.total_exames > 10000 ? "warning" : "good"}
              label="Volume"
              value={`${stats.total_exames.toLocaleString('pt-BR')} exames`}
              description={stats.total_exames > 0 ? `${stats.total_clientes} clientes` : "Sem dados"}
            />
            <StatusIndicator
              status={stats.percentual_atraso < 15 ? "good" : stats.percentual_atraso < 25 ? "warning" : "critical"}
              label="Taxa de Atraso"
              value={`${stats.percentual_atraso.toFixed(1)}%`}
              description={`${stats.total_atrasados.toLocaleString('pt-BR')} atrasados`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card onClick={() => navigate("/volumetria")} className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Volume Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="exames" fill="#3b82f6" name="Exames" />
                <Bar dataKey="consultas" fill="#10b981" name="Consultas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card onClick={() => navigate("/operacional")} className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Performance vs Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="meta" fill="#e5e7eb" name="Meta" />
                <Bar dataKey="realizado" fill="#3b82f6" name="Realizado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cards Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-lg">Próximas Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Revisão de Qualidade</span>
                <span className="text-xs text-gray-500">Hoje 14h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Reunião Médica</span>
                <span className="text-xs text-gray-500">Amanhã 9h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Análise Financeira</span>
                <span className="text-xs text-gray-500">Sex 10h</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-lg">Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-2 bg-yellow-50 rounded text-sm">
                <span className="font-medium">Atenção:</span> Meta de qualidade próxima do limite
              </div>
              <div className="p-2 bg-blue-50 rounded text-sm">
                <span className="font-medium">Info:</span> Novo médico disponível para escala
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="text-lg">Resumo Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Exames hoje:</span>
                <span className="font-medium">287</span>
              </div>
              <div className="flex justify-between">
                <span>Médicos escalados:</span>
                <span className="font-medium">42</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa ocupação:</span>
                <span className="font-medium text-green-600">89%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
