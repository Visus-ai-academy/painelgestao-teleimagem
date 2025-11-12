import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  FileText, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Calendar,
  Percent,
  Users
} from "lucide-react";

const DocumentacaoFaturamento = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Documentação - Regras de Negócio
        </h1>
        <p className="text-muted-foreground text-lg">
          Sistema de Faturamento - Regras, Cálculos e Processos
        </p>
      </div>

      <Tabs defaultValue="impostos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="impostos">Impostos</TabsTrigger>
          <TabsTrigger value="franquia">Franquia</TabsTrigger>
          <TabsTrigger value="calculo">Cálculos</TabsTrigger>
          <TabsTrigger value="periodos">Períodos</TabsTrigger>
          <TabsTrigger value="processo">Processo</TabsTrigger>
        </TabsList>

        {/* TAB: IMPOSTOS */}
        <TabsContent value="impostos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                <CardTitle>Regras de Impostos Federais</CardTitle>
              </div>
              <CardDescription>
                Aplicação de impostos federais com regra de valor mínimo de R$ 10,00
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IRRF */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">IRRF</Badge>
                  <span className="text-sm font-medium">Imposto de Renda Retido na Fonte</span>
                </div>
                <div className="pl-4 space-y-2 border-l-2 border-primary/20">
                  <p className="text-sm"><strong>Percentual:</strong> 1,5% sobre o valor bruto</p>
                  <p className="text-sm"><strong>Regra de Valor Mínimo:</strong></p>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Se IRRF calculado {'<'} R$ 10,00 → IRRF = R$ 0,00
                    </p>
                    <p className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Se IRRF calculado ≥ R$ 10,00 → IRRF mantém valor calculado
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      Exemplo
                    </p>
                    <p className="text-sm mt-1">
                      Cliente DIS_SORRISO com IRRF de R$ 7,72 → IRRF zerado (menor que R$ 10,00)
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* PIS + COFINS + CSLL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">PIS + COFINS + CSLL</Badge>
                  <span className="text-sm font-medium">Impostos sobre Faturamento</span>
                </div>
                <div className="pl-4 space-y-2 border-l-2 border-primary/20">
                  <p className="text-sm"><strong>Percentuais:</strong></p>
                  <ul className="text-sm space-y-1 pl-4">
                    <li>• PIS: 0,65% sobre o valor bruto</li>
                    <li>• COFINS: 3% sobre o valor bruto</li>
                    <li>• CSLL: 1% sobre o valor bruto</li>
                  </ul>
                  <p className="text-sm mt-2"><strong>Regra de Valor Mínimo:</strong></p>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Se (PIS + COFINS + CSLL) {'<'} R$ 10,00 → Todos zerados
                    </p>
                    <p className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Se (PIS + COFINS + CSLL) ≥ R$ 10,00 → Mantém valores calculados
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ISS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">ISS</Badge>
                  <span className="text-sm font-medium">Imposto Sobre Serviços</span>
                </div>
                <div className="pl-4 space-y-2 border-l-2 border-secondary/20">
                  <p className="text-sm"><strong>Percentual:</strong> Configurável por cliente</p>
                  <p className="text-sm"><strong>Regra:</strong> Definido nos parâmetros de faturamento de cada cliente</p>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">
                      Não há regra de valor mínimo para o ISS - sempre aplicado conforme percentual configurado
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mt-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  Importante
                </p>
                <p className="text-sm mt-1">
                  As duas regras de R$ 10,00 são <strong>independentes</strong>. É possível que o IRRF seja zerado 
                  enquanto os outros impostos são mantidos, ou vice-versa, dependendo dos valores calculados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: FRANQUIA */}
        <TabsContent value="franquia" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Sistema de Franquia</CardTitle>
              </div>
              <CardDescription>
                Regras de aplicação de franquia e valores acima da franquia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Como Funciona
                </h3>
                <div className="pl-4 space-y-2 border-l-2 border-primary/20">
                  <p className="text-sm">
                    1. <strong>Volume de Franquia:</strong> Quantidade de exames inclusos na franquia mensal
                  </p>
                  <p className="text-sm">
                    2. <strong>Valor da Franquia:</strong> Valor fixo mensal cobrado pela franquia
                  </p>
                  <p className="text-sm">
                    3. <strong>Valor Acima da Franquia:</strong> Valor unitário por exame que exceder o volume da franquia
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Cálculo</h3>
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <p className="text-sm font-mono">
                    Se (Total Exames ≤ Volume Franquia):
                  </p>
                  <p className="text-sm font-mono pl-4">
                    → Valor Total = Valor da Franquia
                  </p>
                  <p className="text-sm font-mono mt-2">
                    Se (Total Exames {'>'} Volume Franquia):
                  </p>
                  <p className="text-sm font-mono pl-4">
                    → Exames Excedentes = Total Exames - Volume Franquia
                  </p>
                  <p className="text-sm font-mono pl-4">
                    → Valor Total = Valor da Franquia + (Exames Excedentes × Valor Acima Franquia)
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Exemplo Prático
                </p>
                <div className="space-y-1 mt-2 text-sm">
                  <p>• Volume Franquia: 100 exames</p>
                  <p>• Valor Franquia: R$ 5.000,00</p>
                  <p>• Valor Acima Franquia: R$ 45,00</p>
                  <p className="mt-2 font-medium">Cenário 1: 80 exames realizados</p>
                  <p className="pl-4">→ Valor = R$ 5.000,00 (apenas franquia)</p>
                  <p className="mt-2 font-medium">Cenário 2: 120 exames realizados</p>
                  <p className="pl-4">→ Excedente = 20 exames</p>
                  <p className="pl-4">→ Valor = R$ 5.000,00 + (20 × R$ 45,00) = R$ 5.900,00</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CÁLCULOS */}
        <TabsContent value="calculo" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle>Estrutura de Cálculos</CardTitle>
              </div>
              <CardDescription>
                Ordem e composição dos cálculos de faturamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold">1. Valor Bruto</h3>
                <div className="pl-4 border-l-2 border-primary/20">
                  <p className="text-sm">
                    Calculado com base nos parâmetros do cliente (franquia ou valores por tipo de exame)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">2. Adicionais</h3>
                <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                  <p className="text-sm">
                    <strong>Adicional de Urgência:</strong> Percentual aplicado sobre exames urgentes
                  </p>
                  <p className="text-sm">
                    <strong>Integração:</strong> Valor fixo mensal se aplicável
                  </p>
                  <p className="text-sm">
                    <strong>Portal de Laudos:</strong> Valor fixo mensal se aplicável
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">3. Impostos</h3>
                <div className="pl-4 border-l-2 border-primary/20">
                  <div className="bg-muted p-3 rounded-md space-y-2 text-sm font-mono">
                    <p>PIS = Valor Bruto × 0,65%</p>
                    <p>COFINS = Valor Bruto × 3%</p>
                    <p>CSLL = Valor Bruto × 1%</p>
                    <p>IRRF = Valor Bruto × 1,5%</p>
                    <p>ISS = Valor Bruto × % Cliente</p>
                    <p className="mt-2 pt-2 border-t border-border">
                      Aplicar regras de R$ 10,00 (ver aba Impostos)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">4. Valor Líquido</h3>
                <div className="pl-4 border-l-2 border-primary/20">
                  <div className="bg-primary/5 p-3 rounded-md">
                    <p className="text-sm font-mono">
                      Valor Líquido = Valor Bruto + Adicionais - Total Impostos
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PERÍODOS */}
        <TabsContent value="periodos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Períodos de Faturamento</CardTitle>
              </div>
              <CardDescription>
                Definição e regras de períodos de faturamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Definição do Período</h3>
                <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                  <p className="text-sm">
                    O período de faturamento segue a regra: <strong>dia 8 do mês anterior até dia 7 do mês atual</strong>
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                    <p className="text-sm font-medium">Exemplo:</p>
                    <p className="text-sm">
                      Período referente a Dezembro/2024:
                      <br />
                      • Início: 08/12/2024
                      <br />
                      • Fim: 07/01/2025
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Dados Passados (Legado)</h3>
                <div className="pl-4 border-l-2 border-primary/20">
                  <p className="text-sm">
                    Períodos anteriores a <strong>Outubro/2025</strong> são considerados "Dados Passados" e podem ter 
                    regras de processamento diferenciadas conforme configuração das regras de exclusão.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Fechamento e Bloqueio</h3>
                <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                  <p className="text-sm">
                    • Períodos podem ser <Badge variant="outline">Fechados</Badge> após processamento
                  </p>
                  <p className="text-sm">
                    • Períodos fechados não permitem reprocessamento sem desbloqueio
                  </p>
                  <p className="text-sm">
                    • Dia de fechamento configurável por cliente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PROCESSO */}
        <TabsContent value="processo" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Fluxo de Faturamento</CardTitle>
              </div>
              <CardDescription>
                Etapas do processo de geração de faturamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">Upload de Dados</h4>
                    <p className="text-sm text-muted-foreground">
                      Importação de planilhas Excel com dados de exames realizados
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">Aplicação de Regras de Exclusão</h4>
                    <p className="text-sm text-muted-foreground">
                      Processamento de regras configuradas para excluir exames específicos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">Geração de Demonstrativos</h4>
                    <p className="text-sm text-muted-foreground">
                      Cálculo dos valores por cliente aplicando franquias, adicionais e impostos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">Geração de Relatórios</h4>
                    <p className="text-sm text-muted-foreground">
                      Criação de relatórios em PDF para envio aos clientes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    5
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">Envio e Acompanhamento</h4>
                    <p className="text-sm text-muted-foreground">
                      Envio de relatórios por email e acompanhamento via régua de cobrança
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Documentos Gerados
                </p>
                <ul className="text-sm mt-2 space-y-1 pl-4">
                  <li>• Demonstrativo detalhado por cliente</li>
                  <li>• Relatório consolidado de faturamento</li>
                  <li>• Relatório de exclusões aplicadas</li>
                  <li>• Logs de processamento</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <CardTitle>Pontos de Atenção</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Ordem de Processamento</p>
                  <p className="text-sm text-muted-foreground">
                    Sempre aguardar conclusão de cada etapa antes de iniciar a próxima
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Validação de Parâmetros</p>
                  <p className="text-sm text-muted-foreground">
                    Verificar se todos os clientes possuem parâmetros de faturamento configurados
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Logs e Auditoria</p>
                  <p className="text-sm text-muted-foreground">
                    Sempre revisar logs de processamento para identificar possíveis erros
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentacaoFaturamento;