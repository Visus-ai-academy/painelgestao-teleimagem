import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClienteSemCadastro {
  empresa: string;
  qtd_registros: number;
  total_exames: number;
}

interface TipificacaoStats {
  total_registros: number;
  sem_tipificacao: number;
  percentual_sem_tipificacao: number;
  clientes_sem_cadastro: ClienteSemCadastro[];
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

      // Buscar estatísticas de tipificação (com VALORES para contar exames)
      const { data: registros, error } = await supabase
        .from('volumetria_mobilemed')
        .select('tipo_faturamento, "VALORES", "EMPRESA"')
        .eq('periodo_referencia', periodoReferencia);

      if (error) throw error;

      // Calcular total de EXAMES (soma de VALORES) ao invés de linhas
      const totalExames = registros.reduce((sum, r) => sum + (Number(r.VALORES) || 0), 0);
      const examesSemTipificacao = registros
        .filter(r => !r.tipo_faturamento)
        .reduce((sum, r) => sum + (Number(r.VALORES) || 0), 0);
      const percentualSemTipificacao = totalExames > 0 ? (examesSemTipificacao / totalExames) * 100 : 0;

      // Agrupar por tipo_faturamento (somando VALORES)
      const tiposMap = new Map<string, number>();
      registros.forEach(r => {
        const tipo = r.tipo_faturamento || 'SEM_TIPIFICACAO';
        const valores = Number(r.VALORES) || 0;
        tiposMap.set(tipo, (tiposMap.get(tipo) || 0) + valores);
      });

      const porTipo = Array.from(tiposMap.entries())
        .map(([tipo, count]) => ({
          tipo_faturamento: tipo,
          total: count,
          percentual: totalExames > 0 ? (count / totalExames) * 100 : 0
        }))
        .sort((a, b) => b.total - a.total);

      // Identificar clientes sem cadastro (sem tipificação)
      const clientesSemTipificacaoMap = new Map<string, { registros: number; exames: number }>();
      registros
        .filter(r => !r.tipo_faturamento)
        .forEach(r => {
          const empresa = r.EMPRESA || 'DESCONHECIDO';
          const valores = Number(r.VALORES) || 0;
          const atual = clientesSemTipificacaoMap.get(empresa) || { registros: 0, exames: 0 };
          clientesSemTipificacaoMap.set(empresa, {
            registros: atual.registros + 1,
            exames: atual.exames + valores
          });
        });

      const clientesSemCadastro: ClienteSemCadastro[] = Array.from(clientesSemTipificacaoMap.entries())
        .map(([empresa, dados]) => ({
          empresa,
          qtd_registros: dados.registros,
          total_exames: dados.exames
        }))
        .sort((a, b) => b.total_exames - a.total_exames);

      setStats({
        total_registros: totalExames,
        sem_tipificacao: examesSemTipificacao,
        percentual_sem_tipificacao: percentualSemTipificacao,
        clientes_sem_cadastro: clientesSemCadastro,
        por_tipo: porTipo
      });

      // Notificar componente pai sobre o status
      onStatusChange?.(examesSemTipificacao > 0);

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
              <strong>{stats.sem_tipificacao.toLocaleString('pt-BR')} exames sem tipificação!</strong>
              <br />
              <span className="text-sm">
                {stats.clientes_sem_cadastro.length > 0 ? (
                  <>
                    <strong>Clientes sem cadastro nos parâmetros:</strong>
                    <ul className="mt-1 ml-4 list-disc">
                      {stats.clientes_sem_cadastro.map((cliente) => (
                        <li key={cliente.empresa}>
                          <strong>{cliente.empresa}</strong>: {cliente.total_exames.toLocaleString('pt-BR')} exames ({cliente.qtd_registros} registros)
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      É necessário cadastrar estes clientes em "Parâmetros de Faturamento" antes de executar a tipificação.
                    </p>
                  </>
                ) : (
                  'É necessário executar "Aplicar Tipificação Geral" para tipificar os registros.'
                )}
              </span>
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
            <span>{stats.total_registros.toLocaleString('pt-BR')} total exames</span>
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
                      {tipo.total.toLocaleString('pt-BR')} exames
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
