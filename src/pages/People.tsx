
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Award, Star, GraduationCap, Target } from "lucide-react";

const careerPlans = [
  {
    name: "Dr. Silva",
    currentLevel: "Pleno",
    nextLevel: "Sênior",
    progress: 75,
    requirements: ["30 exames/mês por 6 meses", "Curso de especialização", "Avaliação 360º"],
    completedRequirements: 2
  },
  {
    name: "Dra. Santos",
    currentLevel: "Júnior",
    nextLevel: "Pleno",
    progress: 45,
    requirements: ["25 exames/mês por 3 meses", "Certificação técnica", "Mentoria"],
    completedRequirements: 1
  },
  {
    name: "Dr. Costa",
    currentLevel: "Sênior",
    nextLevel: "Especialista",
    progress: 60,
    requirements: ["Publicação científica", "Liderança de equipe", "40 exames/mês"],
    completedRequirements: 2
  }
];

const developmentPlans = [
  {
    employee: "Dr. Silva",
    skills: [
      { name: "Liderança", current: 70, target: 85 },
      { name: "Comunicação", current: 85, target: 90 },
      { name: "Técnico", current: 90, target: 95 }
    ]
  },
  {
    employee: "Dra. Santos",
    skills: [
      { name: "Análise", current: 75, target: 85 },
      { name: "Produtividade", current: 80, target: 90 },
      { name: "Qualidade", current: 95, target: 98 }
    ]
  }
];

const bonifications = [
  { name: "Dr. Silva", base: 8000, productivity: 1200, quality: 800, total: 10000 },
  { name: "Dra. Santos", base: 12000, productivity: 2400, quality: 1200, total: 15600 },
  { name: "Dr. Costa", base: 9500, productivity: 1425, quality: 950, total: 11875 },
  { name: "Dra. Lima", base: 7500, productivity: 1125, quality: 750, total: 9375 },
];

export default function People() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">People & RH</h1>
        <p className="text-gray-600 mt-1">Gestão de pessoas, desenvolvimento e carreira</p>
      </div>

      <FilterBar />

      {/* Métricas de RH */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Colaboradores"
          value="156"
          change="+8 novos colaboradores"
          changeType="positive"
          icon={Users}
        />
        <MetricCard
          title="Taxa Retenção"
          value="94.2%"
          change="+2.1% vs ano anterior"
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="Satisfação Geral"
          value="4.6/5"
          change="Pesquisa mensal"
          changeType="positive"
          icon={Star}
        />
        <MetricCard
          title="Treinamentos"
          value="28"
          change="Concluídos no mês"
          changeType="positive"
          icon={GraduationCap}
        />
      </div>

      {/* Plano de Carreira */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Plano de Carreira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {careerPlans.map((plan, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{plan.currentLevel}</Badge>
                      <span className="text-sm text-gray-500">→</span>
                      <Badge>{plan.nextLevel}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{plan.progress}%</p>
                    <p className="text-sm text-gray-500">Progresso</p>
                  </div>
                </div>

                <div className="mb-4">
                  <Progress value={plan.progress} className="h-2" />
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Requisitos para promoção:</p>
                  <div className="space-y-2">
                    {plan.requirements.map((req, reqIndex) => (
                      <div key={reqIndex} className="flex items-center gap-2 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          reqIndex < plan.completedRequirements 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {reqIndex < plan.completedRequirements ? '✓' : '○'}
                        </div>
                        <span className={reqIndex < plan.completedRequirements ? 'line-through text-gray-500' : ''}>
                          {req}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plano de Desenvolvimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Plano de Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {developmentPlans.map((plan, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-4">{plan.employee}</h3>
                <div className="space-y-4">
                  {plan.skills.map((skill, skillIndex) => (
                    <div key={skillIndex}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{skill.name}</span>
                        <span>{skill.current}% / {skill.target}%</span>
                      </div>
                      <div className="relative">
                        <Progress value={skill.current} className="h-2" />
                        <div 
                          className="absolute top-0 h-2 w-1 bg-red-400 rounded"
                          style={{ left: `${skill.target}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Meta: {skill.target}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Bonificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Sistema de Bonificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Colaborador</th>
                  <th className="text-right p-3">Salário Base</th>
                  <th className="text-right p-3">Bônus Produtividade</th>
                  <th className="text-right p-3">Bônus Qualidade</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">% Bônus</th>
                </tr>
              </thead>
              <tbody>
                {bonifications.map((bonus, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{bonus.name}</td>
                    <td className="p-3 text-right">R$ {bonus.base.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-600">R$ {bonus.productivity.toLocaleString()}</td>
                    <td className="p-3 text-right text-blue-600">R$ {bonus.quality.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold">R$ {bonus.total.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary">
                        {Math.round(((bonus.productivity + bonus.quality) / bonus.base) * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Total Bônus Produtividade</p>
              <p className="text-xl font-bold text-green-600">R$ 6.150</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Total Bônus Qualidade</p>
              <p className="text-xl font-bold text-blue-600">R$ 3.700</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Total Bonificações</p>
              <p className="text-xl font-bold text-purple-600">R$ 9.850</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
