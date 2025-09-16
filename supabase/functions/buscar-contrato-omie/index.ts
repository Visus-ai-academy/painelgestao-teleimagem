import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
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

    const body = await req.json().catch(() => ({}));
    const { cliente_id, cliente_nome, cnpj, numero_contrato } = body;

    const appKey = Deno.env.get('OMIE_APP_KEY');
    const appSecret = Deno.env.get('OMIE_APP_SECRET');
    if (!appKey || !appSecret) {
      throw new Error('Credenciais OMIE ausentes');
    }

    if (!cliente_id && !cliente_nome && !cnpj) {
      throw new Error('Informe cliente_id, cliente_nome ou cnpj');
    }

    // Buscar cliente e número de contrato no Supabase
    let clienteRow: any = null;
    if (cliente_id) {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cnpj, omie_codigo_cliente')
        .eq('id', cliente_id)
        .single();
      clienteRow = data;
    } else if (cliente_nome) {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cnpj, omie_codigo_cliente')
        .eq('nome', cliente_nome)
        .maybeSingle();
      clienteRow = data;
    }

    if (!clienteRow && cnpj) {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cnpj, omie_codigo_cliente')
        .eq('cnpj', cnpj)
        .maybeSingle();
      clienteRow = data;
    }

    if (!clienteRow) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Cliente não encontrado no banco' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Número do contrato desejado: prioridade body.numero_contrato -> contratos_clientes -> parametros_faturamento
    let numeroContratoDesejado: string | null = numero_contrato || null;
    if (!numeroContratoDesejado) {
      const { data: contratoAtivo } = await supabase
        .from('contratos_clientes')
        .select('numero_contrato')
        .eq('cliente_id', clienteRow.id)
        .eq('status', 'ativo')
        .limit(1)
        .maybeSingle();
      numeroContratoDesejado = contratoAtivo?.numero_contrato || null;
    }
    if (!numeroContratoDesejado) {
      const { data: paramAtivo } = await supabase
        .from('parametros_faturamento')
        .select('numero_contrato, status')
        .eq('cliente_id', clienteRow.id)
        .in('status', ['A', 'ATIVO'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      numeroContratoDesejado = paramAtivo?.numero_contrato || null;
    }

    let codigoClienteOmie = clienteRow.omie_codigo_cliente;

    // Se não tem código do cliente no Omie, tentar descobrir usando função existente
    if (!codigoClienteOmie && (clienteRow.cnpj || clienteRow.nome)) {
      console.log(`Buscando código do cliente no Omie via função auxiliar...`);
      const inv = await supabase.functions.invoke('buscar-codigo-cliente-omie', {
        body: { cnpj: clienteRow.cnpj, nome_cliente: clienteRow.nome }
      });
      if (inv.data?.sucesso && inv.data?.cliente_encontrado?.codigo_omie) {
        codigoClienteOmie = inv.data.cliente_encontrado.codigo_omie;
        await supabase
          .from('clientes')
          .update({ omie_codigo_cliente: String(codigoClienteOmie), omie_data_sincronizacao: new Date().toISOString() })
          .eq('id', clienteRow.id);
      }
    }

    if (!codigoClienteOmie) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Cliente não possui código OMIE' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Se temos o número do contrato, tentar consulta direta para obter nCodCtr
    if (numeroContratoDesejado) {
      const consultaReq: OmieRequest = {
        call: 'ConsultarContrato',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ cNumCtr: numeroContratoDesejado }]
      };
      console.log('Consultando contrato por número no Omie:', JSON.stringify({ call: consultaReq.call, param: consultaReq.param }, null, 2));
      const consultaResp = await fetch('https://app.omie.com.br/api/v1/servicos/contrato/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consultaReq)
      });
      const consultaJson = await consultaResp.json();
      const codDireto = consultaJson?.nCodCtr || consultaJson?.nCodContrato || consultaJson?.codigo;
      if (codDireto) {
        await supabase
          .from('contratos_clientes')
          .update({ omie_codigo_contrato: String(codDireto), omie_data_sincronizacao: new Date().toISOString() })
          .eq('cliente_id', clienteRow.id)
          .eq('status', 'ativo')
          .is('omie_codigo_contrato', null);
        return new Response(JSON.stringify({ sucesso: true, codigo_contrato: String(codDireto), detalhes: consultaJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.warn('Consulta por número não retornou nCodCtr. Caindo para listagem...');
    }

    // Listar contratos no Omie por cliente
    const listReq: OmieRequest = {
      call: 'ListarContratos',
      app_key: appKey,
      app_secret: appSecret,
      param: [{ nPagina: 1, nRegsPorPagina: 200, nCodCli: Number(String(codigoClienteOmie).replace(/\D/g, '')) }]
    };

    console.log('Consultando contratos no Omie:', JSON.stringify({ call: listReq.call, param: listReq.param, numeroContratoDesejado }, null, 2));

    const listResp = await fetch('https://app.omie.com.br/api/v1/servicos/contrato/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listReq)
    });
    const listJson = await listResp.json();

    // Tentar detectar lista de contratos em diferentes formatos
    const contratos: any[] = listJson?.lista_contratos || listJson?.contratos || listJson?.lista || [];

    if (!Array.isArray(contratos) || contratos.length === 0) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Nenhum contrato encontrado no Omie para este cliente', resposta: listJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const normalize = (v: any) => (v ?? '').toString().trim();

    // Preferir match exato pelo número de contrato (ex.: 2023/00170)
    let contratoEscolhido: any = null;
    if (numeroContratoDesejado) {
      const alvo = normalize(numeroContratoDesejado).toUpperCase();
      contratoEscolhido = contratos.find((c) => {
        const cNum = normalize(c.cNumCtr || c.cNumero || c.cNumContrato || c.numero);
        return cNum && cNum.toUpperCase() === alvo;
      }) || null;
    }

    // Se não achou por número, escolher ativo/vigente
    if (!contratoEscolhido) {
      const normalizaUp = (v: any) => (v || '').toString().trim().toUpperCase();
      contratoEscolhido = contratos.find((c) => {
        const s1 = normalizaUp(c.status);
        const s2 = normalizaUp(c.cCodStatus);
        const s3 = normalizaUp(c.cDescStatus);
        return s1 === 'ATIVO' || s2 === 'A' || s3.includes('VIGENTE') || s3.includes('ATIVO');
      }) || contratos[0];
    }

    const nCodCtr = contratoEscolhido?.nCodCtr || contratoEscolhido?.nCodContrato || contratoEscolhido?.codigo || contratoEscolhido?.id;

    if (!nCodCtr) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Não foi possível identificar o código do contrato no Omie', contrato: contratoEscolhido }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Atualizar contratos locais sem código
    await supabase
      .from('contratos_clientes')
      .update({ omie_codigo_contrato: String(nCodCtr), omie_data_sincronizacao: new Date().toISOString() })
      .eq('cliente_id', clienteRow.id)
      .eq('status', 'ativo')
      .is('omie_codigo_contrato', null);

    return new Response(JSON.stringify({ sucesso: true, codigo_contrato: String(nCodCtr), detalhes: contratoEscolhido }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Erro em buscar-contrato-omie:', e);
    return new Response(JSON.stringify({ sucesso: false, erro: e?.message || 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
