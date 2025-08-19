import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte } = await req.json();
    
    console.log(`🔄 Iniciando aplicação da regra v033 e v034 - Substituição de Especialidade/Categoria para arquivo: ${arquivo_fonte}`);
    
    let totalProcessados = 0;
    let totalSubstituidos = 0;
    let totalErros = 0;
    
    // v033: Especialidades que devem ter substituição pelo cadastro
    const especialidadesAlvo = [
      'Cardio com Score',
      'Corpo', 
      'Onco Medicina Interna'
    ];
    
    // v034: Médicos que quando fazem exames "Colunas" devem ser alterados para "Neuro"
    const medicosNeuro = [
      'Amauri Silva Sobrinho',
      'Ana Carolina Ottaiano',
      'Arthur de Freitas Ferreira',
      'Caio Batalha Pereira',
      'Carlos Alexandre Martinelli',
      'Daniela Cartolano',
      'Eduardo Walter Rabelo Arruda',
      'Efraim da Silva Ferreira',
      'Elton Dias Lopes Barud',
      'Eugenio Castro',
      'Fábio Sânderson Fernandes',
      'Fernanda Veloso Pereira',
      'Francisca Rocélia Silva de Freitas',
      'Giovanna Martins',
      'Gustavo Andreis',
      'Gustavo Coutinho Ferreira',
      'Heliantho de Siqueira Lima Filho',
      'Henrique Bortot Zuppani',
      'Jainy Sousa Oliveira',
      'James Henrique Yared',
      'Jander Luiz Bucker Filho',
      'Lara Macatrao Duarte Bacelar',
      'Larissa Nara Costa Freitas',
      'Luciane Lucas Lucio',
      'Luis Filipe Nagata Gasparini',
      'Luis Tercio Feitosa Coelho',
      'Marcelo Bandeira Filho',
      'Marcos Marins',
      'Marcus Rogério Lola de Andrade',
      'Mariana Helena do Carmo',
      'Marilia Assunção Jorge',
      'Marlyson Luiz Olivier de Oliveira',
      'Otto Wolf Maciel',
      'Paulo de Tarso Martins Ribeiro',
      'Pericles Moraes Pereira',
      'Rafaela Contesini Nivoloni',
      'Raissa Nery de Luna Freire Leite',
      'Ricardo Jorge Vital',
      'Thiago Bezerra Matias',
      'Tiago Oliveira Lordelo',
      'Tomás Andrade Lourenção Freddi',
      'Virgílio de Araújo Oliveira',
      'Yuri Aarão Amaral Serruya'
    ];
    
    // Função para normalizar nomes de médicos para comparação
    const normalizarNomeMedico = (nome: string): string => {
      return nome.toLowerCase()
        .replace(/^dr\.?\s*/i, '')
        .replace(/^dra\.?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Função para normalizar especialidade
    const normalizarEspecialidade = (especialidade: string): string => {
      if (!especialidade) return especialidade;
      
      // Normalizar "Músculo Esquelético" e variações
      if (especialidade.toLowerCase().includes('músculo esquelético') || 
          especialidade.toLowerCase().includes('musculo esqueletico')) {
        return 'Músculo Esquelético';
      }
      
      return especialidade;
    };
    
    // Buscar todos os registros que precisam de processamento
    const { data: registrosParaSubstituir, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA", "MEDICO"')
      .or(`"ESPECIALIDADE".in.(${especialidadesAlvo.map(e => `"${e}"`).join(',')}),"ESPECIALIDADE".eq."Colunas"`)
      .eq('arquivo_fonte', arquivo_fonte);
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros para substituição:', selectError);
      throw selectError;
    }
    
    // Buscar TODOS os registros para aplicar categoria do cadastro de exames
    const { data: todosRegistros, error: selectAllError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "CATEGORIA"')
      .eq('arquivo_fonte', arquivo_fonte);
      
    if (selectAllError) {
      console.error('❌ Erro ao buscar todos os registros:', selectAllError);
      throw selectAllError;
    }
    
    const totalRegistrosEncontrados = (registrosParaSubstituir?.length || 0) + (todosRegistros?.length || 0);
    
    if (totalRegistrosEncontrados === 0) {
      console.log('✅ Nenhum registro encontrado para processamento');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_substituidos: 0,
          total_erros: 0,
          arquivo_fonte,
          observacoes: 'Nenhum registro necessitou processamento'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosParaSubstituir?.length || 0} registros para substituição de especialidade`);
    console.log(`📊 Encontrados ${todosRegistros?.length || 0} registros para aplicação de categoria`);
    
    // Buscar cadastro de exames para usar como referência
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, especialidade, categoria')
      .eq('ativo', true);
    
    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError);
      throw cadastroError;
    }
    
    // Criar mapa de exames para busca eficiente
    const mapaExames = new Map();
    cadastroExames?.forEach(exame => {
      mapaExames.set(exame.nome, {
        especialidade: exame.especialidade,
        categoria: exame.categoria
      });
    });
    
    let totalProcessadosV034 = 0;
    let totalSubstituidosV034 = 0;
    let totalCategoriasAplicadas = 0;
    
    // 1. PROCESSAR REGRA v033 (especialidades específicas pelo cadastro)
    if (registrosParaSubstituir && registrosParaSubstituir.length > 0) {
      console.log('🔄 Processando regra v033...');
      for (const registro of registrosParaSubstituir) {
        // Só processar se for uma das especialidades v033
        if (especialidadesAlvo.includes(registro.ESPECIALIDADE)) {
          totalProcessados++;
          
          try {
            const nomeExame = registro.ESTUDO_DESCRICAO;
            const dadosCadastro = mapaExames.get(nomeExame);
            
            if (dadosCadastro) {
              // Atualizar especialidade e categoria baseado no cadastro
              const { error: updateError } = await supabase
                .from('volumetria_mobilemed')
                .update({
                  'ESPECIALIDADE': dadosCadastro.especialidade,
                  'CATEGORIA': dadosCadastro.categoria,
                  updated_at: new Date().toISOString()
                })
                .eq('id', registro.id);
              
              if (updateError) {
                console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
                totalErros++;
              } else {
                totalSubstituidos++;
                console.log(`✅ v033 - Substituído: ${nomeExame} - Especialidade: ${registro.ESPECIALIDADE} → ${dadosCadastro.especialidade}, Categoria: ${registro.CATEGORIA} → ${dadosCadastro.categoria}`);
              }
            } else {
              console.log(`⚠️ v033 - Exame não encontrado no cadastro: ${nomeExame}`);
            }
          } catch (error) {
            console.error(`❌ v033 - Erro ao processar registro ${registro.id}:`, error);
            totalErros++;
          }
        }
      }
    }
    
    // 2. PROCESSAR REGRA v034 (Colunas -> Neuro ou Músculo Esquelético)
    console.log('🔄 Processando regra v034...');
    if (registrosParaSubstituir && registrosParaSubstituir.length > 0) {
      const registrosColunas = registrosParaSubstituir.filter(r => r.ESPECIALIDADE === 'Colunas');
      
      for (const registro of registrosColunas) {
        totalProcessadosV034++;
        
        try {
          const nomeMedicoNormalizado = normalizarNomeMedico(registro.MEDICO || '');
          
          // Verificar se o médico está na lista de médicos que fazem Neuro
          const medicoFazNeuro = medicosNeuro.some(medico => 
            normalizarNomeMedico(medico) === nomeMedicoNormalizado
          );
          
          const novaEspecialidade = medicoFazNeuro ? 'Neuro' : 'Músculo Esquelético';
          
          // Buscar categoria no cadastro de exames se disponível
          const nomeExame = registro.ESTUDO_DESCRICAO;
          const dadosCadastro = mapaExames.get(nomeExame);
          const novaCategoria = dadosCadastro?.categoria || registro.CATEGORIA;
          
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update({
              'ESPECIALIDADE': novaEspecialidade,
              'CATEGORIA': novaCategoria,
              updated_at: new Date().toISOString()
            })
            .eq('id', registro.id);
          
          if (updateError) {
            console.error(`❌ v034 - Erro ao atualizar registro ${registro.id}:`, updateError);
            totalErros++;
          } else {
            totalSubstituidosV034++;
            console.log(`✅ v034 - Colunas → ${novaEspecialidade}: ${nomeExame} (${registro.MEDICO})`);
          }
        } catch (error) {
          console.error(`❌ v034 - Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
      }
    }
    
    // 3. APLICAR CATEGORIA DO CADASTRO DE EXAMES PARA TODOS OS REGISTROS
    console.log('🔄 Aplicando categorias do cadastro de exames...');
    if (todosRegistros && todosRegistros.length > 0) {
      for (const registro of todosRegistros) {
        try {
          const nomeExame = registro.ESTUDO_DESCRICAO;
          const dadosCadastro = mapaExames.get(nomeExame);
          
          // Só atualizar se encontrou no cadastro e a categoria é diferente
          if (dadosCadastro && dadosCadastro.categoria && dadosCadastro.categoria !== registro.CATEGORIA) {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({
                'CATEGORIA': dadosCadastro.categoria,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);
            
            if (updateError) {
              console.error(`❌ Categoria - Erro ao atualizar registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              totalCategoriasAplicadas++;
              console.log(`✅ Categoria aplicada: ${nomeExame} - ${registro.CATEGORIA} → ${dadosCadastro.categoria}`);
            }
          }
        } catch (error) {
          console.error(`❌ Categoria - Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
      }
    }
    
    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRA_V033_V034_SUBSTITUICAO_ESPECIALIDADE',
        record_id: arquivo_fonte,
        new_data: {
          total_processados_v033: totalProcessados,
          total_substituidos_v033: totalSubstituidos,
          total_processados_v034: totalProcessadosV034,
          total_substituidos_v034: totalSubstituidosV034,
          total_categorias_aplicadas: totalCategoriasAplicadas,
          total_erros: totalErros,
          arquivo_fonte,
          especialidades_alvo: especialidadesAlvo,
          medicos_neuro_count: medicosNeuro.length
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_processados_v033: totalProcessados,
      total_substituidos_v033: totalSubstituidos,
      total_processados_v034: totalProcessadosV034,
      total_substituidos_v034: totalSubstituidosV034,
      total_categorias_aplicadas: totalCategoriasAplicadas,
      total_erros: totalErros,
      arquivo_fonte,
      observacoes: `Regras v033 e v034 aplicadas com sucesso. v033: ${totalSubstituidos} registros. v034: ${totalSubstituidosV034} registros Colunas processados. Categorias: ${totalCategoriasAplicadas} atualizadas.`
    };
    
    console.log('✅ Regras v033 e v034 aplicadas com sucesso:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v033:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v033 - Substituição de Especialidade/Categoria'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});