import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CorrigirTipificacaoNCProps {
  periodoReferencia?: string;
}

export const CorrigirTipificacaoNC = ({ periodoReferencia }: CorrigirTipificacaoNCProps) => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const executarCorrecao = async () => {
    setLoading(true);
    setResultado(null);

    try {
      console.log('🔧 Iniciando correção de tipificação de clientes NC...');
      
      // PASSO 1: Limpar tipo_faturamento incorreto da volumetria
      console.log('🧹 Limpando tipo_faturamento incorreto...');
      const { data: limpezaData, error: limpezaError } = await supabase.functions.invoke(
        'limpar-tipo-faturamento-incorreto',
        { body: {} }
      );
      
      if (limpezaError) {
        console.error('⚠️ Erro na limpeza:', limpezaError);
      } else {
        console.log('✅ Limpeza concluída:', limpezaData);
      }
      
      // PASSO 2: Corrigir tipificação NC
      const { data, error } = await supabase.functions.invoke(
        'corrigir-tipificacao-clientes-nc',
        {
          body: {
            periodo_referencia: periodoReferencia
          }
        }
      );

      if (error) throw error;

      console.log('✅ Correção concluída:', data);
      setResultado(data);

      toast({
        title: "Correção executada com sucesso",
        description: `${data.contratos_corrigidos} contratos corrigidos, ${limpezaData?.registrosLimpos || 0} registros limpos`,
      });

    } catch (error: any) {
      console.error('❌ Erro ao executar correção:', error);
      toast({
        title: "Erro ao executar correção",
        description: error.message,
        variant: "destructive",
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

        {periodoReferencia && (
          <div className="text-sm text-muted-foreground">
            Período de referência: <strong>{periodoReferencia}</strong>
          </div>
        )}

        <Button 
          onClick={executarCorrecao} 
          disabled={loading}
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

        {resultado && (
          <div className="mt-4 space-y-3">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Correção concluída com sucesso!</strong>
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm">Resumo da Correção:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Clientes NC cadastrados:</span>
                  <span className="ml-2 font-medium">{resultado.clientes_nc_cadastrados}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Clientes NC encontrados:</span>
                  <span className="ml-2 font-medium">{resultado.clientes_nc_encontrados}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contratos corrigidos:</span>
                  <span className="ml-2 font-medium text-green-600">{resultado.contratos_corrigidos}</span>
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
