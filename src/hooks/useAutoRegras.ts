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

  // Função para processar regras automaticamente (reutilizada por INSERT e UPDATE)
  const processarRegrasAutomaticas = async (uploadData: UploadStatus) => {
    // Verificar se é um arquivo que precisa de regras
    const arquivosComRegras = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao'
    ];

    if (arquivosComRegras.includes(uploadData.tipo_arquivo)) {
      console.log('⚡ Disparando aplicação automática de regras...');
      setProcessandoRegras(true);
      
      try {
        // Para arquivos retroativos, aplicar primeiro as regras v002/v003 (críticas)
        const arquivosRetroativos = ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'];
        
        if (arquivosRetroativos.includes(uploadData.tipo_arquivo)) {
          console.log('🔥 Aplicando regras v002/v003 (críticas) primeiro...');
          
          const { data: dataV002V003, error: errorV002V003 } = await supabase.functions.invoke('aplicar-regras-v002-v003-automatico', {
            body: {
              arquivo_fonte: uploadData.tipo_arquivo,
              upload_id: uploadData.id,
              arquivo_nome: uploadData.arquivo_nome,
              status: uploadData.status,
              total_registros: uploadData.registros_inseridos
            }
          });

          console.log('📥 Resposta v002/v003:', { dataV002V003, errorV002V003 });

          if (errorV002V003) {
            console.error('❌ Erro na aplicação v002/v003:', errorV002V003);
            toast.error(`Erro na aplicação das regras v002/v003: ${errorV002V003.message}`);
            return;
          }

          if (dataV002V003.success) {
            toast.success(`✅ Regras v002/v003 aplicadas! ${dataV002V003.detalhes_aplicacao?.registros_excluidos || 0} registros excluídos.`);
            console.log('✅ v002/v003 aplicadas com sucesso:', dataV002V003);
          } else {
            toast.warning(`⚠️ Falha na aplicação das regras v002/v003 para ${uploadData.tipo_arquivo}.`);
            console.log('⚠️ Falha v002/v003:', dataV002V003);
            return;
          }
        }

        // Aplicar demais regras se necessário (só se auto aplicar estiver ativo)
        if (autoAplicarAtivo) {
          console.log('📞 Chamando função automática para demais regras:', {
            arquivo_fonte: uploadData.tipo_arquivo,
            upload_id: uploadData.id,
            auto_aplicar: autoAplicarAtivo
          });

          const { data, error } = await supabase.functions.invoke('auto-aplicar-regras-pos-upload', {
            body: {
              arquivo_fonte: uploadData.tipo_arquivo,
              upload_id: uploadData.id,
              arquivo_nome: uploadData.arquivo_nome,
              status: uploadData.status,
              total_registros: uploadData.registros_inseridos,
              auto_aplicar: autoAplicarAtivo
            }
          });

          console.log('📥 Resposta demais regras:', { data, error });

          if (error) {
            console.error('❌ Erro na aplicação das demais regras:', error);
            toast.warning(`Regras v002/v003 aplicadas, mas falha nas demais regras: ${error.message}`);
            return;
          }

          if (data.success) {
            toast.success(`✅ Todas as regras aplicadas automaticamente para ${uploadData.tipo_arquivo}!`);
            console.log('✅ Todas as regras aplicadas:', data);
          } else {
            toast.warning(`⚠️ Algumas regras falharam para ${uploadData.tipo_arquivo}. v002/v003 foram aplicadas com sucesso.`);
            console.log('⚠️ Aplicação parcial das demais regras:', data);
          }
        }
      } catch (error: any) {
        console.error('💥 Erro inesperado:', error);
        toast.error(`Erro inesperado: ${error.message}`);
      } finally {
        setProcessandoRegras(false);
      }
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

  return {
    autoAplicarAtivo,
    processandoRegras,
    toggleAutoAplicar,
    aplicarRegrasManual,
    validarRegras
  };
}