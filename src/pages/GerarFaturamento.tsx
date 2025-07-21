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
  Upload,
  Database,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Mail,
  Calendar,
  DollarSign,
  Users,
  FileSpreadsheet,
  Settings,
  Download,
  ExternalLink,
  FileBarChart2,
  Link,
  Zap,
  HardDrive
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { Speedometer } from "@/components/Speedometer";
import { processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile, processFaturamentoFile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ControlePeriodoFaturamento } from "@/components/ControlePeriodoFaturamento";
import { MatrixRain } from "@/components/MatrixRain";
import { generatePDF, downloadPDF, type FaturamentoData } from "@/lib/pdfUtils";

// Período atual (julho/2025)
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
  const [activeTab, setActiveTab] = useState("faturamento");
  const [relatoriosGerados, setRelatoriosGerados] = useState(0);
  const [emailsEnviados, setEmailsEnviados] = useState(0);
  const [processandoTodos, setProcessandoTodos] = useState(false);
  
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
  
  // Estados para geração de relatório individual
  const [clienteSelecionadoRelatorio, setClienteSelecionadoRelatorio] = useState('');
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  
  const { toast } = useToast();

  // Carregar clientes da base de dados (inicialização)
  const carregarClientes = async () => {
    try {
      console.log('🔍 Iniciando carregamento de clientes...');
      
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, ativo, status')
        .eq('ativo', true)
        .eq('status', 'Ativo');

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
      const { data: faturamentoData, error: faturamentoError } = await supabase
        .from('faturamento')
        .select('*')
        .ilike('numero_fatura', `%${periodoSelecionado}%`);

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
        if (!acc[item.cliente_nome]) {
          acc[item.cliente_nome] = {
            cliente_nome: item.cliente_nome,
            exames: [],
            total_exames: 0,
            valor_total: 0
          };
        }
        acc[item.cliente_nome].exames.push(item);
        acc[item.cliente_nome].total_exames++;
        acc[item.cliente_nome].valor_total += item.valor_bruto;
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
                    valor_total: responseRelatorio.data?.resumo?.valor_total || 0,
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
      // Usar clientes customizados ou filtrar do estado atual
      const clientesComRelatorio = clientesCustomizados || resultados.filter(r => r.relatorioGerado && !r.emailEnviado && !r.erro);
      
      console.log('Estado atual dos resultados:', resultados.map(r => ({ 
        nome: r.clienteNome, 
        relatorio: r.relatorioGerado, 
        email: r.emailEnviado, 
        erro: r.erro 
      })));
      
      if (clientesComRelatorio.length === 0) {
        toast({
          title: "Nenhum Relatório Disponível",
          description: "Carregue os relatórios prontos primeiro antes de enviar os emails.",
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
      // Primeira etapa: gerar todos os relatórios
      await handleGerarTodosRelatorios();
      
      // Aguardar um momento para UI atualizar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Segunda etapa: usar um callback para obter o estado atualizado
      setResultados(resultadosAtuais => {
        const clientesParaEmail = resultadosAtuais.filter(r => r.relatorioGerado && !r.emailEnviado && !r.erro);
        
        console.log('Estado completo dos resultados:', resultadosAtuais.map(r => ({
          nome: r.clienteNome,
          relatorioGerado: r.relatorioGerado,
          emailEnviado: r.emailEnviado,
          erro: r.erro,
          temDadosRelatorio: !!r.relatorioData
        })));
        
        console.log('Clientes disponíveis para email após geração:', clientesParaEmail.map(c => c.clienteNome));
        
        // Executar envio de emails de forma assíncrona
        if (clientesParaEmail.length > 0) {
          handleEnviarEmailsInterno(clientesParaEmail).catch(error => {
            console.error('Erro no envio de emails:', error);
          });
        } else {
          // Verificar se todos têm relatórios mas com erro
          const todosComRelatorio = resultadosAtuais.filter(r => r.relatorioGerado);
          if (todosComRelatorio.length > 0) {
            toast({
              title: "Relatórios Gerados, mas Emails Não Enviados", 
              description: "Todos os relatórios foram gerados, mas houve problemas para identificar clientes válidos para envio. Tente usar o botão 'Enviar Emails' separadamente.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Nenhum Relatório Válido",
              description: "Não foi possível gerar relatórios válidos para envio de emails.",
              variant: "destructive",
            });
          }
        }
        
        return resultadosAtuais; // Retornar o estado sem alterações
      });
      
    } catch (error: any) {
      console.error("Erro no processamento automático:", error);
      toast({
        title: "Erro no Processamento",
        description: error.message || "Erro durante o processamento automático",
        variant: "destructive",
      });
    }
  };

  // Função para gerar relatório individual
  const handleGerarRelatorioIndividual = async () => {
    if (!clienteSelecionadoRelatorio) {
      toast({
        title: "Cliente Necessário",
        description: "Selecione um cliente para gerar o relatório",
        variant: "destructive",
      });
      return;
    }

    setGerandoRelatorio(true);

    try {
      // Buscar dados do cliente selecionado
      const clienteSelecionado = clientesCarregados.find(c => c.id === clienteSelecionadoRelatorio);
      
      if (!clienteSelecionado) {
        throw new Error("Cliente não encontrado");
      }

      toast({
        title: "Iniciando Geração",
        description: `Gerando relatório para ${clienteSelecionado.nome}...`,
      });

      // Chamar edge function para gerar relatório
      const { data: relatorioData, error: relatorioError } = await supabase.functions.invoke('gerar-relatorio-faturamento', {
        body: {
          cliente_id: clienteSelecionadoRelatorio,
          periodo: PERIODO_ATUAL // formato: "2025-01"
        }
      });

      if (relatorioError) {
        throw new Error(`Erro ao gerar relatório: ${relatorioError.message}`);
      }

      if (!relatorioData?.success) {
        throw new Error(relatorioData?.details || 'Erro desconhecido na geração do relatório');
      }

      // Abrir PDF em nova aba
      if (relatorioData.arquivos && relatorioData.arquivos.length > 0) {
        const pdfUrl = relatorioData.arquivos[0].url;
        window.open(pdfUrl, '_blank');
      }

      toast({
        title: "Relatório Gerado",
        description: `PDF gerado com sucesso para ${clienteSelecionado.nome}! Total: ${relatorioData.resumo?.total_laudos || 0} laudos, Valor: R$ ${relatorioData.resumo?.valor_total?.toFixed(2) || '0,00'}`,
      });

    } catch (error: any) {
      console.error('Erro ao gerar relatório individual:', error);
      toast({
        title: "Erro na Geração",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGerandoRelatorio(false);
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="relatorios-prontos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios Prontos
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Gerar
          </TabsTrigger>
          <TabsTrigger value="uploads" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload de Dados
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Base de Dados
          </TabsTrigger>
        </TabsList>

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

          {/* Botão Principal no Topo */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Processar Faturamento - {PERIODO_ATUAL}</h2>
                  <p className="text-muted-foreground">Gera relatórios e envia por email para todos os clientes</p>
                  {clientesCarregados.length > 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      ✅ {clientesCarregados.length} clientes carregados na base de dados
                    </p>
                  )}
                </div>
                
                <div className="flex justify-center gap-4 flex-wrap">
                  <Button 
                    onClick={handleCarregarRelatoriosProntos}
                    disabled={processandoTodos || relatoriosProntos.length === 0}
                    size="lg"
                    className="min-w-[180px]"
                  >
                    {processandoTodos ? (
                      <>
                        <Clock className="h-5 w-5 mr-2 animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        Gerar Relatórios ({relatoriosProntos.length})
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleEnviarEmails}
                    disabled={processandoTodos || resultados.filter(r => r.relatorioGerado && !r.emailEnviado && !r.erro).length === 0}
                    size="lg"
                    className="min-w-[180px]"
                    variant="secondary"
                  >
                    {processandoTodos ? (
                      <>
                        <Clock className="h-5 w-5 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Enviar Emails
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      handleCarregarRelatoriosProntos();
                      setTimeout(() => handleEnviarEmails(), 2000);
                    }}
                    disabled={processandoTodos || relatoriosProntos.length === 0}
                    size="lg"
                    className="min-w-[200px]"
                    variant="outline"
                  >
                    {processandoTodos ? (
                      <>
                        <Clock className="h-5 w-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Fazer Tudo (Automático)
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      console.log('🔍 Debug - Verificando tabela clientes...');
                      const { data, error, count } = await supabase
                        .from('clientes')
                        .select('*', { count: 'exact' });
                      
                      console.log('📊 Debug - Todos os clientes na tabela:', { data, error, count });
                      
                      toast({
                        title: "Debug - Clientes na Tabela",
                        description: `Total: ${count || 0} registros encontrados. Veja console para detalhes.`,
                      });
                    }}
                    disabled={processandoTodos}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Debug - Ver Tabela
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={recarregarClientes}
                    disabled={processandoTodos}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recarregar Clientes
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={limparResultados}
                    disabled={processandoTodos}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                  
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Relatórios Gerados</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{relatoriosGerados}</div>
                <p className="text-xs text-muted-foreground">
                  relatórios gerados
                </p>
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
                    <MatrixRain width={350} height={250} speed={40} fontSize={12} opacity={0.9} />
                    <div className="text-center">
                      <p className="text-sm text-green-600 font-mono">GERANDO RELATÓRIOS...</p>
                      <p className="text-xs text-muted-foreground mt-1">Processando dados dos clientes</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">STATUS: ONLINE</h3>
                    <MatrixRain width={350} height={250} speed={35} fontSize={14} opacity={0.8} />
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
                <MatrixRain width={800} height={600} fontSize={12} opacity={0.8} />
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

        <TabsContent value="uploads" className="space-y-6 mt-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-800">Upload de Dados</h3>
                  <p className="text-sm text-blue-700">
                    Upload de clientes foi movido para a página "Cadastro de Clientes". Configure outras fontes de dados na página de Configuração de Faturamento.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = '/clientes/cadastro'}
                  >
                    Cadastro de Clientes
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = '/configuracao/faturamento'}
                  >
                    Configurar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900 mb-2">📋 Ordem Recomendada de Upload:</h3>
            <ol className="list-decimal list-inside space-y-1 text-green-800">
              <li><strong>Primeiro:</strong> Upload de Clientes (na página "Cadastro de Clientes")</li>
              <li><strong>Segundo:</strong> Upload de Contratos (opcional, regras de preço)</li>
              <li><strong>Terceiro:</strong> Escalas e Financeiro (opcionais)</li>
              <li><strong>Quarto:</strong> <strong>Upload Laudos Para Faturamento</strong> (para geração de relatórios PDF)</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileUpload
              title="Upload de Contratos/Regras"
              description="Upload de tabela de preços e contratos"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={10}
              expectedFormat={["Cliente ID, Modalidade, Especialidade", "Valor, Desconto, Vigência"]}
              onUpload={processContratosFile}
              icon={<Users className="h-5 w-5" />}
            />

            <FileUpload
              title="Upload de Escalas Médicas"
              description="Escalas e horários dos médicos"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={10}
              expectedFormat={["Médico, Data, Turno, Modalidade", "Status, Tipo de Escala"]}
              onUpload={processEscalasFile}
              icon={<Calendar className="h-5 w-5" />}
            />

            <FileUpload
              title="Upload de Dados Financeiros"
              description="Dados de pagamentos e faturamento"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={25}
              expectedFormat={["Fatura ID, Valor, Data Pagamento", "Status, Observações"]}
              onUpload={processFinanceiroFile}
              icon={<DollarSign className="h-5 w-5" />}
            />

            {/* Template Download Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Template de Faturamento
                </CardTitle>
                <CardDescription>
                  Baixe o template CSV com a estrutura correta para o upload de dados de faturamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Estrutura do Template (11 colunas):</h4>
                    <p className="text-sm text-muted-foreground">
                      Cliente → Paciente → Médico → Data_Exame → Modalidade → Especialidade → Categoria → Prioridade → Nome Exame → Quantidade → Valor_Bruto
                    </p>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <a href="/templates/template_faturamento.csv" download="template_faturamento.csv">
                      <FileText className="mr-2 h-4 w-4" />
                      Baixar Template CSV
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <FileUpload
              title="Upload Laudos Para Faturamento"
              description="Upload de arquivo de laudos para faturamento seguindo o template com as colunas: Cliente, Paciente, Médico, Data_Exame, Modalidade, Especialidade, Categoria, Prioridade, Nome Exame, Quantidade, Valor_Bruto. Baixar template CSV: /templates/template_faturamento.csv"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={25}
              expectedFormat={["nome (B), quantidade (J), valor_bruto (K)"]}
              onUpload={async (file) => {
                try {
                  console.log('🔥 UPLOAD DE LAUDOS PARA FATURAMENTO INICIADO - ARQUIVO:', file.name);
                  console.log('🔥 TAMANHO DO ARQUIVO:', file.size, 'bytes');
                  console.log('🔥 TIPO DO ARQUIVO:', file.type);
                  
                  await processFaturamentoFile(file);
                  
                  console.log('🔥 UPLOAD DE LAUDOS PARA FATURAMENTO CONCLUÍDO COM SUCESSO');
                  toast({
                    title: "Upload de Laudos Concluído",
                    description: "Dados de laudos para faturamento carregados com sucesso!",
                  });
                } catch (error: any) {
                  console.error('🔥 ERRO NO UPLOAD DE LAUDOS PARA FATURAMENTO:', error);
                  toast({
                    title: "Erro no Upload de Laudos",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
               icon={<FileBarChart2 className="h-5 w-5" />}
             />
           </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Status das Tabelas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">exames_realizados</p>
                      <p className="text-sm text-muted-foreground">Exames processados</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">contratos_clientes</p>
                      <p className="text-sm text-muted-foreground">Regras de faturamento</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">faturas_geradas</p>
                      <p className="text-sm text-muted-foreground">Histórico de faturas</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gerar Relatório PDF
                </CardTitle>
                <CardDescription>
                  Gerar relatório individual para teste com layout completo (logomarca, título, resumo financeiro e detalhamento)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Layout do Relatório:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Logomarca Teleimagem</li>
                    <li>• Título: Demonstrativo de Faturamento</li>
                    <li>• Quadro 1: Resumo Financeiro (totais, impostos)</li>
                    <li>• Quadro 2: Detalhamento dos Exames (tabela completa)</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Label>Selecionar Cliente para Relatório</Label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={clienteSelecionadoRelatorio}
                    onChange={(e) => setClienteSelecionadoRelatorio(e.target.value)}
                  >
                    <option value="">Selecione um cliente...</option>
                    {clientesCarregados.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <Button 
                  onClick={handleGerarRelatorioIndividual}
                  disabled={!clienteSelecionadoRelatorio || gerandoRelatorio}
                  className="w-full"
                >
                  {gerandoRelatorio ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Gerar Relatório PDF
                    </>
                  )}
                </Button>

                <div className="space-y-2 mt-6">
                  <Label>Edge Functions:</Label>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>gerar-relatorio-faturamento</span>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>enviar-relatorio-email</span>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>processar-faturamento</span>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
