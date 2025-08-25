import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de regras implementadas e suas edge functions correspondentes
const REGRAS_MAPEAMENTO = {
  // Regras de exclusão
  'v002': 'aplicar-exclusoes-periodo',
  'v003': 'aplicar-exclusoes-periodo', 
  'v031': 'aplicar-exclusoes-periodo',
  'v032': 'aplicar-exclusao-clientes-especificos',
  'v020': 'aplicar-regras-exclusao-dinamicas',
  
  // Regras de negócio
  'v026': 'aplicar-regras-tratamento', // De-Para valores
  'v027': 'aplicar-regras-quebra-exames',
  'v030': 'aplicar-correcao-modalidade-rx',
  'v033': 'aplicar-substituicao-especialidade-categoria',
  'v034': 'aplicar-regra-colunas-musculo-neuro',
  'v035': 'aplicar-mapeamento-nome-cliente',
  'v021': 'aplicar-validacao-cliente',
  
  // Regras de faturamento
  'f005': 'aplicar-tipificacao-faturamento',
  'f006': 'aplicar-tipificacao-faturamento',
  
  // Regras aplicadas via triggers SQL (sempre ativas)
  'v001': 'SQL_TRIGGER', // Proteção temporal
  'v013': 'SQL_TRIGGER', // Validação Excel
  'v014': 'SQL_TRIGGER', // Mapeamento dinâmico
  'v016': 'SQL_TRIGGER', // Processamento em lotes
  'v017': 'SQL_TRIGGER', // Normalização médico
  'v018': 'SQL_TRIGGER', // De-Para prioridades
  'v019': 'SQL_TRIGGER', // Valor onco
  'v022': 'SQL_TRIGGER', // Limpeza caracteres
  'v023': 'SQL_TRIGGER', // Especialidade automática
  'v024': 'SQL_TRIGGER', // Data referência
  'v028': 'SQL_TRIGGER', // Categorias
  'v029': 'SQL_TRIGGER', // Exames fora padrão
  'v008': 'SQL_TRIGGER', // Cache performance
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte, lote_upload } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔍 MAPEANDO STATUS DAS REGRAS - Arquivo: ${arquivo_fonte} | Lote: ${lote_upload}`);

    // Buscar logs de auditoria das regras aplicadas
    const { data: logsAuditoria, error: logsError } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'volumetria_mobilemed')
      .in('operation', [
        'APLICAR_REGRAS_LOTE',
        'aplicar-exclusoes-periodo',
        'aplicar-exclusao-clientes-especificos', 
        'aplicar-regras-tratamento',
        'aplicar-correcao-modalidade-rx',
        'aplicar-correcao-modalidade-ot',
        'aplicar-substituicao-especialidade-categoria',
        'aplicar-regra-colunas-musculo-neuro',
        'aplicar-tipificacao-faturamento',
        'aplicar-validacao-cliente',
        'aplicar-regras-quebra-exames'
      ])
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24h
      .order('timestamp', { ascending: false });

    if (logsError) {
      console.error('❌ Erro ao buscar logs:', logsError);
    }

    // Mapear status de cada regra
    const statusRegras: Record<string, any> = {};
    
    // Inicializar todas as regras como não aplicadas
    Object.keys(REGRAS_MAPEAMENTO).forEach(regraId => {
      statusRegras[regraId] = {
        id: regraId,
        edge_function: REGRAS_MAPEAMENTO[regraId],
        aplicada: false,
        automatica: REGRAS_MAPEAMENTO[regraId] === 'SQL_TRIGGER',
        timestamp_aplicacao: null,
        detalhes: null
      };
    });

    // Marcar regras SQL como sempre aplicadas (via triggers)
    Object.keys(REGRAS_MAPEAMENTO).forEach(regraId => {
      if (REGRAS_MAPEAMENTO[regraId] === 'SQL_TRIGGER') {
        statusRegras[regraId].aplicada = true;
        statusRegras[regraId].detalhes = 'Aplicada automaticamente via trigger SQL';
      }
    });

    // Processar logs de auditoria para identificar regras aplicadas
    if (logsAuditoria) {
      logsAuditoria.forEach(log => {
        const operation = log.operation;
        const timestamp = log.timestamp;
        const newData = log.new_data;

        // Mapear edge functions para regras
        Object.keys(REGRAS_MAPEAMENTO).forEach(regraId => {
          const edgeFunction = REGRAS_MAPEAMENTO[regraId];
          
          if (operation === edgeFunction || operation === 'APLICAR_REGRAS_LOTE') {
            statusRegras[regraId].aplicada = true;
            statusRegras[regraId].timestamp_aplicacao = timestamp;
            
            if (newData) {
              statusRegras[regraId].detalhes = {
                registros_processados: newData.registros_processados || newData.total_processado,
                resultado: newData.resultado || newData.resultados
              };
            }
          }
        });
      });
    }

    // Verificar regras de exclusão específicas pelos registros rejeitados
    const { data: registrosRejeitados, error: rejeitadosError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('motivo_rejeicao, created_at')
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('lote_upload', lote_upload);

    if (!rejeitadosError && registrosRejeitados) {
      registrosRejeitados.forEach(registro => {
        const motivo = registro.motivo_rejeicao;
        
        // Mapear motivos para regras
        if (motivo === 'FILTRO_PERIODO_AUTOMATICO') {
          ['v002', 'v003', 'v031'].forEach(regraId => {
            statusRegras[regraId].aplicada = true;
            statusRegras[regraId].detalhes = 'Confirmada por registros rejeitados';
          });
        }
        
        if (motivo === 'REGRAS_NEGOCIO_AUTOMATICO') {
          statusRegras['v020'].aplicada = true;
          statusRegras['v020'].detalhes = 'Confirmada por registros rejeitados';
        }
      });
    }

    // Calcular estatísticas
    const totalRegras = Object.keys(statusRegras).length;
    const regrasAplicadas = Object.values(statusRegras).filter((r: any) => r.aplicada).length;
    const regrasNaoAplicadas = Object.values(statusRegras).filter((r: any) => !r.aplicada);
    const percentualCobertura = Math.round((regrasAplicadas / totalRegras) * 100);

    const resultado = {
      success: true,
      arquivo_fonte,
      lote_upload,
      timestamp_verificacao: new Date().toISOString(),
      estatisticas: {
        total_regras: totalRegras,
        regras_aplicadas: regrasAplicadas,
        regras_nao_aplicadas: regrasNaoAplicadas.length,
        percentual_cobertura: percentualCobertura
      },
      status_regras: statusRegras,
      regras_nao_aplicadas: regrasNaoAplicadas,
      logs_encontrados: logsAuditoria?.length || 0
    };

    console.log(`✅ Mapeamento concluído: ${regrasAplicadas}/${totalRegras} regras aplicadas (${percentualCobertura}%)`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});