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

    // Função para verificar se nomes coincidem (incluindo abreviações)
    const nomesCoicidem = (nomeCompleto: string, nomeBusca: string): boolean => {
      const nomeCompletoNorm = normalizarNomeMedico(nomeCompleto);
      const nomeBuscaNorm = normalizarNomeMedico(nomeBusca);
      
      if (nomeCompletoNorm === nomeBuscaNorm) return true;
      
      const partesCompleto = nomeCompletoNorm.split(' ');
      const partesBusca = nomeBuscaNorm.split(' ');
      
      if (partesBusca.length <= partesCompleto.length) {
        let match = true;
        for (let i = 0; i < partesBusca.length; i++) {
          const parteBusca = partesBusca[i];
          const parteCompleta = partesCompleto[i];
          
          if (parteBusca.length === 1) {
            if (!parteCompleta.startsWith(parteBusca)) {
              match = false;
              break;
            }
          } else {
            if (parteBusca !== parteCompleta) {
              match = false;
              break;
            }
          }
        }
        if (match) return true;
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
    
    // Buscar todos os registros com especialidade "COLUNAS"
    const { data: registrosColunas, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA", "MEDICO"')
      .eq('"ESPECIALIDADE"', 'COLUNAS');
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros COLUNAS:', selectError);
      totalErros++;
    } else if (registrosColunas && registrosColunas.length > 0) {
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

      for (const registro of registrosColunas) {
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
          
          // Atualizar registro
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update(dadosAtualizacao)
            .eq('id', registro.id);
          
          if (updateError) {
            console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
            totalErros++;
          } else {
            if (novaEspecialidade === 'Neuro') {
              totalCorrecoesNeuro++;
            } else {
              totalCorrecoesColunas++;
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
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