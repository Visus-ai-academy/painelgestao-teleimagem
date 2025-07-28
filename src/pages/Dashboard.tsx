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

const volumeData = [
  { name: "Jan", exames: 1200, consultas: 800 },
  { name: "Fev", exames: 1400, consultas: 900 },
  { name: "Mar", exames: 1100, consultas: 750 },
  { name: "Abr", exames: 1600, consultas: 1100 },
  { name: "Mai", exames: 1350, consultas: 950 },
  { name: "Jun", exames: 1500, consultas: 1000 },
];

const performanceData = [
  { name: "Produção", meta: 100, realizado: 95 },
  { name: "Qualidade", meta: 100, realizado: 98 },
  { name: "Eficiência", meta: 100, realizado: 92 },
  { name: "SLA", meta: 100, realizado: 96 },
];

export default function Dashboard() {
  const navigate = useNavigate();

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
            value="0"
            change="Base limpa - aguardando novos uploads"
            changeType="neutral"
            icon={Activity}
            iconColor="text-blue-600"
          />
        </div>
        <div onClick={() => navigate("/financeiro")} className="cursor-pointer">
          <MetricCard
            title="Faturamento"
            value="R$ 2.4M"
            change="+8% vs mês anterior"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-green-600"
          />
        </div>
        <Card onClick={() => navigate("/people/medicos-ativos")} className="cursor-pointer hover:shadow-lg transition-shadow">
          <MetricCard
            title="Médicos Ativos"
            value="156"
            change="+3 novos médicos"
            changeType="positive"
            icon={Users}
            iconColor="text-purple-600"
          />
        </Card>
        <div onClick={() => navigate("/operacional/qualidade")} className="cursor-pointer">
          <MetricCard
            title="Taxa de Qualidade"
            value="97.8%"
            change="+0.5% vs mês anterior"
            changeType="positive"
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
                value={95}
                max={100}
                label="Meta de Produção"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional/qualidade")} className="cursor-pointer">
              <Speedometer
                value={98}
                max={100}
                label="Qualidade"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional")} className="cursor-pointer">
              <Speedometer
                value={92}
                max={100}
                label="Eficiência"
                unit="%"
              />
            </div>
            <div onClick={() => navigate("/operacional")} className="cursor-pointer">
              <Speedometer
                value={96}
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
              status="good"
              label="Sistema"
              value="Online"
              description="Todos os serviços funcionando normalmente"
            />
            <StatusIndicator
              status="warning"
              label="Capacidade"
              value="85%"
              description="Próximo do limite de capacidade"
            />
            <StatusIndicator
              status="good"
              label="Fila de Exames"
              value="12 min"
              description="Tempo médio de espera"
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
