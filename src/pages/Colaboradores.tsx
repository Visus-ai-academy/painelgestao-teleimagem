import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FilterBar } from "@/components/FilterBar";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { useMedicoData } from "@/hooks/useMedicoData";
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
  Download,
  Send,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle
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
  // Campos específicos para médicos
  crm?: string;
  categoria?: string;
  modalidades?: string[];
  especialidades?: string[];
  valoresCombinacoes?: Record<string, Record<string, Record<string, number>>>;
  documentos?: DocumentoColaborador[];
}

interface DocumentoColaborador {
  id: string;
  tipo_documento: 'contrato_medico' | 'aditivo_medico';
  nome_arquivo: string;
  status_documento: 'pendente' | 'assinatura_pendente' | 'assinado' | 'anexado';
  data_envio?: string;
  data_assinatura?: string;
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
    salario: 12000,
    crm: "12345-SP",
    categoria: "Radiologista Pleno",
    modalidades: ["Radiologia", "Tomografia"],
    especialidades: ["Radiologia e Diagnóstico por Imagem"],
    documentos: [
      {
        id: "doc1",
        tipo_documento: 'contrato_medico',
        nome_arquivo: 'contrato_joao_silva.pdf',
        status_documento: 'assinado',
        data_assinatura: '2022-03-15T10:00:00Z'
      }
    ]
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
    salario: 15000,
    crm: "23456-SP",
    categoria: "Cardiologista",
    modalidades: ["Ecocardiograma"],
    especialidades: ["Cardiologia"],
    documentos: [
      {
        id: "doc2",
        tipo_documento: 'contrato_medico',
        nome_arquivo: 'contrato_maria_santos.pdf',
        status_documento: 'assinatura_pendente',
        data_envio: '2024-01-10T09:00:00Z'
      }
    ]
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
  const { toast } = useToast();
  const { 
    modalidadesDisponiveis, 
    especialidadesDisponiveis, 
    categoriasExameDisponiveis: categoriasExame, 
    prioridadesDisponiveis, 
    categoriasMedicoDisponiveis: categoriasMedico,
    loading: loadingMedicoData,
    error: errorMedicoData 
  } = useMedicoData();
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
    salario: "",
    endereco: ""
  });
  const [medicoData, setMedicoData] = useState({
    categoria: "",
    modalidades: [] as string[],
    especialidades: [] as string[],
    valoresCombinacoes: {} as Record<string, Record<string, Record<string, Record<string, string>>>>, // modalidade -> especialidade -> categoria_exame -> prioridade -> valor
    crm: "",
    rqe: ""
  });

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

  const handleValorCombinacaoChange = (modalidade: string, especialidade: string, categoriaExame: string, prioridade: string, valor: string) => {
    setMedicoData(prev => {
      const newValues = { ...prev.valoresCombinacoes };
      if (!newValues[modalidade]) newValues[modalidade] = {};
      if (!newValues[modalidade][especialidade]) newValues[modalidade][especialidade] = {};
      if (!newValues[modalidade][especialidade][categoriaExame]) newValues[modalidade][especialidade][categoriaExame] = {};
      newValues[modalidade][especialidade][categoriaExame][prioridade] = valor;
      
      return {
        ...prev,
        valoresCombinacoes: newValues
      };
    });
  };

  const handleNewColaborador = async () => {
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
          categoriasExame.forEach(categoriaExame => {
            prioridadesDisponiveis.forEach(prioridade => {
              const valor = medicoData.valoresCombinacoes[modalidade]?.[especialidade]?.[categoriaExame]?.[prioridade];
              if (!valor || parseFloat(valor) <= 0) {
                combinacoesSemValor.push(`${modalidade} - ${especialidade} - ${categoriaExame} - ${prioridade}`);
              }
            });
          });
        });
      });
      
      if (combinacoesSemValor.length > 0) {
        toast({
          title: "Erro",
          description: `Por favor, defina valores válidos para todas as combinações. Faltam: ${combinacoesSemValor.slice(0, 2).join(', ')}${combinacoesSemValor.length > 2 ? '...' : ''}`,
          variant: "destructive"
        });
        return;
      }
    }

    // Para médicos, gerar e enviar contrato automaticamente
    if (newColaborador.departamento === "Médico") {
      await gerarEnviarContratoMedico();
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
      salario: "",
      endereco: ""
    });
    setMedicoData({
      categoria: "",
      modalidades: [],
      especialidades: [],
      valoresCombinacoes: {},
      crm: "",
      rqe: ""
    });
    setShowNewColaboradorDialog(false);
  };

  const gerarEnviarContratoMedico = async () => {
    try {
      const response = await supabase.functions.invoke('enviar-contrato-medico', {
        body: {
          medicoId: Date.now().toString(), // Seria o ID real do médico
          nomeMedico: newColaborador.nome,
          emailMedico: newColaborador.email,
          crm: "CRM-" + Date.now(), // Seria o CRM real
          especialidades: medicoData.especialidades,
          modalidades: medicoData.modalidades,
          categoria: medicoData.categoria,
          valoresCombinacoes: medicoData.valoresCombinacoes
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Contrato enviado",
        description: `Contrato médico enviado para assinatura de ${newColaborador.nome}`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao enviar contrato",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusDocumentoIcon = (status: string) => {
    switch (status) {
      case 'assinado':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'assinatura_pendente':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'anexado':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'pendente':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusDocumentoText = (status: string) => {
    switch (status) {
      case 'assinado':
        return 'Assinado';
      case 'assinatura_pendente':
        return 'Aguardando Assinatura';
      case 'anexado':
        return 'Anexado';
      case 'pendente':
        return 'Pendente';
      default:
        return 'Desconhecido';
    }
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

  // Mostrar loading se ainda estiver carregando dados das listas
  if (loadingMedicoData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Colaboradores</h1>
          <p className="text-gray-600 mt-1">Carregando configurações...</p>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver problema ao carregar
  if (errorMedicoData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Colaboradores</h1>
          <p className="text-red-600 mt-1">Erro ao carregar configurações: {errorMedicoData}</p>
        </div>
      </div>
    );
  }

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
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Colaborador</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="flex-1 pr-4 overflow-y-auto">
                  <div className="space-y-6">
                    {/* SEÇÃO 1: DADOS PESSOAIS */}
                    <div className="space-y-4">
                      <div className="pb-2 border-b">
                        <h3 className="text-lg font-semibold text-primary">Dados Pessoais</h3>
                        <p className="text-sm text-muted-foreground">Informações básicas do colaborador</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="nome">Nome Completo *</Label>
                          <Input
                            id="nome"
                            value={newColaborador.nome}
                            onChange={(e) => setNewColaborador({...newColaborador, nome: e.target.value})}
                            placeholder="Nome completo do colaborador"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="cpf">CPF *</Label>
                          <Input
                            id="cpf"
                            value={newColaborador.cpf}
                            onChange={(e) => setNewColaborador({...newColaborador, cpf: e.target.value})}
                            placeholder="000.000.000-00"
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
                          <Label htmlFor="telefone">Telefone *</Label>
                          <Input
                            id="telefone"
                            value={newColaborador.telefone}
                            onChange={(e) => setNewColaborador({...newColaborador, telefone: e.target.value})}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <Label htmlFor="endereco">Endereço</Label>
                          <Input
                            id="endereco"
                            value={newColaborador.endereco}
                            onChange={(e) => setNewColaborador({...newColaborador, endereco: e.target.value})}
                            placeholder="Rua, número, bairro, cidade - UF"
                          />
                        </div>
                        
                        {newColaborador.departamento === "Médico" && (
                          <>
                            <div>
                              <Label htmlFor="crm">CRM *</Label>
                              <Input
                                id="crm"
                                value={medicoData.crm || ''}
                                onChange={(e) => setMedicoData({...medicoData, crm: e.target.value})}
                                placeholder="12345-SP"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="rqe">RQE</Label>
                              <Input
                                id="rqe"
                                value={medicoData.rqe || ''}
                                onChange={(e) => setMedicoData({...medicoData, rqe: e.target.value})}
                                placeholder="RQE12345"
                              />
                            </div>
                          </>
                        )}
                        
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
                           <Label htmlFor="departamento">Departamento *</Label>
                           <Select 
                             value={newColaborador.departamento} 
                             onValueChange={(value) => {
                               setNewColaborador({...newColaborador, departamento: value});
                               // Se não for médico, limpar dados médicos
                               if (value !== "Médico") {
                                 setMedicoData({
                                   categoria: "",
                                   modalidades: [],
                                   especialidades: [],
                                   valoresCombinacoes: {},
                                   crm: "",
                                   rqe: ""
                                 });
                               }
                             }}
                           >
                             <SelectTrigger className={newColaborador.departamento === "Médico" ? "border-primary" : ""}>
                               <SelectValue placeholder="Selecione o departamento" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Comercial">Comercial</SelectItem>
                               <SelectItem value="Operacional">Operacional</SelectItem>
                               <SelectItem value="Adm. Financeiro">Adm. Financeiro</SelectItem>
                               <SelectItem value="Médico">Médico</SelectItem>
                             </SelectContent>
                           </Select>
                           {newColaborador.departamento === "Médico" && (
                             <p className="text-xs text-primary mt-1">
                               ✓ Seção de "Serviços Médicos" será exibida abaixo
                             </p>
                           )}
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
                    </div>

                    {/* SEÇÃO 2: SERVIÇOS MÉDICOS */}
                    {newColaborador.departamento === "Médico" && (
                      <div className="space-y-4">
                        <div className="pb-2 border-b">
                          <h3 className="text-lg font-semibold text-primary">Serviços Médicos</h3>
                          <p className="text-sm text-muted-foreground">Defina as modalidades, especialidades e valores por serviço</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
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
                            <div className="grid grid-cols-3 gap-3 mt-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
                              {modalidadesDisponiveis.map((modalidade) => (
                                <div key={modalidade} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`modal-${modalidade}`}
                                    checked={medicoData.modalidades.includes(modalidade)}
                                    onCheckedChange={(checked) => 
                                      handleModalidadeChange(modalidade, checked as boolean)
                                    }
                                  />
                                  <Label htmlFor={`modal-${modalidade}`} className="text-sm font-normal">
                                    {modalidade}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <Label>Especialidades *</Label>
                            <div className="grid grid-cols-2 gap-3 mt-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
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
                              <Label>Valores por Combinação (Modalidade + Especialidade + Categoria do Exame + Prioridade) *</Label>
                              <div className="space-y-4 mt-2 p-4 border rounded-lg max-h-80 overflow-y-auto bg-muted/30">
                                {medicoData.modalidades.map((modalidade) => (
                                  <div key={modalidade} className="bg-background p-4 rounded-lg border-l-4 border-primary">
                                    <h4 className="font-medium text-sm mb-3 text-primary">{modalidade}</h4>
                                    {medicoData.especialidades.map((especialidade) => (
                                      <div key={`${modalidade}-${especialidade}`} className="mb-4 last:mb-0">
                                        <h5 className="text-xs font-medium text-muted-foreground mb-3 bg-muted/50 p-2 rounded">{especialidade}</h5>
                                        {categoriasExame.map((categoriaExame) => (
                                          <div key={`${modalidade}-${especialidade}-${categoriaExame}`} className="mb-3 p-2 border border-dashed border-muted-foreground/30 rounded">
                                            <h6 className="text-xs font-medium text-foreground mb-2 bg-accent/50 p-1 rounded">{categoriaExame}</h6>
                                            <div className="grid grid-cols-3 gap-2">
                                              {prioridadesDisponiveis.map((prioridade) => (
                                                <div key={`${modalidade}-${especialidade}-${categoriaExame}-${prioridade}`} className="space-y-1">
                                                  <Label className="text-xs font-medium">{prioridade}</Label>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">R$</span>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      min="0"
                                                      value={medicoData.valoresCombinacoes[modalidade]?.[especialidade]?.[categoriaExame]?.[prioridade] || ""}
                                                      onChange={(e) => handleValorCombinacaoChange(modalidade, especialidade, categoriaExame, prioridade, e.target.value)}
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
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                * Configure valores específicos para cada combinação de 4 fatores: Modalidade + Especialidade + Categoria do Exame + Prioridade. A remuneração será calculada automaticamente baseada no volume de exames produzidos.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  </ScrollArea>
                  
                  <div className="flex justify-end gap-2 pt-4 border-t">
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
                      <div className="text-sm text-gray-600">
                        {colaborador.funcao} • {colaborador.departamento}
                      </div>
                      <div className="text-xs text-gray-500">
                        Admitido em {new Date(colaborador.dataAdmissao).toLocaleDateString('pt-BR')}
                      </div>
                      {/* Mostrar documentos para médicos */}
                      {colaborador.departamento === "Medicina" && colaborador.documentos && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-700 mb-1">Documentos:</div>
                          <div className="space-y-1">
                            {colaborador.documentos.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-2 text-xs">
                                {getStatusDocumentoIcon(doc.status_documento)}
                                <span className="capitalize">{doc.tipo_documento.replace('_', ' ')}</span>
                                <span className={`px-2 py-1 rounded ${
                                  doc.status_documento === 'assinado' ? 'bg-green-100 text-green-800' :
                                  doc.status_documento === 'assinatura_pendente' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {getStatusDocumentoText(doc.status_documento)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        R$ {colaborador.salario?.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-sm text-gray-500">{colaborador.nivel}</div>
                      {colaborador.crm && (
                        <div className="text-xs text-gray-500">CRM: {colaborador.crm}</div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusBadge(colaborador.status)}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Botão para reenviar contrato se for médico e não estiver assinado */}
                        {colaborador.departamento === "Medicina" && 
                         colaborador.documentos?.some(doc => doc.status_documento !== 'assinado') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-blue-600"
                            title="Reenviar contrato"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                    {colaborador.crm && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Categoria: {colaborador.categoria}</p>
                        <p className="text-xs text-gray-500">
                          Modalidades: {colaborador.modalidades?.join(', ') || 'N/A'}
                        </p>
                      </div>
                    )}
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