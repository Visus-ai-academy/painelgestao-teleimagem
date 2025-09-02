import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Play, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StatusRegra {
  regra: string;
  aplicada: boolean;
  erro?: string;
  detalhes?: any;
}

interface ResultadoProcessamento {
  success: boolean;
  total_processados: number;
  total_corrigidos: number;
  status_regras: StatusRegra[];
  tempo_processamento: string;
}

const ARQUIVOS_VOLUMETRIA = [
  { value: 'volumetria_padrao', label: 'Padrão' },
  { value: 'volumetria_fora_padrao', label: 'Fora do Padrão' },
  { value: 'volumetria_padrao_retroativo', label: 'Retroativo Padrão' },
  { value: 'volumetria_fora_padrao_retroativo', label: 'Retroativo Fora Padrão' },
  { value: 'volumetria_onco_padrao', label: 'Oncológico' },
];

export function SistemaRegrasUnificado() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState('volumetria_padrao');

  const aplicarTodasRegras = async () => {
    setLoading(true);
    setResultado(null);
    
    try {
      toast.info('Iniciando aplicação completa de regras...', {
        description: `Processando arquivo: ${arquivoSelecionado}`
      });

      const inicioTempo = Date.now();

      // Executar função unificada que aplica TODAS as regras corretamente
      const { data, error } = await supabase.functions.invoke('aplicar-regras-completo-unificado', {
        body: { 
          arquivo_fonte: arquivoSelecionado,
          periodo_referencia: '2025-06'
        }
      });

      if (error) throw error;

      const tempoDecorrido = ((Date.now() - inicioTempo) / 1000).toFixed(1);

      setResultado({
        success: data.success,
        total_processados: data.total_processados || 0,
        total_corrigidos: data.total_corrigidos || 0,
        status_regras: data.status_regras || [],
        tempo_processamento: tempoDecorrido
      });

      if (data.success) {
        toast.success('Regras aplicadas com sucesso!', {
          description: `${data.total_corrigidos} registros processados em ${tempoDecorrido}s`
        });
      } else {
        toast.warning('Regras aplicadas com algumas falhas', {
          description: 'Verifique os detalhes no resultado'
        });
      }

    } catch (error: any) {
      console.error('Erro ao aplicar regras:', error);
      toast.error('Erro na aplicação de regras', {
        description: error.message
      });
      
      setResultado({
        success: false,
        total_processados: 0,
        total_corrigidos: 0,
        status_regras: [{ regra: 'Sistema', aplicada: false, erro: error.message }],
        tempo_processamento: '0'
      });
    } finally {
      setLoading(false);
    }
  };

  const debugCategorias = async () => {
    setLoading(true);
    
    try {
      toast.info('Executando diagnóstico de categorias...', {
        description: `Testando arquivo: ${arquivoSelecionado}`
      });

      const { data, error } = await supabase.functions.invoke('debug-categorias', {
        body: { arquivo_fonte: arquivoSelecionado }
      });

      if (error) throw error;

      toast.success('Diagnóstico concluído', {
        description: `Diferença: ${data.diferenca} registros processados`
      });

      console.log('🔍 DEBUG RESULT:', data);

    } catch (error: any) {
      console.error('Erro no debug:', error);
      toast.error('Erro no diagnóstico', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const validarRegras = async () => {
    setLoading(true);
    
    try {
      toast.info('Validando regras aplicadas...', {
        description: `Verificando arquivo: ${arquivoSelecionado}`
      });

      const { data, error } = await supabase.functions.invoke('validar-regras-aplicadas', {
        body: { arquivo_fonte: arquivoSelecionado }
      });

      if (error) throw error;

      setResultado({
        success: data.todas_validas,
        total_processados: data.total_registros || 0,
        total_corrigidos: 0,
        status_regras: data.validacoes || [],
        tempo_processamento: '0'
      });

      toast.success('Validação concluída', {
        description: data.todas_validas ? 'Todas as regras estão corretas' : 'Algumas regras precisam ser reaplicadas'
      });

    } catch (error: any) {
      console.error('Erro na validação:', error);
      toast.error('Erro na validação', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (regra: StatusRegra) => {
    if (regra.erro) return <XCircle className="h-4 w-4 text-destructive" />;
    if (regra.aplicada) return <CheckCircle className="h-4 w-4 text-success" />;
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  const getStatusBadge = (regra: StatusRegra) => {
    if (regra.erro) return <Badge variant="destructive">Erro</Badge>;
    if (regra.aplicada) return <Badge variant="default" className="bg-success text-success-foreground">Aplicada</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Sistema Unificado de Regras de Negócio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Seleção de Arquivo */}
        <div>
          <label className="text-sm font-medium mb-2 block">Arquivo para Processar:</label>
          <select 
            value={arquivoSelecionado}
            onChange={(e) => setArquivoSelecionado(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            disabled={loading}
          >
            {ARQUIVOS_VOLUMETRIA.map(arquivo => (
              <option key={arquivo.value} value={arquivo.value}>
                {arquivo.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ações Principais */}
        <Tabs defaultValue="aplicar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aplicar">Aplicar Regras</TabsTrigger>
            <TabsTrigger value="validar">Validar Regras</TabsTrigger>
          </TabsList>

          <TabsContent value="aplicar" className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Aplicar Regras:</strong> Executa TODAS as regras necessárias automaticamente com processamento em lotes para evitar limitações.
              </p>
            </div>
            
            <Button 
              onClick={aplicarTodasRegras}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? 'Aplicando Regras...' : 'Aplicar Todas as Regras'}
            </Button>

            <Button 
              onClick={debugCategorias}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              DEBUG: Testar Categorias
            </Button>
          </TabsContent>

          <TabsContent value="validar" className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Validar Regras:</strong> Verifica se todas as regras foram aplicadas corretamente sem modificar dados.
              </p>
            </div>
            
            <Button 
              onClick={validarRegras}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
              variant="outline"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {loading ? 'Validando...' : 'Validar Regras Aplicadas'}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Resultado */}
        {resultado && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold">{resultado.total_processados}</div>
                <div className="text-sm text-muted-foreground">Registros Processados</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-success">{resultado.total_corrigidos}</div>
                <div className="text-sm text-muted-foreground">Correções Aplicadas</div>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border">
                <div className="text-2xl font-bold">{resultado.tempo_processamento}s</div>
                <div className="text-sm text-muted-foreground">Tempo Decorrido</div>
              </div>
            </div>

            {/* Status Geral */}
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
                  {resultado.success ? 'Processamento Concluído com Sucesso' : 'Processamento com Falhas'}
                </span>
              </div>
            </div>

            {/* Detalhes das Regras */}
            {resultado.status_regras.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Status das Regras:</h3>
                {resultado.status_regras.map((regra, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(regra)}
                      <div>
                        <div className="font-medium">{regra.regra}</div>
                        {regra.erro && (
                          <div className="text-sm text-destructive">{regra.erro}</div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(regra)}
                  </div>
                ))}
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={() => setResultado(null)}
              className="w-full"
            >
              Limpar Resultado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}