import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ReprocessarTodasRegras() {
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const executarReprocessamento = async () => {
    try {
      setProcessando(true);
      setResultado(null);
      
      toast.info('Iniciando reprocessamento completo das regras...');
      
      // 1. Primeiro reprocessar registros existentes
      const { data: reprocessResult, error: reprocessError } = await supabase
        .rpc('reprocessar_volumetria_sem_regras');
      
      if (reprocessError) {
        throw reprocessError;
      }
      
      toast.success(`Reprocessamento concluído: ${(reprocessResult as any)?.total_reprocessados || 0} registros`);
      
      // 2. Aplicar quebras pendentes
      const { data: quebraResult, error: quebraError } = await supabase
        .rpc('aplicar_quebras_pendentes');
      
      if (quebraError) {
        throw quebraError;
      }
      
      toast.success(`Quebras aplicadas: ${(quebraResult as any)?.total_quebrados || 0} exames quebrados`);
      
      setResultado({
        reprocessamento: reprocessResult,
        quebras: quebraResult,
        sucesso: true
      });
      
      toast.success('🎉 Todas as regras foram aplicadas com sucesso!');
      
    } catch (error: any) {
      console.error('Erro no reprocessamento:', error);
      toast.error(`Erro: ${error.message}`);
      
      setResultado({
        sucesso: false,
        erro: error.message
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Reprocessar Todas as Regras de Volumetria
        </CardTitle>
        <CardDescription>
          Aplica todas as regras de processamento em registros que não foram processados corretamente.
          <br />
          <strong>Inclui:</strong> Categorização, Tipificação de Faturamento, Quebra de Exames, Especialidades e todas as demais regras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta operação irá aplicar automaticamente todas as regras de processamento nos dados de volumetria 
            que não foram processados corretamente. O processo pode demorar alguns minutos.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-4">
          <Button 
            onClick={executarReprocessamento}
            disabled={processando}
            className="w-full"
          >
            {processando ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Executar Reprocessamento Completo
              </>
            )}
          </Button>

          {resultado && (
            <Card className={`border-2 ${resultado.sucesso ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {resultado.sucesso ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Reprocessamento Concluído
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      Erro no Reprocessamento
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resultado.sucesso ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Reprocessamento de Regras</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50">
                            {(resultado.reprocessamento as any)?.total_reprocessados || 0} registros processados
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Aplicação de Quebras</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-50">
                            {(resultado.quebras as any)?.total_processados || 0} registros originais
                          </Badge>
                          <Badge variant="outline" className="bg-orange-50">
                            {(resultado.quebras as any)?.total_quebrados || 0} exames quebrados
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Processamento realizado em: {new Date().toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p><strong>Erro:</strong> {resultado.erro}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Regras que serão aplicadas automaticamente:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>v022 - Limpeza e normalização de nomes de clientes</li>
            <li>v026 - Correção de modalidades (CR/DX → RX/MG, OT → DO)</li>
            <li>v027 - Aplicação de regras de quebra de exames</li>
            <li>v028 - Definição automática de categorias</li>
            <li>v029 - Aplicação de de-para de prioridades</li>
            <li>f005 - Aplicação de valores de referência (de-para)</li>
            <li>f006 - Tipificação automática de faturamento</li>
            <li>extra_007 - Definição automática de especialidades</li>
            <li>extra_008 - Garantia de data de referência</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}