import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { ProducaoData, ProducaoMedico } from '@/hooks/useProducaoMedica';

interface ProducaoMedicosProps {
  data: ProducaoData;
}

const ProducaoMedicos: React.FC<ProducaoMedicosProps> = ({ data }) => {
  const [expandedMedicos, setExpandedMedicos] = useState<Set<string>>(new Set());

  const toggleMedico = (nome: string) => {
    const newExpanded = new Set(expandedMedicos);
    if (newExpanded.has(nome)) {
      newExpanded.delete(nome);
    } else {
      newExpanded.add(nome);
    }
    setExpandedMedicos(newExpanded);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatPercentual = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

  const getVariacaoMensal = (medico: ProducaoMedico) => {
    if (medico.total_mes_anterior === 0) return 0;
    return ((medico.total_mes_atual - medico.total_mes_anterior) / medico.total_mes_anterior) * 100;
  };

  const getVariacaoSemanal = (medico: ProducaoMedico) => {
    if (medico.total_semana_anterior === 0) return 0;
    return ((medico.total_semana_atual - medico.total_semana_anterior) / medico.total_semana_anterior) * 100;
  };

  const getPerformanceBadge = (variacao: number) => {
    if (variacao > 10) return <Badge className="bg-green-500">Alto</Badge>;
    if (variacao > 0) return <Badge variant="default">Médio</Badge>;
    if (variacao > -10) return <Badge variant="secondary">Baixo</Badge>;
    return <Badge variant="destructive">Crítico</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Produção por Médico</span>
        </CardTitle>
        <CardDescription>
          Análise detalhada da produção individual com comparativos e distribuição por turnos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead className="text-right">Mês Atual</TableHead>
                <TableHead className="text-right">Var. Mensal</TableHead>
                <TableHead className="text-right">Semana Atual</TableHead>
                <TableHead className="text-right">Var. Semanal</TableHead>
                <TableHead className="text-right">Capacidade</TableHead>
                <TableHead className="text-center">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.medicos.map((medico, index) => {
                const isExpanded = expandedMedicos.has(medico.nome);
                const variacaoMensal = getVariacaoMensal(medico);
                const variacaoSemanal = getVariacaoSemanal(medico);

                return (
                  <>
                    <TableRow key={medico.nome} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMedico(medico.nome)}
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{medico.nome}</TableCell>
                      <TableCell>{medico.especialidade}</TableCell>
                      <TableCell className="text-right">{formatNumber(medico.total_mes_atual)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {variacaoMensal >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span className={variacaoMensal >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {formatPercentual(variacaoMensal)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(medico.total_semana_atual)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {variacaoSemanal >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span className={variacaoSemanal >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {formatPercentual(variacaoSemanal)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(Math.round(medico.capacidade_produtiva))}</TableCell>
                      <TableCell className="text-center">{getPerformanceBadge(variacaoMensal)}</TableCell>
                    </TableRow>

                    {/* Linha expandida com detalhes dos turnos */}
                    {isExpanded && (
                      <TableRow key={`${medico.nome}-details`}>
                        <TableCell colSpan={10} className="p-4 bg-muted/20">
                          <div className="space-y-4">
                            <h4 className="font-medium">Distribuição por Turnos</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {medico.turnos.map((turno) => (
                                <div key={turno.turno} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{turno.turno}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {formatNumber(turno.quantidade)} ({turno.percentual.toFixed(1)}%)
                                    </span>
                                  </div>
                                  <Progress value={turno.percentual} className="h-2" />
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                              <div className="text-center">
                                <div className="text-sm text-muted-foreground">Média Mensal</div>
                                <div className="text-lg font-medium">{formatNumber(Math.round(medico.media_mensal))}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm text-muted-foreground">Total Mês Anterior</div>
                                <div className="text-lg font-medium">{formatNumber(medico.total_mes_anterior)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm text-muted-foreground">Total Semana Anterior</div>
                                <div className="text-lg font-medium">{formatNumber(medico.total_semana_anterior)}</div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProducaoMedicos;