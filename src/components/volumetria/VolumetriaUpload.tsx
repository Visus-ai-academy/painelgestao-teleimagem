import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, File, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVolumetriaRefresh } from "@/hooks/useVolumetriaRefresh";

interface VolumetriaUploadProps {
  arquivoFonte: string;
  disabled?: boolean;
  periodoFaturamento?: { ano: number; mes: number };
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const ARQUIVO_LABELS = {
  'volumetria_padrao': 'Volumetria Padrão',
  'volumetria_fora_padrao': 'Volumetria Fora do Padrão',
  'volumetria_padrao_retroativo': 'Volumetria Padrão Retroativo', 
  'volumetria_fora_padrao_retroativo': 'Volumetria Fora do Padrão Retroativo',
  'volumetria_onco_padrao': 'Volumetria Onco Padrão'
};

export function VolumetriaUpload({ 
  arquivoFonte, 
  disabled = false, 
  periodoFaturamento,
  onSuccess,
  onError 
}: VolumetriaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configurar refresh automático
  useVolumetriaRefresh();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error("Apenas arquivos .xlsx são permitidos");
      return;
    }

    // Validar período
    if (!periodoFaturamento) {
      toast.error("Selecione um período de faturamento antes de fazer o upload");
      return;
    }

    await processarArquivo(file);
  };

  const processarArquivo = async (file: File) => {
    try {
      setUploading(true);
      setStatus('uploading');
      setProgress(0);
      setStatusMessage('Iniciando upload...');

      // 1. Upload do arquivo para o storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `${arquivoFonte}_${Date.now()}.${fileExtension}`;
      const filePath = `volumetria/${fileName}`;

      setStatusMessage('Enviando arquivo...');
      setProgress(25);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Processar via coordenador
      setStatus('processing');
      setStatusMessage('Processando dados...');
      setProgress(50);

      const periodoRef = `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][periodoFaturamento.mes - 1]}/${periodoFaturamento.ano.toString().slice(-2)}`;

      const { data: processData, error: processError } = await supabase.functions.invoke(
        'processar-volumetria-coordenador',
        {
          body: {
            file_path: filePath,
            arquivo_fonte: arquivoFonte,
            periodo_referencia: periodoRef
          }
        }
      );

      if (processError) {
        throw new Error(`Erro no processamento: ${processError.message}`);
      }

      if (!processData?.sucesso) {
        throw new Error(`Processamento falhou: ${processData?.erro || 'Erro desconhecido'}`);
      }

      setUploadId(processData.upload_id);
      setProgress(75);
      setStatusMessage('Validando integridade...');

      // 3. Validar integridade
      const { data: validacaoData, error: validacaoError } = await supabase.functions.invoke(
        'validar-integridade-processamento',
        {
          body: {
            upload_id: processData.upload_id,
            arquivo_fonte: arquivoFonte
          }
        }
      );

      setProgress(90);

      if (validacaoError) {
        console.warn('⚠️ Erro na validação:', validacaoError);
        setStatusMessage('Processado com alertas de validação');
      } else if (validacaoData?.requer_rollback) {
        setStatus('error');
        setStatusMessage(`Falha na validação (${validacaoData.pontuacao_integridade}/100 pontos)`);
        
        toast.error(
          `Upload rejeitado por falhas de integridade. Pontuação: ${validacaoData.pontuacao_integridade}/100`,
          { 
            description: `Falhas: ${validacaoData.validacoes_falhadas?.join(', ') || 'Vários problemas detectados'}`
          }
        );

        // Executar rollback automático
        await supabase.functions.invoke('executar-rollback-processamento', {
          body: {
            upload_id: processData.upload_id,
            motivo: 'Falha na validação de integridade automática',
            forcar_rollback: true
          }
        });

        onError?.(`Validação falhou: ${validacaoData.validacoes_falhadas?.join(', ')}`);
        return;
      }

      // 4. Sucesso
      setProgress(100);
      setStatus('success');
      setStatusMessage(`Processado com sucesso! ${processData.registros_inseridos} registros`);
      
      toast.success(
        `${ARQUIVO_LABELS[arquivoFonte as keyof typeof ARQUIVO_LABELS]} processado com sucesso!`,
        { 
          description: `${processData.registros_inseridos} registros processados em ${processData.tempo_processamento || 'N/A'}` 
        }
      );

      onSuccess?.();

      // Limpar após 3 segundos
      setTimeout(() => {
        resetUpload();
      }, 3000);

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      setStatus('error');
      setStatusMessage(error.message);
      
      toast.error("Erro no processamento", {
        description: error.message
      });

      onError?.(error.message);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setStatus('idle');
    setProgress(0);
    setStatusMessage('');
    setUploadId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Upload className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'uploading':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isDisabled = disabled || uploading || !periodoFaturamento;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {ARQUIVO_LABELS[arquivoFonte as keyof typeof ARQUIVO_LABELS]}
          </CardTitle>
          {getStatusIcon()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isDisabled}
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          variant={status === 'success' ? 'default' : 'outline'}
          className="w-full"
        >
          <File className="mr-2 h-4 w-4" />
          {uploading ? 'Processando...' : 'Selecionar Arquivo'}
        </Button>

        {!periodoFaturamento && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Selecione um período de faturamento primeiro
          </div>
        )}

        {progress > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{statusMessage}</span>
              <span className="font-medium">{progress}%</span>
            </div>
          </div>
        )}

        {status !== 'idle' && (
          <Badge className={`w-full justify-center ${getStatusColor()}`}>
            {statusMessage}
          </Badge>
        )}

        {uploadId && (
          <div className="text-xs text-muted-foreground font-mono">
            ID: {uploadId}
          </div>
        )}
      </CardContent>
    </Card>
  );
}