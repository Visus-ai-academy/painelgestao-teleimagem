import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Link2, Loader2 } from 'lucide-react';

export const CorrigirAssociacaoRepasses = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [totalSemAssociacao, setTotalSemAssociacao] = useState<number | null>(null);
  const [loadingEspecialidade, setLoadingEspecialidade] = useState(false);
  const [resultadoEspecialidade, setResultadoEspecialidade] = useState<any>(null);

  const verificarStatus = async () => {
    try {
      const { count, error } = await supabase
        .from('medicos_valores_repasse')
        .select('*', { count: 'exact', head: true })
        .is('medico_id', null);

      if (error) throw error;
      setTotalSemAssociacao(count || 0);
      
      if (count === 0) {
        toast.success('Todos os repasses estão associados!');
      } else {
        toast.info(`${count} repasses sem associação encontrados`);
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  const executarCorrecao = async () => {
    try {
      setLoading(true);
      setResultado(null);
      toast.info('Iniciando correção de associações...');

      const { data, error } = await supabase.functions.invoke('corrigir-associacao-repasses', {
        body: {
          limiar_similaridade: 0.85 // 85% de similaridade mínima
        }
      });

      if (error) throw error;

      setResultado(data);
      
      if (data.associados > 0) {
        toast.success(`${data.associados} repasses associados com sucesso!`);
      } else {
        toast.warning('Nenhuma associação foi realizada');
      }

      // Atualizar status
      await verificarStatus();
    } catch (error: any) {
      console.error('Erro ao executar correção:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const corrigirEspecialidadesInvalidas = async () => {
    try {
      setLoadingEspecialidade(true);
      setResultadoEspecialidade(null);
      toast.info('Corrigindo especialidades inválidas (GERAL e RX)...');

      const { data, error } = await supabase.functions.invoke('corrigir-especialidades-invalidas-completo');

      if (error) throw error;

      setResultadoEspecialidade(data);
      
      if (data.total_corrigidos > 0) {
        toast.success(`${data.total_corrigidos} registros corrigidos!`);
      } else {
        toast.info('Nenhum registro com especialidades inválidas encontrado');
      }
    } catch (error: any) {
      console.error('Erro ao corrigir especialidades inválidas:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoadingEspecialidade(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card de Especialidades Inválidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Corrigir Especialidades Inválidas
          </CardTitle>
          <CardDescription>
            Corrige registros com ESPECIALIDADE = "GERAL" ou "RX" usando o cadastro de exames
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta ferramenta busca todos os registros com especialidades inválidas ("GERAL" e "RX") e atualiza com a especialidade 
              correta baseada no cadastro de exames. "RX" é uma modalidade, não especialidade.
            </AlertDescription>
          </Alert>

          <Button onClick={corrigirEspecialidadesInvalidas} disabled={loadingEspecialidade}>
            {loadingEspecialidade ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Corrigindo...
              </>
            ) : (
              'Executar Correção de Especialidades'
            )}
          </Button>

          {resultadoEspecialidade && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Resultado da Correção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">GERAL Processados</p>
                    <p className="text-2xl font-bold">{resultadoEspecialidade.registros_geral_processados || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">RX Processados</p>
                    <p className="text-2xl font-bold">{resultadoEspecialidade.registros_rx_processados || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Corrigidos</p>
                    <p className="text-2xl font-bold text-green-600">{resultadoEspecialidade.total_corrigidos}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Não Encontrados</p>
                    <p className="text-2xl font-bold text-yellow-600">{resultadoEspecialidade.total_nao_encontrados}</p>
                  </div>
                </div>

                {resultadoEspecialidade.detalhes && resultadoEspecialidade.detalhes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Detalhes das Correções:</h4>
                    <div className="space-y-1 text-sm max-h-64 overflow-y-auto">
                      {resultadoEspecialidade.detalhes.map((det: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          <span className="flex-1 font-mono text-xs">{det.estudo}</span>
                          <span className="text-xs">
                            <span className="text-destructive">{det.de}</span>
                            {' → '}
                            <span className="text-green-600">{det.para}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Card de Associação de Repasses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Corrigir Associação de Repasses
          </CardTitle>
          <CardDescription>
            Associa automaticamente valores de repasse aos médicos cadastrados usando busca aproximada de nomes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta ferramenta busca repasses sem médico associado e tenta vinculá-los aos médicos cadastrados 
              usando normalização e comparação de nomes com 85% de similaridade mínima.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={verificarStatus} variant="outline" disabled={loading}>
              Verificar Status
            </Button>
            <Button onClick={executarCorrecao} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Executar Correção'
              )}
            </Button>
          </div>

          {totalSemAssociacao !== null && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Repasses sem associação:</span>
                    <span className="text-2xl font-bold text-destructive">{totalSemAssociacao}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {resultado && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Resultado da Correção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Processados</p>
                    <p className="text-2xl font-bold">{resultado.processados}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Associados</p>
                    <p className="text-2xl font-bold text-green-600">{resultado.associados}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Não Encontrados</p>
                    <p className="text-2xl font-bold text-yellow-600">{resultado.nao_encontrados}</p>
                  </div>
                </div>

                {resultado.processados > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Taxa de sucesso</span>
                      <span className="font-medium">
                        {Math.round((resultado.associados / resultado.processados) * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={(resultado.associados / resultado.processados) * 100} 
                      className="h-2"
                    />
                  </div>
                )}

                {resultado.detalhes_amostra && resultado.detalhes_amostra.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Amostra de Associações (primeiros 50):</h4>
                    <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                      {resultado.detalhes_amostra.map((det: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          <span className="flex-1">{det.medico_nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {det.similaridade}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Limiar de similaridade usado: {Math.round(resultado.limiar_usado * 100)}%
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
