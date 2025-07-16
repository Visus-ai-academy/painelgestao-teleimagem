import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/FilterBar";
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Search, 
  Shield, 
  Settings, 
  Eye,
  Edit,
  Trash2
} from "lucide-react";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  funcao: string;
  departamento: string;
  nivel: string;
  status: "Ativo" | "Inativo" | "Férias" | "Licença";
  dataAdmissao: string;
  telefone: string;
  cpf: string;
  permissoes: string[];
  gestor: string;
  salario: number;
  foto?: string;
}

const colaboradores: Colaborador[] = [
  {
    id: "1",
    nome: "Dr. João Silva",
    email: "joao.silva@clinica.com",
    funcao: "Médico Radiologista",
    departamento: "Medicina",
    nivel: "Pleno",
    status: "Ativo",
    dataAdmissao: "2022-03-15",
    telefone: "(11) 99999-1111",
    cpf: "123.456.789-00",
    permissoes: ["dashboard", "volumetria", "operacional"],
    gestor: "Dra. Ana Costa",
    salario: 12000
  },
  {
    id: "2", 
    nome: "Dra. Maria Santos",
    email: "maria.santos@clinica.com",
    funcao: "Médica Cardiologista",
    departamento: "Medicina",
    nivel: "Sênior",
    status: "Ativo",
    dataAdmissao: "2020-01-10",
    telefone: "(11) 99999-2222",
    cpf: "234.567.890-11",
    permissoes: ["dashboard", "volumetria", "operacional", "qualidade"],
    gestor: "Dr. Fernando Costa",
    salario: 15000
  },
  {
    id: "3",
    nome: "Carlos Oliveira",
    email: "carlos.oliveira@clinica.com", 
    funcao: "Técnico em Radiologia",
    departamento: "Técnico",
    nivel: "Pleno",
    status: "Ativo",
    dataAdmissao: "2021-07-20",
    telefone: "(11) 99999-3333",
    cpf: "345.678.901-22",
    permissoes: ["dashboard", "operacional"],
    gestor: "Dr. João Silva",
    salario: 4500
  },
  {
    id: "4",
    nome: "Ana Ferreira",
    email: "ana.ferreira@clinica.com",
    funcao: "Enfermeira",
    departamento: "Enfermagem", 
    nivel: "Sênior",
    status: "Ativo",
    dataAdmissao: "2019-05-30",
    telefone: "(11) 99999-4444",
    cpf: "456.789.012-33",
    permissoes: ["dashboard", "operacional", "people"],
    gestor: "Coordenadora Lucia",
    salario: 5500
  },
  {
    id: "5",
    nome: "Pedro Mendes",
    email: "pedro.mendes@clinica.com",
    funcao: "Administrador TI",
    departamento: "TI",
    nivel: "Especialista",
    status: "Ativo",
    dataAdmissao: "2020-11-15",
    telefone: "(11) 99999-5555", 
    cpf: "567.890.123-44",
    permissoes: ["dashboard", "volumetria", "operacional", "financeiro", "people", "contratos"],
    gestor: "Diretor Geral",
    salario: 8000
  },
  {
    id: "6",
    nome: "Lucia Rocha",
    email: "lucia.rocha@clinica.com",
    funcao: "Coordenadora Enfermagem",
    departamento: "Enfermagem",
    nivel: "Coordenador",
    status: "Ativo",
    dataAdmissao: "2018-02-10",
    telefone: "(11) 99999-6666",
    cpf: "678.901.234-55", 
    permissoes: ["dashboard", "operacional", "people", "escala"],
    gestor: "Diretor Geral",
    salario: 7500
  },
  {
    id: "7",
    nome: "Roberto Santos",
    email: "roberto.santos@clinica.com",
    funcao: "Analista Financeiro", 
    departamento: "Financeiro",
    nivel: "Pleno",
    status: "Ativo",
    dataAdmissao: "2021-09-05",
    telefone: "(11) 99999-7777",
    cpf: "789.012.345-66",
    permissoes: ["dashboard", "financeiro"],
    gestor: "Gerente Financeiro",
    salario: 6000
  },
  {
    id: "8",
    nome: "Camila Costa",
    email: "camila.costa@clinica.com",
    funcao: "Recepcionista",
    departamento: "Atendimento",
    nivel: "Júnior", 
    status: "Férias",
    dataAdmissao: "2023-01-12",
    telefone: "(11) 99999-8888",
    cpf: "890.123.456-77",
    permissoes: ["dashboard"],
    gestor: "Supervisora Atendimento",
    salario: 2800
  }
];

const funcoes = [
  { nome: "Médico Radiologista", count: 15, departamento: "Medicina" },
  { nome: "Médico Cardiologista", count: 8, departamento: "Medicina" },
  { nome: "Técnico em Radiologia", count: 25, departamento: "Técnico" },
  { nome: "Enfermeira", count: 20, departamento: "Enfermagem" },
  { nome: "Administrador TI", count: 3, departamento: "TI" },
  { nome: "Analista Financeiro", count: 5, departamento: "Financeiro" },
  { nome: "Recepcionista", count: 12, departamento: "Atendimento" },
  { nome: "Coordenador", count: 6, departamento: "Gestão" }
];

export default function Colaboradores() {
  const [filtroFuncao, setFiltroFuncao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ativo":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case "Inativo":
        return <Badge className="bg-red-100 text-red-800">Inativo</Badge>;
      case "Férias":
        return <Badge className="bg-blue-100 text-blue-800">Férias</Badge>;
      case "Licença":
        return <Badge className="bg-yellow-100 text-yellow-800">Licença</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const colaboradoresFiltrados = colaboradores.filter(colaborador => {
    const matchFuncao = filtroFuncao === "todas" || colaborador.funcao === filtroFuncao;
    const matchStatus = filtroStatus === "todos" || colaborador.status === filtroStatus;
    const matchBusca = colaborador.nome.toLowerCase().includes(busca.toLowerCase()) ||
                      colaborador.email.toLowerCase().includes(busca.toLowerCase());
    return matchFuncao && matchStatus && matchBusca;
  });

  const colaboradoresAtivos = colaboradores.filter(c => c.status === "Ativo").length;
  const totalColaboradores = colaboradores.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Colaboradores</h1>
        <p className="text-gray-600 mt-1">Cadastro completo de colaboradores e controle de acesso</p>
      </div>

      <FilterBar />

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Colaboradores</p>
                <p className="text-2xl font-bold text-gray-900">{totalColaboradores}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Colaboradores Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{colaboradoresAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Níveis de Acesso</p>
                <p className="text-2xl font-bold text-gray-900">6</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Departamentos</p>
                <p className="text-2xl font-bold text-gray-900">7</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Função */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Função</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {funcoes.map((funcao, index) => (
              <div key={index} className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{funcao.count}</div>
                <div className="font-medium text-sm">{funcao.nome}</div>
                <div className="text-xs text-gray-500">{funcao.departamento}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroFuncao === "todas" ? "default" : "outline"}
                onClick={() => setFiltroFuncao("todas")}
                size="sm"
              >
                Todas Funções
              </Button>
              <Button
                variant={filtroStatus === "todos" ? "default" : "outline"}
                onClick={() => setFiltroStatus("todos")}
                size="sm"
              >
                Todos Status
              </Button>
              <Button
                variant={filtroStatus === "Ativo" ? "default" : "outline"}
                onClick={() => setFiltroStatus("Ativo")}
                size="sm"
              >
                Ativos
              </Button>
            </div>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Colaborador
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Colaboradores */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Colaboradores ({colaboradoresFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {colaboradoresFiltrados.map((colaborador) => (
              <div key={colaborador.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {colaborador.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{colaborador.nome}</h3>
                      <p className="text-sm text-gray-600">{colaborador.funcao}</p>
                      <p className="text-xs text-gray-500">{colaborador.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(colaborador.status)}
                        <Badge variant="outline">{colaborador.nivel}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Admissão: {new Date(colaborador.dataAdmissao).toLocaleDateString('pt-BR')}</p>
                      <p className="text-sm text-gray-600">Gestor: {colaborador.gestor}</p>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Button variant="outline" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm">
                        <Shield className="h-3 w-3 mr-1" />
                        Acesso
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Permissões de acesso:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {colaborador.permissoes.map((permissao, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {permissao}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Salário</p>
                      <p className="font-semibold">R$ {colaborador.salario.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}