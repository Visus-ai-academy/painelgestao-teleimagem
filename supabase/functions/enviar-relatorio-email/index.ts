import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

// Remove Resend dependency to fix build errors
const resendApiKey = Deno.env.get("RESEND_API_KEY");

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
    if (!resendApiKey) {
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

    // Gerar HTML do email usando template
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório de Volumetria - Faturamento ${relatorio.periodo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background-color: #ffffff; }
            .container { max-width: 580px; margin: 0 auto; }
            .header { color: #333; font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; }
            .text { color: #333; font-size: 16px; line-height: 26px; margin: 16px 0; }
            .summary { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; margin: 20px 0; }
            .summary-label { color: #666; font-size: 14px; font-weight: bold; margin: 8px 0 4px 0; }
            .summary-value { color: #333; font-size: 16px; margin: 0 0 12px 0; }
            .summary-highlight { color: #28a745; font-size: 18px; font-weight: bold; margin: 0 0 12px 0; }
            .warning { color: #856404; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; font-size: 14px; margin: 20px 0; }
            .footer { color: #666; font-size: 14px; text-align: center; margin: 20px 0; }
            .hr { border: none; border-top: 1px solid #e9ecef; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">Relatório de Volumetria</h1>
            
            <p class="text">Prezados,</p>
            
            <p class="text">Segue lista de exames referente à nota fiscal citada no e-mail.</p>

            <div class="summary">
              <div class="summary-label">Cliente:</div>
              <div class="summary-value">${cliente.nome}</div>
              
              <div class="summary-label">Período:</div>
              <div class="summary-value">${relatorio.periodo}</div>
              
              <div class="summary-label">Total de Laudos:</div>
              <div class="summary-value">${relatorio.resumo.total_laudos.toLocaleString()}</div>
              
              <div class="summary-label">Valor Total Faturado:</div>
              <div class="summary-value">${relatorio.resumo.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              
              <div class="summary-label">Valor a Pagar:</div>
              <div class="summary-highlight">${relatorio.resumo.valor_a_pagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>

            <hr class="hr">

            <div class="warning">
              <strong>⚠️ Importante:</strong> Evite pagamento de juros e multa ou a suspensão 
              dos serviços, quitando o pagamento no vencimento.
            </div>

            <hr class="hr">

            <div class="footer">
              Atenciosamente,<br>
              <strong>Robson D'avila</strong><br>
              Tel.: (41) 99255-1964
            </div>
          </div>
        </body>
      </html>
    `;

    const assunto = `Relatório de Volumetria - Faturamento ${relatorio.periodo}`;
    
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

    // Enviar email via fetch para Resend API
    const emailPayload = {
      from: 'Teleimagem <financeiro@teleimagem.com.br>',
      reply_to: 'financeiro@teleimagem.com.br',
      to: [cliente.email],
      subject: assunto,
      html: html,
      ...(attachments.length > 0 && { attachments })
    };

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const emailResult = await emailResponse.json();

    console.log('Resposta do Resend:', emailResult);

    // Verificar se houve erro na resposta
    if (!emailResponse.ok || emailResult.error) {
      console.error('Erro detalhado do Resend:', emailResult);
      throw new Error(`Erro do Resend: ${emailResult.error?.message || emailResult.message || 'Erro desconhecido'}`);
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
        email_id: emailResult.id,
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