import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProcessarArquivoCompletoProps {
  filePath: string;
  arquivoFonte: string;
  totalEstimado?: number;
  onComplete?: () => void;
}

interface BatchInfo {
  start_row: number;
  end_row: number;
  batch_size: number;
  total_records: number;
  inserted: number;
  errors: number;
  de_para_updated: number;
  progress_percent: number;
  has_more: boolean;
  next_start_row: number | null;
}

export function ProcessarArquivoCompleto({
  filePath,
  arquivoFonte,
  totalEstimado,
  onComplete
}: ProcessarArquivoCompletoProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStartRow, setCurrentStartRow] = useState(0);
  const [stats, setStats] = useState({
    totalInserted: 0,
    totalErrors: 0,
    totalDeParaUpdated: 0
  });

  const processBatch = async (startRow: number): Promise<BatchInfo | null> => {
    try {
      console.log('🚀 Iniciando processamento do batch:', {
        filePath,
        arquivoFonte,
        startRow,
        batchSize: 500
      });

      const { data, error } = await supabase.functions.invoke('processar-volumetria-completo', {
        body: {
          file_path: filePath,
          arquivo_fonte: arquivoFonte,
          start_row: startRow,
          batch_size: 10 // Ultra pequeno: apenas 10 registros por batch
        }
      });

      console.log('📥 Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro da edge function:', error);
        throw error;
      }

      return data.batch_info;
    } catch (error: any) {
      console.error('💥 Erro ao processar batch:', error);
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setIsPaused(false);
    let startRow = currentStartRow;

    try {
      // Primeiro batch para obter total de registros
      const firstBatch = await processBatch(startRow);
      if (!firstBatch) {
        setIsProcessing(false);
        return;
      }

      const estimatedBatches = Math.ceil(firstBatch.total_records / 500);
      setTotalBatches(estimatedBatches);
      
      let batchInfo = firstBatch;
      let batchCount = 1;

      // Atualizar estatísticas do primeiro batch
      setStats(prev => ({
        totalInserted: prev.totalInserted + batchInfo.inserted,
        totalErrors: prev.totalErrors + batchInfo.errors,
        totalDeParaUpdated: prev.totalDeParaUpdated + batchInfo.de_para_updated
      }));

      setProgress(batchInfo.progress_percent);
      setCurrentBatch(batchCount);
      
      // Processar batches restantes
      while (batchInfo.has_more && !isPaused) {
        if (!batchInfo.next_start_row) break;
        
        startRow = batchInfo.next_start_row;
        setCurrentStartRow(startRow);
        batchCount++;
        
        batchInfo = await processBatch(startRow);
        if (!batchInfo) break;

        // Atualizar estatísticas
        setStats(prev => ({
          totalInserted: prev.totalInserted + batchInfo.inserted,
          totalErrors: prev.totalErrors + batchInfo.errors,
          totalDeParaUpdated: prev.totalDeParaUpdated + batchInfo.de_para_updated
        }));

        setProgress(batchInfo.progress_percent);
        setCurrentBatch(batchCount);

        // Pequena pausa entre batches para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!isPaused) {
        toast({
          title: "Processamento concluído!",
          description: `${stats.totalInserted} registros inseridos, ${stats.totalDeParaUpdated} de-para aplicados`,
        });
        
        setProgress(100);
        onComplete?.();
      }

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

  const pauseProcessing = () => {
    setIsPaused(true);
    setIsProcessing(false);
  };

  const resumeProcessing = () => {
    setIsPaused(false);
    startProcessing();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Processamento Completo do Arquivo
        </CardTitle>
        <CardDescription>
          Processa arquivos grandes em batches para evitar timeouts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso: Batch {currentBatch} de {totalBatches || '?'}</span>
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
          {!isProcessing && !isPaused && (
            <Button onClick={startProcessing} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Iniciar Processamento
            </Button>
          )}
          
          {isProcessing && (
            <Button onClick={pauseProcessing} variant="outline" className="flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Pausar
            </Button>
          )}
          
          {isPaused && (
            <Button onClick={resumeProcessing} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Continuar
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