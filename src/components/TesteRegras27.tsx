import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Play, RefreshCw, Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

interface ArquivoResultado {
  arquivo: string;
  sucesso: boolean;
  registros_antes?: number;
  registros_depois?: number;
  registros_excluidos?: number;
  regras_aplicadas?: string[];
  erro?: string;
  mensagem?: string;
  job_id?: string;
  status?: string;
}

interface TesteRegras27Props {
  periodoReferencia?: string;
}

const ARQUIVOS_PROCESSAR = [
  'volumetria_padrao',
  'volumetria_padrao_retroativo', 
  'volumetria_fora_padrao',
  'volumetria_fora_padrao_retroativo'
];

export function TesteRegras27({ periodoReferencia }: TesteRegras27Props) {
  const [isProcessando, setIsProcessando] = useState(false);
  const [arquivoAtual, setArquivoAtual] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<ArquivoResultado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Função para verificar status dos jobs
  const verificarStatusJobs = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      const { data: logs, error } = await supabase
        .from('processamento_regras_log')
        .select('*')
        .in('id', ids);

      if (error) {
        console.error('Erro ao verificar status:', error);
        return;
      }

      if (!logs || logs.length === 0) return;

      const novosResultados: ArquivoResultado[] = logs.map(log => ({
        arquivo: log.arquivo_fonte,
        sucesso: log.status === 'concluido',
        registros_antes: log.registros_antes || 0,
        registros_depois: log.registros_depois || 0,
        registros_excluidos: log.registros_excluidos || 0,
        regras_aplicadas: log.regras_aplicadas || [],
        erro: log.erro,
        mensagem: log.mensagem,
        job_id: log.id,
        status: log.status
      }));

      setResultados(novosResultados);

      // Atualizar progresso
      const processados = logs.filter(l => l.status === 'concluido' || l.status === 'erro').length;
      const total = ARQUIVOS_PROCESSAR.length;
      setProgresso((processados / total) * 100);

      // Verificar se todos terminaram
      const todosProcessados = logs.every(l => l.status === 'concluido' || l.status === 'erro');
      
      if (todosProcessados && logs.length === ARQUIVOS_PROCESSAR.length) {
        // Parar polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setIsProcessando(false);
        setConcluido(true);
        setArquivoAtual(null);

        const sucessos = logs.filter(l => l.status === 'concluido').length;
        const falhas = logs.filter(l => l.status === 'erro').length;

        if (falhas === 0) {
          toast.success(`🎉 Todas as 28 regras aplicadas com sucesso em ${sucessos} arquivos!`, { duration: 5000 });
        } else {
          toast.warning(`⚠️ Processamento concluído: ${sucessos} sucesso, ${falhas} falhas`);
        }
      } else {
        // Atualizar arquivo atual
        const emProcessamento = logs.find(l => l.status === 'processando');
        if (emProcessamento) {
          setArquivoAtual(emProcessamento.arquivo_fonte);
        }
      }
    } catch (err) {
      console.error('Erro no polling:', err);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const executarRegras = useCallback(async () => {
    if (!periodoReferencia) {
      toast.error('⚠️ Selecione um período de referência antes de executar as regras');
      return;
    }

    setIsProcessando(true);
    setErro(null);
    setResultados([]);
    setProgresso(0);
    setConcluido(false);
    setJobIds([]);

    toast.info(`🚀 Iniciando aplicação das 28 regras para ${periodoReferencia}...`);

    const novosJobIds: string[] = [];
    const resultadosIniciais: ArquivoResultado[] = [];

    // Disparar todos os processamentos em paralelo
    for (const arquivo of ARQUIVOS_PROCESSAR) {
      try {
        console.log(`📁 Iniciando processamento: ${arquivo}`);
        
        const { data, error } = await supabase.functions.invoke('aplicar-regras-arquivo-unico', {
          body: {
            arquivo_fonte: arquivo,
            periodo_referencia: periodoReferencia
          }
        });

        if (error) {
          console.error(`❌ Erro ao iniciar ${arquivo}:`, error);
          resultadosIniciais.push({
            arquivo,
            sucesso: false,
            erro: error.message || 'Erro ao iniciar processamento',
            status: 'erro'
          });
        } else if (data?.job_id) {
          novosJobIds.push(data.job_id);
          resultadosIniciais.push({
            arquivo,
            sucesso: false,
            job_id: data.job_id,
            status: 'processando',
            mensagem: 'Processando em background...'
          });
          toast.info(`📁 ${arquivo}: processamento iniciado`, { duration: 2000 });
        }
      } catch (err: any) {
        console.error(`❌ Erro ao iniciar ${arquivo}:`, err);
        resultadosIniciais.push({
          arquivo,
          sucesso: false,
          erro: err.message || 'Erro desconhecido',
          status: 'erro'
        });
      }
    }

    setResultados(resultadosIniciais);
    setJobIds(novosJobIds);

    // Iniciar polling para verificar status
    if (novosJobIds.length > 0) {
      setArquivoAtual('Aguardando processamento...');
      
      // Polling a cada 3 segundos
      pollingRef.current = setInterval(() => {
        verificarStatusJobs(novosJobIds);
      }, 3000);

      // Verificar imediatamente
      setTimeout(() => verificarStatusJobs(novosJobIds), 1000);
    } else {
      setIsProcessando(false);
      setConcluido(true);
      toast.error('Nenhum arquivo foi processado com sucesso');
    }

  }, [periodoReferencia, verificarStatusJobs]);

  const totalRegistrosAntes = resultados.reduce((acc, r) => acc + (r.registros_antes || 0), 0);
  const totalRegistrosDepois = resultados.reduce((acc, r) => acc + (r.registros_depois || 0), 0);
  const totalExcluidos = resultados.reduce((acc, r) => acc + (r.registros_excluidos || 0), 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          Sistema de Aplicação de Regras
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Execute as 28 regras completas nos dados de volumetria (inclui v034 para neurologistas)
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Botão das 28 Regras - Sempre visível primeiro */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={executarRegras}
            disabled={isProcessando || !periodoReferencia}
            className="flex items-center gap-2"
            size="lg"
          >
            {isProcessando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Executar 28 Regras Completas
              </>
            )}
          </Button>
          
          {/* Período selecionado inline */}
          {periodoReferencia && (
            <Badge variant="outline" className="text-muted-foreground">
              Período: <strong className="ml-1">{periodoReferencia}</strong>
            </Badge>
          )}
          
          {/* Alerta inline se período não selecionado */}
          {!periodoReferencia && (
            <span className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Selecione o período na aba "Upload de Dados"
            </span>
          )}
          
          {concluido && !isProcessando && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Concluído
            </Badge>
          )}
        </div>

        {/* Progresso */}
        {isProcessando && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Processando: <strong>{arquivoAtual}</strong>
              </span>
              <span className="font-medium">{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
            <p className="text-xs text-muted-foreground">
              💡 O processamento ocorre em background. Atualizando status a cada 3s...
            </p>
          </div>
        )}

        {/* Info sobre as regras */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">Regras incluídas:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>v007</strong>: Colunas → MUSCULO ESQUELETICO (padrão)</li>
            <li>• <strong>v034</strong>: Colunas → NEURO + SC (para neurologistas cadastrados)</li>
            <li>• <strong>+ 26 outras regras</strong> de normalização, exclusão e correção</li>
          </ul>
        </div>

        {/* Erro */}
        {erro && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Erro</span>
            </div>
            <p className="text-red-600 text-sm">{erro}</p>
          </div>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 text-gray-700 mb-4">
              {concluido ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              )}
              <span className="font-semibold text-lg">
                {concluido ? 'Resultados' : 'Processando em background...'}
              </span>
            </div>

            {/* Resumo */}
            {concluido && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-3 rounded border">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalRegistrosAntes.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Antes</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-2xl font-bold text-green-600">
                    {totalRegistrosDepois.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Depois</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-2xl font-bold text-red-600">
                    {totalExcluidos.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Excluídos</div>
                </div>
              </div>
            )}

            {/* Detalhes por arquivo */}
            <div className="space-y-3">
              {resultados.map((resultado, index) => (
                <div 
                  key={index} 
                  className={`border-l-4 pl-4 py-2 ${
                    resultado.status === 'concluido' || resultado.sucesso
                      ? 'border-green-500 bg-green-50' 
                      : resultado.status === 'processando'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {resultado.status === 'concluido' || resultado.sucesso ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : resultado.status === 'processando' ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{resultado.arquivo}</span>
                    {resultado.status === 'processando' && (
                      <Badge variant="outline" className="text-blue-600 text-xs">
                        Em processamento...
                      </Badge>
                    )}
                  </div>
                  
                  {(resultado.status === 'concluido' || resultado.sucesso) && resultado.registros_antes !== undefined && (
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{resultado.registros_antes.toLocaleString()}</span> → 
                      <span className="font-medium text-green-600 ml-1">{resultado.registros_depois?.toLocaleString()}</span>
                      {resultado.registros_excluidos && resultado.registros_excluidos > 0 && (
                        <span className="text-red-600 ml-2">
                          ({resultado.registros_excluidos.toLocaleString()} excluídos)
                        </span>
                      )}
                    </div>
                  )}

                  {resultado.regras_aplicadas && resultado.regras_aplicadas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {resultado.regras_aplicadas.slice(0, 10).map((regra, rIndex) => (
                        <Badge 
                          key={rIndex} 
                          variant="outline" 
                          className={`text-xs ${regra.includes('v034') ? 'border-purple-500 text-purple-700' : ''}`}
                        >
                          {regra}
                        </Badge>
                      ))}
                      {resultado.regras_aplicadas.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{resultado.regras_aplicadas.length - 10} mais
                        </Badge>
                      )}
                    </div>
                  )}

                  {resultado.erro && (
                    <p className="text-sm text-red-600 mt-1">{resultado.erro}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
