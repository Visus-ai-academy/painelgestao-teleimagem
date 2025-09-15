import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  clientes?: string[];      // nomes (case-insensitive)
  cliente_ids?: string[];   // UUIDs
  cnpjs?: string[];         // CNPJs
  apenas_sem_codigo?: boolean; // se true, busca apenas clientes com omie_codigo_cliente NULL
  limite?: number;          // limite de clientes no modo sem filtro
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

    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clientes, cliente_ids, cnpjs, apenas_sem_codigo = true, limite = 200 } = body || {};

    console.log('Iniciando sincronização de códigos Omie (cliente) com parâmetros:', body);

    // Montar query base
    let query = supabase
      .from('clientes')
      .select('id, nome, cnpj, omie_codigo_cliente');

    if (cliente_ids && cliente_ids.length > 0) {
      query = query.in('id', cliente_ids);
    } else if (cnpjs && cnpjs.length > 0) {
      query = query.in('cnpj', cnpjs);
    } else if (clientes && clientes.length > 0) {
      // montar OR com ILIKE para nomes
      const orCond = clientes.map((n) => `nome.ilike.${n}`).join(',');
      query = query.or(orCond);
    } else if (apenas_sem_codigo) {
      query = query.is('omie_codigo_cliente', null).not('cnpj', 'is', null).limit(limite);
    } else {
      query = query.limit(limite);
    }

    const { data: clientesData, error: listError } = await query;
    if (listError) throw listError;

    if (!clientesData || clientesData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total_encontrados: 0,
        atualizados: 0,
        nao_encontrados: 0,
        resultados: [],
        mensagem: 'Nenhum cliente para sincronizar com os critérios fornecidos.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resultados: Array<any> = [];
    let atualizados = 0;
    let naoEncontrados = 0;
    let erros = 0;

    for (const c of clientesData) {
      try {
        // Se já tem código, pular
        if (c.omie_codigo_cliente) {
          resultados.push({ cliente: c.nome, cnpj: c.cnpj, pulado: true, motivo: 'já possui omie_codigo_cliente' });
          continue;
        }

        if (!c.cnpj) {
          resultados.push({ cliente: c.nome, cnpj: null, sucesso: false, erro: 'Cliente sem CNPJ' });
          naoEncontrados++;
          continue;
        }

        // Buscar no Omie via função existente
        const busca = await supabase.functions.invoke('buscar-codigo-cliente-omie', {
          body: { cnpj: c.cnpj, nome_cliente: c.nome }
        });

        if (busca.error) {
          console.error('Erro invocando buscar-codigo-cliente-omie:', busca.error);
          resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: false, erro: 'Falha na invocação da busca no Omie' });
          erros++;
          continue;
        }

        const encontrado = busca.data?.cliente_encontrado;
        if (!busca.data?.sucesso || !encontrado?.codigo_omie) {
          resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: false, erro: 'Cliente não encontrado no Omie' });
          naoEncontrados++;
          continue;
        }

        const codigoOmie = String(encontrado.codigo_omie);
        const agora = new Date().toISOString();

        // Atualizar cliente
        const { error: updClienteError } = await supabase
          .from('clientes')
          .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
          .eq('id', c.id);

        if (updClienteError) throw updClienteError;

        // Atualizar todos os contratos ativos deste cliente
        const { error: updContratosError } = await supabase
          .from('contratos_clientes')
          .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
          .eq('cliente_id', c.id)
          .eq('status', 'ativo');

        if (updContratosError) throw updContratosError;

        resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: true, omie_codigo_cliente: codigoOmie });
        atualizados++;
      } catch (e) {
        console.error(`Erro ao sincronizar cliente ${c.nome}:`, e);
        resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: false, erro: String(e?.message || e) });
        erros++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_encontrados: clientesData.length,
      atualizados,
      nao_encontrados: naoEncontrados,
      erros,
      resultados
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Erro na função sincronizar-codigo-cliente-omie:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
