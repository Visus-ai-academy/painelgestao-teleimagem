import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Download, TrendingUp, Target } from "lucide-react";

// Faixas de bonificação baseadas no Excel
const faixasBonificacao = [
  { faixa: "não elegível", percentualMin: 0, percentualMax: 74.99, percentualRemuneracao: 0, valorBase: 4700 },
  { faixa: "abaixo da meta", percentualMin: 75, percentualMax: 99.99, percentualRemuneracao: 40, valorBase: 4700 },
  { faixa: "meta", percentualMin: 100, percentualMax: 119.99, percentualRemuneracao: 100, valorBase: 4700 },
  { faixa: "super meta 1", percentualMin: 120, percentualMax: 139.99, percentualRemuneracao: 120, valorBase: 4700 },
  { faixa: "super meta 2", percentualMin: 140, percentualMax: 159.99, percentualRemuneracao: 140, valorBase: 4700 },
  { faixa: "super meta 3", percentualMin: 160, percentualMax: 189.99, percentualRemuneracao: 160, valorBase: 4700 },
  { faixa: "super meta 4", percentualMin: 190, percentualMax: 199.99, percentualRemuneracao: 180, valorBase: 4700 },
  { faixa: "super meta 5", percentualMin: 200, percentualMax: 999, percentualRemuneracao: 200, valorBase: 4700 },
];

// Dados mockados baseados no Excel (a partir de 2025-08)
const dadosBonificacao = [
  {
    mes: "2025-08",
    baseFaturamento: 1425967.00,
    meta: 44000.00,
    valorNaoAtingidoRedistribuido: 0,
    metaIncremental: 44000.00,
    metaAcumulada: 44000.00,
    metaFaturamento100: 1469967.00,
    faturamentoRealizadoCarteira: 1395015.00,
    valorMetaNaoAtingido: -74952.00,
    mesesFaltantes: 22,
    resultadoCarteira: -30952.00,
    resultadoAcumuladoCarteira: -30952.00,
    percentualAcumuladoMeta: -70.35,
    percentualAtingidoMetaMes: -70.35,
    retencaoCarteira: "Retração",
    realizouContatos100: "OK",
    habilitacaoBonificacao: false,
    faixaReferencialBonificacao: "Abaixo 75%",
    valorBonificacao: 0
  },
  {
    mes: "2025-09",
    baseFaturamento: 1469967.00,
    meta: 44000.00,
    valorNaoAtingidoRedistribuido: 3406.91,
    metaIncremental: 47406.91,
    metaAcumulada: 91406.91,
    metaFaturamento100: 1517373.91,
    faturamentoRealizadoCarteira: 1487147.00,
    valorMetaNaoAtingido: -30226.91,
    mesesFaltantes: 23,
    resultadoCarteira: 17180.00,
    resultadoAcumuladoCarteira: -13772.00,
    percentualAcumuladoMeta: -15.07,
    percentualAtingidoMetaMes: 36.24,
    retencaoCarteira: "OK",
    realizouContatos100: "OK",
    habilitacaoBonificacao: true,
    faixaReferencialBonificacao: "Abaixo 75%",
    valorBonificacao: 0
  },
  {
    mes: "2025-10",
    baseFaturamento: 1565619.91,
    meta: 44000.00,
    valorNaoAtingidoRedistribuido: 4721.12,
    metaIncremental: 48721.12,
    metaAcumulada: 140128.03,
    metaFaturamento100: 1614341.03,
    faturamentoRealizadoCarteira: 1534950.00,
    valorMetaNaoAtingido: -79391.03,
    mesesFaltantes: 21,
    resultadoCarteira: -30669.91,
    resultadoAcumuladoCarteira: -44441.91,
    percentualAcumuladoMeta: -31.72,
    percentualAtingidoMetaMes: -62.95,
    retencaoCarteira: "Retração",
    realizouContatos100: "OK",
    habilitacaoBonificacao: false,
    faixaReferencialBonificacao: "Abaixo 75%",
    valorBonificacao: 0
  },
];

// Lista de colaboradores (mockado)
const colaboradores = [
  { id: "1", nome: "Colaborador 1" },
  { id: "2", nome: "Colaborador 2" },
  { id: "3", nome: "Colaborador 3" },
];

// Lista de clientes (mockado)
const clientes = [
  { id: "1", nome: "Todos" },
  { id: "2", nome: "Cliente A" },
  { id: "3", nome: "Cliente B" },
];

export default function BonificacaoComercial() {
  const [filtroColaborador, setFiltroColaborador] = useState("todos");
  const [filtroMesAno, setFiltroMesAno] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("todos");

  const calcularValorBonificacao = (percentualAtingido: number) => {
    const faixa = faixasBonificacao.find(
      f => percentualAtingido >= f.percentualMin && percentualAtingido <= f.percentualMax
    );
    
    if (!faixa) return 0;
    
    return (faixa.valorBase * faixa.percentualRemuneracao) / 100;
  };

  const getBadgeRetencao = (retencao: string) => {
    if (retencao === "OK") {
      return <Badge className="bg-green-100 text-green-800">OK</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Retração</Badge>;
  };

  const getBadgeHabilitacao = (habilitado: boolean) => {
    if (habilitado) {
      return <Badge className="bg-green-100 text-green-800">Habilitada</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Não Habilitada</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bonificação Comercial</h1>
        <p className="text-muted-foreground mt-1">Análise de faturamento e cálculo de bonificação</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Colaborador</label>
              <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mês/Ano</label>
              <Select value={filtroMesAno} onValueChange={setFiltroMesAno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="2025-08">Agosto/2025</SelectItem>
                  <SelectItem value="2025-09">Setembro/2025</SelectItem>
                  <SelectItem value="2025-10">Outubro/2025</SelectItem>
                  <SelectItem value="2025-11">Novembro/2025</SelectItem>
                  <SelectItem value="2025-12">Dezembro/2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cliente</label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Meta Acumulada</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(dadosBonificacao[dadosBonificacao.length - 1]?.metaAcumulada || 0)}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Realizado</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(dadosBonificacao[dadosBonificacao.length - 1]?.faturamentoRealizadoCarteira || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">% Atingido da Meta</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatPercent(dadosBonificacao[dadosBonificacao.length - 1]?.percentualAcumuladoMeta || 0)}
                </p>
              </div>
              <Award className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bonificação Total</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(dadosBonificacao.reduce((acc, d) => acc + d.valorBonificacao, 0))}
                </p>
              </div>
              <Award className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Bonificação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Demonstrativo de Bonificação</CardTitle>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Mês</TableHead>
                  <TableHead className="text-right min-w-[130px]">Base Faturamento</TableHead>
                  <TableHead className="text-right min-w-[120px]">Meta</TableHead>
                  <TableHead className="text-right min-w-[150px]">Valor Não Atingido</TableHead>
                  <TableHead className="text-right min-w-[140px]">Meta Incremental</TableHead>
                  <TableHead className="text-right min-w-[130px]">Meta Acumulada</TableHead>
                  <TableHead className="text-right min-w-[150px]">Meta Fat. 100%</TableHead>
                  <TableHead className="text-right min-w-[170px]">Fat. Realizado</TableHead>
                  <TableHead className="text-right min-w-[160px]">Meta Não Atingido</TableHead>
                  <TableHead className="text-right min-w-[130px]">Resultado</TableHead>
                  <TableHead className="text-right min-w-[170px]">Resultado Acum.</TableHead>
                  <TableHead className="text-right min-w-[130px]">% Acum. Meta</TableHead>
                  <TableHead className="text-right min-w-[130px]">% Atingido Mês</TableHead>
                  <TableHead className="min-w-[120px]">Retenção</TableHead>
                  <TableHead className="min-w-[150px]">Contatos 100%</TableHead>
                  <TableHead className="min-w-[140px]">Habilitação</TableHead>
                  <TableHead className="min-w-[150px]">Faixa Bonificação</TableHead>
                  <TableHead className="text-right min-w-[130px]">Valor Bonificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosBonificacao.map((dado, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{dado.mes}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.baseFaturamento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.meta)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.valorNaoAtingidoRedistribuido)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.metaIncremental)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.metaAcumulada)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.metaFaturamento100)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.faturamentoRealizadoCarteira)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.valorMetaNaoAtingido)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.resultadoCarteira)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.resultadoAcumuladoCarteira)}</TableCell>
                    <TableCell className="text-right">{formatPercent(dado.percentualAcumuladoMeta)}</TableCell>
                    <TableCell className="text-right">{formatPercent(dado.percentualAtingidoMetaMes)}</TableCell>
                    <TableCell>{getBadgeRetencao(dado.retencaoCarteira)}</TableCell>
                    <TableCell>{dado.realizouContatos100}</TableCell>
                    <TableCell>{getBadgeHabilitacao(dado.habilitacaoBonificacao)}</TableCell>
                    <TableCell>{dado.faixaReferencialBonificacao}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(dado.valorBonificacao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Faixas de Bonificação */}
      <Card>
        <CardHeader>
          <CardTitle>Faixas de Bonificação (Valor Base: R$ 4.700,00)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead>% da Meta</TableHead>
                  <TableHead className="text-right">% da Remuneração</TableHead>
                  <TableHead className="text-right">Valor Bonificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faixasBonificacao.map((faixa, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{faixa.faixa}</TableCell>
                    <TableCell>
                      {faixa.percentualMax === 999 
                        ? `Acima de ${faixa.percentualMin}%`
                        : `${faixa.percentualMin}% - ${faixa.percentualMax}%`
                      }
                    </TableCell>
                    <TableCell className="text-right">{faixa.percentualRemuneracao}%</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency((faixa.valorBase * faixa.percentualRemuneracao) / 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
