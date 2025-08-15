import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';
import { ProducaoData, ProducaoEspecialidade } from '@/hooks/useProducaoMedica';

interface ProducaoEspecialidadesProps {
  data: ProducaoData;
}

const ProducaoEspecialidades: React.FC<ProducaoEspecialidadesProps> = ({ data }) => {
  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatPercentual = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

  const getVariacaoMensal = (especialidade: ProducaoEspecialidade) => {
    if (especialidade.total_mes_anterior === 0) return 0;
    return ((especialidade.total_mes_atual - especialidade.total_mes_anterior) / especialidade.total_mes_anterior) * 100;
  };

  const getVariacaoSemanal = (especialidade: ProducaoEspecialidade) => {
    if (especialidade.total_semana_anterior === 0) return 0;
    return ((especialidade.total_semana_atual - especialidade.total_semana_anterior) / especialidade.total_semana_anterior) * 100;
  };

  const getPerformanceBadge = (variacao: number) => {
    if (variacao > 15) return <Badge className="bg-green-500">Excelente</Badge>;
    if (variacao > 5) return <Badge className="bg-blue-500">Bom</Badge>;
    if (variacao > -5) return <Badge variant="default">Estável</Badge>;
    if (variacao > -15) return <Badge variant="secondary">Declínio</Badge>;
    return <Badge variant="destructive">Crítico</Badge>;
  };

  const totalGeral = data.especialidades.reduce((total, esp) => total + esp.total_mes_atual, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Produção por Especialidade</span>
        </CardTitle>
        <CardDescription>
          Análise da produção agrupada por especialidade médica
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead className="text-right">Mês Atual</TableHead>
                <TableHead className="text-right">Mês Anterior</TableHead>
                <TableHead className="text-right">Var. Mensal</TableHead>
                <TableHead className="text-right">Semana Atual</TableHead>
                <TableHead className="text-right">Var. Semanal</TableHead>
                <TableHead className="text-center">Médicos</TableHead>
                <TableHead className="text-right">Média/Médico</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.especialidades.map((especialidade, index) => {
                const variacaoMensal = getVariacaoMensal(especialidade);
                const variacaoSemanal = getVariacaoSemanal(especialidade);
                const percentualTotal = totalGeral > 0 ? (especialidade.total_mes_atual / totalGeral) * 100 : 0;

                return (
                  <TableRow key={especialidade.nome}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{especialidade.nome}</TableCell>
                    <TableCell className="text-right">{formatNumber(especialidade.total_mes_atual)}</TableCell>
                    <TableCell className="text-right">{formatNumber(especialidade.total_mes_anterior)}</TableCell>
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
                    <TableCell className="text-right">{formatNumber(especialidade.total_semana_atual)}</TableCell>
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
                    <TableCell className="text-center">
                      <Badge variant="outline">{especialidade.medicos_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Math.round(especialidade.media_por_medico))}</TableCell>
                    <TableCell className="text-right">{percentualTotal.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">{getPerformanceBadge(variacaoMensal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Resumo */}
        <div className="mt-6 p-4 bg-muted/20 rounded-lg">
          <h4 className="font-medium mb-3">Resumo por Especialidade</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Total de Especialidades</div>
              <div className="text-2xl font-bold">{data.especialidades.length}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Produção Total</div>
              <div className="text-2xl font-bold">{formatNumber(totalGeral)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Média por Especialidade</div>
              <div className="text-2xl font-bold">
                {data.especialidades.length > 0 ? formatNumber(Math.round(totalGeral / data.especialidades.length)) : '0'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProducaoEspecialidades;