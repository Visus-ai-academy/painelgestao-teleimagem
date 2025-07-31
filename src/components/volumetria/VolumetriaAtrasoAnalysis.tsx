import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface AtrasoData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
  tempo_medio_atraso?: number;
}

interface VolumetriaAtrasoAnalysisProps {
  clientes: AtrasoData[];
  modalidades: AtrasoData[];
  especialidades: AtrasoData[];
  categorias: AtrasoData[];
  prioridades: AtrasoData[];
  totalAtrasados: number;
  percentualAtrasoGeral: number;
}

export function VolumetriaAtrasoAnalysis({
  clientes,
  modalidades,
  especialidades,
  categorias,
  prioridades,
  totalAtrasados,
  percentualAtrasoGeral
}: VolumetriaAtrasoAnalysisProps) {
  
  const getColorByPercentage = (percentage: number) => {
    if (percentage < 5) return "#10b981"; // Verde
    if (percentage < 15) return "#f59e0b"; // Amarelo
    return "#ef4444"; // Vermelho
  };

  const getStatusByPercentage = (percentage: number) => {
    if (percentage < 5) return "Excelente";
    if (percentage < 15) return "Atenção";
    return "Crítico";
  };

  return (
    <div className="space-y-6">
      {/* Indicador Geral de Atrasos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Análise Geral de Atrasos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className={`border-2 ${
            percentualAtrasoGeral < 5 ? 'border-green-200 bg-green-50' : 
            percentualAtrasoGeral < 15 ? 'border-yellow-200 bg-yellow-50' : 
            'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-2">
              {percentualAtrasoGeral < 5 ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="text-sm font-medium">
                <span className="text-lg font-bold">{totalAtrasados.toLocaleString()}</span> exames atrasados 
                (<span className="text-lg font-bold">{percentualAtrasoGeral.toFixed(1)}%</span>)
                - Status: <span className={`font-bold ${
                  percentualAtrasoGeral < 5 ? 'text-green-600' : 
                  percentualAtrasoGeral < 15 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {getStatusByPercentage(percentualAtrasoGeral)}
                </span>
              </AlertDescription>
            </div>
          </Alert>
        </CardContent>
      </Card>

      {/* Gráficos de Análise de Atraso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atrasos por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Atrasos por Cliente (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientes.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'percentual_atraso' ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString(),
                    name === 'percentual_atraso' ? 'Atraso %' : 'Qtd Atrasados'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="atrasados" 
                  fill="#ef4444" 
                  name="Atrasados"
                />
                <Bar 
                  dataKey="percentual_atraso" 
                  fill="#f59e0b" 
                  name="% Atraso"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Atrasos por Modalidade */}
        <Card>
          <CardHeader>
            <CardTitle>Atrasos por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modalidades.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'percentual_atraso' ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString(),
                    name === 'percentual_atraso' ? 'Atraso %' : 'Qtd Atrasados'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="atrasados" 
                  fill="#ef4444" 
                  name="Atrasados"
                />
                <Bar 
                  dataKey="percentual_atraso" 
                  fill="#f59e0b" 
                  name="% Atraso"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Atrasos por Especialidade */}
        <Card>
          <CardHeader>
            <CardTitle>Atrasos por Especialidade (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={especialidades.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'percentual_atraso' ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString(),
                    name === 'percentual_atraso' ? 'Atraso %' : 'Qtd Atrasados'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="atrasados" 
                  fill="#ef4444" 
                  name="Atrasados"
                />
                <Bar 
                  dataKey="percentual_atraso" 
                  fill="#f59e0b" 
                  name="% Atraso"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Atrasos por Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle>Atrasos por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prioridades}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 12}}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'percentual_atraso' ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString(),
                    name === 'percentual_atraso' ? 'Atraso %' : 'Qtd Atrasados'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="atrasados" 
                  fill="#ef4444" 
                  name="Atrasados"
                />
                <Bar 
                  dataKey="percentual_atraso" 
                  fill="#f59e0b" 
                  name="% Atraso"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Clientes com Maior Atraso */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes - Maior % Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clientes
                .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
                .slice(0, 5)
                .map((cliente, index) => (
                  <div key={index} className="flex justify-between items-center p-2 rounded border">
                    <div>
                      <span className="font-medium">{cliente.nome}</span>
                      <div className="text-xs text-muted-foreground">
                        {cliente.atrasados} atrasados de {cliente.total_exames} exames
                      </div>
                    </div>
                    <div className={`font-bold text-lg ${
                      cliente.percentual_atraso < 5 ? 'text-green-600' : 
                      cliente.percentual_atraso < 15 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {cliente.percentual_atraso.toFixed(1)}%
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Especialidades com Maior Atraso */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Especialidades - Maior % Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {especialidades
                .sort((a, b) => b.percentual_atraso - a.percentual_atraso)
                .slice(0, 5)
                .map((especialidade, index) => (
                  <div key={index} className="flex justify-between items-center p-2 rounded border">
                    <div>
                      <span className="font-medium">{especialidade.nome}</span>
                      <div className="text-xs text-muted-foreground">
                        {especialidade.atrasados} atrasados de {especialidade.total_exames} exames
                      </div>
                    </div>
                    <div className={`font-bold text-lg ${
                      especialidade.percentual_atraso < 5 ? 'text-green-600' : 
                      especialidade.percentual_atraso < 15 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {especialidade.percentual_atraso.toFixed(1)}%
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}