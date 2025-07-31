import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, Award, AlertCircle, Users, Activity } from "lucide-react";

interface ClienteData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
}

interface ModalidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  atrasados?: number;
  percentual_atraso?: number;
}

interface ExecutiveSummaryData {
  stats: {
    total_exames: number;
    total_registros: number;
    total_atrasados: number;
    percentual_atraso: number;
    total_clientes: number;
    total_modalidades: number;
    total_especialidades: number;
    total_medicos: number;
  };
  clientes: ClienteData[];
  modalidades: ModalidadeData[];
  especialidades: ModalidadeData[];
}

interface VolumetriaExecutiveSummaryProps {
  data: ExecutiveSummaryData;
}

export function VolumetriaExecutiveSummary({ data }: VolumetriaExecutiveSummaryProps) {
  // Top 5 clientes por volume
  const topClientesVolume = data.clientes
    .sort((a, b) => b.total_exames - a.total_exames)
    .slice(0, 5);

  // Top 5 clientes por performance (menor atraso)
  const topClientesPerformance = data.clientes
    .filter(c => c.total_exames > 100) // Somente clientes com volume significativo
    .sort((a, b) => a.percentual_atraso - b.percentual_atraso)
    .slice(0, 5);

  // Análise de concentração de volume
  const volumeConcentration = data.clientes.reduce((acc, cliente, index) => {
    const participacao = (cliente.total_exames / data.stats.total_exames) * 100;
    if (index < 5) acc.top5 += participacao;
    if (index < 10) acc.top10 += participacao;
    if (index < 20) acc.top20 += participacao;
    return acc;
  }, { top5: 0, top10: 0, top20: 0 });

  // Distribuição por modalidade
  const modalidadeDistribution = data.modalidades
    .sort((a, b) => b.total_exames - a.total_exames)
    .slice(0, 8)
    .map(m => ({
      ...m,
      participacao: ((m.total_exames / data.stats.total_exames) * 100).toFixed(1)
    }));

  // Análise de performance geral
  const performanceLevel = 
    data.stats.percentual_atraso <= 5 ? { label: 'Excelente', color: 'text-green-600', bgColor: 'bg-green-100' } :
    data.stats.percentual_atraso <= 10 ? { label: 'Bom', color: 'text-blue-600', bgColor: 'bg-blue-100' } :
    data.stats.percentual_atraso <= 15 ? { label: 'Regular', color: 'text-yellow-600', bgColor: 'bg-yellow-100' } :
    { label: 'Crítico', color: 'text-red-600', bgColor: 'bg-red-100' };

  return (
    <div className="space-y-6">
      {/* KPIs Executivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Volume Total</p>
                <p className="text-2xl font-bold text-primary">{data.stats.total_exames.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Laudos processados</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Performance</p>
                <p className={`text-2xl font-bold ${performanceLevel.color}`}>
                  {data.stats.percentual_atraso.toFixed(1)}%
                </p>
                <Badge className={`text-xs ${performanceLevel.bgColor} ${performanceLevel.color}`}>
                  {performanceLevel.label}
                </Badge>
              </div>
              {data.stats.percentual_atraso <= 10 ? 
                <TrendingUp className="h-8 w-8 text-green-500" /> : 
                <TrendingDown className="h-8 w-8 text-red-500" />
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Base de Clientes</p>
                <p className="text-2xl font-bold text-green-600">{data.stats.total_clientes}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Diversificação</p>
                <p className="text-2xl font-bold text-blue-600">{data.stats.total_modalidades}</p>
                <p className="text-xs text-muted-foreground">Modalidades ativas</p>
              </div>
              <Award className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Concentração */}
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
                <AreaChart data={data.clientes.slice(0, 20).map((c, i) => ({
                  posicao: i + 1,
                  participacao: (c.total_exames / data.stats.total_exames) * 100,
                  acumulado: data.clientes.slice(0, i + 1).reduce((acc, client) => 
                    acc + (client.total_exames / data.stats.total_exames) * 100, 0)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="posicao" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`, 
                      name === 'participacao' ? 'Participação Individual' : 'Participação Acumulada'
                    ]}
                  />
                  <Area type="monotone" dataKey="acumulado" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Bar dataKey="participacao" fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs com Análises Detalhadas */}
      <Tabs defaultValue="volume" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="volume">Análise de Volume</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="volume" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 5 Clientes - Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topClientesVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => [value.toLocaleString(), 'Laudos']} />
                    <Bar dataKey="total_exames" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ranking Detalhado - Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topClientesVolume.map((cliente, index) => (
                    <div key={cliente.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{cliente.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {((cliente.total_exames / data.stats.total_exames) * 100).toFixed(1)}% do volume total
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{cliente.total_exames.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">laudos</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 5 Clientes - Melhor Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topClientesPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                    <YAxis domain={[0, 20]} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Atraso']} />
                    <Bar dataKey="percentual_atraso" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ranking Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topClientesPerformance.map((cliente, index) => {
                    const performance = cliente.percentual_atraso <= 5 ? 'Excelente' : 
                                      cliente.percentual_atraso <= 10 ? 'Bom' : 'Regular';
                    const color = cliente.percentual_atraso <= 5 ? 'text-green-600' : 
                                 cliente.percentual_atraso <= 10 ? 'text-blue-600' : 'text-yellow-600';
                    
                    return (
                      <div key={cliente.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{cliente.nome}</div>
                            <Badge className={`text-xs ${color}`}>{performance}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${color}`}>{cliente.percentual_atraso.toFixed(1)}%</div>
                          <div className="text-sm text-muted-foreground">atraso</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribuicao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Modalidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={modalidadeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'total_exames' ? value.toLocaleString() : `${value}%`,
                      name === 'total_exames' ? 'Volume' : 'Participação'
                    ]}
                  />
                  <Bar dataKey="total_exames" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}