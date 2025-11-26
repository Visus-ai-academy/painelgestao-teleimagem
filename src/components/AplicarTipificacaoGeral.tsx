import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { isPeriodoEditavel, getStatusPeriodo } from "@/components/ControlePeriodo";

export interface AplicarTipificacaoGeralProps {
  onCorrecaoConcluida?: () => void;
}

export const AplicarTipificacaoGeral = ({ onCorrecaoConcluida }: AplicarTipificacaoGeralProps) => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>("");
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 });
  const { toast } = useToast();

  useEffect(() => {
    const loadPeriodos = async () => {
      try {
        const { data, error } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .order('periodo_referencia', { ascending: false });

        if (error) throw error;

        const periodosUnicos = [...new Set(data?.map(d => d.periodo_referencia).filter(Boolean))];
        setPeriodosDisponiveis(periodosUnicos as string[]);
      } catch (error) {
        console.error('Erro ao carregar períodos:', error);
      } finally {
        setLoadingPeriodos(false);
      }
    };

    loadPeriodos();
  }, []);

  const periodoEditavel = periodoSelecionado ? isPeriodoEditavel(periodoSelecionado) : false;

  const executarTipificacao = async () => {
    if (!periodoSelecionado) {
      toast({
        title: "Período não selecionado",
        description: "Selecione um período para aplicar a tipificação",
        variant: "destructive",
      });
      return;
    }

    if (!periodoEditavel) {
      toast({
        title: "Período fechado",
        description: "Não é possível aplicar tipificação em períodos fechados",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResultado(null);
    setProgresso({ atual: 0, total: 0, percentual: 0 });

    try {
      console.log('🔄 Iniciando tipificação geral para período:', periodoSelecionado);

      const { data, error } = await supabase.functions.invoke(
        'aplicar-tipificacao-faturamento',
        {
          body: { 
            periodo_referencia: periodoSelecionado
          }
        }
      );

      if (error) {
        console.error('Erro na requisição:', error);
        throw new Error(error.message || 'Erro na requisição');
      }

      if (!data || !data.sucesso) {
        throw new Error(data?.erro || 'Erro desconhecido na tipificação');
      }

      console.log('✅ Tipificação concluída:', data);
      
      setResultado(data);
      setProgresso({ 
        atual: data.registros_atualizados || 0, 
        total: data.registros_processados || 0, 
        percentual: 100 
      });

      toast({
        title: "Tipificação Concluída",
        description: `${data.registros_atualizados || 0} registros foram tipificados com sucesso!`,
      });

      onCorrecaoConcluida?.();
    } catch (error: any) {
      console.error('Erro ao executar tipificação:', error);
      
      toast({
        title: "Erro na Tipificação",
        description: error.message || "Ocorreu um erro ao aplicar a tipificação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Aplicar Tipificação Geral
          {!periodoEditavel && periodoSelecionado && (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
        <CardDescription>
          Aplica regras de tipificação para TODOS os clientes do período (CO, NC e NC1)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!periodoEditavel && periodoSelecionado && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Período bloqueado para edição
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Período de Referência</label>
          <Select
            value={periodoSelecionado}
            onValueChange={setPeriodoSelecionado}
            disabled={loadingPeriodos || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodosDisponiveis.map((periodo) => (
                <SelectItem key={periodo} value={periodo}>
                  {periodo} {!isPeriodoEditavel(periodo) && '🔒'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={executarTipificacao}
          disabled={loading || !periodoSelecionado || !periodoEditavel}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            "Aplicar Tipificação Geral"
          )}
        </Button>

        {loading && progresso.total > 0 && (
          <div className="space-y-2">
            <Progress value={progresso.percentual} />
            <p className="text-sm text-muted-foreground text-center">
              {progresso.atual} de {progresso.total} registros processados ({progresso.percentual.toFixed(1)}%)
            </p>
          </div>
        )}

        {resultado && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-1">
                <p><strong>Tipificação executada com sucesso!</strong></p>
                <p>Total de registros: {resultado.registros_processados?.toLocaleString()}</p>
                <p>Registros tipificados: {resultado.registros_atualizados?.toLocaleString()}</p>
                {resultado.breakdown_tipos && (
                  <div className="mt-2">
                    <p className="font-semibold">Distribuição por tipo:</p>
                    <ul className="text-sm ml-4">
                      {Object.entries(resultado.breakdown_tipos).map(([tipo, qtd]) => (
                        <li key={tipo}>{tipo}: {(qtd as number).toLocaleString()}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
