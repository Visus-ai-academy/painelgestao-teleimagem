import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para garantir consistência do período ativo durante uploads
 * Bloqueia mudanças de período enquanto há uploads em processamento
 */
export function usePeriodoIntegrityLock() {
  const [periodoAtivo, setPeriodoAtivo] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [uploadsAtivos, setUploadsAtivos] = useState(0);
  const [loading, setLoading] = useState(true);

  const verificarUploadsAtivos = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('processamento_uploads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['processando', 'pendente', 'staging_concluido'])
        .in('tipo_arquivo', [
          'volumetria_padrao', 
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo', 
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ]);

      if (error) throw error;
      
      const activeCount = count || 0;
      setUploadsAtivos(activeCount);
      setBloqueado(activeCount > 0);
      
      console.log(`🔒 [INTEGRITY] ${activeCount} uploads ativos, bloqueio: ${activeCount > 0}`);
      
      return activeCount;
    } catch (error) {
      console.error('❌ Erro ao verificar uploads ativos:', error);
      return 0;
    }
  }, []);

  const buscarPeriodoAtivo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('periodo_referencia_ativo')
        .select('periodo_referencia')
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      
      const periodo = data?.periodo_referencia || null;
      setPeriodoAtivo(periodo);
      
      console.log(`🔒 [INTEGRITY] Período ativo atual: ${periodo}`);
      
      return periodo;
    } catch (error) {
      console.error('❌ Erro ao buscar período ativo:', error);
      return null;
    }
  }, []);

  const atualizarPeriodoAtivo = useCallback(async (novoPeriodo: string) => {
    if (bloqueado) {
      throw new Error(`Não é possível alterar o período enquanto há ${uploadsAtivos} uploads em processamento`);
    }

    try {
      console.log(`🔒 [INTEGRITY] Atualizando período para: ${novoPeriodo}`);
      
      // Desativar período atual
      await supabase
        .from('periodo_referencia_ativo')
        .update({ ativo: false })
        .eq('ativo', true);

      // Ativar novo período (calcular datas baseadas no período)
      const [mesAbrev, anoAbrev] = novoPeriodo.split('/');
      const meses = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      
      const ano = 2000 + parseInt(anoAbrev);
      const mes = meses[mesAbrev as keyof typeof meses];
      
      // Calcular período: do dia 8 do mês anterior ao dia 7 do mês atual
      const dataInicio = new Date(ano, mes - 1, 8);
      const dataFim = new Date(ano, mes, 7);

      const { error } = await supabase
        .from('periodo_referencia_ativo')
        .upsert({
          periodo_referencia: novoPeriodo,
          ativo: true,
          data_inicio: dataInicio.toISOString().split('T')[0],
          data_fim: dataFim.toISOString().split('T')[0],
          descricao: `Período ativo: ${novoPeriodo}`,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'periodo_referencia'
        });

      if (error) throw error;

      setPeriodoAtivo(novoPeriodo);
      
      console.log(`✅ [INTEGRITY] Período atualizado para: ${novoPeriodo}`);
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar período:', error);
      throw error;
    }
  }, [bloqueado, uploadsAtivos]);

  const inicializar = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        buscarPeriodoAtivo(),
        verificarUploadsAtivos()
      ]);
    } finally {
      setLoading(false);
    }
  }, [buscarPeriodoAtivo, verificarUploadsAtivos]);

  // Monitorar mudanças em uploads
  useEffect(() => {
    const channel = supabase
      .channel('integrity_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'tipo_arquivo=in.(volumetria_padrao,volumetria_fora_padrao,volumetria_padrao_retroativo,volumetria_fora_padrao_retroativo,volumetria_onco_padrao)'
        },
        () => {
          console.log('🔒 [INTEGRITY] Mudança detectada, verificando uploads...');
          verificarUploadsAtivos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [verificarUploadsAtivos]);

  // Carregar dados iniciais
  useEffect(() => {
    inicializar();
  }, [inicializar]);

  return {
    periodoAtivo,
    bloqueado,
    uploadsAtivos,
    loading,
    atualizarPeriodoAtivo,
    verificarUploadsAtivos,
    refresh: inicializar
  };
}