import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClickSignWebhook {
  event: {
    name: string;
    data: {
      document: {
        key: string;
        filename: string;
        uploaded_at: string;
        updated_at: string;
        finished_at?: string;
        status: string;
      };
      signer?: {
        key: string;
        email: string;
        name: string;
        signed_at?: string;
      };
    };
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const clicksignApiKey = Deno.env.get('CLICKSIGN_API_KEY');
    if (!clicksignApiKey) {
      throw new Error('CLICKSIGN_API_KEY não configurado');
    }

    const webhookData: ClickSignWebhook = await req.json();
    const { event } = webhookData;
    const documentKey = event.data.document.key;

    console.log(`Webhook ClickSign recebido: ${event.name} para documento ${documentKey}`);

    // Buscar documento no banco de dados
    const { data: documento, error: findError } = await supabaseClient
      .from('documentos_clientes')
      .select('*')
      .eq('clicksign_document_key', documentKey)
      .single();

    if (findError || !documento) {
      console.error(`Documento não encontrado: ${documentKey}`, findError);
      return new Response(JSON.stringify({ error: 'Documento não encontrado' }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let updateData: any = {};

    // Processar diferentes eventos
    switch (event.name) {
      case 'sign':
        console.log(`Documento assinado: ${documentKey}`);
        updateData = {
          status_documento: 'assinado',
          data_assinatura: event.data.signer?.signed_at || new Date().toISOString()
        };

        // Fazer download do documento assinado
        try {
          const downloadResponse = await fetch(
            `https://app.clicksign.com/api/v1/documents/${documentKey}/download?type=signed`,
            {
              headers: {
                'Authorization': `Basic ${btoa(clicksignApiKey + ':')}`
              }
            }
          );

          if (downloadResponse.ok) {
            const documentBlob = await downloadResponse.blob();
            const arrayBuffer = await documentBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Upload para Supabase Storage
            const fileName = `${documento.tipo_documento}_${documento.cliente_id}_${Date.now()}.pdf`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
              .from('documentos-clientes')
              .upload(fileName, uint8Array, {
                contentType: 'application/pdf',
                upsert: true
              });

            if (uploadError) {
              console.error('Erro no upload do documento:', uploadError);
            } else {
              console.log(`Documento salvo no storage: ${fileName}`);
              updateData.url_arquivo = uploadData.path;
              updateData.status_documento = 'anexado';
            }
          }
        } catch (downloadError) {
          console.error('Erro ao fazer download do documento:', downloadError);
        }
        break;

      case 'close':
        console.log(`Documento finalizado: ${documentKey}`);
        if (event.data.document.status === 'closed') {
          updateData.status_documento = 'assinado';
        }
        break;

      case 'cancel':
        console.log(`Documento cancelado: ${documentKey}`);
        updateData.status_documento = 'pendente';
        break;

      case 'refuse':
        console.log(`Documento recusado: ${documentKey}`);
        updateData.status_documento = 'pendente';
        break;

      default:
        console.log(`Evento não processado: ${event.name}`);
        break;
    }

    // Atualizar documento no banco
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('documentos_clientes')
        .update(updateData)
        .eq('clicksign_document_key', documentKey);

      if (updateError) {
        console.error('Erro ao atualizar documento:', updateError);
        throw new Error(`Erro ao atualizar documento: ${updateError.message}`);
      }

      console.log(`Documento atualizado com sucesso: ${documentKey}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: event.name,
      documentKey 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro no webhook ClickSign:", error);
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