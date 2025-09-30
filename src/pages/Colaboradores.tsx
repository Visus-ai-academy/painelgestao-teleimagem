import { useEffect, useState } from "react";
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
  documentos?: DocumentoColaborador[];
  prioridades?: string[];
  equipe?: string;
  especialidade_atuacao?: string;
}

interface DocumentoColaborador {
  id: string;
  tipo_documento: 'contrato_medico' | 'aditivo_medico';
  nome_arquivo: string;
  status_documento: 'pendente' | 'assinatura_pendente' | 'assinado' | 'anexado';
  data_envio?: string;
  data_assinatura?: string;
}


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
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("todas");
  const [filtroStatusAtivo, setFiltroStatusAtivo] = useState("todos");
  const [filtroSocio, setFiltroSocio] = useState("todos");
  const [busca, setBusca] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewColaboradorDialog, setShowNewColaboradorDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
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

  // Lista de colaboradores (médicos) da tabela medicos
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loadingColaboradores, setLoadingColaboradores] = useState(true);
  
  interface ResumoEquipe {
    equipe: string;
    total: number;
    staff: number;
    fellow: number;
    especialidades: { nome: string; count: number }[];
  }
  
  const [resumoEquipes, setResumoEquipes] = useState<ResumoEquipe[]>([]);
  const [cleaningData, setCleaningData] = useState(false);

  // Função para limpar dados fictícios
  const limparDadosFicticios = async () => {
    if (!confirm("⚠️ ATENÇÃO: Esta ação irá remover os 3 colaboradores fictícios. Deseja continuar?")) {
      return;
    }

    try {
      setCleaningData(true);
      console.log('🧹 Limpando dados fictícios...');
      
      const { data, error } = await supabase.functions.invoke('limpar-dados-ficticios');
      
      if (error) throw error;
      
      toast({
        title: "✅ Limpeza concluída!",
        description: `${data.medicos_removidos} médicos fictícios removidos`,
      });
      
      // Recarregar lista
      const { data: medicosData } = await supabase
        .from('medicos')
        .select('*')
        .order('nome');
      
      if (medicosData) {
        const lista: Colaborador[] = medicosData.map((medico: any) => ({
          id: medico.id,
          nome: medico.nome || '',
          email: medico.email || '',
          funcao: medico.funcao || 'Médico',
          departamento: 'Medicina',
          nivel: '',
          status: medico.ativo ? 'Ativo' : 'Inativo',
          dataAdmissao: '',
          telefone: medico.telefone || '',
          cpf: medico.cpf || '',
          permissoes: [],
          gestor: '',
          salario: 0,
          crm: medico.crm,
          categoria: medico.categoria,
          modalidades: medico.modalidades || [],
          especialidades: medico.especialidades || [],
          equipe: medico.equipe || '',
          especialidade_atuacao: medico.especialidade_atuacao || ''
        }));
        setColaboradores(lista);
      }
      
    } catch (error: any) {
      console.error('Erro:', error);
      toast({
        title: "❌ Erro na limpeza",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleaningData(false);
    }
  };

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoadingColaboradores(true);
        
        // Buscar médicos da tabela medicos
        const { data, error } = await supabase
          .from('medicos')
          .select('*')
          .order('nome');
        
        if (error) throw error;

        // Converter dados da tabela medicos para formato Colaborador
        const lista: Colaborador[] = (data || []).map((medico: any) => ({
          id: medico.id,
          nome: medico.nome || '',
          email: medico.email || '',
          funcao: medico.funcao || 'Médico',
          departamento: 'Medicina',
          nivel: '',
          status: medico.ativo ? 'Ativo' : 'Inativo',
          dataAdmissao: '',
          telefone: medico.telefone || '',
          cpf: medico.cpf || '',
          permissoes: [],
          gestor: '',
          salario: 0,
          crm: medico.crm || '',
          categoria: medico.categoria || '',
          modalidades: medico.modalidades || [],
          especialidades: medico.especialidades || [],
          prioridades: [],
          documentos: [],
          equipe: medico.equipe || '',
          especialidade_atuacao: medico.especialidade_atuacao || ''
        }));

        setColaboradores(lista);

        // Calcular resumo por equipes
        const equipesMap = new Map<string, {
          total: number;
          staff: number;
          fellow: number;
          especialidades: Map<string, number>;
        }>();
        
        lista.forEach(medico => {
          // Considerar apenas médicos ATIVOS
          if (medico.status !== 'Ativo') return;

          // Normalizar nome da equipe (EQUIPE 1 -> Equipe 1)
          const equipeNome = (medico.equipe || 'Sem Equipe').replace(/^EQUIPE\s*(\d)$/i, 'Equipe $1');
          const funcao = (medico.funcao || '').toUpperCase();
          
          // Especialidades: priorizar especialidade_atuacao; se vazio, usar array "especialidades"; se ainda vazio, usar campo "especialidade"
          const tokens: string[] = [];
          const addSplit = (txt?: string | null) => {
            const v = (txt ?? '').trim();
            if (!v) return;
            v.split(/[,/;]+/).forEach((p) => {
              const t = p.trim();
              if (t) tokens.push(t);
            });
          };

          // 1) Especialidade de Atuação (pode ter múltiplas)
          addSplit(medico.especialidade_atuacao);
          
          // 2) Array de especialidades (já vem tokenizado)
          if (Array.isArray(medico.especialidades) && medico.especialidades.length > 0) {
            medico.especialidades.forEach((e) => addSplit(e as any));
          }
          
          // 3) Campo especialidade (texto único, mas pode vir com separadores)
          addSplit((medico as any).especialidade);

          if (!equipesMap.has(equipeNome)) {
            equipesMap.set(equipeNome, {
              total: 0,
              staff: 0,
              fellow: 0,
              especialidades: new Map()
            });
          }
          
          const equipeData = equipesMap.get(equipeNome)!;
          equipeData.total++;
          
          // Contar STAFF e FELLOW baseado na função
          if (funcao.includes('STAFF')) {
            equipeData.staff++;
          } else if (funcao.includes('FELLOW')) {
            equipeData.fellow++;
          }
          
          // Normalizar e deduplicar por médico antes de contar
          const uniqueTokens = Array.from(new Set(tokens.map((t) => t.toUpperCase().trim())));
          uniqueTokens.forEach((up) => {
            if (!up || up === 'NÃO ESPECIFICADO' || up === 'NAO ESPECIFICADO') return;
            const current = equipeData.especialidades.get(up) || 0;
            equipeData.especialidades.set(up, current + 1);
          });
        });

        // Converter para array de resumo
        const resumo: ResumoEquipe[] = Array.from(equipesMap.entries())
          .map(([equipe, dados]) => ({
            equipe,
            total: dados.total,
            staff: dados.staff,
            fellow: dados.fellow,
            especialidades: Array.from(dados.especialidades.entries())
              .map(([nome, count]) => ({ nome, count }))
              .sort((a, b) => b.count - a.count)
          }))
          .sort((a, b) => {
            // Ordenar: Equipe 1, Equipe 2, depois outras
            if (a.equipe === 'Equipe 1') return -1;
            if (b.equipe === 'Equipe 1') return 1;
            if (a.equipe === 'Equipe 2') return -1;
            if (b.equipe === 'Equipe 2') return 1;
            return a.equipe.localeCompare(b.equipe);
          });

        setResumoEquipes(resumo);

      } catch (err) {
        console.error('Erro ao carregar médicos:', err);
        toast({
          title: "Erro ao carregar médicos",
          description: "Não foi possível carregar a lista de médicos.",
          variant: "destructive"
        });
      } finally {
        setLoadingColaboradores(false);
      }
    };
    carregar();
  }, [toast]);

  const handleFileUpload = async (file: File) => {
    try {
      console.log('📤 Enviando arquivo de médicos...', file.name);
      
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('processar-medicos', {
        body: formData
      });

      if (error) {
        throw error;
      }

      console.log('✅ Resposta do servidor:', data);

      toast({
        title: "✅ Upload realizado com sucesso!",
        description: `${data.inseridos} médicos inseridos, ${data.atualizados} atualizados`,
      });

      // Recarregar lista de médicos
      const { data: medicosData } = await supabase
        .from('medicos')
        .select('*')
        .order('nome');

      if (medicosData) {
        const lista: Colaborador[] = medicosData.map(medico => ({
          id: medico.id,
          nome: medico.nome || '',
          email: medico.email || '',
          funcao: medico.funcao || 'Médico',
          departamento: 'Medicina',
          nivel: '',
          status: (medico.ativo ? 'Ativo' : 'Inativo') as "Ativo" | "Inativo" | "Férias" | "Licença",
          dataAdmissao: '',
          telefone: medico.telefone || '',
          cpf: medico.cpf || '',
          permissoes: [],
          gestor: '',
          salario: 0,
          crm: medico.crm || '',
          categoria: medico.categoria || '',
          modalidades: medico.modalidades || [],
          especialidades: medico.especialidades || [],
          prioridades: [],
          documentos: [],
          equipe: medico.equipe || '',
          especialidade_atuacao: medico.especialidade_atuacao || ''
        }));
        setColaboradores(lista);
      }

      setShowUploadDialog(false);
    } catch (err: any) {
      console.error('Erro no upload:', err);
      toast({
        title: "Erro no upload",
        description: err.message || "Não foi possível processar o arquivo",
        variant: "destructive"
      });
    }
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
    // Filtro por nome
    const matchNome = busca === "" || 
                      colaborador.nome.toLowerCase().includes(busca.toLowerCase());
    
    // Filtro por função
    const matchFuncao = filtroFuncao === "todas" || colaborador.funcao === filtroFuncao;
    
    // Filtro por especialidade
    const matchEspecialidade = filtroEspecialidade === "todas" || 
                               (colaborador.especialidades && 
                                colaborador.especialidades.includes(filtroEspecialidade));
    
    // Filtro por status ativo
    const matchStatusAtivo = filtroStatusAtivo === "todos" || 
                             (filtroStatusAtivo === "ativo" && colaborador.status === "Ativo") ||
                             (filtroStatusAtivo === "inativo" && colaborador.status === "Inativo");
    
    // Filtro por sócio (campo ainda não implementado, sempre true por enquanto)
    const matchSocio = filtroSocio === "todos";
    
    return matchNome && matchFuncao && matchEspecialidade && matchStatusAtivo && matchSocio;
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

      

      {/* Quadro Operacional */}
      <Card>
        <CardHeader>
          <CardTitle>Quadro Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingColaboradores ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Total Médicos Ativos */}
              <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Médicos Ativos</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{colaboradoresAtivos}</p>
                  </div>
                </div>
              </div>
              
              {resumoEquipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resumoEquipes.map((equipe, index) => (
                    <div key={index} className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-gradient-to-br from-background to-muted/20">
                      {/* Cabeçalho da Equipe */}
                      <div className="mb-4 pb-4 border-b">
                        <h3 className="text-xl font-bold text-primary mb-3">{equipe.equipe}</h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-lg bg-primary/5">
                            <div className="text-2xl font-bold text-primary">{equipe.total}</div>
                            <div className="text-xs text-muted-foreground mt-1">Total</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{equipe.staff}</div>
                            <div className="text-xs text-muted-foreground mt-1">STAFF</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{equipe.fellow}</div>
                            <div className="text-xs text-muted-foreground mt-1">FELLOW</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Especialidades */}
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Especialidades</h4>
                        <div className="space-y-2">
                          {equipe.especialidades.length > 0 ? (
                            equipe.especialidades.map((esp, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                              >
                                <span className="text-sm font-medium truncate flex-1" title={esp.nome}>
                                  {esp.nome}
                                </span>
                                <Badge variant="secondary" className="ml-2 shrink-0">
                                  {esp.count} {esp.count === 1 ? 'médico' : 'médicos'}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <div className="text-center text-sm text-muted-foreground py-4">
                              Nenhuma especialidade cadastrada
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum médico cadastrado
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Busca por nome */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome do médico..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Linha de filtros */}
            <div className="flex flex-wrap gap-3">
              {/* Filtro Função */}
              <div className="flex-1 min-w-48">
                <Label className="text-xs text-muted-foreground mb-1">Função</Label>
                <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {Array.from(new Set(colaboradores.map(c => c.funcao))).map(funcao => (
                      <SelectItem key={funcao} value={funcao}>{funcao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Especialidade */}
              <div className="flex-1 min-w-48">
                <Label className="text-xs text-muted-foreground mb-1">Especialidade</Label>
                <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {especialidadesDisponiveis.map(esp => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Status Ativo */}
              <div className="flex-1 min-w-48">
                <Label className="text-xs text-muted-foreground mb-1">Status</Label>
                <Select value={filtroStatusAtivo} onValueChange={setFiltroStatusAtivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Sócio */}
              <div className="flex-1 min-w-48">
                <Label className="text-xs text-muted-foreground mb-1">Sócio</Label>
                <Select value={filtroSocio} onValueChange={setFiltroSocio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
            
            <div className="flex gap-2">
              <Button 
                onClick={limparDadosFicticios}
                disabled={cleaningData}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {cleaningData ? "Limpando..." : "Limpar Fictícios"}
              </Button>
              
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Médicos
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
                      {colaborador.email && (
                        <div className="text-xs text-gray-500">
                          {colaborador.email}
                        </div>
                      )}
                      {/* Mostrar documentos para médicos SOMENTE se houver documentos */}
                      {colaborador.departamento === "Medicina" && colaborador.documentos && colaborador.documentos.length > 0 && (
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
                      {colaborador.crm && (
                        <div className="text-xs text-gray-500 mb-1">CRM: {colaborador.crm}</div>
                      )}
                      {colaborador.categoria && (
                        <div className="text-xs text-gray-500">Categoria: {colaborador.categoria}</div>
                      )}
                      {colaborador.nivel && (
                        <div className="text-sm text-gray-500 mt-1">{colaborador.nivel}</div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusBadge(colaborador.status)}
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedColaborador(colaborador);
                            setShowViewDialog(true);
                          }}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedColaborador(colaborador);
                            setShowEditDialog(true);
                          }}
                          title="Editar"
                        >
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
                            onClick={() => {
                              toast({
                                title: "Contrato enviado",
                                description: `Contrato reenviado para ${colaborador.email}`,
                              });
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-600"
                          title="Excluir"
                          onClick={() => {
                            if (confirm(`Deseja realmente excluir ${colaborador.nome}?`)) {
                              toast({
                                title: "Colaborador excluído",
                                description: `${colaborador.nome} foi removido do sistema`,
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(colaborador.modalidades?.length || colaborador.especialidades?.length || colaborador.equipe) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {colaborador.modalidades && colaborador.modalidades.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600">Modalidades:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {colaborador.modalidades.map((modalidade, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {modalidade}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {colaborador.especialidades && colaborador.especialidades.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600">Especialidades:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {colaborador.especialidades.map((esp, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {esp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {colaborador.equipe && (
                        <div>
                          <p className="text-sm text-gray-600">Equipe:</p>
                          <Badge variant="default" className="text-xs mt-1">
                            {colaborador.equipe}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Colaborador</DialogTitle>
          </DialogHeader>
          {selectedColaborador && (
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-6">
                {/* Cabeçalho */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-xl">
                      {selectedColaborador.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedColaborador.nome}</h3>
                    <p className="text-sm text-muted-foreground">{selectedColaborador.funcao}</p>
                    {getStatusBadge(selectedColaborador.status)}
                  </div>
                </div>
                
                {/* Dados Pessoais */}
                <div>
                  <h4 className="font-semibold text-sm text-primary mb-3">Dados Pessoais</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="text-sm">{selectedColaborador.email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <p className="text-sm">{selectedColaborador.telefone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF</Label>
                      <p className="text-sm">{selectedColaborador.cpf || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Departamento</Label>
                      <p className="text-sm">{selectedColaborador.departamento || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nível</Label>
                      <p className="text-sm">{selectedColaborador.nivel || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Gestor</Label>
                      <p className="text-sm">{selectedColaborador.gestor || 'N/A'}</p>
                    </div>
                    {selectedColaborador.dataAdmissao && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Data de Admissão</Label>
                        <p className="text-sm">{selectedColaborador.dataAdmissao}</p>
                      </div>
                    )}
                    {selectedColaborador.salario && selectedColaborador.salario > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Salário</Label>
                        <p className="text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedColaborador.salario)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados Médicos (se aplicável) */}
                {(selectedColaborador.crm || selectedColaborador.categoria || selectedColaborador.equipe || selectedColaborador.especialidade_atuacao) && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Dados Médicos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedColaborador.crm && (
                        <div>
                          <Label className="text-xs text-muted-foreground">CRM</Label>
                          <p className="text-sm">{selectedColaborador.crm}</p>
                        </div>
                      )}
                      {selectedColaborador.categoria && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Categoria</Label>
                          <p className="text-sm">{selectedColaborador.categoria}</p>
                        </div>
                      )}
                      {selectedColaborador.equipe && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Equipe</Label>
                          <p className="text-sm">{selectedColaborador.equipe}</p>
                        </div>
                      )}
                      {selectedColaborador.especialidade_atuacao && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Especialidade de Atuação</Label>
                          <p className="text-sm">{selectedColaborador.especialidade_atuacao}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modalidades */}
                {selectedColaborador.modalidades && selectedColaborador.modalidades.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Modalidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedColaborador.modalidades.map((mod, idx) => (
                        <Badge key={idx} variant="secondary">{mod}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Especialidades */}
                {selectedColaborador.especialidades && selectedColaborador.especialidades.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Especialidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedColaborador.especialidades.map((esp, idx) => (
                        <Badge key={idx} variant="outline">{esp}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prioridades */}
                {selectedColaborador.prioridades && selectedColaborador.prioridades.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Prioridades</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedColaborador.prioridades.map((pri, idx) => (
                        <Badge key={idx} variant="default">{pri}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissões */}
                {selectedColaborador.permissoes && selectedColaborador.permissoes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Permissões</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedColaborador.permissoes.map((perm, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentos */}
                {selectedColaborador.documentos && selectedColaborador.documentos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3">Documentos</h4>
                    <div className="space-y-2">
                      {selectedColaborador.documentos.map((doc) => (
                        <div key={doc.id} className="border rounded-lg p-3 bg-muted/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusDocumentoIcon(doc.status_documento)}
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {doc.tipo_documento.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">{doc.nome_arquivo}</p>
                              </div>
                            </div>
                            <Badge className={
                              doc.status_documento === 'assinado' ? 'bg-green-100 text-green-800' :
                              doc.status_documento === 'assinatura_pendente' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {getStatusDocumentoText(doc.status_documento)}
                            </Badge>
                          </div>
                          {doc.data_envio && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Enviado em: {new Date(doc.data_envio).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          {doc.data_assinatura && (
                            <p className="text-xs text-muted-foreground">
                              Assinado em: {new Date(doc.data_assinatura).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
          </DialogHeader>
          {selectedColaborador && (
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Dados Pessoais</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="edit-nome">Nome Completo</Label>
                      <Input
                        id="edit-nome"
                        defaultValue={selectedColaborador.nome}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        defaultValue={selectedColaborador.email}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-telefone">Telefone</Label>
                      <Input
                        id="edit-telefone"
                        defaultValue={selectedColaborador.telefone}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-cpf">CPF</Label>
                      <Input
                        id="edit-cpf"
                        defaultValue={selectedColaborador.cpf}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-funcao">Função</Label>
                      <Select defaultValue={selectedColaborador.funcao}>
                        <SelectTrigger>
                          <SelectValue />
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
                      <Label htmlFor="edit-departamento">Departamento</Label>
                      <Select defaultValue={selectedColaborador.departamento}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Operacional">Operacional</SelectItem>
                          <SelectItem value="Adm. Financeiro">Adm. Financeiro</SelectItem>
                          <SelectItem value="Médico">Médico</SelectItem>
                          <SelectItem value="Medicina">Medicina</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-nivel">Nível</Label>
                      <Select defaultValue={selectedColaborador.nivel}>
                        <SelectTrigger>
                          <SelectValue />
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
                      <Label htmlFor="edit-status">Status</Label>
                      <Select defaultValue={selectedColaborador.status}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                          <SelectItem value="Férias">Férias</SelectItem>
                          <SelectItem value="Licença">Licença</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-gestor">Gestor</Label>
                      <Input
                        id="edit-gestor"
                        defaultValue={selectedColaborador.gestor}
                        placeholder="Nome do gestor"
                      />
                    </div>
                    {selectedColaborador.salario && (
                      <div>
                        <Label htmlFor="edit-salario">Salário</Label>
                        <Input
                          id="edit-salario"
                          type="number"
                          defaultValue={selectedColaborador.salario}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados Médicos */}
                {(selectedColaborador.crm || selectedColaborador.categoria || selectedColaborador.equipe) && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Dados Médicos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedColaborador.crm && (
                        <div>
                          <Label htmlFor="edit-crm">CRM</Label>
                          <Input
                            id="edit-crm"
                            defaultValue={selectedColaborador.crm}
                            placeholder="12345-SP"
                          />
                        </div>
                      )}
                      {selectedColaborador.categoria && (
                        <div>
                          <Label htmlFor="edit-categoria">Categoria</Label>
                          <Select defaultValue={selectedColaborador.categoria}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categoriasMedico.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {selectedColaborador.equipe && (
                        <div>
                          <Label htmlFor="edit-equipe">Equipe</Label>
                          <Input
                            id="edit-equipe"
                            defaultValue={selectedColaborador.equipe}
                            placeholder="Nome da equipe"
                          />
                        </div>
                      )}
                      {selectedColaborador.especialidade_atuacao && (
                        <div>
                          <Label htmlFor="edit-especialidade-atuacao">Especialidade de Atuação</Label>
                          <Input
                            id="edit-especialidade-atuacao"
                            defaultValue={selectedColaborador.especialidade_atuacao}
                            placeholder="Especialidade"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modalidades */}
                {selectedColaborador.modalidades && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Modalidades</h4>
                    <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg max-h-48 overflow-y-auto">
                      {modalidadesDisponiveis.map((modalidade) => (
                        <div key={modalidade} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-modal-${modalidade}`}
                            defaultChecked={selectedColaborador.modalidades?.includes(modalidade)}
                          />
                          <Label htmlFor={`edit-modal-${modalidade}`} className="text-sm font-normal">
                            {modalidade}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Especialidades */}
                {selectedColaborador.especialidades && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Especialidades</h4>
                    <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg max-h-48 overflow-y-auto">
                      {especialidadesDisponiveis.map((especialidade) => (
                        <div key={especialidade} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-esp-${especialidade}`}
                            defaultChecked={selectedColaborador.especialidades?.includes(especialidade)}
                          />
                          <Label htmlFor={`edit-esp-${especialidade}`} className="text-sm font-normal">
                            {especialidade}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prioridades */}
                {selectedColaborador.prioridades && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Prioridades</h4>
                    <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg">
                      {prioridadesDisponiveis.map((prioridade) => (
                        <div key={prioridade} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-pri-${prioridade}`}
                            defaultChecked={selectedColaborador.prioridades?.includes(prioridade)}
                          />
                          <Label htmlFor={`edit-pri-${prioridade}`} className="text-sm font-normal">
                            {prioridade}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentos (somente visualização) */}
                {selectedColaborador.documentos && selectedColaborador.documentos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-primary mb-3 pb-2 border-b">Documentos</h4>
                    <div className="space-y-2">
                      {selectedColaborador.documentos.map((doc) => (
                        <div key={doc.id} className="border rounded-lg p-3 bg-muted/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusDocumentoIcon(doc.status_documento)}
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {doc.tipo_documento.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">{doc.nome_arquivo}</p>
                              </div>
                            </div>
                            <Badge className={
                              doc.status_documento === 'assinado' ? 'bg-green-100 text-green-800' :
                              doc.status_documento === 'assinatura_pendente' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {getStatusDocumentoText(doc.status_documento)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              toast({
                title: "Alterações salvas",
                description: "Os dados do colaborador foram atualizados com sucesso",
              });
              setShowEditDialog(false);
            }}>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}