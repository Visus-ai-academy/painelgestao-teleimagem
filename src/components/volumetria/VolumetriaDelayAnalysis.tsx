import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Clock, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

interface DelayData {
  nome: string;
  total_exames: number;
  atrasados: number;
  percentual_atraso: number;
  tempo_medio_atraso?: number;
}

interface DelayAnalysisData {
  clientes: DelayData[];
  modalidades: DelayData[];
  especialidades: DelayData[];
  categorias: DelayData[];
  prioridades: DelayData[];
  totalAtrasados: number;
  percentualAtrasoGeral: number;
  atrasosComTempo?: Array<{ tempoAtrasoMinutos: number; EMPRESA: string; [key: string]: any }>;
}

interface VolumetriaDelayAnalysisProps {
  data: DelayAnalysisData;
}

// Cores para os gráficos
const DELAY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

// Função para categorizar tempo de atraso
const categorizeDelay = (percentual: number) => {
  if (percentual >= 20) return { label: 'Crítico', color: '#ef4444', bgColor: 'bg-red-100' };
  if (percentual >= 10) return { label: 'Alto', color: '#f97316', bgColor: 'bg-orange-100' };
  if (percentual >= 5) return { label: 'Médio', color: '#eab308', bgColor: 'bg-yellow-100' };
  if (percentual > 0) return { label: 'Baixo', color: '#22c55e', bgColor: 'bg-green-100' };
  return { label: 'Sem Atraso', color: '#3b82f6', bgColor: 'bg-blue-100' };
};

// Função para criar segmentação por tempo de atraso
const createDelaySegments = (data: DelayData[]) => {
  const segments = {
    'Crítico (>20%)': data.filter(item => item.percentual_atraso >= 20).length,
    'Alto (10-20%)': data.filter(item => item.percentual_atraso >= 10 && item.percentual_atraso < 20).length,
    'Médio (5-10%)': data.filter(item => item.percentual_atraso >= 5 && item.percentual_atraso < 10).length,
    'Baixo (1-5%)': data.filter(item => item.percentual_atraso > 0 && item.percentual_atraso < 5).length,
    'Sem Atraso': data.filter(item => item.percentual_atraso === 0).length
  };

  return Object.entries(segments).map(([name, value], index) => ({
    name,
    value,
    percentage: data.length > 0 ? (value / data.length) * 100 : 0,
    color: DELAY_COLORS[index]
  }));
};

// Função para criar segmentação por tempo de atraso em minutos/horas
const createTimeDelaySegments = (atrasosComTempo: Array<{ tempoAtrasoMinutos: number; [key: string]: any }> = []) => {
  const segments = {
    'Até 30 min': atrasosComTempo.filter(item => item.tempoAtrasoMinutos <= 30).length,
    '30 min - 1h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 30 && item.tempoAtrasoMinutos <= 60).length,
    '1h - 2h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 60 && item.tempoAtrasoMinutos <= 120).length,
    '2h - 5h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 120 && item.tempoAtrasoMinutos <= 300).length,
    '5h - 12h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 300 && item.tempoAtrasoMinutos <= 720).length,
    '12h - 24h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 720 && item.tempoAtrasoMinutos <= 1440).length,
    'Mais de 24h': atrasosComTempo.filter(item => item.tempoAtrasoMinutos > 1440).length
  };

  return Object.entries(segments).map(([name, value], index) => ({
    name,
    value,
    percentage: atrasosComTempo.length > 0 ? (value / atrasosComTempo.length) * 100 : 0,
    color: DELAY_COLORS[index % DELAY_COLORS.length]
  }));
};

export function VolumetriaDelayAnalysis({ data }: VolumetriaDelayAnalysisProps) {
  // Top 10 clientes com mais atrasos
  const topDelayClientes = data.clientes
    .filter(c => c.atrasados > 0)
    .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
    .slice(0, 10);

  // Top 5 modalidades com mais atrasos
  const topDelayModalidades = data.modalidades
    .filter(m => m.atrasados > 0)
    .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
    .slice(0, 5);

  // Top 5 especialidades com mais atrasos
  const topDelayEspecialidades = data.especialidades
    .filter(e => e.atrasados > 0)
    .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
    .slice(0, 5);

  // Segmentação por tempo de atraso
  const clienteSegments = createDelaySegments(data.clientes);
  const modalidadeSegments = createDelaySegments(data.modalidades);
  const timeDelaySegments = createTimeDelaySegments(data.atrasosComTempo);

  return (
    <div className="space-y-6">
      {/* Visão Geral dos Atrasos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Visão Geral de Atrasos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className={`${data.percentualAtrasoGeral >= 10 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'} mb-4`}>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>{data.percentualAtrasoGeral.toFixed(1)}%</strong> dos laudos estão atrasados 
              ({data.totalAtrasados.toLocaleString()} de {(data.totalAtrasados / (data.percentualAtrasoGeral/100)).toLocaleString()} laudos)
              {data.percentualAtrasoGeral >= 15 && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Nível crítico de atrasos detectado! Ação imediata necessária.
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.totalAtrasados.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Laudos Atrasados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.clientes.filter(c => c.atrasados > 0).length}</div>
              <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.percentualAtrasoGeral.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Taxa Geral de Atraso</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de Análise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes com Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Clientes - Maior % de Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDelayClientes} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="nome" type="category" width={100} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`, 
                    'Taxa de Atraso'
                  ]}
                  labelFormatter={(label) => `Cliente: ${label}`}
                />
                <Bar dataKey="percentual_atraso" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Segmentação de Atraso por Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Atrasos - Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clienteSegments}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {clienteSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Modalidades com Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Modalidades - Maior % de Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDelayModalidades}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Atraso']}
                />
                <Bar dataKey="percentual_atraso" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Especialidades com Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Especialidades - Maior % de Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDelayEspecialidades}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Atraso']}
                />
                <Bar dataKey="percentual_atraso" fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Listas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista Top 10 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ranking de Atrasos - Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDelayClientes.map((cliente, index) => {
                const category = categorizeDelay(cliente.percentual_atraso);
                return (
                  <div key={cliente.nome} className={`p-3 rounded-lg ${category.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                        <span className="font-medium text-sm">{cliente.nome}</span>
                      </div>
                      <Badge style={{ backgroundColor: category.color, color: 'white' }}>
                        {category.label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{cliente.atrasados} atrasados de {cliente.total_exames} laudos</span>
                      <span className="font-bold">{cliente.percentual_atraso.toFixed(1)}%</span>
                    </div>
                    <Progress value={cliente.percentual_atraso} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista Top 5 Modalidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ranking de Atrasos - Modalidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDelayModalidades.map((modalidade, index) => {
                const category = categorizeDelay(modalidade.percentual_atraso);
                return (
                  <div key={modalidade.nome} className={`p-3 rounded-lg ${category.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                        <span className="font-medium text-sm">{modalidade.nome}</span>
                      </div>
                      <Badge style={{ backgroundColor: category.color, color: 'white' }}>
                        {category.label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{modalidade.atrasados} atrasados de {modalidade.total_exames} laudos</span>
                      <span className="font-bold">{modalidade.percentual_atraso.toFixed(1)}%</span>
                    </div>
                    <Progress value={modalidade.percentual_atraso} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas Avançadas */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Nível de Atraso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {clienteSegments.find(s => s.name === 'Crítico (>20%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Críticos</div>
              <div className="text-xs text-red-600 mt-1">&gt;20% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {clienteSegments.find(s => s.name === 'Alto (10-20%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Alto Risco</div>
              <div className="text-xs text-orange-600 mt-1">10-20% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {clienteSegments.find(s => s.name === 'Médio (5-10%)')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Atenção</div>
              <div className="text-xs text-yellow-600 mt-1">5-10% de atraso</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {clienteSegments.find(s => s.name === 'Sem Atraso')?.value || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clientes OK</div>
              <div className="text-xs text-green-600 mt-1">Sem atrasos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Tempo de Atraso */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Tempo de Atraso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Pizza - Distribuição por Tempo */}
            <div>
              <h4 className="text-lg font-medium mb-4">Distribuição por Tempo de Atraso</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={timeDelaySegments}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {timeDelaySegments.map((entry, index) => (
                      <Cell key={`time-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} laudos`, 'Quantidade']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cards de Estatísticas por Tempo */}
            <div>
              <h4 className="text-lg font-medium mb-4">Detalhamento por Faixa de Tempo</h4>
              <div className="grid grid-cols-1 gap-3">
                {timeDelaySegments.map((segment, index) => (
                  <div key={segment.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: segment.color }}
                      ></div>
                      <span className="font-medium text-sm">{segment.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{segment.value}</div>
                      <div className="text-xs text-muted-foreground">{segment.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}