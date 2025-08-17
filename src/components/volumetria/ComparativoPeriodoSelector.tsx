import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ComparativoPeriodoSelectorProps {
  periodoSelecionado: string | null;
  onPeriodoChange: (periodo: string | null) => void;
}

export function ComparativoPeriodoSelector({ 
  periodoSelecionado, 
  onPeriodoChange 
}: ComparativoPeriodoSelectorProps) {
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([]);
  const [periodoAtivo, setPeriodoAtivo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Carregar períodos disponíveis e período ativo
  useEffect(() => {
    const loadPeriodos = async () => {
      setLoading(true);
      try {
        // Buscar período ativo
        const { data: ativo, error: ativoError } = await supabase
          .from('periodo_referencia_ativo')
          .select('periodo_referencia')
          .eq('ativo', true)
          .single();

        if (ativoError) {
          console.error('Erro ao buscar período ativo:', ativoError);
        } else {
          setPeriodoAtivo(ativo.periodo_referencia);
        }

        // Buscar todos os períodos disponíveis na volumetria
        const { data: periodos, error: periodosError } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .not('periodo_referencia', 'is', null);

        if (periodosError) {
          console.error('Erro ao buscar períodos:', periodosError);
          toast({
            title: "Erro",
            description: "Falha ao carregar períodos disponíveis",
            variant: "destructive"
          });
        } else {
          // Extrair períodos únicos e ordenar
          const periodosUnicos = [...new Set(periodos.map(p => p.periodo_referencia))];
          const periodosOrdenados = periodosUnicos.sort((a, b) => {
            // Ordenar por ano e mês (formato: "mon/YY")
            const [mesA, anoA] = a.split('/');
            const [mesB, anoB] = b.split('/');
            const mesesMap = {
              'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
              'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
            };
            
            const anoComparison = anoB.localeCompare(anoA); // Mais recente primeiro
            if (anoComparison !== 0) return anoComparison;
            
            return (mesesMap[mesB as keyof typeof mesesMap] || 0) - (mesesMap[mesA as keyof typeof mesesMap] || 0);
          });
          
          setPeriodosDisponiveis(periodosOrdenados);
        }
      } catch (error) {
        console.error('Erro geral:', error);
        toast({
          title: "Erro",
          description: "Falha ao carregar informações de período",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadPeriodos();
  }, [toast]);

  const handlePeriodoChange = (valor: string) => {
    if (valor === 'ativo') {
      onPeriodoChange(null); // Usar período ativo do sistema
    } else {
      onPeriodoChange(valor);
    }
  };

  const getDisplayValue = () => {
    if (!periodoSelecionado) {
      return 'ativo'; // Período ativo do sistema
    }
    return periodoSelecionado;
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900 text-sm">
          <Calendar className="h-4 w-4" />
          Período para Comparativo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Select 
            value={getDisplayValue()}
            onValueChange={handlePeriodoChange}
            disabled={loading || periodosDisponiveis.length === 0}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione o período..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs px-1">ATIVO</Badge>
                  <span>{periodoAtivo}</span>
                </div>
              </SelectItem>
              {periodosDisponiveis.map((periodo) => (
                <SelectItem key={periodo} value={periodo}>
                  <div className="flex items-center gap-2">
                    {periodo === periodoAtivo && (
                      <Badge variant="outline" className="text-xs px-1">ATIVO</Badge>
                    )}
                    <span>{periodo}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPeriodoChange(null)}
            disabled={!periodoSelecionado}
            title="Voltar ao período ativo"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {!periodoSelecionado ? (
            <span className="text-blue-700">📊 Usando período ativo do sistema: <strong>{periodoAtivo}</strong></span>
          ) : (
            <span className="text-orange-700">⚠️ Comparativo usando período: <strong>{periodoSelecionado}</strong></span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}