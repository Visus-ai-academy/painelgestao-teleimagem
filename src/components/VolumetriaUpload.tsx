import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processVolumetriaFile, VOLUMETRIA_UPLOAD_CONFIGS } from '@/lib/volumetriaUtils';
import { Upload, FileText, CheckCircle, AlertCircle, Lock } from 'lucide-react';

interface VolumetriaUploadProps {
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao';
  onSuccess?: () => void;
  disabled?: boolean;
  periodoFaturamento?: { ano: number; mes: number };
}

export function VolumetriaUpload({ arquivoFonte, onSuccess, disabled = false, periodoFaturamento }: VolumetriaUploadProps) {
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

    // Validação rigorosa do arquivo
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidExtension = ['.xlsx', '.xls'].includes(fileExtension);
    const isValidMimeType = allowedMimeTypes.includes(file.type);
    
    if (!isValidExtension || !isValidMimeType) {
      toast({
        title: "Erro",
        description: `Arquivo inválido. Tipos aceitos: .xlsx, .xls. Detectado: ${file.type}`,
        variant: "destructive"
      });
      return;
    }

    // Validar nome do arquivo
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.name)) {
      toast({
        title: "Erro",
        description: "Nome do arquivo contém caracteres não permitidos",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "Erro",
        description: "Arquivo muito grande. Tamanho máximo: 50MB",
        variant: "destructive"
      });
      return;
    }

    if (file.size < 100) {
      toast({
        title: "Erro",
        description: "Arquivo muito pequeno ou corrompido",
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
        },
        periodoFaturamento
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

  const config = VOLUMETRIA_UPLOAD_CONFIGS[arquivoFonte];

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold text-sm">{config.label}</h3>
        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
      </div>
      
      <div className="flex items-center justify-center w-full">
        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
          disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 
          isProcessing ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
        }`}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {disabled ? (
              <>
                <Lock className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Upload bloqueado</p>
                <p className="text-xs text-gray-400">Defina o período de faturamento primeiro</p>
              </>
            ) : isProcessing ? (
              <>
                <FileText className="w-8 h-8 mb-4 text-primary animate-pulse" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span>Processando arquivo...</span>
                </p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivos Excel (.xlsx, .xls)
                </p>
              </>
            )}
          </div>
          {!disabled && (
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          )}
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