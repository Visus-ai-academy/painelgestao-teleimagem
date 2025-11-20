import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Download, Target } from "lucide-react";

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

// Configuração de metas e base inicial
const configMetas = {
  baseFaturamentoInicial: 1425967.00, // Base para 2025-08
  metaInicial: 44000.00, // Meta para os primeiros 3 meses
  metaPosterior: 100000.00, // Meta a partir de 2025-11
  mesInicialCalculo: "2025-08",
  mesesComMetaInicial: 3, // Agosto, Setembro, Outubro
  totalMeses: 24, // Total de meses do projeto
};

// Interface para dados de bonificação
interface DadosBonificacao {
  mes: string;
  baseFaturamento: number;
  meta: number;
  valorNaoAtingidoRedistribuido: number;
  metaIncremental: number;
  metaAcumulada: number;
  metaFaturamento100: number;
  faturamentoRealizadoCarteira: number;
  valorMetaNaoAtingido: number;
  mesesFaltantes: number;
  resultadoCarteira: number;
  resultadoAcumuladoCarteira: number;
  percentualAcumuladoMeta: number;
  percentualAtingidoMetaMes: number;
  retencaoCarteira: string;
  realizouContatos100: string;
  habilitacaoBonificacao: boolean;
  faixaReferencialBonificacao: string;
  valorBonificacao: number;
}

// Função para calcular a faixa de bonificação
const calcularFaixaBonificacao = (percentualAcumulado: number): { faixa: string; valor: number } => {
  const faixa = faixasBonificacao.find(
    f => percentualAcumulado >= f.percentualMin && percentualAcumulado <= f.percentualMax
  );
  
  if (!faixa) return { faixa: "não elegível", valor: 0 };
  
  const valor = (faixa.valorBase * faixa.percentualRemuneracao) / 100;
  return { faixa: faixa.faixa, valor };
};

// Função para gerar dados calculados
const gerarDadosCalculados = (
  faturamentosEditaveis: Record<string, number> = {},
  contatosEditaveis: Record<string, string> = {}
): DadosBonificacao[] => {
  const dados: DadosBonificacao[] = [];
  let baseFaturamentoAnterior = configMetas.baseFaturamentoInicial;
  let metaAcumuladaTotal = 0;
  let resultadoAcumuladoTotal = 0;
  let valorNaoAtingidoAcumulado = 0;
  
  // Dados reais de faturamento (a partir de 2025-08, os 3 primeiros meses com dados reais do Excel)
  const faturamentoReal: Record<string, number> = {
    "2025-08": 1395015.00,
    "2025-09": 1487147.00,
    "2025-10": 1534950.00,
    // A partir de 2025-11 virá dos valores editáveis ou do sistema de faturamento
    ...faturamentosEditaveis
  };

  // Dados de contato 100% da carteira (usa os valores editáveis)
  const realizouContatos: Record<string, string> = contatosEditaveis;

  for (let i = 0; i < configMetas.totalMeses; i++) {
    const dataBase = new Date(2025, 7 + i, 1); // Começa em agosto (mês 7)
    const mes = `${dataBase.getFullYear()}-${String(dataBase.getMonth() + 1).padStart(2, '0')}`;
    
    // Define a meta do mês
    const meta = i < configMetas.mesesComMetaInicial ? configMetas.metaInicial : configMetas.metaPosterior;
    
    // Calcula o valor não atingido redistribuído
    // Fórmula: Distribui o valor não atingido acumulado pelos meses restantes
    const mesesFaltantes = configMetas.totalMeses - i;
    const valorNaoAtingidoRedistribuido = mesesFaltantes > 0 ? valorNaoAtingidoAcumulado / mesesFaltantes : 0;
    
    // Meta incremental = Meta + Valor redistribuído
    const metaIncremental = meta + valorNaoAtingidoRedistribuido;
    
    // Meta acumulada
    metaAcumuladaTotal += metaIncremental;
    
    // Base de faturamento (primeiro mês usa a base inicial, depois usa a Meta Faturamento 100% do mês anterior)
    const baseFaturamento = i === 0 ? configMetas.baseFaturamentoInicial : baseFaturamentoAnterior;
    
    // Meta Faturamento 100%
    const metaFaturamento100 = baseFaturamento + metaIncremental;
    
    // Faturamento realizado da carteira (vem dos dados reais ou será 0 se não houver)
    const faturamentoRealizadoCarteira = faturamentoReal[mes] || 0;
    
    // Resultado da carteira = Faturamento Realizado - Base Faturamento
    const resultadoCarteira = faturamentoRealizadoCarteira > 0 
      ? faturamentoRealizadoCarteira - baseFaturamento 
      : 0;
    
    // Valor da meta não atingido = Meta Incremental - Resultado
    const valorMetaNaoAtingido = faturamentoRealizadoCarteira > 0
      ? metaIncremental - resultadoCarteira
      : 0;
    
    // Atualiza o acumulado de valor não atingido apenas se houver faturamento
    if (faturamentoRealizadoCarteira > 0) {
      if (valorMetaNaoAtingido > 0) {
        // Só acumula se não atingiu a meta
        valorNaoAtingidoAcumulado += valorMetaNaoAtingido;
      }
      // Se atingiu ou superou a meta, não acumula negativo
    }
    
    // Resultado acumulado - soma apenas dos meses com faturamento
    if (faturamentoRealizadoCarteira > 0) {
      resultadoAcumuladoTotal += resultadoCarteira;
    }
    
    // % Acumulado da meta = (Resultado Acumulado / Meta Acumulada) * 100
    const percentualAcumuladoMeta = metaAcumuladaTotal > 0 
      ? (resultadoAcumuladoTotal / metaAcumuladaTotal) * 100 
      : 0;
    
    // % Atingido da meta do mês = (Resultado / Meta Incremental) * 100
    const percentualAtingidoMetaMes = faturamentoRealizadoCarteira > 0 && metaIncremental > 0
      ? (resultadoCarteira / metaIncremental) * 100 
      : 0;
    
    // Retenção carteira - só mostra se houver faturamento
    const retencaoCarteira = faturamentoRealizadoCarteira > 0
      ? (resultadoCarteira >= 0 ? "OK" : "Retração")
      : "";
    
    // Realizou contatos com 100% da carteira
    const realizouContatos100 = realizouContatos[mes] || "";
    
    // Habilitação bonificação - precisa ter retenção OK E contatos OK
    const habilitacaoBonificacao = retencaoCarteira === "OK" && realizouContatos100 === "OK";
    
    // Faixa e valor de bonificação baseado no % Acumulado
    const { faixa, valor } = calcularFaixaBonificacao(percentualAcumuladoMeta);
    const faixaReferencialBonificacao = faturamentoRealizadoCarteira > 0
      ? faixa
      : "";
    const valorBonificacao = habilitacaoBonificacao && faturamentoRealizadoCarteira > 0 ? valor : 0;
    
    dados.push({
      mes,
      baseFaturamento,
      meta,
      valorNaoAtingidoRedistribuido,
      metaIncremental,
      metaAcumulada: metaAcumuladaTotal,
      metaFaturamento100,
      faturamentoRealizadoCarteira,
      valorMetaNaoAtingido,
      mesesFaltantes,
      resultadoCarteira,
      resultadoAcumuladoCarteira: resultadoAcumuladoTotal,
      percentualAcumuladoMeta,
      percentualAtingidoMetaMes,
      retencaoCarteira,
      realizouContatos100,
      habilitacaoBonificacao,
      faixaReferencialBonificacao,
      valorBonificacao,
    });
    
    // Atualiza a base para o próximo mês
    baseFaturamentoAnterior = metaFaturamento100;
  }
  
  return dados;
};

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
  
  // Estado para armazenar faturamentos editáveis a partir de 2025-11
  const [faturamentosEditaveis, setFaturamentosEditaveis] = useState<Record<string, number>>({});
  
  // Estado para controlar qual campo está sendo editado
  const [campoEmEdicao, setCampoEmEdicao] = useState<string | null>(null);
  
  // Estado para armazenar contatos 100% editáveis
  const [contatosEditaveis, setContatosEditaveis] = useState<Record<string, string>>({
    "2025-08": "OK",
    "2025-09": "OK",
    "2025-10": "OK",
  });

  // Gera os dados calculados com as fórmulas do Excel
  const dadosBonificacao = gerarDadosCalculados(faturamentosEditaveis, contatosEditaveis);
  
  const getBadgeRetencao = (retencao: string) => {
    if (retencao === "OK") {
      return <Badge className="bg-green-100 text-green-800">OK</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Retração</Badge>;
  };

  const handleFaturamentoChange = (mes: string, valor: string) => {
    // Remove tudo exceto números e vírgula/ponto
    const valorLimpo = valor.replace(/[^\d.,]/g, '').replace(',', '.');
    const valorNumerico = parseFloat(valorLimpo) || 0;
    setFaturamentosEditaveis(prev => ({
      ...prev,
      [mes]: valorNumerico
    }));
  };

  const handleContatosChange = (mes: string, valor: string) => {
    setContatosEditaveis(prev => ({
      ...prev,
      [mes]: valor
    }));
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
  
  // Encontra o último mês com faturamento realizado
  const ultimoMesComFaturamento = dadosBonificacao
    .filter(d => d.faturamentoRealizadoCarteira > 0)
    .slice(-1)[0];
  
  // Calcula a soma acumulada da meta não atingida até o último mês com faturamento
  const somaMetaNaoAtingida = dadosBonificacao
    .filter(d => d.faturamentoRealizadoCarteira > 0)
    .reduce((acc, d) => acc + d.valorMetaNaoAtingido, 0);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">% Atingido da Meta</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatPercent(ultimoMesComFaturamento?.percentualAcumuladoMeta || 0)}
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
                <p className="text-sm text-muted-foreground">Meta Não Atingida Acum.</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(somaMetaNaoAtingida)}
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
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
                    <TableCell className="text-right">
                      {dado.mes >= "2025-11" ? (
                        <input
                          type="number"
                          step="0.01"
                          value={faturamentosEditaveis[dado.mes] !== undefined 
                            ? faturamentosEditaveis[dado.mes] 
                            : dado.faturamentoRealizadoCarteira || ''}
                          onChange={(e) => handleFaturamentoChange(dado.mes, e.target.value)}
                          onFocus={() => setCampoEmEdicao(dado.mes)}
                          onBlur={() => setCampoEmEdicao(null)}
                          className="w-full text-right bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="0.00"
                        />
                      ) : (
                        formatCurrency(dado.faturamentoRealizadoCarteira)
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.valorMetaNaoAtingido)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.resultadoCarteira)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dado.resultadoAcumuladoCarteira)}</TableCell>
                    <TableCell className="text-right">{formatPercent(dado.percentualAcumuladoMeta)}</TableCell>
                    <TableCell className="text-right">{formatPercent(dado.percentualAtingidoMetaMes)}</TableCell>
                    <TableCell>{getBadgeRetencao(dado.retencaoCarteira)}</TableCell>
                    <TableCell>
                      <input
                        type="text"
                        value={contatosEditaveis[dado.mes] || ''}
                        onChange={(e) => handleContatosChange(dado.mes, e.target.value)}
                        className="w-full text-center bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder=""
                        maxLength={2}
                      />
                    </TableCell>
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
