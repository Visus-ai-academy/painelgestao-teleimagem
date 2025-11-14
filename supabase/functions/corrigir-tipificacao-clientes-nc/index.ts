import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de clientes NC que devem ter tipo_cliente = 'NC'
const CLIENTES_NC = [
  "CDICARDIO",
  "CDIGOIAS",
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "TRANSDUSON",
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo_referencia, resume_from = 0, max_batches = 5 } = await req.json();

    if (!periodo_referencia) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'periodo_referencia é obrigatório'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`🔧 Iniciando correção de tipificação de clientes NC para período ${periodo_referencia} (lote ${resume_from})...`);

    // 1. Buscar todos os clientes NC com contratos (somente na primeira chamada)
    let contratosCorrigidos = 0;
    if (resume_from === 0) {
      const { data: clientesNC, error: clientesError } = await supabase
        .from('clientes')
        .select(`
          id,
          nome,
          nome_fantasia,
          contratos_clientes (
            id,
            tipo_cliente,
            tipo_faturamento,
            status
          )
        `)
        .in('nome', CLIENTES_NC);

      if (clientesError) {
        throw clientesError;
      }

      console.log(`📋 Encontrados ${clientesNC?.length || 0} clientes NC no sistema`);

      // 2. Corrigir contratos com tipo_cliente incorreto
      const contratosParaCorrigir: string[] = [];

      for (const cliente of clientesNC || []) {
        if (cliente.contratos_clientes) {
          for (const contrato of cliente.contratos_clientes) {
            if (contrato.tipo_cliente !== 'NC' && contrato.status === 'ativo') {
              contratosParaCorrigir.push(contrato.id);
              console.log(`⚠️  ${cliente.nome}: contrato ${contrato.id} com tipo_cliente incorreto (${contrato.tipo_cliente})`);
            }
          }
        }
      }

      if (contratosParaCorrigir.length > 0) {
        console.log(`🔧 Corrigindo ${contratosParaCorrigir.length} contratos...`);
        
        for (const contratoId of contratosParaCorrigir) {
          const { error: updateError } = await supabase
            .from('contratos_clientes')
            .update({ tipo_cliente: 'NC' })
            .eq('id', contratoId);

          if (updateError) {
            console.error(`❌ Erro ao corrigir contrato ${contratoId}:`, updateError);
          } else {
            contratosCorrigidos++;
          }
        }

        console.log(`✅ ${contratosCorrigidos} contratos corrigidos`);
      } else {
        console.log(`✅ Todos os contratos já estão corretos`);
      }
    }

    // 3. Buscar registros dos clientes NC no período específico
    console.log(`🔄 Buscando registros para tipificação no período ${periodo_referencia}...`);
    
    const { data: registros, error: registrosError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "MEDICO"')
      .in('EMPRESA', CLIENTES_NC)
      .eq('periodo_referencia', periodo_referencia);

    if (registrosError) {
      throw registrosError;
    }

    const totalRegistros = registros?.length || 0;
    console.log(`📊 Total de ${totalRegistros} registros encontrados`);

    if (totalRegistros === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        concluido: true,
        contratos_corrigidos: contratosCorrigidos,
        lotes_processados: 0,
        registros_processados: 0,
        registros_tipificados: 0,
        registros_com_erro: 0,
        total_registros: 0,
        total_lotes: 0,
        next_resume: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Médicos da Equipe 2
    const MEDICOS_EQUIPE_2 = [
      'Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 
      'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 
      'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 
      'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 
      'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 
      'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 
      'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 
      'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 
      'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 
      'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'
    ];

    // Clientes NC que seguem regra: Cardio OU Plantão
    const CLIENTES_CARDIO_OU_PLANTAO = [
      'CDICARDIO', 'CDIGOIAS', 'CISP', 'CRWANDERLEY', 'DIAGMAX-PR', 'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO'
    ];

    // Clientes NC que seguem regra: Cardio E Plantão
    const CLIENTES_CARDIO_E_PLANTAO = ['CEMVALENCA', 'RMPADUA'];

    // Cliente especial RADI-IMAGEM
    const RADI_IMAGEM = 'RADI-IMAGEM';

    // Função de tipificação
    const determinarTipoFaturamento = (record: any): { tipo_faturamento: string; tipo_cliente: string } => {
      const empresa = record.EMPRESA;
      const modalidade = record.MODALIDADE || '';
      const especialidade = record.ESPECIALIDADE || '';
      const categoria = record.CATEGORIA || '';
      const prioridade = record.PRIORIDADE || '';
      const medico = record.MEDICO || '';

      const isCardio = especialidade.toLowerCase().includes('cardio') || 
                      modalidade.toLowerCase().includes('cardio');
      const isPlantao = prioridade === 'URGENTE';
      const isEquipe2 = MEDICOS_EQUIPE_2.includes(medico);

      // Cliente especial: RADI-IMAGEM
      if (empresa === RADI_IMAGEM) {
        if (isEquipe2) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'CO-FT', tipo_cliente: 'CO' };
      }

      // Clientes NC: Cardio OU Plantão
      if (CLIENTES_CARDIO_OU_PLANTAO.includes(empresa)) {
        if (isCardio || isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // Clientes NC: Cardio E Plantão
      if (CLIENTES_CARDIO_E_PLANTAO.includes(empresa)) {
        if (isCardio && isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // Cliente CLIRAM: apenas Equipe2
      if (empresa === 'CLIRAM') {
        if (isEquipe2) {
          return { tipo_faturamento: 'NC1-NF', tipo_cliente: 'NC1' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // Padrão para clientes NC
      return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
    };

    // Processar em lotes
    const BATCH_SIZE = 300;
    const totalLotes = Math.ceil(totalRegistros / BATCH_SIZE);
    const startBatch = resume_from;
    const endBatch = Math.min(startBatch + max_batches, totalLotes);
    
    let totalAtualizados = 0;
    let totalComErro = 0;

    console.log(`📦 Processando lotes ${startBatch + 1} a ${endBatch} de ${totalLotes}...`);

    for (let loteAtual = startBatch; loteAtual < endBatch; loteAtual++) {
      const startIdx = loteAtual * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalRegistros);
      const batch = registros.slice(startIdx, endIdx);
      
      console.log(`📦 Processando lote ${loteAtual + 1}/${totalLotes} (${batch.length} registros)...`);

      // Preparar e executar updates
      for (const record of batch) {
        const { tipo_faturamento, tipo_cliente } = determinarTipoFaturamento(record);
        
        const { error: updateError } = await supabase
          .from('volumetria_mobilemed')
          .update({
            tipo_faturamento,
            tipo_cliente
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar registro ${record.id}:`, updateError);
          totalComErro++;
        } else {
          totalAtualizados++;
        }
      }

      console.log(`✅ Lote ${loteAtual + 1} processado: ${totalAtualizados} atualizados, ${totalComErro} erros`);
    }

    const lotesProcessados = endBatch - startBatch;
    const concluido = endBatch >= totalLotes;
    const nextResume = concluido ? null : endBatch;

    console.log(`✅ Chunk concluído: ${lotesProcessados} lotes processados, ${totalAtualizados} registros tipificados`);

    return new Response(JSON.stringify({
      sucesso: true,
      concluido,
      contratos_corrigidos: contratosCorrigidos,
      lotes_processados: lotesProcessados,
      registros_processados: lotesProcessados * BATCH_SIZE,
      registros_tipificados: totalAtualizados,
      registros_com_erro: totalComErro,
      total_registros: totalRegistros,
      total_lotes: totalLotes,
      next_resume: nextResume
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
