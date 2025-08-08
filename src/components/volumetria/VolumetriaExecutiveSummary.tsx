import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, Activity, Target, AlertTriangle, CheckCircle } from "lucide-react";
import { useVolumetriaProcessedData } from "@/hooks/useVolumetriaProcessedData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface ExecutiveSummaryOverride {
  clientes: any[];
  modalidades: any[];
  especialidades: any[];
  categorias: any[];
  prioridades: any[];
  medicos: any[];
  totalExames: number;
  totalAtrasados: number;
  percentualAtraso: number;
  loading: boolean;
}

export function VolumetriaExecutiveSummary({ override }: { override?: ExecutiveSummaryOverride }) {
  const processedData = useVolumetriaProcessedData();

  if (processedData.loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Garantir que temos dados para processar
  if (!processedData.clientes || processedData.clientes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Nenhum dado disponível para análise executiva
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar dados para análise - ordenar por volume (total_exames)
  const clientesArray = [...processedData.clientes]
    .filter(c => c.total_exames > 0)
    .sort((a, b) => b.total_exames - a.total_exames);

  // Análise de qualidade (menor atraso = melhor performance)
  const clientesQualidade = [...clientesArray]
    .filter(c => c.total_exames > 100) // Somente clientes com volume significativo
    .sort((a, b) => a.percentual_atraso - b.percentual_atraso);

  // Top 5 clientes por performance (menor atraso)
  const topClientesPerformance = clientesArray
    .filter(c => c.total_exames > 100) // Somente clientes com volume significativo
    .sort((a, b) => a.percentual_atraso - b.percentual_atraso)
    .slice(0, 5);

  // Análise de concentração de volume - DASHBOARD USA APENAS VALORES
  const volumeConcentration = clientesArray.reduce((acc, cliente, index) => {
    const participacao = (cliente.total_exames / processedData.totalExames) * 100;
    if (index < 5) acc.top5 += participacao;
    if (index < 10) acc.top10 += participacao;
    if (index < 20) acc.top20 += participacao;
    return acc;
  }, { top5: 0, top10: 0, top20: 0 });

  const modalidadeDistribution = processedData.modalidades
    .slice(0, 8)
    .map((m: any) => ({
      ...m,
      participacao: ((m.total_exames / processedData.totalExames) * 100).toFixed(1)
    }));

  // Análise de performance geral usando dados corretos - FONTE ÚNICA
  const performanceMetrics = {
    totalExames: processedData.totalExames,
    totalAtrasados: processedData.totalAtrasados,
    percentualAtraso: processedData.percentualAtraso,
    clientesAnalisados: clientesArray.length,
    clientesComExcelencia: clientesQualidade.filter(c => c.percentual_atraso < 10).length,
    clientesComProblemas: clientesQualidade.filter(c => c.percentual_atraso > 30).length,
    concentracaoMercado: volumeConcentration.top5.toFixed(1)
  };

  // Insights e alertas
  const insights = [
    {
      tipo: volumeConcentration.top5 > 70 ? 'alerta' : 'info',
      titulo: 'Concentração de Mercado',
      descricao: `Top 5 clientes representam ${volumeConcentration.top5.toFixed(1)}% do volume`,
      icone: volumeConcentration.top5 > 70 ? AlertTriangle : Target
    },
    {
      tipo: processedData.percentualAtraso > 25 ? 'alerta' : 'sucesso',
      titulo: 'Performance Temporal',
      descricao: `${processedData.percentualAtraso.toFixed(1)}% de atraso geral`,
      icone: processedData.percentualAtraso > 25 ? TrendingDown : TrendingUp
    },
    {
      tipo: 'info',
      titulo: 'Oportunidades',
      descricao: `${performanceMetrics.clientesComProblemas} clientes precisam de atenção`,
      icone: Activity
    }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Volume Total</p>
                <p className="text-2xl font-bold">{performanceMetrics.totalExames.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">exames processados</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance Geral</p>
                <p className="text-2xl font-bold">{performanceMetrics.percentualAtraso.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">taxa de atraso</p>
              </div>
              <Activity className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{performanceMetrics.clientesAnalisados}</p>
                <p className="text-xs text-muted-foreground">em atividade</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concentração</p>
                <p className="text-2xl font-bold">{performanceMetrics.concentracaoMercado}%</p>
                <p className="text-xs text-muted-foreground">top 5 clientes</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Concentração de Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise de Concentração de Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Top 5 Clientes</span>
                  <span className="font-medium">{volumeConcentration.top5.toFixed(1)}%</span>
                </div>
                <Progress value={volumeConcentration.top5} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Top 10 Clientes</span>
                  <span className="font-medium">{volumeConcentration.top10.toFixed(1)}%</span>
                </div>
                <Progress value={volumeConcentration.top10} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Top 20 Clientes</span>
                  <span className="font-medium">{volumeConcentration.top20.toFixed(1)}%</span>
                </div>
                <Progress value={volumeConcentration.top20} className="h-2" />
              </div>
            </div>

            <div className="col-span-2">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={clientesArray.slice(0, 20).map((c, i) => ({
                  posicao: i + 1,
                  participacao: (c.total_exames / processedData.totalExames) * 100,
                  acumulado: clientesArray.slice(0, i + 1).reduce((acc, client) => 
                    acc + (client.total_exames / processedData.totalExames) * 100, 0
                  )
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="posicao" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`, 
                      name === 'participacao' ? 'Participação' : 'Acumulado'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="acumulado" 
                    stackId="1" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="participacao" 
                    stackId="2" 
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Clientes por Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Top 5 - Melhor Performance
            </CardTitle>
            <CardDescription>Clientes com menor taxa de atraso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClientesPerformance.map((cliente, index) => (
                <div key={cliente.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {cliente.total_exames.toLocaleString()} exames
                    </p>
                  </div>
                  <Badge 
                    variant={cliente.percentual_atraso < 10 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {cliente.percentual_atraso.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              Top 5 - Maior Volume
            </CardTitle>
            <CardDescription>Clientes com maior volume de exames</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientesArray.slice(0, 5).map((cliente, index) => (
                <div key={cliente.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {((cliente.total_exames / processedData.totalExames) * 100).toFixed(1)}% do volume
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{cliente.total_exames.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">exames</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights e Alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Insights Executivos</CardTitle>
          <CardDescription>Análise estratégica e recomendações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, index) => {
              const Icon = insight.icone;
              return (
                <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Icon className={`h-5 w-5 mt-0.5 ${
                    insight.tipo === 'alerta' ? 'text-destructive' : 
                    insight.tipo === 'sucesso' ? 'text-green-500' : 'text-blue-500'
                  }`} />
                  <div>
                    <h4 className="font-medium">{insight.titulo}</h4>
                    <p className="text-sm text-muted-foreground">{insight.descricao}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Modalidade */}
      {modalidadeDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modalidadeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ nome, participacao }) => `${nome} (${participacao}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_exames"
                >
                  {modalidadeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}