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

  // Monitorar uploads concluídos para aplicar regras automaticamente
  useEffect(() => {
    if (!autoAplicarAtivo) return;

    const channel = supabase
      .channel('uploads_concluded')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'status=eq.concluido'
        },
        async (payload) => {
          console.log('🔔 Upload concluído detectado:', payload);
          
          const uploadData = payload.new as UploadStatus;
          
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

              if (error) {
                console.error('❌ Erro na aplicação automática:', error);
                toast.error(`Erro na aplicação automática de regras: ${error.message}`);
                return;
              }

              if (data.success) {
                toast.success(`✅ Regras aplicadas automaticamente para ${uploadData.tipo_arquivo}!`);
                console.log('✅ Aplicação automática concluída:', data);
              } else {
                toast.warning(`⚠️ Algumas regras falharam para ${uploadData.tipo_arquivo}. Verifique o painel de controle.`);
                console.log('⚠️ Aplicação parcial:', data);
              }
            } catch (error: any) {
              console.error('💥 Erro inesperado:', error);
              toast.error(`Erro inesperado: ${error.message}`);
            } finally {
              setProcessandoRegras(false);
            }
          }
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