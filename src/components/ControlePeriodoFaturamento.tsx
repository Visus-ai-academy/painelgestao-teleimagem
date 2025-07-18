import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, FileBarChart2, Info } from "lucide-react";

// Função específica para faturamento - menos restritiva
export const isPeriodoDisponivelFaturamento = (periodo: string): boolean => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  // Não permitir períodos muito futuros (mais de 2 meses)
  if (anoPeriodo > anoAtual + 1 || (anoPeriodo === anoAtual && mesPeriodo > mesAtual + 2)) {
    return false;
  }
  
  // Não permitir períodos muito antigos (mais de 24 meses)
  const diferencaMeses = (anoAtual - anoPeriodo) * 12 + (mesAtual - mesPeriodo);
  if (diferencaMeses > 24) {
    return false;
  }
  
  return true;
};

// Status específico para faturamento
export const getStatusPeriodoFaturamento = (periodo: string): 'disponivel' | 'futuro' | 'muito_antigo' => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  // Muito futuro
  if (anoPeriodo > anoAtual + 1 || (anoPeriodo === anoAtual && mesPeriodo > mesAtual + 2)) {
    return 'futuro';
  }
  
  // Muito antigo
  const diferencaMeses = (anoAtual - anoPeriodo) * 12 + (mesAtual - mesPeriodo);
  if (diferencaMeses > 24) {
    return 'muito_antigo';
  }
  
  return 'disponivel';
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
                              status === 'disponivel' ? 'default' :
                              status === 'futuro' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {
                              status === 'disponivel' ? 'Disponível' :
                              status === 'futuro' ? 'Futuro' : 'Muito Antigo'
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
                          status === 'disponivel' ? 'bg-green-500' :
                          status === 'futuro' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="font-medium">
                          {periodoSelecionado} - {
                            status === 'disponivel' ? 'Disponível' :
                            status === 'futuro' ? 'Futuro' : 'Muito Antigo'
                          }
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {status === 'disponivel' && (
                          <p className="text-green-700">✅ Relatórios podem ser gerados normalmente</p>
                        )}
                        {status === 'futuro' && (
                          <p className="text-yellow-700">📅 Período futuro - dados podem não estar completos</p>
                        )}
                        {status === 'muito_antigo' && (
                          <p className="text-red-700">⏳ Período muito antigo - verifique se os dados ainda estão disponíveis</p>
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