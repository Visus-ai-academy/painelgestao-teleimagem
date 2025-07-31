import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ReprocessarRegrasProps {
  arquivoFonte: string;
  onSuccess?: () => void;
}

export function ReprocessarRegras({ arquivoFonte, onSuccess }: ReprocessarRegrasProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleReprocessar = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      console.log('🔧 Reprocessando regras para:', arquivoFonte);
      
      const { data, error } = await supabase.functions.invoke('reprocessar-regras-volumetria', {
        body: { arquivo_fonte: arquivoFonte }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro no reprocessamento');
      }

      setResult(data);
      
      toast({
        title: "✅ Regras aplicadas!",
        description: `${data.registros_atualizados} registros atualizados`,
      });

      // Forçar atualização das estatísticas
      if ((window as any).volumetriaContext) {
        setTimeout(() => {
          (window as any).volumetriaContext.refreshData();
        }, 1000);
      }

      onSuccess?.();
      
    } catch (error) {
      console.error('❌ Erro no reprocessamento:', error);
      toast({
        title: "❌ Erro",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getArquivoLabel = (fonte: string) => {
    switch (fonte) {
      case 'volumetria_padrao': return 'Arquivo 1: Volumetria Padrão';
      case 'volumetria_fora_padrao': return 'Arquivo 2: Volumetria Fora Padrão';
      case 'volumetria_padrao_retroativo': return 'Arquivo 3: Volumetria Padrão Retroativo';
      case 'volumetria_fora_padrao_retroativo': return 'Arquivo 4: Volumetria Fora Padrão Retroativo';
      case 'volumetria_onco_padrao': return 'Arquivo 5: Volumetria Onco Padrão';
      default: return fonte;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Zap className="h-5 w-5" />
          Reprocessar Regras de Negócio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-900">
            {getArquivoLabel(arquivoFonte)}
          </p>
          <p className="text-xs text-blue-700">
            Reaplicar regras de tratamento, De-Para e validações específicas
          </p>
        </div>

        {result && (
          <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Processamento Concluído</span>
            </div>
            <div className="text-sm text-green-700">
              <p><strong>{result.registros_atualizados}</strong> registros atualizados</p>
              {result.detalhes && result.detalhes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.detalhes.map((detalhe: string, index: number) => (
                    <li key={index} className="text-xs">• {detalhe}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <Button 
          onClick={handleReprocessar}
          disabled={isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Aplicar Regras Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}