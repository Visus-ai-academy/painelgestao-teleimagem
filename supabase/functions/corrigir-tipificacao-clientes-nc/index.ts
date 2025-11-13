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

    const { periodo_referencia } = await req.json();

    if (!periodo_referencia) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'periodo_referencia é obrigatório'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`🔧 Iniciando correção de tipificação de clientes NC para período ${periodo_referencia}...`);

    // 1. Buscar todos os clientes NC com contratos
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
    let contratosCorrigidos = 0;
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
      console.log('✅ Todos os contratos já estão corretos');
    }

    // 3. FORÇAR tipificação COMPLETA para clientes NC no período específico
    let tipificacaoResult = null;
    
    console.log(`🔄 FORÇANDO tipificação COMPLETA para clientes NC no período ${periodo_referencia}...`);
    
    // Buscar registros dos clientes NC no período específico que precisam de tipificação
    const queryRegistros = supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "MEDICO"')
      .in('EMPRESA', CLIENTES_NC)
      .eq('periodo_referencia', periodo_referencia);
    
    const { data: registros, error: registrosError } = await queryRegistros;

    if (registrosError) {
      console.error('❌ Erro ao buscar registros:', registrosError);
      tipificacaoResult = {
        registros_processados: 0,
        registros_com_erro: 0,
        registros_tipificados: 0
      };
    } else {
      console.log(`📊 Encontrados ${registros?.length || 0} registros de clientes NC para re-tipificar`);

      if (registros && registros.length > 0) {
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

        // Processar em lotes de 500 registros
        const BATCH_SIZE = 500;
        let totalProcessados = 0;
        let totalAtualizados = 0;
        let totalComErro = 0;

        for (let i = 0; i < registros.length; i += BATCH_SIZE) {
          const batch = registros.slice(i, i + BATCH_SIZE);
          console.log(`📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(registros.length / BATCH_SIZE)} (${batch.length} registros)...`);

          // Preparar updates
          const updates = batch.map(record => {
            const { tipo_faturamento, tipo_cliente } = determinarTipoFaturamento(record);
            return {
              id: record.id,
              tipo_faturamento,
              tipo_cliente
            };
          });

          // Atualizar em lote
          for (const update of updates) {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({
                tipo_faturamento: update.tipo_faturamento,
                tipo_cliente: update.tipo_cliente
              })
              .eq('id', update.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar registro ${update.id}:`, updateError);
              totalComErro++;
            } else {
              totalAtualizados++;
            }
          }

          totalProcessados += batch.length;
          console.log(`✅ Lote processado: ${totalAtualizados} atualizados, ${totalComErro} erros`);
        }

        tipificacaoResult = {
          registros_processados: totalProcessados,
          registros_tipificados: totalAtualizados,
          registros_com_erro: totalComErro
        };
      } else {
        console.log('⚠️ Nenhum registro encontrado');
        tipificacaoResult = {
          registros_processados: 0,
          registros_tipificados: 0,
          registros_com_erro: 0
        };
      }
    }

    // 4. Estatísticas finais - buscar do banco APÓS aplicar tipificação (apenas clientes NC no período)
    const { data: volumetriaStats } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA", tipo_cliente, tipo_faturamento')
      .in('EMPRESA', CLIENTES_NC)
      .eq('periodo_referencia', periodo_referencia);

    const estatisticas = {
      por_cliente: {} as Record<string, any>
    };

    // Agrupar por cliente mostrando APENAS os valores do contrato
    volumetriaStats?.forEach((record: any) => {
      const empresa = record.EMPRESA;
      const key = `${record.tipo_cliente}_${record.tipo_faturamento}`;
      
      if (!estatisticas.por_cliente[empresa]) {
        estatisticas.por_cliente[empresa] = {};
      }
      
      if (!estatisticas.por_cliente[empresa][key]) {
        estatisticas.por_cliente[empresa][key] = {
          total: 0,
          tipo_cliente: record.tipo_cliente,
          tipo_faturamento: record.tipo_faturamento
        };
      }
      estatisticas.por_cliente[empresa][key].total++;
    });

    const resultado = {
      sucesso: true,
      clientes_nc_cadastrados: CLIENTES_NC.length,
      clientes_nc_encontrados: clientesNC?.length || 0,
      contratos_corrigidos: contratosCorrigidos,
      tipificacao: tipificacaoResult,
      estatisticas: estatisticas,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Correção concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
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
