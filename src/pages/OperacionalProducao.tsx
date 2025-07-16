import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { 
  TrendingUp, 
  Clock, 
  Target,
  Users,
  Activity,
  Factory,
  Zap
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, LineChart } from "recharts";

const productionData = [
  { day: "Seg", MR: 45, CT: 38, DO: 22, MG: 18, RX: 32, total: 155 },
  { day: "Ter", MR: 42, CT: 35, DO: 25, MG: 20, RX: 35, total: 157 },
  { day: "Qua", MR: 48, CT: 40, DO: 20, MG: 22, RX: 38, total: 168 },
  { day: "Qui", MR: 50, CT: 42, DO: 28, MG: 19, RX: 40, total: 179 },
  { day: "Sex", MR: 52, CT: 45, DO: 30, MG: 25, RX: 42, total: 194 },
  { day: "Sáb", MR: 25, CT: 20, DO: 15, MG: 12, RX: 20, total: 92 },
  { day: "Dom", MR: 15, CT: 12, DO: 8, MG: 6, RX: 12, total: 53 }
];

const modalityProduction = [
  { 
    modalidade: "MR - Ressonância", 
    meta: 280, 
    realizado: 277, 
    performance: 98.9,
    categoria: "Angio",
    prioridade: "Urgente"
  },
  { 
    modalidade: "CT - Tomografia", 
    meta: 250, 
    realizado: 232, 
    performance: 92.8,
    categoria: "Contrastado",
    prioridade: "Rotina"
  },
  { 
    modalidade: "DO - Densitometria", 
    meta: 150, 
    realizado: 148, 
    performance: 98.7,
    categoria: "Score",
    prioridade: "Rotina"
  },
  { 
    modalidade: "MG - Mamografia", 
    meta: 120, 
    realizado: 122, 
    performance: 101.7,
    categoria: "Mastoide",
    prioridade: "Plantão"
  },
  { 
    modalidade: "RX - Raio-X", 
    meta: 200, 
    realizado: 219, 
    performance: 109.5,
    categoria: "OIT",
    prioridade: "Urgente"
  }
];

const specialtyProduction = [
  { specialty: "NE - Neurologia", production: 156, target: 150, efficiency: 104.0 },
  { specialty: "CA - Cardiologia", production: 142, target: 140, efficiency: 101.4 },
  { specialty: "ME - Medicina", production: 128, target: 135, efficiency: 94.8 },
  { specialty: "MI - Medicina Interna", production: 118, target: 120, efficiency: 98.3 },
  { specialty: "MA - Mastologia", production: 89, target: 85, efficiency: 104.7 }
];

const doctorProduction = [
  { name: "Dr. João Silva", specialty: "NE", modalidade: "MR", meta: 45, realizado: 48, performance: 106.7, categoria: "Angio" },
  { name: "Dra. Maria Santos", specialty: "CA", modalidade: "CT", meta: 42, realizado: 40, performance: 95.2, categoria: "Contrastado" },
  { name: "Dr. Carlos Lima", specialty: "ME", modalidade: "DO", meta: 35, realizado: 38, performance: 108.6, categoria: "Score" },
  { name: "Dra. Ana Costa", specialty: "MI", modalidade: "MG", meta: 30, realizado: 32, performance: 106.7, categoria: "Mastoide" },
  { name: "Dr. Pedro Oliveira", specialty: "MA", modalidade: "RX", meta: 50, realizado: 52, performance: 104.0, categoria: "OIT" }
];

export default function OperacionalProducao() {
  const [selectedPeriod, setSelectedPeriod] = useState("semanal");
  const [viewMode, setViewMode] = useState<"modalidade" | "medico">("modalidade");
  
  const totalMeta = modalityProduction.reduce((sum, item) => sum + item.meta, 0);
  const totalRealizado = modalityProduction.reduce((sum, item) => sum + item.realizado, 0);
  const performanceGeral = (totalRealizado / totalMeta) * 100;

  const getPerformanceBadge = (performance: number) => {
    if (performance >= 100) return <Badge className="bg-green-100 text-green-800">Acima da Meta</Badge>;
    if (performance >= 95) return <Badge className="bg-blue-100 text-blue-800">No Alvo</Badge>;
    if (performance >= 90) return <Badge className="bg-yellow-100 text-yellow-800">Atenção</Badge>;
    return <Badge className="bg-red-100 text-red-800">Abaixo</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Produção Operacional</h1>
        <p className="text-gray-600 mt-1">Monitoramento da produção por modalidade e especialidade</p>
      </div>

      <FilterBar 
        onPeriodChange={setSelectedPeriod}
      />

      {/* Métricas de Produção */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Performance Geral"
          value={`${performanceGeral.toFixed(1)}%`}
          change="Meta: 95%"
          changeType="positive"
          icon={Target}
        />
        <MetricCard
          title="Exames Realizados"
          value={totalRealizado.toLocaleString()}
          change={`Meta: ${totalMeta}`}
          changeType="positive"
          icon={Activity}
        />
        <MetricCard
          title="Eficiência Média"
          value="102.3%"
          change="+3.2% vs semana anterior"
          changeType="positive"
          icon={Zap}
        />
        <MetricCard
          title="Capacidade Utilizada"
          value="89.5%"
          change="Capacidade ótima"
          changeType="positive"
          icon={Factory}
        />
      </div>

      {/* Gráfico de Produção Semanal */}
      <Card>
        <CardHeader>
          <CardTitle>Produção Semanal por Modalidade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="MR" stackId="a" fill="#3b82f6" />
              <Bar dataKey="CT" stackId="a" fill="#10b981" />
              <Bar dataKey="DO" stackId="a" fill="#f59e0b" />
              <Bar dataKey="MG" stackId="a" fill="#ef4444" />
              <Bar dataKey="RX" stackId="a" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Produção por Modalidade ou Médico */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {viewMode === "modalidade" ? "Performance por Modalidade" : "Performance por Médico"}
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === "modalidade" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("modalidade")}
              >
                Por Modalidade
              </Button>
              <Button 
                variant={viewMode === "medico" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("medico")}
              >
                Por Médico
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {viewMode === "modalidade" ? (
              modalityProduction.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-semibold">{item.modalidade}</h3>
                      <p className="text-sm text-gray-600">
                        Categoria: {item.categoria} | Prioridade: {item.prioridade}
                      </p>
                    </div>
                    {getPerformanceBadge(item.performance)}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Meta</p>
                      <p className="font-semibold">{item.meta}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Realizado</p>
                      <p className="font-semibold text-blue-600">{item.realizado}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Diferença</p>
                      <p className={`font-semibold ${item.realizado >= item.meta ? 'text-green-600' : 'text-red-600'}`}>
                        {item.realizado - item.meta > 0 ? '+' : ''}{item.realizado - item.meta}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Performance</p>
                      <p className="font-semibold">{item.performance}%</p>
                    </div>
                  </div>
                  
                  <Progress value={Math.min(item.performance, 100)} className="h-2" />
                </div>
              ))
            ) : (
              doctorProduction.map((doctor, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-semibold">{doctor.name}</h3>
                      <p className="text-sm text-gray-600">
                        {doctor.specialty} | {doctor.modalidade} | Categoria: {doctor.categoria}
                      </p>
                    </div>
                    {getPerformanceBadge(doctor.performance)}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Meta</p>
                      <p className="font-semibold">{doctor.meta}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Realizado</p>
                      <p className="font-semibold text-blue-600">{doctor.realizado}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Diferença</p>
                      <p className={`font-semibold ${doctor.realizado >= doctor.meta ? 'text-green-600' : 'text-red-600'}`}>
                        {doctor.realizado - doctor.meta > 0 ? '+' : ''}{doctor.realizado - doctor.meta}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Performance</p>
                      <p className="font-semibold">{doctor.performance}%</p>
                    </div>
                  </div>
                  
                  <Progress value={Math.min(doctor.performance, 100)} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Produção por Especialidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Produção por Especialidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {specialtyProduction.map((specialty, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{specialty.specialty}</p>
                    <p className="text-sm text-gray-600">
                      {specialty.production} / {specialty.target} exames
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      specialty.efficiency >= 100 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {specialty.efficiency}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendência de Produção</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ações de Produção */}
      <Card>
        <CardHeader>
          <CardTitle>Ações para Otimização da Produção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="h-auto flex-col items-start p-4">
              <Users className="h-6 w-6 mb-2" />
              <span className="font-semibold">Escalas Otimizadas</span>
              <span className="text-sm opacity-90">Distribuição de equipes</span>
            </Button>
            
            <Button variant="outline" className="h-auto flex-col items-start p-4">
              <Clock className="h-6 w-6 mb-2" />
              <span className="font-semibold">Gestão de Filas</span>
              <span className="text-sm opacity-90">Redução de espera</span>
            </Button>
            
            <Button variant="outline" className="h-auto flex-col items-start p-4">
              <TrendingUp className="h-6 w-6 mb-2" />
              <span className="font-semibold">Análise de Tendências</span>
              <span className="text-sm opacity-90">Previsão de demanda</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}