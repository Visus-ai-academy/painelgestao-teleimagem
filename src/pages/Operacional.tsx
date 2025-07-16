
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Users, Clock, Award, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const teamPerformance = [
  { 
    team: "Equipe A", 
    production: { meta: 100, realizado: 95 },
    quality: { meta: 98, realizado: 97 },
    efficiency: { meta: 90, realizado: 88 },
    members: [
      { name: "Dr. João Silva", especialidade: "NE", modalidade: "MR", status: "Ativo", experiencia: "5 anos" },
      { name: "Dra. Ana Costa", especialidade: "CA", modalidade: "CT", status: "Ativo", experiencia: "8 anos" },
      { name: "Dr. Carlos Lima", especialidade: "ME", modalidade: "DO", status: "Férias", experiencia: "3 anos" }
    ]
  },
  { 
    team: "Equipe B", 
    production: { meta: 100, realizado: 102 },
    quality: { meta: 98, realizado: 99 },
    efficiency: { meta: 90, realizado: 92 },
    members: [
      { name: "Dra. Maria Santos", especialidade: "MI", modalidade: "MG", status: "Ativo", experiencia: "12 anos" },
      { name: "Dr. Pedro Oliveira", especialidade: "MA", modalidade: "RX", status: "Ativo", experiencia: "7 anos" },
      { name: "Dra. Sofia Mendes", especialidade: "CA", modalidade: "CT", status: "Licença", experiencia: "4 anos" }
    ]
  },
  { 
    team: "Equipe C", 
    production: { meta: 100, realizado: 87 },
    quality: { meta: 98, realizado: 95 },
    efficiency: { meta: 90, realizado: 85 },
    members: [
      { name: "Dr. Bruno Alves", especialidade: "NE", modalidade: "MR", status: "Ativo", experiencia: "6 anos" },
      { name: "Dra. Lucia Rocha", especialidade: "ME", modalidade: "DO", status: "Ativo", experiencia: "9 anos" }
    ]
  }
];

const doctorPerformance = [
  { name: "Dr. Silva", specialty: "Cardiologia", exams: 45, target: 40, quality: 98 },
  { name: "Dra. Santos", specialty: "Radiologia", exams: 62, target: 60, quality: 97 },
  { name: "Dr. Costa", specialty: "Neurologia", exams: 38, target: 35, quality: 96 },
  { name: "Dra. Lima", specialty: "Ortopedia", exams: 41, target: 45, quality: 99 },
];

export default function Operacional() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Operacional</h1>
        <p className="text-gray-600 mt-1">Gestão de produção, qualidade e escala das equipes</p>
      </div>

      <FilterBar />

      {/* Métricas Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Produção Geral"
          value="94.7%"
          change="Meta: 95%"
          changeType="neutral"
          icon={Target}
        />
        <MetricCard
          title="Qualidade Média"
          value="97.3%"
          change="Acima da meta"
          changeType="positive"
          icon={Award}
        />
        <MetricCard
          title="Eficiência"
          value="88.5%"
          change="+2% vs semana anterior"
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="SLA Cumprimento"
          value="96.1%"
          change="Meta: 95%"
          changeType="positive"
          icon={Clock}
        />
      </div>

      {/* Performance das Equipes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance por Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {teamPerformance.map((team) => (
                <div key={team.team} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">{team.team}</h3>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {team.production.realizado >= team.production.meta ? "No alvo" : "Abaixo"}
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3 mr-1" />
                            Ver Equipe
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Integrantes da {team.team}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {team.members.map((member, index) => (
                              <div key={index} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-semibold">{member.name}</h4>
                                    <p className="text-sm text-gray-600">
                                      Especialidade: {member.especialidade} | Modalidade: {member.modalidade}
                                    </p>
                                    <p className="text-sm text-gray-600">Experiência: {member.experiencia}</p>
                                  </div>
                                  <Badge 
                                    variant={member.status === "Ativo" ? "default" : 
                                            member.status === "Férias" ? "secondary" : "destructive"}
                                  >
                                    {member.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Produção</span>
                        <span>{team.production.realizado}% / {team.production.meta}%</span>
                      </div>
                      <Progress 
                        value={team.production.realizado} 
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Qualidade</span>
                        <span>{team.quality.realizado}% / {team.quality.meta}%</span>
                      </div>
                      <Progress 
                        value={team.quality.realizado} 
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Eficiência</span>
                        <span>{team.efficiency.realizado}% / {team.efficiency.meta}%</span>
                      </div>
                      <Progress 
                        value={team.efficiency.realizado} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Operacionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-l-yellow-400 pl-4 py-2 bg-yellow-50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Equipe C abaixo da meta</p>
                    <p className="text-xs text-gray-600">Produção em 87% (meta: 100%)</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-l-green-400 pl-4 py-2 bg-green-50">
                <div className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Equipe B superou meta</p>
                    <p className="text-xs text-gray-600">Produção em 102%</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-l-blue-400 pl-4 py-2 bg-blue-50">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Escalas para próxima semana</p>
                    <p className="text-xs text-gray-600">Revisar disponibilidade médicos</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Individual dos Médicos */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Individual dos Médicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Médico</th>
                  <th className="text-left p-3">Especialidade</th>
                  <th className="text-center p-3">Exames</th>
                  <th className="text-center p-3">Meta</th>
                  <th className="text-center p-3">Performance</th>
                  <th className="text-center p-3">Qualidade</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {doctorPerformance.map((doctor, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{doctor.name}</td>
                    <td className="p-3">{doctor.specialty}</td>
                    <td className="p-3 text-center">{doctor.exams}</td>
                    <td className="p-3 text-center">{doctor.target}</td>
                    <td className="p-3 text-center">
                      <span className={`font-medium ${
                        doctor.exams >= doctor.target ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {Math.round((doctor.exams / doctor.target) * 100)}%
                      </span>
                    </td>
                    <td className="p-3 text-center">{doctor.quality}%</td>
                    <td className="p-3 text-center">
                      <Badge variant={doctor.exams >= doctor.target ? "default" : "destructive"}>
                        {doctor.exams >= doctor.target ? "No alvo" : "Abaixo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
