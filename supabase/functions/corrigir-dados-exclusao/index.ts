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

    console.log('🔧 CORREÇÃO DE DADOS DE EXCLUSÃO INICIADA');

    // 1. Limpar registros genéricos de reprocessamento
    console.log('🧹 Limpando registros genéricos...');
    const { error: deleteError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .delete()
      .eq('motivo_rejeicao', 'REJEICAO_REPROCESSAMENTO');

    if (deleteError) {
      console.error('❌ Erro ao limpar registros genéricos:', deleteError);
    } else {
      console.log('✅ Registros genéricos removidos');
    }

    // 2. Buscar o último upload com registros de erro
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
          erro: 'Nenhum upload com registros rejeitados encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📂 Upload encontrado: ${ultimoUpload.arquivo_nome} com ${ultimoUpload.registros_erro} registros rejeitados`);

    // 3. Buscar dados rejeitados do último upload - ESTRATÉGIA APRIMORADA
    const loteUpload = ultimoUpload.detalhes_erro?.lote_upload || `lote_${ultimoUpload.id}`;
    
    console.log(`🔍 Buscando registros rejeitados para upload: ${ultimoUpload.arquivo_nome}`);
    console.log(`📊 Registros erro reportados: ${ultimoUpload.registros_erro}`);
    console.log(`📊 Registros inseridos: ${ultimoUpload.registros_inseridos}`);
    console.log(`📊 Registros processados: ${ultimoUpload.registros_processados}`);
    
    // PRIMEIRA TENTATIVA: Buscar no staging com erro
    const { data: stagingData } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', loteUpload)
      .eq('status_processamento', 'erro');
    
    console.log(`📊 Staging com erro: ${stagingData?.length || 0} registros`);
    
    // SEGUNDA TENTATIVA: Buscar no staging pendente (pode ter falhado no processamento)
    const { data: stagingPendente } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', loteUpload)
      .eq('status_processamento', 'pendente');
    
    console.log(`📊 Staging pendente: ${stagingPendente?.length || 0} registros`);
    
    // TERCEIRA TENTATIVA: Buscar todos os dados do lote para análise
    const { data: todosStaging } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', loteUpload);
    
    console.log(`📊 Total staging do lote: ${todosStaging?.length || 0} registros`);
    
    // QUARTA TENTATIVA: Buscar dados processados na volumetria para comparar
    const { data: dadosVolumetria } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .eq('lote_upload', loteUpload);
    
    console.log(`📊 Dados inseridos na volumetria: ${dadosVolumetria?.length || 0} registros`);
    
    // Consolidar dados disponíveis
    const stagingComErro = [...(stagingData || []), ...(stagingPendente || [])];
    const diferenca = (todosStaging?.length || 0) - (dadosVolumetria?.length || 0);
    
    console.log(`🔍 ANÁLISE: Staging total (${todosStaging?.length || 0}) - Volumetria inserida (${dadosVolumetria?.length || 0}) = Diferença: ${diferenca}`);

    console.log(`📊 Encontrados ${stagingData?.length || 0} registros no staging com erro`);

    // 4. Função robusta para normalização de datas - CORRIGIDA
    const parseDataBrasileira = (dataStr: string): Date | null => {
      if (!dataStr || typeof dataStr !== 'string') return null;
      
      const dataLimpa = dataStr.trim();
      
      // Suportar múltiplos formatos
      const formatosBrasileiros = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // dd/mm/yyyy ou dd-mm-yyyy
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,  // dd/mm/yy ou dd-mm-yy
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/   // yyyy/mm/dd ou yyyy-mm-dd
      ];
      
      for (let i = 0; i < formatosBrasileiros.length; i++) {
        const formato = formatosBrasileiros[i];
        const match = dataLimpa.match(formato);
        
        if (match) {
          let dia: number, mes: number, ano: number;
          
          if (i === 2) {
            // Formato yyyy/mm/dd ou yyyy-mm-dd
            [, ano, mes, dia] = match.map(Number);
          } else {
            // Formatos dd/mm/yyyy ou dd/mm/yy
            let [, diaStr, mesStr, anoStr] = match;
            
            // CORREÇÃO CRÍTICA: Conversão inteligente de anos
            if (anoStr.length === 2) {
              const anoNum = parseInt(anoStr);
              // Para dados históricos: 00-05 = 2000-2005, 06-30 = 2006-2030, 31-99 = 1931-1999
              if (anoNum <= 5) {
                anoStr = `200${anoStr}`;
              } else if (anoNum <= 30) {
                anoStr = `20${anoStr}`;
              } else {
                anoStr = `19${anoStr}`;
              }
            }
            
            dia = parseInt(diaStr);
            mes = parseInt(mesStr);
            ano = parseInt(anoStr);
          }
          
          // Validações básicas
          if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > 2100) {
            continue;
          }
          
          // Validação básica da data criada
          const data = new Date(ano, mes - 1, dia);
          
          if (data.getFullYear() !== ano || 
              data.getMonth() !== (mes - 1) || 
              data.getDate() !== dia) {
            continue;
          }
          
          return data;
        }
      }
      
      return null;
    };

    // 5. Processar registros rejeitados com base na análise aprimorada
    const registrosRejeitados: any[] = [];
    const totalRejeitados = ultimoUpload.registros_erro;

    // ESTRATÉGIA 1: Usar staging com erro direto
    if (stagingComErro && stagingComErro.length > 0) {
      console.log(`📝 Usando ${stagingComErro.length} registros do staging com erro`);
      
      stagingComErro.forEach((registro, index) => {
        const dados = registro.dados_json as Record<string, any> || {};
        
        // Normalizar datas
        let dataRealizacaoNorm = 'N/I';
        let dataLaudoNorm = 'N/I';
        
        if (dados.DATA_REALIZACAO) {
          const dataRealiz = parseDataBrasileira(dados.DATA_REALIZACAO);
          dataRealizacaoNorm = dataRealiz ? dataRealiz.toISOString().split('T')[0] : dados.DATA_REALIZACAO;
        }
        
        if (dados.DATA_LAUDO) {
          const dataLaudo = parseDataBrasileira(dados.DATA_LAUDO);
          dataLaudoNorm = dataLaudo ? dataLaudo.toISOString().split('T')[0] : dados.DATA_LAUDO;
        }

        registrosRejeitados.push({
          arquivo_fonte: ultimoUpload.tipo_arquivo,
          lote_upload: loteUpload,
          linha_original: index + 1,
          dados_originais: {
            EMPRESA: dados.EMPRESA || 'N/I',
            NOME_PACIENTE: dados.NOME_PACIENTE || 'N/I',
            MODALIDADE: dados.MODALIDADE || 'N/I',
            ESPECIALIDADE: dados.ESPECIALIDADE || 'N/I',
            ESTUDO_DESCRICAO: dados.ESTUDO_DESCRICAO || 'N/I',
            DATA_REALIZACAO: dados.DATA_REALIZACAO || 'N/I',
            DATA_LAUDO: dados.DATA_LAUDO || 'N/I',
            DATA_REALIZACAO_NORMALIZADA: dataRealizacaoNorm,
            DATA_LAUDO_NORMALIZADA: dataLaudoNorm
          },
          motivo_rejeicao: registro.erro_processamento || 'VALIDACAO_PERIODO_DATA_FORMATO',
          detalhes_erro: `Registro rejeitado por validação - Data realização: ${dados.DATA_REALIZACAO} -> ${dataRealizacaoNorm}, Data laudo: ${dados.DATA_LAUDO} -> ${dataLaudoNorm}`,
          created_at: new Date().toISOString()
        });
      });
      
    // ESTRATÉGIA 2: Calcular diferença entre staging e volumetria inserida
    } else if (diferenca > 0 && todosStaging && todosStaging.length > 0) {
      console.log(`📝 Calculando ${diferenca} registros rejeitados por diferença staging-volumetria`);
      
      // Pegar registros do staging que não foram inseridos na volumetria
      const registrosInseridos = new Set((dadosVolumetria || []).map(v => 
        `${v.EMPRESA}_${v.NOME_PACIENTE}_${v.ESTUDO_DESCRICAO}_${v.DATA_REALIZACAO}_${v.DATA_LAUDO}`
      ));
      
      const registrosNaoInseridos = todosStaging.filter(staging => {
        const dados = staging.dados_json as Record<string, any> || {};
        const chave = `${dados.EMPRESA}_${dados.NOME_PACIENTE}_${dados.ESTUDO_DESCRICAO}_${dados.DATA_REALIZACAO}_${dados.DATA_LAUDO}`;
        return !registrosInseridos.has(chave);
      });
      
      console.log(`📝 Encontrados ${registrosNaoInseridos.length} registros não inseridos para análise`);
      
      registrosNaoInseridos.slice(0, diferenca).forEach((registro, index) => {
        const dados = registro.dados_json as Record<string, any> || {};
        
        // Normalizar datas e identificar motivo da rejeição
        let dataRealizacaoNorm = 'N/I';
        let dataLaudoNorm = 'N/I';
        let motivoRejeicao = 'VALIDACAO_PERIODO_DATA_FORMATO';
        let detalhesErro = 'Registro não inserido - possível problema de validação';
        
        if (dados.DATA_REALIZACAO) {
          const dataRealiz = parseDataBrasileira(dados.DATA_REALIZACAO);
          dataRealizacaoNorm = dataRealiz ? dataRealiz.toISOString().split('T')[0] : dados.DATA_REALIZACAO;
          
          // Verificar se data está no futuro (2025)
          if (dataRealiz && dataRealiz.getFullYear() >= 2025) {
            motivoRejeicao = 'DATA_REALIZACAO_FUTURA';
            detalhesErro = `Data de realização no futuro: ${dados.DATA_REALIZACAO} (${dataRealizacaoNorm})`;
          }
        }
        
        if (dados.DATA_LAUDO) {
          const dataLaudo = parseDataBrasileira(dados.DATA_LAUDO);
          dataLaudoNorm = dataLaudo ? dataLaudo.toISOString().split('T')[0] : dados.DATA_LAUDO;
          
          // Verificar se data está no futuro (2025)
          if (dataLaudo && dataLaudo.getFullYear() >= 2025) {
            motivoRejeicao = 'DATA_LAUDO_FUTURA';
            detalhesErro = `Data de laudo no futuro: ${dados.DATA_LAUDO} (${dataLaudoNorm})`;
          }
        }

        registrosRejeitados.push({
          arquivo_fonte: ultimoUpload.tipo_arquivo,
          lote_upload: loteUpload,
          linha_original: index + 1,
          dados_originais: {
            EMPRESA: dados.EMPRESA || 'N/I',
            NOME_PACIENTE: dados.NOME_PACIENTE || 'N/I',
            MODALIDADE: dados.MODALIDADE || 'N/I',
            ESPECIALIDADE: dados.ESPECIALIDADE || 'N/I',
            ESTUDO_DESCRICAO: dados.ESTUDO_DESCRICAO || 'N/I',
            DATA_REALIZACAO: dados.DATA_REALIZACAO || 'N/I',
            DATA_LAUDO: dados.DATA_LAUDO || 'N/I',
            DATA_REALIZACAO_NORMALIZADA: dataRealizacaoNorm,
            DATA_LAUDO_NORMALIZADA: dataLaudoNorm
          },
          motivo_rejeicao: motivoRejeicao,
          detalhes_erro: detalhesErro,
          created_at: new Date().toISOString()
        });
      });
      
    } else {
      console.log('📊 Nenhum registro rejeitado real encontrado para processar');
      
      return new Response(JSON.stringify({
        sucesso: true,
        upload_processado: ultimoUpload.arquivo_nome,
        registros_criados: 0,
        total_rejeitados: 0,
        fonte_dados: 'nenhum_rejeitado_real',
        lote_upload: loteUpload,
        analise: {
          staging_total: todosStaging?.length || 0,
          volumetria_inserida: dadosVolumetria?.length || 0,
          diferenca: diferenca,
          staging_com_erro: stagingComErro.length
        },
        mensagem: 'Nenhum registro rejeitado encontrado - todos os dados foram processados com sucesso'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📝 Preparados ${registrosRejeitados.length} registros para inserção`);

    // 6. Inserir registros em batches
    const BATCH_SIZE = 100;
    let totalInseridos = 0;

    for (let i = 0; i < registrosRejeitados.length; i += BATCH_SIZE) {
      const batch = registrosRejeitados.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i/BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(registrosRejeitados.length/BATCH_SIZE);
      
      console.log(`📝 Inserindo batch ${batchNum}/${totalBatches} (${batch.length} registros)...`);

      const { error: insertError } = await supabaseClient
        .from('registros_rejeitados_processamento')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Erro no batch ${batchNum}:`, insertError);
      } else {
        totalInseridos += batch.length;
        console.log(`✅ Batch ${batchNum} inserido com sucesso`);
      }
    }

    console.log(`✅ CORREÇÃO CONCLUÍDA: ${totalInseridos}/${registrosRejeitados.length} registros inseridos`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        upload_processado: ultimoUpload.arquivo_nome,
        registros_criados: totalInseridos,
        total_rejeitados: totalRejeitados,
        fonte_dados: stagingComErro.length > 0 ? 'staging_com_erro' : diferenca > 0 ? 'diferenca_staging_volumetria' : 'nenhum_dado',
        lote_upload: loteUpload,
        analise_detalhada: {
          staging_total: todosStaging?.length || 0,
          volumetria_inserida: dadosVolumetria?.length || 0,
          diferenca_calculada: diferenca,
          staging_com_erro: stagingComErro.length,
          registros_processados: totalInseridos,
          estrategia_usada: stagingComErro.length > 0 ? 'staging_com_erro' : diferenca > 0 ? 'diferenca_staging_volumetria' : 'nenhuma'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO NA CORREÇÃO:', error);
    
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