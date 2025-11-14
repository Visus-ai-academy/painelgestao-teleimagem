import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { isPeriodoEditavel, getStatusPeriodo } from "@/components/ControlePeriodo";

export interface CorrigirTipificacaoNCProps {
  onCorrecaoConcluida?: () => void;
}

export const CorrigirTipificacaoNC = ({ onCorrecaoConcluida }: CorrigirTipificacaoNCProps) => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>("");
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 });
  const [mensagemProgresso, setMensagemProgresso] = useState("");
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
  const statusPeriodo = periodoSelecionado ? getStatusPeriodo(periodoSelecionado) : null;

  const executarCorrecao = async () => {
    if (!periodoSelecionado) {
      toast({
        title: "Período não selecionado",
        description: "Selecione um período para aplicar a correção",
        variant: "destructive",
      });
      return;
    }

    if (!periodoEditavel) {
      toast({
        title: "Período fechado",
        description: "Não é possível aplicar correções em períodos fechados",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResultado(null);
    setProgresso({ atual: 0, total: 0, percentual: 0 });
    setMensagemProgresso("Iniciando correção...");

    try {
      let resumeFrom = 0;
      let concluido = false;
      let totalTipificados = 0;
      let totalErros = 0;
      let totalRegistros = 0;
      let totalLotes = 0;
      
      // Loop para processar todos os lotes em chunks
      while (!concluido) {
        setMensagemProgresso(`Processando lote ${resumeFrom + 1}...`);
        
        const { data, error } = await supabase.functions.invoke(
          'corrigir-tipificacao-clientes-nc',
          {
            body: { 
              periodo_referencia: periodoSelecionado,
              resume_from: resumeFrom,
              max_batches: 5
            }
          }
        );

        if (error) {
          console.error('Erro na requisição:', error);
          throw new Error(error.message || 'Erro na requisição');
        }

        if (!data || !data.sucesso) {
          throw new Error(data?.erro || 'Erro desconhecido na correção');
        }

        // Atualizar progresso
        totalTipificados += data.registros_tipificados || 0;
        totalErros += data.registros_com_erro || 0;
        totalRegistros = data.total_registros || 0;
        totalLotes = data.total_lotes || 0;
        
        const percentual = totalLotes > 0 
          ? Math.round((data.lotes_processados / totalLotes) * 100)
          : 0;
        
        setProgresso({
          atual: totalTipificados,
          total: totalRegistros,
          percentual
        });

        setMensagemProgresso(
          `Processando lote ${data.lotes_processados}/${totalLotes} - ${totalTipificados} registros tipificados`
        );

        // Verificar se está concluído
        concluido = data.concluido;
        
        // Se não está concluído, pegar o próximo ponto de retomada
        if (!concluido && data.next_resume !== undefined) {
          resumeFrom = data.next_resume;
        }
      }

      // Correção concluída
      const resultadoFinal = {
        sucesso: true,
        total_registros: totalRegistros,
        registros_tipificados: totalTipificados,
        registros_com_erro: totalErros
      };

      setResultado(resultadoFinal);
      
      toast({
        title: "Correção Concluída",
        description: `${totalTipificados} registros foram corrigidos com sucesso!`,
      });

      // Notificar componente pai para atualizar indicador
      onCorrecaoConcluida?.();
    } catch (error: any) {
      console.error('Erro ao executar correção:', error);
      
      toast({
        title: "Erro na Correção",
        description: error.message || "Ocorreu um erro ao processar a correção.",
        variant: "destructive",
      });
      
      setResultado({
        sucesso: false,
        erro: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Correção de Tipificação - Clientes NC
        </CardTitle>
        <CardDescription>
          Corrige automaticamente a tipificação de clientes NC (Não Consolidados) e atualiza tipo_cliente e tipo_faturamento na volumetria conforme contrato
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Esta ferramenta executa 3 passos:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>1. Limpa valores incorretos (alta_complexidade, padrao, oncologia) do campo tipo_faturamento</li>
              <li>2. Corrige tipo_cliente nos contratos de clientes NC (Não Consolidados)</li>
              <li>3. Aplica tipo_cliente (CO, NC, NC1) e tipo_faturamento (CO-FT, NC-FT, etc) conforme contrato</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <label className="text-sm font-medium">Selecionar Período</label>
          <Select
            value={periodoSelecionado}
            onValueChange={setPeriodoSelecionado}
            disabled={loadingPeriodos}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingPeriodos ? "Carregando períodos..." : "Selecione o período"} />
            </SelectTrigger>
            <SelectContent>
              {periodosDisponiveis.map((periodo) => {
                const editavel = isPeriodoEditavel(periodo);
                const status = getStatusPeriodo(periodo);
                return (
                  <SelectItem key={periodo} value={periodo}>
                    {periodo} {!editavel && <Lock className="inline h-3 w-3 ml-1" />}
                    {status === 'fechado' && " (Fechado)"}
                    {status === 'historico' && " (Histórico)"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {periodoSelecionado && !periodoEditavel && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Este período está fechado e não pode receber alterações. Selecione um período editável.
              </AlertDescription>
            </Alert>
          )}
          
          {periodoSelecionado && periodoEditavel && (
            <div className="text-sm text-success">
              ✓ Período {periodoSelecionado} está editável
            </div>
          )}
        </div>

        <Button 
          onClick={executarCorrecao} 
          disabled={loading || !periodoSelecionado || !periodoEditavel}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando correção...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Executar Correção
            </>
          )}
        </Button>

        {loading && progresso.total > 0 && (
          <div className="space-y-2 mt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{mensagemProgresso}</span>
              <span>{progresso.percentual}%</span>
            </div>
            <Progress value={progresso.percentual} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {progresso.atual.toLocaleString()} / {progresso.total.toLocaleString()} registros
            </div>
          </div>
        )}

        {resultado && (
          <Alert variant={resultado.sucesso ? "default" : "destructive"}>
            {resultado.sucesso ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Correção executada com sucesso!</div>
                  <div className="space-y-1 text-sm">
                    <div>Total de registros: {resultado.total_registros?.toLocaleString() || 0}</div>
                    <div>Registros tipificados: {resultado.registros_tipificados?.toLocaleString() || 0}</div>
                    {resultado.registros_com_erro > 0 && (
                      <div className="text-destructive">Registros com erro: {resultado.registros_com_erro}</div>
                    )}
                  </div>
                </AlertDescription>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Erro na correção</div>
                  <div className="text-sm">{resultado.erro}</div>
                </AlertDescription>
              </>
            )}
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Detalhamento dos tipos de clientes e faturamento:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><strong>CO:</strong> Cliente Consolidado - faturas agrupadas</li>
              <li><strong>NC:</strong> Cliente Não Consolidado - fatura individual</li>
              <li><strong>CO-FT:</strong> Consolidado com Faturamento</li>
              <li><strong>NC-FT:</strong> Não Consolidado com Faturamento</li>
              <li><strong>NC-NF:</strong> Não Consolidado Sem Faturamento</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
