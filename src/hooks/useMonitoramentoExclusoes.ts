import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface RegistroExcluido {
  id: string;
  arquivo_fonte: string;
  lote_upload: string;
  linha_original: number;
  dados_originais: any;
  motivo_rejeicao: string;
  detalhes_erro: string;
  created_at: string;
}

interface StatusMonitoramento {
  total_excluidos: number;
  por_motivo: { [key: string]: number };
  registros_recentes: RegistroExcluido[];
  ultimo_lote?: string;
  total_inseridos: number;
  taxa_exclusao: number;
}

export function useMonitoramentoExclusoes(loteUpload?: string) {
  const [status, setStatus] = useState<StatusMonitoramento>({
    total_excluidos: 0,
    por_motivo: {},
    registros_recentes: [],
    total_inseridos: 0,
    taxa_exclusao: 0
  });
  const [loading, setLoading] = useState(false);

  const atualizarStatus = useCallback(async () => {
    try {
      setLoading(true);

      // Query base para exclusões
      let query = supabase
        .from('registros_rejeitados_processamento')
        .select('*');

      // Filtrar por lote se especificado
      if (loteUpload) {
        query = query.eq('lote_upload', loteUpload);
      }

      // Buscar exclusões recentes (últimas 24h se não há lote específico)
      if (!loteUpload) {
        const dataLimite = new Date();
        dataLimite.setHours(dataLimite.getHours() - 24);
        query = query.gte('created_at', dataLimite.toISOString());
      }

      const { data: exclusoes, error: errorExclusoes } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (errorExclusoes) {
        throw errorExclusoes;
      }

      // Contar inserções bem-sucedidas no mesmo período/lote
      let queryInseridos = supabase
        .from('volumetria_mobilemed')
        .select('id', { count: 'exact', head: true });

      if (loteUpload) {
        queryInseridos = queryInseridos.eq('lote_upload', loteUpload);
      } else {
        const dataLimite = new Date();
        dataLimite.setHours(dataLimite.getHours() - 24);
        queryInseridos = queryInseridos.gte('created_at', dataLimite.toISOString());
      }

      const { count: totalInseridos, error: errorInseridos } = await queryInseridos;

      if (errorInseridos) {
        throw errorInseridos;
      }

      // Processar dados
      const exclusoesData = exclusoes || [];
      const totalExcluidos = exclusoesData.length;
      const totalInseridosNum = totalInseridos || 0;
      const totalProcessados = totalExcluidos + totalInseridosNum;
      const taxaExclusao = totalProcessados > 0 ? (totalExcluidos / totalProcessados) * 100 : 0;

      // Agrupar por motivo
      const porMotivo: { [key: string]: number } = {};
      exclusoesData.forEach(registro => {
        const motivo = registro.motivo_rejeicao || 'MOTIVO_DESCONHECIDO';
        porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
      });

      // Obter último lote processado
      const ultimoLote = exclusoesData.length > 0 ? exclusoesData[0].lote_upload : undefined;

      setStatus({
        total_excluidos: totalExcluidos,
        por_motivo: porMotivo,
        registros_recentes: exclusoesData.slice(0, 20), // Top 20 mais recentes
        ultimo_lote: ultimoLote,
        total_inseridos: totalInseridosNum,
        taxa_exclusao: Math.round(taxaExclusao * 100) / 100
      });

    } catch (error) {
      console.error('Erro ao atualizar status de exclusões:', error);
      toast.error('Erro ao carregar dados de exclusões');
    } finally {
      setLoading(false);
    }
  }, [loteUpload]);

  // Configurar monitoramento em tempo real
  useEffect(() => {
    atualizarStatus();

    // Subscription para novos registros excluídos
    const subscription = supabase
      .channel('exclusoes-monitoring')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'registros_rejeitados_processamento'
        },
        (payload) => {
          console.log('Nova exclusão detectada:', payload.new);
          // Atualizar status após nova exclusão
          setTimeout(atualizarStatus, 1000);
        }
      )
      .subscribe();

    // Atualizar a cada 10 segundos durante processamento ativo
    const interval = setInterval(atualizarStatus, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [atualizarStatus]);

  const exportarExclusoes = useCallback(async () => {
    try {
      // Buscar todas as exclusões para exportação
      let query = supabase
        .from('registros_rejeitados_processamento')
        .select('*');

      if (loteUpload) {
        query = query.eq('lote_upload', loteUpload);
      } else {
        const dataLimite = new Date();
        dataLimite.setHours(dataLimite.getHours() - 24);
        query = query.gte('created_at', dataLimite.toISOString());
      }

      const { data: exclusoes, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!exclusoes || exclusoes.length === 0) {
        toast.warning('Nenhuma exclusão encontrada para exportar');
        return;
      }

      // Preparar dados para Excel
      const dadosExcel = exclusoes.map(registro => {
        const dadosOriginais = registro.dados_originais as any || {};
        return {
          'ID': registro.id,
          'Arquivo Fonte': registro.arquivo_fonte,
          'Lote Upload': registro.lote_upload,
          'Linha Original': registro.linha_original,
          'Motivo Exclusão': registro.motivo_rejeicao,
          'Detalhes Erro': registro.detalhes_erro,
          'Data Exclusão': new Date(registro.created_at).toLocaleString('pt-BR'),
          'Empresa': dadosOriginais.EMPRESA || '',
          'Paciente': dadosOriginais.NOME_PACIENTE || '',
          'Exame': dadosOriginais.ESTUDO_DESCRICAO || '',
          'Modalidade': dadosOriginais.MODALIDADE || '',
          'Especialidade': dadosOriginais.ESPECIALIDADE || '',
          'Médico': dadosOriginais.MEDICO || '',
          'Data Realização': dadosOriginais.DATA_REALIZACAO || '',
          'Data Laudo': dadosOriginais.DATA_LAUDO || '',
          'Valores': dadosOriginais.VALORES || '',
          'Prioridade': dadosOriginais.PRIORIDADE || '',
          'Categoria': dadosOriginais.CATEGORIA || '',
          'Status': dadosOriginais.STATUS || ''
        };
      });

      // Dinamically import xlsx
      const XLSX = await import('xlsx');
      
      const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Exclusões');

      // Definir larguras das colunas
      const colWidths = [
        { wch: 36 }, // ID
        { wch: 25 }, // Arquivo Fonte
        { wch: 36 }, // Lote Upload
        { wch: 12 }, // Linha Original
        { wch: 35 }, // Motivo Exclusão
        { wch: 50 }, // Detalhes Erro
        { wch: 20 }, // Data Exclusão
        { wch: 30 }, // Empresa
        { wch: 30 }, // Paciente
        { wch: 40 }, // Exame
        { wch: 12 }, // Modalidade
        { wch: 20 }, // Especialidade
        { wch: 25 }, // Médico
        { wch: 15 }, // Data Realização
        { wch: 15 }, // Data Laudo
        { wch: 12 }, // Valores
        { wch: 15 }, // Prioridade
        { wch: 15 }, // Categoria
        { wch: 15 }  // Status
      ];
      worksheet['!cols'] = colWidths;

      // Gerar arquivo
      const nomeArquivo = loteUpload 
        ? `exclusoes_${loteUpload}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `exclusoes_24h_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success(`Arquivo exportado: ${nomeArquivo}`);

    } catch (error) {
      console.error('Erro ao exportar exclusões:', error);
      toast.error('Erro ao exportar dados');
    }
  }, [loteUpload]);

  return {
    status,
    loading,
    atualizarStatus,
    exportarExclusoes
  };
}