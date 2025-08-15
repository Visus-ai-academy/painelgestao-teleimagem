import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ProducaoData } from '@/hooks/useProducaoMedica';

interface ProducaoGeralProps {
  data: ProducaoData;
}

const ProducaoGeral: React.FC<ProducaoGeralProps> = ({ data }) => {
  const { resumo_geral, capacidade_vs_demanda } = data;

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
          <CardTitle>Capacidade vs Demanda por Dia da Semana</CardTitle>
          <CardDescription>
            Comparativo entre capacidade produtiva e demanda real por dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {capacidade_vs_demanda.map((item) => (
              <div key={item.dia_semana} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{item.dia_semana}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      Demanda: {formatNumber(item.demanda)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Capacidade: {formatNumber(Math.round(item.capacidade))}
                    </span>
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProducaoGeral;