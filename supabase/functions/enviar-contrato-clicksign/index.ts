import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnviarContratoRequest {
  clienteId: string;
  contratoId: string;
  nomeCliente: string;
  emailCliente: string;
  tipoDocumento: 'contrato' | 'termo_aditivo' | 'termo_renovacao';
  documentoBase64?: string;
  nomeDocumento: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const clicksignApiKey = Deno.env.get('CLICKSIGN_API_KEY');
    if (!clicksignApiKey) {
      throw new Error('CLICKSIGN_API_KEY não configurado');
    }

    const { 
      clienteId, 
      contratoId, 
      nomeCliente, 
      emailCliente, 
      tipoDocumento, 
      documentoBase64, 
      nomeDocumento 
    }: EnviarContratoRequest = await req.json();

    console.log(`Enviando ${tipoDocumento} para assinatura: ${nomeCliente}`);

    // 1. Fazer upload do documento para o ClickSign
    const uploadResponse = await fetch('https://app.clicksign.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(clicksignApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          path: `/${tipoDocumento}_${contratoId}_${Date.now()}.pdf`,
          content_base64: documentoBase64,
          deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
          auto_close: true,
          locale: 'pt-BR'
        }
      })
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Erro no upload ClickSign: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentKey = uploadData.document.key;

    console.log(`Documento criado no ClickSign: ${documentKey}`);

    // 2. Adicionar signatário
    const signatarioResponse = await fetch(`https://app.clicksign.com/api/v1/documents/${documentKey}/signers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(clicksignApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signer: {
          email: emailCliente,
          name: nomeCliente,
          auths: ['email']
        }
      })
    });

    if (!signatarioResponse.ok) {
      const errorText = await signatarioResponse.text();
      throw new Error(`Erro ao adicionar signatário: ${errorText}`);
    }

    const signatarioData = await signatarioResponse.json();
    console.log(`Signatário adicionado: ${signatarioData.signer.key}`);

    // 3. Registrar documento no banco de dados
    const { error: dbError } = await supabaseClient
      .from('documentos_clientes')
      .insert({
        cliente_id: clienteId,
        tipo_documento: tipoDocumento,
        nome_arquivo: nomeDocumento,
        status_documento: 'assinatura_pendente',
        clicksign_document_key: documentKey,
        data_envio_assinatura: new Date().toISOString(),
        signatarios: {
          cliente: {
            email: emailCliente,
            nome: nomeCliente,
            signer_key: signatarioData.signer.key
          }
        }
      });

    if (dbError) {
      console.error('Erro ao salvar documento no banco:', dbError);
      throw new Error(`Erro ao salvar documento: ${dbError.message}`);
    }

    console.log(`${tipoDocumento} enviado com sucesso para ${nomeCliente}`);

    return new Response(JSON.stringify({
      success: true,
      documentKey,
      message: `${tipoDocumento} enviado para assinatura`,
      signUrl: `https://app.clicksign.com/sign/${documentKey}`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro ao enviar contrato:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
});