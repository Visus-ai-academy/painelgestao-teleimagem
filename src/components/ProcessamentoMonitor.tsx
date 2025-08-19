import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProcessamentoStatus {
  id: string;
  tipo_arquivo: string;
  status: string;
  registros_processados: number;
  registros_inseridos: number;
  registros_erro: number;
  created_at: string;
  detalhes_erro?: any;
  tempo_processamento?: unknown;
}

export function ProcessamentoMonitor() {
  const [uploads, setUploads] = useState<ProcessamentoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(false);
  const [validacoes, setValidacoes] = useState<Record<string, any>>({});

  const buscarUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .in('tipo_arquivo', [
          'volumetria_padrao', 
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo', 
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ])
        .in('status', ['processando', 'pendente', 'staging_concluido', 'concluido', 'erro'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setUploads(data || []);

      // Buscar validações para uploads concluídos
      for (const upload of data || []) {
        if (upload.status === 'concluido') {
          const { data: validacao } = await supabase
            .from('validacao_integridade')
            .select('*')
            .eq('upload_id', upload.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (validacao) {
            setValidacoes(prev => ({
              ...prev,
              [upload.id]: validacao
            }));
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar uploads:', error);
      toast.error('Erro ao carregar status de processamento');
    } finally {
      setLoading(false);
    }
  };

  const executarValidacao = async (uploadId: string, arquivoFonte: string) => {
    setMonitoring(true);
    try {
      toast.loading(`Validando integridade do upload ${arquivoFonte}...`, { id: 'validacao' });

      const { data, error } = await supabase.functions.invoke('validar-integridade-processamento', {
        body: { upload_id: uploadId, arquivo_fonte: arquivoFonte }
      });

      if (error) throw error;

      setValidacoes(prev => ({
        ...prev,
        [uploadId]: data
      }));

      toast.success(`Validação concluída: ${data.pontuacao_integridade}/100 pontos`, { 
        id: 'validacao',
        description: `Status: ${data.status_geral}`
      });

      if (data.requer_rollback) {
        toast.warning('Upload requer rollback devido a falhas de integridade', {
          description: 'Clique em "Executar Rollback" para reverter'
        });
      }

      await buscarUploads();
    } catch (error) {
      console.error('❌ Erro na validação:', error);
      toast.error('Erro na validação de integridade', { id: 'validacao' });
    } finally {
      setMonitoring(false);
    }
  };

  const executarRollback = async (uploadId: string, motivo: string = 'Rollback manual') => {
    setMonitoring(true);
    try {
      toast.loading('Executando rollback...', { id: 'rollback' });

      const { data, error } = await supabase.functions.invoke('executar-rollback-processamento', {
        body: { upload_id: uploadId, motivo, forcar_rollback: true }
      });

      if (error) throw error;

      toast.success(`Rollback executado: ${data.registros_removidos} registros removidos`, { 
        id: 'rollback' 
      });

      await buscarUploads();
    } catch (error) {
      console.error('❌ Erro no rollback:', error);
      toast.error('Erro ao executar rollback', { id: 'rollback' });
    } finally {
      setMonitoring(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro':
      case 'rollback_executado':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processando':
      case 'staging_concluido':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'bg-green-100 text-green-800';
      case 'erro':
      case 'rollback_executado':
        return 'bg-red-100 text-red-800';
      case 'processando':
      case 'staging_concluido':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const calcularProgresso = (upload: ProcessamentoStatus) => {
    if (upload.status === 'concluido') return 100;
    if (upload.status === 'erro') return 0;
    
    const total = upload.registros_processados || 1;
    const inseridos = upload.registros_inseridos || 0;
    return Math.min((inseridos / total) * 100, 99);
  };

  // Monitoramento em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('processamento_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads'
        },
        () => {
          console.log('📊 [MONITOR] Mudança detectada, atualizando...');
          buscarUploads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    buscarUploads();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monitor de Processamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monitor de Processamento</CardTitle>
        <Button onClick={buscarUploads} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {uploads.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhum processamento ativo encontrado
          </div>
        ) : (
          <div className="space-y-4">
            {uploads.map((upload) => {
              const validacao = validacoes[upload.id];
              const progresso = calcularProgresso(upload);

              return (
                <div key={upload.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(upload.status)}
                      <div>
                        <div className="font-medium text-sm">
                          {upload.tipo_arquivo.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(upload.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(upload.status)}>
                      {upload.status}
                    </Badge>
                  </div>

                  <Progress value={progresso} className="h-2" />

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-blue-600">
                        {upload.registros_processados}
                      </div>
                      <div className="text-muted-foreground">Processados</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-green-600">
                        {upload.registros_inseridos}
                      </div>
                      <div className="text-muted-foreground">Inseridos</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-600">
                        {upload.registros_erro}
                      </div>
                      <div className="text-muted-foreground">Erros</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-purple-600">
                        {typeof upload.tempo_processamento === 'string' ? upload.tempo_processamento : '-'}
                      </div>
                      <div className="text-muted-foreground">Tempo</div>
                    </div>
                  </div>

                  {validacao && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">Validação de Integridade</span>
                        <Badge className={
                          validacao.pontuacao_integridade >= 80 ? 'bg-green-100 text-green-800' :
                          validacao.pontuacao_integridade >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {validacao.pontuacao_integridade}/100
                        </Badge>
                      </div>
                      <Progress value={validacao.pontuacao_integridade} className="h-1 mb-2" />
                      {validacao.validacoes_falhadas?.length > 0 && (
                        <div className="text-xs text-red-600">
                          Falhas: {validacao.validacoes_falhadas.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {upload.status === 'concluido' && !validacao && (
                      <Button
                        onClick={() => executarValidacao(upload.id, upload.tipo_arquivo)}
                        disabled={monitoring}
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Validar
                      </Button>
                    )}
                    
                    {(upload.status === 'erro' || validacao?.requer_rollback) && (
                      <Button
                        onClick={() => executarRollback(upload.id)}
                        disabled={monitoring}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Zap className="mr-1 h-3 w-3" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}