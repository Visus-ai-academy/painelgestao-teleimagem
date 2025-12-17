import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadStatus {
  id: string;
  arquivo_nome: string;
  tipo_arquivo: string;
  status: string;
  registros_inseridos: number;
  created_at: string;
  periodo_referencia?: string;
}

export function useAutoRegras() {
  const [autoAplicarAtivo, setAutoAplicarAtivo] = useState(true);
  const [processandoRegras, setProcessandoRegras] = useState(false);

  // Sistema coordenado: Trigger + Edge Functions
  const processarRegrasAutomaticas = async (uploadData: UploadStatus) => {
    console.log('🚀 Sistema coordenado ativo - Triggers aplicaram regras básicas');
    
    // Verificar se é um arquivo que precisa de regras avançadas
    const arquivosComRegras = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao'
    ];

    if (!arquivosComRegras.includes(uploadData.tipo_arquivo)) {
      console.log('📝 Arquivo não precisa de regras avançadas:', uploadData.tipo_arquivo);
      return;
    }

    console.log('⚡ Verificando fila de processamento avançado...');
    setProcessandoRegras(true);
    
    try {
      // Aguardar um pouco para os triggers processarem
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar se há itens na fila de processamento avançado
      const { data: filaItens, error: filaError } = await supabase
        .from('fila_processamento_avancado')
        .select('*')
        .eq('arquivo_fonte', uploadData.tipo_arquivo)
        .eq('status', 'pendente');

      if (filaError) {
        console.error('❌ Erro ao verificar fila:', filaError);
        toast.error(`Erro ao verificar fila: ${filaError.message}`);
        return;
      }

      console.log(`📋 Encontrados ${filaItens?.length || 0} itens na fila para processamento avançado`);

      if (!filaItens || filaItens.length === 0) {
        toast.success(`✅ Upload processado com sucesso! Regras básicas aplicadas via trigger.`);
        return;
      }

      // Processar regras avançadas via edge function
      console.log('🔧 Disparando processamento de regras avançadas...');
      
      const { data, error } = await supabase.functions.invoke('processar-regras-avancadas', {
        body: {
          arquivo_fonte: uploadData.tipo_arquivo,
          lote_upload: uploadData.arquivo_nome
        }
      });

      console.log('📥 Resposta regras avançadas:', { data, error });

      if (error) {
        console.error('❌ Erro no processamento avançado:', error);
        toast.warning(`Regras básicas aplicadas, mas falha nas regras avançadas: ${error.message}`);
        return;
      }

      if (data.sucesso) {
        const { processados, erros } = data;
        if (erros > 0) {
          toast.warning(`⚠️ Processamento parcial: ${processados} processados, ${erros} erros`);
        } else {
          toast.success(`✅ Todas as regras aplicadas! ${processados} registros processados.`);
        }
        console.log('✅ Processamento avançado concluído:', data);
      } else {
        toast.warning(`⚠️ Falha no processamento avançado para ${uploadData.tipo_arquivo}`);
        console.log('⚠️ Falha no processamento avançado:', data);
      }

    } catch (error: any) {
      console.error('💥 Erro inesperado no sistema coordenado:', error);
      toast.error(`Erro inesperado: ${error.message}`);
    } finally {
      setProcessandoRegras(false);
    }
  };

  // Monitorar uploads concluídos para aplicar regras automaticamente
  useEffect(() => {
    if (!autoAplicarAtivo) return;

    const channel = supabase
      .channel('uploads_concluded')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'status=eq.concluido'
        },
        async (payload) => {
          console.log('🔔 Upload concluído detectado (INSERT):', payload);
          await processarRegrasAutomaticas(payload.new as UploadStatus);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'status=eq.concluido'
        },
        async (payload) => {
          console.log('🔔 Upload concluído detectado (UPDATE):', payload);
          await processarRegrasAutomaticas(payload.new as UploadStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoAplicarAtivo]);

  const toggleAutoAplicar = (ativo: boolean) => {
    setAutoAplicarAtivo(ativo);
    
    if (ativo) {
      toast.success('✅ Aplicação automática de regras habilitada');
    } else {
      toast.info('⏸️ Aplicação automática de regras pausada');
    }
  };

  const aplicarRegrasManual = async (arquivoFonte: string, loteUpload?: string, periodoReferencia?: string) => {
    // CRÍTICO: Período é obrigatório - não processar sem período definido
    if (!periodoReferencia) {
      toast.error('⚠️ Período de referência não especificado. Selecione um período antes de processar.');
      console.error('❌ Tentativa de aplicar regras sem período definido');
      return null;
    }
    
    setProcessandoRegras(true);
    
    try {
      console.log(`🚀 Aplicando TODAS as 27 regras manualmente para período ${periodoReferencia}...`);
      
      const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
        body: {
          arquivo_fonte: arquivoFonte,
          periodo_referencia: periodoReferencia,
          aplicar_todos_arquivos: false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        const totalCorrigidos = data.total_corrigidos || 0;
        const totalProcessados = data.total_processados || 0;
        toast.success(`✅ Regras aplicadas! ${totalCorrigidos} correções em ${totalProcessados} registros`);
        return data;
      } else {
        toast.warning(`⚠️ Algumas regras falharam: ${data.erro}`);
        return data;
      }
    } catch (error: any) {
      toast.error(`❌ Erro ao aplicar regras: ${error.message}`);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  const validarRegras = async (arquivoFonte: string, periodoReferencia?: string) => {
    // CRÍTICO: Período é obrigatório
    if (!periodoReferencia) {
      console.error('❌ Tentativa de validar regras sem período definido');
      return null;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
        body: {
          arquivo_fonte: arquivoFonte,
          periodo_referencia: periodoReferencia,
          aplicar_todos_arquivos: false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const totalProcessados = data.total_processados || 0;
      const totalCorrigidos = data.total_corrigidos || 0;
      
      toast.success(`✅ Validação concluída: ${totalProcessados} registros, ${totalCorrigidos} correções necessárias`);
      
      return data;
    } catch (error: any) {
      toast.error(`❌ Erro ao validar regras: ${error.message}`);
      throw error;
    }
  };

  const corrigirTodosDadosExistentes = async (periodoReferencia?: string) => {
    // CRÍTICO: Período é obrigatório - não processar sem período definido
    if (!periodoReferencia) {
      toast.error('⚠️ Período de referência não especificado. Selecione um período antes de processar.');
      console.error('❌ Tentativa de aplicar regras sem período definido');
      return null;
    }
    
    setProcessandoRegras(true);
    
    try {
      toast.info(`🚀 Aplicando TODAS as 27 regras em TODOS os dados para período ${periodoReferencia}...`);
      console.log(`🚀 Executando aplicação completa das 27 regras nos dados existentes (período: ${periodoReferencia})...`);
      
      const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
        body: {
          arquivo_fonte: null,
          periodo_referencia: periodoReferencia,
          aplicar_todos_arquivos: true
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        const totalCorrigidos = data.total_corrigidos || 0;
        const totalProcessados = data.total_processados || 0;
        toast.success(`✅ TODAS as 27 regras aplicadas! ${totalCorrigidos} correções em ${totalProcessados} registros`);
        console.log('📋 Detalhes da aplicação das 27 regras:', data);
      } else {
        toast.error(`❌ Falha na aplicação das regras: ${data.erro}`);
      }
      
      return data;
    } catch (error: any) {
      toast.error(`❌ Erro ao corrigir todos os dados: ${error.message}`);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  return {
    autoAplicarAtivo,
    processandoRegras,
    toggleAutoAplicar,
    aplicarRegrasManual,
    validarRegras,
    corrigirTodosDadosExistentes
  };
}
