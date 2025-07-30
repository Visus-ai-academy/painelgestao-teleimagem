import { useState, useEffect } from 'react';
import { Speedometer } from '@/components/Speedometer';
import { useUploadStatus } from '@/hooks/useUploadStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Database } from 'lucide-react';

interface ProcessingSpeedometerProps {
  fileType?: string | string[];
  onReadyToGenerate?: (isReady: boolean) => void;
}

export function ProcessingSpeedometer({ 
  fileType = 'faturamento',
  onReadyToGenerate 
}: ProcessingSpeedometerProps) {
  const { status, refresh } = useUploadStatus(fileType);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Considerar pronto quando não há uploads processando E há registros processados
    const ready = !status.isProcessing && status.totalRecordsProcessed > 0;
    setIsReady(ready);
    
    if (onReadyToGenerate) {
      onReadyToGenerate(ready);
    }
  }, [status, onReadyToGenerate]);

  const getStatusColor = () => {
    if (status.isProcessing) return 'orange';
    if (status.totalRecordsProcessed > 0) return 'green';
    return 'gray';
  };

  const getStatusMessage = () => {
    if (status.isProcessing) {
      return `Processando ${status.processingUploads} arquivo(s)...`;
    }
    if (status.totalRecordsProcessed > 0) {
      return 'Pronto para gerar relatórios!';
    }
    if (status.totalUploads === 0) {
      return 'Nenhum upload realizado';
    }
    return 'Aguardando processamento...';
  };

  const getStatusIcon = () => {
    if (status.isProcessing) return <Clock className="h-4 w-4" />;
    if (status.totalRecordsProcessed > 0) return <CheckCircle className="h-4 w-4" />;
    if (status.errorUploads > 0) return <AlertCircle className="h-4 w-4" />;
    return <Database className="h-4 w-4" />;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          Status do Processamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Velocímetro principal */}
        <div className="flex justify-center">
          <Speedometer
            value={status.progressPercentage}
            max={100}
            label={getStatusMessage()}
            unit="%"
            colorThresholds={{
              low: { threshold: 30, color: "#ef4444" },
              medium: { threshold: 70, color: "#f59e0b" },
              high: { threshold: 100, color: "#10b981" }
            }}
          />
        </div>

        {/* Badges de status */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant={status.completedUploads > 0 ? "default" : "secondary"}>
            ✅ Concluídos: {status.completedUploads}
          </Badge>
          
          {status.processingUploads > 0 && (
            <Badge variant="outline" className="animate-pulse">
              ⏳ Processando: {status.processingUploads}
            </Badge>
          )}
          
          {status.errorUploads > 0 && (
            <Badge variant="destructive">
              ❌ Erros: {status.errorUploads}
            </Badge>
          )}
        </div>

        {/* Informações detalhadas */}
        <div className="text-center space-y-1">
          <div className="text-sm text-muted-foreground">
            <strong>{status.totalRecordsProcessed.toLocaleString()}</strong> registros processados
          </div>
          
          {status.lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Última atualização: {new Date(status.lastUpdate).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Indicador visual de prontidão */}
        <div className={`p-3 rounded-lg text-center transition-all duration-300 ${
          isReady 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : status.isProcessing
            ? 'bg-orange-50 border border-orange-200 text-orange-800'
            : 'bg-gray-50 border border-gray-200 text-gray-600'
        }`}>
          <div className="font-medium">
            {isReady ? '🎯 Sistema pronto!' : status.isProcessing ? '⏳ Aguarde...' : '⚠️ Faça o upload'}
          </div>
          <div className="text-sm mt-1">
            {isReady 
              ? 'Você pode gerar os relatórios agora!' 
              : status.isProcessing 
              ? 'O processamento está em andamento'
              : 'Faça o upload do arquivo de faturamento'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}