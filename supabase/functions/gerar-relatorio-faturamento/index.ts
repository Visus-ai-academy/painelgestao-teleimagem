
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
    
    // DEBUG: Verificar se há dados na tabela
    const { data: totalCount, error: countError } = await supabase
      .from('faturamento')
      .select('*', { count: 'exact', head: true });
    
    console.log(`DEBUG: Total de registros na tabela faturamento: ${totalCount?.length || 'N/A'}`);
    if (countError) console.log('DEBUG: Erro ao contar registros:', countError);
    
    // DEBUG: Buscar alguns registros para ver estrutura
    const { data: sampleData, error: sampleError } = await supabase
      .from('faturamento')
      .select('cliente, cliente_nome, data_emissao')
      .limit(5);
    
    console.log('DEBUG: Amostra de dados na tabela:', JSON.stringify(sampleData));
    if (sampleError) console.log('DEBUG: Erro ao buscar amostra:', sampleError);
    
    console.log(`Buscando no campo correto. Cliente da tabela clientes: ${cliente.nome}`);
    
    // Buscar dados de faturamento - corrigindo o mapeamento
    // O nome da clínica está na coluna 'paciente', não 'cliente'
    const queries = [
      // 1. Por cliente_id (relacionamento direto)
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_id', cliente_id)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 2. Por nome completo do cliente na coluna 'paciente' (mapeamento correto)
      supabase
        .from('faturamento')
        .select('*')
        .eq('paciente', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 3. Por busca parcial no nome do cliente na coluna 'paciente'
      supabase
        .from('faturamento')
        .select('*')
        .ilike('paciente', `%${cliente.nome}%`)
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

    // Calcular resumo usando valor_bruto e quantidade
    const valorBrutoTotal = allData.reduce((sum, item) => sum + (parseFloat(item.valor_bruto) || 0), 0);
    const totalLaudos = allData.reduce((sum, item) => sum + (parseInt(item.quantidade) || 1), 0);
    
    // Calcular impostos (percentuais fixos para exemplo - podem ser configuráveis)
    const percentualPIS = 0.65; // 0.65%
    const percentualCOFINS = 3.0; // 3%
    const percentualCSLL = 1.08; // 1.08%
    const percentualIR = 1.08; // 1.08%
    const percentualISSQN = 5.0; // 5%
    
    const valorPIS = valorBrutoTotal * (percentualPIS / 100);
    const valorCOFINS = valorBrutoTotal * (percentualCOFINS / 100);
    const valorCSLL = valorBrutoTotal * (percentualCSLL / 100);
    const valorIR = valorBrutoTotal * (percentualIR / 100);
    const valorISSQN = valorBrutoTotal * (percentualISSQN / 100);
    
    const totalImpostos = valorPIS + valorCOFINS + valorCSLL + valorIR + valorISSQN;
    const valorAPagar = valorBrutoTotal - totalImpostos;
    
    // Valores de franquia e ajustes (podem ser zero por enquanto - configuráveis)
    const franquia = 0;
    const ajustes = 0;
    const integracao = 0;

    // Gerar PDF sempre (mesmo sem dados)
    let pdfUrl = null;
    try {
      console.log('Gerando relatório PDF...');
      
      // Criar novo documento PDF
      const doc = new jsPDF();
      
      // Configurar fonte
      doc.setFont('helvetica');
      
      // === CABEÇALHO ===
      doc.setFontSize(20);
      doc.setTextColor(0, 124, 186); // #007cba
      doc.text('RELATÓRIO DE FATURAMENTO', 105, 20, { align: 'center' });
      
      // Informações do cliente
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Cliente: ${cliente.nome}`, 20, 35);
      doc.text(`Período: ${periodo}`, 20, 45);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 150, 35);
      
      // Linha separadora
      doc.setDrawColor(0, 124, 186);
      doc.setLineWidth(1);
      doc.line(20, 55, 190, 55);
      
      // === QUADRO 1 - RESUMO DO CLIENTE ===
      doc.setFontSize(16);
      doc.setTextColor(0, 124, 186);
      doc.text('QUADRO 1 - RESUMO DO CLIENTE', 20, 70);
      
      // Caixa do resumo
      doc.setDrawColor(0, 124, 186);
      doc.setLineWidth(0.5);
      doc.rect(20, 75, 170, 65);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Coluna da esquerda
      doc.text(`Total de Laudos Realizados: ${totalLaudos.toLocaleString('pt-BR')}`, 25, 85);
      doc.text(`Valor Bruto: R$ ${valorBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 95);
      doc.text(`Franquia: R$ ${franquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 105);
      doc.text(`Ajustes: R$ ${ajustes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 115);
      doc.text(`Integração: R$ ${integracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 125);
      
      // Coluna da direita - Impostos
      doc.text('IMPOSTOS:', 110, 85);
      doc.text(`PIS (${percentualPIS}%): R$ ${valorPIS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 95);
      doc.text(`COFINS (${percentualCOFINS}%): R$ ${valorCOFINS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 105);
      doc.text(`CSLL (${percentualCSLL}%): R$ ${valorCSLL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 115);
      doc.text(`IR (${percentualIR}%): R$ ${valorIR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 125);
      doc.text(`ISSQN (${percentualISSQN}%): R$ ${valorISSQN.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 135);
      
      // Valor total dos impostos e valor a pagar
      doc.setDrawColor(0, 0, 0);
      doc.line(25, 128, 185, 128);
      
      doc.setFontSize(14);
      doc.setTextColor(255, 0, 0);
      doc.text(`Total de Impostos: R$ ${totalImpostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 138);
      
      doc.setFontSize(16);
      doc.setTextColor(0, 128, 0);
      doc.text(`VALOR A PAGAR: R$ ${valorAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 105, 155, { align: 'center' });
      
      // === QUADRO 2 - DETALHAMENTO ===
      let yPosition = 175;
      doc.setFontSize(16);
      doc.setTextColor(0, 124, 186);
      doc.text('QUADRO 2 - DETALHAMENTO', 20, yPosition);
      
      yPosition += 10;
      
      if (allData.length > 0) {
        // Cabeçalho da tabela detalhada
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(0, 124, 186);
        doc.rect(20, yPosition, 170, 8, 'F');
        
        doc.text('Data', 22, yPosition + 5);
        doc.text('Paciente', 35, yPosition + 5);
        doc.text('Médico', 55, yPosition + 5);
        doc.text('Exame', 72, yPosition + 5);
        doc.text('Modal.', 95, yPosition + 5);
        doc.text('Espec.', 108, yPosition + 5);
        doc.text('Categ.', 121, yPosition + 5);
        doc.text('Prior.', 134, yPosition + 5);
        doc.text('Qtd', 147, yPosition + 5);
        doc.text('Valor', 160, yPosition + 5);
        
        yPosition += 12;
        doc.setTextColor(0, 0, 0);
        
        // Dados da tabela detalhada
        for (let i = 0; i < allData.length; i++) {
          const item = allData[i];
          
          if (yPosition > 275) { // Nova página se necessário
            doc.addPage();
            yPosition = 30;
            
            // Repetir cabeçalho na nova página
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(0, 124, 186);
            doc.rect(20, yPosition, 170, 8, 'F');
            
            doc.text('Data', 22, yPosition + 5);
            doc.text('Paciente', 35, yPosition + 5);
            doc.text('Médico', 55, yPosition + 5);
            doc.text('Exame', 72, yPosition + 5);
            doc.text('Modal.', 95, yPosition + 5);
            doc.text('Espec.', 108, yPosition + 5);
            doc.text('Categ.', 121, yPosition + 5);
            doc.text('Prior.', 134, yPosition + 5);
            doc.text('Qtd', 147, yPosition + 5);
            doc.text('Valor', 160, yPosition + 5);
            
            yPosition += 12;
            doc.setTextColor(0, 0, 0);
          }
          
          // Alternar cores das linhas
          if (i % 2 === 1) {
            doc.setFillColor(240, 240, 240);
            doc.rect(20, yPosition - 2, 170, 6, 'F');
          }
          
          doc.setFontSize(7);
          doc.text((item.data_exame || item.data_emissao || '-').substring(0, 8), 22, yPosition + 2);
          doc.text((item.cliente || '-').substring(0, 12), 35, yPosition + 2); // Nome do paciente na coluna cliente
          doc.text((item.medico || '-').substring(0, 12), 55, yPosition + 2);
          doc.text((item.nome_exame || '-').substring(0, 15), 72, yPosition + 2);
          doc.text((item.modalidade || '-').substring(0, 8), 95, yPosition + 2);
          doc.text((item.especialidade || '-').substring(0, 8), 108, yPosition + 2);
          doc.text((item.categoria || '-').substring(0, 8), 121, yPosition + 2);
          doc.text((item.prioridade || '-').substring(0, 8), 134, yPosition + 2);
          doc.text((item.quantidade || '1').toString(), 147, yPosition + 2);
          doc.text(`R$ ${parseFloat(item.valor_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 160, yPosition + 2);
          
          yPosition += 6;
        }
      } else {
        // Mensagem de nenhum dado encontrado
        doc.setFontSize(14);
        doc.setTextColor(128, 128, 128);
        doc.text('Nenhum dado encontrado para o período selecionado', 105, yPosition + 30, { align: 'center' });
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
        total_laudos: totalLaudos,
        valor_bruto_total: valorBrutoTotal,
        valor_a_pagar: valorAPagar,
        total_impostos: totalImpostos
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
