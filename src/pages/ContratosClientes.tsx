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
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContratoCliente {
  id: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  status: "Ativo" | "Vencido" | "A Vencer";
  servicos: ServicoContratado[];
  valorTotal: number;
  diasParaVencer: number;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "CDI";
  percentualUltimos12Meses?: number;
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
          valorTotal: valorEstimado, // Valor estimado baseado em franquia/integração
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

  // Função para sincronizar preços com contratos
  const sincronizarPrecos = async () => {
    if (!confirm('Deseja sincronizar os preços de serviços com os contratos? Esta ação atualizará os serviços contratados de todos os contratos.')) {
      return;
    }

    setIsCreatingContracts(true);
    
    try {
      console.log('🔄 Iniciando sincronização de preços...');
      
      const { data, error } = await supabase.rpc('sincronizar_precos_servicos_contratos');
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Sincronização concluída:', data);
      
      toast({
        title: "Sincronização Concluída",
        description: `${(data as any).contratos_atualizados} contratos foram atualizados com os preços de serviços.`,
      });
      
      // Recarregar dados
      await carregarContratos();
      
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error);
      toast({
        title: "Erro na Sincronização",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setIsCreatingContracts(false);
    }
  };

  const criarContratosAutomatico = async () => {
    try {
      setIsCreatingContracts(true);
      console.log('Criando contratos automaticamente...');
      
      const { data, error } = await supabase.rpc('criar_contratos_clientes_automatico');
      
      if (error) {
        console.error('Erro ao criar contratos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar os contratos automaticamente.",
          variant: "destructive",
        });
        return;
      }

      console.log('Resultado:', data);
      
      const resultado = data as { contratos_criados: number; sucesso: boolean };
      
      if (resultado.contratos_criados > 0) {
        toast({
          title: "Contratos criados",
          description: `${resultado.contratos_criados} contratos foram criados automaticamente.`,
        });
        
        // Recarregar a lista de contratos
        await carregarContratos();
      } else {
        toast({
          title: "Info",
          description: "Todos os clientes já possuem contratos.",
        });
      }
      
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado ao criar os contratos.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingContracts(false);
    }
  };

  // Funções de filtro, busca e ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4 text-primary" /> : 
      <ArrowDown className="h-4 w-4 text-primary" />;
  };

  // Aplicar filtros, busca e ordenação
  useEffect(() => {
    let contratosFiltrados = [...contratosOriginal];

    // Filtro por termo de busca
    if (searchTerm) {
      contratosFiltrados = contratosFiltrados.filter(contrato =>
        contrato.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.responsavel?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status
    if (statusFilter !== "todos") {
      contratosFiltrados = contratosFiltrados.filter(contrato => 
        contrato.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Ordenação
    contratosFiltrados.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case "cliente":
          aValue = a.cliente;
          bValue = b.cliente;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "dataInicio":
          aValue = new Date(a.dataInicio);
          bValue = new Date(b.dataInicio);
          break;
        case "dataFim":
          aValue = new Date(a.dataFim);
          bValue = new Date(b.dataFim);
          break;
        case "diasParaVencer":
          aValue = a.diasParaVencer;
          bValue = b.diasParaVencer;
          break;
        default:
          aValue = a.cliente;
          bValue = b.cliente;
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setContratos(contratosFiltrados);
  }, [contratosOriginal, searchTerm, statusFilter, sortField, sortDirection]);

  const getStatusBadge = (status: string, diasParaVencer: number) => {
    if (status === "Ativo" && diasParaVencer <= 60) {
      return <Badge className="bg-yellow-100 text-yellow-800">A Vencer</Badge>;
    }
    switch (status) {
      case "Ativo":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case "Vencido":
        return <Badge className="bg-red-100 text-red-800">Vencido</Badge>;
      case "A Vencer":
        return <Badge className="bg-yellow-100 text-yellow-800">A Vencer</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const contratosAVencer = contratosOriginal.filter(c => c.diasParaVencer <= 60 && c.diasParaVencer > 0);
  const contratosAtivos = contratosOriginal.filter(c => c.status === "Ativo");
  const valorTotalAtivos = contratosAtivos.reduce((sum, c) => sum + c.valorTotal, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contratos Clientes</h1>
        <p className="text-gray-600 mt-1">Gestão de contratos com clientes, serviços e faturamento</p>
      </div>

      <FilterBar />

      {/* Resumo de Contratos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Contratos Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{contratosAtivos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">A Vencer (60 dias)</p>
                <p className="text-2xl font-bold text-gray-900">{contratosAVencer.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Valor Total Ativo</p>
                <p className="text-2xl font-bold text-gray-900">R$ {valorTotalAtivos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Contratos</p>
                <p className="text-2xl font-bold text-gray-900">{contratos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Contratos a Vencer */}
      {contratosAVencer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Contratos a Vencer nos Próximos 60 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contratosAVencer.map((contrato) => (
                <div key={contrato.id} className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-yellow-800">{contrato.cliente}</p>
                      <p className="text-xs text-yellow-600">
                        Vence em {contrato.diasParaVencer} dias - {new Date(contrato.dataFim).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Renovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão para criar contratos automaticamente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Criar Contratos Automático
          </CardTitle>
          <CardDescription>
            Crie contratos automaticamente para todos os clientes que ainda não possuem contrato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={criarContratosAutomatico}
            disabled={isCreatingContracts}
            className="w-full"
          >
            {isCreatingContracts ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Criando Contratos...
              </>
            ) : (
              'Criar Contratos Automático para Clientes sem Contrato'
            )}
          </Button>
          
          <Button 
            onClick={sincronizarPrecos}
            disabled={isCreatingContracts}
            variant="outline"
            className="w-full mt-2"
          >
            {isCreatingContracts ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Sincronizando...
              </>
            ) : (
              'Sincronizar Preços com Contratos'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Ações Principais */}
      <div className="flex gap-4">
        <Dialog open={showNovoContrato} onOpenChange={setShowNovoContrato}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
        </Dialog>

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
                  <TableHead>Serviços Contratados</TableHead>
                  <TableHead>Dias para Vencer</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.cliente}</TableCell>
                    <TableCell>{contrato.cnpj}</TableCell>
                    <TableCell>{getStatusBadge(contrato.status, contrato.diasParaVencer)}</TableCell>
                    <TableCell>{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{new Date(contrato.dataFim).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contrato.servicos.length > 0 ? (
                          contrato.servicos.slice(0, 3).map((servico, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {servico.modalidade}-{servico.especialidade}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Não configurado
                          </Badge>
                        )}
                        {contrato.servicos.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{contrato.servicos.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={contrato.diasParaVencer <= 30 ? 'text-red-600 font-semibold' : 
                                     contrato.diasParaVencer <= 60 ? 'text-yellow-600 font-medium' : 'text-green-600'}>
                        {contrato.diasParaVencer} dias
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Send className="h-4 w-4" />
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
    </div>
  );
}