import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/FilterBar";
import { Target, Award, Star, TrendingUp, Users, CheckCircle } from "lucide-react";

const careerPlans = [
  {
    id: "1",
    name: "Dr. João Silva",
    currentLevel: "Pleno",
    nextLevel: "Sênior",
    progress: 75,
    requirements: ["30 exames/mês por 6 meses", "Curso de especialização", "Avaliação 360º"],
    completedRequirements: 2,
    timeInLevel: "2 anos",
    nextEvaluationDate: "15/08/2024",
    salary: 12000,
    nextLevelSalary: 15000
  },
  {
    id: "2", 
    name: "Dra. Maria Santos",
    currentLevel: "Júnior",
    nextLevel: "Pleno", 
    progress: 45,
    requirements: ["25 exames/mês por 3 meses", "Certificação técnica", "Mentoria"],
    completedRequirements: 1,
    timeInLevel: "1.5 anos",
    nextEvaluationDate: "22/08/2024",
    salary: 8000,
    nextLevelSalary: 12000
  },
  {
    id: "3",
    name: "Dr. Carlos Lima", 
    currentLevel: "Sênior",
    nextLevel: "Especialista",
    progress: 60,
    requirements: ["Publicação científica", "Liderança de equipe", "40 exames/mês"],
    completedRequirements: 2,
    timeInLevel: "3 anos",
    nextEvaluationDate: "05/09/2024",
    salary: 15000,
    nextLevelSalary: 20000
  },
  {
    id: "4",
    name: "Dra. Ana Costa",
    currentLevel: "Especialista", 
    nextLevel: "Coordenador",
    progress: 30,
    requirements: ["Gestão de equipe completa", "MBA em Gestão", "Mentoria de 5+ médicos"],
    completedRequirements: 1,
    timeInLevel: "1 ano",
    nextEvaluationDate: "10/09/2024",
    salary: 20000,
    nextLevelSalary: 25000
  },
  {
    id: "5",
    name: "Dr. Pedro Oliveira",
    currentLevel: "Pleno",
    nextLevel: "Sênior", 
    progress: 85,
    requirements: ["35 exames/mês por 4 meses", "Especialização avançada", "Avaliação 360º"],
    completedRequirements: 3,
    timeInLevel: "2.5 anos", 
    nextEvaluationDate: "18/08/2024",
    salary: 12000,
    nextLevelSalary: 15000
  }
];

const careerLevels = [
  { level: "Trainee", count: 5, color: "bg-gray-100 text-gray-800" },
  { level: "Júnior", count: 12, color: "bg-blue-100 text-blue-800" },
  { level: "Pleno", count: 25, color: "bg-green-100 text-green-800" },
  { level: "Sênior", count: 18, color: "bg-yellow-100 text-yellow-800" },
  { level: "Especialista", count: 8, color: "bg-purple-100 text-purple-800" },
  { level: "Coordenador", count: 3, color: "bg-red-100 text-red-800" }
];

export default function PlanoCarreira() {
  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "text-green-600";
    if (progress >= 60) return "text-yellow-600"; 
    return "text-red-600";
  };

  const getLevelBadge = (level: string) => {
    const levelConfig = careerLevels.find(l => l.level === level);
    return <Badge className={levelConfig?.color}>{level}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Plano de Carreira</h1>
        <p className="text-gray-600 mt-1">Gestão de progressão profissional e desenvolvimento de carreira</p>
      </div>

      <FilterBar />

      {/* Métricas de Carreira */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total em Plano</p>
                <p className="text-2xl font-bold text-gray-900">{careerPlans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Prontos p/ Promoção</p>
                <p className="text-2xl font-bold text-gray-900">
                  {careerPlans.filter(p => p.progress >= 80).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Em Desenvolvimento</p>
                <p className="text-2xl font-bold text-gray-900">
                  {careerPlans.filter(p => p.progress < 80 && p.progress >= 30).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avaliações Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Níveis */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Níveis de Carreira</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {careerLevels.map((level, index) => (
              <div key={index} className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{level.count}</div>
                <Badge className={level.color}>{level.level}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Planos Individuais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Planos de Carreira Individuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {careerPlans.map((plan) => (
              <div key={plan.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getLevelBadge(plan.currentLevel)}
                      <span className="text-sm text-gray-500">→</span>
                      {getLevelBadge(plan.nextLevel)}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Tempo no nível atual: {plan.timeInLevel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getProgressColor(plan.progress)}`}>
                      {plan.progress}%
                    </p>
                    <p className="text-sm text-gray-500">Progresso</p>
                  </div>
                </div>

                <div className="mb-4">
                  <Progress value={plan.progress} className="h-3" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Salário atual:</span>
                      <span className="font-medium">R$ {plan.salary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Próximo nível:</span>
                      <span className="font-medium text-green-600">R$ {plan.nextLevelSalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Próxima avaliação:</span>
                      <span className="font-medium">{plan.nextEvaluationDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="sm">
                    <Star className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                  <Button size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Agendar Avaliação
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}