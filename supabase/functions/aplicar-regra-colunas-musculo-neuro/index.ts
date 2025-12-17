import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log(`🔄 Iniciando aplicação da regra v034 (ColunasxMusculoxNeuro)`);
    console.log(`📁 Arquivo: ${arquivo_fonte || 'TODOS'}`);
    console.log(`📅 Período: ${periodo_referencia || 'TODOS'}`);
    
    // BUSCAR NEUROLOGISTAS DA TABELA medicos_neurologistas (não mais hardcoded)
    const { data: neurologistasDb, error: neuroError } = await supabase
      .from('medicos_neurologistas')
      .select('nome')
      .eq('ativo', true);
    
    if (neuroError) {
      console.error('❌ Erro ao buscar neurologistas da tabela:', neuroError);
      throw neuroError;
    }
    
    const medicosNeuroLista = neurologistasDb?.map(n => n.nome) || [];
    
    if (medicosNeuroLista.length === 0) {
      console.warn('⚠️ Nenhum neurologista encontrado na tabela medicos_neurologistas');
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Nenhum neurologista cadastrado na tabela medicos_neurologistas'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`👨‍⚕️ Neurologistas carregados da tabela: ${medicosNeuroLista.length} médicos`);
    
    // Função para normalizar nome do médico (remover Dr./Dra., espaços extras, etc.)
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
      
      // Verificação exata
      if (nomeCompletoNorm === nomeBuscaNorm) return true;
      
      // Verificação de nome abreviado
      // Ex: "Francisca R" deve coincidir com "Francisca Rocélia Silva de Freitas"
      const partesCompleto = nomeCompletoNorm.split(' ');
      const partesBusca = nomeBuscaNorm.split(' ');
      
      if (partesBusca.length <= partesCompleto.length) {
        let match = true;
        for (let i = 0; i < partesBusca.length; i++) {
          const parteBusca = partesBusca[i];
          const parteCompleta = partesCompleto[i];
          
          // Se a parte da busca tem apenas 1 caractere, verifica se é inicial
          if (parteBusca.length === 1) {
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
      
      return false;
    };
    
    // Normalizar lista de médicos para comparação
    const medicosNeuroNormalizados = medicosNeuroLista.map(nome => normalizarNomeMedico(nome));
    
    let totalProcessados = 0;
    let totalAlteradosMusculo = 0;
    let totalAlteradosNeuro = 0;
    let totalErros = 0;
    
    // Construir query para buscar registros
    // Buscar registros com especialidade "COLUNAS" ou "Colunas" (case-insensitive)
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA", "MEDICO"')
      .or('ESPECIALIDADE.eq.COLUNAS,ESPECIALIDADE.eq.Colunas,ESPECIALIDADE.ilike.colunas');
    
    // Filtrar por arquivo_fonte se especificado
    if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }
    
    // Filtrar por periodo_referencia se especificado
    if (periodo_referencia) {
      const periodoFormatado = periodo_referencia.includes('/20') 
        ? periodo_referencia 
        : periodo_referencia.replace('/', '/20');
      query = query.eq('PERIODO_REFERENCIA', periodoFormatado);
    }
    
    const { data: registrosColunas, error: selectError } = await query;
    
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
          total_erros: 0,
          arquivo_fonte: arquivo_fonte || 'TODOS',
          observacoes: 'Nenhum registro com especialidade "Colunas" encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosColunas.length} registros com especialidade "Colunas"`);
    
    // Processar cada registro
    for (const registro of registrosColunas) {
      totalProcessados++;
      
      try {
        const medico = registro.MEDICO || '';
        
        // Determinar nova especialidade baseado no médico
        let novaEspecialidade = 'MUSCULO ESQUELETICO'; // Padrão
        let novaCategoria: string | null = null;
        
        // Verificar se o médico está na lista de neurologistas usando comparação inteligente
        let ehNeurologista = false;
        for (const medicoNeuro of medicosNeuroLista) {
          if (nomesCoicidem(medicoNeuro, medico)) {
            ehNeurologista = true;
            break;
          }
        }
        
        if (ehNeurologista) {
          // NEUROLOGISTA: ESPECIALIDADE = 'NEURO' e CATEGORIA = 'SC'
          novaEspecialidade = 'NEURO';
          novaCategoria = 'SC'; // CRÍTICO: Forçar categoria SC para neurologistas
          totalAlteradosNeuro++;
        } else {
          // NÃO NEUROLOGISTA: ESPECIALIDADE = 'MUSCULO ESQUELETICO'
          novaEspecialidade = 'MUSCULO ESQUELETICO';
          // Categoria permanece a mesma ou vem do cadastro_exames (aplicado por outras regras)
          totalAlteradosMusculo++;
        }
        
        // Preparar dados para atualização
        const dadosAtualizacao: any = {
          'ESPECIALIDADE': novaEspecialidade,
          updated_at: new Date().toISOString()
        };
        
        // Se for neurologista, OBRIGATORIAMENTE forçar CATEGORIA = 'SC'
        if (novaCategoria) {
          dadosAtualizacao['CATEGORIA'] = novaCategoria;
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
          if (novaEspecialidade === 'NEURO') {
            console.log(`✅ NEURO + SC: ${registro.ESTUDO_DESCRICAO?.substring(0, 40)} - Médico: ${medico}`);
          }
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
        operation: 'REGRA_V034_COLUNAS_MUSCULO_NEURO',
        record_id: arquivo_fonte || 'TODOS',
        new_data: {
          total_processados: totalProcessados,
          total_alterados_musculo: totalAlteradosMusculo,
          total_alterados_neuro: totalAlteradosNeuro,
          total_erros: totalErros,
          arquivo_fonte: arquivo_fonte || 'TODOS',
          periodo_referencia: periodo_referencia || 'TODOS',
          neurologistas_cadastrados: medicosNeuroLista.length
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_alterados_musculo: totalAlteradosMusculo,
      total_alterados_neuro: totalAlteradosNeuro,
      total_erros: totalErros,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      neurologistas_cadastrados: medicosNeuroLista.length,
      observacoes: `Regra v034 aplicada. ${totalAlteradosMusculo} → MUSCULO ESQUELETICO, ${totalAlteradosNeuro} → NEURO + SC`
    };
    
    console.log('✅ Regra v034 (ColunasxMusculoxNeuro) aplicada com sucesso:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v034:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v034 (ColunasxMusculoxNeuro)'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
