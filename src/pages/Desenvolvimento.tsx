import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  BookOpen, 
  Users, 
  Target, 
  Star, 
  TrendingUp, 
  CheckCircle,
  Calendar,
  Award,
  Brain
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { TesteCenarioCBittencourt } from "@/components/TesteCenarioCBittencourt";

const melhoresPraticasRH = [
  {
    categoria: "Onboarding",
    titulo: "Programa de Integração 360°",
    descricao: "Processo estruturado de integração para novos colaboradores",
    status: "Implementado",
    impacto: "Alto",
    beneficios: ["Redução do tempo de adaptação", "Maior retenção", "Produtividade mais rápida"]
  },
  {
    categoria: "Feedback",
    titulo: "Feedback Contínuo",
    descricao: "Sistema de feedback regular entre gestores e equipe",
    status: "Em andamento",
    impacto: "Médio",
    beneficios: ["Melhoria contínua", "Desenvolvimento dirigido", "Relacionamento mais próximo"]
  },
  {
    categoria: "Capacitação",
    titulo: "Learning & Development",
    descricao: "Plataforma de aprendizado contínuo e desenvolvimento técnico",
    status: "Planejado",
    impacto: "Alto",
    beneficios: ["Atualização técnica", "Crescimento profissional", "Competitividade"]
  },
  {
    categoria: "Reconhecimento",
    titulo: "Programa de Reconhecimento",
    descricao: "Sistema de reconhecimento por performance e comportamento",
    status: "Implementado",
    impacto: "Alto",
    beneficios: ["Motivação da equipe", "Cultura positiva", "Engajamento"]
  },
  {
    categoria: "Bem-estar",
    titulo: "Programa de Qualidade de Vida",
    descricao: "Iniciativas focadas no bem-estar físico e mental dos colaboradores",
    status: "Em andamento",
    impacto: "Médio",
    beneficios: ["Redução do estresse", "Melhor saúde", "Maior produtividade"]
  },
  {
    categoria: "Mentoria",
    titulo: "Programa de Mentoria",
    descricao: "Conectar profissionais experientes com novos talentos",
    status: "Planejado",
    impacto: "Alto",
    beneficios: ["Transferência de conhecimento", "Desenvolvimento acelerado", "Networking interno"]
  }
];

const planosTreinamento = [
  {
    colaborador: "Dr. João Silva",
    treinamentos: [
      { nome: "Liderança Médica", progresso: 75, dataInicio: "01/03/2024", dataFim: "30/04/2024" },
      { nome: "Comunicação Assertiva", progresso: 100, dataInicio: "15/02/2024", dataFim: "15/03/2024" },
      { nome: "Gestão de Conflitos", progresso: 30, dataInicio: "01/04/2024", dataFim: "30/05/2024" }
    ]
  },
  {
    colaborador: "Dra. Maria Santos",
    treinamentos: [
      { nome: "Técnicas Avançadas de Diagnóstico", progresso: 90, dataInicio: "10/03/2024", dataFim: "10/05/2024" },
      { nome: "Atualização em Protocolos", progresso: 60, dataInicio: "01/04/2024", dataFim: "30/06/2024" }
    ]
  }
];

const competenciasDesenvolvimento = [
  {
    nome: "Liderança",
    descricao: "Desenvolvimento de habilidades de liderança e gestão de equipes",
    nivel: "Intermediário",
    participantes: 12,
    proximaTurma: "15/05/2024"
  },
  {
    nome: "Comunicação",
    descricao: "Aprimoramento da comunicação interpessoal e corporativa",
    nivel: "Básico",
    participantes: 25,
    proximaTurma: "22/05/2024"
  },
  {
    nome: "Inovação",
    descricao: "Metodologias de inovação e criatividade aplicadas à medicina",
    nivel: "Avançado",
    participantes: 8,
    proximaTurma: "01/06/2024"
  }
];

export default function Desenvolvimento() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Implementado":
        return <Badge className="bg-green-100 text-green-800">Implementado</Badge>;
      case "Em andamento":
        return <Badge className="bg-yellow-100 text-yellow-800">Em andamento</Badge>;
      case "Planejado":
        return <Badge className="bg-blue-100 text-blue-800">Planejado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getImpactoBadge = (impacto: string) => {
    switch (impacto) {
      case "Alto":
        return <Badge className="bg-red-100 text-red-800">Alto Impacto</Badge>;
      case "Médio":
        return <Badge className="bg-orange-100 text-orange-800">Médio Impacto</Badge>;
      case "Baixo":
        return <Badge className="bg-gray-100 text-gray-800">Baixo Impacto</Badge>;
      default:
        return <Badge variant="secondary">{impacto}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Desenvolvimento de Colaboradores</h1>
        <p className="text-gray-600 mt-1">Melhores práticas de RH e programas de desenvolvimento</p>
      </div>

      <FilterBar />

      {/* Métricas de Desenvolvimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Programas Ativos</p>
                <p className="text-2xl font-bold text-gray-900">6</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Colaboradores em Treinamento</p>
                <p className="text-2xl font-bold text-gray-900">45</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Treinamentos Concluídos</p>
                <p className="text-2xl font-bold text-gray-900">123</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Taxa Evolução</p>
                <p className="text-2xl font-bold text-gray-900">87%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Melhores Práticas de RH */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Melhores Práticas de RH para Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {melhoresPraticasRH.map((pratica, index) => (
              <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{pratica.titulo}</h3>
                    <Badge variant="outline" className="mt-1">{pratica.categoria}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(pratica.status)}
                    {getImpactoBadge(pratica.impacto)}
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">{pratica.descricao}</p>
                
                <div>
                  <p className="text-sm font-medium mb-2">Benefícios:</p>
                  <ul className="space-y-1">
                    {pratica.beneficios.map((beneficio, beneficioIndex) => (
                      <li key={beneficioIndex} className="text-sm text-gray-600 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {beneficio}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Planos de Treinamento Individual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Planos de Treinamento Individual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {planosTreinamento.map((plano, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-4">{plano.colaborador}</h3>
                <div className="space-y-4">
                  {plano.treinamentos.map((treinamento, treinamentoIndex) => (
                    <div key={treinamentoIndex} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{treinamento.nome}</span>
                        <span className="text-sm text-gray-600">
                          {treinamento.dataInicio} - {treinamento.dataFim}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={treinamento.progresso} className="flex-1 h-2" />
                        <span className="text-sm font-medium">{treinamento.progresso}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competências em Desenvolvimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Competências em Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {competenciasDesenvolvimento.map((competencia, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold">{competencia.nome}</h3>
                  <Badge variant="outline">{competencia.nivel}</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-4">{competencia.descricao}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Participantes:</span>
                    <span className="font-medium">{competencia.participantes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Próxima turma:</span>
                    <span className="font-medium">{competencia.proximaTurma}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  <Calendar className="h-4 w-4 mr-2" />
                  Inscrever-se
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Teste de Cenário de Preços */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Teste de Cenário - Sistema de Preços
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TesteCenarioCBittencourt />
        </CardContent>
      </Card>
    </div>
  );
}