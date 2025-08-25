import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔍 INVESTIGAÇÃO DE EXCLUSÕES SILENCIOSAS INICIADA');

    // 1. Buscar o último upload com discrepância entre processados e inseridos
    const { data: ultimoUpload } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .gt('registros_erro', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!ultimoUpload) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Nenhum upload com discrepâncias encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📂 Analisando upload: ${ultimoUpload.arquivo_nome}`);
    console.log(`📊 Processados: ${ultimoUpload.registros_processados}, Inseridos: ${ultimoUpload.registros_inseridos}, Erro: ${ultimoUpload.registros_erro}`);

    const loteUpload = ultimoUpload.detalhes_erro?.lote_upload || `lote_${ultimoUpload.id}`;

    // 2. Analisar dados do staging original
    const { data: stagingData } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', loteUpload)
      .order('created_at', { ascending: true });

    console.log(`📦 Registros no staging: ${stagingData?.length || 0}`);

    // 3. Analisar dados inseridos na volumetria
    const { data: volumetriaData } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .eq('lote_upload', loteUpload);

    console.log(`✅ Registros inseridos na volumetria: ${volumetriaData?.length || 0}`);

    // 4. Identificar possíveis motivos de exclusão através da análise dos dados do staging
    const analiseExclusoes: any[] = [];
    const motivosIdentificados = new Map<string, number>();

    if (stagingData && stagingData.length > 0) {
      // Analisar cada registro do staging para identificar possíveis motivos de exclusão
      for (const registro of stagingData) {
        const dados = registro.dados_json as Record<string, any> || {};
        
        // Verificar se foi inserido na volumetria
        const foiInserido = volumetriaData?.some(v => 
          v.EMPRESA === dados.EMPRESA &&
          v.NOME_PACIENTE === dados.NOME_PACIENTE &&
          v.ESTUDO_DESCRICAO === dados.ESTUDO_DESCRICAO &&
          v.DATA_REALIZACAO === dados.DATA_REALIZACAO &&
          v.DATA_LAUDO === dados.DATA_LAUDO
        );

        if (!foiInserido) {
          // Identificar possível motivo da exclusão
          let motivoExclusao = 'MOTIVO_DESCONHECIDO';
          let detalhesMotivo = '';

          // 1. Verificar datas futuras (2025)
          const verificarDataFutura = (dataStr: string, campo: string) => {
            if (!dataStr) return false;
            
            const match = dataStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (match) {
              let [_, dia, mes, ano] = match;
              if (ano.length === 2) {
                const anoNum = parseInt(ano);
                if (anoNum <= 30) ano = `20${ano}`;
                else ano = `19${ano}`;
              }
              
              const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
              if (dataObj.getFullYear() >= 2025) {
                motivoExclusao = `DATA_${campo}_FUTURA`;
                detalhesMotivo = `${campo}: ${dataStr} (convertida para ${dataObj.toISOString().split('T')[0]})`;
                return true;
              }
            }
            return false;
          };

          if (verificarDataFutura(dados.DATA_REALIZACAO, 'REALIZACAO')) {
            // Já foi identificado acima
          } else if (verificarDataFutura(dados.DATA_LAUDO, 'LAUDO')) {
            // Já foi identificado acima
          }
          // 2. Verificar valores zerados ou nulos
          else if (!dados.VALORES || dados.VALORES === '0' || dados.VALORES === 0) {
            motivoExclusao = 'VALOR_ZERADO_OU_NULO';
            detalhesMotivo = `Valor: ${dados.VALORES}`;
          }
          // 3. Verificar campos obrigatórios vazios
          else if (!dados.EMPRESA || dados.EMPRESA.trim() === '') {
            motivoExclusao = 'EMPRESA_VAZIA';
            detalhesMotivo = `Empresa: '${dados.EMPRESA}'`;
          }
          else if (!dados.ESTUDO_DESCRICAO || dados.ESTUDO_DESCRICAO.trim() === '') {
            motivoExclusao = 'ESTUDO_VAZIO';
            detalhesMotivo = `Estudo: '${dados.ESTUDO_DESCRICAO}'`;
          }
          // 4. Verificar modalidades inválidas
          else if (!dados.MODALIDADE || dados.MODALIDADE.trim() === '') {
            motivoExclusao = 'MODALIDADE_VAZIA';
            detalhesMotivo = `Modalidade: '${dados.MODALIDADE}'`;
          }
          // 5. Verificar datas inválidas (formato)
          else if (dados.DATA_REALIZACAO && !dados.DATA_REALIZACAO.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
            motivoExclusao = 'DATA_REALIZACAO_FORMATO_INVALIDO';
            detalhesMotivo = `Data realização: '${dados.DATA_REALIZACAO}'`;
          }
          else if (dados.DATA_LAUDO && !dados.DATA_LAUDO.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
            motivoExclusao = 'DATA_LAUDO_FORMATO_INVALIDO';
            detalhesMotivo = `Data laudo: '${dados.DATA_LAUDO}'`;
          }
          // 6. Verificar se pode estar sendo filtrado por regras de exclusão de clientes
          else if (dados.EMPRESA && dados.EMPRESA.includes('TESTE')) {
            motivoExclusao = 'CLIENTE_TESTE_EXCLUIDO';
            detalhesMotivo = `Cliente de teste: ${dados.EMPRESA}`;
          }
          // 7. Verificar duplicados (mesmo paciente, mesmo estudo, mesma data)
          else {
            const duplicado = stagingData.find(outro => 
              outro.id !== registro.id &&
              (outro.dados_json as any)?.NOME_PACIENTE === dados.NOME_PACIENTE &&
              (outro.dados_json as any)?.ESTUDO_DESCRICAO === dados.ESTUDO_DESCRICAO &&
              (outro.dados_json as any)?.DATA_REALIZACAO === dados.DATA_REALIZACAO
            );
            
            if (duplicado) {
              motivoExclusao = 'REGISTRO_DUPLICADO';
              detalhesMotivo = `Duplicado com registro ID: ${duplicado.id}`;
            }
          }

          // Contar motivos
          const count = motivosIdentificados.get(motivoExclusao) || 0;
          motivosIdentificados.set(motivoExclusao, count + 1);

          analiseExclusoes.push({
            id_staging: registro.id,
            linha_original: analiseExclusoes.length + 1,
            dados_originais: dados,
            motivo_exclusao: motivoExclusao,
            detalhes_motivo: detalhesMotivo,
            timestamp_staging: registro.created_at
          });
        }
      }
    }

    console.log(`🎯 Identificados ${analiseExclusoes.length} registros excluídos com motivos`);

    // 5. Gerar estatísticas dos motivos
    const estatisticasMotivos = Array.from(motivosIdentificados.entries()).map(([motivo, quantidade]) => ({
      motivo,
      quantidade,
      percentual: ((quantidade / analiseExclusoes.length) * 100).toFixed(1)
    })).sort((a, b) => b.quantidade - a.quantidade);

    // 6. Inserir registros identificados na tabela de rejeitados
    if (analiseExclusoes.length > 0) {
      const registrosParaInserir = analiseExclusoes.map(exclusao => ({
        arquivo_fonte: ultimoUpload.tipo_arquivo,
        lote_upload: loteUpload,
        linha_original: exclusao.linha_original,
        dados_originais: exclusao.dados_originais,
        motivo_rejeicao: exclusao.motivo_exclusao,
        detalhes_erro: exclusao.detalhes_motivo,
        created_at: new Date().toISOString()
      }));

      // Inserir em batches
      const BATCH_SIZE = 100;
      let totalInseridos = 0;

      for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
        const batch = registrosParaInserir.slice(i, i + BATCH_SIZE);
        
        const { error: insertError } = await supabaseClient
          .from('registros_rejeitados_processamento')
          .insert(batch);

        if (!insertError) {
          totalInseridos += batch.length;
        } else {
          console.error(`❌ Erro ao inserir batch:`, insertError);
        }
      }

      console.log(`✅ Inseridos ${totalInseridos} registros rejeitados na tabela`);
    }

    // 7. Retornar análise completa
    return new Response(
      JSON.stringify({
        sucesso: true,
        upload_analisado: ultimoUpload.arquivo_nome,
        lote_upload: loteUpload,
        resumo: {
          registros_staging: stagingData?.length || 0,
          registros_inseridos: volumetriaData?.length || 0,
          registros_excluidos: analiseExclusoes.length,
          taxa_exclusao: `${((analiseExclusoes.length / (stagingData?.length || 1)) * 100).toFixed(1)}%`
        },
        motivos_exclusao: estatisticasMotivos,
        registros_identificados: totalInseridos || 0,
        exemplos_exclusoes: analiseExclusoes.slice(0, 10).map(ex => ({
          motivo: ex.motivo_exclusao,
          detalhes: ex.detalhes_motivo,
          empresa: ex.dados_originais.EMPRESA,
          estudo: ex.dados_originais.ESTUDO_DESCRICAO,
          data_realizacao: ex.dados_originais.DATA_REALIZACAO,
          data_laudo: ex.dados_originais.DATA_LAUDO,
          valores: ex.dados_originais.VALORES
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO NA INVESTIGAÇÃO:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});