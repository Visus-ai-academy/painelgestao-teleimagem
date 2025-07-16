import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  Target,
  TrendingUp
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";

interface MedicoRecomendacao {
  id: string;
  nome: string;
  especialidade: string;
  modalidade: string;
  scoreTreinamento: number;
  recomendacoes: string[];
  prioridade: "Alta" | "Média" | "Baixa";
  statusTreinamento: "Pendente" | "Em andamento" | "Concluído";
  proximoTreinamento?: string;
}

const medicosRecomendacoes: MedicoRecomendacao[] = [
  {
    id: "1",
    nome: "Dr. João Silva",
    especialidade: "NE",
    modalidade: "MR",
    scoreTreinamento: 75,
    recomendacoes: [
      "Atualização em protocolos de segurança",
      "Treinamento em novas técnicas de MR",
      "Curso de comunicação com pacientes"
    ],
    prioridade: "Alta",
    statusTreinamento: "Pendente",
    proximoTreinamento: "15/05/2024"
  },
  {
    id: "2",
    nome: "Dra. Maria Santos",
    especialidade: "CA",
    modalidade: "CT",
    scoreTreinamento: 92,
    recomendacoes: [
      "Certificação avançada em CT",
      "Workshop de casos complexos"
    ],
    prioridade: "Baixa",
    statusTreinamento: "Em andamento",
    proximoTreinamento: "22/05/2024"
  },
  {
    id: "3",
    nome: "Dr. Carlos Lima",
    especialidade: "ME",
    modalidade: "DO",
    scoreTreinamento: 68,
    recomendacoes: [
      "Revisão de protocolos básicos",
      "Treinamento em qualidade de imagem",
      "Curso de gestão de tempo",
      "Atualização em legislação médica"
    ],
    prioridade: "Alta",
    statusTreinamento: "Pendente",
    proximoTreinamento: "20/05/2024"
  },
  {
    id: "4",
    nome: "Dra. Ana Costa",
    especialidade: "MI",
    modalidade: "MG",
    scoreTreinamento: 88,
    recomendacoes: [
      "Especialização em casos pediátricos",
      "Treinamento em liderança"
    ],
    prioridade: "Média",
    statusTreinamento: "Concluído"
  },
  {
    id: "5",
    nome: "Dr. Pedro Oliveira",
    especialidade: "MA",
    modalidade: "RX",
    scoreTreinamento: 82,
    recomendacoes: [
      "Atualização em radiologia digital",
      "Curso de otimização de processos"
    ],
    prioridade: "Média",
    statusTreinamento: "Em andamento",
    proximoTreinamento: "28/05/2024"
  }
];

export default function TreinamentoEquipe() {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Concluído":
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
      case "Em andamento":
        return <Badge className="bg-blue-100 text-blue-800">Em andamento</Badge>;
      case "Pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPrioridadeBadge = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return <Badge className="bg-red-100 text-red-800">Alta Prioridade</Badge>;
      case "Média":
        return <Badge className="bg-orange-100 text-orange-800">Média Prioridade</Badge>;
      case "Baixa":
        return <Badge className="bg-gray-100 text-gray-800">Baixa Prioridade</Badge>;
      default:
        return <Badge variant="secondary">{prioridade}</Badge>;
    }
  };

  const medicosFiltrados = medicosRecomendacoes.filter(medico => {
    const matchStatus = filtroStatus === "todos" || medico.statusTreinamento === filtroStatus;
    const matchPrioridade = filtroPrioridade === "todas" || medico.prioridade === filtroPrioridade;
    return matchStatus && matchPrioridade;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Treinamento da Equipe</h1>
        <p className="text-gray-600 mt-1">Lista de médicos e recomendações de treinamento</p>
      </div>

      <FilterBar />

      {/* Resumo dos Treinamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Médicos</p>
                <p className="text-2xl font-bold text-gray-900">{medicosRecomendacoes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Alta Prioridade</p>
                <p className="text-2xl font-bold text-gray-900">
                  {medicosRecomendacoes.filter(m => m.prioridade === "Alta").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Treinamentos Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {medicosRecomendacoes.filter(m => m.statusTreinamento === "Pendente").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Score Médio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(medicosRecomendacoes.reduce((acc, m) => acc + m.scoreTreinamento, 0) / medicosRecomendacoes.length)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium">Filtros:</span>
            <div className="flex gap-2">
              <Button
                variant={filtroStatus === "todos" ? "default" : "outline"}
                onClick={() => setFiltroStatus("todos")}
                size="sm"
              >
                Todos os Status
              </Button>
              <Button
                variant={filtroStatus === "Pendente" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Pendente")}
                size="sm"
              >
                Pendentes
              </Button>
              <Button
                variant={filtroStatus === "Em andamento" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Em andamento")}
                size="sm"
              >
                Em Andamento
              </Button>
              <Button
                variant={filtroStatus === "Concluído" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Concluído")}
                size="sm"
              >
                Concluídos
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroPrioridade === "todas" ? "default" : "outline"}
                onClick={() => setFiltroPrioridade("todas")}
                size="sm"
              >
                Todas Prioridades
              </Button>
              <Button
                variant={filtroPrioridade === "Alta" ? "default" : "outline"}
                onClick={() => setFiltroPrioridade("Alta")}
                size="sm"
              >
                Alta
              </Button>
              <Button
                variant={filtroPrioridade === "Média" ? "default" : "outline"}
                onClick={() => setFiltroPrioridade("Média")}
                size="sm"
              >
                Média
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Médicos com Recomendações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {medicosFiltrados.map((medico) => (
          <Card key={medico.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{medico.nome}</CardTitle>
                  <p className="text-sm text-gray-600">{medico.especialidade} - {medico.modalidade}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {getStatusBadge(medico.statusTreinamento)}
                  {getPrioridadeBadge(medico.prioridade)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Score de Treinamento */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Score de Treinamento</span>
                  <span className={`text-lg font-bold ${getScoreColor(medico.scoreTreinamento)}`}>
                    {medico.scoreTreinamento}%
                  </span>
                </div>
                <Progress value={medico.scoreTreinamento} className="h-2" />
              </div>

              {/* Recomendações */}
              <div className="mb-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Recomendações de Treinamento
                </h4>
                <div className="space-y-2">
                  {medico.recomendacoes.map((recomendacao, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{recomendacao}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Próximo Treinamento */}
              {medico.proximoTreinamento && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Próximo treinamento:</span>
                    <span>{medico.proximoTreinamento}</span>
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Ver Detalhes
                </Button>
                <Button size="sm" className="flex-1">
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar Treinamento
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}