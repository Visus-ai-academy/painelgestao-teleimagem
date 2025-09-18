import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalizador robusto para nomes (alinha com funções SQL limpar_nome_cliente/aplicar_mapeamento_nome_fantasia)
function normalizeName(raw?: string): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Remover diacríticos
  s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  // Mapeamentos específicos conhecidos
  const mapEspecifico: Record<string, string> = {
    'CEDI-RJ': 'CEDIDIAG',
    'CEDI_RO': 'CEDIDIAG',
    'CEDI-RO': 'CEDIDIAG',
    'CEDI_UNIMED': 'CEDIDIAG',
    'CEDI-UNIMED': 'CEDIDIAG',
  };
  if (mapEspecifico[s.toUpperCase()]) {
    s = mapEspecifico[s.toUpperCase()];
  }
  // Remover sufixos comuns
  const removeSuffix = (txt: string, suff: string) => txt.toUpperCase().endsWith(suff) ? txt.slice(0, -suff.length) : txt;
  s = removeSuffix(s, ' - TELE');
  s = removeSuffix(s, '- TELE');
  s = removeSuffix(s, '-CT');
  s = removeSuffix(s, '-MR');
  s = removeSuffix(s, '_PLANTAO'); // sem acento
  s = removeSuffix(s, '_PLANTÃO');
  s = removeSuffix(s, '_RMX');
  // Normalizar separadores e pontuação
  s = s.replace(/[^A-Z0-9]/gi, '');
  // Uppercase final
  s = s.toUpperCase();
  return s;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte, periodo } = await req.json().catch(() => ({ arquivo_fonte: undefined, periodo: undefined }));
    console.log(`[aplicar-mapeamento-nome-cliente] Iniciando para arquivo: ${arquivo_fonte || 'TODOS'} | periodo: ${periodo || 'TODOS'}`);

    // Construir filtro dinâmico baseado em arquivo_fonte e periodo
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "Cliente_Nome_Fantasia", periodo_referencia')
      .not('EMPRESA', 'is', null);

    if (arquivo_fonte && arquivo_fonte !== 'TODOS') {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }
    if (periodo && periodo !== 'TODOS') {
      query = query.eq('periodo_referencia', periodo);
    }

    const { data: registrosVolumetria, error: errorVolumetria } = await query;

    if (errorVolumetria) {
      console.error('[aplicar-mapeamento-nome-cliente] Erro ao buscar volumetria:', errorVolumetria);
      throw errorVolumetria;
    }

    console.log(`[aplicar-mapeamento-nome-cliente] Encontrados ${registrosVolumetria?.length || 0} registros para processar`);

    if (!registrosVolumetria || registrosVolumetria.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_atualizados: 0,
          mensagem: 'Nenhum registro encontrado para processar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar clientes para mapeamento (nome_mobilemed -> nome_fantasia)
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, nome_mobilemed, ativo');

    if (errorClientes) {
      console.error('[aplicar-mapeamento-nome-cliente] Erro ao buscar clientes:', errorClientes);
      throw errorClientes;
    }

    console.log(`[aplicar-mapeamento-nome-cliente] Carregados ${clientes?.length || 0} clientes do cadastro`);

    // Índices normalizados para lookup rápido
    type Cli = { id: string; nome: string | null; nome_fantasia: string | null; nome_mobilemed: string | null; ativo: boolean | null };
    const idxMobile: Record<string, Cli> = {};
    const idxFantasia: Record<string, Cli> = {};
    const idxNome: Record<string, Cli> = {};

    (clientes || []).forEach((c: any) => {
      const cli: Cli = { id: c.id, nome: c.nome, nome_fantasia: c.nome_fantasia, nome_mobilemed: c.nome_mobilemed, ativo: c.ativo };
      if (c.nome_mobilemed) idxMobile[normalizeName(c.nome_mobilemed)] = cli;
      if (c.nome_fantasia) idxFantasia[normalizeName(c.nome_fantasia)] = cli;
      if (c.nome) idxNome[normalizeName(c.nome)] = cli;
    });

    let totalProcessados = 0;
    let totalAtualizados = 0;
    let totalJaMapeados = 0;
    const naoEncontrados = new Set<string>();

    // Processar em lotes pequenos para evitar timeouts
    const tamanhoLote = 200;
    for (let i = 0; i < registrosVolumetria.length; i += tamanhoLote) {
      const lote = registrosVolumetria.slice(i, i + tamanhoLote);
      console.log(`[aplicar-mapeamento-nome-cliente] Processando lote ${Math.floor(i / tamanhoLote) + 1}/${Math.ceil(registrosVolumetria.length / tamanhoLote)} (${lote.length} registros)`);

      for (const registro of lote) {
        totalProcessados++;
        const nomeEmpresa = registro.EMPRESA as string;
        const nomeFantasiaAtual = registro["Cliente_Nome_Fantasia"] as string | null;
        const key = normalizeName(nomeEmpresa);

        // Lookup por nome_mobilemed > nome_fantasia > nome
        const cli = idxMobile[key] || idxFantasia[key] || idxNome[key] || null;

        if (cli) {
          const desejado = (cli.nome_fantasia || cli.nome || nomeEmpresa) as string;
          if (nomeFantasiaAtual && normalizeName(nomeFantasiaAtual) === normalizeName(desejado)) {
            totalJaMapeados++;
            continue;
          }
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update({ 
              'Cliente_Nome_Fantasia': desejado,
              updated_at: new Date().toISOString()
            })
            .eq('id', registro.id);

          if (updateError) {
            console.error(`[aplicar-mapeamento-nome-cliente] Erro ao atualizar registro ${registro.id}:`, updateError);
          } else {
            totalAtualizados++;
            console.log(`[aplicar-mapeamento-nome-cliente] Mapeado: EMPRESA="${nomeEmpresa}" → Cliente_Nome_Fantasia="${desejado}"`);
          }
        } else {
          naoEncontrados.add(nomeEmpresa);
        }
      }
    }

    const resultadoFinal = {
      sucesso: true,
      total_processados: totalProcessados,
      total_atualizados: totalAtualizados,
      total_ja_mapeados: totalJaMapeados,
      nao_encontrados_amostra: Array.from(naoEncontrados).slice(0, 20),
      arquivo_fonte: arquivo_fonte || 'TODOS',
      periodo: periodo || 'TODOS',
      data_processamento: new Date().toISOString(),
    };

    console.log(`[aplicar-mapeamento-nome-cliente] Finalizado:`, resultadoFinal);

    return new Response(
      JSON.stringify(resultadoFinal),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[aplicar-mapeamento-nome-cliente] Erro:', error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        data_erro: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
