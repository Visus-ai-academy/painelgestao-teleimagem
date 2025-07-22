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
    const { cliente_id, periodo } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', cliente_id)
      .single();

    if (!cliente) {
      return new Response(JSON.stringify({ success: false, error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular período
    const [ano, mes] = periodo.split('-');
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = `${ano}-${mes}-${ultimoDia}`;

    // Buscar faturamento
    const { data: dados } = await supabase
      .from('faturamento')
      .select('data_emissao, cliente, nome_exame, medico, modalidade, especialidade, quantidade, valor_bruto, paciente')
      .eq('cliente', cliente.nome)
      .gte('data_emissao', dataInicio)
      .lte('data_emissao', dataFim);

    if (!dados || dados.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Nenhum dado encontrado para ${cliente.nome} no período ${periodo}` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Agrupar registros únicos
    const unicos = new Map();
    dados.forEach(item => {
      const chave = `${item.data_emissao}_${item.cliente}_${item.nome_exame}_${item.medico}`;
      if (unicos.has(chave)) {
        const existente = unicos.get(chave);
        existente.quantidade += Number(item.quantidade) || 1;
        existente.valor_bruto += Number(item.valor_bruto) || 0;
      } else {
        unicos.set(chave, {
          ...item,
          quantidade: Number(item.quantidade) || 1,
          valor_bruto: Number(item.valor_bruto) || 0
        });
      }
    });

    const registros = Array.from(unicos.values());
    const totalRegistros = registros.length;
    const totalLaudos = registros.reduce((sum, r) => sum + r.quantidade, 0);
    const valorBruto = registros.reduce((sum, r) => sum + r.valor_bruto, 0);

    // Impostos
    const irrf = valorBruto * 0.015;
    const csll = valorBruto * 0.01;
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valorLiquido = valorBruto - impostos;

    // Gerar HTML para PDF
    const nomesMeses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNome = nomesMeses[parseInt(mes)] || mes;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 16px; font-weight: bold; color: #0066cc; margin-bottom: 5px; }
        .subtitle { font-size: 12px; color: #666; }
        .info { margin: 15px 0; }
        .resumo { background: #f8f9fa; padding: 12px; margin: 15px 0; border: 1px solid #ddd; }
        .resumo h3 { margin: 0 0 10px 0; font-size: 13px; }
        .valor-destaque { font-weight: bold; color: #0066cc; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9px; }
        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
        th { background-color: #0066cc; color: white; font-weight: bold; font-size: 9px; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">DEMONSTRATIVO DE FATURAMENTO</div>
        <div class="subtitle">TELEIMAGEM - Diagnóstico por Imagem</div>
    </div>
    
    <div class="info">
        <strong>Cliente:</strong> ${cliente.nome}<br>
        <strong>Período:</strong> ${mesNome}/${ano}<br>
        <strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}
    </div>

    <div class="resumo">
        <h3>RESUMO FINANCEIRO</h3>
        <p><strong>Total de registros únicos:</strong> ${totalRegistros}</p>
        <p><strong>Total de laudos:</strong> ${totalLaudos}</p>
        <p><strong>Valor bruto:</strong> R$ ${valorBruto.toFixed(2)}</p>
        <p><strong>IRRF (1,5%):</strong> R$ ${irrf.toFixed(2)}</p>
        <p><strong>CSLL (1,0%):</strong> R$ ${csll.toFixed(2)}</p>
        <p><strong>PIS (0,65%):</strong> R$ ${pis.toFixed(2)}</p>
        <p><strong>Cofins (3,0%):</strong> R$ ${cofins.toFixed(2)}</p>
        <p><strong>Total de impostos:</strong> R$ ${impostos.toFixed(2)}</p>
        <p class="valor-destaque"><strong>Valor líquido a pagar: R$ ${valorLiquido.toFixed(2)}</strong></p>
    </div>

    <h3>DETALHAMENTO DOS EXAMES (${totalRegistros} registros únicos)</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 12%">Data</th>
                <th style="width: 20%">Paciente</th>
                <th style="width: 18%">Exame</th>
                <th style="width: 18%">Médico</th>
                <th style="width: 12%">Modalidade</th>
                <th style="width: 12%">Especialidade</th>
                <th style="width: 6%">Qtd</th>
                <th style="width: 10%">Valor</th>
            </tr>
        </thead>
        <tbody>
            ${registros.map(item => `
                <tr>
                    <td>${new Date(item.data_emissao).toLocaleDateString('pt-BR')}</td>
                    <td>${(item.cliente || 'N/A').substring(0, 25)}</td>
                    <td>${(item.nome_exame || 'N/A').substring(0, 20)}</td>
                    <td>${(item.medico || 'N/A').substring(0, 20)}</td>
                    <td>${(item.modalidade || 'N/A').substring(0, 12)}</td>
                    <td>${(item.especialidade || 'N/A').substring(0, 12)}</td>
                    <td class="text-center">${item.quantidade}</td>
                    <td class="text-right">R$ ${item.valor_bruto.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    // Gerar PDF usando jsPDF com formatação melhorada
    let pdfBytes;
    let isPdf = true;
    
    try {
      const doc = new jsPDF();
      
      // Função para adicionar cabeçalho
      const addHeader = () => {
        doc.setFontSize(16);
        doc.setTextColor(0, 102, 204);
        doc.text('DEMONSTRATIVO DE FATURAMENTO', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(102, 102, 102);
        doc.text('TELEIMAGEM - Diagnóstico por Imagem', 105, 28, { align: 'center' });
      };
      
      addHeader();
      
      // Informações básicas
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      let y = 45;
      doc.text(`Cliente: ${cliente.nome}`, 20, y);
      doc.text(`Período: ${mesNome}/${ano}`, 20, y + 6);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, y + 12);
      
      // Resumo financeiro em box
      y += 25;
      doc.setFillColor(240, 248, 255);
      doc.rect(15, y - 3, 180, 45, 'F');
      doc.setDrawColor(0, 102, 204);
      doc.rect(15, y - 3, 180, 45);
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text('RESUMO FINANCEIRO', 20, y + 5);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total de registros únicos: ${totalRegistros}`, 20, y + 13);
      doc.text(`Total de laudos: ${totalLaudos}`, 110, y + 13);
      doc.text(`Valor bruto: R$ ${valorBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y + 20);
      doc.text(`IRRF (1,5%): R$ ${irrf.toFixed(2)}`, 20, y + 26);
      doc.text(`CSLL (1,0%): R$ ${csll.toFixed(2)}`, 75, y + 26);
      doc.text(`PIS (0,65%): R$ ${pis.toFixed(2)}`, 125, y + 26);
      doc.text(`Cofins (3,0%): R$ ${cofins.toFixed(2)}`, 20, y + 32);
      doc.text(`Total impostos: R$ ${impostos.toFixed(2)}`, 100, y + 32);
      
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 204);
      doc.setFontSize(10);
      doc.text(`Valor líquido: R$ ${valorLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y + 38);
      
      // Tabela de exames
      y += 55;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text(`DETALHAMENTO DOS EXAMES (${totalRegistros} registros)`, 20, y);
      
      y += 8;
      // Cabeçalho da tabela
      doc.setFillColor(0, 102, 204);
      doc.rect(15, y, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('Data', 18, y + 5);
      doc.text('Paciente', 38, y + 5);
      doc.text('Exame', 85, y + 5);
      doc.text('Médico', 125, y + 5);
      doc.text('Qtd', 165, y + 5);
      doc.text('Valor (R$)', 175, y + 5);
      
      // Dados da tabela com paginação
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      
      let currentY = y + 8;
      const lineHeight = 6;
      const maxY = 280; // Limite da página
      
      registros.forEach((registro, index) => {
        // Verificar se precisa de nova página
        if (currentY > maxY) {
          doc.addPage();
          addHeader();
          currentY = 55;
          
          // Recriar cabeçalho da tabela na nova página
          doc.setFillColor(0, 102, 204);
          doc.rect(15, currentY, 180, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          doc.text('Data', 18, currentY + 5);
          doc.text('Paciente', 38, currentY + 5);
          doc.text('Exame', 85, currentY + 5);
          doc.text('Médico', 125, currentY + 5);
          doc.text('Qtd', 165, currentY + 5);
          doc.text('Valor (R$)', 175, currentY + 5);
          
          currentY += 8;
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
        }
        
        // Linha zebrada
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(15, currentY - 1, 180, lineHeight, 'F');
        }
        
        // Dados da linha
        const data = new Date(registro.data_emissao).toLocaleDateString('pt-BR');
        const paciente = (registro.paciente || registro.cliente || 'N/A').substring(0, 20);
        const exame = (registro.nome_exame || 'N/A').substring(0, 18);
        const medico = (registro.medico || 'N/A').substring(0, 15);
        const qtd = String(registro.quantidade);
        const valor = registro.valor_bruto.toFixed(2);
        
        doc.text(data, 18, currentY + 4);
        doc.text(paciente, 38, currentY + 4);
        doc.text(exame, 85, currentY + 4);
        doc.text(medico, 125, currentY + 4);
        doc.text(qtd, 167, currentY + 4, { align: 'center' });
        doc.text(valor, 192, currentY + 4, { align: 'right' });
        
        currentY += lineHeight;
      });
      
      // Converter para bytes
      const pdfString = doc.output('arraybuffer');
      pdfBytes = new Uint8Array(pdfString);
      
      console.log('PDF gerado com jsPDF - formatação melhorada');
    } catch (pdfError) {
      console.log('Erro na geração de PDF, usando HTML como fallback:', pdfError);
      // Fallback para HTML se PDF falhar
      pdfBytes = new TextEncoder().encode(htmlContent);
      isPdf = false;
    }

    // Salvar arquivo
    const extensao = isPdf ? 'pdf' : 'html';
    const contentType = isPdf ? 'application/pdf' : 'text/html';
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${extensao}`;
    
    const { error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfBytes, {
        contentType,
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error('Erro ao salvar arquivo:', uploadError);
      throw new Error(`Erro ao salvar: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    return new Response(JSON.stringify({
      success: true,
      cliente: cliente.nome,
      periodo,
      total_registros: totalRegistros,
      total_laudos: totalLaudos,
      valor_bruto: valorBruto.toFixed(2),
      valor_liquido: valorLiquido.toFixed(2),
      arquivos: [{
        tipo: extensao,
        url: publicUrl,
        nome: nomeArquivo
      }],
      message: `Relatório gerado: ${totalRegistros} registros, ${totalLaudos} laudos, R$ ${valorBruto.toFixed(2)}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});