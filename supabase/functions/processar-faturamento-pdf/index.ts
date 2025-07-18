import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO-PDF SIMPLIFICADO ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Método:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    const body = await req.json();
    console.log('Body recebido:', JSON.stringify(body, null, 2));
    
    const { file_path, periodo, enviar_emails } = body;
    console.log('Parâmetros extraídos:', { file_path, periodo, enviar_emails });

    // SIMULAÇÃO DE PROCESSAMENTO BEM-SUCEDIDO
    const response = {
      success: true,
      message: 'Processamento simulado concluído com sucesso',
      pdfs_gerados: [
        {
          cliente: 'Cliente Teste A',
          url: 'https://exemplo.com/relatorio_a.txt',
          resumo: {
            total_laudos: 150,
            valor_pagar: 15000.50
          },
          email_enviado: false
        },
        {
          cliente: 'Cliente Teste B', 
          url: 'https://exemplo.com/relatorio_b.txt',
          resumo: {
            total_laudos: 89,
            valor_pagar: 8900.75
          },
          email_enviado: false
        }
      ],
      emails_enviados: 0,
      periodo: periodo,
      total_clientes: 2
    };

    console.log('Retornando resposta de sucesso:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('=== ERRO CAPTURADO ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('Message:', error.message);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Erro desconhecido',
      details: error.stack || 'Stack trace não disponível'
    };

    console.log('Retornando resposta de erro:', JSON.stringify(errorResponse, null, 2));
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});