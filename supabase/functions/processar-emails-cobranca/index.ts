import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resendApiKey = Deno.env.get('RESEND_API_KEY');

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando processamento de emails de cobrança...');

    // Buscar réguas de cobrança que precisam enviar emails hoje
    const hoje = new Date().toISOString().split('T')[0];
    
    const { data: reguasParaEnvio, error: reguasError } = await supabase
      .from('regua_cobranca')
      .select(`
        id,
        fatura_id,
        dias_envio,
        emails_enviados,
        max_emails,
        omie_faturas (
          id,
          omie_id,
          cliente_nome,
          cliente_email,
          numero_fatura,
          valor,
          data_vencimento,
          status
        )
      `)
      .eq('ativo', true)
      .lte('proximo_envio', hoje)
      .lt('emails_enviados', 10); // Máximo de 10 emails

    if (reguasError) {
      throw new Error(`Erro ao buscar réguas: ${reguasError.message}`);
    }

    if (!reguasParaEnvio || reguasParaEnvio.length === 0) {
      console.log('Nenhuma régua de cobrança para processar hoje');
      return new Response(
        JSON.stringify({ 
          sucesso: true, 
          emails_enviados: 0,
          mensagem: 'Nenhum email para enviar hoje'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Encontradas ${reguasParaEnvio.length} réguas para processar`);

    let emailsEnviados = 0;

    for (const regua of reguasParaEnvio) {
      try {
        const fatura = regua.omie_faturas;
        
        if (!fatura || !fatura.cliente_email) {
          console.log(`Pulando régua ${regua.id} - fatura ou email não encontrado`);
          continue;
        }

        // Verificar se a fatura ainda está em aberto
        if (fatura.status !== 'em_aberto') {
          console.log(`Desativando régua ${regua.id} - fatura já paga`);
          await supabase
            .from('regua_cobranca')
            .update({ ativo: false })
            .eq('id', regua.id);
          continue;
        }

        // Calcular dias de atraso
        const dataVencimento = new Date(fatura.data_vencimento);
        const hoje = new Date();
        const diasAtraso = Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));

        // Criar conteúdo do email
        const assunto = `Cobrança - Fatura ${fatura.numero_fatura} em aberto - ${diasAtraso} dias de atraso`;
        
        const corpoEmail = `
Prezado(a) ${fatura.cliente_nome},

Identificamos que a fatura ${fatura.numero_fatura} no valor de ${formatarMoeda(Number(fatura.valor))} está em aberto há ${diasAtraso} dias.

Detalhes da fatura:
- Número: ${fatura.numero_fatura}
- Valor: ${formatarMoeda(Number(fatura.valor))}
- Data de vencimento: ${formatarData(fatura.data_vencimento)}
- Dias de atraso: ${diasAtraso}

Por favor, efetue o pagamento o quanto antes para evitar juros e multas.

Para dúvidas ou negociação, entre em contato conosco.

Atenciosamente,
Equipe de Cobrança
Teleimagem A.I.
        `;

        // Enviar email via Resend API
        if (resendApiKey) {
          const emailPayload = {
            from: 'Teleimagem <onboarding@resend.dev>',
            reply_to: 'i.a.academybrasil@gmail.com',
            to: [fatura.cliente_email],
            subject: assunto,
            text: corpoEmail
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
          console.log(`Email enviado para ${fatura.cliente_email}:`, emailResult);
        }

        // Registrar o envio do email
        const { error: emailLogError } = await supabase
          .from('emails_cobranca')
          .insert({
            regua_id: regua.id,
            fatura_id: regua.fatura_id,
            cliente_email: fatura.cliente_email,
            assunto: assunto,
            corpo: corpoEmail,
            status: 'enviado'
          });

        if (emailLogError) {
          console.error('Erro ao registrar email:', emailLogError);
        }

        // Atualizar régua de cobrança
        const proximoEnvio = new Date();
        proximoEnvio.setDate(proximoEnvio.getDate() + 1); // Próximo email em 1 dia

        const novoNumeroEmails = (regua.emails_enviados || 0) + 1;
        const reguaAtiva = novoNumeroEmails < (regua.max_emails || 10);

        const { error: updateError } = await supabase
          .from('regua_cobranca')
          .update({
            emails_enviados: novoNumeroEmails,
            dias_envio: (regua.dias_envio || 0) + 1,
            proximo_envio: reguaAtiva ? proximoEnvio.toISOString().split('T')[0] : null,
            ativo: reguaAtiva
          })
          .eq('id', regua.id);

        if (updateError) {
          console.error('Erro ao atualizar régua:', updateError);
        }

        emailsEnviados++;
        console.log(`Email enviado para ${fatura.cliente_nome} (${fatura.cliente_email})`);

      } catch (emailError: any) {
        console.error(`Erro ao processar régua ${regua.id}:`, emailError);
        
        // Registrar erro no log
        await supabase
          .from('emails_cobranca')
          .insert({
            regua_id: regua.id,
            fatura_id: regua.fatura_id,
            cliente_email: regua.omie_faturas?.cliente_email || '',
            assunto: 'Erro no envio',
            corpo: emailError.message,
            status: 'erro',
            erro_mensagem: emailError.message
          });
      }
    }

    console.log(`Processamento concluído: ${emailsEnviados} emails enviados`);

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        emails_enviados: emailsEnviados,
        reguas_processadas: reguasParaEnvio.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro no processamento de emails:', error);
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR');
}

serve(handler);