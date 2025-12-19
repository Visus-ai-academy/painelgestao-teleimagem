import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Play, RefreshCw, Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ArquivoResultado {
  arquivo: string;
  sucesso: boolean;
  registros_antes?: number;
  registros_depois?: number;
  registros_excluidos?: number;
  regras_aplicadas?: string[];
  erro?: string;
  mensagem?: string;
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

    toast.info(`🚀 Iniciando aplicação das 28 regras para ${periodoReferencia}...`);

    const resultadosProcessamento: ArquivoResultado[] = [];

    for (let i = 0; i < ARQUIVOS_PROCESSAR.length; i++) {
      const arquivo = ARQUIVOS_PROCESSAR[i];
      setArquivoAtual(arquivo);
      setProgresso(((i) / ARQUIVOS_PROCESSAR.length) * 100);

      try {
        console.log(`📁 Processando: ${arquivo}`);
        
        // Timeout de 5 minutos para arquivos grandes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
        
        const { data, error } = await supabase.functions.invoke('aplicar-regras-arquivo-unico', {
          body: {
            arquivo_fonte: arquivo,
            periodo_referencia: periodoReferencia
          }
        });
        
        clearTimeout(timeoutId);

        if (error) {
          console.error(`❌ Erro no arquivo ${arquivo}:`, error);
          resultadosProcessamento.push({
            arquivo,
            sucesso: false,
            erro: error.message
          });
          toast.error(`❌ Erro em ${arquivo}: ${error.message}`);
        } else {
          resultadosProcessamento.push({
            arquivo,
            sucesso: data?.sucesso ?? true,
            registros_antes: data?.registros_antes,
            registros_depois: data?.registros_depois,
            registros_excluidos: data?.registros_excluidos,
            regras_aplicadas: data?.regras_aplicadas,
            mensagem: data?.mensagem
          });
          
          if (data?.registros_antes > 0) {
            toast.success(`✅ ${arquivo}: ${data.registros_antes?.toLocaleString()} → ${data.registros_depois?.toLocaleString()} registros`);
          } else {
            toast.info(`ℹ️ ${arquivo}: sem registros`);
          }
        }

        setResultados([...resultadosProcessamento]);

      } catch (err: any) {
        console.error(`❌ Erro ao processar ${arquivo}:`, err);
        resultadosProcessamento.push({
          arquivo,
          sucesso: false,
          erro: err.message || 'Erro desconhecido'
        });
        toast.error(`❌ Erro em ${arquivo}`);
        setResultados([...resultadosProcessamento]);
      }
    }

    setProgresso(100);
    setArquivoAtual(null);
    setIsProcessando(false);
    setConcluido(true);

    const sucessos = resultadosProcessamento.filter(r => r.sucesso).length;
    const falhas = resultadosProcessamento.filter(r => !r.sucesso).length;
    
    if (falhas === 0) {
      toast.success(`🎉 Todas as 28 regras aplicadas com sucesso em ${sucessos} arquivos!`, { duration: 5000 });
    } else {
      toast.warning(`⚠️ Processamento concluído: ${sucessos} sucesso, ${falhas} falhas`);
    }

  }, [periodoReferencia]);

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
                {concluido ? 'Resultados' : 'Processando...'}
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
                    resultado.sucesso 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {resultado.sucesso ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{resultado.arquivo}</span>
                  </div>
                  
                  {resultado.sucesso && resultado.registros_antes !== undefined && (
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
