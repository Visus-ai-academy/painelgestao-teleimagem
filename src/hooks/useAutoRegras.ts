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

interface ResultadoRegras {
  success: boolean;
  total_processados: number;
  total_corrigidos: number;
  status_regras?: any[];
  erro?: string;
}

// Configurações de retry
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function useAutoRegras() {
  const [autoAplicarAtivo, setAutoAplicarAtivo] = useState(true);
  const [processandoRegras, setProcessandoRegras] = useState(false);
  const [tentativaAtual, setTentativaAtual] = useState(0);

  // Função auxiliar para delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Função auxiliar para verificar sessão e renovar se necessário
  const garantirSessaoValida = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('❌ Sessão não encontrada:', error?.message);
      return null;
    }

    // Verificar se o token está próximo de expirar (menos de 5 minutos)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const agora = Date.now();
    const cincoMinutos = 5 * 60 * 1000;
    
    if (expiresAt - agora < cincoMinutos) {
      console.log('🔄 Token próximo de expirar, renovando...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('❌ Falha ao renovar sessão:', refreshError?.message);
        return null;
      }
      
      console.log('✅ Sessão renovada com sucesso');
      return refreshData.session.access_token;
    }

    return session.access_token;
  };

  // Função principal com retry automático
  const executarComRetry = async (
    operacao: () => Promise<ResultadoRegras>,
    nomeOperacao: string
  ): Promise<ResultadoRegras> => {
    let ultimoErro: Error | null = null;

    for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
      setTentativaAtual(tentativa);
      
      try {
        console.log(`🔄 ${nomeOperacao} - Tentativa ${tentativa}/${MAX_RETRIES}`);
        
        // Garantir sessão válida antes de cada tentativa
        const token = await garantirSessaoValida();
        if (!token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        const resultado = await operacao();
        
        if (resultado.success) {
          console.log(`✅ ${nomeOperacao} - Sucesso na tentativa ${tentativa}`);
          setTentativaAtual(0);
          return resultado;
        } else {
          throw new Error(resultado.erro || 'Falha na operação');
        }
      } catch (error: any) {
        ultimoErro = error;
        console.error(`❌ ${nomeOperacao} - Falha na tentativa ${tentativa}:`, error.message);

        // Se for erro de autenticação, não tentar novamente
        if (error.message?.includes('Sessão expirada') || 
            error.message?.includes('401') || 
            error.message?.includes('Unauthorized')) {
          break;
        }

        // Aguardar antes de tentar novamente
        if (tentativa < MAX_RETRIES) {
          const delayTime = RETRY_DELAY_MS * tentativa; // Backoff exponencial
          console.log(`⏳ Aguardando ${delayTime}ms antes da próxima tentativa...`);
          toast.info(`Tentativa ${tentativa} falhou. Retentando em ${delayTime/1000}s...`);
          await delay(delayTime);
        }
      }
    }

    setTentativaAtual(0);
    throw ultimoErro || new Error('Todas as tentativas falharam');
  };

  // Função para validar se as regras foram aplicadas corretamente
  const validarAplicacaoRegras = async (periodoReferencia: string): Promise<{valido: boolean; problemas: string[]}> => {
    const problemas: string[] = [];

    try {
      // Verificar registros com especialidades inválidas
      const { data: especialidadesInvalidas, error: err1 } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "ESPECIALIDADE"')
        .eq('periodo_referencia', periodoReferencia)
        .in('ESPECIALIDADE', ['COLUNAS', 'RX', 'CT', 'ONCO MEDICINA INTERNA']);
      
      if (err1) throw err1;
      
      if (especialidadesInvalidas && especialidadesInvalidas.length > 0) {
        problemas.push(`${especialidadesInvalidas.length} registros com especialidades não normalizadas (COLUNAS, RX, CT, etc.)`);
      }

      // Verificar registros MG com MAMA (deveria ser MAMO)
      const { data: mamaMgInvalidos, error: err2 } = await supabase
        .from('volumetria_mobilemed')
        .select('id')
        .eq('periodo_referencia', periodoReferencia)
        .eq('MODALIDADE', 'MG')
        .eq('ESPECIALIDADE', 'MAMA');
      
      if (err2) throw err2;
      
      if (mamaMgInvalidos && mamaMgInvalidos.length > 0) {
        problemas.push(`${mamaMgInvalidos.length} registros MG com MAMA (deveria ser MAMO)`);
      }

      // Verificar registros CT/MR + MEDICINA INTERNA + CABEÇA/PESCOÇO (deveria ser NEURO)
      const { data: neuroInvalidos, error: err3 } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "CATEGORIA"')
        .eq('periodo_referencia', periodoReferencia)
        .in('MODALIDADE', ['CT', 'MR'])
        .eq('ESPECIALIDADE', 'MEDICINA INTERNA');
      
      if (err3) throw err3;
      
      if (neuroInvalidos) {
        const neuroProblemas = neuroInvalidos.filter((r: any) => {
          const cat = (r.CATEGORIA || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return cat.includes('CABEC') || cat.includes('PESCO');
        });
        
        if (neuroProblemas.length > 0) {
          problemas.push(`${neuroProblemas.length} registros CT/MR com CABEÇA/PESCOÇO que deveriam ter NEURO`);
        }
      }

      // Verificar modalidades não normalizadas
      const { data: modalidadesInvalidas, error: err4 } = await supabase
        .from('volumetria_mobilemed')
        .select('id')
        .eq('periodo_referencia', periodoReferencia)
        .in('MODALIDADE', ['BMD', 'CR', 'DX']);
      
      if (err4) throw err4;
      
      if (modalidadesInvalidas && modalidadesInvalidas.length > 0) {
        problemas.push(`${modalidadesInvalidas.length} registros com modalidades não normalizadas (BMD, CR, DX)`);
      }

      return {
        valido: problemas.length === 0,
        problemas
      };
    } catch (error: any) {
      console.error('❌ Erro ao validar aplicação das regras:', error);
      return {
        valido: false,
        problemas: [`Erro na validação: ${error.message}`]
      };
    }
  };

  // Sistema coordenado: Trigger + Edge Functions
  const processarRegrasAutomaticas = async (uploadData: UploadStatus) => {
    console.log('🚀 Sistema coordenado ativo - Triggers aplicaram regras básicas');
    
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
      await delay(2000);

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
    if (!periodoReferencia) {
      toast.error('⚠️ Período de referência não especificado. Selecione um período antes de processar.');
      console.error('❌ Tentativa de aplicar regras sem período definido');
      return null;
    }
    
    setProcessandoRegras(true);
    
    try {
      console.log(`🚀 Aplicando TODAS as 28 regras manualmente para período ${periodoReferencia}...`);
      
      const resultado = await executarComRetry(async () => {
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

        return data as ResultadoRegras;
      }, 'Aplicar Regras Manual');

      const totalCorrigidos = resultado.total_corrigidos || 0;
      const totalProcessados = resultado.total_processados || 0;
      toast.success(`✅ Regras aplicadas! ${totalCorrigidos} correções em ${totalProcessados} registros`);
      return resultado;
      
    } catch (error: any) {
      const mensagem = error.message || 'Erro desconhecido';
      
      if (mensagem.includes('Sessão expirada')) {
        toast.error('🔐 Sessão expirada. Faça login novamente para aplicar as regras.', { duration: 8000 });
      } else {
        toast.error(`❌ Erro ao aplicar regras após ${MAX_RETRIES} tentativas: ${mensagem}`, { duration: 8000 });
      }
      
      console.error('❌ Erro completo:', error);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  const validarRegras = async (arquivoFonte: string, periodoReferencia?: string) => {
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
    if (!periodoReferencia) {
      toast.error('⚠️ Período de referência não especificado. Selecione um período antes de processar.');
      console.error('❌ Tentativa de aplicar regras sem período definido');
      return null;
    }
    
    setProcessandoRegras(true);
    
    try {
      toast.info(`🚀 Aplicando TODAS as 28 regras em TODOS os dados (${periodoReferencia})...`, { duration: 5000 });
      console.log(`🚀 Executando aplicação completa das 28 regras (período: ${periodoReferencia})...`);
      
      // Executar com retry automático
      const resultado = await executarComRetry(async () => {
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

        return data as ResultadoRegras;
      }, 'Aplicar 28 Regras Completas');

      const totalCorrigidos = resultado.total_corrigidos || 0;
      const totalProcessados = resultado.total_processados || 0;

      // Validar se as regras foram realmente aplicadas
      console.log('🔍 Validando se as regras foram aplicadas corretamente...');
      const validacao = await validarAplicacaoRegras(periodoReferencia);

      if (!validacao.valido) {
        console.warn('⚠️ Problemas detectados após aplicação:', validacao.problemas);
        
        // Tentar aplicar novamente se houver problemas
        console.log('🔄 Reaplicando regras para corrigir problemas...');
        
        const resultadoReaplicacao = await executarComRetry(async () => {
          const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
            body: {
              arquivo_fonte: null,
              periodo_referencia: periodoReferencia,
              aplicar_todos_arquivos: true
            }
          });

          if (error) throw new Error(error.message);
          return data as ResultadoRegras;
        }, 'Reaplicação de Regras');

        // Validar novamente
        const validacaoFinal = await validarAplicacaoRegras(periodoReferencia);
        
        if (!validacaoFinal.valido) {
          toast.warning(
            `⚠️ Regras aplicadas com ${totalCorrigidos + resultadoReaplicacao.total_corrigidos} correções, mas ainda existem ${validacaoFinal.problemas.length} problemas pendentes.`,
            { duration: 10000 }
          );
          console.error('❌ Problemas persistentes:', validacaoFinal.problemas);
        } else {
          toast.success(
            `✅ TODAS as 28 regras aplicadas e validadas! ${totalCorrigidos + resultadoReaplicacao.total_corrigidos} correções totais.`,
            { duration: 5000 }
          );
        }
        
        return { ...resultadoReaplicacao, validacao: validacaoFinal };
      }

      toast.success(
        `✅ TODAS as 28 regras aplicadas e validadas! ${totalCorrigidos} correções em ${totalProcessados} registros`,
        { duration: 5000 }
      );
      console.log('📋 Aplicação validada com sucesso. Detalhes:', resultado);
      
      return { ...resultado, validacao };
      
    } catch (error: any) {
      const mensagem = error.message || 'Erro desconhecido';
      
      if (mensagem.includes('Sessão expirada')) {
        toast.error('🔐 Sessão expirada. Faça login novamente para aplicar as regras.', { duration: 8000 });
      } else {
        toast.error(`❌ Erro ao aplicar as 28 regras após ${MAX_RETRIES} tentativas: ${mensagem}`, { duration: 10000 });
      }
      
      console.error('❌ Erro completo:', error);
      throw error;
    } finally {
      setProcessandoRegras(false);
    }
  };

  return {
    autoAplicarAtivo,
    processandoRegras,
    tentativaAtual,
    toggleAutoAplicar,
    aplicarRegrasManual,
    validarRegras,
    corrigirTodosDadosExistentes,
    validarAplicacaoRegras
  };
}
