import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Play, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TesteResultado {
  resultados?: {
    total_arquivos_processados?: number;
    total_registros_processados?: number;
    total_registros_excluidos?: number;
    total_registros_atualizados?: number;
    total_registros_quebrados?: number;
    regras_aplicadas?: string[];
    detalhes_por_arquivo?: Array<{
      arquivo: string;
      registros_antes: number;
      registros_depois: number;
      registros_excluidos: number;
      regras_aplicadas: string[];
    }>;
  };
}

interface TesteRegras27Props {
  periodoReferencia?: string;
}

export function TesteRegras27({ periodoReferencia }: TesteRegras27Props) {
  const [isTestando, setIsTestando] = useState(false);
  const [resultado, setResultado] = useState<TesteResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const executarTeste = async () => {
    // CRÍTICO: Validar período antes de processar
    if (!periodoReferencia) {
      toast.error('⚠️ Selecione um período de referência antes de executar as regras');
      return;
    }

    setIsTestando(true);
    setErro(null);
    setResultado(null);

    try {
      toast(`🧪 Iniciando aplicação das 28 regras completas para período ${periodoReferencia}...`);

      const { data, error } = await supabase.functions.invoke('aplicar-27-regras-completas', {
        body: {
          aplicar_todos_arquivos: true,
          periodo_referencia: periodoReferencia
        }
      });

      if (error) {
        throw new Error(`Erro na função: ${error.message}`);
      }

      setResultado(data);
      
      toast.success('✅ As 28 regras foram aplicadas com sucesso!');

    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      setErro(errorMessage);
      
      toast.error(`❌ Erro na aplicação das 28 regras: ${errorMessage}`);
      
      console.error('Erro no teste das 28 regras:', error);
    } finally {
      setIsTestando(false);
    }
  };

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
        {/* Alerta se período não selecionado */}
        {!periodoReferencia && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Período não selecionado!</strong> Volte à aba "Upload de Dados" e selecione o período de faturamento antes de executar as regras.
            </AlertDescription>
          </Alert>
        )}

        {/* Período selecionado */}
        {periodoReferencia && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Período selecionado: <strong>{periodoReferencia}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Botão das 28 Regras */}
        <div className="flex items-center gap-4">
          <Button
            onClick={executarTeste}
            disabled={isTestando || !periodoReferencia}
            className="flex items-center gap-2"
            size="lg"
          >
            {isTestando ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Executando 28 Regras...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Executar 28 Regras Completas
              </>
            )}
          </Button>
          
          {resultado && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Regras Aplicadas
            </Badge>
          )}
        </div>

        {/* Info sobre v034 */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">Regras incluídas:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>v007</strong>: Colunas → MUSCULO ESQUELETICO (padrão)</li>
            <li>• <strong>v034</strong>: Colunas → NEURO + SC (para neurologistas cadastrados na tabela <code>medicos_neurologistas</code>)</li>
            <li>• <strong>+ 26 outras regras</strong> de normalização, exclusão e correção</li>
          </ul>
        </div>

        {/* Exibir Erro */}
        {erro && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Erro na Aplicação das 28 Regras</span>
            </div>
            <p className="text-red-600 text-sm">{erro}</p>
          </div>
        )}

        {/* Exibir Resultados das 28 Regras */}
        {resultado?.resultados && (
          <div className="space-y-4 border rounded-lg p-4 bg-green-50">
            <div className="flex items-center gap-2 text-green-700 mb-4">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold text-lg">Resultados das 28 Regras</span>
            </div>

            {/* Resumo Geral */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-blue-600">
                  {resultado.resultados.total_arquivos_processados || 0}
                </div>
                <div className="text-sm text-gray-600">Arquivos Processados</div>
              </div>

              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-green-600">
                  {resultado.resultados.total_registros_processados?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Registros Processados</div>
              </div>

              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-red-600">
                  {resultado.resultados.total_registros_excluidos?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Registros Excluídos</div>
              </div>

              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-orange-600">
                  {resultado.resultados.total_registros_atualizados?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Registros Atualizados</div>
              </div>

              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-purple-600">
                  {resultado.resultados.total_registros_quebrados?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Registros Quebrados</div>
              </div>
            </div>

            {/* Regras Aplicadas */}
            {resultado.resultados.regras_aplicadas && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-semibold mb-2">Regras Aplicadas:</h4>
                <div className="flex flex-wrap gap-2">
                  {resultado.resultados.regras_aplicadas.map((regra, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className={regra === 'v034' ? 'bg-purple-100 text-purple-800' : ''}
                    >
                      {regra}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhes por Arquivo */}
            {resultado.resultados.detalhes_por_arquivo && resultado.resultados.detalhes_por_arquivo.length > 0 && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-semibold mb-3">Detalhes por Arquivo:</h4>
                <div className="space-y-3">
                  {resultado.resultados.detalhes_por_arquivo.map((arquivo, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="font-medium text-gray-800">{arquivo.arquivo}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{arquivo.registros_antes.toLocaleString()}</span> → 
                        <span className="font-medium text-green-600 ml-1">{arquivo.registros_depois.toLocaleString()}</span>
                        <span className="text-red-600 ml-2">({arquivo.registros_excluidos.toLocaleString()} excluídos)</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {arquivo.regras_aplicadas.map((regra, rIndex) => (
                          <Badge 
                            key={rIndex} 
                            variant="outline" 
                            className={`text-xs ${regra === 'v034' ? 'border-purple-500 text-purple-700' : ''}`}
                          >
                            {regra}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
