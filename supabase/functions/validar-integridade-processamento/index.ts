import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidacaoRequest {
  upload_id: string;
  arquivo_fonte: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_id, arquivo_fonte }: ValidacaoRequest = await req.json();
    
    console.log(`🔍 [VALIDAÇÃO] Iniciando validação de integridade para upload ${upload_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar informações do upload
    const { data: uploadInfo, error: uploadError } = await supabase
      .from('processamento_uploads')
      .select('*')
      .eq('id', upload_id)
      .single();

    if (uploadError || !uploadInfo) {
      throw new Error(`Upload não encontrado: ${uploadError?.message}`);
    }

    const validacoes: any = {
      contagem_registros: false,
      valores_validos: false,
      campos_obrigatorios: false,
      duplicatas: false,
      periodo_consistente: false
    };

    const validacoesFalhadas: string[] = [];
    let pontuacaoIntegridade = 0;

    // 2. Validação 1: Contagem de registros processados vs inseridos
    const registrosEsperados = uploadInfo.registros_processados;
    const { count: registrosInseridos } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('lote_upload', uploadInfo.detalhes_erro?.lote_upload);

    if (registrosInseridos === registrosEsperados) {
      validacoes.contagem_registros = true;
      pontuacaoIntegridade += 25;
    } else {
      validacoesFalhadas.push(`Contagem inconsistente: esperado ${registrosEsperados}, inserido ${registrosInseridos}`);
    }

    // 3. Validação 2: Valores válidos (não negativos e não nulos onde obrigatório)
    const { count: valoresInvalidos } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('lote_upload', uploadInfo.detalhes_erro?.lote_upload)
      .or('"VALORES".is.null,"VALORES".lt.0');

    if (valoresInvalidos === 0) {
      validacoes.valores_validos = true;
      pontuacaoIntegridade += 20;
    } else {
      validacoesFalhadas.push(`${valoresInvalidos} registros com valores inválidos`);
    }

    // 4. Validação 3: Campos obrigatórios preenchidos
    const { count: camposObrigatoriosVazios } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('lote_upload', uploadInfo.detalhes_erro?.lote_upload)
      .or('"EMPRESA".is.null,"NOME_PACIENTE".is.null,"ESTUDO_DESCRICAO".is.null');

    if (camposObrigatoriosVazios === 0) {
      validacoes.campos_obrigatorios = true;
      pontuacaoIntegridade += 20;
    } else {
      validacoesFalhadas.push(`${camposObrigatoriosVazios} registros com campos obrigatórios vazios`);
    }

    // 5. Validação 4: Verificar duplicatas por ACCESSION_NUMBER
    const { data: duplicatas } = await supabase
      .from('volumetria_mobilemed')
      .select('"ACCESSION_NUMBER"')
      .eq('lote_upload', uploadInfo.detalhes_erro?.lote_upload)
      .not('"ACCESSION_NUMBER"', 'is', null);

    const accessionNumbers = duplicatas?.map(d => d.ACCESSION_NUMBER) || [];
    const duplicatasEncontradas = accessionNumbers.length - new Set(accessionNumbers).size;

    if (duplicatasEncontradas === 0) {
      validacoes.duplicatas = true;
      pontuacaoIntegridade += 15;
    } else {
      validacoesFalhadas.push(`${duplicatasEncontradas} duplicatas encontradas`);
    }

    // 6. Validação 5: Período de referência consistente
    const { data: periodos } = await supabase
      .from('volumetria_mobilemed')
      .select('periodo_referencia')
      .eq('lote_upload', uploadInfo.detalhes_erro?.lote_upload)
      .limit(1000);

    const periodosUnicos = new Set(periodos?.map(p => p.periodo_referencia));
    
    if (periodosUnicos.size <= 1) {
      validacoes.periodo_consistente = true;
      pontuacaoIntegridade += 20;
    } else {
      validacoesFalhadas.push(`Múltiplos períodos encontrados: ${Array.from(periodosUnicos).join(', ')}`);
    }

    // 7. Determinar status geral
    const statusGeral = pontuacaoIntegridade >= 80 ? 'aprovado' : 
                       pontuacaoIntegridade >= 60 ? 'aprovado_com_alertas' : 'reprovado';
    
    const requerRollback = pontuacaoIntegridade < 60;

    // 8. Salvar resultado da validação
    const { error: validacaoError } = await supabase
      .from('validacao_integridade')
      .insert({
        upload_id: upload_id,
        arquivo_fonte: arquivo_fonte,
        validacoes_executadas: validacoes,
        validacoes_aprovadas: Object.keys(validacoes).filter(k => validacoes[k]),
        validacoes_falhadas: validacoesFalhadas,
        pontuacao_integridade: pontuacaoIntegridade,
        status_geral: statusGeral,
        requer_rollback: requerRollback
      });

    if (validacaoError) {
      console.error('❌ Erro ao salvar validação:', validacaoError);
    }

    const resultado = {
      sucesso: true,
      upload_id: upload_id,
      pontuacao_integridade: pontuacaoIntegridade,
      status_geral: statusGeral,
      requer_rollback: requerRollback,
      validacoes_aprovadas: Object.keys(validacoes).filter(k => validacoes[k]),
      validacoes_falhadas: validacoesFalhadas,
      registros_validados: registrosInseridos,
      detalhes: {
        contagem_esperada: registrosEsperados,
        contagem_inserida: registrosInseridos,
        valores_invalidos: valoresInvalidos,
        campos_vazios: camposObrigatoriosVazios,
        duplicatas: duplicatasEncontradas,
        periodos_unicos: Array.from(periodosUnicos)
      }
    };

    console.log(`✅ [VALIDAÇÃO] Concluída com pontuação ${pontuacaoIntegridade}/100:`, resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [VALIDAÇÃO] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        pontuacao_integridade: 0,
        status_geral: 'erro',
        requer_rollback: true
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});