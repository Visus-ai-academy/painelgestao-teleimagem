import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ClienteFaturamento {
  id: string;
  nome: string;
  email: string;
  total_exames: number;
  valor_bruto: number;
  valor_liquido: number;
  periodo: string;
  status_pagamento: 'pendente' | 'pago' | 'vencido';
  data_vencimento: string;
  observacoes?: string;
  detalhes_exames?: Array<{
    modalidade: string;
    especialidade: string;
    categoria: string;
    prioridade: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    status: string;
  }>;
}

// Função auxiliar para formatar período YYYY-MM para formato abreviado
const formatarPeriodoAbreviado = (periodo: string): string => {
  try {
    const [ano, mes] = periodo.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesAbrev = meses[parseInt(mes) - 1] || mes;
    return `${mesAbrev}/${ano.slice(2)}`;
  } catch {
    return periodo;
  }
};

export default function DemonstrativoFaturamento() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteFaturamento[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteFaturamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [periodo, setPeriodo] = useState("2025-06"); // Período com dados carregados
  const [ordemAlfabetica, setOrdemAlfabetica] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Carregar dados de faturamento
  const carregarDados = async () => {
    setCarregando(true);
    try {
      console.log('🔍 Carregando demonstrativo de faturamento para período:', periodo);
      
      // ✅ CARREGAR SOMENTE de demonstrativos_completos (unificação)
      const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodo}`);
      if (demonstrativosCompletos) {
        try {
          const dados = JSON.parse(demonstrativosCompletos);
          console.log('📋 Dados encontrados no localStorage:', dados);
          
          // Verificar se temos demonstrativos válidos
          if (dados.demonstrativos && Array.isArray(dados.demonstrativos) && dados.demonstrativos.length > 0) {
            console.log('📋 Demonstrativos completos encontrados no localStorage:', dados.demonstrativos.length);
            
            // Converter formato dos demonstrativos completos para o formato esperado
            const clientesConvertidos: ClienteFaturamento[] = dados.demonstrativos
              .filter((demo: any) => demo && (demo.cliente_nome || demo.nome_cliente)) // aceitar ambos
              .map((demo: any) => {
                const nomeCliente = demo.cliente_nome || demo.nome_cliente || 'Cliente sem nome';
                const emailCliente = demo.cliente_email || demo.email_cliente || 
                  `${nomeCliente.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`;
                
                return {
                  id: demo.cliente_id || `temp-${nomeCliente}`,
                  nome: nomeCliente,
                  email: emailCliente,
                  total_exames: demo.total_exames || 0,
                  valor_bruto: Number(demo.valor_bruto ?? demo.valor_exames ?? 0),
                  valor_liquido: Number(demo.valor_total ?? demo.valor_liquido ?? 0),
                  periodo: periodo,
                  status_pagamento: 'pendente' as const,
                  data_vencimento: new Date().toISOString().split('T')[0],
                  observacoes: `Exames: ${demo.total_exames || 0} | Franquia: R$ ${(demo.valor_franquia || 0).toFixed(2)} | Portal: R$ ${(demo.valor_portal_laudos || 0).toFixed(2)} | Integração: R$ ${(demo.valor_integracao || 0).toFixed(2)} | Impostos: R$ ${(demo.valor_impostos || 0).toFixed(2)}`,
                  detalhes_exames: demo.detalhes_exames || [] // ✅ INCLUIR DETALHES DOS EXAMES
                };
              });
            
            if (clientesConvertidos.length > 0) {
              setClientes(clientesConvertidos);
              setClientesFiltrados(clientesConvertidos);
              setCarregando(false);
              
              toast({
                title: "Demonstrativos carregados",
                description: `${clientesConvertidos.length} demonstrativos completos encontrados para ${periodo}`,
                variant: "default",
              });
              
              return;
            }
          }
        } catch (error) {
          console.error('Erro ao processar demonstrativos do localStorage:', error);
        }
      }
      
      // Primeiro, verificar se há dados na tabela de faturamento
      const { data: todosFaturamento, error: erroTotal } = await supabase
        .from('faturamento')
        .select('periodo_referencia', { count: 'exact' });

      console.log('📊 Total de registros na tabela faturamento:', todosFaturamento?.length || 0);
      
      if (todosFaturamento && todosFaturamento.length > 0) {
        const periodosDisponiveis = [...new Set(todosFaturamento.map(f => f.periodo_referencia))];
        console.log('📅 Períodos disponíveis:', periodosDisponiveis);
      }
      
      // Converter período selecionado (YYYY-MM) para formato mon/YY (ex.: jun/25)
      const formatPeriodo = (yyyyMM: string) => {
        const [y, m] = yyyyMM.split('-');
        const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const mon = meses[Math.max(0, Math.min(11, Number(m) - 1))];
        return `${mon}/${y.slice(2)}`;
      };
      const periodoRef = formatPeriodo(periodo);
      
      console.log('🔍 Buscando dados para período de referência:', periodoRef);
      console.log('💡 Período original selecionado:', periodo);
      
      // BUSCAR TODOS os clientes únicos da volumetria do período usando EMPRESA  
      const { data: clientesVolumetria, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodo) // Usar formato YYYY-MM direto
        .not('"EMPRESA"', 'is', null)
        .limit(50000); // Aumentar limite explicitamente
      
      console.log('📊 Clientes encontrados na volumetria (formato YYYY-MM):', clientesVolumetria?.length || 0);
      
      if (clientesVolumetria && clientesVolumetria.length > 0) {
        const clientesUnicos = [...new Set(clientesVolumetria.map(c => c.EMPRESA))];
        console.log('👥 Clientes únicos na volumetria:', clientesUnicos.length, clientesUnicos.slice(0, 5));
      }
      
      // Buscar dados de faturamento do período - TODOS OS DADOS PRIMEIRO
      console.log('🔍 Iniciando busca na tabela faturamento...');
      console.log('🔍 Período de busca:', periodo);
      
      const { data: dadosFaturamento, error } = await supabase
        .from('faturamento')
        .select(`
          cliente_id,
          cliente_nome,
          cliente_email,
          valor,
          valor_bruto,
          quantidade,
          data_emissao,
          data_vencimento,
          periodo_referencia,
          tipo_faturamento
        `)
        .eq('periodo_referencia', periodo) // Usar formato YYYY-MM direto
        .not('periodo_referencia', 'is', null) // Excluir registros sem período
        .not('cliente_nome', 'is', null) // Garantir que cliente_nome não seja nulo
        .order('cliente_nome')
        .limit(50000); // Aumentar limite explicitamente para garantir todos os dados

      console.log('📊 Dados de faturamento encontrados:', dadosFaturamento?.length || 0);
      console.log('🔍 Período usado na busca (direto YYYY-MM):', periodo);
      console.log('🔍 Amostra dos primeiros registros:', dadosFaturamento?.slice(0, 3).map(d => ({
        cliente: d.cliente_nome,
        valor: d.valor_bruto,
        quantidade: d.quantidade
      })));
      
      if (dadosFaturamento && dadosFaturamento.length > 0) {
        const clientesUnicos = [...new Set(dadosFaturamento.map(d => d.cliente_nome))];
        console.log('👥 Clientes únicos encontrados:', clientesUnicos.length, clientesUnicos);
        console.log('📋 Lista completa de clientes únicos:', clientesUnicos);
        
        // Log detalhado de cada cliente
        clientesUnicos.forEach(clienteNome => {
          const registrosCliente = dadosFaturamento.filter(d => d.cliente_nome === clienteNome);
          const totalExames = registrosCliente.reduce((sum, r) => sum + (r.quantidade || 1), 0);
          const totalValor = registrosCliente.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0);
          console.log(`📊 ${clienteNome}: ${registrosCliente.length} registros, ${totalExames} exames, R$ ${totalValor.toFixed(2)}`);
        });
      } else {
        console.warn('⚠️ Nenhum dado de faturamento retornado pela consulta');
        console.log('🔍 Detalhes do erro:', error);
      }

      if (error) {
        console.error('❌ Erro ao carregar faturamento:', error);
        throw error;
      }

        if (!dadosFaturamento || dadosFaturamento.length === 0) {
          console.warn(`⚠️ Nenhum dado de faturamento encontrado para o período ${periodo}`);
          console.log('💡 Buscando dados da volumetria para criar demonstrativo...');
          
          // Se não há dados de faturamento, usar dados da volumetria para criar demonstrativo
          const { data: dadosVolumetria, error: errorVolumetria } = await supabase
            .from('volumetria_mobilemed')
            .select(`
              "EMPRESA",
              "Cliente_Nome_Fantasia",
              "VALORES",
              "DATA_REALIZACAO",
              "MODALIDADE",
              "ESPECIALIDADE",
              "CATEGORIA",
              "PRIORIDADE",
              "ESTUDO_DESCRICAO",
              "NOME_PACIENTE"
            `)
            .eq('periodo_referencia', periodo)
            .not('Cliente_Nome_Fantasia', 'is', null)
            .not('VALORES', 'is', null)
            .limit(50000); // Aumentar limite explicitamente
            
          if (errorVolumetria) {
            console.error('❌ Erro ao carregar volumetria:', errorVolumetria);
            throw errorVolumetria;
          }
            
          if (dadosVolumetria && dadosVolumetria.length > 0) {
            console.log('📊 Dados de volumetria encontrados:', dadosVolumetria.length);
            
            // Processar dados da volumetria para criar demonstrativo usando NOME FANTASIA e cálculo correto
            const clientesMap = new Map<string, ClienteFaturamento>();
            
            // Buscar clientes cadastrados com contratos que precisam de demonstrativo
            const { data: clientesCadastrados } = await supabase
              .from('clientes')
              .select(`
                id, 
                nome, 
                nome_fantasia, 
                nome_mobilemed, 
                email,
                contratos_clientes!inner (
                  tipo_faturamento
                )
              `)
              .eq('ativo', true)
              .in('contratos_clientes.tipo_faturamento', ['CO-FT', 'NC-FT']); // FILTRAR APENAS CLIENTES QUE PRECISAM DE DEMONSTRATIVO
            
            console.log('🏢 Clientes encontrados com tipo de faturamento CO-FT/NC-FT:', clientesCadastrados?.length || 0);
            
            // Criar mapa de clientes por nome fantasia
            const clientesMapPorNome = new Map();
            clientesCadastrados?.forEach(cliente => {
              if (cliente.nome_fantasia) clientesMapPorNome.set(cliente.nome_fantasia, cliente);
              if (cliente.nome) clientesMapPorNome.set(cliente.nome, cliente);
              if (cliente.nome_mobilemed) clientesMapPorNome.set(cliente.nome_mobilemed, cliente);
            });
            
            console.log('🔍 Processando volumetria com NOME FANTASIA e cálculo de preços...');
            
            // OTIMIZAÇÃO: Agrupar dados primeiro para evitar múltiplas chamadas RPC
            const dadosAgrupados = new Map<string, {
              cliente: any,
              total_exames: number,
              combinacoes: Map<string, { quantidade: number, config: any }>
            }>();
            
            // Primeira passada: agrupar por cliente
            dadosVolumetria.forEach(item => {
              const clienteNome = item.Cliente_Nome_Fantasia || item.EMPRESA;
              const clienteCadastrado = clientesMapPorNome.get(clienteNome);
              const quantidade = Number(item.VALORES || 1);
              
              if (!dadosAgrupados.has(clienteNome)) {
                dadosAgrupados.set(clienteNome, {
                  cliente: clienteCadastrado,
                  total_exames: 0,
                  combinacoes: new Map()
                });
              }
              
              const clienteData = dadosAgrupados.get(clienteNome)!;
              clienteData.total_exames += quantidade;
              
              // Agrupar por combinação de modalidade/especialidade/categoria/prioridade
              const chave = `${item.MODALIDADE || ''}-${item.ESPECIALIDADE || ''}-${item.CATEGORIA || 'SC'}-${item.PRIORIDADE || ''}`;
              
              if (clienteData.combinacoes.has(chave)) {
                clienteData.combinacoes.get(chave)!.quantidade += quantidade;
              } else {
                clienteData.combinacoes.set(chave, {
                  quantidade: quantidade,
                  config: {
                    modalidade: item.MODALIDADE || '',
                    especialidade: item.ESPECIALIDADE || '',
                    categoria: item.CATEGORIA || 'SC',
                    prioridade: item.PRIORIDADE || '',
                    is_plantao: (item.PRIORIDADE || '').toUpperCase().includes('PLANT')
                  }
                });
              }
            });
            
            console.log(`📊 Processamento otimizado: ${dadosAgrupados.size} clientes únicos`);
            
            // Segunda passada: calcular preços por cliente (muito menos chamadas RPC)
            for (const [clienteNome, dadosCliente] of dadosAgrupados) {
              if (!dadosCliente.cliente?.id) {
                console.warn(`Cliente ${clienteNome} não encontrado no cadastro - pulando`);
                continue;
              }
              
              let valorTotalCliente = 0;
              let temPrecoConfigurado = false;
              
              // Processar cada combinação única do cliente
              for (const [chave, combinacao] of dadosCliente.combinacoes) {
                try {
                  const { data: precoCalculado } = await supabase.rpc('calcular_preco_exame', {
                    p_cliente_id: dadosCliente.cliente.id,
                    p_modalidade: combinacao.config.modalidade,
                    p_especialidade: combinacao.config.especialidade,
                    p_prioridade: combinacao.config.prioridade,
                    p_categoria: combinacao.config.categoria,
                    p_volume_total: dadosCliente.total_exames,
                    p_is_plantao: combinacao.config.is_plantao
                  });
                  
                  if (precoCalculado && precoCalculado > 0) {
                    const valorCombinacao = Number(precoCalculado) * combinacao.quantidade;
                    valorTotalCliente += valorCombinacao;
                    temPrecoConfigurado = true;
                    
                    console.log(`💰 ${clienteNome} - ${chave}: ${combinacao.quantidade} exames x R$ ${precoCalculado} = R$ ${valorCombinacao.toFixed(2)}`);
                  }
                } catch (error) {
                  console.log(`Erro ao calcular preço para ${clienteNome} (${chave}):`, error);
                }
              }
              
              // Só incluir cliente se tem preço configurado
              if (temPrecoConfigurado && valorTotalCliente > 0) {
                clientesMap.set(clienteNome, {
                  id: dadosCliente.cliente.id,
                  nome: clienteNome,
                  email: dadosCliente.cliente.email || '',
                  total_exames: dadosCliente.total_exames,
                  valor_bruto: Number(valorTotalCliente.toFixed(2)),
                  valor_liquido: Number(valorTotalCliente.toFixed(2)),
                  periodo: periodo,
                  status_pagamento: 'pendente' as const,
                  data_vencimento: new Date().toISOString().split('T')[0],
                  observacoes: `Dados baseados na volumetria com preços calculados`
                });
              } else {
                console.warn(`Cliente ${clienteNome} sem preço configurado - pulando`);
              }
            }

            const clientesArray = Array.from(clientesMap.values());
            console.log('📊 Clientes processados da volumetria:', clientesArray.length);
            console.log('📋 Primeiros 5 clientes:', clientesArray.slice(0, 5).map(c => ({ nome: c.nome, exames: c.total_exames, valor: c.valor_bruto })));
            
            setClientes(clientesArray);
            setClientesFiltrados(clientesArray);
            
            toast({
              title: "Demonstrativo carregado da volumetria",
              description: `${clientesArray.length} clientes carregados diretamente dos dados de volumetria para ${periodo}.`,
              variant: "default",
            });
            
            return;
          } else {
            console.log('💡 Não há dados de volumetria nem faturamento para este período');
            toast({
              title: "Dados não encontrados", 
              description: `Nenhum dado encontrado para ${periodo}. Verifique se há dados de volumetria carregados para este período.`,
              variant: "destructive",
            });
          }
          
          setClientes([]);
          setClientesFiltrados([]);
          return;
        }

      console.log(`Dados encontrados: ${dadosFaturamento.length} registros para o período ${periodo}`);

      // Buscar contratos dos clientes para filtrar por tipo de faturamento
      const clientesNomes = [...new Set(dadosFaturamento.map(d => d.cliente_nome))];
      console.log('🏢 Buscando contratos para clientes:', clientesNomes);
      
      const { data: clientesComContratos, error: errorContratos } = await supabase
        .from('clientes')
        .select(`
          id,
          nome,
          nome_fantasia,
          nome_mobilemed,
          email,
          contratos_clientes!inner (
            tipo_faturamento
          )
        `)
        .eq('ativo', true)
        .in('contratos_clientes.tipo_faturamento', ['CO-FT', 'NC-FT']);
      
      if (errorContratos) {
        console.error('❌ Erro ao buscar contratos:', errorContratos);
      }
      
      // Criar mapa de clientes que precisam de demonstrativo
      const clientesQueNecessitamDemonstrativo = new Set();
      clientesComContratos?.forEach(cliente => {
        if (cliente.nome_fantasia) clientesQueNecessitamDemonstrativo.add(cliente.nome_fantasia);
        if (cliente.nome) clientesQueNecessitamDemonstrativo.add(cliente.nome);
        if (cliente.nome_mobilemed) clientesQueNecessitamDemonstrativo.add(cliente.nome_mobilemed);
      });
      
      console.log('📋 Clientes que precisam de demonstrativo:', Array.from(clientesQueNecessitamDemonstrativo));
      
      // Filtrar dados de faturamento apenas para clientes que precisam de demonstrativo
      const dadosFaturamentoFiltrados = dadosFaturamento.filter(item => 
        clientesQueNecessitamDemonstrativo.has(item.cliente_nome)
      );
      
      console.log(`🔍 Dados filtrados: ${dadosFaturamentoFiltrados.length} registros (eram ${dadosFaturamento.length})`);
      console.log('👥 Clientes filtrados únicos:', [...new Set(dadosFaturamentoFiltrados.map(d => d.cliente_nome))]);

      // Agrupar por cliente - CORRIGIDO para usar dados filtrados
      const clientesMap = new Map<string, ClienteFaturamento>();
      
      console.log('🔄 Processando', dadosFaturamentoFiltrados?.length || 0, 'registros de faturamento filtrados...');
      
      dadosFaturamentoFiltrados?.forEach((item, index) => {
        const clienteNome = item.cliente_nome;
        
        if (index < 5) { // Log dos primeiros 5 registros para debug
          console.log(`📋 Registro ${index + 1}:`, {
            cliente: clienteNome,
            valor_bruto: item.valor_bruto,
            quantidade: item.quantidade
          });
        }
        
        if (clientesMap.has(clienteNome)) {
          const cliente = clientesMap.get(clienteNome)!;
          // Somar QUANTIDADE real dos exames (não o número de registros)
          cliente.total_exames += item.quantidade || 1; 
          cliente.valor_bruto += Number(item.valor_bruto || 0);
          cliente.valor_liquido += Number(item.valor || 0);
        } else {
          console.log(`🆕 Novo cliente encontrado: ${clienteNome}`);
          
          // Determinar status de pagamento baseado na data de vencimento
          const dataVencimento = new Date(item.data_vencimento);
          const hoje = new Date();
          let status: 'pendente' | 'pago' | 'vencido' = 'pendente';
          
          if (dataVencimento < hoje) {
            status = 'vencido';
          }
          
          clientesMap.set(clienteNome, {
            id: clienteNome,
            nome: item.cliente_nome || 'Cliente não identificado',
            email: item.cliente_email || '',
            total_exames: item.quantidade || 1, // Usar quantidade real do faturamento
            valor_bruto: Number(item.valor_bruto || 0),
            valor_liquido: Number(item.valor || 0),
            periodo: item.periodo_referencia || periodo,
            status_pagamento: status,
            data_vencimento: item.data_vencimento,
          });
        }
      });

      const clientesArray = Array.from(clientesMap.values());
      console.log('📊 Clientes processados finais:', clientesArray.length);
      console.log('📋 Nomes dos clientes processados:', clientesArray.map(c => c.nome));
      
      setClientes(clientesArray);
      setClientesFiltrados(clientesArray);

      // Calcular totais para o log
      const totaisCalculados = clientesArray.reduce((acc, cliente) => ({
        exames: acc.exames + cliente.total_exames,
        valorBruto: acc.valorBruto + cliente.valor_bruto,
      }), { exames: 0, valorBruto: 0 });

      console.log(`Demonstrativo atualizado: ${clientesArray.length} clientes, ${totaisCalculados.exames} exames, R$ ${totaisCalculados.valorBruto.toFixed(2)} valor bruto`);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };

  // Aplicar filtros e ordenação
  useEffect(() => {
    let filtrados = [...clientes];

    if (filtroNome) {
      filtrados = filtrados.filter(cliente => 
        cliente.nome.toLowerCase().includes(filtroNome.toLowerCase())
      );
    }

    if (filtroStatus !== "todos") {
      filtrados = filtrados.filter(cliente => 
        cliente.status_pagamento === filtroStatus
      );
    }

    // Aplicar ordenação alfabética
    filtrados.sort((a, b) => {
      const comparison = a.nome.localeCompare(b.nome, 'pt-BR');
      return ordemAlfabetica ? comparison : -comparison;
    });

    setClientesFiltrados(filtrados);
  }, [clientes, filtroNome, filtroStatus, ordemAlfabetica]);

  // Carregar dados ao montar o componente
  useEffect(() => {
    carregarDados();
  }, [periodo]);

  // Escutar mudanças na tabela de faturamento para atualizar automaticamente
  useEffect(() => {
    const canal = supabase
      .channel('faturamento_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'faturamento' 
        }, 
        (payload) => {
          console.log('Mudança detectada na tabela faturamento:', payload);
          // Recarregar dados automaticamente quando houver mudanças
          carregarDados();
          toast({
            title: "Dados atualizados",
            description: "O demonstrativo foi atualizado automaticamente",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [periodo]);

  // Calcular totais
  const totais = clientesFiltrados.reduce((acc, cliente) => ({
    exames: acc.exames + cliente.total_exames,
    valorBruto: acc.valorBruto + cliente.valor_bruto,
    valorLiquido: acc.valorLiquido + cliente.valor_liquido,
  }), { exames: 0, valorBruto: 0, valorLiquido: 0 });

  const statusCounts = {
    pendente: clientesFiltrados.filter(c => c.status_pagamento === 'pendente').length,
    pago: clientesFiltrados.filter(c => c.status_pagamento === 'pago').length,
    vencido: clientesFiltrados.filter(c => c.status_pagamento === 'vencido').length,
  };

  const exportarCSV = () => {
    const headers = ['Cliente', 'Total Exames', 'Valor Bruto', 'Valor Líquido', 'Status'];
    const csvContent = [
      headers.join(','),
      ...clientesFiltrados.map(cliente => [
        `"${cliente.nome}"`,
        cliente.total_exames,
        cliente.valor_bruto.toFixed(2),
        cliente.valor_liquido.toFixed(2),
        cliente.status_pagamento
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `demonstrativo_faturamento_${periodo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Arquivo exportado",
      description: "Demonstrativo de faturamento exportado com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Demonstrativo de Faturamento</h2>
        <p className="text-gray-600 mt-1">Visualize e analise o faturamento por cliente</p>
      </div>

      {/* ✅ RESUMO GERAL - Agora na aba correta */}
      {clientes.length > 0 && (() => {
        // ✅ EXTRAIR VALORES REAIS DOS DEMONSTRATIVOS SALVOS
        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodo}`);
        let resumoReal = null;
        
        if (demonstrativosCompletos) {
          try {
            const dados = JSON.parse(demonstrativosCompletos);
            resumoReal = dados.resumo;
          } catch (error) {
            console.error('Erro ao processar resumo do localStorage:', error);
          }
        }
        
        const resumoCalculado = resumoReal || {
          clientes_processados: clientes.length,
          total_exames_geral: clientes.reduce((sum, c) => sum + (c.total_exames || 0), 0),
          valor_exames_geral: clientes.reduce((sum, c) => sum + (c.valor_bruto || 0), 0),
          valor_franquias_geral: 0, // Fallback se não houver dados completos
          valor_portal_geral: 0,     
          valor_integracao_geral: 0, 
          valor_impostos_geral: 0,   
          valor_total_geral: clientes.reduce((sum, c) => sum + (c.valor_liquido || 0), 0),
          clientes_simples_nacional: 0,
          clientes_regime_normal: clientes.length
        };
        
        return (
          <Card>
            <CardHeader>
              <CardTitle>Resumo Geral - {periodo}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {resumoCalculado.clientes_processados}
                  </div>
                  <div className="text-sm text-muted-foreground">Clientes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumoCalculado.valor_exames_geral)}
                  </div>
                  <div className="text-sm text-muted-foreground">Exames</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((resumoCalculado.valor_franquias_geral || 0) + (resumoCalculado.valor_portal_geral || 0) + (resumoCalculado.valor_integracao_geral || 0))}
                  </div>
                  <div className="text-sm text-muted-foreground">Adicionais</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumoCalculado.valor_exames_geral + ((resumoCalculado.valor_franquias_geral || 0) + (resumoCalculado.valor_portal_geral || 0) + (resumoCalculado.valor_integracao_geral || 0)))}
                  </div>
                  <div className="text-sm text-muted-foreground">Valor Bruto</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Controles e Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros e Controles
          </CardTitle>
          <CardDescription>
            Dados do faturamento gerado automaticamente. Atualiza automaticamente quando novo faturamento é processado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodo">Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-07">{formatarPeriodoAbreviado("2025-07")}</SelectItem>
                  <SelectItem value="2025-06">{formatarPeriodoAbreviado("2025-06")}</SelectItem>
                  <SelectItem value="2025-05">{formatarPeriodoAbreviado("2025-05")}</SelectItem>
                  <SelectItem value="2025-04">{formatarPeriodoAbreviado("2025-04")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filtro-nome">Buscar Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="filtro-nome"
                  placeholder="Nome do cliente..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filtro-status">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ações</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={carregarDados} 
                  disabled={carregando}
                  size="sm"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {carregando ? 'Carregando...' : 'Atualizar'}
                </Button>
                <Button 
                  onClick={exportarCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold">{clientesFiltrados.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Exames</p>
                <p className="text-2xl font-bold">{totais.exames.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Bruto</p>
                <p className="text-2xl font-bold">R$ {totais.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Líquido</p>
                <p className="text-2xl font-bold">R$ {totais.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status das Faturas */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-700">Pendentes</p>
                <p className="text-xl font-bold text-blue-900">{statusCounts.pendente}</p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {((statusCounts.pendente / clientesFiltrados.length) * 100 || 0).toFixed(1)}%
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-700">Pagas</p>
                <p className="text-xl font-bold text-green-900">{statusCounts.pago}</p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {((statusCounts.pago / clientesFiltrados.length) * 100 || 0).toFixed(1)}%
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-red-700">Vencidas</p>
                <p className="text-xl font-bold text-red-900">{statusCounts.vencido}</p>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {((statusCounts.vencido / clientesFiltrados.length) * 100 || 0).toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center justify-between">
                <span>Faturamento por Cliente</span>
                <span className="text-sm font-normal text-gray-500 ml-4">
                  Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </CardTitle>
              <CardDescription>
                {clientesFiltrados.length} de {clientes.length} clientes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const novaOrdem = [...clientesFiltrados].sort((a, b) => {
                    const comparison = a.nome.localeCompare(b.nome, 'pt-BR');
                    return ordemAlfabetica ? -comparison : comparison;
                  });
                  setClientesFiltrados(novaOrdem);
                  setOrdemAlfabetica(!ordemAlfabetica);
                }}
              >
                {ordemAlfabetica ? 'Z-A' : 'A-Z'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Carregando dados...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Cliente</th>
                    <th className="text-right py-3 px-4">Exames</th>
                    <th className="text-right py-3 px-4">Valor Bruto</th>
                    <th className="text-right py-3 px-4">Valor Líquido</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente, index) => (
                    <>
                      <tr 
                        key={`${cliente.nome}-${index}`} 
                        className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} cursor-pointer hover:bg-blue-50 transition-colors`}
                        onClick={() => {
                          const newExpanded = new Set(expandedClients);
                          if (newExpanded.has(cliente.id)) {
                            newExpanded.delete(cliente.id);
                          } else {
                            newExpanded.add(cliente.id);
                          }
                          setExpandedClients(newExpanded);
                        }}
                      >
                        <td className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            {expandedClients.has(cliente.id) ? '▼' : '▶'}
                            {cliente.nome}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">{cliente.total_exames.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">R$ {cliente.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right font-medium">R$ {cliente.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant={
                              cliente.status_pagamento === 'pago' ? 'default' :
                              cliente.status_pagamento === 'vencido' ? 'destructive' : 'secondary'
                            }
                          >
                            {cliente.status_pagamento}
                          </Badge>
                        </td>
                      </tr>
                      {/* ✅ LINHA DE DETALHAMENTO EXPANDIDO */}
                      {expandedClients.has(cliente.id) && cliente.detalhes_exames && (
                        <tr key={`${cliente.nome}-details-${index}`} className="bg-blue-50">
                          <td colSpan={5} className="px-8 py-4">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm text-gray-700">Detalhamento por Modalidade/Especialidade</h4>
                              <div className="max-h-40 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-300">
                                      <th className="text-left py-1">Modalidade</th>
                                      <th className="text-left py-1">Especialidade</th>
                                      <th className="text-left py-1">Categoria</th>
                                      <th className="text-left py-1">Prioridade</th>
                                      <th className="text-right py-1">Qtd</th>
                                      <th className="text-right py-1">Valor Unit.</th>
                                      <th className="text-right py-1">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cliente.detalhes_exames.map((detalhe, idx) => (
                                      <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-1">{detalhe.modalidade}</td>
                                        <td className="py-1">{detalhe.especialidade}</td>
                                        <td className="py-1">{detalhe.categoria}</td>
                                        <td className="py-1">{detalhe.prioridade}</td>
                                        <td className="py-1 text-right">{detalhe.quantidade}</td>
                                        <td className="py-1 text-right">R$ {detalhe.valor_unitario.toFixed(2)}</td>
                                        <td className="py-1 text-right font-medium">R$ {detalhe.valor_total.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}