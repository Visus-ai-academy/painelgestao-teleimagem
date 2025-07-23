import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { 
  calcularPeriodoFaturamento, 
  gerarPeriodosDisponiveis, 
  formatarPeriodo, 
  periodoParaString,
  stringParaPeriodo,
  isDadosPassado,
  podeFaturar,
  type PeriodoFaturamento 
} from '@/lib/periodoUtils';

interface ControlePeriodoVolumetriaProps {
  periodo: string;
  onPeriodoChange: (periodo: string) => void;
  showStatus?: boolean;
  showDetails?: boolean;
}

export function ControlePeriodoVolumetria({ 
  periodo, 
  onPeriodoChange, 
  showStatus = true,
  showDetails = true 
}: ControlePeriodoVolumetriaProps) {
  const periodos = gerarPeriodosDisponiveis(24); // 24 meses disponíveis
  const periodoAtual = periodo !== "todos" && !periodo.includes("_") ? stringParaPeriodo(periodo) : null;

  const getStatusPeriodo = (periodo: PeriodoFaturamento) => {
    const dadosPassado = isDadosPassado(periodo);
    const podeSerFaturado = podeFaturar(periodo);

    if (dadosPassado) {
      return {
        status: 'concluido',
        label: 'Concluído',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      };
    }

    if (podeSerFaturado) {
      return {
        status: 'pronto',
        label: 'Pronto p/ Faturar',
        color: 'bg-blue-100 text-blue-800',
        icon: Clock
      };
    }

    return {
      status: 'pendente',
      label: 'Em Andamento',
      color: 'bg-yellow-100 text-yellow-800',
      icon: AlertCircle
    };
  };

  // Opções de período padrão do sistema
  const periodosEstaticos = [
    { value: "todos", label: "Todos os dados" },
    { value: "hoje", label: "Hoje" },
    { value: "ultimos_5_dias", label: "Últimos 5 dias" },
    { value: "semana_atual", label: "Semana atual" },
    { value: "mes_atual", label: "Mês atual" },
    { value: "mes_anterior", label: "Mês anterior" },
    { value: "ano_atual", label: "Ano atual" },
    { value: "ano_anterior", label: "Ano anterior" }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Período de Análise - Volumetria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={periodo} onValueChange={onPeriodoChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {/* Períodos estáticos do sistema */}
              {periodosEstaticos.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              
              {/* Separador */}
              <div className="py-1">
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Períodos de Faturamento
                </div>
              </div>

              {/* Períodos de faturamento */}
              {periodos.map((p) => {
                const periodoStr = periodoParaString(p);
                const status = getStatusPeriodo(p);
                
                return (
                  <SelectItem key={periodoStr} value={periodoStr}>
                    <div className="flex items-center justify-between w-full">
                      <span>{p.mesReferencia}</span>
                      {showStatus && (
                        <Badge className={`ml-2 text-xs ${status.color}`}>
                          {status.label}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {showDetails && periodoAtual && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Período Selecionado:</span>
                <span className="font-semibold">{periodoAtual.mesReferencia}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Intervalo:</span>
                <span className="text-sm font-medium">{formatarPeriodo(periodoAtual)}</span>
              </div>

              {showStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const status = getStatusPeriodo(periodoAtual);
                      const Icon = status.icon;
                      return (
                        <Badge className={status.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 border-t pt-2">
                <p>• Período de apuração: {formatarPeriodo(periodoAtual)}</p>
                <p>• Baseado na regra: dia 8 do mês anterior até dia 7 do mês atual</p>
                {isDadosPassado(periodoAtual) && (
                  <p className="text-green-600">• Dados históricos - Período já fechado</p>
                )}
              </div>
            </div>
          )}

          {showDetails && periodosEstaticos.find(p => p.value === periodo) && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Período Personalizado</span>
              </div>
              
              <div className="text-sm text-blue-700">
                <p>• Visualização baseada em {periodosEstaticos.find(p => p.value === periodo)?.label.toLowerCase()}</p>
                <p>• Para análise de faturamento, selecione um período específico acima</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}