import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserCheck, UserX, Search, Filter } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
  modalidade: string;
  status: "Ativo" | "Ausente" | "Férias" | "Licença";
  turno: string;
  experiencia: string;
  examesHoje: number;
  performanceMedia: number;
}

const medicosData: Medico[] = [
  {
    id: "1",
    nome: "Dr. João Silva",
    especialidade: "NE",
    modalidade: "MR",
    status: "Ativo",
    turno: "Manhã",
    experiencia: "5 anos",
    examesHoje: 12,
    performanceMedia: 95
  },
  {
    id: "2",
    nome: "Dra. Maria Santos",
    especialidade: "CA",
    modalidade: "CT",
    status: "Ativo",
    turno: "Tarde",
    experiencia: "8 anos",
    examesHoje: 15,
    performanceMedia: 98
  },
  {
    id: "3",
    nome: "Dr. Carlos Lima",
    especialidade: "ME",
    modalidade: "DO",
    status: "Ausente",
    turno: "Manhã",
    experiencia: "3 anos",
    examesHoje: 0,
    performanceMedia: 92
  },
  {
    id: "4",
    nome: "Dra. Ana Costa",
    especialidade: "MI",
    modalidade: "MG",
    status: "Ativo",
    turno: "Noite",
    experiencia: "12 anos",
    examesHoje: 18,
    performanceMedia: 97
  },
  {
    id: "5",
    nome: "Dr. Pedro Oliveira",
    especialidade: "MA",
    modalidade: "RX",
    status: "Férias",
    turno: "Tarde",
    experiencia: "7 anos",
    examesHoje: 0,
    performanceMedia: 93
  }
];

export default function MedicosAtivos() {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ativo":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case "Ausente":
        return <Badge className="bg-red-100 text-red-800">Ausente</Badge>;
      case "Férias":
        return <Badge className="bg-blue-100 text-blue-800">Férias</Badge>;
      case "Licença":
        return <Badge className="bg-yellow-100 text-yellow-800">Licença</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const medicosFiltrados = medicosData.filter(medico => {
    const matchStatus = filtroStatus === "todos" || medico.status === filtroStatus;
    const matchBusca = medico.nome.toLowerCase().includes(busca.toLowerCase()) ||
                      medico.especialidade.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  const medicosAtivos = medicosFiltrados.filter(m => m.status === "Ativo");
  const medicosAusentes = medicosFiltrados.filter(m => m.status !== "Ativo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Médicos Ativos</h1>
        <p className="text-gray-600 mt-1">Lista completa de médicos e seus status</p>
      </div>

      <FilterBar />

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Médicos Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{medicosAtivos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserX className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ausentes/Afastados</p>
                <p className="text-2xl font-bold text-gray-900">{medicosAusentes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Médicos</p>
                <p className="text-2xl font-bold text-gray-900">{medicosData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou especialidade..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroStatus === "todos" ? "default" : "outline"}
                onClick={() => setFiltroStatus("todos")}
              >
                Todos
              </Button>
              <Button
                variant={filtroStatus === "Ativo" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Ativo")}
              >
                Ativos
              </Button>
              <Button
                variant={filtroStatus === "Ausente" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Ausente")}
              >
                Ausentes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Médicos Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Médicos Ativos ({medicosAtivos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {medicosAtivos.map((medico) => (
              <div key={medico.id} className="border rounded-lg p-4 bg-green-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{medico.nome}</h3>
                    <p className="text-sm text-gray-600">{medico.especialidade} - {medico.modalidade}</p>
                  </div>
                  {getStatusBadge(medico.status)}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Turno:</span>
                    <span className="font-medium">{medico.turno}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Experiência:</span>
                    <span className="font-medium">{medico.experiencia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exames hoje:</span>
                    <span className="font-medium text-blue-600">{medico.examesHoje}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Performance:</span>
                    <span className="font-medium text-green-600">{medico.performanceMedia}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Médicos Ausentes */}
      {medicosAusentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Médicos Ausentes/Afastados ({medicosAusentes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicosAusentes.map((medico) => (
                <div key={medico.id} className="border rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{medico.nome}</h3>
                      <p className="text-sm text-gray-600">{medico.especialidade} - {medico.modalidade}</p>
                    </div>
                    {getStatusBadge(medico.status)}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Turno:</span>
                      <span className="font-medium">{medico.turno}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Experiência:</span>
                      <span className="font-medium">{medico.experiencia}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Performance média:</span>
                      <span className="font-medium">{medico.performanceMedia}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}