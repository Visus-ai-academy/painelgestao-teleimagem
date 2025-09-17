
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Adicionar timeout de 25 segundos (limite do Supabase é 30s)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout: Processamento excedeu 25 segundos')), 25000);
  });

  const processRequest = async () => {
    // Função para formatar CNPJ
    const formatarCNPJ = (cnpj: string): string => {
      if (!cnpj) return '';
      
      // Remove caracteres não numéricos
      const somenteNumeros = cnpj.replace(/\D/g, '');
      
      // Se não tem 14 dígitos, retorna como está
      if (somenteNumeros.length !== 14) return cnpj;
      
      // Aplica a formatação: 00.000.000/0000-00
      return somenteNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    try {
      console.log('Função iniciada');
    
    const body = await req.json();
    const demonstrativoData = body?.demonstrativo_data || null;
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

    // Buscar dados do cliente (prioritizar o que tem preços se houver duplicatas)
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj')
      .eq('id', cliente_id)
      .maybeSingle();

    // Se não encontrou ou se não tem preços, tentar buscar versão com preços
    if (!cliente || clienteError) {
      console.log('❗ Cliente não encontrado pelo ID, buscando versão com preços...');
      
      // Buscar cliente com mesmo nome que tenha preços ativos
      const { data: clienteComPrecos } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj')
        .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
        .limit(10);
      
      if (clienteComPrecos && clienteComPrecos.length > 0) {
        // Se há apenas um, usar esse
        if (clienteComPrecos.length === 1) {
          cliente = clienteComPrecos[0];
          console.log(`✅ Substituído para cliente com preços: ${cliente.nome} (ID: ${clienteComPrecos[0].id})`);
        } else {
          // Se há vários, usar o primeiro (pode melhorar a lógica aqui se necessário)
          cliente = clienteComPrecos[0];
          console.log(`⚠️ Múltiplos clientes com preços encontrados, usando: ${cliente.nome}`);
        }
      }
    }

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

    console.log(`🔍 Buscando dados para: Cliente=${cliente.nome} | NomeFantasia=${cliente.nome_fantasia} | Período=${dataInicio} a ${dataFim}`);
    
    // Buscar dados de faturamento usando NOME FANTASIA do cliente prioritariamente
    console.log('📊 Buscando dados de faturamento pelo nome fantasia...');
    
    let { data: dataFaturamento, error: errorFaturamento } = await supabase
      .from('faturamento')
      .select('*, accession_number, cliente_nome_original')
      .eq('cliente_nome', cliente.nome_fantasia || cliente.nome) // Usar nome_fantasia prioritariamente
      .eq('periodo_referencia', periodo);

    console.log(`📊 Faturamento encontrado: ${dataFaturamento?.length || 0} registros`);
    
    if (!dataFaturamento || dataFaturamento.length === 0) {
      console.log('⚠️ Nenhum dado de faturamento encontrado, tentando volumetria...');
      
      // Buscar dados de volumetria como fallback (cliente_nome_fantasia)
      const { data: dataVolumetriaFantasia } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .eq('"Cliente_Nome_Fantasia"', cliente.nome_fantasia || cliente.nome)
        .neq('tipo_faturamento', 'NC-NF');
      
      console.log(`📊 Volumetria (Cliente_Nome_Fantasia) encontrada: ${dataVolumetriaFantasia?.length || 0} registros`);
      
      if (dataVolumetriaFantasia && dataVolumetriaFantasia.length > 0) {
        dataFaturamento = dataVolumetriaFantasia;
      } else {
        // Fallback adicional: buscar por EMPRESA com múltiplos candidatos
        const candidatos = [cliente.nome_fantasia, cliente.nome].filter(Boolean);
        const { data: dataVolumetriaEmpresa } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('periodo_referencia', periodo)
          .in('"EMPRESA"', candidatos as string[])
          .neq('tipo_faturamento', 'NC-NF');
        console.log(`📊 Volumetria (EMPRESA) encontrada: ${dataVolumetriaEmpresa?.length || 0} registros`);
        if (dataVolumetriaEmpresa && dataVolumetriaEmpresa.length > 0) {
          dataFaturamento = dataVolumetriaEmpresa;
        }
      }
    }

    let finalData = dataFaturamento || [];
    
    // Preparar mapa de preços por combinação para volumetria (modalidade|especialidade|categoria|prioridade)
    const isFaturamentoDataLocalPrimario = finalData.length > 0 && Object.prototype.hasOwnProperty.call(finalData[0], 'valor');
    let precoPorCombo: Record<string, number> = {};

    if (!isFaturamentoDataLocalPrimario) {
      // Agrupar volumetria para obter volume por combinação (usado na faixa de preço)
      const grupos: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }>
        = {};
      for (const item of finalData as any[]) {
        const modalidade = (item.MODALIDADE || '').toString();
        const especialidade = (item.ESPECIALIDADE || '').toString();
        const categoria = (item.CATEGORIA || 'SC').toString();
        const prioridade = (item.PRIORIDADE || '').toString();
        const key = `${modalidade}|${especialidade}|${categoria}|${prioridade}`;
        const qtd = Number(item.VALORES || 0) || 0;
        if (!grupos[key]) {
          grupos[key] = { modalidade, especialidade, categoria, prioridade, quantidade: 0 };
        }
        grupos[key].quantidade += qtd;
      }

      // Buscar condição de volume do contrato
      const { data: contrato } = await supabase
        .from('contratos_clientes')
        .select('cond_volume')
        .eq('cliente_id', cliente_id)
        .eq('status', 'ativo')
        .single();
      
      const condVolume = contrato?.cond_volume || 'MOD/ESP/CAT';
      console.log(`📊 Condição de Volume: ${condVolume}`);

      // Consultar preço unitário via RPC uma única vez por combinação
      const combos = Object.entries(grupos);
      if (combos.length > 0) {
        // Calcular volumes agregados conforme cond_volume
        const volumesAgregados = new Map<string, number>();
        
        for (const [key, g] of combos) {
          const isPlantao = g.prioridade.includes('PLANTAO') || g.prioridade.includes('PLANTÃO');
          
          // Definir chave de agregação conforme cond_volume
          let chaveAgregacao = '';
          switch (condVolume) {
            case 'MOD/ESP/CAT':
              chaveAgregacao = `${g.modalidade}|${g.especialidade}|${g.categoria || 'SC'}`;
              break;
            case 'MOD/ESP':
              chaveAgregacao = `${g.modalidade}|${g.especialidade}`;
              break;
            case 'MOD':
              chaveAgregacao = g.modalidade;
              break;
            default:
              chaveAgregacao = `${g.modalidade}|${g.especialidade}|${g.categoria || 'SC'}`;
          }

          // Para exames de plantão, verificar se deve considerar no volume agregado
          if (isPlantao) {
            // Verificar se preço considera plantão no volume agregado
            const { data: precoPlantao } = await supabase
              .from('precos_servicos')
              .select('considera_prioridade_plantao')
              .eq('cliente_id', cliente_id)
              .eq('modalidade', g.modalidade)
              .eq('especialidade', g.especialidade)
              .eq('categoria', g.categoria || 'SC')
              .eq('prioridade', g.prioridade)
              .eq('ativo', true)
              .maybeSingle();

            // Só adiciona ao volume agregado se considera plantão
            if (precoPlantao?.considera_prioridade_plantao) {
              volumesAgregados.set(
                chaveAgregacao, 
                (volumesAgregados.get(chaveAgregacao) || 0) + g.quantidade
              );
            }
          } else {
            // Exames não-plantão sempre entram no volume agregado
            volumesAgregados.set(
              chaveAgregacao, 
              (volumesAgregados.get(chaveAgregacao) || 0) + g.quantidade
            );
          }
        }

        console.log('📈 Volumes agregados por condição:', Object.fromEntries(volumesAgregados));

        // Calcular preços por combo usando volume agregado correto
        await Promise.all(
          combos.map(async ([key, g]) => {
            const isPlantao = g.prioridade.includes('PLANTAO') || g.prioridade.includes('PLANTÃO');
            
            // Definir chave de agregação para buscar volume
            let chaveAgregacao = '';
            switch (condVolume) {
              case 'MOD/ESP/CAT':
                chaveAgregacao = `${g.modalidade}|${g.especialidade}|${g.categoria || 'SC'}`;
                break;
              case 'MOD/ESP':
                chaveAgregacao = `${g.modalidade}|${g.especialidade}`;
                break;
              case 'MOD':
                chaveAgregacao = g.modalidade;
                break;
              default:
                chaveAgregacao = `${g.modalidade}|${g.especialidade}|${g.categoria || 'SC'}`;
            }
            
            // Para exames de plantão, usar o volume próprio (não agregado)
            const volumeParaCalculo = isPlantao 
              ? g.quantidade 
              : (volumesAgregados.get(chaveAgregacao) || g.quantidade);
            
            try {
              console.log(`🔍 Calculando preço para: ${key}`);
              console.log(`   Cliente: ${cliente_id}`);
              console.log(`   Modalidade: ${g.modalidade}`);
              console.log(`   Especialidade: ${g.especialidade}`);
              console.log(`   Categoria: ${g.categoria || 'SC'}`);
              console.log(`   Prioridade: ${g.prioridade}`);
              console.log(`   Volume próprio: ${g.quantidade}`);
              console.log(`   Volume agregado: ${volumeParaCalculo}`);
              console.log(`   É plantão: ${isPlantao}`);
              
              const { data: preco, error } = await supabase.rpc('calcular_preco_exame', {
                p_cliente_id: cliente_id,
                p_modalidade: g.modalidade,
                p_especialidade: g.especialidade,
                p_prioridade: g.prioridade,
                p_categoria: g.categoria || 'SC',
                p_volume_total: volumeParaCalculo,
                p_is_plantao: isPlantao,
              });
              
              if (error) {
                console.error('❌ Erro na RPC calcular_preco_exame:', error);
                precoPorCombo[key] = 0;
              } else {
                const precoNum = Number(preco);
                console.log(`💰 Preço calculado para ${key}: R$ ${precoNum}`);
                
                if (Number.isFinite(precoNum) && precoNum > 0) {
                  precoPorCombo[key] = precoNum;
                } else {
                  console.warn(`⚠️ Preço inválido retornado: ${preco} (${typeof preco})`);
                  precoPorCombo[key] = 0;
                }
              }
            } catch (e) {
              console.error('❌ Falha ao calcular preço para combo', key, e?.message || e);
              precoPorCombo[key] = 0;
            }
          })
        );
      }
    }
    
    // Se não há dados, não gerar PDF
    if (finalData.length === 0) {
      console.log('❌ DADOS NÃO ENCONTRADOS - Cliente precisa de verificação no cadastro');
      console.log(`🔍 Tentando buscar por nome fantasia: ${cliente.nome_fantasia || cliente.nome}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: "Nenhum dado encontrado para o cliente no período",
        cliente: cliente.nome,
        periodo: periodo,
        totalRegistros: 0,
        dadosEncontrados: false,
        dados: [],
        arquivos: [],
        resumo: {
          total_laudos: 0,
          valor_bruto_total: 0,
          valor_a_pagar: 0,
          total_impostos: 0
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Total de dados únicos encontrados:', finalData.length);

    // Calcular resumo usando dados de faturamento ou volumetria
    const isFaturamentoData = finalData.length > 0 && finalData[0].hasOwnProperty('valor');
    console.log('🔍 ANÁLISE DOS DADOS FINAIS:');
    console.log('Total de registros finalData:', finalData.length);
    console.log('É dados de faturamento?', isFaturamentoData);
    if (finalData.length > 0) {
      console.log('Primeiros 3 registros (resumo):', JSON.stringify(finalData.slice(0, 3).map(item => ({
        // Mostrar campos principais apenas para debug mais limpo
        tipo: isFaturamentoData ? 'faturamento' : 'volumetria',
        paciente: isFaturamentoData ? item.paciente : item.NOME_PACIENTE,
        exame: isFaturamentoData ? item.nome_exame : item.ESTUDO_DESCRICAO,
        valor: isFaturamentoData ? item.valor : item.VALORES,
        quantidade: isFaturamentoData ? item.quantidade : 1
      })), null, 2));
      console.log('Total de registros únicos por paciente:', new Set(finalData.map(item => 
        isFaturamentoData ? item.paciente : item.NOME_PACIENTE
      )).size);
    }
    
    let valorBrutoTotal: number, totalLaudos: number;
    let valorFranquia = 0;
    let valorPortal = 0;
    let valorIntegracao = 0;
    let totalImpostos = 0;
    let valorAPagar = 0;
    
    // Percentuais fixos para exibição dos tributos
    const percentualPIS = 0.65; // 0.65%
    const percentualCOFINS = 3.0; // 3%
    const percentualCSLL = 1.0; // 1.0%
    const percentualIRRF = 1.5; // 1.5%

    let valorPIS = 0, valorCOFINS = 0, valorCSLL = 0, valorIRRF = 0;
    
    if (demonstrativoData) {
      // Usar exatamente os valores do demonstrativo unificado
      totalLaudos = Number(demonstrativoData.total_exames || 0);
      valorBrutoTotal = Number(demonstrativoData.valor_bruto ?? demonstrativoData.valor_exames ?? 0);
      valorFranquia = Number(demonstrativoData.valor_franquia || 0);
      valorPortal = Number(demonstrativoData.valor_portal_laudos || 0);
      valorIntegracao = Number(demonstrativoData.valor_integracao || 0);
      totalImpostos = Number(demonstrativoData.valor_impostos || 0);
      valorAPagar = Number(demonstrativoData.valor_total || (valorBrutoTotal - totalImpostos));
    } else {
      // Calcular resumo usando dados de faturamento ou volumetria
      const isFaturamentoDataLocal = finalData.length > 0 && finalData[0].hasOwnProperty('valor');
      if (isFaturamentoDataLocal) {
        // Dados de faturamento - usar campos corretos
        valorBrutoTotal = finalData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
        totalLaudos = finalData.reduce((sum, item) => sum + (parseInt(item.quantidade) || 0), 0);
      } else {
        // Dados de volumetria - usar VALORES como quantidade
        valorBrutoTotal = (finalData as any[]).reduce((sum, item) => {
          const key = `${(item.MODALIDADE || '')}|${(item.ESPECIALIDADE || '')}|${(item.CATEGORIA || 'SC')}|${(item.PRIORIDADE || '')}`;
          const unit = precoPorCombo[key] ?? 0;
          const qtd = Number(item.VALORES || 0) || 0;
          return sum + unit * qtd;
        }, 0);
        totalLaudos = finalData.reduce((sum, item) => sum + (parseInt(item.VALORES) || 0), 0);
      }
      // Impostos padrão (calculados para exibição)
      valorPIS = parseFloat((valorBrutoTotal * (percentualPIS / 100)).toFixed(2));
      valorCOFINS = parseFloat((valorBrutoTotal * (percentualCOFINS / 100)).toFixed(2));
      valorCSLL = parseFloat((valorBrutoTotal * (percentualCSLL / 100)).toFixed(2));
      valorIRRF = parseFloat((valorBrutoTotal * (percentualIRRF / 100)).toFixed(2));
      totalImpostos = valorPIS + valorCOFINS + valorCSLL + valorIRRF;
      valorAPagar = valorBrutoTotal - totalImpostos;
    }

    // Mesmo quando vem do demonstrativo, calcular valores individuais para exibição
    if (demonstrativoData) {
      valorPIS = parseFloat((valorBrutoTotal * (percentualPIS / 100)).toFixed(2));
      valorCOFINS = parseFloat((valorBrutoTotal * (percentualCOFINS / 100)).toFixed(2));
      valorCSLL = parseFloat((valorBrutoTotal * (percentualCSLL / 100)).toFixed(2));
      valorIRRF = parseFloat((valorBrutoTotal * (percentualIRRF / 100)).toFixed(2));
    }

    // Gerar PDF apenas se houver dados
    let pdfUrl = null;
    try {
      console.log('Gerando relatório PDF...');
      
      // Criar novo documento PDF em formato paisagem
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Configurar fonte
      doc.setFont('helvetica');
      
      // === LOGOMARCA ===
      try {
        // Tentar carregar diferentes extensões de logomarca
        const extensions = ['png', 'jpg', 'jpeg'];
        let logoAdded = false;

        for (const ext of extensions) {
          const fileName = `logomarca.${ext}`;
          const { data: logoData, error: logoError } = await supabase.storage
            .from('logomarcas')
            .download(fileName);

          if (!logoError && logoData) {
            // Converter blob para array buffer e depois para base64
            const arrayBuffer = await logoData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Converter para base64
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64String = btoa(binary);
            const imageFormat = ext.toUpperCase() === 'JPG' ? 'JPEG' : ext.toUpperCase();
            
            // Adicionar imagem ao PDF com dimensões adequadas e posição mais alta
            doc.addImage(`data:image/${ext};base64,${base64String}`, imageFormat, 130, 5, 40, 25);
            logoAdded = true;
            console.log(`Logomarca ${fileName} carregada com sucesso no PDF`);
            break;
          }
        }

        if (!logoAdded) {
          // Se não encontrou logomarca, mostrar placeholder
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.rect(130, 5, 40, 25);
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text('LOGOMARCA', 150, 19, { align: 'center' });
          console.log('Nenhuma logomarca encontrada, usando placeholder');
        }
      } catch (logoError) {
        console.error('Erro ao carregar logomarca:', logoError);
        // Mostrar placeholder em caso de erro
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(130, 5, 40, 25);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('LOGOMARCA', 150, 19, { align: 'center' });
      }
      
      // === CABEÇALHO ===
      doc.setFontSize(22);
      doc.setTextColor(0, 124, 186); // #007cba
      doc.text('RELATÓRIO DE FATURAMENTO', 148, 35, { align: 'center' });
      
      // Informações do cliente
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text(`Cliente: ${cliente.nome}`, 20, 50);
      if (cliente.cnpj) {
        doc.setFontSize(16); // Mesma fonte do campo Cliente
        doc.setTextColor(0, 0, 0); // Mesma cor do campo Cliente
        doc.text(`CNPJ: ${formatarCNPJ(cliente.cnpj)}`, 20, 60);
      }
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Período: ${periodo}`, 20, cliente.cnpj ? 70 : 60);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 220, 50);
      
      // Linha separadora
      doc.setDrawColor(0, 124, 186);
      doc.setLineWidth(1);
      doc.line(20, cliente.cnpj ? 75 : 65, 277, cliente.cnpj ? 75 : 65);
      
      // === QUADRO 1 - RESUMO DO CLIENTE ===
      const yQuadro1 = cliente.cnpj ? 85 : 75;
      doc.setFontSize(16);
      doc.setTextColor(0, 124, 186);
      doc.text('QUADRO 1 - RESUMO', 20, yQuadro1);
      
      // Caixa do resumo (mais alta para acomodar melhor os textos)
      doc.setDrawColor(0, 124, 186);
      doc.setLineWidth(0.5);
      doc.rect(20, yQuadro1 + 5, 257, 80);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Layout em linhas conforme solicitado
      let yLine = yQuadro1 + 15;
      doc.text(`Total de Laudos: ${totalLaudos.toLocaleString('pt-BR')}`, 25, yLine);
      
      yLine += 8;
      doc.text(`Valor Bruto: R$ ${valorBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yLine);
      
      yLine += 8;
      doc.text(`Franquia: R$ ${valorFranquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yLine);
      
      yLine += 8;
      doc.text(`Portal de Laudos: R$ ${valorPortal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yLine);
      
      yLine += 8;
      doc.text(`Integração: R$ ${valorIntegracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yLine);
      
      // Impostos na coluna da direita
      yLine = yQuadro1 + 15;
      doc.text(`PIS (${percentualPIS}%): R$ ${valorPIS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, yLine);
      
      yLine += 8;
      doc.text(`COFINS (${percentualCOFINS}%): R$ ${valorCOFINS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, yLine);
      
      yLine += 8;
      doc.text(`CSLL (${percentualCSLL}%): R$ ${valorCSLL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, yLine);
      
      yLine += 8;
      doc.text(`IRRF (${percentualIRRF}%): R$ ${valorIRRF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, yLine);
      
      // Linha separadora antes do Valor a Pagar (movida para baixo)
      doc.setDrawColor(0, 124, 186);
      doc.setLineWidth(1);
      doc.line(25, yQuadro1 + 50, 270, yQuadro1 + 50);
      
      // Valor a Pagar destacado (movido para baixo para não sobrepor)
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0); // Cor preta em vez de verde
      doc.text(`VALOR A PAGAR: R$ ${valorAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 148, yQuadro1 + 62, { align: 'center' });
      
      // === NOVA PÁGINA PARA QUADRO 2 ===
      doc.addPage('landscape');
      
      // === QUADRO 2 - DETALHAMENTO ===
      let yPosition = 30; // Começa do topo da nova página
      doc.setFontSize(16);
      doc.setTextColor(0, 124, 186);
      doc.text('QUADRO 2 - DETALHAMENTO', 20, yPosition);
      
      yPosition += 10;
      
      if (finalData.length > 0) {
        // Cabeçalho da tabela detalhada (mais larga para paisagem)
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(0, 124, 186);
        doc.rect(10, yPosition, 267, 8, 'F');
        
        if (isFaturamentoData) {
          // Headers para dados de faturamento - incluindo novos campos
          doc.text('Data', 15, yPosition + 5);
          doc.text('Paciente', 35, yPosition + 5);
          doc.text('Médico', 65, yPosition + 5);
          doc.text('Exame', 95, yPosition + 5);
          doc.text('Modal.', 125, yPosition + 5);
          doc.text('Espec.', 140, yPosition + 5);
          doc.text('Categ.', 160, yPosition + 5);
          doc.text('Prior.', 180, yPosition + 5);
          doc.text('Accession', 200, yPosition + 5);
          doc.text('Origem', 220, yPosition + 5);
          doc.text('Qtd', 245, yPosition + 5);
          doc.text('Valor', 260, yPosition + 5);
        } else {
          // Headers para dados de volumetria - incluindo novos campos
          doc.text('Data', 15, yPosition + 5);
          doc.text('Paciente', 35, yPosition + 5);
          doc.text('Médico', 65, yPosition + 5);
          doc.text('Exame', 95, yPosition + 5);
          doc.text('Modal.', 125, yPosition + 5);
          doc.text('Espec.', 140, yPosition + 5);
          doc.text('Categ.', 160, yPosition + 5);
          doc.text('Prior.', 180, yPosition + 5);
          doc.text('Accession', 200, yPosition + 5);
          doc.text('Origem', 220, yPosition + 5);
          doc.text('Qtd', 245, yPosition + 5);
          doc.text('Valor Total', 260, yPosition + 5);
        }
        
        yPosition += 12;
        doc.setTextColor(0, 0, 0);
        
        // Dados da tabela detalhada
        for (let i = 0; i < finalData.length; i++) {
          const item = finalData[i];
          
          if (yPosition > 190) { // Nova página se necessário (formato paisagem tem menos altura)
            doc.addPage('landscape');
            yPosition = 30;
            
            // Repetir cabeçalho na nova página
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(0, 124, 186);
            doc.rect(10, yPosition, 267, 8, 'F');
            
            if (isFaturamentoData) {
              // Headers para dados de faturamento
              doc.text('Data', 22, yPosition + 5);
              doc.text('Paciente', 40, yPosition + 5);
              doc.text('Médico', 80, yPosition + 5);
              doc.text('Exame', 120, yPosition + 5);
              doc.text('Modal.', 160, yPosition + 5);
              doc.text('Espec.', 180, yPosition + 5);
              doc.text('Categ.', 205, yPosition + 5);
              doc.text('Prior.', 230, yPosition + 5);
              doc.text('Qtd', 250, yPosition + 5);
              doc.text('Valor Total', 260, yPosition + 5);
            } else {
              // Headers para dados de volumetria
              doc.text('Data', 22, yPosition + 5);
              doc.text('Paciente', 40, yPosition + 5);
              doc.text('Médico', 80, yPosition + 5);
              doc.text('Exame', 120, yPosition + 5);
              doc.text('Modal.', 160, yPosition + 5);
              doc.text('Espec.', 180, yPosition + 5);
              doc.text('Categ.', 205, yPosition + 5);
              doc.text('Prior.', 230, yPosition + 5);
              doc.text('Qtd', 250, yPosition + 5);
              doc.text('Valor Total', 260, yPosition + 5);
            }
            
            yPosition += 12;
            doc.setTextColor(0, 0, 0);
          }
          
          // Alternar cores das linhas
          if (i % 2 === 1) {
            doc.setFillColor(240, 240, 240);
            doc.rect(10, yPosition - 2, 267, 6, 'F');
          }
          
          doc.setFontSize(7);
          
          if (isFaturamentoData) {
            // Dados de faturamento - usar campos corretos incluindo novos campos
            const dataFormatada = item.data_exame ? 
              item.data_exame.split('T')[0].split('-').reverse().join('/') : '-';
            doc.text(dataFormatada, 15, yPosition + 2);
            doc.text((item.paciente || '-').substring(0, 15), 35, yPosition + 2);
            doc.text((item.medico || '-').substring(0, 15), 65, yPosition + 2);
            doc.text((item.nome_exame || '-').substring(0, 15), 95, yPosition + 2);
            doc.text((item.modalidade || '-').substring(0, 8), 125, yPosition + 2);
            doc.text((item.especialidade || '-').substring(0, 10), 140, yPosition + 2);
            doc.text((item.categoria || '-').substring(0, 8), 160, yPosition + 2);
            doc.text((item.prioridade || '-').substring(0, 10), 180, yPosition + 2);
            doc.text((item.accession_number || '-').substring(0, 10), 200, yPosition + 2);
            doc.text((item.cliente_nome_original || '-').substring(0, 12), 220, yPosition + 2);
            doc.text((item.quantidade || '0').toString(), 245, yPosition + 2);
            doc.text(`R$ ${parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 260, yPosition + 2);
          } else {
            // Dados de volumetria - usar campos da volumetria incluindo novos campos
            const dataFormatada = item.DATA_REALIZACAO ? 
              item.DATA_REALIZACAO.split('T')[0].split('-').reverse().join('/') : '-';
            doc.text(dataFormatada, 15, yPosition + 2);
            doc.text((item.NOME_PACIENTE || '-').substring(0, 15), 35, yPosition + 2);
            doc.text((item.MEDICO || '-').substring(0, 15), 65, yPosition + 2);
            doc.text((item.ESTUDO_DESCRICAO || '-').substring(0, 15), 95, yPosition + 2);
            doc.text((item.MODALIDADE || '-').substring(0, 8), 125, yPosition + 2);
            doc.text((item.ESPECIALIDADE || '-').substring(0, 10), 140, yPosition + 2);
            doc.text((item.CATEGORIA || '-').substring(0, 8), 160, yPosition + 2);
            doc.text((item.PRIORIDADE || '-').substring(0, 10), 180, yPosition + 2);
            doc.text((item.ACCESSION_NUMBER || '-').substring(0, 10), 200, yPosition + 2);
            doc.text((item.EMPRESA || '-').substring(0, 12), 220, yPosition + 2);
            doc.text((item.VALORES || '0').toString(), 245, yPosition + 2);
            // Calcular valor para volumetria usando o preço obtido via RPC
            const key = `${(item.MODALIDADE || '')}|${(item.ESPECIALIDADE || '')}|${(item.CATEGORIA || 'SC')}|${(item.PRIORIDADE || '')}`;
            const precoUnitario = precoPorCombo[key] ?? 0;
            const qtd = Number(item.VALORES || 0) || 0;
            const valorTotal = precoUnitario * qtd;
            
            doc.text(`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 260, yPosition + 2);
          }
          
          yPosition += 6;
        }
      } else {
        // Mensagem de nenhum dado encontrado
        doc.setFontSize(14);
        doc.setTextColor(128, 128, 128);
        doc.text('Nenhum dado encontrado para o período selecionado', 148, yPosition + 30, { align: 'center' });
      }
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 148, 200, { align: 'center' });
        doc.text(`Página ${i} de ${pageCount}`, 270, 200, { align: 'right' });
      }
      
      // Converter PDF para buffer
      const pdfBuffer = doc.output('arraybuffer');
      
      // Salvar PDF no storage
      const fileName = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.pdf`;

      // Garantir que o bucket exista e seja público
      try {
        const bucketName = 'relatorios-faturamento';
        const { data: existingBucket } = await supabase.storage.getBucket(bucketName);
        if (!existingBucket) {
          await supabase.storage.createBucket(bucketName, { public: true });
          console.log(`Bucket ${bucketName} criado`);
        }
      } catch (bErr) {
        console.log('Aviso: não foi possível verificar/criar bucket:', bErr?.message || bErr);
      }

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
      totalRegistros: finalData.length,
      dadosEncontrados: finalData.length > 0,
      dados: finalData,
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
  }; // Fim da função processRequest

  // Executar com timeout
  try {
    return await Promise.race([processRequest(), timeoutPromise]);
  } catch (error) {
    console.error('Erro com timeout:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Timeout ou erro interno',
      timeout: error.message.includes('Timeout')
    }), {
      status: error.message.includes('Timeout') ? 408 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
