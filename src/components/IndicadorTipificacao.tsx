import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TipificacaoStats {
  total_registros: number;
  sem_tipificacao: number;
  percentual_sem_tipificacao: number;
  por_tipo: {
    tipo_faturamento: string;
    total: number;
    percentual: number;
  }[];
}

interface IndicadorTipificacaoProps {
  periodoReferencia: string;
  onStatusChange?: (temRegistrosSemTipificacao: boolean) => void;
}

export const IndicadorTipificacao = ({ periodoReferencia, onStatusChange }: IndicadorTipificacaoProps) => {
  const [stats, setStats] = useState<TipificacaoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatePending, setUpdatePending] = useState(false);

  const loadStats = async () => {
    if (!periodoReferencia) return;

    try {
      setLoading(true);

      // Buscar estatísticas de tipificação
      const { data: registros, error } = await supabase
        .from('volumetria_mobilemed')
        .select('tipo_faturamento')
        .eq('periodo_referencia', periodoReferencia);

      if (error) throw error;

      const total = registros.length;
      const semTipificacao = registros.filter(r => !r.tipo_faturamento).length;
      const percentualSemTipificacao = total > 0 ? (semTipificacao / total) * 100 : 0;

      // Agrupar por tipo_faturamento
      const tiposMap = new Map<string, number>();
      registros.forEach(r => {
        const tipo = r.tipo_faturamento || 'SEM_TIPIFICACAO';
        tiposMap.set(tipo, (tiposMap.get(tipo) || 0) + 1);
      });

      const porTipo = Array.from(tiposMap.entries())
        .map(([tipo, count]) => ({
          tipo_faturamento: tipo,
          total: count,
          percentual: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.total - a.total);

      setStats({
        total_registros: total,
        sem_tipificacao: semTipificacao,
        percentual_sem_tipificacao: percentualSemTipificacao,
        por_tipo: porTipo
      });

      // Notificar componente pai sobre o status
      onStatusChange?.(semTipificacao > 0);

    } catch (error) {
      console.error('Erro ao carregar estatísticas de tipificação:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    let debounceTimer: NodeJS.Timeout;

    // Configurar realtime para atualizar automaticamente com debounce
    const channel = supabase
      .channel('tipificacao-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'volumetria_mobilemed',
          filter: `periodo_referencia=eq.${periodoReferencia}`
        },
        () => {
          // Usar debounce para evitar múltiplas recargas simultâneas
          setUpdatePending(true);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log('🔄 Tipificação atualizada, recarregando estatísticas...');
            loadStats();
            setUpdatePending(false);
          }, 2000); // Aguardar 2 segundos de "silêncio" antes de recarregar
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [periodoReferencia]);

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando estatísticas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const temRegistrosSemTipificacao = stats.sem_tipificacao > 0;
  const percentualTipificado = 100 - stats.percentual_sem_tipificacao;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {temRegistrosSemTipificacao ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle className="h-5 w-5 text-success" />
          )}
          Status de Tipificação - {periodoReferencia}
          {updatePending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
          )}
        </CardTitle>
        <CardDescription>
          Acompanhamento em tempo real da aplicação de tipo_faturamento nos registros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerta se houver registros sem tipificação */}
        {temRegistrosSemTipificacao && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{stats.sem_tipificacao.toLocaleString('pt-BR')} registros sem tipificação!</strong>
              <br />
              É necessário executar a correção de tipificação antes de gerar demonstrativos.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress bar geral */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progresso de Tipificação</span>
            <span className={percentualTipificado === 100 ? "text-success font-bold" : "text-muted-foreground"}>
              {percentualTipificado.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={percentualTipificado} 
            className="h-3"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{(stats.total_registros - stats.sem_tipificacao).toLocaleString('pt-BR')} tipificados</span>
            <span>{stats.total_registros.toLocaleString('pt-BR')} total</span>
          </div>
        </div>

        {/* Detalhamento por tipo */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Distribuição por Tipo de Faturamento</h4>
          <div className="grid grid-cols-1 gap-2">
            {stats.por_tipo.map((tipo) => {
              const isSemTipificacao = tipo.tipo_faturamento === 'SEM_TIPIFICACAO';
              const tiposValidos = ['CO-FT', 'CO-NF', 'NC-FT', 'NC-NF', 'NC1-NF'];
              const isValido = tiposValidos.includes(tipo.tipo_faturamento);

              return (
                <div 
                  key={tipo.tipo_faturamento}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isSemTipificacao ? 'bg-destructive/10 border-destructive' : 
                    isValido ? 'bg-muted' : 'bg-warning/10 border-warning'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSemTipificacao ? (
                      <Clock className="h-4 w-4 text-destructive" />
                    ) : isValido ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    )}
                    <span className="font-medium text-sm">
                      {isSemTipificacao ? 'SEM TIPIFICAÇÃO' : tipo.tipo_faturamento}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {tipo.total.toLocaleString('pt-BR')} registros
                    </span>
                    <Badge 
                      variant={isSemTipificacao ? "destructive" : isValido ? "secondary" : "outline"}
                      className="min-w-[60px] justify-center"
                    >
                      {tipo.percentual.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Tipos válidos:</strong> CO-FT (CO faturado), CO-NF (CO não faturado), NC-FT (NC faturado), NC-NF (NC não faturado), NC1-NF (NC1 não faturado)</p>
            <p><strong>Tipos de cliente:</strong> CO (Consolidado), NC (Não Consolidado), NC1 (Não Consolidado tipo 1)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
