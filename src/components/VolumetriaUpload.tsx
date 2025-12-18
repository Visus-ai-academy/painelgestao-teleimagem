import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useVolumetria } from '@/contexts/VolumetriaContext';
import { processVolumetriaFile, processVolumetriaOtimizado, VOLUMETRIA_UPLOAD_CONFIGS } from '@/lib/volumetriaUtils';
import { supabase } from '@/integrations/supabase/client';
import { ProcessarArquivoCompleto } from '@/components/ProcessarArquivoCompleto';

import { Upload, FileText, CheckCircle, Lock, Zap } from 'lucide-react';

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
  const [currentLoteUpload, setCurrentLoteUpload] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);
  const [showProcessarCompleto, setShowProcessarCompleto] = useState(false);
  const [isLimitedProcessing, setIsLimitedProcessing] = useState(false);
  const { toast } = useToast();
  const { refreshData } = useVolumetria();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // LOG CRÍTICO: Mostrar qual período está sendo usado
    console.log('========================================');
    console.log('🚨 UPLOAD INICIADO - VERIFICAÇÃO DE PERÍODO');
    console.log('📁 Arquivo:', file.name);
    console.log('📂 Tipo:', arquivoFonte);
    console.log('📅 PERÍODO RECEBIDO NO COMPONENTE:', periodoFaturamento);
    if (periodoFaturamento) {
      console.log(`📅 PERÍODO FORMATADO: ${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}`);
    } else {
      console.log('⚠️ ALERTA: periodoFaturamento está UNDEFINED ou NULL!');
    }
    console.log('========================================');

    // VALIDAÇÃO CRÍTICA: Verificar se o período está definido
    if (!periodoFaturamento || !periodoFaturamento.ano || !periodoFaturamento.mes) {
      toast({
        title: "Erro Crítico",
        description: "Período de faturamento não está definido. Por favor, selecione o período antes de fazer upload.",
        variant: "destructive"
      });
      return;
    }

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

    // Mostrar toast de confirmação com o período
    toast({
      title: "Upload Iniciado",
      description: `Processando para período: ${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][periodoFaturamento.mes - 1]}/${periodoFaturamento.ano}`,
    });

    setIsProcessing(true);
    setProgress(0);
    setStats(null);

    try {
      // Limpar uploads travados antes de iniciar novo processamento
      console.log('🧹 Verificando uploads travados...');
      try {
        const { data: cleanResult } = await supabase.functions.invoke('limpar-uploads-travados');
        console.log('✅ Resultado limpeza uploads:', cleanResult);
      } catch (cleanError) {
        console.warn('⚠️ Aviso na limpeza de uploads:', cleanError);
      }

      console.log(`🚀 Iniciando processamento para ${arquivoFonte}...`);
      
      // Gerar lote único para o upload
      const loteUpload = `${arquivoFonte}_${Date.now()}`;
      setCurrentLoteUpload(loteUpload);
      
      // SEMPRE usar processamento otimizado para garantir que todos os registros sejam processados
      const result = await processVolumetriaOtimizado(
        file,
        arquivoFonte,
        periodoFaturamento,
        (progressData) => {
          console.log('📊 Progresso recebido:', progressData);
          setProgress(progressData.progress);
          setStats({ 
            processed: progressData.processed, 
            total: progressData.total > 0 ? progressData.total : 100, // Garantir que total nunca seja 0
            inserted: progressData.processed 
          });
        }
      );

      if (result.success) {
        const insertedCount = result.stats?.inserted_count || 0;
        toast({
          title: "Upload concluído!",
          description: `${insertedCount} registros inseridos com sucesso.`,
        });
        
        // Atualizar automaticamente a "Análise dos Uploads Realizados" e "Exames Não Identificados"
        await refreshData();
        
        onSuccess?.();
      } else {
        toast({
          title: "Erro no processamento",
          description: result.message || "Erro desconhecido",
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
      setCurrentLoteUpload(null);
      // Reset input
      event.target.value = '';
    }
  };

  const config = VOLUMETRIA_UPLOAD_CONFIGS[arquivoFonte];

  // Formatação do período para exibição
  const periodoFormatado = periodoFaturamento 
    ? `${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][periodoFaturamento.mes - 1]}/${periodoFaturamento.ano}`
    : 'Não definido';

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{config.label}</h3>
            <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
          </div>
          {periodoFaturamento && (
            <div className="px-3 py-1.5 bg-green-100 border border-green-300 rounded-md">
              <p className="text-xs font-bold text-green-700">
                Período: {periodoFormatado}
              </p>
            </div>
          )}
        </div>
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
                  <span>Processando para {periodoFormatado}...</span>
                </p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivos Excel (.xlsx, .xls) • Período: <strong>{periodoFormatado}</strong>
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

      {/* Botão de Processamento Completo */}
      {lastUploadedFile && isLimitedProcessing && (
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Processamento Completo Disponível</h4>
              <p className="text-xs text-muted-foreground">
                Seu último arquivo foi limitado. Use o processamento completo para processar todos os registros.
              </p>
            </div>
            <Dialog open={showProcessarCompleto} onOpenChange={setShowProcessarCompleto}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Processamento Completo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Processamento Completo do Arquivo</DialogTitle>
                  <DialogDescription>
                    Processa o arquivo inteiro em batches pequenos para evitar timeouts.
                    Este processo pode levar alguns minutos dependendo do tamanho do arquivo.
                  </DialogDescription>
                </DialogHeader>
                <ProcessarArquivoCompleto
                  filePath={lastUploadedFile}
                  arquivoFonte={arquivoFonte}
                  totalEstimado={34000}
                  periodoFaturamento={periodoFaturamento}
                  onComplete={() => {
                    setShowProcessarCompleto(false);
                    setLastUploadedFile(null);
                    setIsLimitedProcessing(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

    </div>
  );
}