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

// Dados serão carregados do Supabase

export default function ContratosClientes() {
  const [contratos, setContratos] = useState<ContratoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [showEditarContrato, setShowEditarContrato] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<ContratoCliente | null>(null);
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

        return {
          id: contrato.id,
          cliente: cliente?.nome || 'Cliente não encontrado',
          cnpj: cliente?.cnpj || '',
          dataInicio: contrato.data_inicio || '',
          dataFim: contrato.data_fim || contrato.data_inicio || '',
          status,
          servicos: [], // Será implementado quando houver tabela de serviços
          valorTotal: Number(contrato.valor_mensal || 0),
          diasParaVencer,
          indiceReajuste: "IPCA" as const, // Valor padrão, pode ser configurado
          endereco: cliente?.endereco || '',
          telefone: cliente?.telefone || '',
          emailFinanceiro: cliente?.email || '',
          emailOperacional: cliente?.email || '',
          responsavel: cliente?.contato || '',
          cobrancaIntegracao: false,
          cobrancaSuporte: false,
          termosAditivos: [],
          documentos: []
        };
      });

      setContratos(contratosFormatados);
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
  
  const [novoCliente, setNovoCliente] = useState<NovoCliente>({
    cnpj: "",
    nome: "",
    endereco: "",
    telefone: "",
    emailFinanceiro: "",
    emailOperacional: "",
    site: "",
    responsavel: "",
    telefoneResponsavel: "",
    emailResponsavel: "",
    dataInicio: "",
    dataFim: "",
    indiceReajuste: "IPCA",
    servicos: [],
    cobrancaIntegracao: false,
    valorIntegracao: 0,
    cobrancaSuporte: false,
    valorSuporte: 0,
  });

  const [servicoAtual, setServicoAtual] = useState<ServicoContratado>({
    modalidade: "MR",
    especialidade: "CA",
    categoria: "Normal",
    prioridade: "Rotina",
    valor: 0,
  });

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

  const contratosAVencer = contratos.filter(c => c.diasParaVencer <= 60 && c.diasParaVencer > 0);
  const contratosAtivos = contratos.filter(c => c.status === "Ativo");
  const valorTotalAtivos = contratosAtivos.reduce((sum, c) => sum + c.valorTotal, 0);

  const adicionarServico = () => {
    if (servicoAtual.valor > 0) {
      const novoServico = { ...servicoAtual, id: Date.now().toString() };
      setNovoCliente(prev => ({
        ...prev,
        servicos: [...prev.servicos, novoServico]
      }));
      setServicoAtual({
        modalidade: "MR",
        especialidade: "CA", 
        categoria: "Normal",
        prioridade: "Rotina",
        valor: 0,
      });
    }
  };

  const removerServico = (servicoId: string) => {
    setNovoCliente(prev => ({
      ...prev,
      servicos: prev.servicos.filter(s => s.id !== servicoId)
    }));
  };

  const calcularValorTotal = () => {
    const valorServicos = novoCliente.servicos.reduce((sum, s) => sum + s.valor, 0);
    const valorIntegracao = novoCliente.cobrancaIntegracao ? novoCliente.valorIntegracao : 0;
    const valorSuporte = novoCliente.cobrancaSuporte ? novoCliente.valorSuporte : 0;
    return valorServicos + valorIntegracao + valorSuporte;
  };

  const salvarCliente = async () => {
    if (!novoCliente.cnpj || !novoCliente.nome || !novoCliente.dataInicio || !novoCliente.dataFim) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha CNPJ, nome e datas.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Primeiro, criar/atualizar o cliente na tabela clientes
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .upsert({
          nome: novoCliente.nome,
          cnpj: novoCliente.cnpj,
          endereco: novoCliente.endereco,
          telefone: novoCliente.telefone,
          email: novoCliente.emailFinanceiro,
          contato: novoCliente.responsavel,
          status: 'Ativo',
          ativo: true
        }, {
          onConflict: 'cnpj'
        })
        .select()
        .single();

      if (clienteError) {
        console.error('Erro ao salvar cliente:', clienteError);
        toast({
          title: "Erro",
          description: "Não foi possível salvar os dados do cliente.",
          variant: "destructive",
        });
        return;
      }

      // Depois, criar o contrato
      const { data: contratoData, error: contratoError } = await supabase
        .from('contratos_clientes')
        .insert({
          cliente_id: clienteData.id,
          numero_contrato: `CONT-${Date.now()}`,
          data_inicio: novoCliente.dataInicio,
          data_fim: novoCliente.dataFim,
          valor_mensal: calcularValorTotal(),
          status: 'ativo',
          modalidades: [], // Será implementado quando houver serviços
          especialidades: [] // Será implementado quando houver serviços
        })
        .select()
        .single();

      if (contratoError) {
        console.error('Erro ao salvar contrato:', contratoError);
        toast({
          title: "Erro",
          description: "Não foi possível salvar o contrato.",
          variant: "destructive",
        });
        return;
      }

      // Recarregar a lista de contratos
      await carregarContratos();
      setShowNovoContrato(false);
      
      // Reset form
      setNovoCliente({
        cnpj: "",
        nome: "",
        endereco: "",
        telefone: "",
        emailFinanceiro: "",
        emailOperacional: "",
        site: "",
        responsavel: "",
        telefoneResponsavel: "",
        emailResponsavel: "",
        dataInicio: "",
        dataFim: "",
        indiceReajuste: "IPCA",
        servicos: [],
        cobrancaIntegracao: false,
        valorIntegracao: 0,
        cobrancaSuporte: false,
        valorSuporte: 0,
      });

      toast({
        title: "Cliente cadastrado",
        description: `Cliente ${novoCliente.nome} e contrato cadastrados com sucesso!`,
      });

    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado ao salvar os dados.",
        variant: "destructive",
      });
    }
  };

  const criarContratosAutomaticamente = async () => {
    try {
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
    }
  };

  const gerarTermoAditivo = (contrato: ContratoCliente, servicosAlterados: any[]) => {
    const termoAditivo: TermoAditivo = {
      id: Date.now().toString(),
      data: new Date().toISOString().split('T')[0],
      motivo: "Alteração de valores de serviços contratados",
      servicosAlterados,
      geradoPor: "Sistema", // Aqui seria o usuário logado
    };

    // Atualizar contrato com novo termo aditivo
    const contratosAtualizados = contratos.map(c => {
      if (c.id === contrato.id) {
        return {
          ...c,
          termosAditivos: [...(c.termosAditivos || []), termoAditivo]
        };
      }
      return c;
    });

    setContratos(contratosAtualizados);

    toast({
      title: "Termo Aditivo Gerado",
      description: `Termo aditivo gerado automaticamente para ${contrato.cliente}`,
    });

    // Aqui seria gerado o PDF do termo aditivo
    console.log("Gerando PDF do termo aditivo:", termoAditivo);
  };

  const editarContrato = (contrato: ContratoCliente) => {
    setContratoEditando(contrato);
    setShowEditarContrato(true);
  };

  const enviarParaAssinatura = async (contrato: ContratoCliente) => {
    try {
      const response = await supabase.functions.invoke('enviar-contrato-clicksign', {
        body: {
          clienteId: contrato.id,
          contratoId: contrato.id,
          nomeCliente: contrato.cliente,
          emailCliente: contrato.emailFinanceiro || contrato.emailOperacional || 'cliente@email.com',
          tipoDocumento: 'contrato',
          nomeDocumento: `contrato_${contrato.cliente.toLowerCase().replace(/\s+/g, '_')}.pdf`
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Contrato enviado",
        description: `Contrato enviado para assinatura de ${contrato.cliente}`,
      });

      // Atualizar status do documento
      const contratosAtualizados = contratos.map(c => {
        if (c.id === contrato.id) {
          return {
            ...c,
            documentos: [
              ...(c.documentos || []),
              {
                id: Date.now().toString(),
                tipo_documento: 'contrato' as const,
                nome_arquivo: `contrato_${contrato.cliente.toLowerCase().replace(/\s+/g, '_')}.pdf`,
                status_documento: 'assinatura_pendente' as const,
                data_envio_assinatura: new Date().toISOString()
              }
            ]
          };
        }
        return c;
      });
      setContratos(contratosAtualizados);

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
        return <FileCheck className="h-4 w-4 text-blue-600" />;
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

  const handleGerarContrato = async (contratoId: string) => {
    const contrato = contratos.find(c => c.id === contratoId);
    if (contrato) {
      // Gerar PDF do contrato usando template (implementar template)
      console.log("Gerando contrato PDF para:", contrato.cliente);
      
      // Enviar automaticamente para ClickSign
      await enviarParaAssinatura(contrato);
    }
  };

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
      
      {/* Informações sobre Upload de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Upload de Dados de Contratos
          </CardTitle>
          <CardDescription>
            Para que os contratos tenham preços e parâmetros configurados, faça upload dos seguintes arquivos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-sm text-gray-900 mb-2">1. Preços de Serviços</h3>
              <p className="text-xs text-gray-600 mb-3">
                Arquivo "Preco_Clientes.xlsx" contendo preços por cliente, modalidade, especialidade e categoria
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/gerenciar/cadastros">Fazer Upload de Preços</a>
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-sm text-gray-900 mb-2">2. Parâmetros de Faturamento</h3>
              <p className="text-xs text-gray-600 mb-3">
                Arquivo "Parametro_Clientes.xlsx" contendo parâmetros específicos de faturamento por cliente
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/gerenciar/cadastros">Fazer Upload de Parâmetros</a>
              </Button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Após o upload desses arquivos, os flags "tem_precos_configurados" e "tem_parametros_configurados" 
              serão automaticamente atualizados nos contratos correspondentes.
            </p>
          </div>
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
        
        <Button 
          variant="outline" 
          onClick={criarContratosAutomaticamente}
          disabled={loading}
        >
          <FileText className="h-4 w-4 mr-2" />
          Criar Contratos Automático
        </Button>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente e configure os serviços contratados
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Dados Principais - CNPJ e Nome primeiro */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Dados Principais</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={novoCliente.cnpj}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      maxLength={18}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nome">Nome do Cliente *</Label>
                    <Input
                      id="nome"
                      value={novoCliente.nome}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome da empresa/clínica..."
                    />
                  </div>
                </div>
              </div>

              {/* Dados Complementares */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Dados Complementares</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={novoCliente.telefone}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(11) 9999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="site">Site</Label>
                    <Input
                      id="site"
                      value={novoCliente.site}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, site: e.target.value }))}
                      placeholder="www.cliente.com.br"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="endereco">Endereço</Label>
                  <Textarea
                    id="endereco"
                    value={novoCliente.endereco}
                    onChange={(e) => setNovoCliente(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Endereço completo..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emailFinanceiro">Email Financeiro</Label>
                    <Input
                      id="emailFinanceiro"
                      type="email"
                      value={novoCliente.emailFinanceiro}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, emailFinanceiro: e.target.value }))}
                      placeholder="financeiro@cliente.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emailOperacional">Email Operacional</Label>
                    <Input
                      id="emailOperacional"
                      type="email"
                      value={novoCliente.emailOperacional}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, emailOperacional: e.target.value }))}
                      placeholder="operacional@cliente.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="site">Site</Label>
                  <Input
                    id="site"
                    value={novoCliente.site}
                    onChange={(e) => setNovoCliente(prev => ({ ...prev, site: e.target.value }))}
                    placeholder="www.cliente.com.br"
                  />
                </div>
              </div>

              {/* Dados do Responsável */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Responsável pelo Contrato</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="responsavel">Nome do Responsável</Label>
                    <Input
                      id="responsavel"
                      value={novoCliente.responsavel}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, responsavel: e.target.value }))}
                      placeholder="Dr. João Silva"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefoneResponsavel">Telefone</Label>
                    <Input
                      id="telefoneResponsavel"
                      value={novoCliente.telefoneResponsavel}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, telefoneResponsavel: e.target.value }))}
                      placeholder="(11) 9999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emailResponsavel">Email</Label>
                    <Input
                      id="emailResponsavel"
                      type="email"
                      value={novoCliente.emailResponsavel}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, emailResponsavel: e.target.value }))}
                      placeholder="responsavel@cliente.com"
                    />
                  </div>
                </div>
              </div>

              {/* Período e Reajuste */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Período do Contrato</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dataInicio">Data de Início *</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={novoCliente.dataInicio}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, dataInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dataFim">Data de Término *</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={novoCliente.dataFim}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, dataFim: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="indiceReajuste">Índice de Reajuste</Label>
                    <Select
                      value={novoCliente.indiceReajuste}
                      onValueChange={(value: "IPCA" | "IGP-M" | "INPC" | "CDI") => 
                        setNovoCliente(prev => ({ ...prev, indiceReajuste: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IPCA">IPCA</SelectItem>
                        <SelectItem value="IGP-M">IGP-M</SelectItem>
                        <SelectItem value="INPC">INPC</SelectItem>
                        <SelectItem value="CDI">CDI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Serviços Contratados */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Serviços Contratados *</h4>
                
                {/* Adicionar Serviço */}
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-5 gap-4 mb-3">
                    <div>
                      <Label htmlFor="modalidade">Modalidade</Label>
                      <Select
                        value={servicoAtual.modalidade}
                        onValueChange={(value: "MR" | "CT" | "DO" | "MG" | "RX") => 
                          setServicoAtual(prev => ({ ...prev, modalidade: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MR">MR</SelectItem>
                          <SelectItem value="CT">CT</SelectItem>
                          <SelectItem value="DO">DO</SelectItem>
                          <SelectItem value="MG">MG</SelectItem>
                          <SelectItem value="RX">RX</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="especialidade">Especialidade</Label>
                      <Select
                        value={servicoAtual.especialidade}
                        onValueChange={(value: "CA" | "NE" | "ME" | "MI" | "MA" | "OB") => 
                          setServicoAtual(prev => ({ ...prev, especialidade: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CA">CA</SelectItem>
                          <SelectItem value="NE">NE</SelectItem>
                          <SelectItem value="ME">ME</SelectItem>
                          <SelectItem value="MI">MI</SelectItem>
                          <SelectItem value="MA">MA</SelectItem>
                          <SelectItem value="OB">OB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="categoria">Categoria</Label>
                      <Select
                        value={servicoAtual.categoria}
                        onValueChange={(value) => 
                          setServicoAtual(prev => ({ ...prev, categoria: value as any }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Especial">Especial</SelectItem>
                          <SelectItem value="Angio">Angio</SelectItem>
                          <SelectItem value="Contrastado">Contrastado</SelectItem>
                          <SelectItem value="Mastoide">Mastoide</SelectItem>
                          <SelectItem value="OIT">OIT</SelectItem>
                          <SelectItem value="Pescoço">Pescoço</SelectItem>
                          <SelectItem value="Prostata">Prostata</SelectItem>
                          <SelectItem value="Score">Score</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="prioridade">Prioridade</Label>
                      <Select
                        value={servicoAtual.prioridade}
                        onValueChange={(value: "Plantão" | "Rotina" | "Urgente") => 
                          setServicoAtual(prev => ({ ...prev, prioridade: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Rotina">Rotina</SelectItem>
                          <SelectItem value="Urgente">Urgente</SelectItem>
                          <SelectItem value="Plantão">Plantão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="valor">Valor Unitário</Label>
                      <div className="flex gap-2">
                        <Input
                          id="valor"
                          type="number"
                          step="0.01"
                          value={servicoAtual.valor}
                          onChange={(e) => setServicoAtual(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                        />
                        <Button type="button" onClick={adicionarServico} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista de Serviços Adicionados */}
                {novoCliente.servicos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Serviços Adicionados:</Label>
                    {novoCliente.servicos.map((servico) => (
                      <div key={servico.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{servico.modalidade}/{servico.especialidade}</Badge>
                          <span className="text-sm">{servico.categoria}</span>
                          <span className="text-sm text-gray-500">({servico.prioridade})</span>
                          <span className="font-medium text-green-600">
                            R$ {servico.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removerServico(servico.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Configurações de Cobrança */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Configurações de Cobrança</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cobrancaIntegracao"
                      checked={novoCliente.cobrancaIntegracao}
                      onCheckedChange={(checked) => 
                        setNovoCliente(prev => ({ ...prev, cobrancaIntegracao: checked as boolean }))
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="cobrancaIntegracao">
                        Cobrança Mensal de Integração
                      </Label>
                      {novoCliente.cobrancaIntegracao && (
                        <Input
                          type="number"
                          step="0.01"
                          value={novoCliente.valorIntegracao}
                          onChange={(e) => setNovoCliente(prev => ({ 
                            ...prev, 
                            valorIntegracao: parseFloat(e.target.value) || 0 
                          }))}
                          placeholder="Valor da integração"
                          className="w-full mt-2"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cobrancaSuporte"
                      checked={novoCliente.cobrancaSuporte}
                      onCheckedChange={(checked) => 
                        setNovoCliente(prev => ({ ...prev, cobrancaSuporte: checked as boolean }))
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="cobrancaSuporte">
                        Cobrança de Suporte
                      </Label>
                      {novoCliente.cobrancaSuporte && (
                        <Input
                          type="number"
                          step="0.01"
                          value={novoCliente.valorSuporte}
                          onChange={(e) => setNovoCliente(prev => ({ 
                            ...prev, 
                            valorSuporte: parseFloat(e.target.value) || 0 
                          }))}
                          placeholder="Valor do suporte"
                          className="w-full mt-2"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Valor Total Estimado:</span>
                  <span className="text-lg font-bold text-blue-600">
                    R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  * Valores dos serviços serão multiplicados pelo volume produzido
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovoContrato(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarCliente}>
                Cadastrar Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload Clientes
        </Button>

        <Button variant="outline">
          <FileCheck className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      {/* Tabela de Contratos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando contratos...</p>
              </div>
            </div>
          ) : contratos.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum contrato encontrado</p>
                <p className="text-xs text-muted-foreground">Cadastre um novo cliente para começar</p>
              </div>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Serviços Contratados</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Índice Reajuste</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">{contrato.cliente}</TableCell>
                  <TableCell>
                    {new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(contrato.dataFim).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{getStatusBadge(contrato.status, contrato.diasParaVencer)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contrato.servicos.map((servico, index) => (
                        <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {servico.modalidade}/{servico.especialidade}
                            </Badge>
                            <span className="text-gray-600">{servico.categoria}</span>
                            <span className="text-gray-500">({servico.prioridade})</span>
                          </div>
                          <span className="font-medium text-green-600">
                            R$ {servico.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contrato.documentos && contrato.documentos.length > 0 ? (
                        contrato.documentos.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              {getStatusDocumentoIcon(doc.status_documento)}
                              <span className="capitalize">{doc.tipo_documento.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs px-2 py-1 rounded ${
                                doc.status_documento === 'assinado' ? 'bg-green-100 text-green-800' :
                                doc.status_documento === 'assinatura_pendente' ? 'bg-yellow-100 text-yellow-800' :
                                doc.status_documento === 'anexado' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {getStatusDocumentoText(doc.status_documento)}
                              </span>
                              {doc.url_arquivo && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500 italic">
                          Nenhum documento anexado
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{contrato.indiceReajuste}</div>
                      {contrato.percentualUltimos12Meses && contrato.diasParaVencer <= 60 && (
                        <div className="text-xs text-orange-600 font-medium">
                          {contrato.percentualUltimos12Meses}% (12m)
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleGerarContrato(contrato.id)}
                        title="Gerar novo contrato ou aditivo de serviço"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Gerar Contrato
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        {(contrato.termosAditivos?.length || 0) > 0 ? `Contrato + ${contrato.termosAditivos?.length} Aditivos` : 'Contrato'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => editarContrato(contrato)}
                      >
                        Editar
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
      
      {/* Dialog para Editar Contrato */}
      {contratoEditando && (
        <Dialog open={showEditarContrato} onOpenChange={setShowEditarContrato}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Contrato - {contratoEditando.cliente}</DialogTitle>
              <DialogDescription>
                Alterações nos valores dos serviços geram automaticamente um Termo Aditivo
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Histórico de Termos Aditivos */}
              {contratoEditando.termosAditivos && contratoEditando.termosAditivos.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-gray-900">Histórico de Alterações</h4>
                  <div className="space-y-2">
                    {contratoEditando.termosAditivos.map((termo) => (
                      <div key={termo.id} className="p-3 bg-blue-50 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-blue-800">
                              Termo Aditivo - {new Date(termo.data).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-xs text-blue-600">{termo.motivo}</p>
                            <div className="mt-2 space-y-1">
                              {termo.servicosAlterados.map((servico, index) => (
                                <div key={index} className="text-xs text-gray-600">
                                  {servico.modalidade}/{servico.especialidade} - {servico.categoria}: 
                                  <span className="text-red-600 line-through ml-1">
                                    R$ {servico.valorAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-green-600 font-medium ml-1">
                                    R$ {servico.valorNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edição de Serviços */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Serviços Contratados</h4>
                <div className="space-y-2">
                  {contratoEditando.servicos.map((servico, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{servico.modalidade}/{servico.especialidade}</Badge>
                        <span className="text-sm">{servico.categoria}</span>
                        <span className="text-sm text-gray-500">({servico.prioridade})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={servico.valor}
                          onChange={(e) => {
                            const novoValor = parseFloat(e.target.value) || 0;
                            const valorAnterior = servico.valor;
                            
                            // Atualizar o valor do serviço
                            const servicosAtualizados = contratoEditando.servicos.map((s, i) => 
                              i === index ? { ...s, valor: novoValor } : s
                            );
                            
                            const contratoAtualizado = {
                              ...contratoEditando,
                              servicos: servicosAtualizados
                            };
                            
                            setContratoEditando(contratoAtualizado);
                            
                            // Se o valor mudou, gerar termo aditivo
                            if (novoValor !== valorAnterior && novoValor > 0) {
                              const servicosAlterados = [{
                                servicoId: `${servico.modalidade}-${servico.especialidade}-${servico.categoria}`,
                                valorAnterior,
                                valorNovo: novoValor,
                                modalidade: servico.modalidade,
                                especialidade: servico.especialidade,
                                categoria: servico.categoria,
                              }];
                              
                              setTimeout(() => {
                                gerarTermoAditivo(contratoAtualizado, servicosAlterados);
                              }, 1000);
                            }
                          }}
                          className="w-24 text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditarContrato(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                // Salvar alterações no contrato
                const contratosAtualizados = contratos.map(c => 
                  c.id === contratoEditando.id ? contratoEditando : c
                );
                setContratos(contratosAtualizados);
                setShowEditarContrato(false);
                
                toast({
                  title: "Contrato atualizado",
                  description: `Alterações salvas para ${contratoEditando.cliente}`,
                });
              }}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}