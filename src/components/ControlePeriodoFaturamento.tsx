import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, FileBarChart2, Info, Clock, CheckCircle, AlertCircle } from "lucide-react";
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

// Função específica para faturamento - com novas regras
export const isPeriodoDisponivelFaturamento = (periodo: string): boolean => {
  try {
    const periodoObj = stringParaPeriodo(periodo);
    const dadosPassado = isDadosPassado(periodoObj);
    const podeSerFaturado = podeFaturar(periodoObj);
    
    // Dados do passado ou que podem ser faturados são sempre disponíveis
    return dadosPassado || podeSerFaturado;
  } catch {
    return false;
  }
};

// Status específico para faturamento com novas regras
export const getStatusPeriodoFaturamento = (periodo: string): 'concluido' | 'pronto' | 'pendente' | 'futuro' => {
  try {
    const periodoObj = stringParaPeriodo(periodo);
    const dadosPassado = isDadosPassado(periodoObj);
    const podeSerFaturado = podeFaturar(periodoObj);

    if (dadosPassado) {
      return 'concluido';
    }

    if (podeSerFaturado) {
      return 'pronto';
    }

    // Verificar se é muito futuro
    const hoje = new Date();
    const dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 1); // 3 meses no futuro
    
    if (periodoObj.inicioPeriodo > dataLimite) {
      return 'futuro';
    }

    return 'pendente';
  } catch {
    return 'futuro';
  }
};

interface ControlePeriodoFaturamentoProps {
  periodoSelecionado: string;
  setPeriodoSelecionado: (periodo: string) => void;
  mostrarApenasDisponiveis: boolean;
  setMostrarApenasDisponiveis: (value: boolean) => void;
  onPeriodoChange?: (periodo: string) => void;
}

export function ControlePeriodoFaturamento({
  periodoSelecionado,
  setPeriodoSelecionado,
  mostrarApenasDisponiveis,
  setMostrarApenasDisponiveis,
  onPeriodoChange
}: ControlePeriodoFaturamentoProps) {
  
  const handlePeriodoChange = (periodo: string) => {
    setPeriodoSelecionado(periodo);
    onPeriodoChange?.(periodo);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileBarChart2 className="h-5 w-5" />
          Período para Relatórios de Faturamento
        </CardTitle>
        <CardDescription>
          Selecione o período para geração de relatórios PDF e envio de emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="periodo-faturamento">Período do Relatório</Label>
              <Select value={periodoSelecionado} onValueChange={handlePeriodoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {/* Gerar lista dos últimos 24 meses + próximos 2 */}
                  {Array.from({ length: 26 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - 24 + i); // -24 a +2 meses
                    const periodo = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const status = getStatusPeriodoFaturamento(periodo);
                    const isDisponivel = isPeriodoDisponivelFaturamento(periodo);
                    
                    return (
                      <SelectItem 
                        key={periodo} 
                        value={periodo}
                        disabled={mostrarApenasDisponiveis && !isDisponivel}
                      >
                        <div className="flex items-center gap-2">
                          <span>{periodo}</span>
                          <Badge 
                            variant={
                              status === 'concluido' ? 'default' :
                              status === 'pronto' ? 'default' :
                              status === 'futuro' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {
                              status === 'concluido' ? 'Concluído' :
                              status === 'pronto' ? 'Pronto' :
                              status === 'futuro' ? 'Futuro' : 'Em Andamento'
                            }
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={mostrarApenasDisponiveis}
                onCheckedChange={setMostrarApenasDisponiveis}
              />
              <Label className="text-sm">Mostrar apenas períodos recomendados</Label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3">Status do Período Selecionado</h4>
              <div className="space-y-2">
                {(() => {
                  const status = getStatusPeriodoFaturamento(periodoSelecionado);
                  
                  return (
                    <>
                       <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'concluido' ? 'bg-green-500' :
                          status === 'pronto' ? 'bg-blue-500' :
                          status === 'futuro' ? 'bg-yellow-500' : 'bg-orange-500'
                        }`}></div>
                        <span className="font-medium">
                          {periodoSelecionado} - {
                            status === 'concluido' ? 'Concluído' :
                            status === 'pronto' ? 'Pronto p/ Faturar' :
                            status === 'futuro' ? 'Futuro' : 'Em Andamento'
                          }
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {status === 'concluido' && (
                          <p className="text-green-700">✅ Dados históricos - Faturamento/Volumetria concluída</p>
                        )}
                        {status === 'pronto' && (
                          <p className="text-blue-700">💰 Período pronto para faturamento - dados completos</p>
                        )}
                        {status === 'futuro' && (
                          <p className="text-yellow-700">📅 Período futuro - dados podem não estar completos</p>
                        )}
                        {status === 'pendente' && (
                          <p className="text-orange-700">⏳ Período em andamento - aguardando fechamento</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Sobre Relatórios de Faturamento
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Relatórios são <strong>independentes</strong> das validações de upload</li>
                <li>• Podem ser gerados para qualquer período com dados disponíveis</li>
                <li>• Não modificam dados operacionais do sistema</li>
                <li>• PDFs são protegidos com senha baseada no CNPJ do cliente</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}