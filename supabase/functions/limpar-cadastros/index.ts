import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Receber opções do body da requisição
    const options = await req.json();
    console.log('Opções recebidas:', options);

    const tabelasLimpas: string[] = [];
    let totalLimpezas = 0;

    // Limpar tabela de cadastro de exames se solicitado
    if (options.cadastro_exames) {
      console.log('Limpando tabela cadastro_exames...');
      const { error: errorCadastro, count } = await supabase
        .from('cadastro_exames')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorCadastro) {
        console.error('Erro ao limpar cadastro_exames:', errorCadastro);
      } else {
        console.log('Tabela cadastro_exames limpa com sucesso');
        tabelasLimpas.push('cadastro_exames');
        totalLimpezas += count || 0;
      }
    }

    // Limpar tabela de regras de quebra de exames se solicitado
    if (options.quebra_exames) {
      console.log('Limpando tabela regras_quebra_exames...');
      const { error: errorQuebra, count } = await supabase
        .from('regras_quebra_exames')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorQuebra) {
        console.error('Erro ao limpar regras_quebra_exames:', errorQuebra);
      } else {
        console.log('Tabela regras_quebra_exames limpa com sucesso');
        tabelasLimpas.push('regras_quebra_exames');
        totalLimpezas += count || 0;
      }
    }

    // Limpar tabela de preços de serviços se solicitado
    if (options.precos_servicos) {
      console.log('Limpando tabela precos_servicos...');
      const { error: errorPrecos, count } = await supabase
        .from('precos_servicos')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorPrecos) {
        console.error('Erro ao limpar precos_servicos:', errorPrecos);
      } else {
        console.log('Tabela precos_servicos limpa com sucesso');
        tabelasLimpas.push('precos_servicos');
        totalLimpezas += count || 0;
      }
    }

    // Limpar tabela de regras de exclusão se solicitado
    if (options.regras_exclusao) {
      console.log('Limpando tabela regras_exclusao...');
      const { error: errorRegras, count } = await supabase
        .from('regras_exclusao')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorRegras) {
        console.error('Erro ao limpar regras_exclusao:', errorRegras);
      } else {
        console.log('Tabela regras_exclusao limpa com sucesso');
        tabelasLimpas.push('regras_exclusao');
        totalLimpezas += count || 0;
      }
    }

    // Limpar tabela de valores de repasse médicos se solicitado
    if (options.medicos_valores_repasse) {
      console.log('Limpando tabela medicos_valores_repasse...');
      const { error: errorRepasse, count } = await supabase
        .from('medicos_valores_repasse')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorRepasse) {
        console.error('Erro ao limpar medicos_valores_repasse:', errorRepasse);
      } else {
        console.log('Tabela medicos_valores_repasse limpa com sucesso');
        tabelasLimpas.push('medicos_valores_repasse');
        totalLimpezas += count || 0;
      }
    }

    // Limpar modalidades se solicitado
    if (options.modalidades) {
      console.log('Limpando tabela modalidades...');
      const { error: errorModalidades, count } = await supabase
        .from('modalidades')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorModalidades) {
        console.error('Erro ao limpar modalidades:', errorModalidades);
      } else {
        console.log('Tabela modalidades limpa com sucesso');
        tabelasLimpas.push('modalidades');
        totalLimpezas += count || 0;
      }
    }

    // Limpar especialidades se solicitado
    if (options.especialidades) {
      console.log('Limpando tabela especialidades...');
      const { error: errorEspecialidades, count } = await supabase
        .from('especialidades')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorEspecialidades) {
        console.error('Erro ao limpar especialidades:', errorEspecialidades);
      } else {
        console.log('Tabela especialidades limpa com sucesso');
        tabelasLimpas.push('especialidades');
        totalLimpezas += count || 0;
      }
    }

    // Limpar categorias de exame se solicitado
    if (options.categorias_exame) {
      console.log('Limpando tabela categorias_exame...');
      const { error: errorCategorias, count } = await supabase
        .from('categorias_exame')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorCategorias) {
        console.error('Erro ao limpar categorias_exame:', errorCategorias);
      } else {
        console.log('Tabela categorias_exame limpa com sucesso');
        tabelasLimpas.push('categorias_exame');
        totalLimpezas += count || 0;
      }
    }

    // Limpar prioridades se solicitado
    if (options.prioridades) {
      console.log('Limpando tabela prioridades...');
      const { error: errorPrioridades, count } = await supabase
        .from('prioridades')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorPrioridades) {
        console.error('Erro ao limpar prioridades:', errorPrioridades);
      } else {
        console.log('Tabela prioridades limpa com sucesso');
        tabelasLimpas.push('prioridades');
        totalLimpezas += count || 0;
      }
    }

    // Mapeamento de tabelas para tipos de arquivo
    const tipoArquivoMap = {
      'cadastro_exames': 'cadastro_exames',
      'regras_quebra_exames': 'quebra_exames',
      'precos_servicos': 'precos_servicos',
      'regras_exclusao': 'regras_exclusao',
      'medicos_valores_repasse': 'repasse_medico',
      'modalidades': 'modalidades',
      'especialidades': 'especialidades',
      'categorias_exame': 'categorias_exame',
      'prioridades': 'prioridades'
    };

    // Coletar tipos de arquivo para limpar logs automaticamente
    const tiposArquivoParaLimpar: string[] = [];
    tabelasLimpas.forEach(tabela => {
      const tipoArquivo = tipoArquivoMap[tabela as keyof typeof tipoArquivoMap];
      if (tipoArquivo) {
        tiposArquivoParaLimpar.push(tipoArquivo);
      }
    });

    // Limpar logs relacionados às tabelas que foram limpas
    if (tiposArquivoParaLimpar.length > 0) {
      console.log('Limpando logs relacionados aos tipos:', tiposArquivoParaLimpar);
      const { error: errorLogsRelacionados, count: logsRemovidos } = await supabase
        .from('processamento_uploads')
        .delete()
        .in('tipo_arquivo', tiposArquivoParaLimpar);

      if (errorLogsRelacionados) {
        console.error('Erro ao limpar logs relacionados:', errorLogsRelacionados);
      } else {
        console.log(`Logs relacionados limpos com sucesso: ${logsRemovidos} registros removidos`);
      }
    }

    // Limpar logs de processamento explicitamente se solicitado
    if (options.logs_uploads) {
      console.log('Limpando logs de processamento explicitos...');
      const { error: errorLogs, count } = await supabase
        .from('processamento_uploads')
        .delete()
        .not('tipo_arquivo', 'in', ['limpeza']); // Preservar logs de limpeza

      if (errorLogs) {
        console.error('Erro ao limpar logs explicitos:', errorLogs);
      } else {
        console.log('Logs de processamento explicitos limpos com sucesso');
        tabelasLimpas.push('processamento_uploads');
        totalLimpezas += count || 0;
      }
    }

    // Log da operação de limpeza usando valores válidos para o constraint
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: 'limpeza_sistema',
        tipo_arquivo: 'limpeza',
        tipo_dados: 'incremental',
        status: 'concluido',
        registros_processados: totalLimpezas,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        tamanho_arquivo: 0
      });

    if (logError) {
      console.error('Erro ao registrar log de limpeza:', logError);
    }

    const resultado = {
      sucesso: true,
      message: `Limpeza realizada com sucesso. ${totalLimpezas} registros removidos.`,
      tabelas_limpas: tabelasLimpas,
      total_registros_removidos: totalLimpezas,
      timestamp: new Date().toISOString()
    };

    console.log('Limpeza concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na limpeza:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});