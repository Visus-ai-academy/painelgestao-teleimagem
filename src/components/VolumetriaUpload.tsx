import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processVolumetriaFile, VOLUMETRIA_UPLOAD_CONFIGS } from '@/lib/volumetriaUtils';
import { Upload, FileText, CheckCircle, AlertCircle, Lock, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from "@/components/ui/badge";

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
  const [uploadStatus, setUploadStatus] = useState<{
    tipo_arquivo: string;
    arquivo_nome: string;
    status: string;
    registros_processados: number;
    registros_inseridos: number;
    registros_atualizados: number;
    registros_erro: number;
    created_at: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const { toast } = useToast();

  // Buscar status do último upload na inicialização
  useEffect(() => {
    fetchUploadStatus();
  }, [arquivoFonte]);

  const fetchUploadStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('tipo_arquivo', arquivoFonte)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao buscar status:', error);
      }

      if (data && data.length > 0) {
        setUploadStatus(data[0]);
      } else {
        setUploadStatus(null);
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      setUploadStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'erro':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'processando':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'bg-green-100 text-green-800';
      case 'erro':
        return 'bg-red-100 text-red-800';
      case 'processando':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
          // Atualizar status após sucesso
          await fetchUploadStatus();
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

      {/* Status do último upload */}
      {!statusLoading && uploadStatus && (
        <div className="space-y-2 mt-4 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(uploadStatus.status)}
              <span className="text-sm font-medium">Último Upload</span>
              <Badge className={`text-xs ${getStatusColor(uploadStatus.status)}`}>
                {uploadStatus.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(uploadStatus.created_at).toLocaleDateString('pt-BR')} {new Date(uploadStatus.created_at).toLocaleTimeString('pt-BR')}
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground truncate">
            <strong>Arquivo:</strong> {uploadStatus.arquivo_nome}
          </div>
          
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium text-blue-600">{uploadStatus.registros_processados}</div>
              <div className="text-muted-foreground">Proc.</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-green-600">{uploadStatus.registros_inseridos}</div>
              <div className="text-muted-foreground">Inser.</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-orange-600">{uploadStatus.registros_atualizados}</div>
              <div className="text-muted-foreground">Atual.</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">{uploadStatus.registros_erro}</div>
              <div className="text-muted-foreground">Erros</div>
            </div>
          </div>
        </div>
      )}

      {!statusLoading && !uploadStatus && !isProcessing && (
        <div className="text-xs text-muted-foreground text-center">
          Nenhum upload realizado
        </div>
      )}
    </div>
  );
}