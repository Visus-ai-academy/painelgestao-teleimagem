import { useState, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FileUploadProps {
  title: string;
  description: string;
  acceptedTypes: string[];
  maxSizeInMB: number;
  expectedFormat: string[];
  onUpload: (file: File) => Promise<void>;
  icon?: React.ReactNode;
}

interface UploadState {
  file: File | null;
  isUploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  details?: any;
}

export function FileUpload({
  title,
  description,
  acceptedTypes,
  maxSizeInMB,
  expectedFormat,
  onUpload,
  icon
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>({
    file: null,
    isUploading: false,
    progress: 0,
    status: 'idle'
  });
  
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    // Validar tipo de arquivo
    const isValidType = acceptedTypes.some(type => 
      file.type.includes(type) || file.name.toLowerCase().endsWith(type)
    );
    
    if (!isValidType) {
      toast({
        title: "Tipo de arquivo inválido",
        description: `Tipos aceitos: ${acceptedTypes.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast({
        title: "Arquivo muito grande",
        description: `Tamanho máximo: ${maxSizeInMB}MB`,
        variant: "destructive"
      });
      return;
    }

    setState(prev => ({ ...prev, file, status: 'idle' }));
  }, [acceptedTypes, maxSizeInMB, toast]);

  const handleUpload = useCallback(async () => {
    if (!state.file) return;

    setState(prev => ({ ...prev, isUploading: true, status: 'uploading', progress: 30 }));

    try {
      // 1. Upload do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}_${state.file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filename, state.file);

      if (uploadError) throw uploadError;
      
      setState(prev => ({ ...prev, progress: 60 }));

      // 2. Processar arquivo com detecção automática de template
      const { data, error } = await supabase.functions.invoke('processar-importacao-inteligente', {
        body: { filename }
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        isUploading: false,
        progress: 100,
        status: 'success',
        message: data.message || 'Upload concluído com sucesso!',
        details: data.details
      }));

      toast({
        title: "Upload realizado",
        description: data.message || "Arquivo enviado e processado com sucesso!",
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro no upload'
      }));

      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  }, [state.file, toast]);

  const clearFile = useCallback(() => {
    setState({
      file: null,
      isUploading: false,
      progress: 0,
      status: 'idle',
      details: undefined
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!state.file ? (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = acceptedTypes.join(',');
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileSelect(file);
              };
              input.click();
            }}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              {description}
            </p>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">{state.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(state.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex items-center gap-2">
                {state.status === 'success' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {state.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={state.isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {state.isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Enviando...</span>
                  <span>{state.progress}%</span>
                </div>
                <Progress value={state.progress} className="w-full" />
              </div>
            )}

            {state.status === 'success' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">{state.message}</p>
                {state.details && (
                  <div className="mt-2 text-xs text-green-700 space-y-1">
                    <p><strong>Template detectado:</strong> {state.details.template_detected}</p>
                    <p><strong>Registros importados:</strong> {state.details.records_imported}</p>
                    <p><strong>Registros com erro:</strong> {state.details.records_failed}</p>
                  </div>
                )}
              </div>
            )}

            {state.status === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{state.message}</p>
              </div>
            )}

            {state.status !== 'success' && (
              <Button
                onClick={handleUpload}
                disabled={state.isUploading}
                className="w-full"
              >
                {state.isUploading ? 'Enviando...' : 'Fazer Upload'}
              </Button>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Formato esperado:</p>
          {expectedFormat.map((format, index) => (
            <p key={index}>• {format}</p>
          ))}
          <p className="mt-1">• Tamanho máximo: {maxSizeInMB}MB</p>
        </div>
      </CardContent>
    </Card>
  );
}