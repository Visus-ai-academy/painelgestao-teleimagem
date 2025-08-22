import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuebraConfig {
  exame_original: string;
  exame_quebrado: string;
  categoria_quebrada: string | null;
}

interface RegistroOriginal {
  id: string;
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE: string;
  ESTUDO_DESCRICAO: string;
  ACCESSION_NUMBER: string;
  MODALIDADE: string;
  PRIORIDADE: string;
  VALORES: number;
  ESPECIALIDADE: string;
  MEDICO: string;
  DUPLICADO: string;
  DATA_REALIZACAO: string;
  HORA_REALIZACAO: string;
  DATA_TRANSFERENCIA: string;
  HORA_TRANSFERENCIA: string;
  DATA_LAUDO: string;
  HORA_LAUDO: string;
  DATA_PRAZO: string;
  HORA_PRAZO: string;
  STATUS: string;
  DATA_REASSINATURA: string;
  HORA_REASSINATURA: string;
  MEDICO_REASSINATURA: string;
  SEGUNDA_ASSINATURA: string;
  POSSUI_IMAGENS_CHAVE: string;
  IMAGENS_CHAVES: string;
  IMAGENS_CAPTURADAS: string;
  CODIGO_INTERNO: string;
  DIGITADOR: string;
  COMPLEMENTAR: string;
  data_referencia: string;
  arquivo_fonte: string;
  lote_upload: string;
  periodo_referencia: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte } = await req.json();

    console.log(`Iniciando aplicação de regras de quebra para: ${arquivo_fonte || 'TODOS'}`);

    // Se arquivo_fonte não for especificado, processar todos
    const whereClause = arquivo_fonte ? { arquivo_fonte } : {};

    // 1. Buscar todas as regras de quebra ativas
    const { data: regrasQuebra, error: errorRegras } = await supabase
      .from('regras_quebra_exames')
      .select('exame_original, exame_quebrado, categoria_quebrada')
      .eq('ativo', true);

    if (errorRegras) {
      throw new Error(`Erro ao buscar regras de quebra: ${errorRegras.message}`);
    }

    if (!regrasQuebra || regrasQuebra.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhuma regra de quebra ativa encontrada',
        registros_processados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Agrupar quebras por exame original
    const quebrasAgrupadas = new Map<string, QuebraConfig[]>();
    regrasQuebra.forEach((regra: QuebraConfig) => {
      if (!quebrasAgrupadas.has(regra.exame_original)) {
        quebrasAgrupadas.set(regra.exame_original, []);
      }
      quebrasAgrupadas.get(regra.exame_original)!.push(regra);
    });

    console.log(`Encontradas ${quebrasAgrupadas.size} tipos de exames com regras de quebra`);

    let totalProcessados = 0;
    let totalQuebrados = 0;
    let erros = 0;
    const detalhesProcessamento: any[] = [];

    // 3. Processar cada tipo de exame original
    for (const [exameOriginal, configsQuebra] of quebrasAgrupadas) {
      const quantidadeQuebras = configsQuebra.length;
      
      console.log(`Processando exame: ${exameOriginal} (${quantidadeQuebras} quebras)`);

      // 4. Buscar todos os registros deste exame original
      const queryBuilder = supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('ESTUDO_DESCRICAO', exameOriginal);
      
      // Aplicar filtro por arquivo_fonte se especificado
      if (arquivo_fonte) {
        queryBuilder.eq('arquivo_fonte', arquivo_fonte);
      }
      
      const { data: registrosOriginais, error: errorRegistros } = await queryBuilder;

      if (errorRegistros) {
        console.error(`Erro ao buscar registros para ${exameOriginal}:`, errorRegistros.message);
        erros++;
        continue;
      }

      if (!registrosOriginais || registrosOriginais.length === 0) {
        console.log(`Nenhum registro encontrado para: ${exameOriginal}`);
        continue;
      }

      console.log(`Encontrados ${registrosOriginais.length} registros para quebrar`);

      // 5. Processar cada registro original
      for (const registroOriginal of registrosOriginais as RegistroOriginal[]) {
        try {
          const valorOriginal = registroOriginal.VALORES || 0;
          const valorQuebrado = Math.round((valorOriginal / quantidadeQuebras) * 100) / 100; // Arredondar para 2 casas decimais

          console.log(`Quebrando registro ID ${registroOriginal.id}: ${valorOriginal} -> ${valorQuebrado} x ${quantidadeQuebras}`);

          // 6. Criar registros quebrados
          const registrosQuebrados = configsQuebra.map((config) => {
            const novoRegistro = { ...registroOriginal };
            delete novoRegistro.id; // Remove ID para gerar novo
            delete novoRegistro.created_at; // Remove timestamps
            delete novoRegistro.updated_at;
            
            return {
              ...novoRegistro,
              ESTUDO_DESCRICAO: config.exame_quebrado,
              VALORES: valorQuebrado,
              CATEGORIA: config.categoria_quebrada || registroOriginal.CATEGORIA || 'SC'
            };
          });

          // 7. Inserir registros quebrados
          const { error: errorInsert } = await supabase
            .from('volumetria_mobilemed')
            .insert(registrosQuebrados);

          if (errorInsert) {
            throw new Error(`Erro ao inserir registros quebrados: ${errorInsert.message}`);
          }

          // 8. Registrar remoção do registro original antes de deletar
          const rejectionData = {
            arquivo_fonte: registroOriginal.arquivo_fonte,
            lote_upload: registroOriginal.lote_upload || 'quebra_exames',
            linha_original: 1,
            dados_originais: registroOriginal,
            motivo_rejeicao: 'QUEBRA_EXAME_ORIGINAL_REMOVIDO',
            detalhes_erro: `Exame original ${registroOriginal.ESTUDO_DESCRICAO} quebrado em ${quantidadeQuebras} registros`
          };

          await supabase.from('registros_rejeitados_processamento').insert([rejectionData]);

          // 9. Remover registro original
          const { error: errorDelete } = await supabase
            .from('volumetria_mobilemed')
            .delete()
            .eq('id', registroOriginal.id);

          if (errorDelete) {
            throw new Error(`Erro ao remover registro original: ${errorDelete.message}`);
          }

          totalProcessados++;
          totalQuebrados += quantidadeQuebras;

          detalhesProcessamento.push({
            exame_original: exameOriginal,
            valor_original: valorOriginal,
            quantidade_quebras: quantidadeQuebras,
            valor_quebrado: valorQuebrado,
            registros_criados: configsQuebra.map(c => c.exame_quebrado)
          });

        } catch (error: any) {
          console.error(`Erro ao processar registro ${registroOriginal.id}:`, error.message);
          erros++;
        }
      }
    }

    // 9. Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_QUEBRAS',
        record_id: arquivo_fonte || 'TODOS',
        new_data: {
          arquivo_fonte: arquivo_fonte || 'TODOS',
          registros_processados: totalProcessados,
          registros_quebrados: totalQuebrados,
          erros,
          detalhes: detalhesProcessamento
        },
        user_email: 'system',
        severity: 'info'
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      registros_processados: totalProcessados,
      registros_quebrados: totalQuebrados,
      erros,
      tipos_exames_quebrados: quebrasAgrupadas.size,
      detalhes_processamento: detalhesProcessamento,
      data_processamento: new Date().toISOString()
    };

    console.log('Processamento de quebras concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral no processamento de quebras:', error);
    
    const errorMessage = error.message || 'Erro interno do servidor';
    const errorStack = error.stack || 'Stack trace não disponível';
    
    console.error('Stack trace:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: errorMessage,
        detalhes: errorStack,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});