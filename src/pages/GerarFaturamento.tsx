import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Mail,
  FileSpreadsheet,
  Download,
  ExternalLink,
  FileBarChart2,
  Zap,
  Users,
  Upload
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaPeriodoSelector } from "@/components/volumetria/VolumetriaPeriodoSelector";
import { Speedometer } from "@/components/Speedometer";
import { processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile, processFaturamentoFile, limparUploadsAntigos } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ControlePeriodoFaturamento } from "@/components/ControlePeriodoFaturamento";
import { UploadStatusPanel } from "@/components/UploadStatusPanel";

import { generatePDF, downloadPDF, type FaturamentoData } from "@/lib/pdfUtils";

// Período atual (julho/2025) - onde estão os dados carregados
const PERIODO_ATUAL = "2025-07";

// Função para verificar se um período pode ser editado
const isPeriodoEditavel = (periodo: string): boolean => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // getMonth() retorna 0-11
  const diaAtual = hoje.getDate();
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  // Se é período futuro, não pode editar
  if (anoPeriodo > anoAtual || (anoPeriodo === anoAtual && mesPeriodo > mesAtual)) {
    return false;
  }
  
  // Se é período anterior ao atual, não pode editar (dados históricos)
  if (anoPeriodo < anoAtual || (anoPeriodo === anoAtual && mesPeriodo < mesAtual)) {
    return false;
  }
  
  // Se é o mês atual mas depois do dia 5, considera fechado (exemplo de regra)
  if (anoPeriodo === anoAtual && mesPeriodo === mesAtual && diaAtual > 5) {
    return false;
  }
  
  // Período atual e dentro do prazo de edição
  return true;
};

// Função para obter status do período
const getStatusPeriodo = (periodo: string): 'editavel' | 'fechado' | 'historico' | 'futuro' => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();
  
  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  
  if (anoPeriodo > anoAtual || (anoPeriodo === anoAtual && mesPeriodo > mesAtual)) {
    return 'futuro';
  }
  
  if (anoPeriodo < anoAtual || (anoPeriodo === anoAtual && mesPeriodo < mesAtual)) {
    return 'historico';
  }
  
  if (anoPeriodo === anoAtual && mesPeriodo === mesAtual) {
    return diaAtual <= 5 ? 'editavel' : 'fechado';
  }
  
  return 'fechado';
};

export default function GerarFaturamento() {
  const [activeTab, setActiveTab] = useState("teste-volumetria");
  const [relatoriosGerados, setRelatoriosGerados] = useState(0);
  const [emailsEnviados, setEmailsEnviados] = useState(0);
  const [processandoTodos, setProcessandoTodos] = useState(false);
  const [sistemaProntoParagerar, setSistemaProntoParagerar] = useState(false);
  
  // Controle de período para volumetria retroativa
  const [periodoFaturamentoVolumetria, setPeriodoFaturamentoVolumetria] = useState<{ ano: number; mes: number } | null>(null);
  
  // Controle de período para upload
  const [periodoSelecionado, setPeriodoSelecionado] = useState(PERIODO_ATUAL);
  const [mostrarApenasEditaveis, setMostrarApenasEditaveis] = useState(true);
  
  const [clientesCarregados, setClientesCarregados] = useState<Array<{
    id: string;
    nome: string;
    email: string;
  }>>([]);
  
  // Estado para relatórios prontos
  const [relatoriosProntos, setRelatoriosProntos] = useState<Array<{
    clienteId: string;
    clienteNome: string;
    arquivo: File;
    nomeArquivo: string;
    uploadUrl?: string;
    dataUpload: string;
  }>>([]);

  // Estado para arquivo de faturamento
  const [arquivoFaturamento, setArquivoFaturamento] = useState<File | null>(null);
  const [enviarEmails, setEnviarEmails] = useState(true);
  const [statusProcessamento, setStatusProcessamento] = useState<{
    processando: boolean;
    mensagem: string;
    progresso: number;
  }>({
    processando: false,
    mensagem: '',
    progresso: 0
  });
  
  const [resultados, setResultados] = useState<Array<{
    clienteId: string;
    clienteNome: string;
    relatorioGerado: boolean;
    emailEnviado: boolean;
    emailDestino: string;
    linkRelatorio?: string;
    arquivos?: Array<{ tipo: string; url: string; nome: string }>;
    erro?: string;
    erroEmail?: string;
    dataProcessamento?: string;
    relatorioData?: any;
    detalhesRelatorio?: {
      total_laudos: number;
      valor_total: number;
    };
  }>>([]);
  
  const { toast } = useToast();

  // Carregar clientes da base de dados (inicialização)
  const carregarClientes = async () => {
    try {
      console.log('🔍 Iniciando carregamento de clientes...');
      
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, ativo, status')
        .eq('ativo', true)
        .eq('status', 'Ativo')
        .not('email', 'is', null)
        .neq('email', ''); // Excluir emails vazios

      console.log('🔍 Resultado da consulta clientes:', { data, error, count: data?.length });

      if (error) {
        console.error('❌ Erro na consulta clientes:', error);
        throw error;
      }

      console.log('📊 Total de clientes ativos encontrados:', data?.length || 0);

      // Carregar todos os clientes ativos (removido filtro de email)
      const clientesAtivos = data || [];
      
      console.log('Clientes carregados (todos):', clientesAtivos);
      
      setClientesCarregados(clientesAtivos);
      
      // Sempre inicializar resultados quando há clientes
      if (clientesAtivos.length > 0) {
        setResultados(clientesAtivos.map(cliente => ({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          relatorioGerado: false,
          emailEnviado: false,
          emailDestino: cliente.email || '',
        })));
        console.log('Lista populada com clientes reais:', clientesAtivos.length);
      } else {
        setResultados([]);
      }
      
      return clientesAtivos;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClientesCarregados([]);
      
      toast({
        title: "Erro ao carregar clientes",
        description: "Não foi possível carregar os clientes da base de dados. Faça upload dos clientes primeiro.",
        variant: "destructive",
      });
      
      return [];
    }
  };

  // Recarregar clientes sem resetar resultados
  const recarregarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, status')
        .eq('ativo', true)
        .eq('status', 'Ativo')
        .not('email', 'is', null);

      if (error) throw error;

      const clientesAtivos = data || [];
      setClientesCarregados(clientesAtivos);
      
      toast({
        title: "Clientes atualizados",
        description: `${clientesAtivos.length} clientes carregados da base`,
      });
      
      return clientesAtivos;
    } catch (error) {
      console.error('Erro ao recarregar clientes:', error);
      toast({
        title: "Erro ao recarregar",
        description: "Não foi possível atualizar a lista de clientes",
        variant: "destructive",
      });
      return [];
    }
  };


  // Carregar clientes apenas na inicialização
  useEffect(() => {
    carregarClientes();
  }, []);

  // Função para fazer upload de relatório pronto
  const handleUploadRelatorio = async (clienteId: string, file: File) => {
    try {
      const cliente = clientesCarregados.find(c => c.id === clienteId);
      if (!cliente) {
        throw new Error("Cliente não encontrado");
      }

      // Simular upload - em produção seria para storage do Supabase
      const uploadUrl = URL.createObjectURL(file);
      
      const novoRelatorio = {
        clienteId,
        clienteNome: cliente.nome,
        arquivo: file,
        nomeArquivo: file.name,
        uploadUrl,
        dataUpload: new Date().toLocaleString('pt-BR')
      };

      setRelatoriosProntos(prev => {
        // Remove relatório anterior do mesmo cliente se existir
        const filtered = prev.filter(r => r.clienteId !== clienteId);
        return [...filtered, novoRelatorio];
      });

      // Atualizar resultados para mostrar que o relatório está disponível
      setResultados(prev => {
        const existing = prev.find(r => r.clienteId === clienteId);
        if (existing) {
          return prev.map(r => 
            r.clienteId === clienteId 
              ? { ...r, relatorioGerado: true, linkRelatorio: uploadUrl, dataProcessamento: novoRelatorio.dataUpload }
              : r
          );
        } else {
          return [...prev, {
            clienteId,
            clienteNome: cliente.nome,
            relatorioGerado: true,
            emailEnviado: false,
            emailDestino: cliente.email,
            linkRelatorio: uploadUrl,
            dataProcessamento: novoRelatorio.dataUpload
          }];
        }
      });

      toast({
        title: "Relatório Carregado",
        description: `Relatório para ${cliente.nome} foi carregado com sucesso`,
      });

    } catch (error: any) {
      toast({
        title: "Erro no Upload",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para carregar relatórios prontos em lote
  const handleCarregarRelatoriosProntos = () => {
    // Verificar se há relatórios carregados
    const clientesComRelatorio = relatoriosProntos.filter(rel => 
      clientesCarregados.some(cliente => cliente.id === rel.clienteId)
    );

    if (clientesComRelatorio.length === 0) {
      toast({
        title: "Nenhum Relatório Encontrado",
        description: "Faça upload dos relatórios primeiro.",
        variant: "destructive",
      });
      return;
    }

    // Marcar como prontos para envio
    setResultados(prev => {
      const novosResultados = [...prev];
      
      clientesComRelatorio.forEach(rel => {
        const existingIndex = novosResultados.findIndex(r => r.clienteId === rel.clienteId);
        if (existingIndex >= 0) {
          novosResultados[existingIndex] = {
            ...novosResultados[existingIndex],
            relatorioGerado: true,
            linkRelatorio: rel.uploadUrl,
            dataProcessamento: rel.dataUpload
          };
        } else {
          const cliente = clientesCarregados.find(c => c.id === rel.clienteId)!;
          novosResultados.push({
            clienteId: rel.clienteId,
            clienteNome: rel.clienteNome,
            relatorioGerado: true,
            emailEnviado: false,
            emailDestino: cliente.email,
            linkRelatorio: rel.uploadUrl,
            dataProcessamento: rel.dataUpload
          });
        }
      });
      
      return novosResultados;
    });

    setRelatoriosGerados(clientesComRelatorio.length);
    
    toast({
      title: "Relatórios Prontos",
      description: `${clientesComRelatorio.length} relatórios prontos para envio`,
    });
  };

  // Função para processar arquivo de faturamento e gerar PDFs
  const handleProcessarFaturamento = async () => {
    if (!arquivoFaturamento) {
      toast({
        title: "Arquivo Necessário",
        description: "Faça upload do arquivo de faturamento primeiro",
        variant: "destructive",
      });
      return;
    }

    setStatusProcessamento({
      processando: true,
      mensagem: 'Fazendo upload do arquivo...',
      progresso: 20
    });

    try {
      // Upload do arquivo para storage
      const nomeArquivo = `faturamento_${Date.now()}_${arquivoFaturamento.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(nomeArquivo, arquivoFaturamento);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      setStatusProcessamento({
        processando: true,
        mensagem: 'Processando dados...',
        progresso: 40
      });

      // Primeiro processar os dados do arquivo
      const { data: processData, error: processError } = await supabase.functions.invoke('processar-faturamento', {
        body: { fileName: nomeArquivo }
      });

      if (processError) {
        throw new Error(`Erro ao processar dados: ${processError.message}`);
      }

      setStatusProcessamento({
        processando: true,
        mensagem: 'Buscando dados processados...',
        progresso: 60
      });

      // Buscar dados processados da tabela faturamento
      const inicioMes = `${periodoSelecionado}-01`;
      const proximoMes = new Date(`${periodoSelecionado}-01`);
      proximoMes.setMonth(proximoMes.getMonth() + 1);
      const fimMes = proximoMes.toISOString().split('T')[0];
      
      const { data: faturamentoData, error: faturamentoError } = await supabase
        .from('faturamento')
        .select('*')
        .gte('data_emissao', inicioMes)
        .lt('data_emissao', fimMes);

      console.log('🔍 DEBUG: Dados brutos da tabela faturamento:', faturamentoData?.slice(0, 3));
      console.log('🔍 DEBUG: Total de registros:', faturamentoData?.length);

      if (faturamentoError) {
        throw new Error(`Erro ao buscar dados: ${faturamentoError.message}`);
      }

      if (!faturamentoData || faturamentoData.length === 0) {
        throw new Error('Nenhum dado de faturamento encontrado para o período');
      }

      setStatusProcessamento({
        processando: true,
        mensagem: 'Gerando PDFs localmente...',
        progresso: 80
      });

      // Agrupar dados por cliente
      const clientesAgrupados = faturamentoData.reduce((acc: any, item: any) => {
        console.log('🔍 DEBUG: Item individual:', item);
        
        if (!acc[item.cliente_nome]) {
          acc[item.cliente_nome] = {
            cliente_nome: item.cliente_nome,
            exames: [],
            total_exames: 0,
            valor_total: 0
          };
        }
        
        // Mapear item para a estrutura esperada pelo PDF
        const exameFormatado = {
          paciente: item.cliente_nome || 'Nome não informado',
          data_exame: item.data_exame,
          modalidade: item.modalidade || 'Não informado',
          especialidade: item.especialidade || 'Não informado',
          nome_exame: item.nome_exame || 'Exame não informado',
          quantidade: item.quantidade || 1,
          valor_bruto: item.valor_bruto || 0
        };
        
        console.log('🔍 DEBUG: Exame formatado:', exameFormatado);
        
        acc[item.cliente_nome].exames.push(exameFormatado);
        acc[item.cliente_nome].total_exames++;
        acc[item.cliente_nome].valor_total += item.valor_bruto || 0;
        return acc;
      }, {});

      // Gerar PDFs usando a biblioteca local
      const novosResultados = [];
      let sucessos = 0;
      
      for (const clienteNome in clientesAgrupados) {
        try {
          const clienteData: FaturamentoData = {
            ...clientesAgrupados[clienteNome],
            periodo: periodoSelecionado
          };

          console.log('🔍 DEBUG: Dados enviados para PDF:', clienteData);
          console.log('🔍 DEBUG: Exames no clienteData:', clienteData.exames?.slice(0, 2));

          const pdfBlob = await generatePDF(clienteData);
          const pdfFileName = `relatorio_${clienteNome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodoSelecionado}.pdf`;
          
          // Upload do PDF para o storage
          const { error: pdfUploadError } = await supabase.storage
            .from('uploads')
            .upload(`pdfs/${pdfFileName}`, pdfBlob);

          if (pdfUploadError) {
            console.error(`Erro no upload do PDF para ${clienteNome}:`, pdfUploadError);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(`pdfs/${pdfFileName}`);

          novosResultados.push({
            clienteId: `cliente-${clienteNome}`,
            clienteNome: clienteNome,
            relatorioGerado: true,
            emailEnviado: false,
            emailDestino: 'email@cliente.com',
            linkRelatorio: publicUrl,
            dataProcessamento: new Date().toLocaleString('pt-BR'),
            detalhesRelatorio: {
              total_laudos: clienteData.total_exames,
              valor_total: clienteData.valor_total
            }
          });
          
          sucessos++;
          console.log(`PDF gerado para ${clienteNome}: ${publicUrl}`);
          
        } catch (error) {
          console.error(`Erro ao gerar PDF para ${clienteNome}:`, error);
          novosResultados.push({
            clienteId: `cliente-${clienteNome}`,
            clienteNome: clienteNome,
            relatorioGerado: false,
            emailEnviado: false,
            emailDestino: 'email@cliente.com',
            erro: `Erro ao gerar PDF: ${error}`
          });
        }
      }
      
      setResultados(novosResultados);
      setRelatoriosGerados(sucessos);

      setStatusProcessamento({
        processando: false,
        mensagem: '',
        progresso: 100
      });

      toast({
        title: "Processamento Concluído",
        description: `${sucessos} relatórios PDF gerados com sucesso`,
      });

      // Mudar para aba de envio se emails não foram enviados
      if (!enviarEmails) {
        setActiveTab("emails");
      }

    } catch (error: any) {
      console.error('Erro no processamento:', error);
      setStatusProcessamento({
        processando: false,
        mensagem: '',
        progresso: 0
      });

      toast({
        title: "Erro no Processamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Primeira etapa: Gerar todos os relatórios
  const handleGerarTodosRelatorios = async () => {
    setProcessandoTodos(true);
    setRelatoriosGerados(0);
    
    let relatoriosCount = 0;

    try {
      console.log('🔍 Verificando clientes carregados:', clientesCarregados.length);
      
      // Garantir que temos clientes carregados
      const clientesParaProcessar = clientesCarregados.length > 0 ? clientesCarregados : await carregarClientes();
      
      console.log('🔍 Clientes para processar:', clientesParaProcessar.length);
      console.log('🔍 Lista de clientes:', clientesParaProcessar.map(c => ({ id: c.id, nome: c.nome, email: c.email })));
      
      if (clientesParaProcessar.length === 0) {
        // Vamos tentar recarregar uma vez mais antes de falhar
        console.log('🔄 Tentando recarregar clientes uma vez mais...');
        const clientesRecarregados = await carregarClientes();
        
        if (clientesRecarregados.length === 0) {
          toast({
            title: "Nenhum Cliente Encontrado",
            description: "Faça upload dos clientes antes de gerar relatórios. Vá para a página 'Cadastro de Clientes'.",
            variant: "destructive",
          });
          setProcessandoTodos(false);
          return;
        } else {
          console.log('✅ Clientes encontrados após recarregamento:', clientesRecarregados.length);
        }
      }
      
      console.log('Gerando relatórios para clientes:', clientesParaProcessar.map(c => c.nome));
      
      // Inicializar resultados
      const novosResultados = clientesParaProcessar.map(cliente => ({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        relatorioGerado: false,
        emailEnviado: false,
        emailDestino: cliente.email,
      }));
      setResultados(novosResultados);

      // Gerar relatório para cada cliente
      for (const cliente of clientesParaProcessar) {
        try {
          // Gerar relatório com nova estrutura simplificada
          const responseRelatorio = await supabase.functions.invoke('gerar-relatorio-faturamento', {
            body: {
              cliente_id: cliente.id,
              periodo: PERIODO_ATUAL // formato: "2025-07"
            }
          });

          if (responseRelatorio.error) {
            throw new Error(`Erro ao gerar relatório: ${responseRelatorio.error.message}`);
          }

          if (!responseRelatorio.data?.success) {
            throw new Error(responseRelatorio.data?.details || 'Erro desconhecido na geração do relatório');
          }

          console.log(`✅ Relatório gerado para ${cliente.nome}:`, responseRelatorio.data);
          console.log('🔍 Verificando estrutura de arquivos:', responseRelatorio.data?.arquivos);
          console.log('🔍 URL do primeiro arquivo:', responseRelatorio.data?.arquivos?.[0]?.url);

          // Marcar relatório como gerado com novos dados
          const linkRelatorio = responseRelatorio.data?.arquivos?.[0]?.url || `#relatorio-${cliente.id}-${PERIODO_ATUAL}`;
          const dataProcessamento = new Date().toLocaleString('pt-BR');
          
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { 
                  ...r, 
                  relatorioGerado: true, 
                  dataProcessamento: dataProcessamento,
                  linkRelatorio: linkRelatorio,
                  arquivos: responseRelatorio.data?.arquivos || [],
                  detalhesRelatorio: {
                    total_laudos: responseRelatorio.data?.resumo?.total_laudos || 0,
                    valor_total: responseRelatorio.data?.resumo?.valor_bruto_total || responseRelatorio.data?.resumo?.valor_total || 0,
                    fonte_dados: responseRelatorio.data?.fonte_dados || 'desconhecida',
                    total_exames: responseRelatorio.data?.total_exames || 0
                  },
                  relatorioData: responseRelatorio.data // Dados completos para envio posterior
                }
                : r
          ));
          relatoriosCount++;
          setRelatoriosGerados(relatoriosCount);

        } catch (error: any) {
          console.error(`Erro ao gerar relatório para ${cliente.nome}:`, error);
          
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { ...r, erro: error.message }
              : r
          ));
        }
      }

      toast({
        title: "Relatórios Gerados",
        description: `${relatoriosCount} relatórios gerados com sucesso. Agora você pode enviar os emails.`,
      });

    } catch (error: any) {
      console.error("Erro geral:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro durante a geração de relatórios",
        variant: "destructive",
      });
    } finally {
      setProcessandoTodos(false);
    }
  };

  // Segunda etapa: Enviar emails um por vez
  const handleEnviarEmails = async () => {
    await handleEnviarEmailsInterno();
  };

  const handleEnviarEmailsInterno = async (clientesCustomizados?: any[]) => {
    setProcessandoTodos(true);
    setEmailsEnviados(0);
    
    let emailsCount = 0;

    try {
      // Usar clientes customizados ou filtrar do estado atual (apenas com email)
      const clientesComRelatorio = clientesCustomizados || resultados.filter(r => 
        r.relatorioGerado && 
        !r.emailEnviado && 
        !r.erro && 
        r.emailDestino && 
        r.emailDestino.trim() !== ''
      );
      
      console.log('Estado atual dos resultados:', resultados.map(r => ({ 
        nome: r.clienteNome, 
        relatorio: r.relatorioGerado, 
        email: r.emailEnviado, 
        erro: r.erro 
      })));
      
      if (clientesComRelatorio.length === 0) {
        toast({
          title: "Nenhum Relatório Disponível",
          description: "Carregue os relatórios prontos primeiro e certifique-se de que os clientes tenham email cadastrado antes de enviar os emails.",
          variant: "destructive",
        });
        setProcessandoTodos(false);
        return;
      }

      console.log('Enviando emails para:', clientesComRelatorio.map(c => c.clienteNome));

      // Enviar email para cada cliente, um por vez
      for (const cliente of clientesComRelatorio) {
        try {
          // Adicionar delay entre envios para evitar rate limiting
          if (emailsCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo de delay
          }

          // Encontrar o relatório pronto para este cliente
          const relatorioPronto = relatoriosProntos.find(r => r.clienteId === cliente.clienteId);
          
          const responseEmail = await supabase.functions.invoke('enviar-relatorio-email', {
            body: {
              cliente_id: cliente.clienteId,
              relatorio: {
                arquivo_nome: relatorioPronto?.nomeArquivo || 'relatorio.pdf',
                arquivo_url: cliente.linkRelatorio,
                periodo: PERIODO_ATUAL,
                tipo: 'relatorio_pronto'
              }
            }
          });

          if (responseEmail.error) {
            throw new Error(`Erro ao enviar email: ${responseEmail.error.message}`);
          }

          // Marcar email como enviado
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.clienteId 
              ? { ...r, emailEnviado: true }
              : r
          ));
          emailsCount++;
          setEmailsEnviados(emailsCount);

          toast({
            title: "Email Enviado",
            description: `Email enviado para ${cliente.clienteNome}`,
          });

        } catch (error: any) {
          console.error(`Erro ao enviar email para ${cliente.clienteNome}:`, error);
          
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.clienteId 
              ? { ...r, erro: `Erro no email: ${error.message}` }
              : r
          ));
        }
      }

      toast({
        title: "Envio Concluído",
        description: `${emailsCount} emails enviados com sucesso`,
      });

    } catch (error: any) {
      console.error("Erro geral:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro durante o envio de emails",
        variant: "destructive",
      });
    } finally {
      setProcessandoTodos(false);
    }
  };

  // Função combinada que executa as duas etapas sequencialmente
  const handleProcessarTodosClientes = async () => {
    try {
      // Primeira etapa: SEMPRE gerar todos os relatórios para clientes ativos
      console.log('🚀 Iniciando geração de relatórios para todos os clientes ativos...');
      await handleGerarTodosRelatorios();
      
      // Aguardar um momento para UI atualizar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Segunda etapa: enviar emails APENAS se a opção estiver habilitada
      if (enviarEmails) {
        console.log('📧 Opção de envio de emails habilitada - enviando automaticamente...');
        setResultados(resultadosAtuais => {
          const clientesParaEmail = resultadosAtuais.filter(r => 
            r.relatorioGerado && 
            !r.emailEnviado && 
            !r.erro && 
            r.emailDestino && 
            r.emailDestino.trim() !== ''
          );
          
          console.log('Clientes disponíveis para email após geração:', clientesParaEmail.map(c => c.clienteNome));
          
          // Executar envio de emails de forma assíncrona apenas se houver clientes válidos
          if (clientesParaEmail.length > 0) {
            handleEnviarEmailsInterno(clientesParaEmail).catch(error => {
              console.error('Erro no envio de emails:', error);
            });
          } else {
            toast({
              title: "Relatórios Gerados, mas Nenhum Email Enviado", 
              description: "Todos os relatórios foram gerados, mas não há clientes válidos com email cadastrado para envio de email.",
              variant: "destructive",
            });
          }
          
          return resultadosAtuais; // Retornar o estado sem alterações
        });
      } else {
        console.log('📧 Opção de envio de emails desabilitada - apenas relatórios gerados');
        toast({
          title: "Relatórios Gerados", 
          description: `Relatórios gerados com sucesso! Envio de emails está desabilitado. Use o botão 'Enviar Emails' se desejar enviar para clientes com email cadastrado.`,
        });
      }
      
    } catch (error: any) {
      console.error("Erro no processamento automático:", error);
      toast({
        title: "Erro no Processamento",
        description: error.message || "Erro durante o processamento automático",
        variant: "destructive",
      });
    }
  };

  const limparResultados = () => {
    // ✅ Limpar completamente a lista e contadores
    setResultados([]);
    setRelatoriosGerados(0);
    setEmailsEnviados(0);
    
    // ✅ Recarregar clientes para evitar duplicação
    carregarClientes();
    
    console.log("Lista limpa completamente"); // Debug
    
    toast({
      title: "Lista Limpa",
      description: "A lista de clientes foi limpa e recarregada",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerar Faturamento</h1>
        <p className="text-gray-600 mt-1">Geração e envio automático de relatórios de faturamento para todos os clientes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="teste-volumetria" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Dados MobileMed
          </TabsTrigger>
          <TabsTrigger value="relatorios-prontos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios Prontos
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Gerar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teste-volumetria" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle>Dados de Volumetria MobileMed</CardTitle>
                </div>
                <CardDescription>
                  Processamento dos arquivos de volumetria com conversões automáticas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seletor de Período de Faturamento */}
                <VolumetriaPeriodoSelector
                  periodoSelecionado={periodoFaturamentoVolumetria}
                  onPeriodoSelected={setPeriodoFaturamentoVolumetria}
                  onClearPeriodo={() => setPeriodoFaturamentoVolumetria(null)}
                />

                {/* Uploads de Volumetria */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <VolumetriaUpload
                      arquivoFonte="volumetria_padrao"
                      onSuccess={() => {
                        toast({
                          title: "Upload Concluído",
                          description: "Dados de volumetria padrão processados com sucesso!",
                        });
                      }}
                    />
                  </div>

                  <div>
                    <VolumetriaUpload
                      arquivoFonte="volumetria_fora_padrao"
                      onSuccess={() => {
                        toast({
                          title: "Upload Concluído",
                          description: "Dados de volumetria fora do padrão processados com sucesso!",
                        });
                      }}
                    />
                  </div>

                  <div>
                    <VolumetriaUpload
                      arquivoFonte="volumetria_padrao_retroativo"
                      disabled={!periodoFaturamentoVolumetria}
                      periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                      onSuccess={() => {
                        toast({
                          title: "Upload Concluído",
                          description: "Dados de volumetria padrão retroativa processados com sucesso!",
                        });
                      }}
                    />
                  </div>

                  <div>
                    <VolumetriaUpload
                      arquivoFonte="volumetria_fora_padrao_retroativo"
                      disabled={!periodoFaturamentoVolumetria}
                      periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                      onSuccess={() => {
                        toast({
                          title: "Upload Concluído",
                          description: "Dados de volumetria fora do padrão retroativa processados com sucesso!",
                        });
                      }}
                    />
                  </div>

                  <div>
                    <VolumetriaUpload
                      arquivoFonte="volumetria_onco_padrao"
                      onSuccess={() => {
                        toast({
                          title: "Upload Concluído",
                          description: "Dados de volumetria oncológica processados com sucesso!",
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-2 pt-4">
                  <Label>Templates de Teste</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="/templates/template_volumetria_mobilemed_data_laudo.csv" download>
                        <Download className="h-4 w-4 mr-2" />
                        Template Data_Laudo
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/templates/template_volumetria_mobilemed_data_exame.csv" download>
                        <Download className="h-4 w-4 mr-2" />
                        Template Data_Exame
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Conversões Automáticas:</h4>
                  <ul className="text-sm space-y-1">
                    <li><Badge variant="secondary">Datas</Badge> dd/mm/aa → Date</li>
                    <li><Badge variant="secondary">Horas</Badge> hh:mm:ss → Time</li>
                    <li><Badge variant="secondary">Valores</Badge> 2.50 → 2 (parte inteira)</li>
                    <li><Badge variant="secondary">Validação</Badge> Campos obrigatórios e formatos</li>
                  </ul>
                </div>

                {/* Status dos Uploads */}
                <div className="mt-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Status dos Uploads
                  </h4>
                  <UploadStatusPanel />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="relatorios-prontos" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios Prontos - {PERIODO_ATUAL}
              </CardTitle>
              <CardDescription>
                Faça upload dos relatórios de faturamento já prontos para cada cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-900">{clientesCarregados.length}</div>
                      <div className="text-sm text-blue-700">Clientes Ativos</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-900">{resultados.filter(r => r.relatorioGerado).length}</div>
                      <div className="text-sm text-green-700">Relatórios Gerados</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-8 w-8 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-900">
                        {resultados.filter(r => r.emailEnviado).length}
                      </div>
                      <div className="text-sm text-orange-700">Emails Enviados</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Relatórios Gerados pelo Sistema */}
              {resultados.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Relatórios Gerados pelo Sistema</h3>
                    <div className="flex gap-2">
                      <Button 
                        onClick={recarregarClientes}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    {resultados.map((resultado) => (
                      <div key={resultado.clienteId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{resultado.clienteNome}</h4>
                            <p className="text-sm text-muted-foreground">{resultado.emailDestino}</p>
                            {resultado.detalhesRelatorio && (
                              <p className="text-xs text-blue-600 mt-1">
                                {resultado.detalhesRelatorio.total_laudos} laudos - 
                                R$ {resultado.detalhesRelatorio.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {resultado.relatorioGerado ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                PDF Gerado
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                            {resultado.emailEnviado && (
                              <Badge variant="default" className="bg-blue-100 text-blue-800">
                                <Mail className="h-3 w-3 mr-1" />
                                Email Enviado
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {resultado.relatorioGerado && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-700">
                                Relatório gerado em {resultado.dataProcessamento}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {resultado.linkRelatorio && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(resultado.linkRelatorio)}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Visualizar PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {resultado.erro && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="text-sm text-red-700">Erro: {resultado.erro}</span>
                            </div>
                          </div>
                        )}

                        {resultado.erroEmail && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm text-yellow-700">Email: {resultado.erroEmail}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum Relatório Gerado</h3>
                  <p className="text-gray-500 mb-4">
                    Vá para a aba "Gerar" para processar o arquivo de faturamento e gerar relatórios
                  </p>
                  <Button onClick={() => setActiveTab("faturamento")} variant="outline">
                    <FileBarChart2 className="h-4 w-4 mr-2" />
                    Ir para Gerar Relatórios
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faturamento" className="space-y-6 mt-6">
          {/* ⚠️ Alerta se não há clientes carregados */}
          {clientesCarregados.length === 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <h3 className="font-semibold">Nenhum Cliente Encontrado</h3>
                    <p className="text-sm">Faça upload da lista de clientes primeiro na página "Cadastro de Clientes".</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processo Separado: Gerar Relatórios e Enviar Emails */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Gerar Relatórios de Faturamento
              </CardTitle>
              <CardDescription>
                Primeiro gere relatórios para todos os clientes ativos, depois envie emails se necessário - {PERIODO_ATUAL}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Controle de envio de emails */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enviar-emails"
                    checked={enviarEmails}
                    onCheckedChange={setEnviarEmails}
                  />
                  <Label htmlFor="enviar-emails" className="text-sm font-medium">
                    Enviar emails após gerar relatórios (apenas quando usar "Fazer Tudo")
                  </Label>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  {enviarEmails 
                    ? '✅ Emails serão enviados automaticamente quando usar "Fazer Tudo"' 
                    : '🚫 Emails NÃO serão enviados automaticamente. Use "Enviar Emails" separadamente.'}
                </p>
              </div>

              {/* Status atual */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-2xl font-bold text-blue-900">{clientesCarregados.length}</div>
                  <div className="text-sm text-blue-700">Clientes Ativos</div>
                </div>
                <div className="relative text-center p-3 bg-green-50 border border-green-200 rounded overflow-hidden">
                  <div 
                    className="absolute inset-0 transition-all duration-500"
                    style={{ 
                      width: clientesCarregados.length > 0 ? `${(relatoriosGerados / clientesCarregados.length) * 100}%` : '0%',
                      background: 'rgba(34, 197, 94, 0.2)',
                      boxShadow: 'inset -10px 0 15px -5px rgba(34, 197, 94, 0.8), 0 0 15px rgba(34, 197, 94, 0.5)'
                    }}
                  />
                  <div className="relative z-10">
                    <div className="text-2xl font-bold text-green-900">{relatoriosGerados}</div>
                    <div className="text-sm text-green-700">Relatórios Gerados</div>
                  </div>
                </div>
                <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded">
                  <div className="text-2xl font-bold text-orange-900">{emailsEnviados}</div>
                  <div className="text-sm text-orange-700">Emails Enviados</div>
                </div>
                <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded">
                  <div className="text-2xl font-bold text-gray-900">{resultados.filter(r => r.erro).length}</div>
                  <div className="text-sm text-gray-700">Erros</div>
                </div>
              </div>

              {/* Botões de ação separados por etapas */}
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Etapa 1: Gerar Relatórios para Todos os Clientes Ativos
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button 
                      onClick={handleGerarTodosRelatorios}
                      disabled={processandoTodos || clientesCarregados.length === 0}
                      size="lg"
                      className="min-w-[250px] bg-green-600 hover:bg-green-700"
                    >
                      {processandoTodos ? (
                        <>
                          <Clock className="h-5 w-5 mr-2 animate-spin" />
                          Gerando Relatórios...
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          Gerar Relatórios ({clientesCarregados.length} clientes)
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-green-700">
                      Gera relatórios PDF para todos os clientes ativos
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Etapa 2: Enviar Emails
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button 
                      onClick={handleEnviarEmails}
                      disabled={processandoTodos || resultados.filter(r => r.relatorioGerado && !r.emailEnviado && !r.erro && r.emailDestino).length === 0}
                      size="lg"
                      className="min-w-[250px]"
                      variant="outline"
                    >
                      {processandoTodos ? (
                        <>
                          <Clock className="h-5 w-5 mr-2 animate-spin" />
                          Enviando Emails...
                        </>
                      ) : (
                        <>
                          <Mail className="h-5 w-5 mr-2" />
                          Enviar Emails ({resultados.filter(r => r.relatorioGerado && !r.emailEnviado && !r.erro && r.emailDestino).length} prontos)
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-blue-700">
                      Envia relatórios por email apenas para clientes com PDFs gerados e com e-mail cadastrado
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Processo Automático (Etapas 1 + 2)
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button 
                      onClick={handleProcessarTodosClientes}
                      disabled={processandoTodos || !sistemaProntoParagerar}
                      size="lg"
                      className="min-w-[250px] bg-purple-600 hover:bg-purple-700"
                      title={!sistemaProntoParagerar ? "Aguarde o processamento dos dados de faturamento" : ""}
                    >
                      {processandoTodos ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : !sistemaProntoParagerar ? (
                        <>
                          <Clock className="h-5 w-5 mr-2" />
                          Aguardando Dados...
                        </>
                      ) : (
                        <>
                          <Zap className="h-5 w-5 mr-2" />
                          Fazer Tudo ({enviarEmails ? 'Gerar + Enviar' : 'Apenas Gerar'})
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-purple-700">
                      {enviarEmails 
                        ? 'Gera relatórios e envia emails automaticamente' 
                        : 'Gera apenas relatórios (emails desabilitados)'}
                    </p>
                  </div>
                </div>
              </div>
                  
              
              {/* Botões utilitários */}
              <div className="flex flex-wrap gap-2 justify-center pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={recarregarClientes}
                  disabled={processandoTodos}
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Clientes
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={limparResultados}
                  disabled={processandoTodos}
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Limpar Resultados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Relatórios Gerados</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="relative">
                {/* Efeito de preenchimento lateral */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-green-100 to-transparent transition-all duration-1000 ease-out"
                  style={{ 
                    width: clientesCarregados.length > 0 ? `${(relatoriosGerados / clientesCarregados.length) * 100}%` : '0%' 
                  }}
                />
                <div className="relative z-10">
                  <div className="text-2xl font-bold">{relatoriosGerados}</div>
                  <p className="text-xs text-muted-foreground">
                    relatórios gerados
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">E-mails Enviados</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{emailsEnviados}</div>
                <p className="text-xs text-muted-foreground">
                  e-mails com relatórios
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Velocímetro ou Matrix Rain durante processamento */}
          <Card>
            <CardHeader>
              <CardTitle>{processandoTodos ? "Processando..." : "Progresso do Faturamento"}</CardTitle>
            </CardHeader>
            <CardContent>
              {processandoTodos ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">SISTEMA ATIVO</h3>
                    <div className="w-[350px] h-[250px] bg-gray-900 rounded flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-green-400 text-2xl font-mono mb-2">⚡</div>
                        <p className="text-green-400 font-mono">PROCESSANDO...</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-green-600 font-mono">GERANDO RELATÓRIOS...</p>
                      <p className="text-xs text-muted-foreground mt-1">Processando dados dos clientes</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">STATUS: ONLINE</h3>
                    <div className="w-[350px] h-[250px] bg-gray-900 rounded flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-green-400 text-2xl font-mono mb-2">🟢</div>
                        <p className="text-green-400 font-mono">SISTEMA ONLINE</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-green-600 font-mono">SISTEMA OPERACIONAL</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde a conclusão do processo</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
                  <Speedometer
                    value={clientesCarregados.length}
                    max={clientesCarregados.length}
                    label="Clientes Cadastrados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 30, color: "#3b82f6" },
                      medium: { threshold: 70, color: "#3b82f6" },
                      high: { threshold: 100, color: "#3b82f6" }
                    }}
                  />
                  
                  <Speedometer
                    value={relatoriosGerados}
                    max={clientesCarregados.length}
                    label="Relatórios Gerados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 40, color: "#f59e0b" },
                      medium: { threshold: 80, color: "#10b981" },
                      high: { threshold: 100, color: "#10b981" }
                    }}
                  />
                  
                  <Speedometer
                    value={emailsEnviados}
                    max={clientesCarregados.length}
                    label="E-mails Enviados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 40, color: "#ef4444" },
                      medium: { threshold: 80, color: "#f59e0b" },
                      high: { threshold: 100, color: "#10b981" }
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de Clientes */}
          <Card>
            <CardHeader>
              <CardTitle>Status por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-center p-3">Relatório</th>
                      <th className="text-left p-3">E-mail Enviado Para</th>
                      <th className="text-left p-3">Link do Relatório</th>
                      <th className="text-left p-3">Data/Hora</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((resultado) => (
                      <tr key={resultado.clienteId} className="border-b">
                        <td className="p-3 font-medium">{resultado.clienteNome}</td>
                        <td className="p-3 text-center">
                          {resultado.relatorioGerado ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300 mx-auto"></div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{resultado.emailDestino}</span>
                            {resultado.emailEnviado && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </td>
                         <td className="p-3">
                           {resultado.arquivos && resultado.arquivos.length > 0 ? (
                             <div className="flex flex-col space-y-1">
                               {resultado.arquivos.map((arquivo, index) => (
                                 <a
                                   key={index}
                                   href={arquivo.url}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                                 >
                                   <ExternalLink className="h-3 w-3" />
                                   {arquivo.tipo.toUpperCase()}
                                 </a>
                               ))}
                             </div>
                           ) : resultado.linkRelatorio ? (
                             <a 
                               href={resultado.linkRelatorio} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                             >
                               <ExternalLink className="h-3 w-3" />
                               Ver Relatório
                             </a>
                           ) : (
                             <span className="text-sm text-muted-foreground">-</span>
                           )}
                         </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {resultado.dataProcessamento || "-"}
                        </td>
                        <td className="p-3">
                          {resultado.erro ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Erro
                            </Badge>
                          ) : resultado.emailEnviado ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Concluído
                            </Badge>
                          ) : resultado.relatorioGerado ? (
                            <Badge variant="secondary">
                              Relatório Gerado
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Pendente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Debug: Mostrar info do estado atual */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-gray-50 border rounded text-xs">
                  <strong>Debug:</strong> Total clientes: {resultados.length}, 
                  Com erro: {resultados.filter(r => r.erro).length},
                  Relatórios: {resultados.filter(r => r.relatorioGerado).length},
                  Emails: {resultados.filter(r => r.emailEnviado).length}
                </div>
              )}
              
              {/* Mostrar erros se houver */}
              {resultados.length > 0 && resultados.some(r => r.erro) && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Erros Encontrados ({resultados.filter(r => r.erro).length}):
                  </h4>
                  {resultados.filter(r => r.erro).map(resultado => (
                    <div key={resultado.clienteId} className="text-sm p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-red-800">{resultado.clienteNome}:</span>
                          <p className="text-red-700 mt-1">{resultado.erro}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botão principal para gerar relatórios */}
          <Card className={`border-green-200 ${statusProcessamento.processando ? 'relative' : 'bg-green-50'}`}>
            {statusProcessamento.processando && (
              <div className="absolute inset-0 bg-black/80 rounded-lg overflow-hidden z-10">
                <div className="w-full h-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-green-400 text-4xl font-mono mb-4">⚡</div>
                    <p className="text-green-400 font-mono text-lg">PROCESSANDO</p>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/70 p-6 rounded-lg border border-green-400/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                      <RefreshCw className="h-8 w-8 text-green-400 animate-spin" />
                      <div>
                        <h3 className="text-lg font-semibold text-green-400">Processando Relatórios</h3>
                        <p className="text-green-300">{statusProcessamento.mensagem}</p>
                        <div className="mt-2 w-64 bg-green-900 rounded-full h-2">
                          <div 
                            className="bg-green-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${statusProcessamento.progresso}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBarChart2 className="h-5 w-5 text-green-600" />
                Gerar Relatórios
              </CardTitle>
              <CardDescription>
                {clientesCarregados.length > 0 
                  ? `${clientesCarregados.length} clientes encontrados. Configure o período e gere os relatórios.`
                  : "Nenhum Cliente Encontrado - Faça upload da lista de clientes primeiro na página 'Cadastro de Clientes'."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {clientesCarregados.length > 0 ? (
                <>
                  {/* Upload de Arquivo de Faturamento */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Upload de Arquivo de Faturamento
                    </h3>
                    
                    {/* Estrutura esperada do arquivo */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-blue-900">Estrutura do Arquivo Excel</h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = '/templates/template_faturamento_dados.csv';
                            link.download = 'template_faturamento_dados.csv';
                            link.click();
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Baixar Template
                        </Button>
                      </div>
                      <p className="text-sm text-blue-800 mb-3">O arquivo deve conter as seguintes colunas:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-700">
                        <div>• Data do Exame</div>
                        <div>• Nome do Paciente</div>
                        <div>• Nome do Cliente</div>
                        <div>• CNPJ Cliente</div>
                        <div>• Nome do Médico Laudador</div>
                        <div>• Modalidade</div>
                        <div>• Especialidade</div>
                        <div>• Categoria</div>
                        <div>• Prioridade</div>
                        <div>• Quantidade de Laudos</div>
                        <div>• Valor</div>
                        <div>• Franquia (opcional)</div>
                        <div>• Ajuste (opcional)</div>
                      </div>
                    </div>

                    {/* Upload de arquivo */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                      <label className="cursor-pointer">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <span className="text-lg font-medium text-gray-700">
                          {arquivoFaturamento ? arquivoFaturamento.name : 'Selecione o arquivo de faturamento'}
                        </span>
                        <p className="text-sm text-gray-500 mt-2">
                          Formatos aceitos: .xlsx, .xls
                        </p>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setArquivoFaturamento(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {arquivoFaturamento && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium text-green-900">{arquivoFaturamento.name}</p>
                              <p className="text-sm text-green-700">
                                {(arquivoFaturamento.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setArquivoFaturamento(null)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão principal para processar e gerar PDFs */}
                  <div className="flex justify-center">
                    <Button
                      onClick={handleProcessarFaturamento}
                      disabled={!arquivoFaturamento || statusProcessamento.processando}
                      size="lg"
                      className="min-w-[300px] bg-green-600 hover:bg-green-700"
                    >
                      {statusProcessamento.processando ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <FileBarChart2 className="h-5 w-5 mr-3" />
                          Processar e Gerar PDFs
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    <strong>ℹ️ Como funciona:</strong> O arquivo será processado, os dados serão agrupados por cliente, 
                    e relatórios PDF individuais serão gerados automaticamente. Configure o período e opções de envio 
                    na aba "Configuração".
                  </div>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Nenhum Cliente Encontrado</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      Faça upload da lista de clientes primeiro na página "Cadastro de Clientes".
                    </p>
                  </div>
                  <Button onClick={() => window.location.href = '/clientes/cadastro'}>
                    Ir para Cadastro de Clientes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}
