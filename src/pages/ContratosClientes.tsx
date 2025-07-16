import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";

interface ContratoCliente {
  id: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  status: "Ativo" | "Vencido" | "A Vencer";
  servicos: ServicoContratado[];
  valorTotal: number;
  diasParaVencer: number;
}

interface ServicoContratado {
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA";
  categoria: "Angio" | "Contrastado" | "Mastoide" | "OIT" | "Pescoço" | "Prostata" | "Score";
  prioridade: "Plantão" | "Rotina" | "Urgente";
  valor: number;
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
    diasParaVencer: 120
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
    diasParaVencer: 45
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
    diasParaVencer: -30
  },
];

export default function ContratosClientes() {
  const [contratos] = useState<ContratoCliente[]>(contratosData);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [novoCliente, setNovoCliente] = useState("");

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

  const handleGerarContrato = (contratoId: string) => {
    console.log("Gerando contrato para:", contratoId);
    // Aqui seria implementada a lógica de geração de contrato
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente para criar um contrato
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cliente" className="text-right">
                  Cliente
                </Label>
                <Input
                  id="cliente"
                  value={novoCliente}
                  onChange={(e) => setNovoCliente(e.target.value)}
                  className="col-span-3"
                  placeholder="Nome do cliente..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNovoContrato(false)}>Cadastrar Cliente</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <TableHead>Serviços</TableHead>
                <TableHead>Valor Total</TableHead>
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
                    <div className="flex flex-wrap gap-1">
                      {contrato.servicos.map((servico, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {servico.modalidade}/{servico.especialidade}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>R$ {contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleGerarContrato(contrato.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Gerar
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