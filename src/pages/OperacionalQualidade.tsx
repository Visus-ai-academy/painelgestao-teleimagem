import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Target,
  Users,
  Activity
} from "lucide-react";

const qualityMetrics: any[] = [];

const specialtyQuality: any[] = [];

const doctorQuality: any[] = [];

const teamData: any[] = [];

export default function OperacionalQualidade() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("mensal");
  const [viewMode, setViewMode] = useState<"modalidade" | "medico">("modalidade");
  const [selectedTeam, setSelectedTeam] = useState<string>("todas");
  
  const totalExams = qualityMetrics.reduce((sum, metric) => sum + metric.total, 0);
  const totalApproved = qualityMetrics.reduce((sum, metric) => sum + metric.approved, 0);
  const totalRejected = qualityMetrics.reduce((sum, metric) => sum + metric.rejected, 0);
  const overallQuality = totalExams ? (totalApproved / totalExams) * 100 : 0;
  const rejectionRate = totalExams ? (totalRejected / totalExams) * 100 : 0;

  const getQualityBadge = (quality: number) => {
    if (quality >= 98) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (quality >= 95) return <Badge className="bg-blue-100 text-blue-800">Boa</Badge>;
    if (quality >= 90) return <Badge className="bg-yellow-100 text-yellow-800">Regular</Badge>;
    return <Badge className="bg-red-100 text-red-800">Baixa</Badge>;
  };

  const filteredDoctorQuality = selectedTeam === "todas" 
    ? doctorQuality 
    : doctorQuality.filter(doctor => {
        const team = teamData.find(t => t.members.includes(doctor.name));
        return team?.name === selectedTeam;
      });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Qualidade Operacional</h1>
        <p className="text-gray-600 mt-1">Monitoramento da qualidade dos exames e especialidades</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <FilterBar onPeriodChange={setSelectedPeriod} />
        <div className="flex gap-4">
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="todas">Todas as Equipes</option>
            {teamData.map((team) => (
              <option key={team.name} value={team.name}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Métricas de Qualidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Qualidade Geral"
          value={`${overallQuality.toFixed(1)}%`}
          change="Meta: 95%"
          changeType="positive"
          icon={Target}
        />
        <MetricCard
          title="Exames Aprovados"
          value={totalApproved.toLocaleString()}
          change={`${totalExams} total`}
          changeType="positive"
          icon={CheckCircle}
        />
        <MetricCard
          title="Taxa de Rejeição"
          value={`${((totalRejected / totalExams) * 100).toFixed(1)}%`}
          change="-0.3% vs mês anterior"
          changeType="positive"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Tempo Médio Análise"
          value="2.3h"
          change="Meta: 4h"
          changeType="positive"
          icon={Clock}
        />
      </div>

      {/* Qualidade por Modalidade ou Médico */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {viewMode === "modalidade" ? "Qualidade por Modalidade" : "Qualidade por Médico"}
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
              qualityMetrics.map((metric, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-semibold">{metric.examType}</h3>
                      <p className="text-sm text-gray-600">Categoria: {metric.category}</p>
                    </div>
                    {getQualityBadge(metric.quality)}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-semibold">{metric.total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Aprovados</p>
                      <p className="font-semibold text-green-600">{metric.approved}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Rejeitados</p>
                      <p className="font-semibold text-red-600">{metric.rejected}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Qualidade</p>
                      <p className="font-semibold">{metric.quality}%</p>
                    </div>
                  </div>
                  
                  <Progress value={metric.quality} className="h-2" />
                </div>
              ))
            ) : (
              filteredDoctorQuality.map((doctor, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-semibold">{doctor.name}</h3>
                      <p className="text-sm text-gray-600">Especialidade: {doctor.specialty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getQualityBadge(doctor.quality)}
                      <span className={`text-sm font-medium ${
                        doctor.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {doctor.trend}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Exames</p>
                      <p className="font-semibold">{doctor.exams}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Aprovados</p>
                      <p className="font-semibold text-green-600">{doctor.approved}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Rejeitados</p>
                      <p className="font-semibold text-red-600">{doctor.exams - doctor.approved}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Qualidade</p>
                      <p className="font-semibold">{doctor.quality}%</p>
                    </div>
                  </div>
                  
                  <Progress value={doctor.quality} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Qualidade por Especialidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Qualidade por Especialidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {specialtyQuality.map((specialty, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{specialty.specialty}</p>
                    <p className="text-sm text-gray-600">Qualidade: {specialty.quality}%</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      specialty.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {specialty.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas de Qualidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-l-green-400 pl-4 py-2 bg-green-50">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Mastologia acima da meta</p>
                    <p className="text-xs text-gray-600">98.9% de qualidade (meta: 95%)</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-l-blue-400 pl-4 py-2 bg-blue-50">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Neurologia em alta</p>
                    <p className="text-xs text-gray-600">Melhoria de +0.3% este mês</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-l-yellow-400 pl-4 py-2 bg-yellow-50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Medicina Interna atenção</p>
                    <p className="text-xs text-gray-600">97.6% próximo ao limite mínimo</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações de Melhoria */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Melhoria da Qualidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              className="h-auto flex-col items-start p-4"
              onClick={() => navigate("/operacional/qualidade/treinamento-equipe")}
            >
              <Users className="h-6 w-6 mb-2" />
              <span className="font-semibold">Treinamento Equipe</span>
              <span className="text-sm opacity-90">Capacitação técnica</span>
            </Button>
            
            <Button variant="outline" className="h-auto flex-col items-start p-4">
              <Activity className="h-6 w-6 mb-2" />
              <span className="font-semibold">Auditoria Interna</span>
              <span className="text-sm opacity-90">Revisão de processos</span>
            </Button>
            
            <Button variant="outline" className="h-auto flex-col items-start p-4">
              <Target className="h-6 w-6 mb-2" />
              <span className="font-semibold">Plano de Ação</span>
              <span className="text-sm opacity-90">Metas específicas</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}