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

  const aplicarRegrasManual = async (arquivoFonte: string, loteUpload?: string) => {
    setProcessandoRegras(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sistema-aplicacao-regras-completo', {
        body: {
          arquivo_fonte: arquivoFonte,
          upload_id: loteUpload,
          periodo_referencia: 'jun/25',
          forcar_aplicacao: true,
          validar_apenas: false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast.success(`✅ Regras aplicadas manualmente com sucesso para ${arquivoFonte}!`);
        return data;
      } else {
        toast.warning(`⚠️ Algumas regras falharam para ${arquivoFonte}`);
        return data;
      }
    } catch (error: any) {
      toast.error(`❌ Erro ao aplicar regras: ${error.message}`);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  const validarRegras = async (arquivoFonte: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sistema-aplicacao-regras-completo', {
        body: {
          arquivo_fonte: arquivoFonte,
          validar_apenas: true
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const regrasOk = data.regras_validadas_ok || 0;
      const totalRegras = data.total_regras || 0;
      
      if (regrasOk === totalRegras) {
        toast.success(`✅ Todas as ${totalRegras} regras estão OK para ${arquivoFonte}`);
      } else {
        toast.warning(`⚠️ ${totalRegras - regrasOk} de ${totalRegras} regras precisam de atenção`);
      }
      
      return data;
    } catch (error: any) {
      toast.error(`❌ Erro ao validar regras: ${error.message}`);
      throw error;
    }
  };

  const corrigirDadosExistentes = async () => {
    setProcessandoRegras(true);
    
    try {
      toast.info('⚡ Iniciando correção de dados existentes...');
      
      const { data, error } = await supabase.functions.invoke('corrigir-dados-existentes', {
        body: {}
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.sucesso) {
        const { arquivos_processados, total_correcoes } = data;
        toast.success(`✅ Correção concluída! ${arquivos_processados} arquivos, ${total_correcoes} correções aplicadas`);
        console.log('📋 Detalhes da correção:', data.detalhes_por_arquivo);
      } else {
        toast.error(`❌ Falha na correção: ${data.erro}`);
      }
      
      return data;
    } catch (error: any) {
      toast.error(`❌ Erro ao corrigir dados: ${error.message}`);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  // Executar correção automática uma única vez ao inicializar o sistema
  useEffect(() => {
    const executarCorrecaoUnicaVez = async () => {
      const jaExecutou = localStorage.getItem('correcao_regras_executada');
      if (!jaExecutou) {
        console.log('🔧 Executando correção única dos dados existentes...');
        try {
          await corrigirDadosExistentes();
          localStorage.setItem('correcao_regras_executada', 'true');
        } catch (error) {
          console.error('Erro na correção única:', error);
        }
      }
    };

    // Executar imediatamente ao carregar
    executarCorrecaoUnicaVez();
  }, []);

  return {
    autoAplicarAtivo,
    processandoRegras,
    toggleAutoAplicar,
    aplicarRegrasManual,
    validarRegras,
    corrigirDadosExistentes
  };
}