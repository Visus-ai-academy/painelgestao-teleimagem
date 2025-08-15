import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { ProducaoData } from '@/hooks/useProducaoMedica';

interface ProducaoGeralProps {
  data: ProducaoData;
}

const ProducaoGeral: React.FC<ProducaoGeralProps> = ({ data }) => {
  const { resumo_geral, capacidade_vs_demanda } = data;
  const [expandedDias, setExpandedDias] = useState<Set<string>>(new Set());

  const toggleDia = (dia: string) => {
    const newExpanded = new Set(expandedDias);
    if (newExpanded.has(dia)) {
      newExpanded.delete(dia);
    } else {
      newExpanded.add(dia);
    }
    setExpandedDias(newExpanded);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatPercentual = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Mês Atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(resumo_geral.total_mes_atual)}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span>vs mês anterior:</span>
              {resumo_geral.variacao_mensal >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={resumo_geral.variacao_mensal >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentual(resumo_geral.variacao_mensal)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Mês Anterior</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(resumo_geral.total_mes_anterior)}</div>
            <p className="text-xs text-muted-foreground">Referência comparativa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Semana Atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(resumo_geral.total_semana_atual)}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span>vs semana anterior:</span>
              {resumo_geral.variacao_semanal >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={resumo_geral.variacao_semanal >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentual(resumo_geral.variacao_semanal)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Semana Anterior</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(resumo_geral.total_semana_anterior)}</div>
            <p className="text-xs text-muted-foreground">Referência comparativa</p>
          </CardContent>
        </Card>
      </div>

      {/* Capacidade vs Demanda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Capacidade vs Demanda por Dia da Semana</span>
          </CardTitle>
          <CardDescription>
            Comparativo entre capacidade produtiva e demanda real ordenado de segunda a domingo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {capacidade_vs_demanda.map((item) => {
              const isExpanded = expandedDias.has(item.dia_semana);
              
              return (
                <div key={item.dia_semana} className="space-y-2">
                  <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-2 rounded" 
                       onClick={() => toggleDia(item.dia_semana)}>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <span className="font-medium">{item.dia_semana}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">Demanda: {formatNumber(Math.round(item.demanda))}</div>
                        <div className="text-sm text-muted-foreground">Capacidade: {formatNumber(Math.round(item.capacidade))}</div>
                      </div>
                      <Badge variant={item.utilizacao > 100 ? 'destructive' : item.utilizacao > 80 ? 'default' : 'secondary'}>
                        {item.utilizacao.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Progress 
                      value={Math.min(item.utilizacao, 100)} 
                      className="h-2"
                    />
                    {item.utilizacao > 100 && (
                      <div className="text-xs text-red-500">
                        Sobrecarga de {(item.utilizacao - 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="mt-4 pl-8 border-l-2 border-muted">
                      <h5 className="font-medium mb-3">Detalhamento por Especialidade</h5>
                      <div className="space-y-4">
                        {item.especialidades.map((esp) => (
                          <div key={esp.nome} className="bg-muted/20 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{esp.nome}</span>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  D: {formatNumber(Math.round(esp.demanda))} | 
                                  C: {formatNumber(Math.round(esp.capacidade))} | 
                                  Utilização: {esp.capacidade > 0 ? ((esp.demanda / esp.capacidade) * 100).toFixed(1) : '0'}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Médicos da especialidade */}
                            <div className="mt-3">
                              <h6 className="text-sm font-medium mb-2">Médicos:</h6>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Médico</TableHead>
                                    <TableHead className="text-xs text-right">Demanda</TableHead>
                                    <TableHead className="text-xs text-right">Capacidade</TableHead>
                                    <TableHead className="text-xs text-right">Utilização</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {esp.medicos.map((medico) => (
                                    <TableRow key={medico.nome}>
                                      <TableCell className="text-xs">{medico.nome}</TableCell>
                                      <TableCell className="text-xs text-right">{formatNumber(Math.round(medico.demanda))}</TableCell>
                                      <TableCell className="text-xs text-right">{formatNumber(Math.round(medico.capacidade))}</TableCell>
                                      <TableCell className="text-xs text-right">
                                        <Badge 
                                          variant={
                                            medico.capacidade > 0 && (medico.demanda / medico.capacidade) > 1 
                                              ? 'destructive' 
                                              : 'secondary'
                                          }
                                          className="text-xs"
                                        >
                                          {medico.capacidade > 0 ? ((medico.demanda / medico.capacidade) * 100).toFixed(1) : '0'}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProducaoGeral;