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

    // Função avançada para verificar se nomes coincidem (incluindo abreviações)
    const nomesCoicidem = (nomeCompleto: string, nomeBusca: string): boolean => {
      const nomeCompletoNorm = normalizarNomeMedico(nomeCompleto);
      const nomeBuscaNorm = normalizarNomeMedico(nomeBusca);
      
      // Verificação exata
      if (nomeCompletoNorm === nomeBuscaNorm) return true;
      
      const partesCompleto = nomeCompletoNorm.split(' ');
      const partesBusca = nomeBuscaNorm.split(' ');
      
      // Se não há partes suficientes, não pode comparar
      if (partesCompleto.length === 0 || partesBusca.length === 0) return false;
      
      // Estratégia 1: Primeiro nome + primeira letra do segundo nome
      // Ex: "PAULO DE TARSO" vs "Paulo de T." ou "TIAGO OLIVEIRA LORDELO" vs "Tiago O."
      if (partesCompleto.length >= 2 && partesBusca.length >= 2) {
        const primeiroNomeCompleto = partesCompleto[0];
        const segundoNomeCompleto = partesCompleto[1];
        const primeiroNomeBusca = partesBusca[0];
        const segundoNomeBusca = partesBusca[1];
        
        // Primeiro nome deve coincidir exatamente
        if (primeiroNomeCompleto === primeiroNomeBusca) {
          // Segundo nome: ou coincide exato ou é primeira letra + ponto
          if (segundoNomeCompleto === segundoNomeBusca || 
              (segundoNomeBusca.length <= 2 && segundoNomeCompleto.startsWith(segundoNomeBusca.replace('.', '')))) {
            return true;
          }
        }
      }
      
      // Estratégia 2: Comparação sequencial com abreviações
      if (partesBusca.length <= partesCompleto.length) {
        let match = true;
        for (let i = 0; i < partesBusca.length; i++) {
          const parteBusca = partesBusca[i].replace('.', ''); // Remove pontos
          const parteCompleta = partesCompleto[i];
          
          // Se a parte da busca tem 1 caractere ou termina com ponto, verifica inicial
          if (parteBusca.length === 1 || partesBusca[i].endsWith('.')) {
            if (!parteCompleta.startsWith(parteBusca)) {
              match = false;
              break;
            }
          } else {
            // Nome completo deve coincidir exatamente
            if (parteBusca !== parteCompleta) {
              match = false;
              break;
            }
          }
        }
        if (match) return true;
      }
      
      // Estratégia 3: Busca reversa - verificar se nome completo contém busca abreviada
      if (partesCompleto.length > partesBusca.length) {
        // Ex: "PAULO DE TARSO MARTINS RIBEIRO" vs "Paulo de T."
        const primeiroCompleto = partesCompleto[0];
        const primeiroBusca = partesBusca[0];
        
        if (primeiroCompleto === primeiroBusca && partesBusca.length >= 2) {
          // Verificar se alguma parte do nome completo começa com a abreviação
          const abreviacao = partesBusca[1].replace('.', '');
          for (let i = 1; i < partesCompleto.length; i++) {
            if (partesCompleto[i].startsWith(abreviacao)) {
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

    // 1. Processar registros com especialidade "COLUNAS"
    console.log('📋 Processando especialidade COLUNAS → Músculo Esquelético/Neuro baseado no médico');
    
    // Buscar TODOS os registros com especialidade "COLUNAS" usando paginação
    let registrosColunas = [];
    let pagina = 0;
    const tamanhoPagina = 1000;
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
      const tamanhoBatch = 100;
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
            for (const medicoNeuro of medicosNeuroDefault) {
              if (nomesCoicidem(medicoNeuro, medico)) {
                novaEspecialidade = 'Neuro';
                break;
              }
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

    // 2. Corrigir ONCO MEDICINA INTERNA → MEDICINA INTERNA
    console.log('📋 Corrigindo especialidade ONCO MEDICINA INTERNA → MEDICINA INTERNA');
    
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
    } else {
      // Contar quantos foram atualizados
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('"ESPECIALIDADE"', 'MEDICINA INTERNA')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Últimos 60 segundos
      
      totalCorrecoesOncoMedInt = count || 0;
      console.log(`✅ ${totalCorrecoesOncoMedInt} registros ONCO MEDICINA INTERNA corrigidos para MEDICINA INTERNA`);
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