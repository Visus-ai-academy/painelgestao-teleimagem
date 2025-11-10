import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Play, RefreshCw, Database, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

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

interface ResultadoV007 {
  sucesso: boolean;
  total_correcoes_colunas: number;
  total_correcoes_neuro: number;
  total_correcoes_onco_med_int: number;
  total_categorias_aplicadas: number;
  total_erros: number;
  registros_restantes: number;
  observacoes: string;
}

export function TesteRegras27() {
  const [isTestando, setIsTestando] = useState(false);
  const [resultado, setResultado] = useState<TesteResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aplicandoV007, setAplicandoV007] = useState(false);
  const [ultimoResultadoV007, setUltimoResultadoV007] = useState<ResultadoV007 | null>(null);

  const executarTeste = async () => {
    setIsTestando(true);
    setErro(null);
    setResultado(null);

    try {
      toast('🧪 Iniciando aplicação das 27 regras completas...');

      const { data, error } = await supabase.functions.invoke('aplicar-27-regras-completas', {
        body: {
          aplicar_todos_arquivos: true,
          periodo_referencia: '2025-06'
        }
      });

      if (error) {
        throw new Error(`Erro na função: ${error.message}`);
      }

      setResultado(data);
      
      toast.success('✅ As 27 regras foram aplicadas com sucesso!');

    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      setErro(errorMessage);
      
      toast.error(`❌ Erro na aplicação das 27 regras: ${errorMessage}`);
      
      console.error('Erro no teste das 27 regras:', error);
    } finally {
      setIsTestando(false);
    }
  };

  const aplicarRegraV007 = async () => {
    if (aplicandoV007) return;
    
    setAplicandoV007(true);
    try {
      toast('🔄 Aplicando regra v007 nos dados existentes...');
      
      const { data, error } = await supabase.functions.invoke('aplicar-v007-especialidades-existentes', {
        body: {}
      });

      if (error) {
        throw new Error(`Erro na aplicação da regra v007: ${error.message}`);
      }

      if (data?.sucesso) {
        const resultado = data as ResultadoV007;
        setUltimoResultadoV007(resultado);
        
        const totalCorrecoes = resultado.total_correcoes_colunas + 
                              resultado.total_correcoes_neuro + 
                              resultado.total_correcoes_onco_med_int;
        
        toast.success(`✅ Regra v007 aplicada com sucesso! ${totalCorrecoes} correções realizadas`);
        
        console.log('📊 Resultado da aplicação v007:', {
          'COLUNAS → MUSCULO ESQUELETICO': resultado.total_correcoes_colunas,
          'COLUNAS → Neuro (neurologistas)': resultado.total_correcoes_neuro,
          'ONCO MEDICINA INTERNA → MEDICINA INTERNA': resultado.total_correcoes_onco_med_int,
          'Categorias aplicadas': resultado.total_categorias_aplicadas,
          'Registros problemáticos restantes': resultado.registros_restantes
        });

      } else {
        throw new Error(`Falha na aplicação da regra v007: ${data?.erro || 'Erro desconhecido'}`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao aplicar regra v007:', error);
      toast.error(`❌ Erro: ${error.message}`);
      
      setUltimoResultadoV007({
        sucesso: false,
        total_correcoes_colunas: 0,
        total_correcoes_neuro: 0,
        total_correcoes_onco_med_int: 0,
        total_categorias_aplicadas: 0,
        total_erros: 1,
        registros_restantes: 0,
        observacoes: `Erro: ${error.message}`
      });
    } finally {
      setAplicandoV007(false);
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
          Execute as 27 regras completas ou apenas regras específicas nos dados de volumetria
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Tabs defaultValue="todas-regras" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="todas-regras" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              27 Regras Completas
            </TabsTrigger>
            <TabsTrigger value="regra-v007" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Regra v007 - Especialidades
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="todas-regras" className="space-y-6">
            {/* Botão das 27 Regras */}
            <div className="flex items-center gap-4">
              <Button
                onClick={executarTeste}
                disabled={isTestando}
                className="flex items-center gap-2"
                size="lg"
              >
                {isTestando ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executando 27 Regras...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Executar 27 Regras Completas
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

            {/* Exibir Erro */}
            {erro && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">Erro na Aplicação das 27 Regras</span>
                </div>
                <p className="text-red-600 text-sm">{erro}</p>
              </div>
            )}

            {/* Exibir Resultados das 27 Regras */}
            {resultado?.resultados && (
              <div className="space-y-4 border rounded-lg p-4 bg-green-50">
                <div className="flex items-center gap-2 text-green-700 mb-4">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold text-lg">Resultados das 27 Regras</span>
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
                      <Badge key={index} variant="secondary">{regra}</Badge>
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
                            <Badge key={rIndex} variant="outline" className="text-xs">{regra}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </TabsContent>

          <TabsContent value="regra-v007" className="space-y-6">
            {/* Regra v007 - Correções de Especialidades */}
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-orange-800 mb-2">Regra v007 - O que será aplicado:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• <strong>COLUNAS</strong> → <strong>MÚSCULO ESQUELÉTICO</strong> (padrão)</li>
                  <li>• <strong>COLUNAS</strong> → <strong>Neuro</strong> (para 43 médicos neurologistas específicos)</li>
                  <li>• <strong>ONCO MEDICINA INTERNA</strong> → <strong>MEDICINA INTERNA</strong></li>
                  <li>• Aplicação de categorias do cadastro de exames quando disponível</li>
                  <li>• Normalização inteligente de nomes de médicos (maiúscula/minúscula, abreviações)</li>
                </ul>
              </div>

              <div className="flex items-center gap-4">
                <Button 
                  onClick={aplicarRegraV007}
                  disabled={aplicandoV007}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  {aplicandoV007 ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Aplicando Regra v007...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Aplicar Regra v007 Específica
                    </>
                  )}
                </Button>
                
                {ultimoResultadoV007 && ultimoResultadoV007.sucesso && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    v007 Aplicada
                  </Badge>
                )}
              </div>

              {/* Resultados da v007 */}
              {ultimoResultadoV007 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {ultimoResultadoV007.sucesso ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold">
                      {ultimoResultadoV007.sucesso ? 'Aplicação da v007 Concluída' : 'Aplicação da v007 com Erro'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-700">
                        {ultimoResultadoV007.total_correcoes_colunas}
                      </div>
                      <div className="text-xs text-blue-600">
                        COLUNAS → MÚSCULO ESQ.
                      </div>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-lg font-bold text-purple-700">
                        {ultimoResultadoV007.total_correcoes_neuro}
                      </div>
                      <div className="text-xs text-purple-600">
                        COLUNAS → Neuro
                      </div>
                    </div>
                    
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-700">
                        {ultimoResultadoV007.total_correcoes_onco_med_int}
                      </div>
                      <div className="text-xs text-green-600">
                        ONCO MED INT → MED INT
                      </div>
                    </div>
                    
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <div className="text-lg font-bold text-amber-700">
                        {ultimoResultadoV007.total_categorias_aplicadas}
                      </div>
                      <div className="text-xs text-amber-600">
                        Categorias Aplicadas
                      </div>
                    </div>
                  </div>

                  {ultimoResultadoV007.total_erros > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <Badge variant="destructive" className="mb-2">
                        {ultimoResultadoV007.total_erros} Erros
                      </Badge>
                      <p className="text-sm text-red-700">
                        Alguns registros não puderam ser processados. Verifique os logs para detalhes.
                      </p>
                    </div>
                  )}

                  {ultimoResultadoV007.registros_restantes > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Badge variant="outline" className="mb-2">
                        {ultimoResultadoV007.registros_restantes} Registros Restantes
                      </Badge>
                      <p className="text-sm text-yellow-700">
                        Ainda existem registros com especialidades "COLUNAS" ou "ONCO MEDICINA INTERNA" que precisam ser verificados.
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Observações:</strong> {ultimoResultadoV007.observacoes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </CardContent>
    </Card>
  );
}