import { useMemo } from "react";
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

// Status específico para faturamento - todos pendentes por enquanto
export const getStatusPeriodoFaturamento = (periodo: string): 'concluido' | 'pronto' | 'pendente' | 'futuro' => {
  try {
    // Por enquanto, todos os períodos são "pendentes" pois nenhum faturamento foi processado ainda
    // No futuro, esta lógica será baseada na verificação de dados na tabela de faturamento
    
    // Verificar se é muito futuro (mais de 6 meses)
    const hoje = new Date();
    const dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 1);
    const periodoObj = stringParaPeriodo(periodo);
    
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

// Função auxiliar para formatar período YYYY-MM para formato abreviado
const formatarPeriodoAbreviado = (periodo: string): string => {
  try {
    const [ano, mes] = periodo.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesAbrev = meses[parseInt(mes) - 1] || mes;
    return `${mesAbrev}/${ano.slice(2)}`;
  } catch {
    return periodo;
  }
};

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

  // Memoizar os períodos para evitar recálculos constantes
  const periodos = useMemo(() => {
    // SEMPRE incluir set/25 como período base disponível
    const periodoBase = new Date(2025, 8, 1); // set/25 (mês 8 = setembro)
    const hoje = new Date();
    // Garantir que sempre inclua setembro/2025, independentemente da data atual
    const limiteInicial = new Date(2025, 8, 1); // Sempre começar em set/25
    const limiteFinal = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 1);
    
    const periodos = [];
    const dataIteracao = new Date(limiteInicial);
    
    while (dataIteracao <= limiteFinal) {
      const periodo = `${dataIteracao.getFullYear()}-${String(dataIteracao.getMonth() + 1).padStart(2, '0')}`;
      const status = getStatusPeriodoFaturamento(periodo);
      const isDisponivel = isPeriodoDisponivelFaturamento(periodo);
      
      periodos.push({
        periodo,
        status,
        isDisponivel
      });
      
      dataIteracao.setMonth(dataIteracao.getMonth() + 1);
    }
    
    return periodos;
  }, []); // Array vazio - só calcula uma vez na montagem

  // Memoizar o status do período selecionado
  const statusPeriodoSelecionado = useMemo(() => {
    return getStatusPeriodoFaturamento(periodoSelecionado);
  }, [periodoSelecionado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileBarChart2 className="h-5 w-5" />
          Período do Faturamento
        </CardTitle>
        <CardDescription>
          Selecione o período para processamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="periodo-faturamento">Período</Label>
            <Select value={periodoSelecionado} onValueChange={handlePeriodoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map(({ periodo, status, isDisponivel }) => (
                  <SelectItem 
                    key={periodo} 
                    value={periodo}
                    disabled={mostrarApenasDisponiveis && !isDisponivel}
                  >
                    <div className="flex items-center gap-2">
                      <span>{formatarPeriodoAbreviado(periodo)}</span>
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
                ))}
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
      </CardContent>
    </Card>
  );
}