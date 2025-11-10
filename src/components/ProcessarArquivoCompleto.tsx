import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useVolumetria } from '@/contexts/VolumetriaContext';

interface ProcessarArquivoCompletoProps {
  filePath: string;
  arquivoFonte: string;
  totalEstimado?: number;
  onComplete?: () => void;
  periodoFaturamento?: { ano: number; mes: number };
}

export function ProcessarArquivoCompleto({
  filePath,
  arquivoFonte,
  totalEstimado,
  onComplete,
  periodoFaturamento
}: ProcessarArquivoCompletoProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    totalInserted: 0,
    totalErrors: 0,
    totalDeParaUpdated: 0
  });
  const { refreshData } = useVolumetria();

  const startProcessing = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      console.log('🚀 Iniciando processamento completo:', {
        filePath,
        arquivoFonte
      });

// Adicionar logs detalhados para debug
console.log('📋 Dados enviados para edge function:', {
  file_path: filePath,
  arquivo_fonte: arquivoFonte,
  periodo: periodoFaturamento ?? { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 }
});

const { data, error } = await supabase.functions.invoke('processar-volumetria-otimizado', {
  body: {
    file_path: filePath,
    arquivo_fonte: arquivoFonte,
    periodo: periodoFaturamento ?? { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 }
  }
});

      console.log('📥 Resposta completa da edge function:', JSON.stringify({ data, error }, null, 2));

      if (error) {
        console.error('❌ Erro da edge function:', error);
        throw error;
      }

      // A função original retorna os dados diretamente
      const result = data;
      console.log('📊 Resultado parseado:', result);
      
      setStats({
        totalInserted: result.totalInserted || 0,
        totalErrors: result.totalErrors || 0,
        totalDeParaUpdated: result.registrosAtualizadosDePara || 0
      });
      
      setProgress(100);

      const insertedCount = result.totalInserted || 0;
      const deParaCount = result.registrosAtualizadosDePara || 0;
      
      if (insertedCount === 0) {
        toast({
          title: "Processamento concluído com problemas",
          description: `Nenhum registro foi inserido. Verificar logs para detalhes.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Processamento concluído!",
          description: `${insertedCount} registros inseridos, ${deParaCount} de-para aplicados`,
        });
        
        // Atualizar automaticamente a "Análise dos Uploads Realizados" e "Exames Não Identificados"
        await refreshData();
      }
      
      onComplete?.();

    } catch (error: any) {
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Processamento Completo do Arquivo
        </CardTitle>
        <CardDescription>
          Processa o arquivo usando a função otimizada que já funcionava perfeitamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.totalInserted}</div>
            <div className="text-muted-foreground">Inseridos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalDeParaUpdated}</div>
            <div className="text-muted-foreground">De-Para</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.totalErrors}</div>
            <div className="text-muted-foreground">Erros</div>
          </div>
        </div>

        <div className="flex gap-2">
          {!isProcessing && (
            <Button onClick={startProcessing} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Iniciar Processamento
            </Button>
          )}

          {progress === 100 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Concluído!</span>
            </div>
          )}
        </div>

        {totalEstimado && (
          <div className="text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Arquivo com ~{totalEstimado.toLocaleString()} registros estimados
          </div>
        )}
      </CardContent>
    </Card>
  );
}