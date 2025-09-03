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

    console.log('🔄 Iniciando aplicação da regra v007 - Correções de especialidades problemáticas');
    
    // Lista padrão de médicos para Neuro
    const medicosNeuroDefault = [
      'Amauri Silva Sobrinho', 'Ana Carolina Ottaiano', 'Arthur de Freitas Ferreira',
      'Caio Batalha Pereira', 'Carlos Alexandre Martinelli', 'Daniela Cartolano',
      'Eduardo Walter Rabelo Arruda', 'Efraim da Silva Ferreira', 'Elton Dias Lopes Barud',
      'Eugenio Castro', 'Fábio Sânderson Fernandes', 'Fernanda Veloso Pereira',
      'Francisca Rocélia Silva de Freitas', 'Giovanna Martins', 'Gustavo Andreis',
      'Gustavo Coutinho Ferreira', 'Heliantho de Siqueira Lima Filho', 'Henrique Bortot Zuppani',
      'Jainy Sousa Oliveira', 'James Henrique Yared', 'Jander Luiz Bucker Filho',
      'Lara Macatrao Duarte Bacelar', 'Larissa Nara Costa Freitas', 'Luciane Lucas Lucio',
      'Luis Filipe Nagata Gasparini', 'Luis Tercio Feitosa Coelho', 'Marcelo Bandeira Filho',
      'Marcos Marins', 'Marcus Rogério Lola de Andrade', 'Mariana Helena do Carmo',
      'Marilia Assunção Jorge', 'Marlyson Luiz Olivier de Oliveira', 'Otto Wolf Maciel',
      'Paulo de Tarso Martins Ribeiro', 'Pericles Moraes Pereira', 'Rafaela Contesini Nivoloni',
      'Raissa Nery de Luna Freire Leite', 'Ricardo Jorge Vital', 'Thiago Bezerra Matias',
      'Tiago Oliveira Lordelo', 'Tomás Andrade Lourenção Freddi', 'Virgílio de Araújo Oliveira',
      'Yuri Aarão Amaral Serruya'
    ];

    // Função para normalizar nome do médico
    const normalizarNomeMedico = (nome: string): string => {
      if (!nome) return '';
      return nome
        .replace(/^DR[A]?\s+/i, '') // Remove DR/DRA no início
        .replace(/\s+/g, ' ') // Remove espaços extras
        .trim()
        .toUpperCase(); // Para comparação case-insensitive
    };

    // Cache para melhorar performance
    const medicosNeuroNormalizados = medicosNeuroDefault.map(normalizarNomeMedico);
    const medicosNeuroSet = new Set(medicosNeuroNormalizados);
    
    // Função para verificar se médico é neurologista (otimizada)
    const isMedicoNeuro = (medicoNome: string): boolean => {
      if (!medicoNome) return false;
      
      const medicoNormalizado = normalizarNomeMedico(medicoNome);
      
      // 1. Busca exata no Set (O(1))
      if (medicosNeuroSet.has(medicoNormalizado)) {
        return true;
      }
      
      // 2. Busca com remoção de acentos
      const medicoSemAcento = medicoNormalizado.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const neuroNormalizado of medicosNeuroNormalizados) {
        const neuroSemAcento = neuroNormalizado.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (medicoSemAcento === neuroSemAcento) {
          return true;
        }
      }
      
      // 3. Busca por substring (apenas para casos mais complexos)
      for (const neuroNormalizado of medicosNeuroNormalizados) {
        if (medicoNormalizado.includes(neuroNormalizado) || neuroNormalizado.includes(medicoNormalizado)) {
          return true;
        }
      }
      
      // 4. Comparação por primeiro e último nome
      const partesNormalizado = medicoNormalizado.split(' ').filter(p => p.length > 0);
      if (partesNormalizado.length >= 2) {
        const primeiroNome = partesNormalizado[0];
        const ultimoNome = partesNormalizado[partesNormalizado.length - 1];
        
        for (const neuroNormalizado of medicosNeuroNormalizados) {
          const partesNeuro = neuroNormalizado.split(' ').filter(p => p.length > 0);
          if (partesNeuro.length >= 2) {
            const primeiroNeuro = partesNeuro[0];
            const ultimoNeuro = partesNeuro[partesNeuro.length - 1];
            
            if (primeiroNome === primeiroNeuro && ultimoNome === ultimoNeuro) {
              return true;
            }
          }
        }
      }
      
      return false;
    };
    
    let totalCorrecoesColunas = 0;
    let totalCorrecoesNeuro = 0;
    let totalCorrecoesOncoMedInt = 0;
    let totalCategoriasAplicadas = 0;
    let totalErros = 0;
    
    // Definir tamanho do batch menor para evitar timeout
    const tamanhoBatch = 50;
    const tamanhoPagina = 500; // Reduzir tamanho das páginas

    // 1. Processar registros com especialidade "COLUNAS"
    console.log('📋 Processando especialidade COLUNAS → Músculo Esquelético/Neuro baseado no médico');
    
    // Buscar TODOS os registros com especialidade "COLUNAS" usando paginação
    let registrosColunas = [];
    let pagina = 0;
    let temMaisRegistros = true;
    
    console.log('🔍 Buscando todos os registros COLUNAS (sem limite)...');
    
    while (temMaisRegistros) {
      const { data: loteRegistros, error: selectError } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA", "MEDICO"')
        .eq('"ESPECIALIDADE"', 'COLUNAS')
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);
      
      if (selectError) {
        console.error('❌ Erro ao buscar registros COLUNAS:', selectError);
        totalErros++;
        break;
      }
      
      if (loteRegistros && loteRegistros.length > 0) {
        registrosColunas.push(...loteRegistros);
        console.log(`📄 Página ${pagina + 1}: ${loteRegistros.length} registros encontrados (total: ${registrosColunas.length})`);
        
        // Se o lote retornado tem menos que o tamanho da página, chegamos ao fim
        if (loteRegistros.length < tamanhoPagina) {
          temMaisRegistros = false;
        } else {
          pagina++;
        }
      } else {
        temMaisRegistros = false;
      }
    }
    
    console.log(`✅ Total de registros COLUNAS encontrados: ${registrosColunas.length}`);
    
    if (registrosColunas && registrosColunas.length > 0) {
      // Buscar cadastro de exames para aplicar categorias
      const { data: cadastroExames } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true);
      
      const mapaExames = new Map();
      cadastroExames?.forEach(exame => {
        if (exame.categoria) {
          mapaExames.set(exame.nome, exame.categoria);
        }
      });

      // Processar registros em lotes para melhor performance
      let registrosProcessados = 0;
      
      for (let i = 0; i < registrosColunas.length; i += tamanhoBatch) {
        const loteAtual = registrosColunas.slice(i, i + tamanhoBatch);
        console.log(`🔄 Processando lote ${Math.floor(i / tamanhoBatch) + 1}/${Math.ceil(registrosColunas.length / tamanhoBatch)} (${loteAtual.length} registros)`);
        
        // Preparar todas as atualizações do lote
        const atualizacoesBatch = [];
        
        for (const registro of loteAtual) {
          try {
            const medico = registro.MEDICO;
            let novaEspecialidade = 'MUSCULO ESQUELETICO'; // Padrão
            
            // Verificar se o médico está na lista de neurologistas
            if (isMedicoNeuro(medico)) {
              novaEspecialidade = 'Neuro';
            }
            
            // Preparar dados para atualização
            const dadosAtualizacao: any = {
              'ESPECIALIDADE': novaEspecialidade,
              updated_at: new Date().toISOString()
            };
            
            // Aplicar categoria do cadastro se disponível
            const categoriaCadastro = mapaExames.get(registro.ESTUDO_DESCRICAO);
            if (categoriaCadastro) {
              dadosAtualizacao['CATEGORIA'] = categoriaCadastro;
              totalCategoriasAplicadas++;
            }
            
            atualizacoesBatch.push({
              id: registro.id,
              dados: dadosAtualizacao,
              especialidade: novaEspecialidade
            });
            
          } catch (error) {
            console.error(`❌ Erro ao preparar atualização do registro ${registro.id}:`, error);
            totalErros++;
          }
        }
        
        // Executar atualizações do lote
        for (const atualizacao of atualizacoesBatch) {
          try {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update(atualizacao.dados)
              .eq('id', atualizacao.id);
            
            if (updateError) {
              console.error(`❌ Erro ao atualizar registro ${atualizacao.id}:`, updateError);
              totalErros++;
            } else {
              if (atualizacao.especialidade === 'Neuro') {
                totalCorrecoesNeuro++;
              } else {
                totalCorrecoesColunas++;
              }
              registrosProcessados++;
            }
          } catch (error) {
            console.error(`❌ Erro ao processar registro ${atualizacao.id}:`, error);
            totalErros++;
          }
        }
        
        console.log(`✅ Lote processado: ${registrosProcessados}/${registrosColunas.length} registros concluídos`);
      }
      
      console.log(`✅ ${totalCorrecoesColunas} registros COLUNAS → MUSCULO ESQUELETICO`);
      console.log(`✅ ${totalCorrecoesNeuro} registros COLUNAS → Neuro`);
    }

    // 2. Corrigir registros MUSCULO ESQUELETICO que deveriam ser Neuro
    console.log('📋 Corrigindo registros MUSCULO ESQUELETICO → Neuro para médicos neurologistas');
    
    // Buscar registros MUSCULO ESQUELETICO que podem ter sido classificados incorretamente
    let registrosMusculoEsqueletico = [];
    pagina = 0;
    temMaisRegistros = true;
    
    while (temMaisRegistros) {
      const { data: loteRegistros, error: selectError } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "MEDICO", "ESPECIALIDADE"')
        .eq('"ESPECIALIDADE"', 'MUSCULO ESQUELETICO')
        .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);
      
      if (selectError) {
        console.error('❌ Erro ao buscar registros MUSCULO ESQUELETICO:', selectError);
        totalErros++;
        break;
      }
      
      if (loteRegistros && loteRegistros.length > 0) {
        registrosMusculoEsqueletico.push(...loteRegistros);
        
        if (loteRegistros.length < tamanhoPagina) {
          temMaisRegistros = false;
        } else {
          pagina++;
        }
      } else {
        temMaisRegistros = false;
      }
    }
    
    console.log(`📊 Verificando ${registrosMusculoEsqueletico.length} registros MUSCULO ESQUELETICO...`);
    
    let corrigidasParaNeuro = 0;
    
    // Processar em lotes
    for (let i = 0; i < registrosMusculoEsqueletico.length; i += tamanhoBatch) {
      const loteAtual = registrosMusculoEsqueletico.slice(i, i + tamanhoBatch);
      
      for (const registro of loteAtual) {
        if (isMedicoNeuro(registro.MEDICO)) {
          try {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({ 
                'ESPECIALIDADE': 'Neuro',
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);
            
            if (updateError) {
              console.error(`❌ Erro ao corrigir registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              corrigidasParaNeuro++;
              totalCorrecoesNeuro++;
            }
          } catch (error) {
            console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
            totalErros++;
          }
        }
      }
    }
    
    console.log(`✅ ${corrigidasParaNeuro} registros MUSCULO ESQUELETICO corrigidos para Neuro`);

    // 3. Corrigir ONCO MEDICINA INTERNA → MEDICINA INTERNA
    console.log('📋 Corrigindo especialidade ONCO MEDICINA INTERNA → MEDICINA INTERNA');
    
    try {
      // Contar registros ONCO MEDICINA INTERNA
      const { count: countOncoMed, error: countError } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA');

      if (countError) {
        console.error('❌ Erro ao contar registros ONCO MEDICINA INTERNA:', countError);
        totalErros++;
      } else {
        totalCorrecoesOncoMedInt = countOncoMed || 0;
        console.log(`📊 Encontrados ${totalCorrecoesOncoMedInt} registros ONCO MEDICINA INTERNA para correção`);
        
        if (totalCorrecoesOncoMedInt > 0) {
          const { error: errorOncoMed } = await supabase
            .from('volumetria_mobilemed')
            .update({ 
              'ESPECIALIDADE': 'MEDICINA INTERNA',
              updated_at: new Date().toISOString()
            })
            .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA');

          if (errorOncoMed) {
            console.error('❌ Erro ao corrigir ONCO MEDICINA INTERNA:', errorOncoMed);
            totalErros++;
            totalCorrecoesOncoMedInt = 0;
          } else {
            console.log(`✅ ${totalCorrecoesOncoMedInt} correções ONCO MEDICINA INTERNA → MEDICINA INTERNA aplicadas`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro na correção ONCO MEDICINA INTERNA:', error);
      totalErros++;
      totalCorrecoesOncoMedInt = 0;
    }

    // Verificar resultado final
    const { data: verificacao, error: errorVerif } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESPECIALIDADE"')
      .in('"ESPECIALIDADE"', ['COLUNAS', 'ONCO MEDICINA INTERNA']);

    const registrosRestantes = verificacao?.length || 0;

    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_V007_ESPECIALIDADES',
        record_id: 'correções_massivas',
        new_data: {
          total_correcoes_colunas: totalCorrecoesColunas,
          total_correcoes_neuro: totalCorrecoesNeuro,
          total_correcoes_onco_med_int: totalCorrecoesOncoMedInt,
          total_categorias_aplicadas: totalCategoriasAplicadas,
          total_erros: totalErros,
          registros_restantes: registrosRestantes,
          timestamp: new Date().toISOString()
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });

    const resultado = {
      sucesso: totalErros === 0,
      total_correcoes_colunas: totalCorrecoesColunas,
      total_correcoes_neuro: totalCorrecoesNeuro,
      total_correcoes_onco_med_int: totalCorrecoesOncoMedInt,
      total_categorias_aplicadas: totalCategoriasAplicadas,
      total_erros: totalErros,
      registros_restantes: registrosRestantes,
      observacoes: `Regra v007 aplicada. ${totalCorrecoesColunas} → Músculo Esquelético, ${totalCorrecoesNeuro} → Neuro, ${totalCorrecoesOncoMedInt} → Medicina Interna, ${totalCategoriasAplicadas} categorias aplicadas.`
    };

    console.log('✅ Regra v007 aplicada com sucesso:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v007:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v007 - Correções de especialidades problemáticas'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});