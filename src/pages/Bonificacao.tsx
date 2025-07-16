import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/FilterBar";
import { Award, DollarSign, TrendingUp, Target, Calculator, Users } from "lucide-react";

const bonifications = [
  { 
    id: "1",
    name: "Dr. João Silva", 
    base: 12000, 
    productivity: 1800, 
    quality: 1200, 
    punctuality: 300,
    leadership: 500,
    total: 15800,
    position: "Pleno",
    examesRealizados: 320,
    metaExames: 300,
    qualidadeScore: 95
  },
  { 
    id: "2",
    name: "Dra. Maria Santos", 
    base: 15000, 
    productivity: 3000, 
    quality: 1500, 
    punctuality: 450,
    leadership: 800,
    total: 20750,
    position: "Sênior",
    examesRealizados: 450,
    metaExames: 400,
    qualidadeScore: 98
  },
  { 
    id: "3",
    name: "Dr. Carlos Lima", 
    base: 9500, 
    productivity: 1425, 
    quality: 950, 
    punctuality: 285,
    leadership: 0,
    total: 12160,
    position: "Pleno",
    examesRealizados: 285,
    metaExames: 300,
    qualidadeScore: 92
  },
  { 
    id: "4",
    name: "Dra. Ana Costa", 
    base: 20000, 
    productivity: 4000, 
    quality: 2000, 
    punctuality: 600,
    leadership: 1200,
    total: 27800,
    position: "Especialista",
    examesRealizados: 520,
    metaExames: 450,
    qualidadeScore: 99
  },
  { 
    id: "5",
    name: "Dr. Pedro Oliveira", 
    base: 11000, 
    productivity: 1650, 
    quality: 1100, 
    punctuality: 330,
    leadership: 200,
    total: 14280,
    position: "Pleno",
    examesRealizados: 330,
    metaExames: 300,
    qualidadeScore: 96
  }
];

const bonusRules = [
  {
    categoria: "Produtividade",
    descricao: "Baseado no número de exames realizados vs meta",
    formula: "Meta batida: 15% do salário base | Cada 10% acima: +2% adicional",
    cor: "bg-blue-100 text-blue-800"
  },
  {
    categoria: "Qualidade", 
    descricao: "Score de qualidade baseado em avaliações",
    formula: "Score 95-100%: 10% do salário | Score 90-94%: 7% | Score 85-89%: 5%",
    cor: "bg-green-100 text-green-800"
  },
  {
    categoria: "Pontualidade",
    descricao: "Presença e pontualidade nas escalas",
    formula: "100% presença: 3% do salário | 95-99%: 2% | 90-94%: 1%",
    cor: "bg-yellow-100 text-yellow-800"
  },
  {
    categoria: "Liderança",
    descricao: "Atividades de mentoria e liderança",
    formula: "Mentor ativo: 4% do salário | Líder de equipe: 6% | Coordenador: 8%",
    cor: "bg-purple-100 text-purple-800"
  }
];

export default function Bonificacao() {
  const getTotalBonusPercentage = (bonus: typeof bonifications[0]) => {
    const bonusTotal = bonus.productivity + bonus.quality + bonus.punctuality + bonus.leadership;
    return Math.round((bonusTotal / bonus.base) * 100);
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 98) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (score >= 95) return <Badge className="bg-blue-100 text-blue-800">Muito Bom</Badge>;
    if (score >= 90) return <Badge className="bg-yellow-100 text-yellow-800">Bom</Badge>;
    return <Badge className="bg-red-100 text-red-800">Melhorar</Badge>;
  };

  const totalBonusDistributed = bonifications.reduce((acc, b) => acc + (b.total - b.base), 0);
  const averageBonusPercentage = Math.round(
    bonifications.reduce((acc, b) => acc + getTotalBonusPercentage(b), 0) / bonifications.length
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sistema de Bonificação</h1>
        <p className="text-gray-600 mt-1">Gestão de bonificações e incentivos por performance</p>
      </div>

      <FilterBar />

      {/* Métricas de Bonificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Distribuído</p>
                <p className="text-2xl font-bold text-gray-900">R$ {totalBonusDistributed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Bônus Médio</p>
                <p className="text-2xl font-bold text-gray-900">{averageBonusPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Colaboradores</p>
                <p className="text-2xl font-bold text-gray-900">{bonifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Top Performer</p>
                <p className="text-lg font-bold text-gray-900">
                  {Math.max(...bonifications.map(b => getTotalBonusPercentage(b)))}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regras de Bonificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Regras de Bonificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bonusRules.map((rule, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={rule.cor}>{rule.categoria}</Badge>
                </div>
                <p className="text-sm text-gray-700 mb-2">{rule.descricao}</p>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{rule.formula}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Bonificações */}
      <Card>
        <CardHeader>
          <CardTitle>Bonificações por Colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Colaborador</th>
                  <th className="text-right p-3">Salário Base</th>
                  <th className="text-right p-3">Produtividade</th>
                  <th className="text-right p-3">Qualidade</th>
                  <th className="text-right p-3">Pontualidade</th>
                  <th className="text-right p-3">Liderança</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">% Bônus</th>
                  <th className="text-center p-3">Performance</th>
                </tr>
              </thead>
              <tbody>
                {bonifications.map((bonus) => (
                  <tr key={bonus.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{bonus.name}</p>
                        <p className="text-sm text-gray-600">{bonus.position}</p>
                      </div>
                    </td>
                    <td className="p-3 text-right">R$ {bonus.base.toLocaleString()}</td>
                    <td className="p-3 text-right text-blue-600">R$ {bonus.productivity.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-600">R$ {bonus.quality.toLocaleString()}</td>
                    <td className="p-3 text-right text-yellow-600">R$ {bonus.punctuality.toLocaleString()}</td>
                    <td className="p-3 text-right text-purple-600">R$ {bonus.leadership.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold">R$ {bonus.total.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary">
                        {getTotalBonusPercentage(bonus)}%
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {getPerformanceBadge(bonus.qualidadeScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento Individual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bonifications.slice(0, 2).map((bonus) => (
          <Card key={bonus.id}>
            <CardHeader>
              <CardTitle className="text-lg">{bonus.name}</CardTitle>
              <p className="text-sm text-gray-600">{bonus.position}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Exames realizados:</span>
                  <span className="font-medium">{bonus.examesRealizados} / {bonus.metaExames}</span>
                </div>
                <div className="flex justify-between">
                  <span>Score de qualidade:</span>
                  <span className="font-medium">{bonus.qualidadeScore}%</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total com bônus:</span>
                    <span className="text-green-600">R$ {bonus.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumos Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Bônus Produtividade</p>
            <p className="text-xl font-bold text-green-600">
              R$ {bonifications.reduce((acc, b) => acc + b.productivity, 0).toLocaleString()}
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Bônus Qualidade</p>
            <p className="text-xl font-bold text-blue-600">
              R$ {bonifications.reduce((acc, b) => acc + b.quality, 0).toLocaleString()}
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Bonificações</p>
            <p className="text-xl font-bold text-purple-600">
              R$ {totalBonusDistributed.toLocaleString()}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}