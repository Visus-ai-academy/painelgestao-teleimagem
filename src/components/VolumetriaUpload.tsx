import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useVolumetria } from '@/contexts/VolumetriaContext';
import { VOLUMETRIA_UPLOAD_CONFIGS } from '@/lib/volumetriaUtils';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, CheckCircle, Lock } from 'lucide-react';

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
  const { refreshData } = useVolumetria();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação básica
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!['.xlsx', '.xls'].includes(fileExtension)) {
      toast({
        title: "Erro",
        description: "Apenas arquivos Excel (.xlsx, .xls) são aceitos",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStats(null);

    try {
      console.log(`🚀 Iniciando UPLOAD para ${arquivoFonte} - COM REGRAS APLICADAS`);
      
      // 1. UPLOAD DO ARQUIVO PARA STORAGE
      setProgress(10);
      const fileName = `${arquivoFonte}_${Date.now()}.xlsx`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      console.log('✅ Arquivo enviado para storage:', fileName);
      setProgress(30);
      
      // 2. PROCESSAMENTO COMPLETO COM REGRAS
      console.log('🔧 Iniciando processamento com regras...');
      setProgress(50);
      
      // Converter período selecionado para formato brasileiro  
      const periodoReferencia = periodoFaturamento ? 
        `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][periodoFaturamento.mes-1]}/${periodoFaturamento.ano.toString().slice(-2)}` :
        'jun/25'; // fallback
      
      const result = await supabase.functions.invoke('processar-excel-com-regras', {
        body: {
          file_path: fileName,
          arquivo_fonte: arquivoFonte,
          periodo_referencia: periodoReferencia
        }
      });

      setProgress(80);

      if (result.error) {
        console.error('❌ Erro na função:', result.error);
        toast({
          title: "Erro no processamento",
          description: result.error.message || "Erro desconhecido",
          variant: "destructive"
        });
        return;
      }

      const data = result.data;
      
      if (data?.success) {
        const insertedCount = data.stats?.inserted_count || 0;
        console.log('🎯 Upload completo finalizado:', {
          insertedCount,
          totalProcessed: data.stats?.total_rows,
          errors: data.stats?.error_count,
          regrasAplicadas: data.stats?.regras_aplicadas
        });
        
        setProgress(100);
        
        toast({
          title: "Upload concluído com regras aplicadas!",
          description: `${insertedCount} registros inseridos. ${data.stats?.regras_aplicadas || 0} regras aplicadas automaticamente.`,
        });
        
        // Atualizar dados
        await refreshData();
        onSuccess?.();
        
      } else {
        console.error('❌ Falha no processamento:', data);
        toast({
          title: "Erro no processamento",
          description: data?.error || data?.message || "Erro desconhecido no processamento", 
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('💥 Erro crítico:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar arquivo",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
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
                  Arquivos Excel (.xlsx, .xls) - COM REGRAS APLICADAS
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