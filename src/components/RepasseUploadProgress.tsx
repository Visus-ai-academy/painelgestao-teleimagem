import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface RepasseUploadProgressProps {
  uploadId: string | null;
  onComplete?: () => void;
}

export function RepasseUploadProgress({ uploadId, onComplete }: RepasseUploadProgressProps) {
  const [status, setStatus] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!uploadId) return;

    // Polling a cada 2 segundos
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (error) {
        console.error('Erro ao buscar status:', error);
        return;
      }

      if (data) {
        setStatus(data);
        
        // Calcular progresso
        if (data.registros_processados && data.registros_processados > 0) {
          const detalhes = data.detalhes_erro as any;
          const totalEstimado = detalhes?.total_linhas || data.registros_processados;
          const percentual = Math.min(100, Math.round((data.registros_processados / totalEstimado) * 100));
          setProgress(percentual);
        }

        // Se concluído, parar polling
        if (data.status === 'concluido' || data.status === 'erro') {
          clearInterval(interval);
          if (onComplete) {
            setTimeout(onComplete, 1000);
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploadId, onComplete]);

  if (!uploadId || !status) return null;

  const isProcessing = status.status === 'processando';
  const isComplete = status.status === 'concluido';
  const hasError = status.status === 'erro';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isComplete && <CheckCircle2 className="h-5 w-5 text-success" />}
          {hasError && <AlertCircle className="h-5 w-5 text-destructive" />}
          
          {isProcessing && 'Processando Repasse Médico...'}
          {isComplete && 'Upload Concluído'}
          {hasError && 'Erro no Processamento'}
        </CardTitle>
        <CardDescription>
          {status.arquivo_nome}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold text-primary">
              {status.registros_processados || 0}
            </p>
            <p className="text-xs text-muted-foreground">Processados</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-success">
              {status.registros_inseridos || 0}
            </p>
            <p className="text-xs text-muted-foreground">Inseridos</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-warning">
              {status.registros_atualizados || 0}
            </p>
            <p className="text-xs text-muted-foreground">Atualizados</p>
          </div>
        </div>

        {status.registros_erro > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
            <p className="text-sm font-medium text-destructive">
              {status.registros_erro} registro(s) com erro
            </p>
            {status.detalhes_erro && Array.isArray(status.detalhes_erro) && status.detalhes_erro.length > 0 && (
              <div className="mt-2 space-y-1">
                {status.detalhes_erro.slice(0, 3).map((erro: any, idx: number) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    Linha {erro.linha}: {erro.erro}
                  </p>
                ))}
                {status.detalhes_erro.length > 3 && (
                  <p className="text-xs text-muted-foreground italic">
                    ... e mais {status.detalhes_erro.length - 3} erro(s)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isComplete && (
          <div className="mt-4 p-3 bg-success/10 rounded-lg">
            <p className="text-sm font-medium text-success">
              ✓ Processamento concluído com sucesso!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}