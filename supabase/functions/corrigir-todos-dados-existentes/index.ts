import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando correção completa de TODOS os dados existentes');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalProcessados = 0;
    let totalAtualizados = 0;
    const resultados = [];

    // Processar TODOS os arquivos sem limitação
    const arquivos = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'];

    for (const arquivo of arquivos) {
      console.log(`\n📂 Processando arquivo: ${arquivo}`);
      
      // Buscar TODOS os registros do arquivo (sem LIMIT)
      const { data: registros, error: errorRegistros } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('arquivo_fonte', arquivo);

      if (errorRegistros) {
        console.error(`❌ Erro ao buscar registros do ${arquivo}:`, errorRegistros);
        continue;
      }

      if (!registros || registros.length === 0) {
        console.log(`ℹ️ Nenhum registro encontrado em ${arquivo}`);
        continue;
      }

      console.log(`📊 Encontrados ${registros.length} registros em ${arquivo}`);
      totalProcessados += registros.length;

      let atualizadosArquivo = 0;

      // Processar TODOS os registros sem limitação de batch
      for (let i = 0; i < registros.length; i++) {
        const registro = registros[i];
        let precisaAtualizar = false;
        const updates: any = {};

        // 1. Aplicar limpeza do nome do cliente
        if (registro.EMPRESA) {
          const empresaLimpa = limparNomeCliente(registro.EMPRESA);
          if (empresaLimpa !== registro.EMPRESA) {
            updates.EMPRESA = empresaLimpa;
            precisaAtualizar = true;
          }
        }

        // 2. Aplicar normalização do médico
        if (registro.MEDICO) {
          const medicoNormalizado = normalizarMedico(registro.MEDICO);
          if (medicoNormalizado !== registro.MEDICO) {
            updates.MEDICO = medicoNormalizado;
            precisaAtualizar = true;
          }
        }

        // 3. Aplicar correções de modalidade
        if (registro.MODALIDADE === 'CR' || registro.MODALIDADE === 'DX') {
          const novaModalidade = registro.ESTUDO_DESCRICAO === 'MAMOGRAFIA' ? 'MG' : 'RX';
          if (novaModalidade !== registro.MODALIDADE) {
            updates.MODALIDADE = novaModalidade;
            precisaAtualizar = true;
          }
        }
        if (registro.MODALIDADE === 'OT') {
          updates.MODALIDADE = 'DO';
          precisaAtualizar = true;
        }

        // 4. Aplicar categorias (se vazia ou SC)
        if (!registro.CATEGORIA || registro.CATEGORIA === '' || registro.CATEGORIA === 'SC') {
          // Buscar categoria no cadastro_exames
          const { data: examesCadastro } = await supabase
            .from('cadastro_exames')
            .select('categoria')
            .eq('nome', registro.ESTUDO_DESCRICAO)
            .eq('ativo', true)
            .not('categoria', 'is', null)
            .limit(1);

          const novaCategoria = examesCadastro?.[0]?.categoria || 'SC';
          if (novaCategoria !== registro.CATEGORIA) {
            updates.CATEGORIA = novaCategoria;
            precisaAtualizar = true;
          }
        }

        // 5. Aplicar especialidades (se vazia ou GERAL)
        if (!registro.ESPECIALIDADE || registro.ESPECIALIDADE === '' || registro.ESPECIALIDADE === 'GERAL') {
          // Buscar especialidade no cadastro_exames
          const { data: examesCadastro } = await supabase
            .from('cadastro_exames')
            .select('especialidade')
            .eq('nome', registro.ESTUDO_DESCRICAO)
            .eq('ativo', true)
            .not('especialidade', 'is', null)
            .limit(1);

          const novaEspecialidade = examesCadastro?.[0]?.especialidade || 'GERAL';
          if (novaEspecialidade !== registro.ESPECIALIDADE) {
            updates.ESPECIALIDADE = novaEspecialidade;
            precisaAtualizar = true;
          }
        }

        // 6. Aplicar De-Para de Prioridades
        if (registro.PRIORIDADE) {
          const { data: prioridadeMap } = await supabase
            .from('valores_prioridade_de_para')
            .select('nome_final')
            .eq('prioridade_original', registro.PRIORIDADE)
            .eq('ativo', true)
            .limit(1);

          if (prioridadeMap?.[0]?.nome_final && prioridadeMap[0].nome_final !== registro.PRIORIDADE) {
            updates.PRIORIDADE = prioridadeMap[0].nome_final;
            precisaAtualizar = true;
          }
        }

        // 7. Aplicar De-Para de Valores (se VALORES é 0 ou null)
        if (!registro.VALORES || registro.VALORES === 0) {
          const { data: valorRef } = await supabase
            .from('valores_referencia_de_para')
            .select('valores')
            .ilike('estudo_descricao', registro.ESTUDO_DESCRICAO)
            .eq('ativo', true)
            .limit(1);

          if (valorRef?.[0]?.valores) {
            updates.VALORES = valorRef[0].valores;
            precisaAtualizar = true;
          }
        }

        // 8. Aplicar tipificação de faturamento
        if (!registro.tipo_faturamento || registro.tipo_faturamento === '') {
          let tipoFaturamento = 'padrao';
          
          if (registro.CATEGORIA && ['onco', 'Onco', 'ONCO'].includes(registro.CATEGORIA)) {
            tipoFaturamento = 'oncologia';
          } else if (registro.PRIORIDADE && ['urgência', 'urgencia', 'URGENCIA'].includes(registro.PRIORIDADE)) {
            tipoFaturamento = 'urgencia';
          } else if (registro.MODALIDADE && ['CT', 'MR'].includes(registro.MODALIDADE)) {
            tipoFaturamento = 'alta_complexidade';
          }

          if (tipoFaturamento !== registro.tipo_faturamento) {
            updates.tipo_faturamento = tipoFaturamento;
            precisaAtualizar = true;
          }
        }

        // 9. Garantir data de referência
        if (!registro.data_referencia && registro.DATA_REALIZACAO) {
          updates.data_referencia = registro.DATA_REALIZACAO;
          precisaAtualizar = true;
        }

        // Atualizar se necessário
        if (precisaAtualizar) {
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update(updates)
            .eq('id', registro.id);

          if (!updateError) {
            atualizadosArquivo++;
            totalAtualizados++;
          } else {
            console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
          }
        }

        // Log de progresso a cada 1000 registros
        if ((i + 1) % 1000 === 0) {
          console.log(`⏳ Progresso ${arquivo}: ${i + 1}/${registros.length} (${atualizadosArquivo} atualizados)`);
        }
      }

      console.log(`✅ ${arquivo} concluído: ${atualizadosArquivo}/${registros.length} registros atualizados`);
      
      resultados.push({
        arquivo_fonte: arquivo,
        registros_processados: registros.length,
        registros_atualizados: atualizadosArquivo
      });
    }

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_COMPLETA_DADOS_EXISTENTES',
        record_id: 'todos_arquivos',
        new_data: {
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          detalhes_por_arquivo: resultados,
          data_correcao: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_atualizados: totalAtualizados,
      detalhes_por_arquivo: resultados,
      data_processamento: new Date().toISOString(),
      observacao: `Correção completa aplicada em TODOS os ${totalProcessados} registros existentes`
    };

    console.log('🎉 Correção completa concluída:', resultado);

    return new Response(JSON.stringify(resultado), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('💥 Erro na correção completa:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});

// Funções auxiliares
function limparNomeCliente(nome: string): string {
  if (!nome) return nome;
  
  let nomeLimpo = nome;
  
  // Mapeamentos específicos
  const mapeamentos: Record<string, string> = {
    'INTERCOR2': 'INTERCOR',
    'P-HADVENTISTA': 'HADVENTISTA',
    'P-UNIMED_CARUARU': 'UNIMED_CARUARU',
    'PRN - MEDIMAGEM CAMBORIU': 'MEDIMAGEM_CAMBORIU',
    'UNIMAGEM_CENTRO': 'UNIMAGEM_ATIBAIA',
    'VIVERCLIN 2': 'VIVERCLIN',
    'CEDI-RJ': 'CEDIDIAG',
    'CEDI-RO': 'CEDIDIAG',
    'CEDI-UNIMED': 'CEDIDIAG',
    'CEDI_RJ': 'CEDIDIAG',
    'CEDI_RO': 'CEDIDIAG',
    'CEDI_UNIMED': 'CEDIDIAG'
  };
  
  if (mapeamentos[nomeLimpo]) {
    nomeLimpo = mapeamentos[nomeLimpo];
  } else {
    // Aplicar regras de remoção de sufixos
    nomeLimpo = nomeLimpo.replace(/- TELE$/, '');
    nomeLimpo = nomeLimpo.replace(/-CT$/, '');
    nomeLimpo = nomeLimpo.replace(/-MR$/, '');
    nomeLimpo = nomeLimpo.replace(/_PLANTÃO$/, '');
    nomeLimpo = nomeLimpo.replace(/_RMX$/, '');
  }
  
  return nomeLimpo.trim();
}

function normalizarMedico(medico: string): string {
  if (!medico) return medico;
  
  let medicoLimpo = medico;
  
  // Remover códigos entre parênteses
  medicoLimpo = medicoLimpo.replace(/\s*\([^)]*\)\s*/g, '');
  
  // Remover DR/DRA no início
  medicoLimpo = medicoLimpo.replace(/^DR[A]?\s+/i, '');
  
  // Remover pontos finais
  medicoLimpo = medicoLimpo.replace(/\.$/, '');
  
  return medicoLimpo.trim();
}