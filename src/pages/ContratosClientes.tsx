import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Plus,
  FileCheck,
  Download,
  Trash2,
  Upload,
  Pencil,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  History,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/FilterBar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContratoCliente {
  id: string;
  clienteId: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  status: "Ativo" | "Vencido" | "A Vencer";
  servicos: ServicoContratado[];
  valorTotal: number;
  diasParaVencer: number;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "CDI";
  // Dados do cliente
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  emailFinanceiro?: string;
  emailOperacional?: string;
  site?: string;
  responsavel?: string;
  telefoneResponsavel?: string;
  emailResponsavel?: string;
  // Configurações de cobrança
  cobrancaIntegracao: boolean;
  valorIntegracao?: number;
  cobrancaSuporte: boolean;
  valorSuporte?: number;
  // Regras e condições de preço
  consideraPlantao?: boolean;
  condVolume?: string;
  diaVencimento?: number;
  descontoPercentual?: number;
  acrescimoPercentual?: number;
  faixasVolume?: any[];
  configuracoesFranquia?: any;
  configuracoesIntegracao?: any;
  // Histórico de alterações
  termosAditivos?: TermoAditivo[];
  documentos?: DocumentoCliente[];
}

interface DocumentoCliente {
  id: string;
  tipo_documento: 'contrato' | 'termo_aditivo' | 'termo_renovacao';
  nome_arquivo: string;
  url_arquivo?: string;
  status_documento: 'pendente' | 'anexado' | 'assinatura_pendente' | 'assinado';
  clicksign_document_key?: string;
  data_envio_assinatura?: string;
  data_assinatura?: string;
}

interface TermoAditivo {
  id: string;
  data: string;
  motivo: string;
  servicosAlterados: {
    servicoId: string;
    valorAnterior: number;
    valorNovo: number;
    modalidade: string;
    especialidade: string;
    categoria: string;
  }[];
  geradoPor: string;
}

interface ServicoContratado {
  id?: string;
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA" | "OB";
  categoria: "Angio" | "Contrastado" | "Mastoide" | "OIT" | "Pescoço" | "Prostata" | "Score" | "Normal" | "Especial";
  prioridade: "Plantão" | "Rotina" | "Urgente";
  valor: number;
}

interface NovoCliente {
  cnpj: string;
  nome: string;
  endereco: string;
  telefone: string;
  emailFinanceiro: string;
  emailOperacional: string;
  site: string;
  responsavel: string;
  telefoneResponsavel: string;
  emailResponsavel: string;
  dataInicio: string;
  dataFim: string;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "CDI";
  servicos: ServicoContratado[];
  cobrancaIntegracao: boolean;
  valorIntegracao: number;
  cobrancaSuporte: boolean;
  valorSuporte: number;
}

export default function ContratosClientes() {
  const [contratos, setContratos] = useState<ContratoCliente[]>([]);
  const [contratosOriginal, setContratosOriginal] = useState<ContratoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [showEditarContrato, setShowEditarContrato] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<ContratoCliente | null>(null);
  const [isCreatingContracts, setIsCreatingContracts] = useState(false);
  const [showVisualizarContrato, setShowVisualizarContrato] = useState(false);
  const [contratoVisualizando, setContratoVisualizando] = useState<ContratoCliente | null>(null);
  
  // Estados para edição
  const [editDataInicio, setEditDataInicio] = useState("");
  const [editDataFim, setEditDataFim] = useState("");
  const [editDiaVencimento, setEditDiaVencimento] = useState<number | "">(10);
  const [editDesconto, setEditDesconto] = useState<number | "">(0);
  const [editAcrescimo, setEditAcrescimo] = useState<number | "">(0);
  const [editFranqValor, setEditFranqValor] = useState<number | "">(0);
  const [editIntegraValor, setEditIntegraValor] = useState<number | "">(0);
  const [editPortalValor, setEditPortalValor] = useState<number | "">(0);
  const [editDataVigencia, setEditDataVigencia] = useState("");
  const [editDescricaoAlteracao, setEditDescricaoAlteracao] = useState("");
  
  // Estados para condições de preço
  const [precosCliente, setPrecosCliente] = useState<any[]>([]);
  const [loadingPrecos, setLoadingPrecos] = useState(false);
  const [historicoContrato, setHistoricoContrato] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [activeTab, setActiveTab] = useState<"atual" | "historico">("atual");

  // Estados para busca, filtro e ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sortField, setSortField] = useState<string>("cliente");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const { toast } = useToast();

  // Carregar dados dos contratos do Supabase
  const carregarContratos = async () => {
    try {
      setLoading(true);
      
      // Buscar contratos com dados dos clientes
      const { data: contratosData, error } = await supabase
        .from('contratos_clientes')
        .select(`
          *,
          clientes (
            id,
            nome,
            cnpj,
            endereco,
            telefone,
            email,
            contato,
            status,
            ativo
          )
        `)
        .eq('clientes.ativo', true);

      if (error) {
        console.error('Erro ao carregar contratos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados dos contratos.",
          variant: "destructive",
        });
        return;
      }

      // Transformar dados do Supabase para o formato da interface
      const contratosFormatados: ContratoCliente[] = (contratosData || []).map(contrato => {
        const cliente = contrato.clientes;
        const hoje = new Date();
        const dataFim = new Date(contrato.data_fim || contrato.data_inicio);
        const diasParaVencer = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: "Ativo" | "Vencido" | "A Vencer" = "Ativo";
        if (diasParaVencer < 0) {
          status = "Vencido";
        } else if (diasParaVencer <= 60) {
          status = "A Vencer";
        }

        // Calcular valor estimado baseado nos serviços contratados (se houver)
        let valorEstimado = 0;
        const servicosContratados = Array.isArray(contrato.servicos_contratados) ? contrato.servicos_contratados : [];
        const configuracoesFranquia = (typeof contrato.configuracoes_franquia === 'object' && contrato.configuracoes_franquia) ? contrato.configuracoes_franquia as any : {};
        const configuracoesIntegracao = (typeof contrato.configuracoes_integracao === 'object' && contrato.configuracoes_integracao) ? contrato.configuracoes_integracao as any : {};

        // Valor da franquia (se configurada)
        if (configuracoesFranquia.tem_franquia) {
          valorEstimado += Number(configuracoesFranquia.valor_franquia || 0);
        }

        // Valor da integração (se configurada)
        if (configuracoesIntegracao.cobra_integracao) {
          valorEstimado += Number(configuracoesIntegracao.valor_integracao || 0);
        }

        return {
          id: contrato.id,
          clienteId: cliente?.id || '',
          cliente: cliente?.nome || 'Cliente não encontrado',
          cnpj: cliente?.cnpj || '',
          dataInicio: contrato.data_inicio || '',
          dataFim: contrato.data_fim || contrato.data_inicio || '',
          status,
          servicos: servicosContratados.map((s: any) => ({
            id: s.id,
            modalidade: s.modalidade,
            especialidade: s.especialidade,
            categoria: s.categoria,
            prioridade: s.prioridade,
            valor: Number(s.valor || 0)
          })) as ServicoContratado[],
          valorTotal: valorEstimado,
          diasParaVencer,
          indiceReajuste: "IPCA" as const,
          endereco: cliente?.endereco || '',
          telefone: cliente?.telefone || '',
          emailFinanceiro: cliente?.email || '',
          emailOperacional: cliente?.email || '',
          responsavel: cliente?.contato || '',
          cobrancaIntegracao: Boolean(configuracoesIntegracao.cobra_integracao),
          valorIntegracao: Number(configuracoesIntegracao.valor_integracao || 0),
          cobrancaSuporte: false,
          // Novos campos
          consideraPlantao: Boolean(contrato.considera_plantao),
          condVolume: contrato.cond_volume || 'MOD/ESP/CAT',
          diaVencimento: Number(contrato.dia_vencimento || 10),
          descontoPercentual: Number(contrato.desconto_percentual || 0),
          acrescimoPercentual: Number(contrato.acrescimo_percentual || 0),
          faixasVolume: Array.isArray(contrato.faixas_volume) ? contrato.faixas_volume : [],
          configuracoesFranquia: configuracoesFranquia,
          configuracoesIntegracao: configuracoesIntegracao,
          termosAditivos: [],
          documentos: []
        };
      });

      setContratos(contratosFormatados);
      setContratosOriginal(contratosFormatados);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado ao carregar os contratos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContratos();
  }, []);

  // Carregar condições de preço
  useEffect(() => {
    const fetchPrecos = async () => {
      const clienteId = contratoVisualizando?.clienteId || contratoEditando?.clienteId;
      const shouldLoad = (showVisualizarContrato && contratoVisualizando?.clienteId) || 
                        (showEditarContrato && contratoEditando?.clienteId);
      
      if (!shouldLoad || !clienteId) {
        setPrecosCliente([]);
        return;
      }
      try {
        setLoadingPrecos(true);
        const { data, error } = await supabase
          .from('precos_servicos')
          .select('modalidade, especialidade, categoria, prioridade, volume_inicial, volume_final, valor_base, valor_urgencia, considera_prioridade_plantao')
          .eq('cliente_id', clienteId)
          .order('modalidade', { ascending: true });
        if (error) throw error;
        setPrecosCliente(data || []);
      } catch (e) {
        console.error('Erro ao carregar condições de preço:', e);
        setPrecosCliente([]);
      } finally {
        setLoadingPrecos(false);
      }
    };
    fetchPrecos();
  }, [showVisualizarContrato, contratoVisualizando?.clienteId, showEditarContrato, contratoEditando?.clienteId]);

  // Inicializar dados de edição quando contrato é selecionado
  useEffect(() => {
    if (contratoEditando) {
      setEditDataInicio(contratoEditando.dataInicio ? contratoEditando.dataInicio.slice(0, 10) : "");
      setEditDataFim(contratoEditando.dataFim ? contratoEditando.dataFim.slice(0, 10) : "");
      setEditDiaVencimento(contratoEditando.diaVencimento ?? 10);
      setEditDesconto(contratoEditando.descontoPercentual ?? 0);
      setEditAcrescimo(contratoEditando.acrescimoPercentual ?? 0);
      
      const franq = contratoEditando.configuracoesFranquia || {};
      setEditFranqValor(franq.valor_franquia ?? 0);
      
      const integ = contratoEditando.configuracoesIntegracao || {};
      setEditIntegraValor(integ.valor_integracao ?? 0);
      setEditPortalValor(integ.valor_portal_laudos ?? 0);
      
      // Definir data de vigência padrão como hoje
      const hoje = new Date().toISOString().slice(0, 10);
      setEditDataVigencia(hoje);
      setEditDescricaoAlteracao("");
    }
  }, [contratoEditando]);

  // Função para salvar contrato
  const salvarContrato = async () => {
    if (!contratoEditando) return;
    
    if (!editDataVigencia) {
      toast({ 
        title: 'Data de vigência obrigatória', 
        description: 'Informe a partir de quando a alteração será aplicada', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      // Atualizar contrato no banco
      const { error } = await supabase
        .from('contratos_clientes')
        .update({
          data_inicio: editDataInicio || null,
          data_fim: editDataFim || null,
          dia_vencimento: editDiaVencimento || null,
          desconto_percentual: Number(editDesconto || 0),
          acrescimo_percentual: Number(editAcrescimo || 0),
          configuracoes_franquia: {
            valor_franquia: Number(editFranqValor || 0),
          },
          configuracoes_integracao: {
            valor_integracao: Number(editIntegraValor || 0),
            valor_portal_laudos: Number(editPortalValor || 0),
          },
        })
        .eq('id', contratoEditando.id);

      if (error) throw error;

      toast({
        title: "Contrato atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      setShowEditarContrato(false);
      setContratoEditando(null);
      await carregarContratos();
    } catch (error: any) {
      console.error('Erro ao salvar contrato:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    }
  };

  // Filtros e ordenação
  useEffect(() => {
    let contratosFiltrados = [...contratosOriginal];

    // Aplicar busca
    if (searchTerm) {
      contratosFiltrados = contratosFiltrados.filter(contrato =>
        contrato.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.responsavel?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar filtro de status
    if (statusFilter !== "todos") {
      contratosFiltrados = contratosFiltrados.filter(contrato =>
        contrato.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Aplicar ordenação
    contratosFiltrados.sort((a, b) => {
      let aValue: any = a[sortField as keyof ContratoCliente];
      let bValue: any = b[sortField as keyof ContratoCliente];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setContratos(contratosFiltrados);
  }, [contratosOriginal, searchTerm, statusFilter, sortField, sortDirection]);

  // Dados derivados
  const contratosAtivos = contratos.filter(c => c.status === "Ativo");
  const contratosVencidos = contratos.filter(c => c.status === "Vencido");
  const contratosAVencer = contratos.filter(c => c.status === "A Vencer");
  const valorTotalAtivos = contratosAtivos.reduce((sum, c) => sum + c.valorTotal, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contratos Clientes</h1>
        <p className="text-gray-600 mt-1">Gestão de contratos com clientes, serviços e faturamento</p>
      </div>

      <FilterBar />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{contratosAtivos.length}</div>
            <p className="text-xs text-muted-foreground">
              Valor Total: R$ {valorTotalAtivos.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Vencer (60 dias)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{contratosAVencer.length}</div>
            <p className="text-xs text-muted-foreground">
              Requerem atenção para renovação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{contratosVencidos.length}</div>
            <p className="text-xs text-muted-foreground">
              Necessitam renovação urgente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{contratos.length}</div>
            <p className="text-xs text-muted-foreground">
              {contratosOriginal.length} cadastrados no sistema
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Principais */}
      <div className="flex gap-4">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Contratos
        </Button>

        <Button variant="outline">
          <FileCheck className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      {/* Tabela de Contratos */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Lista de Contratos</CardTitle>
            
            {/* Controles de busca, filtro e ordenação */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Campo de busca */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por cliente, CNPJ ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                />
              </div>

              {/* Filtro por status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="a vencer">A Vencer</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenação */}
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-');
                setSortField(field);
                setSortDirection(direction as "asc" | "desc");
              }}>
                <SelectTrigger className="w-full sm:w-52">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="cliente-asc">Cliente (A-Z)</SelectItem>
                  <SelectItem value="cliente-desc">Cliente (Z-A)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                  <SelectItem value="status-desc">Status (Z-A)</SelectItem>
                  <SelectItem value="dataInicio-asc">Data Início (Antiga)</SelectItem>
                  <SelectItem value="dataInicio-desc">Data Início (Recente)</SelectItem>
                  <SelectItem value="dataFim-asc">Data Fim (Antiga)</SelectItem>
                  <SelectItem value="dataFim-desc">Data Fim (Recente)</SelectItem>
                  <SelectItem value="diasParaVencer-asc">Menos dias p/ vencer</SelectItem>
                  <SelectItem value="diasParaVencer-desc">Mais dias p/ vencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-muted-foreground mt-2">
            Mostrando {contratos.length} de {contratosOriginal.length} contratos
            {searchTerm && ` • Filtrado por: "${searchTerm}"`}
            {statusFilter !== "todos" && ` • Status: ${statusFilter}`}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando contratos...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead>Dias p/ Vencer</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.cliente}</TableCell>
                    <TableCell>{contrato.cnpj || 'Não informado'}</TableCell>
                    <TableCell>
                      <Badge variant={contrato.status === 'Ativo' ? 'default' : contrato.status === 'A Vencer' ? 'secondary' : 'destructive'}>
                        {contrato.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{new Date(contrato.dataFim).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <span className={contrato.diasParaVencer < 0 ? 'text-red-600' : contrato.diasParaVencer <= 60 ? 'text-yellow-600' : 'text-green-600'}>
                        {contrato.diasParaVencer} dias
                      </span>
                    </TableCell>
                    <TableCell>R$ {contrato.valorTotal.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContratoVisualizando(contrato);
                            setShowVisualizarContrato(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContratoEditando(contrato);
                            setShowEditarContrato(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog unificado para visualizar/editar contrato */}
      <Dialog open={showVisualizarContrato || showEditarContrato} onOpenChange={(open) => {
        if (!open) {
          setShowVisualizarContrato(false);
          setShowEditarContrato(false);
          setContratoVisualizando(null);
          setContratoEditando(null);
        }
      }}>
        <DialogContent className="w-[98vw] max-w-[98vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                {showEditarContrato ? 'Editar' : 'Visualizar'} Contrato — {(contratoVisualizando || contratoEditando)?.cliente}
              </DialogTitle>
              {!showEditarContrato && (
                <Button 
                  onClick={() => {
                    setContratoEditando(contratoVisualizando);
                    setShowEditarContrato(true);
                    setShowVisualizarContrato(false);
                  }}
                  variant="outline"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          {(contratoVisualizando || contratoEditando) && (
            <div className="w-full space-y-6">
              {/* Tabs para alternar entre visualização atual e histórico */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "atual" | "historico")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="atual">Contrato Atual</TabsTrigger>
                  <TabsTrigger value="historico" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="atual" className="w-full space-y-6">
                  {showEditarContrato && (
                    <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
                      <h4 className="font-medium text-blue-900">Controle de Vigência</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-blue-800">Data de Vigência das Alterações *</Label>
                          <Input 
                            type="date" 
                            value={editDataVigencia} 
                            onChange={(e) => setEditDataVigencia(e.target.value)}
                            className="border-blue-300"
                          />
                          <p className="text-sm text-blue-600">A partir de quando as alterações serão aplicadas</p>
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-blue-800">Descrição da Alteração</Label>
                          <Input 
                            placeholder="Ex: Reajuste anual, alteração de preços..."
                            value={editDescricaoAlteracao} 
                            onChange={(e) => setEditDescricaoAlteracao(e.target.value)}
                            className="border-blue-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dados do Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Cliente</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">CNPJ</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.cnpj || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Data de Início</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="date" 
                          value={editDataInicio} 
                          onChange={(e) => setEditDataInicio(e.target.value)} 
                        />
                      ) : (
                        <p className="text-sm">{new Date((contratoVisualizando || contratoEditando)!.dataInicio).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Data de Fim</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="date" 
                          value={editDataFim} 
                          onChange={(e) => setEditDataFim(e.target.value)} 
                        />
                      ) : (
                        <p className="text-sm">{new Date((contratoVisualizando || contratoEditando)!.dataFim).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={(contratoVisualizando || contratoEditando)?.status === 'Ativo' ? 'default' : (contratoVisualizando || contratoEditando)?.status === 'A Vencer' ? 'secondary' : 'destructive'}>
                        {(contratoVisualizando || contratoEditando)?.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dias para Vencer</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.diasParaVencer} dias</p>
                    </div>
                  </div>

                  {/* Ajustes de Faturamento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Desconto (%) - Ajuste de Faturamento</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editDesconto} 
                          onChange={(e) => setEditDesconto(Number(e.target.value) || "")} 
                          placeholder="Ex: 5.5 (para ajustes no período)"
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.descontoPercentual || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Acréscimo (%) - Ajuste de Faturamento</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editAcrescimo} 
                          onChange={(e) => setEditAcrescimo(Number(e.target.value) || "")} 
                          placeholder="Ex: 2.5 (para ajustes no período)"
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.acrescimoPercentual || ""} 
                          readOnly
                        />
                      )}
                    </div>
                  </div>

                  {/* Configurações de Cobrança */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Valor Franquia</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editFranqValor} 
                          onChange={(e) => setEditFranqValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.configuracoesFranquia?.valor_franquia || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Valor Integração</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editIntegraValor} 
                          onChange={(e) => setEditIntegraValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.valorIntegracao || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Valor Portal Laudo</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editPortalValor} 
                          onChange={(e) => setEditPortalValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.configuracoesIntegracao?.valor_portal_laudos || ""} 
                          readOnly
                        />
                      )}
                    </div>
                  </div>

                  {/* Condições de Preço (Faixas por Serviço) */}
                  <div className="w-full border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">Condições de Preço (Faixas por Serviço)</Label>
                      <p className="text-sm text-muted-foreground">
                        {showEditarContrato ? 'Edite os valores e ative/inative serviços' : 'Visualização das condições de preço'}
                      </p>
                    </div>
                    
                    {loadingPrecos ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : precosCliente.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[100px]">Modalidade</TableHead>
                              <TableHead className="min-w-[120px]">Especialidade</TableHead>
                              <TableHead className="min-w-[100px]">Categoria</TableHead>
                              <TableHead className="min-w-[100px]">Prioridade</TableHead>
                              <TableHead className="min-w-[100px]">Vol. Inicial</TableHead>
                              <TableHead className="min-w-[100px]">Vol. Final</TableHead>
                              <TableHead className="min-w-[120px]">Valor Base</TableHead>
                              <TableHead className="min-w-[120px]">Valor Urgência</TableHead>
                              <TableHead className="min-w-[80px]">Plantão</TableHead>
                              {showEditarContrato && <TableHead className="min-w-[100px]">Ativo</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {precosCliente.map((preco, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{preco.modalidade}</TableCell>
                                <TableCell>{preco.especialidade}</TableCell>
                                <TableCell>{preco.categoria}</TableCell>
                                <TableCell>{preco.prioridade}</TableCell>
                                <TableCell>{preco.volume_inicial}</TableCell>
                                <TableCell>{preco.volume_final}</TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={preco.valor_base || ""} 
                                      onChange={(e) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, valor_base: Number(e.target.value) || 0 };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                      className="w-24"
                                    />
                                  ) : (
                                    `R$ ${Number(preco.valor_base || 0).toFixed(2)}`
                                  )}
                                </TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={preco.valor_urgencia || ""} 
                                      onChange={(e) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, valor_urgencia: Number(e.target.value) || 0 };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                      className="w-24"
                                    />
                                  ) : (
                                    `R$ ${Number(preco.valor_urgencia || 0).toFixed(2)}`
                                  )}
                                </TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Checkbox 
                                      checked={preco.considera_prioridade_plantao || false} 
                                      onCheckedChange={(checked) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, considera_prioridade_plantao: checked === true };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                    />
                                  ) : (
                                    preco.considera_prioridade_plantao ? 'Sim' : 'Não'
                                  )}
                                </TableCell>
                                {showEditarContrato && (
                                  <TableCell>
                                    <Checkbox 
                                      checked={preco.ativo !== false} 
                                      onCheckedChange={(checked) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, ativo: checked === true };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                    />
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhuma condição de preço cadastrada para este cliente.</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="historico">
                  <Card>
                    <CardHeader>
                      <CardTitle>Histórico de Alterações</CardTitle>
                      <CardDescription>
                        Histórico de modificações realizadas no contrato
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingHistorico ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : historicoContrato.length > 0 ? (
                        <div className="space-y-4">
                          {historicoContrato.map((item, idx) => (
                            <div key={idx} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">{item.tipo_alteracao}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.descricao_alteracao}
                                  </p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                                  <p>Vigência: {new Date(item.data_vigencia_inicio).toLocaleDateString('pt-BR')}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Nenhuma alteração registrada para este contrato.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {showEditarContrato && (
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditarContrato(false);
                setContratoEditando(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={salvarContrato}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}