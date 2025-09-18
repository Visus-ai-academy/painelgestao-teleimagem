import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { RelatorioFaturamentoEmail } from './_templates/relatorio-faturamento.tsx';

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  cliente_id: string;
  relatorio: any;
  anexo_pdf?: string; // base64 do PDF
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar se o Resend está configurado
    if (!resend || !resendApiKey) {
      console.error('RESEND_API_KEY não configurado ou inválido');
      console.log('RESEND_API_KEY está definido:', !!resendApiKey);
      throw new Error('Serviço de email não configurado. Configure a chave RESEND_API_KEY.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, relatorio, anexo_pdf }: EmailRequest = await req.json();

    console.log(`Enviando email para cliente ${cliente_id}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    if (!cliente.email) {
      throw new Error('Cliente não possui email cadastrado');
    }

    // Gerar HTML do email usando React Email
    const html = await renderAsync(
      React.createElement(RelatorioFaturamentoEmail, {
        cliente_nome: cliente.nome,
        periodo: relatorio.periodo,
        total_laudos: relatorio.resumo.total_laudos,
        valor_total: relatorio.resumo.valor_total,
        valor_a_pagar: relatorio.resumo.valor_a_pagar
      })
    );

    const assunto = `Relatório de volumetria _ Teleimagem`;
    
    // Preparar anexos
    const attachments = [];
    if (anexo_pdf) {
      attachments.push({
        filename: `Demonstrativo_Fat_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: anexo_pdf,
        type: 'application/pdf',
        disposition: 'attachment'
      });
    }

    // Enviar email
    const emailResponse = await resend.emails.send({
      from: 'Teleimagem <financeiro@teleimagem.com.br>',
      reply_to: 'financeiro@teleimagem.com.br',
      to: [cliente.email],
      subject: assunto,
      html: html,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    console.log('Resposta do Resend:', emailResponse);

    // Verificar se houve erro na resposta
    if (emailResponse.error) {
      console.error('Erro detalhado do Resend:', emailResponse.error);
      throw new Error(`Erro do Resend: ${emailResponse.error.message || JSON.stringify(emailResponse.error)}`);
    }

    // Log do envio
    await supabase
      .from('emails_cobranca')
      .insert({
        fatura_id: cliente_id, // usando cliente_id temporariamente
        regua_id: cliente_id, // usando cliente_id temporariamente  
        cliente_email: cliente.email,
        assunto: assunto,
        corpo: html,
        status: 'enviado',
        enviado_em: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailResponse.data?.id,
        message: `Email enviado com sucesso para ${cliente.email}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao enviar email',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);