import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnviarContratoMedicoRequest {
  medicoId: string;
  nomeMedico: string;
  emailMedico: string;
  crm: string;
  especialidades: string[];
  modalidades: string[];
  categoria: string;
  valoresCombinacoes: Record<string, Record<string, Record<string, number>>>;
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
      medicoId, 
      nomeMedico, 
      emailMedico, 
      crm,
      especialidades,
      modalidades,
      categoria,
      valoresCombinacoes
    }: EnviarContratoMedicoRequest = await req.json();

    console.log(`Gerando contrato médico para: ${nomeMedico} (CRM: ${crm})`);

    // Gerar template de contrato médico (aqui seria implementado o template real)
    const contratoTemplate = gerarTemplateContratoMedico({
      nomeMedico,
      crm,
      emailMedico,
      especialidades,
      modalidades,
      categoria,
      valoresCombinacoes
    });

    // Converter template para base64 (simulado)
    const documentoBase64 = btoa(contratoTemplate);

    // 1. Fazer upload do documento para o ClickSign
    const uploadResponse = await fetch('https://app.clicksign.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(clicksignApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          path: `/contrato_medico_${crm}_${Date.now()}.pdf`,
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

    // 2. Adicionar signatário (médico)
    const signatarioResponse = await fetch(`https://app.clicksign.com/api/v1/documents/${documentKey}/signers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(clicksignApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signer: {
          email: emailMedico,
          name: nomeMedico,
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
        medico_id: medicoId,
        tipo_documento: 'contrato_medico',
        nome_arquivo: `contrato_medico_${crm}_${Date.now()}.pdf`,
        status_documento: 'assinatura_pendente',
        clicksign_document_key: documentKey,
        data_envio_assinatura: new Date().toISOString(),
        signatarios: {
          medico: {
            email: emailMedico,
            nome: nomeMedico,
            crm: crm,
            signer_key: signatarioData.signer.key
          }
        }
      });

    if (dbError) {
      console.error('Erro ao salvar documento no banco:', dbError);
      throw new Error(`Erro ao salvar documento: ${dbError.message}`);
    }

    console.log(`Contrato médico enviado com sucesso para ${nomeMedico}`);

    return new Response(JSON.stringify({
      success: true,
      documentKey,
      message: `Contrato médico enviado para assinatura`,
      signUrl: `https://app.clicksign.com/sign/${documentKey}`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro ao enviar contrato médico:", error);
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

function gerarTemplateContratoMedico(dados: {
  nomeMedico: string;
  crm: string;
  emailMedico: string;
  especialidades: string[];
  modalidades: string[];
  categoria: string;
  valoresCombinacoes: Record<string, Record<string, Record<string, number>>>;
}): string {
  // Template simplificado do contrato médico
  return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS MÉDICOS

CONTRATANTE: TELEIMAGEM TELEMEDICINA E DIAGNÓSTICOS LTDA
CONTRATADO: ${dados.nomeMedico}
CRM: ${dados.crm}
Email: ${dados.emailMedico}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços médicos de laudos de diagnóstico por imagem.

CLÁUSULA 2ª - DAS ESPECIALIDADES E MODALIDADES
O CONTRATADO prestará serviços nas seguintes especialidades:
${dados.especialidades.map(esp => `- ${esp}`).join('\n')}

Modalidades de exames:
${dados.modalidades.map(mod => `- ${mod}`).join('\n')}

Categoria: ${dados.categoria}

CLÁUSULA 3ª - DOS VALORES
Os valores de repasse por exame laudado seguem a tabela abaixo:

${Object.entries(dados.valoresCombinacoes).map(([modalidade, especialidadeData]) => 
  `${modalidade}:\n${Object.entries(especialidadeData).map(([especialidade, prioridadeData]) => 
    `  ${especialidade}:\n${Object.entries(prioridadeData).map(([prioridade, valor]) => 
      `    ${prioridade}: R$ ${valor.toFixed(2)}`
    ).join('\n')}`
  ).join('\n')}`
).join('\n\n')}

CLÁUSULA 4ª - DAS OBRIGAÇÕES
4.1 - O CONTRATADO obriga-se a:
a) Cumprir os prazos estabelecidos para entrega dos laudos;
b) Manter sigilo médico sobre todas as informações;
c) Responsabilizar-se tecnicamente pelos laudos emitidos;

4.2 - A CONTRATANTE obriga-se a:
a) Efetuar os pagamentos conforme acordado;
b) Fornecer as informações necessárias para os laudos;

CLÁUSULA 5ª - DA VIGÊNCIA
Este contrato tem vigência de 12 (doze) meses, renovável automaticamente.

Local e Data: São Paulo, ${new Date().toLocaleDateString('pt-BR')}

_____________________________
${dados.nomeMedico}
CRM: ${dados.crm}

_____________________________
TELEIMAGEM TELEMEDICINA E DIAGNÓSTICOS LTDA
  `;
}