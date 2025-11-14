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

export const CorrigirTipificacaoNC = () => {
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

    const timeoutId = setTimeout(() => {
      toast({
        title: "Timeout",
        description: "A operação está demorando mais do que o esperado. Verifique o status na aba Gerar.",
        variant: "destructive",
      });
      setLoading(false);
    }, 300000); // 5 minutos timeout

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/corrigir-tipificacao-clientes-nc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ periodo_referencia: periodoSelecionado }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro na requisição');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Não foi possível ler a resposta');
      }

      let resultadoFinal: any = null;
      let lastUpdate = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!resultadoFinal) {
            throw new Error('Processo interrompido antes da conclusão. Verifique o status na aba Gerar.');
          }
          break;
        }

        lastUpdate = Date.now();
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.tipo) {
                case 'inicio':
                  setMensagemProgresso(data.mensagem);
                  break;
                case 'registros_encontrados':
                  setProgresso({ atual: 0, total: data.total, percentual: 0 });
                  setMensagemProgresso(`Encontrados ${data.total} registros para tipificar`);
                  break;
                case 'lote':
                  const percentual = data.total_lotes > 0 
                    ? Math.round((data.lote / data.total_lotes) * 100)
                    : 0;
                  setProgresso({ 
                    atual: data.registros_tipificados, 
                    total: progresso.total || data.registros_tipificados,
                    percentual 
                  });
                  setMensagemProgresso(`Processando lote ${data.lote}/${data.total_lotes} - ${data.registros_tipificados} registros tipificados`);
                  break;
                case 'estatisticas':
                  setMensagemProgresso(data.mensagem);
                  break;
                case 'concluido':
                  resultadoFinal = data.resultado;
                  setProgresso(prev => ({ atual: prev.total, total: prev.total, percentual: 100 }));
                  setMensagemProgresso("Correção concluída!");
                  break;
                case 'erro':
                  throw new Error(data.mensagem);
              }
            } catch (parseError) {
              console.error('Erro ao processar mensagem:', parseError);
            }
          }
        }
      }

      clearTimeout(timeoutId);

      if (resultadoFinal) {
        setResultado(resultadoFinal);
        toast({
          title: "Sucesso",
          description: `Correção executada com sucesso. ${resultadoFinal.tipificacao?.registros_tipificados || 0} registros tipificados.`,
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Erro ao executar correção:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao executar correção. Verifique o status na aba Gerar.",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
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
          <div className="mt-4 space-y-3">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Correção concluída com sucesso!</strong>
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm">Resultados da Tipificação:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Registros tipificados:</span>
                  <span className="ml-2 font-medium text-green-600">{resultado.tipificacao?.registros_tipificados ?? resultado.tipificacao?.registros_processados ?? 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lotes processados:</span>
                  <span className="ml-2 font-medium">{resultado.tipificacao?.lotes_processados ?? resultado.tipificacao?.lotes_retipificados ?? 0}</span>
                </div>
              </div>

              {resultado.tipificacao && (
                <div className="mt-3 pt-3 border-t">
                  <h5 className="font-semibold text-sm mb-2">Re-tipificação executada:</h5>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Lotes processados:</span>
                      <span className="ml-2 font-medium">{resultado.tipificacao.lotes_retipificados}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registros atualizados:</span>
                      <span className="ml-2 font-medium">{resultado.tipificacao.registros_processados}</span>
                    </div>
                  </div>
                </div>
              )}

              {resultado.estatisticas?.por_cliente && Object.keys(resultado.estatisticas.por_cliente).length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <h5 className="font-semibold text-sm mb-2">Estatísticas por Cliente:</h5>
                  <div className="space-y-1 text-sm">
                    {Object.entries(resultado.estatisticas.por_cliente).map(([cliente, configs]: [string, any]) => (
                      <div key={cliente}>
                        <span className="font-medium">{cliente}:</span>
                        <div className="ml-4 text-muted-foreground">
                          {Object.entries(configs).map(([key, config]: [string, any]) => (
                            <div key={key}>
                              {config.total} registros (tipo_cliente: {config.tipo_cliente}, tipo_faturamento: {config.tipo_faturamento})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Quando usar:</strong> Execute esta correção quando identificar clientes NC (Não Consolidados) com tipificação incorreta 
            ou quando não estão sendo gerados demonstrativos de faturamento para clientes que deveriam ter. 
            <strong>Tipos de Cliente:</strong> CO, NC, NC1 | <strong>Tipos de Faturamento:</strong> CO-FT, CO-NT, NC-FT, NC-NT, NC1-NF
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
