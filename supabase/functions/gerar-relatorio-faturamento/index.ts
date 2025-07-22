
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Função iniciada');
    
    const body = await req.json();
    console.log('Body recebido:', JSON.stringify(body));
    
    const { cliente_id, periodo } = body;
    console.log('Parâmetros extraídos - cliente_id:', cliente_id, 'periodo:', periodo);
    
    if (!cliente_id || !periodo) {
      return new Response(JSON.stringify({
        success: false,
        error: "Parâmetros obrigatórios: cliente_id e periodo"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', cliente_id)
      .maybeSingle();

    if (clienteError) {
      console.error('Erro ao buscar cliente:', clienteError);
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao buscar dados do cliente: " + clienteError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cliente) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cliente não encontrado"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Cliente encontrado:', cliente.nome);

    // Calcular datas do período
    const [ano, mes] = periodo.split('-');
    const dataInicio = `${ano}-${mes.padStart(2, '0')}-01`;
    const proximoMes = parseInt(mes) === 12 ? 1 : parseInt(mes) + 1;
    const proximoAno = parseInt(mes) === 12 ? parseInt(ano) + 1 : parseInt(ano);
    const dataFim = `${proximoAno}-${proximoMes.toString().padStart(2, '0')}-01`;

    console.log(`Buscando dados para cliente: ${cliente.nome}, período: ${dataInicio} a ${dataFim}`);
    console.log(`Buscando no campo 'paciente' por: ${cliente.nome}`);

    // Buscar dados de faturamento com múltiplas estratégias
    const queries = [
      // 1. Por cliente_id
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_id', cliente_id)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 2. Por nome do cliente no campo paciente (onde estão os códigos das clínicas)
      supabase
        .from('faturamento')
        .select('*')
        .eq('paciente', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 3. Por campo cliente_nome
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_nome', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim)
    ];

    const results = await Promise.all(queries);
    
    console.log('Resultados das consultas:');
    results.forEach((result, index) => {
      console.log(`Query ${index + 1}:`, result.data?.length || 0, 'registros, erro:', result.error?.message || 'nenhum');
      if (result.data && result.data.length > 0) {
        console.log(`Primeiros dados da Query ${index + 1}:`, JSON.stringify(result.data.slice(0, 2)));
      }
    });

    // Combinar todos os resultados únicos
    const allData = [];
    const seenIds = new Set();

    for (const result of results) {
      if (result.data) {
        for (const item of result.data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allData.push(item);
          }
        }
      }
    }

    console.log('Total de dados únicos encontrados:', allData.length);

    // Calcular resumo
    const valorTotal = allData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
    const totalExames = allData.reduce((sum, item) => sum + (parseInt(item.quantidade) || 1), 0);

    // Gerar PDF sempre (mesmo sem dados)
    let pdfUrl = null;
    try {
      console.log('Gerando relatório PDF...');
      
      // Criar novo documento PDF
      const doc = new jsPDF();
      
      // Configurar fonte
      doc.setFont('helvetica');
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(0, 124, 186); // #007cba
      doc.text('Relatório de Faturamento', 105, 20, { align: 'center' });
      
      // Informações do cliente
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Cliente: ${cliente.nome}`, 20, 40);
      doc.text(`Período: ${periodo}`, 20, 50);
      doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 20, 60);
      
      // Linha separadora
      doc.setDrawColor(0, 124, 186);
      doc.line(20, 70, 190, 70);
      
      // Resumo executivo
      doc.setFontSize(16);
      doc.setTextColor(0, 124, 186);
      doc.text('Resumo Executivo', 20, 85);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total de Exames: ${totalExames.toLocaleString('pt-BR')}`, 20, 100);
      doc.text(`Valor Total: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 110);
      doc.text(`Registros Encontrados: ${allData.length}`, 20, 120);
      
      if (allData.length > 0) {
        // Cabeçalho da tabela
        let yPosition = 140;
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(0, 124, 186);
        doc.rect(20, yPosition - 5, 170, 10, 'F');
        
        doc.text('Data', 25, yPosition);
        doc.text('Paciente', 50, yPosition);
        doc.text('Médico', 90, yPosition);
        doc.text('Modalidade', 120, yPosition);
        doc.text('Valor', 160, yPosition);
        
        yPosition += 15;
        doc.setTextColor(0, 0, 0);
        
        // Dados da tabela
        for (let i = 0; i < Math.min(allData.length, 20); i++) { // Limitar a 20 registros por página
          const item = allData[i];
          
          if (yPosition > 270) { // Nova página se necessário
            doc.addPage();
            yPosition = 30;
          }
          
          doc.text((item.data_exame || item.data_emissao || '-').substring(0, 10), 25, yPosition);
          doc.text((item.paciente || '-').substring(0, 20), 50, yPosition);
          doc.text((item.medico || '-').substring(0, 15), 90, yPosition);
          doc.text((item.modalidade || '-').substring(0, 15), 120, yPosition);
          doc.text(`R$ ${parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 160, yPosition);
          
          yPosition += 8;
        }
        
        if (allData.length > 20) {
          yPosition += 10;
          doc.setFontSize(10);
          doc.setTextColor(128, 128, 128);
          doc.text(`... e mais ${allData.length - 20} registros`, 20, yPosition);
        }
      } else {
        // Mensagem de nenhum dado encontrado
        doc.setFontSize(14);
        doc.setTextColor(128, 128, 128);
        doc.text('Nenhum dado encontrado', 105, 160, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Não foram encontrados registros de faturamento para este cliente no período selecionado.', 105, 175, { align: 'center' });
      }
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Relatório gerado automaticamente pelo Sistema de Faturamento', 105, 280, { align: 'center' });
        doc.text(`© ${new Date().getFullYear()} - Todos os direitos reservados`, 105, 285, { align: 'center' });
        doc.text(`Página ${i} de ${pageCount}`, 190, 290, { align: 'right' });
      }
      
      // Converter PDF para buffer
      const pdfBuffer = doc.output('arraybuffer');
      
      // Salvar PDF no storage
      const fileName = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(fileName, new Uint8Array(pdfBuffer), {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro no upload do PDF:', uploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('relatorios-faturamento')
          .getPublicUrl(fileName);
        
        pdfUrl = publicUrl;
        console.log('Relatório PDF gerado com sucesso:', pdfUrl);
      }
      } catch (pdfError) {
        console.error('Erro na geração do relatório:', pdfError);
      }

    // Sempre retornar sucesso, mesmo sem dados
    const response = {
      success: true,
      message: "Relatório gerado com sucesso",
      cliente: cliente.nome,
      periodo: periodo,
      totalRegistros: allData.length,
      dadosEncontrados: allData.length > 0,
      dados: allData,
      arquivos: pdfUrl ? [{ tipo: 'pdf', url: pdfUrl, nome: `relatorio_${cliente.nome}_${periodo}.pdf` }] : [],
      resumo: {
        total_laudos: totalExames,
        valor_total: valorTotal,
        total_exames: totalExames
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro capturado:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
