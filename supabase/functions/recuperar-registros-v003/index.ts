import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const { periodo_referencia = '2025-10', dry_run = false, cliente_filter = null, limit = 5000 } = body;

    console.log(`🔄 Recuperando registros rejeitados pela REGRA_V003 para período ${periodo_referencia}`);
    console.log(`📌 Modo: ${dry_run ? 'SIMULAÇÃO' : 'EXECUÇÃO REAL'}`);
    console.log(`📌 Limite: ${limit} registros`);
    if (cliente_filter) console.log(`📌 Filtro cliente: ${cliente_filter}`);

    // Buscar registros rejeitados pela REGRA_V003 com limite
    let query = supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .eq('motivo_rejeicao', 'REGRA_V003_DATA_REALIZACAO_FORA_PERIODO')
      .limit(limit);

    const { data: rejeitados, error: errorRejeitados } = await query;

    if (errorRejeitados) {
      throw new Error(`Erro ao buscar rejeitados: ${errorRejeitados.message}`);
    }

    console.log(`📊 Total de registros rejeitados pela V003: ${rejeitados?.length || 0}`);

    if (!rejeitados || rejeitados.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum registro rejeitado pela REGRA_V003 encontrado',
        total_recuperados: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Agrupar por cliente para relatório
    const porCliente: Record<string, number> = {};
    const registrosParaInserir: any[] = [];

    for (const rej of rejeitados) {
      const dados = rej.dados_originais;
      if (!dados) continue;

      const empresa = dados.EMPRESA || 'DESCONHECIDO';
      porCliente[empresa] = (porCliente[empresa] || 0) + 1;

      // Preparar registro para inserção
      registrosParaInserir.push({
        arquivo_fonte: rej.arquivo_fonte || 'recuperado_v003',
        lote_upload: rej.lote_upload || 'recuperacao_v003',
        EMPRESA: dados.EMPRESA,
        NOME_PACIENTE: dados.NOME_PACIENTE,
        CODIGO_PACIENTE: dados.CODIGO_PACIENTE,
        ESTUDO_DESCRICAO: dados.ESTUDO_DESCRICAO,
        ACCESSION_NUMBER: dados.ACCESSION_NUMBER,
        MODALIDADE: dados.MODALIDADE,
        PRIORIDADE: dados.PRIORIDADE || 'ROTINA',
        VALORES: parseInt(dados.VALORES) || 1,
        ESPECIALIDADE: dados.ESPECIALIDADE || 'MEDICINA INTERNA',
        MEDICO: dados.MEDICO,
        DUPLICADO: dados.DUPLICADO,
        DATA_REALIZACAO: dados.DATA_REALIZACAO,
        HORA_REALIZACAO: dados.HORA_REALIZACAO,
        DATA_TRANSFERENCIA: dados.DATA_TRANSFERENCIA,
        HORA_TRANSFERENCIA: dados.HORA_TRANSFERENCIA,
        DATA_LAUDO: dados.DATA_LAUDO,
        HORA_LAUDO: dados.HORA_LAUDO,
        DATA_PRAZO: dados.DATA_PRAZO,
        HORA_PRAZO: dados.HORA_PRAZO,
        STATUS: dados.STATUS,
        DATA_REASSINATURA: dados.DATA_REASSINATURA,
        HORA_REASSINATURA: dados.HORA_REASSINATURA,
        MEDICO_REASSINATURA: dados.MEDICO_REASSINATURA,
        SEGUNDA_ASSINATURA: dados.SEGUNDA_ASSINATURA,
        POSSUI_IMAGENS_CHAVE: dados.POSSUI_IMAGENS_CHAVE,
        IMAGENS_CHAVES: dados.IMAGENS_CHAVES ? parseInt(dados.IMAGENS_CHAVES) : null,
        IMAGENS_CAPTURADAS: dados.IMAGENS_CAPTURADAS ? parseInt(dados.IMAGENS_CAPTURADAS) : null,
        CODIGO_INTERNO: dados.CODIGO_INTERNO ? parseInt(dados.CODIGO_INTERNO) : null,
        DIGITADOR: dados.DIGITADOR,
        COMPLEMENTAR: dados.COMPLEMENTAR,
        CATEGORIA: dados.CATEGORIA || 'SC',
        periodo_referencia: periodo_referencia,
        tipo_dados: 'volumetria_padrao_retroativo',
        tipo_faturamento: 'por_exame'
      });
    }

    console.log(`📋 Registros por cliente:`, porCliente);

    if (dry_run) {
      return new Response(JSON.stringify({
        sucesso: true,
        modo: 'SIMULAÇÃO',
        total_a_recuperar: registrosParaInserir.length,
        por_cliente: porCliente,
        mensagem: 'Execute com dry_run=false para recuperar os registros'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Inserir em lotes de 500
    const BATCH_SIZE = 500;
    let totalInseridos = 0;
    const errosInsercao: string[] = [];

    for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
      const batch = registrosParaInserir.slice(i, i + BATCH_SIZE);
      
      const { error: errorInsert } = await supabaseClient
        .from('volumetria_mobilemed')
        .insert(batch);

      if (errorInsert) {
        console.error(`❌ Erro ao inserir lote ${i}-${i + batch.length}: ${errorInsert.message}`);
        errosInsercao.push(`Lote ${i}: ${errorInsert.message}`);
      } else {
        totalInseridos += batch.length;
        console.log(`✅ Inserido lote ${i + 1}-${i + batch.length} de ${registrosParaInserir.length}`);
      }
    }

    // Remover os registros da tabela de rejeitados
    const idsParaRemover = rejeitados.map(r => r.id);
    
    for (let i = 0; i < idsParaRemover.length; i += BATCH_SIZE) {
      const batchIds = idsParaRemover.slice(i, i + BATCH_SIZE);
      
      const { error: errorDelete } = await supabaseClient
        .from('registros_rejeitados_processamento')
        .delete()
        .in('id', batchIds);

      if (errorDelete) {
        console.error(`❌ Erro ao limpar rejeitados: ${errorDelete.message}`);
      }
    }

    // Registrar no audit log
    await supabaseClient.from('audit_logs').insert({
      operation: 'RECUPERACAO_V003',
      table_name: 'volumetria_mobilemed',
      record_id: 'batch_recovery',
      new_data: {
        total_recuperados: totalInseridos,
        por_cliente: porCliente,
        periodo: periodo_referencia,
        erros: errosInsercao
      }
    });

    return new Response(JSON.stringify({
      sucesso: true,
      total_recuperados: totalInseridos,
      total_rejeitados_removidos: idsParaRemover.length,
      por_cliente: porCliente,
      erros: errosInsercao.length > 0 ? errosInsercao : undefined,
      mensagem: `${totalInseridos} registros recuperados e inseridos na volumetria`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
