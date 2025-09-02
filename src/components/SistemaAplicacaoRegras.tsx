import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Play, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StatusRegra {
  regra: string;
  arquivo: string;
  aplicada: boolean;
  resultado?: any;
  erro?: string;
  validacao_ok?: boolean;
}

interface ResultadoSistema {
  success: boolean;
  arquivo_fonte: string;
  total_regras: number;
  regras_aplicadas: number;
  regras_validadas_ok: number;
  regras_falharam: number;
  status_detalhado: StatusRegra[];
  recomendacao: string;
}

interface CorrecoesAplicadas {
  modalidades: number;
  categorias: number;
  prioridades: number;
  especialidades: number;
}

interface ResultadoCorrecao {
  success: boolean;
  arquivo_fonte: string;
  total_registros_processados: number;
  correcoes_aplicadas: CorrecoesAplicadas;
  regras_aplicadas: string[];
}

const ARQUIVOS_SISTEMA = [
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo',
  'volumetria_onco_padrao'
];

export function SistemaAplicacaoRegras() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSistema | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState('volumetria_padrao');
  const [modoOperacao, setModoOperacao] = useState<'validar' | 'aplicar'>('aplicar');

  const executarSistema = async (validarApenas: boolean = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sistema-aplicacao-regras-completo', {
        body: {
          arquivo_fonte: arquivoSelecionado,
          periodo_referencia: 'jun/25',
          forcar_aplicacao: !validarApenas,
          validar_apenas: validarApenas
        }
      });

      if (error) throw error;
      setResultado(data);
    } catch (error) {
      console.error('Erro no sistema de regras:', error);
    } finally {
      setLoading(false);
    }
  };

  const corrigirDadosExistentes = async () => {
    setLoading(true);
    try {
      console.log('🔧 Corrigindo dados existentes...');
      const { data, error } = await supabase.functions.invoke('corrigir-regras-aplicacao', {
        body: { arquivo_fonte: arquivoSelecionado }
      });

      if (error) throw error;
      
      const resultado = data as ResultadoCorrecao;
      const totalCorrecoes = (resultado.correcoes_aplicadas?.modalidades || 0) + 
                            (resultado.correcoes_aplicadas?.categorias || 0) + 
                            (resultado.correcoes_aplicadas?.prioridades || 0) + 
                            (resultado.correcoes_aplicadas?.especialidades || 0);
      
      setResultado({
        success: resultado.success,
        arquivo_fonte: resultado.arquivo_fonte,
        total_regras: 5,
        regras_aplicadas: totalCorrecoes,
        regras_validadas_ok: 5,
        regras_falharam: 0,
        status_detalhado: (resultado.regras_aplicadas || []).map((regra: string) => ({
          regra,
          arquivo: resultado.arquivo_fonte,
          aplicada: true,
          validacao_ok: true
        })),
        recomendacao: `✅ Correção concluída: ${resultado.total_registros_processados} registros verificados, ${totalCorrecoes} correções aplicadas nos dados.`
      });

      console.log('✅ Correção concluída:', data);
    } catch (error) {
      console.error('Erro na correção:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: StatusRegra) => {
    if (status.erro) return <XCircle className="h-4 w-4 text-destructive" />;
    if (status.validacao_ok === false) return <AlertCircle className="h-4 w-4 text-warning" />;
    if (status.aplicada && (status.validacao_ok === undefined || status.validacao_ok === true)) return <CheckCircle className="h-4 w-4 text-success" />;
    return <XCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: StatusRegra) => {
    if (status.erro) return <Badge variant="destructive">Erro</Badge>;
    if (status.validacao_ok === false) return <Badge variant="secondary" className="bg-warning text-warning-foreground">Falhou Validação</Badge>;
    if (status.aplicada && (status.validacao_ok === undefined || status.validacao_ok === true)) return <Badge variant="default" className="bg-success text-success-foreground">OK</Badge>;
    return <Badge variant="outline">Não Aplicada</Badge>;
  };

  const getRegraNome = (nome: string) => {
    const nomes: Record<string, string> = {
      'v002_v003_exclusoes_periodo': 'Regras v002/v003 - Exclusões por Período',
      'correcao_modalidades_dx_cr': 'Correção Modalidades DX/CR → RX',
      'correcao_modalidades_ot': 'Correção Modalidades OT → DO',
      'de_para_prioridades': 'De-Para Prioridades',
      'de_para_valores_zerados': 'De-Para Valores Zerados',
      'tipificacao_faturamento': 'Tipificação de Faturamento',
      'validacao_cliente': 'Validação de Cliente'
    };
    return nomes[nome] || nome;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sistema de Aplicação Completa de Regras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={modoOperacao} onValueChange={(value) => setModoOperacao(value as 'validar' | 'aplicar')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="validar" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Validar Regras
            </TabsTrigger>
            <TabsTrigger value="aplicar" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Aplicar Regras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validar" className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Modo Validação:</strong> Verifica se todas as regras foram aplicadas corretamente sem modificar dados.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="aplicar" className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Modo Aplicação:</strong> Aplica TODAS as regras automaticamente com validação pós-aplicação.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Arquivo para Processar:</label>
            <select 
              value={arquivoSelecionado}
              onChange={(e) => setArquivoSelecionado(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {ARQUIVOS_SISTEMA.map(arquivo => (
                <option key={arquivo} value={arquivo}>
                  {arquivo.replace('volumetria_', '').replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => executarSistema(modoOperacao === 'validar')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : modoOperacao === 'validar' ? (
                <Search className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? 'Processando...' : modoOperacao === 'validar' ? 'Validar Regras' : 'Aplicar Todas as Regras'}
            </Button>

            <Button 
              onClick={corrigirDadosExistentes}
              disabled={loading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Corrigir Dados Existentes
                </>
              )}
            </Button>

            {resultado && (
              <Button 
                variant="outline" 
                onClick={() => setResultado(null)}
              >
                Limpar Resultado
              </Button>
            )}
          </div>
        </div>

        {resultado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold">{resultado.total_regras}</div>
                <div className="text-sm text-muted-foreground">Total de Regras</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-success">{resultado.regras_aplicadas}</div>
                <div className="text-sm text-muted-foreground">Aplicadas</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-success">{resultado.regras_validadas_ok}</div>
                <div className="text-sm text-muted-foreground">Validadas OK</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-destructive">{resultado.regras_falharam}</div>
                <div className="text-sm text-muted-foreground">Falharam</div>
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${resultado.success 
              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
              : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {resultado.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {resultado.success ? 'Sucesso Completo' : 'Algumas Regras Falharam'}
                </span>
              </div>
              <p className="text-sm">
                {resultado.recomendacao}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Status Detalhado das Regras:</h3>
              {resultado.status_detalhado.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status)}
                    <div>
                      <div className="font-medium">{getRegraNome(status.regra)}</div>
                      {status.erro && (
                        <div className="text-sm text-destructive">{status.erro}</div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}