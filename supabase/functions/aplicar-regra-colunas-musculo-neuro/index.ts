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

    const { arquivo_fonte, medicos_neuro = [] } = await req.json();
    
    // Lista padrão de médicos para Neuro se não fornecida via parâmetro
    const medicosNeuroDefault = [
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
    
    // Usar lista fornecida ou padrão
    const medicosNeuroLista = medicos_neuro.length > 0 ? medicos_neuro : medicosNeuroDefault;
    
    // Função para normalizar nome do médico (remover Dr./Dra., espaços extras, etc.)
    const normalizarNomeMedico = (nome: string): string => {
      if (!nome) return '';
      return nome
        .replace(/^DR[A]?\s+/i, '') // Remove DR/DRA no início
        .replace(/\s+/g, ' ') // Remove espaços extras
        .trim()
        .toUpperCase(); // Para comparação case-insensitive
    };
    
    console.log(`🔄 Iniciando aplicação da regra ColunasxMusculoxNeuro para arquivo: ${arquivo_fonte}`);
    console.log(`👨‍⚕️ Médicos para Neuro: ${medicosNeuroLista.length} médicos na lista`);
    
    // Normalizar lista de médicos para comparação
    const medicosNeuroNormalizados = medicosNeuroLista.map(nome => normalizarNomeMedico(nome));
    
    let totalProcessados = 0;
    let totalAlteradosMusculo = 0;
    let totalAlteradosNeuro = 0;
    let totalCategoriasAplicadas = 0;
    let totalErros = 0;
    
    // Buscar todos os registros com especialidade "Colunas"
    const { data: registrosColunas, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA", "MEDICO"')
      .eq('"ESPECIALIDADE"', 'Colunas')
      .eq('arquivo_fonte', arquivo_fonte);
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros com especialidade Colunas:', selectError);
      throw selectError;
    }
    
    if (!registrosColunas || registrosColunas.length === 0) {
      console.log('✅ Nenhum registro encontrado com especialidade "Colunas"');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_alterados_musculo: 0,
          total_alterados_neuro: 0,
          total_categorias_aplicadas: 0,
          total_erros: 0,
          arquivo_fonte,
          observacoes: 'Nenhum registro com especialidade "Colunas" encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosColunas.length} registros com especialidade "Colunas"`);
    
    // Buscar cadastro de exames para aplicar categorias
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true);
    
    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError);
      throw cadastroError;
    }
    
    // Criar mapa de exames para busca eficiente
    const mapaExames = new Map();
    cadastroExames?.forEach(exame => {
      if (exame.categoria) {
        mapaExames.set(exame.nome, exame.categoria);
      }
    });
    
    // Processar cada registro
    for (const registro of registrosColunas) {
      totalProcessados++;
      
      try {
        const nomeExame = registro.ESTUDO_DESCRICAO;
        const medico = registro.MEDICO;
        const categoriaAtual = registro.CATEGORIA;
        
        // Determinar nova especialidade baseado no médico normalizado
        let novaEspecialidade = 'Músculo Esquelético'; // Padrão
        
        const medicoNormalizado = normalizarNomeMedico(medico);
        if (medicosNeuroNormalizados.includes(medicoNormalizado)) {
          novaEspecialidade = 'Neuro';
        }
        
        // Buscar categoria no cadastro de exames
        const categoriaCadastro = mapaExames.get(nomeExame);
        const novaCategoria = categoriaCadastro || categoriaAtual;
        
        // Preparar dados para atualização
        const dadosAtualizacao: any = {
          'ESPECIALIDADE': novaEspecialidade,
          updated_at: new Date().toISOString()
        };
        
        // Só atualizar categoria se encontrou no cadastro
        if (categoriaCadastro && categoriaCadastro !== categoriaAtual) {
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
            totalAlteradosNeuro++;
          } else {
            totalAlteradosMusculo++;
          }
          
          console.log(`✅ Atualizado: ${nomeExame} - Médico: ${medico} - Especialidade: Colunas → ${novaEspecialidade}${categoriaCadastro ? `, Categoria: ${categoriaAtual} → ${categoriaCadastro}` : ''}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
        totalErros++;
      }
    }
    
    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRA_COLUNAS_MUSCULO_NEURO',
        record_id: arquivo_fonte,
        new_data: {
          total_processados: totalProcessados,
          total_alterados_musculo: totalAlteradosMusculo,
          total_alterados_neuro: totalAlteradosNeuro,
          total_categorias_aplicadas: totalCategoriasAplicadas,
          total_erros: totalErros,
          arquivo_fonte,
          medicos_neuro: medicosNeuroLista
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_alterados_musculo: totalAlteradosMusculo,
      total_alterados_neuro: totalAlteradosNeuro,
      total_categorias_aplicadas: totalCategoriasAplicadas,
      total_erros: totalErros,
      arquivo_fonte,
      observacoes: `Regra ColunasxMusculoxNeuro aplicada. ${totalAlteradosMusculo} alterados para Músculo Esquelético, ${totalAlteradosNeuro} para Neuro, ${totalCategoriasAplicadas} categorias aplicadas.`
    };
    
    console.log('✅ Regra ColunasxMusculoxNeuro aplicada com sucesso:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra ColunasxMusculoxNeuro:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra ColunasxMusculoxNeuro'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});