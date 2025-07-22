import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processVolumetriaFile } from '@/lib/volumetriaUtils';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface VolumetriaUploadProps {
  arquivoFonte: 'data_laudo' | 'data_exame';
  onSuccess?: () => void;
}

export function VolumetriaUpload({ arquivoFonte, onSuccess }: VolumetriaUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    processed: number;
    total: number;
    inserted: number;
  } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStats(null);

    try {
      const result = await processVolumetriaFile(
        file,
        arquivoFonte,
        (processed, total, inserted) => {
          const progressPercent = Math.round((processed / total) * 100);
          setProgress(progressPercent);
          setStats({ processed, total, inserted });
        }
      );

      if (result.success) {
        toast({
          title: "Upload concluído!",
          description: `${result.totalInserted} registros inseridos com sucesso.`,
        });
        onSuccess?.();
      } else {
        toast({
          title: "Erro no processamento",
          description: result.errors[0] || "Erro desconhecido",
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao processar arquivo",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isProcessing ? (
              <FileText className="w-8 h-8 mb-4 text-primary animate-pulse" />
            ) : (
              <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
            )}
            <p className="mb-2 text-sm text-muted-foreground">
              {isProcessing ? (
                <span>Processando arquivo...</span>
              ) : (
                <>
                  <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Arquivos Excel (.xlsx, .xls)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
        </label>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
          
          {stats && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processadas: {stats.processed}/{stats.total}</span>
              <span>Inseridas: {stats.inserted}</span>
            </div>
          )}
        </div>
      )}

      {!isProcessing && stats && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Concluído: {stats.inserted} registros inseridos</span>
        </div>
      )}
    </div>
  );
}