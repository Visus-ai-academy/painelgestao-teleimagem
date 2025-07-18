import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FilterBar } from "@/components/FilterBar";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Search, 
  Shield, 
  Settings, 
  Eye,
  Edit,
  Trash2,
  Upload,
  Download
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

const modalidadesDisponiveis = [
  "Radiologia",
  "Tomografia",
  "Ressonância",
  "Ultrassom",
  "Mamografia",
  "Densitometria",
  "Medicina Nuclear",
  "PET-CT",
  "Ecocardiograma",
  "Eletrocardiograma"
];

const especialidadesDisponiveis = [
  "Radiologia e Diagnóstico por Imagem",
  "Cardiologia",
  "Neurologia",
  "Ortopedia",
  "Ginecologia",
  "Urologia",
  "Gastroenterologia",
  "Pneumologia",
  "Pediatria",
  "Medicina Nuclear"
];

const prioridadesDisponiveis = [
  "Normal",
  "Urgente",
  "Emergência"
];

const categoriasMedico = [
  "Radiologista Pleno",
  "Radiologista Sênior", 
  "Cardiologista",
  "Clínico Geral",
  "Especialista"
];

export default function Colaboradores() {
  const [filtroFuncao, setFiltroFuncao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewColaboradorDialog, setShowNewColaboradorDialog] = useState(false);
  const [newColaborador, setNewColaborador] = useState({
    nome: "",
    email: "",
    funcao: "",
    departamento: "",
    nivel: "",
    telefone: "",
    cpf: "",
    gestor: "",
    salario: ""
  });
  const [medicoData, setMedicoData] = useState({
    categoria: "",
    modalidades: [] as string[],
    especialidades: [] as string[],
    valoresCombinacoes: {} as Record<string, Record<string, Record<string, string>>> // modalidade -> especialidade -> prioridade -> valor
  });
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    // Simular processamento do arquivo CSV
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Upload realizado",
      description: `Arquivo ${file.name} processado com sucesso! 12 colaboradores foram importados.`,
    });
    
    setShowUploadDialog(false);
  };

  const handleModalidadeChange = (modalidade: string, checked: boolean) => {
    if (checked) {
      setMedicoData(prev => ({
        ...prev,
        modalidades: [...prev.modalidades, modalidade]
      }));
    } else {
      setMedicoData(prev => ({
        ...prev,
        modalidades: prev.modalidades.filter(m => m !== modalidade)
      }));
    }
  };

  const handleEspecialidadeChange = (especialidade: string, checked: boolean) => {
    if (checked) {
      setMedicoData(prev => ({
        ...prev,
        especialidades: [...prev.especialidades, especialidade]
      }));
    } else {
      setMedicoData(prev => ({
        ...prev,
        especialidades: prev.especialidades.filter(e => e !== especialidade)
      }));
    }
  };

  const handleValorCombinacaoChange = (modalidade: string, especialidade: string, prioridade: string, valor: string) => {
    setMedicoData(prev => {
      const newValues = { ...prev.valoresCombinacoes };
      if (!newValues[modalidade]) newValues[modalidade] = {};
      if (!newValues[modalidade][especialidade]) newValues[modalidade][especialidade] = {};
      newValues[modalidade][especialidade][prioridade] = valor;
      
      return {
        ...prev,
        valoresCombinacoes: newValues
      };
    });
  };

  const handleNewColaborador = () => {
    // Validação básica
    if (!newColaborador.nome || !newColaborador.email || !newColaborador.funcao) {
      toast({
        title: "Erro",
        description: "Por favor, preencha os campos obrigatórios: Nome, Email e Função.",
        variant: "destructive"
      });
      return;
    }

    // Validação específica para médicos
    if (newColaborador.departamento === "Médico") {
      if (!medicoData.categoria) {
        toast({
          title: "Erro",
          description: "Por favor, selecione a categoria do médico.",
          variant: "destructive"
        });
        return;
      }
      
      if (medicoData.modalidades.length === 0) {
        toast({
          title: "Erro", 
          description: "Por favor, selecione pelo menos uma modalidade.",
          variant: "destructive"
        });
        return;
      }

      if (medicoData.especialidades.length === 0) {
        toast({
          title: "Erro", 
          description: "Por favor, selecione pelo menos uma especialidade.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se todos os valores das combinações foram preenchidos
      let combinacoesSemValor: string[] = [];
      medicoData.modalidades.forEach(modalidade => {
        medicoData.especialidades.forEach(especialidade => {
          prioridadesDisponiveis.forEach(prioridade => {
            const valor = medicoData.valoresCombinacoes[modalidade]?.[especialidade]?.[prioridade];
            if (!valor || parseFloat(valor) <= 0) {
              combinacoesSemValor.push(`${modalidade} - ${especialidade} - ${prioridade}`);
            }
          });
        });
      });
      
      if (combinacoesSemValor.length > 0) {
        toast({
          title: "Erro",
          description: `Por favor, defina valores válidos para todas as combinações. Faltam: ${combinacoesSemValor.slice(0, 3).join(', ')}${combinacoesSemValor.length > 3 ? '...' : ''}`,
          variant: "destructive"
        });
        return;
      }
    }

    // Simular criação do colaborador
    console.log("Dados do médico:", medicoData);
    toast({
      title: "Colaborador criado",
      description: `${newColaborador.nome} foi adicionado com sucesso!`,
    });

    // Limpar formulário e fechar dialog
    setNewColaborador({
      nome: "",
      email: "",
      funcao: "",
      departamento: "",
      nivel: "",
      telefone: "",
      cpf: "",
      gestor: "",
      salario: ""
    });
    setMedicoData({
      categoria: "",
      modalidades: [],
      especialidades: [],
      valoresCombinacoes: {}
    });
    setShowNewColaboradorDialog(false);
  };

  const downloadTemplate = () => {
    // Simular download do template CSV
    const csvContent = "nome,email,funcao,departamento,nivel,telefone,cpf,gestor,salario\n" +
                      "João Silva,joao@exemplo.com,Médico,Medicina,Pleno,(11)99999-9999,123.456.789-00,Dr. Ana,12000";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'template_colaboradores.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Template baixado",
      description: "Template CSV foi baixado com sucesso!",
    });
  };

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
            
            <div className="flex gap-2">
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload de Colaboradores</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        Faça upload de um arquivo CSV com os dados dos colaboradores
                      </p>
                      <Button
                        variant="outline"
                        onClick={downloadTemplate}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar Template
                      </Button>
                    </div>
                    <FileUpload
                      title="Importar Colaboradores"
                      description="Arraste e solte o arquivo CSV aqui ou clique para selecionar"
                      acceptedTypes={['.csv', 'text/csv']}
                      maxSizeInMB={5}
                      expectedFormat={[
                        'Nome, Email, Função, Departamento, Nível',
                        'Telefone, CPF, Gestor, Salário',
                        'Formato: CSV separado por vírgula'
                      ]}
                      onUpload={handleFileUpload}
                      icon={<Upload className="h-5 w-5" />}
                    />
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showNewColaboradorDialog} onOpenChange={setShowNewColaboradorDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Novo Colaborador
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Colaborador</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={newColaborador.nome}
                        onChange={(e) => setNewColaborador({...newColaborador, nome: e.target.value})}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newColaborador.email}
                        onChange={(e) => setNewColaborador({...newColaborador, email: e.target.value})}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="funcao">Função *</Label>
                      <Select value={newColaborador.funcao} onValueChange={(value) => setNewColaborador({...newColaborador, funcao: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a função" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Médico Radiologista">Médico Radiologista</SelectItem>
                          <SelectItem value="Médico Cardiologista">Médico Cardiologista</SelectItem>
                          <SelectItem value="Técnico em Radiologia">Técnico em Radiologia</SelectItem>
                          <SelectItem value="Enfermeira">Enfermeira</SelectItem>
                          <SelectItem value="Administrador TI">Administrador TI</SelectItem>
                          <SelectItem value="Analista Financeiro">Analista Financeiro</SelectItem>
                          <SelectItem value="Recepcionista">Recepcionista</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="departamento">Departamento</Label>
                      <Select value={newColaborador.departamento} onValueChange={(value) => setNewColaborador({...newColaborador, departamento: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Operacional">Operacional</SelectItem>
                          <SelectItem value="Adm. Financeiro">Adm. Financeiro</SelectItem>
                          <SelectItem value="Médico">Médico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="nivel">Nível</Label>
                      <Select value={newColaborador.nivel} onValueChange={(value) => setNewColaborador({...newColaborador, nivel: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Júnior">Júnior</SelectItem>
                          <SelectItem value="Pleno">Pleno</SelectItem>
                          <SelectItem value="Sênior">Sênior</SelectItem>
                          <SelectItem value="Especialista">Especialista</SelectItem>
                          <SelectItem value="Coordenador">Coordenador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={newColaborador.telefone}
                        onChange={(e) => setNewColaborador({...newColaborador, telefone: e.target.value})}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={newColaborador.cpf}
                        onChange={(e) => setNewColaborador({...newColaborador, cpf: e.target.value})}
                        placeholder="123.456.789-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gestor">Gestor</Label>
                      <Input
                        id="gestor"
                        value={newColaborador.gestor}
                        onChange={(e) => setNewColaborador({...newColaborador, gestor: e.target.value})}
                        placeholder="Nome do gestor"
                      />
                    </div>
                    {newColaborador.departamento !== "Médico" && (
                      <div>
                        <Label htmlFor="salario">Salário</Label>
                        <Input
                          id="salario"
                          type="number"
                          value={newColaborador.salario}
                          onChange={(e) => setNewColaborador({...newColaborador, salario: e.target.value})}
                          placeholder="5000"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Campos específicos para médicos */}
                  {newColaborador.departamento === "Médico" && (
                    <>
                      <Separator className="col-span-2 my-4" />
                      <div className="col-span-2">
                        <h3 className="text-lg font-semibold mb-4">Informações Médicas</h3>
                      </div>
                      
                      <div className="col-span-2">
                        <Label htmlFor="categoria">Categoria *</Label>
                        <Select value={medicoData.categoria} onValueChange={(value) => setMedicoData({...medicoData, categoria: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoriasMedico.map((categoria) => (
                              <SelectItem key={categoria} value={categoria}>
                                {categoria}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label>Modalidades que Lauda *</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2 p-4 border rounded-lg max-h-64 overflow-y-auto">
                          {modalidadesDisponiveis.map((modalidade) => (
                            <div key={modalidade} className="flex items-center space-x-2">
                              <Checkbox
                                id={modalidade}
                                checked={medicoData.modalidades.includes(modalidade)}
                                onCheckedChange={(checked) => 
                                  handleModalidadeChange(modalidade, checked as boolean)
                                }
                              />
                              <Label htmlFor={modalidade} className="text-sm font-normal">
                                {modalidade}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Label>Especialidades *</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2 p-4 border rounded-lg max-h-64 overflow-y-auto">
                          {especialidadesDisponiveis.map((especialidade) => (
                            <div key={especialidade} className="flex items-center space-x-2">
                              <Checkbox
                                id={especialidade}
                                checked={medicoData.especialidades.includes(especialidade)}
                                onCheckedChange={(checked) => 
                                  handleEspecialidadeChange(especialidade, checked as boolean)
                                }
                              />
                              <Label htmlFor={especialidade} className="text-sm font-normal">
                                {especialidade}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {(medicoData.modalidades.length > 0 && medicoData.especialidades.length > 0) && (
                        <div className="col-span-2">
                          <Label>Valores por Combinação (Modalidade + Especialidade + Prioridade) *</Label>
                          <div className="space-y-4 mt-2 p-4 border rounded-lg max-h-96 overflow-y-auto">
                            {medicoData.modalidades.map((modalidade) => (
                              <div key={modalidade} className="border-l-4 border-blue-200 pl-4">
                                <h4 className="font-medium text-sm mb-3 text-blue-700">{modalidade}</h4>
                                {medicoData.especialidades.map((especialidade) => (
                                  <div key={`${modalidade}-${especialidade}`} className="mb-4 last:mb-0">
                                    <h5 className="text-xs font-medium text-gray-600 mb-2">{especialidade}</h5>
                                    <div className="grid grid-cols-3 gap-2">
                                      {prioridadesDisponiveis.map((prioridade) => (
                                        <div key={`${modalidade}-${especialidade}-${prioridade}`} className="space-y-1">
                                          <Label className="text-xs">{prioridade}</Label>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs">R$</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={medicoData.valoresCombinacoes[modalidade]?.[especialidade]?.[prioridade] || ""}
                                              onChange={(e) => handleValorCombinacaoChange(modalidade, especialidade, prioridade, e.target.value)}
                                              placeholder="0,00"
                                              className="text-xs h-8"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            * Defina valores específicos para cada combinação. Estes valores serão utilizados para calcular o repasse médico baseado no volume produzido.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-end gap-2 mt-6 col-span-2">
                    <Button variant="outline" onClick={() => setShowNewColaboradorDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleNewColaborador}>
                      Cadastrar Colaborador
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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