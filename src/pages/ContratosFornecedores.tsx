import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  FileText,
  DollarSign,
  AlertTriangle,
  Plus,
  FileCheck,
  Download,
  TrendingUp,
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";

interface ContratoFornecedor {
  id: string;
  fornecedor: string;
  categoria: "Equipamentos" | "Software" | "Serviços" | "Insumos";
  dataInicio: string;
  dataFim: string;
  status: "Ativo" | "Vencido" | "A Vencer";
  servicos: ServicoFornecedor[];
  valorTotal: number;
  diasParaVencer: number;
}

interface ServicoFornecedor {
  descricao: string;
  categoria: string;
  valor: number;
  periodicidade: "Mensal" | "Anual" | "Por Demanda";
}

const contratosFornecedoresData: ContratoFornecedor[] = [
  {
    id: "1",
    fornecedor: "TechMed Equipamentos",
    categoria: "Equipamentos",
    dataInicio: "2024-01-01",
    dataFim: "2024-12-31",
    status: "Ativo",
    servicos: [
      { descricao: "Manutenção Ressonância", categoria: "Manutenção", valor: 2500.00, periodicidade: "Mensal" },
      { descricao: "Peças de Reposição", categoria: "Insumos", valor: 800.00, periodicidade: "Por Demanda" },
    ],
    valorTotal: 3300.00,
    diasParaVencer: 180
  },
  {
    id: "2",
    fornecedor: "SoftRadio Solutions",
    categoria: "Software",
    dataInicio: "2023-08-01",
    dataFim: "2024-07-31",
    status: "A Vencer",
    servicos: [
      { descricao: "Licença PACS", categoria: "Software", valor: 1200.00, periodicidade: "Anual" },
      { descricao: "Suporte Técnico", categoria: "Serviços", valor: 300.00, periodicidade: "Mensal" },
    ],
    valorTotal: 1500.00,
    diasParaVencer: 55
  },
  {
    id: "3",
    fornecedor: "CleanMed Higienização",
    categoria: "Serviços",
    dataInicio: "2023-01-01",
    dataFim: "2023-12-31",
    status: "Vencido",
    servicos: [
      { descricao: "Limpeza Especializada", categoria: "Higienização", valor: 450.00, periodicidade: "Mensal" },
    ],
    valorTotal: 450.00,
    diasParaVencer: -25
  },
];

export default function ContratosFornecedores() {
  const [contratos] = useState<ContratoFornecedor[]>(contratosFornecedoresData);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState("");

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

  const getCategoriaColor = (categoria: string) => {
    const colors = {
      "Equipamentos": "bg-blue-100 text-blue-800",
      "Software": "bg-purple-100 text-purple-800",
      "Serviços": "bg-green-100 text-green-800",
      "Insumos": "bg-orange-100 text-orange-800"
    };
    return colors[categoria as keyof typeof colors] || "bg-gray-100 text-gray-800";
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
        <h1 className="text-3xl font-bold text-gray-900">Contratos Fornecedores</h1>
        <p className="text-gray-600 mt-1">Gestão de contratos com fornecedores, equipamentos e serviços</p>
      </div>

      <FilterBar />

      {/* Resumo de Contratos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
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
              <DollarSign className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Custo Total Ativo</p>
                <p className="text-2xl font-bold text-gray-900">R$ {valorTotalAtivos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
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
                      <p className="text-sm font-medium text-yellow-800">{contrato.fornecedor}</p>
                      <p className="text-xs text-yellow-600">
                        {contrato.categoria} - Vence em {contrato.diasParaVencer} dias
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
              <DialogTitle>Cadastrar Novo Fornecedor</DialogTitle>
              <DialogDescription>
                Cadastre um novo fornecedor para criar um contrato
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fornecedor" className="text-right">
                  Fornecedor
                </Label>
                <Input
                  id="fornecedor"
                  value={novoFornecedor}
                  onChange={(e) => setNovoFornecedor(e.target.value)}
                  className="col-span-3"
                  placeholder="Nome do fornecedor..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNovoContrato(false)}>Cadastrar Fornecedor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline">
          <FileCheck className="h-4 w-4 mr-2" />
          Relatório de Gastos
        </Button>
      </div>

      {/* Distribuição por Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Equipamentos", "Software", "Serviços", "Insumos"].map((categoria) => {
                const contratosCategoria = contratos.filter(c => c.categoria === categoria && c.status === "Ativo");
                const valorCategoria = contratosCategoria.reduce((sum, c) => sum + c.valorTotal, 0);
                return (
                  <div key={categoria} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getCategoriaColor(categoria)}>{categoria}</Badge>
                      <span className="text-sm font-medium">{contratosCategoria.length} contratos</span>
                    </div>
                    <span className="text-sm font-bold">R$ {valorCategoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Renovações Necessárias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contratos
                .filter(c => c.diasParaVencer <= 90)
                .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
                .map((contrato) => (
                  <div key={contrato.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{contrato.fornecedor}</p>
                      <p className="text-xs text-gray-600">{contrato.categoria}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{contrato.diasParaVencer > 0 ? `${contrato.diasParaVencer} dias` : 'Vencido'}</p>
                      <p className="text-xs text-gray-600">R$ {contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
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
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
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
                  <TableCell className="font-medium">{contrato.fornecedor}</TableCell>
                  <TableCell>
                    <Badge className={getCategoriaColor(contrato.categoria)}>{contrato.categoria}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(contrato.dataFim).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{getStatusBadge(contrato.status, contrato.diasParaVencer)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contrato.servicos.slice(0, 2).map((servico, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {servico.descricao}
                        </Badge>
                      ))}
                      {contrato.servicos.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{contrato.servicos.length - 2}
                        </Badge>
                      )}
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