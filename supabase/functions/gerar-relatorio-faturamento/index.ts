import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, periodo, data_inicio, data_fim }: FaturamentoRequest = await req.json();

    console.log(`Gerando relatório para cliente ${cliente_id}, período ${periodo}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    // Buscar exames do período
    console.log(`Buscando exames para cliente ${cliente_id} entre ${data_inicio} e ${data_fim}`);
    
    const { data: exames, error: examesError } = await supabase
      .from('exames_realizados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .gte('data_exame', data_inicio)
      .lte('data_exame', data_fim)
      .order('data_exame', { ascending: true });

    if (examesError) {
      console.error('Erro ao buscar exames:', examesError);
      throw new Error(`Erro ao buscar exames: ${examesError.message}`);
    }

    console.log(`Exames encontrados: ${exames?.length || 0}`);

    if (!exames || exames.length === 0) {
      console.log('Nenhum exame encontrado, gerando relatório vazio');
      // Retornar relatório vazio ao invés de erro 404
      const relatorio = {
        cliente: {
          nome: cliente.nome,
          cnpj: cliente.cnpj,
          email: cliente.email
        },
        periodo: periodo,
        resumo: {
          total_laudos: 0,
          valor_bruto: 0,
          franquia: 0,
          ajuste: 0,
          valor_total: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          impostos: 0,
          valor_a_pagar: 0
        },
        exames: []
      };

      // Gerar PDF do relatório vazio
      const pdfContent = await gerarPDFRelatorio(relatorio);
      
      // Determinar extensão baseada no conteúdo
      const contentStart = new TextDecoder().decode(pdfContent.slice(0, 30));
      const isText = contentStart.includes('RELATÓRIO DE VOLUMETRIA');
      const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${isText ? 'txt' : 'pdf'}`;
      
      // Salvar PDF no storage
      const contentType = nomeArquivo.endsWith('.pdf') ? 'application/pdf' : 'text/plain';
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivo, pdfContent, {
          contentType: contentType,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Erro ao salvar PDF vazio:', uploadError);
        // Se falhar, retornar com link temporário
        const linkRelatorio = `#relatorio-${cliente_id}-${periodo}`;
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            relatorio,
            linkRelatorio,
            nomeArquivo,
            message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Gerar URL público do PDF
      const { data: { publicUrl } } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(nomeArquivo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          relatorio,
          linkRelatorio: publicUrl,
          nomeArquivo,
          message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calcular totais
    const total_laudos = exames.length;
    const valor_bruto = exames.reduce((sum, exame) => sum + (exame.valor_bruto || 0), 0);
    const franquia = 0;
    const ajuste = 0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    // Gerar dados do relatório
    const relatorio = {
      cliente: {
        nome: cliente.nome,
        cnpj: cliente.cnpj,
        email: cliente.email
      },
      periodo: periodo,
      resumo: {
        total_laudos,
        valor_bruto,
        franquia,
        ajuste,
        valor_total,
        irrf,
        csll,
        pis,
        cofins,
        impostos,
        valor_a_pagar
      },
      exames: exames.map(exame => ({
        data_estudo: exame.data_exame,
        paciente: exame.paciente,
        medico: exame.medico,
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria || '',
        prioridade: exame.prioridade || '',
        valor: exame.valor_bruto || 0
      }))
    };

    console.log(`Relatório gerado com ${exames.length} exames, valor total: R$ ${valor_total.toFixed(2)}`);

    // Gerar PDF do relatório
    const pdfContent = await gerarPDFRelatorio(relatorio);
    
    // Determinar extensão baseada no conteúdo
    const contentStart = new TextDecoder().decode(pdfContent.slice(0, 30));
    const isText = contentStart.includes('RELATÓRIO DE VOLUMETRIA');
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${isText ? 'txt' : 'pdf'}`;
    
    // Salvar PDF no storage
    const contentType = nomeArquivo.endsWith('.pdf') ? 'application/pdf' : 'text/plain';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfContent, {
        contentType: contentType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Erro ao salvar PDF:', uploadError);
      throw new Error(`Erro ao salvar relatório: ${uploadError.message}`);
    }

    // Gerar URL público do PDF
    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    console.log('PDF salvo com sucesso:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        linkRelatorio: publicUrl,
        nomeArquivo,
        message: `Relatório gerado com sucesso para ${cliente.nome}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Função para gerar PDF do relatório usando PDFKit
async function gerarPDFRelatorio(relatorio: any): Promise<Uint8Array> {
  try {
    // Importar PDFKit que funciona no Deno
    const PDFDocument = (await import('https://esm.sh/pdfkit@0.13.0')).default;
    
    // Criar novo documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Relatório de Faturamento - ${relatorio.cliente.nome}`,
        Author: 'Sistema de Faturamento',
        Subject: `Relatório período ${relatorio.periodo}`,
        Creator: 'Sistema Teleimagem'
      }
    });

    // Buffer para armazenar o PDF
    const chunks: Uint8Array[] = [];
    
    // Configurar stream para capturar dados
    doc.on('data', (chunk: any) => {
      chunks.push(new Uint8Array(chunk));
    });

    // Cabeçalho
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Relatório de Volumetria - Faturamento', 50, 50)
       .fontSize(14)
       .font('Helvetica')
       .text(`Período: ${relatorio.periodo}`, 50, 80);

    // Linha separadora
    doc.moveTo(50, 100)
       .lineTo(550, 100)
       .stroke();

    // Dados do Cliente
    let y = 120;
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Dados do Cliente', 50, y);

    y += 25;
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Nome: ${relatorio.cliente.nome}`, 50, y);

    y += 15;
    doc.text(`CNPJ: ${relatorio.cliente.cnpj || 'Não informado'}`, 50, y);

    y += 15;
    doc.text(`Email: ${relatorio.cliente.email}`, 50, y);

    // Linha separadora
    y += 25;
    doc.moveTo(50, y)
       .lineTo(550, y)
       .stroke();

    // Resumo Financeiro
    y += 20;
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Resumo Financeiro', 50, y);

    y += 25;
    doc.fontSize(12).font('Helvetica');

    const financialData = [
      ['Total de Laudos:', relatorio.resumo.total_laudos.toString()],
      ['Valor Bruto:', `R$ ${relatorio.resumo.valor_bruto.toFixed(2).replace('.', ',')}`],
      ['Franquia:', `R$ ${relatorio.resumo.franquia.toFixed(2).replace('.', ',')}`],
      ['Ajuste:', `R$ ${relatorio.resumo.ajuste.toFixed(2).replace('.', ',')}`],
      ['Valor Total:', `R$ ${relatorio.resumo.valor_total.toFixed(2).replace('.', ',')}`],
      ['IRRF (1,5%):', `R$ ${relatorio.resumo.irrf.toFixed(2).replace('.', ',')}`],
      ['CSLL (1%):', `R$ ${relatorio.resumo.csll.toFixed(2).replace('.', ',')}`],
      ['PIS (0,65%):', `R$ ${relatorio.resumo.pis.toFixed(2).replace('.', ',')}`],
      ['COFINS (3%):', `R$ ${relatorio.resumo.cofins.toFixed(2).replace('.', ',')}`],
      ['Total Impostos:', `R$ ${relatorio.resumo.impostos.toFixed(2).replace('.', ',')}`],
      ['VALOR A PAGAR:', `R$ ${relatorio.resumo.valor_a_pagar.toFixed(2).replace('.', ',')}`]
    ];

    financialData.forEach(([label, value], index) => {
      if (index === 4 || index === 10) { // Valor Total e Valor a Pagar
        doc.font('Helvetica-Bold');
      } else {
        doc.font('Helvetica');
      }
      
      doc.text(label, 50, y);
      doc.text(value, 350, y);
      y += 15;
    });

    // Nova página para exames se necessário
    if (relatorio.exames.length > 0) {
      doc.addPage();
      y = 50;

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Detalhamento dos Exames', 50, y);

      y += 30;

      // Cabeçalho da tabela
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Data', 50, y)
         .text('Paciente', 100, y)
         .text('Médico', 200, y)
         .text('Modalidade', 300, y)
         .text('Especialidade', 400, y)
         .text('Valor', 500, y);

      // Linha do cabeçalho
      y += 15;
      doc.moveTo(50, y)
         .lineTo(550, y)
         .stroke();

      y += 10;
      doc.font('Helvetica');

      // Dados dos exames (máximo 25 por página)
      relatorio.exames.slice(0, 25).forEach((exame: any, index: number) => {
        if (y > 750) { // Nova página se necessário
          doc.addPage();
          y = 50;
        }

        const dataFormatada = new Date(exame.data_estudo).toLocaleDateString('pt-BR');
        const pacienteAbrev = exame.paciente.length > 20 ? exame.paciente.substring(0, 17) + '...' : exame.paciente;
        const medicoAbrev = exame.medico.length > 20 ? exame.medico.substring(0, 17) + '...' : exame.medico;
        const modalidadeAbrev = exame.modalidade.length > 15 ? exame.modalidade.substring(0, 12) + '...' : exame.modalidade;
        const especialidadeAbrev = exame.especialidade.length > 15 ? exame.especialidade.substring(0, 12) + '...' : exame.especialidade;

        doc.text(dataFormatada, 50, y)
           .text(pacienteAbrev, 100, y)
           .text(medicoAbrev, 200, y)
           .text(modalidadeAbrev, 300, y)
           .text(especialidadeAbrev, 400, y)
           .text(`R$ ${exame.valor.toFixed(2).replace('.', ',')}`, 500, y);

        y += 12;
      });

      if (relatorio.exames.length > 25) {
        y += 10;
        doc.fontSize(10)
           .font('Helvetica-Oblique')
           .text(`... e mais ${relatorio.exames.length - 25} exames`, 50, y);
      }
    } else {
      y += 30;
      doc.fontSize(12)
         .font('Helvetica-Oblique')
         .text('Nenhum exame encontrado para o período especificado.', 50, y);
    }

    // Rodapé
    doc.fontSize(8)
       .font('Helvetica')
       .text(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, 50, 750);

    // Finalizar documento
    doc.end();

    // Esperar todos os chunks serem coletados
    return new Promise((resolve) => {
      doc.on('end', () => {
        // Combinar todos os chunks em um único Uint8Array
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        resolve(result);
      });
    });

  } catch (error) {
    console.error('Erro ao gerar PDF com PDFKit:', error);
    
    // Fallback simples: gerar um arquivo de texto estruturado
    const textContent = `
RELATÓRIO DE VOLUMETRIA - FATURAMENTO
Período: ${relatorio.periodo}

========================================
DADOS DO CLIENTE
========================================
Nome: ${relatorio.cliente.nome}
CNPJ: ${relatorio.cliente.cnpj || 'Não informado'}
Email: ${relatorio.cliente.email}

========================================
RESUMO FINANCEIRO
========================================
Total de Laudos: ${relatorio.resumo.total_laudos}
Valor Bruto: R$ ${relatorio.resumo.valor_bruto.toFixed(2).replace('.', ',')}
Franquia: R$ ${relatorio.resumo.franquia.toFixed(2).replace('.', ',')}
Ajuste: R$ ${relatorio.resumo.ajuste.toFixed(2).replace('.', ',')}
Valor Total: R$ ${relatorio.resumo.valor_total.toFixed(2).replace('.', ',')}
IRRF (1,5%): R$ ${relatorio.resumo.irrf.toFixed(2).replace('.', ',')}
CSLL (1%): R$ ${relatorio.resumo.csll.toFixed(2).replace('.', ',')}
PIS (0,65%): R$ ${relatorio.resumo.pis.toFixed(2).replace('.', ',')}
COFINS (3%): R$ ${relatorio.resumo.cofins.toFixed(2).replace('.', ',')}
Total Impostos: R$ ${relatorio.resumo.impostos.toFixed(2).replace('.', ',')}
VALOR A PAGAR: R$ ${relatorio.resumo.valor_a_pagar.toFixed(2).replace('.', ',')}

========================================
DETALHAMENTO DOS EXAMES
========================================
${relatorio.exames.length > 0 ? 
  relatorio.exames.map((exame: any) => 
    `Data: ${new Date(exame.data_estudo).toLocaleDateString('pt-BR')} | Paciente: ${exame.paciente} | Médico: ${exame.medico} | Modalidade: ${exame.modalidade} | Especialidade: ${exame.especialidade} | Valor: R$ ${exame.valor.toFixed(2).replace('.', ',')}`
  ).join('\n') : 
  'Nenhum exame encontrado para o período especificado.'
}

========================================
Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
    `;
    
    const encoder = new TextEncoder();
    return encoder.encode(textContent);
  }
}

serve(handler);