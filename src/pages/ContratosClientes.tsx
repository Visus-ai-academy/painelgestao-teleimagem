import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { useToast } from "@/hooks/use-toast";

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

const contratosData: ContratoCliente[] = [
  {
    id: "1",
    cliente: "Hospital São Lucas",
    dataInicio: "2024-01-01",
    dataFim: "2024-12-31",
    status: "Ativo",
    servicos: [
      { modalidade: "MR", especialidade: "NE", categoria: "Angio", prioridade: "Urgente", valor: 450.00 },
      { modalidade: "CT", especialidade: "CA", categoria: "Contrastado", prioridade: "Rotina", valor: 380.00 },
    ],
    valorTotal: 830.00,
    diasParaVencer: 120,
    indiceReajuste: "IPCA",
    endereco: "Rua das Flores, 123 - Centro",
    telefone: "(11) 3456-7890",
    emailFinanceiro: "financeiro@saolucas.com.br",
    emailOperacional: "operacional@saolucas.com.br",
    site: "www.saolucas.com.br",
    responsavel: "Dr. João Silva",
    telefoneResponsavel: "(11) 9876-5432",
    emailResponsavel: "joao.silva@saolucas.com.br",
    cobrancaIntegracao: true,
    valorIntegracao: 500.00,
    cobrancaSuporte: true,
    valorSuporte: 300.00
  },
  {
    id: "2",
    cliente: "Clínica Vida Plena",
    dataInicio: "2023-06-01",
    dataFim: "2024-05-31",
    status: "A Vencer",
    servicos: [
      { modalidade: "DO", especialidade: "ME", categoria: "Mastoide", prioridade: "Rotina", valor: 220.00 },
      { modalidade: "MG", especialidade: "MI", categoria: "Score", prioridade: "Rotina", valor: 180.00 },
    ],
    valorTotal: 400.00,
    diasParaVencer: 45,
    indiceReajuste: "IGP-M",
    percentualUltimos12Meses: 5.45,
    cobrancaIntegracao: false,
    cobrancaSuporte: true,
    valorSuporte: 200.00
  },
  {
    id: "3",
    cliente: "Centro Médico Norte",
    dataInicio: "2023-01-01",
    dataFim: "2023-12-31",
    status: "Vencido",
    servicos: [
      { modalidade: "RX", especialidade: "MA", categoria: "Prostata", prioridade: "Plantão", valor: 120.00 },
    ],
    valorTotal: 120.00,
    diasParaVencer: -30,
    indiceReajuste: "INPC",
    cobrancaIntegracao: false,
    cobrancaSuporte: false
  },
];

export default function ContratosClientes() {
  const [contratos, setContratos] = useState<ContratoCliente[]>(contratosData);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const { toast } = useToast();
  
  const [novoCliente, setNovoCliente] = useState<NovoCliente>({
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

  const salvarCliente = () => {
    if (!novoCliente.nome || !novoCliente.dataInicio || !novoCliente.dataFim || novoCliente.servicos.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, datas e adicione pelo menos um serviço.",
        variant: "destructive",
      });
      return;
    }

    const novoContrato: ContratoCliente = {
      id: Date.now().toString(),
      cliente: novoCliente.nome,
      dataInicio: novoCliente.dataInicio,
      dataFim: novoCliente.dataFim,
      status: "Ativo",
      servicos: novoCliente.servicos,
      valorTotal: calcularValorTotal(),
      diasParaVencer: Math.ceil((new Date(novoCliente.dataFim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      indiceReajuste: novoCliente.indiceReajuste,
      endereco: novoCliente.endereco,
      telefone: novoCliente.telefone,
      emailFinanceiro: novoCliente.emailFinanceiro,
      emailOperacional: novoCliente.emailOperacional,
      site: novoCliente.site,
      responsavel: novoCliente.responsavel,
      telefoneResponsavel: novoCliente.telefoneResponsavel,
      emailResponsavel: novoCliente.emailResponsavel,
      cobrancaIntegracao: novoCliente.cobrancaIntegracao,
      valorIntegracao: novoCliente.valorIntegracao,
      cobrancaSuporte: novoCliente.cobrancaSuporte,
      valorSuporte: novoCliente.valorSuporte,
    };

    setContratos(prev => [...prev, novoContrato]);
    setShowNovoContrato(false);
    
    // Reset form
    setNovoCliente({
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
      description: `Cliente ${novoContrato.cliente} cadastrado com sucesso!`,
    });
  };

  const handleGerarContrato = (contratoId: string) => {
    const contrato = contratos.find(c => c.id === contratoId);
    if (contrato) {
      // Gerar PDF do contrato usando template
      console.log("Gerando contrato PDF para:", contrato.cliente);
      toast({
        title: "Contrato gerado",
        description: `Contrato PDF gerado para ${contrato.cliente}`,
      });
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

      {/* Ações Principais */}
      <div className="flex gap-4">
        <Dialog open={showNovoContrato} onOpenChange={setShowNovoContrato}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente e configure os serviços contratados
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Dados Básicos */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-900">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome do Cliente *</Label>
                    <Input
                      id="nome"
                      value={novoCliente.nome}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome da empresa/clínica..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={novoCliente.telefone}
                      onChange={(e) => setNovoCliente(prev => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(11) 9999-9999"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Serviços Contratados</TableHead>
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
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}