import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";

// Função para verificar se um período pode ser editado
export const isPeriodoEditavel = (periodo: string): boolean => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // getMonth() retorna 0-11
  const diaAtual = hoje.getDate();
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  // Se é período futuro, não pode editar
  if (anoPeriodo > anoAtual || (anoPeriodo === anoAtual && mesPeriodo > mesAtual)) {
    return false;
  }
  
  // Se é período anterior ao atual, não pode editar (dados históricos)
  if (anoPeriodo < anoAtual || (anoPeriodo === anoAtual && mesPeriodo < mesAtual)) {
    return false;
  }
  
  // Se é o mês atual mas depois do dia 5, considera fechado (exemplo de regra)
  if (anoPeriodo === anoAtual && mesPeriodo === mesAtual && diaAtual > 5) {
    return false;
  }
  
  // Período atual e dentro do prazo de edição
  return true;
};

// Função para obter status do período
export const getStatusPeriodo = (periodo: string): 'editavel' | 'fechado' | 'historico' | 'futuro' => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  if (anoPeriodo > anoAtual || (anoPeriodo === anoAtual && mesPeriodo > mesAtual)) {
    return 'futuro';
  }
  
  if (anoPeriodo < anoAtual || (anoPeriodo === anoAtual && mesPeriodo < mesAtual)) {
    return 'historico';
  }
  
  if (anoPeriodo === anoAtual && mesPeriodo === mesAtual) {
    return diaAtual <= 5 ? 'editavel' : 'fechado';
  }
  
  return 'fechado';
};

interface ControlePeriodoProps {
  periodoSelecionado: string;
  setPeriodoSelecionado: (periodo: string) => void;
  mostrarApenasEditaveis: boolean;
  setMostrarApenasEditaveis: (value: boolean) => void;
  onPeriodoChange?: (periodo: string) => void;
}

export function ControlePeriodo({
  periodoSelecionado,
  setPeriodoSelecionado,
  mostrarApenasEditaveis,
  setMostrarApenasEditaveis,
  onPeriodoChange
}: ControlePeriodoProps) {
  
  const handlePeriodoChange = (periodo: string) => {
    setPeriodoSelecionado(periodo);
    onPeriodoChange?.(periodo);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Controle de Período e Dados Históricos
        </CardTitle>
        <CardDescription>
          Gerencie períodos editáveis e proteja dados históricos contra modificações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="periodo-selecionado">Período para Upload/Processamento</Label>
              <Select value={periodoSelecionado} onValueChange={handlePeriodoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {/* Gerar lista dos últimos 12 meses + próximos 3 */}
                  {Array.from({ length: 15 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - 9 + i); // -9 a +6 meses
                    const periodo = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const status = getStatusPeriodo(periodo);
                    const isEditavel = isPeriodoEditavel(periodo);
                    
                    return (
                      <SelectItem 
                        key={periodo} 
                        value={periodo}
                        disabled={mostrarApenasEditaveis && !isEditavel}
                      >
                        <div className="flex items-center gap-2">
                          <span>{periodo}</span>
                          <Badge 
                            variant={
                              status === 'editavel' ? 'default' :
                              status === 'fechado' ? 'secondary' :
                              status === 'historico' ? 'outline' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {
                              status === 'editavel' ? 'Editável' :
                              status === 'fechado' ? 'Fechado' :
                              status === 'historico' ? 'Histórico' : 'Futuro'
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
                checked={mostrarApenasEditaveis}
                onCheckedChange={setMostrarApenasEditaveis}
              />
              <Label className="text-sm">Mostrar apenas períodos editáveis</Label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3">Status do Período Selecionado</h4>
              <div className="space-y-2">
                {(() => {
                  const status = getStatusPeriodo(periodoSelecionado);
                  
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'editavel' ? 'bg-green-500' :
                          status === 'fechado' ? 'bg-yellow-500' :
                          status === 'historico' ? 'bg-red-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="font-medium">
                          {periodoSelecionado} - {
                            status === 'editavel' ? 'Editável' :
                            status === 'fechado' ? 'Fechado' :
                            status === 'historico' ? 'Histórico' : 'Futuro'
                          }
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {status === 'editavel' && (
                          <p className="text-green-700">✅ Dados podem ser carregados e modificados</p>
                        )}
                        {status === 'fechado' && (
                          <p className="text-yellow-700">⚠️ Período fechado - dados somente leitura</p>
                        )}
                        {status === 'historico' && (
                          <p className="text-red-700">🔒 Dados históricos protegidos - não podem ser alterados</p>
                        )}
                        {status === 'futuro' && (
                          <p className="text-gray-700">📅 Período futuro - não disponível para upload</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Regras de Proteção</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Dados históricos (meses anteriores) são <strong>imutáveis</strong></li>
                <li>• Dados do mês atual podem ser editados até o <strong>dia 5</strong></li>
                <li>• Após fechamento, dados alimentam dashboards como <strong>somente leitura</strong></li>
                <li>• Upload de dados futuros não é permitido</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Status visual para uploads
interface StatusPeriodoUploadProps {
  periodo: string;
  onAlterarPeriodo: () => void;
}

export function StatusPeriodoUpload({ periodo, onAlterarPeriodo }: StatusPeriodoUploadProps) {
  const isEditavel = isPeriodoEditavel(periodo);
  const status = getStatusPeriodo(periodo);

  return (
    <Card className={`border-2 ${
      isEditavel ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {isEditavel ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Período Editável: {periodo}</h3>
                <p className="text-sm text-green-700">Os uploads para este período serão processados normalmente.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">Período Protegido: {periodo}</h3>
                <p className="text-sm text-red-700">
                  {status === 'historico' 
                    ? 'Dados históricos não podem ser modificados.' 
                    : status === 'fechado'
                    ? 'Período fechado - dados protegidos contra alteração.'
                    : 'Período futuro não disponível para upload.'
                  }
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onAlterarPeriodo}
              >
                Alterar Período
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}