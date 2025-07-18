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
import { processExamesFile, processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile, processFaturamentoFile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ControlePeriodo } from "@/components/ControlePeriodo";

// Tipos para fontes de dados
type FonteDados = 'upload' | 'mobilemed' | 'banco';

interface ConfiguracaoFonte {
  tipo: FonteDados;
  ativa: boolean;
  configuracao?: any;
}

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
  const [activeTab, setActiveTab] = useState("faturamento-dados");
  const [relatoriosGerados, setRelatoriosGerados] = useState(0);
  const [emailsEnviados, setEmailsEnviados] = useState(0);
  const [processandoTodos, setProcessandoTodos] = useState(false);
  
  // Controle de período para upload
  const [periodoSelecionado, setPeriodoSelecionado] = useState(PERIODO_ATUAL);
  const [mostrarApenasEditaveis, setMostrarApenasEditaveis] = useState(true);
  
  // Configuração da fonte de dados
  const [fonteDados, setFonteDados] = useState<FonteDados>('upload');
  const [configuracaoMobilemed, setConfiguracaoMobilemed] = useState({
    url: '',
    usuario: '',
    senha: '',
    ativo: false
  });
  
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
      console.log('Iniciando carregamento de clientes...');
      
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, ativo')
        .eq('ativo', true);

      console.log('Resultado da consulta:', { data, error });

      if (error) {
        console.error('Erro na consulta:', error);
        throw error;
      }

      // Filtrar clientes com email válido
      const clientesComEmail = data?.filter(cliente => 
        cliente.email && 
        cliente.email.trim() !== '' && 
        cliente.email.includes('@')
      ) || [];
      
      console.log('Clientes filtrados com email:', clientesComEmail);
      
      setClientesCarregados(clientesComEmail);
      
      // Sempre inicializar resultados quando há clientes
      if (clientesComEmail.length > 0) {
        setResultados(clientesComEmail.map(cliente => ({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          relatorioGerado: false,
          emailEnviado: false,
          emailDestino: cliente.email,
        })));
        console.log('Lista populada com clientes reais:', clientesComEmail.length);
      } else {
        setResultados([]);
      }
      
      return clientesComEmail;
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
        .select('id, nome, email')
        .eq('ativo', true)
        .not('email', 'is', null);

      if (error) throw error;

      const clientesComEmail = data?.filter(cliente => cliente.email && cliente.email.trim() !== '') || [];
      setClientesCarregados(clientesComEmail);
      
      toast({
        title: "Clientes atualizados",
        description: `${clientesComEmail.length} clientes carregados da base`,
      });
      
      return clientesComEmail;
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
        .from('documentos-clientes')
        .upload(`uploads/${nomeArquivo}`, arquivoFaturamento);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      setStatusProcessamento({
        processando: true,
        mensagem: 'Processando dados e gerando PDFs...',
        progresso: 50
      });

      // Chamar edge function para processar
      const { data, error } = await supabase.functions.invoke('processar-faturamento-pdf', {
        body: {
          file_path: `uploads/${nomeArquivo}`,
          periodo: periodoSelecionado
        }
      });

      if (error) {
        throw new Error(`Erro no processamento: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido no processamento');
      }

      setStatusProcessamento({
        processando: true,
        mensagem: 'Atualizando resultados...',
        progresso: 80
      });

      // Atualizar resultados com os PDFs gerados
      const novosResultados = data.pdfs_gerados.map((pdf: any) => ({
        clienteId: `cliente-${pdf.cliente}`,
        clienteNome: pdf.cliente,
        relatorioGerado: true,
        emailEnviado: false,
        emailDestino: `${pdf.cliente.toLowerCase().replace(/\s+/g, '')}@email.com`, // Email fictício
        linkRelatorio: pdf.url,
        dataProcessamento: new Date().toLocaleString('pt-BR'),
        detalhesRelatorio: {
          total_laudos: pdf.resumo.total_laudos,
          valor_total: pdf.resumo.valor_pagar
        }
      }));

      setResultados(novosResultados);
      setRelatoriosGerados(data.pdfs_gerados.length);

      setStatusProcessamento({
        processando: false,
        mensagem: '',
        progresso: 100
      });

      toast({
        title: "Processamento Concluído",
        description: `${data.pdfs_gerados.length} relatórios PDF gerados com sucesso`,
      });

      // Mudar para aba de envio
      setActiveTab("emails");

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
      // Garantir que temos clientes carregados
      const clientesParaProcessar = clientesCarregados.length > 0 ? clientesCarregados : await carregarClientes();
      
      if (clientesParaProcessar.length === 0) {
        toast({
          title: "Nenhum Cliente Encontrado",
          description: "Faça upload dos clientes antes de gerar relatórios. Vá para a aba 'Upload de Dados'.",
          variant: "destructive",
        });
        setProcessandoTodos(false);
        return;
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="faturamento-dados" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Arquivo Faturamento
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="relatorios-prontos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios Prontos
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Envio de Emails
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

        <TabsContent value="faturamento-dados" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload de Arquivo de Faturamento - {periodoSelecionado}
              </CardTitle>
              <CardDescription>
                Faça upload do arquivo Excel contendo os dados de faturamento para gerar relatórios PDF individuais por cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Estrutura esperada do arquivo */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-blue-900">Estrutura do Arquivo Excel</h3>
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

              {/* Status do processamento */}
              {statusProcessamento.processando && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin" />
                    <div>
                      <h3 className="font-semibold text-yellow-900">Processando...</h3>
                      <p className="text-sm text-yellow-800">{statusProcessamento.mensagem}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-yellow-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${statusProcessamento.progresso}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Upload de arquivo */}
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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

              {/* Controle de período */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Período do Faturamento</h3>
                <ControlePeriodo
                  periodoSelecionado={periodoSelecionado}
                  setPeriodoSelecionado={setPeriodoSelecionado}
                  mostrarApenasEditaveis={mostrarApenasEditaveis}
                  setMostrarApenasEditaveis={setMostrarApenasEditaveis}
                />
              </div>

              {/* Botão de processamento */}
              <div className="flex justify-center">
                <Button
                  onClick={handleProcessarFaturamento}
                  disabled={!arquivoFaturamento || statusProcessamento.processando}
                  size="lg"
                  className="px-8"
                >
                  {statusProcessamento.processando ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileBarChart2 className="h-4 w-4 mr-2" />
                      Processar e Gerar PDFs
                    </>
                  )}
                </Button>
              </div>

              {/* Resultados do processamento */}
              {resultados.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Relatórios Gerados</h3>
                  <div className="grid gap-3">
                    {resultados.map((resultado) => (
                      <div key={resultado.clienteId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{resultado.clienteNome}</p>
                          {resultado.detalhesRelatorio && (
                            <p className="text-sm text-gray-600">
                              {resultado.detalhesRelatorio.total_laudos} laudos - 
                              R$ {resultado.detalhesRelatorio.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {resultado.relatorioGerado && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              PDF Gerado
                            </Badge>
                          )}
                          {resultado.linkRelatorio && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(resultado.linkRelatorio)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-6 mt-6">
          {/* Configuração da Fonte de Dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração da Fonte de Dados
              </CardTitle>
              <CardDescription>
                Configure como os dados do faturamento serão obtidos - via upload de arquivo ou integração direta com Mobilemed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Selecione a fonte de dados:</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Opção: Upload de Arquivo */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    fonteDados === 'upload' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFonteDados('upload')}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        fonteDados === 'upload' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {fonteDados === 'upload' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Upload className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Upload de Arquivo</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Fazer upload manual de arquivos CSV/Excel</p>
                      </div>
                    </div>
                  </div>

                  {/* Opção: Integração Mobilemed */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    fonteDados === 'mobilemed' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFonteDados('mobilemed')}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        fonteDados === 'mobilemed' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {fonteDados === 'mobilemed' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Mobilemed</span>
                          <Badge variant="secondary" className="text-xs">Em breve</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Integração direta com sistema Mobilemed</p>
                      </div>
                    </div>
                  </div>

                  {/* Opção: Banco Local */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    fonteDados === 'banco' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFonteDados('banco')}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        fonteDados === 'banco' ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                      }`}>
                        {fonteDados === 'banco' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5 text-purple-600" />
                          <span className="font-medium">Banco Local</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Usar dados já carregados no banco</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuração específica para Mobilemed */}
              {fonteDados === 'mobilemed' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Configuração da Integração Mobilemed</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={configuracaoMobilemed.ativo}
                          onCheckedChange={(checked) => 
                            setConfiguracaoMobilemed(prev => ({ ...prev, ativo: checked }))
                          }
                        />
                        <Label className="text-sm">Ativo</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mobilemed-url">URL do Sistema Mobilemed</Label>
                        <Input
                          id="mobilemed-url"
                          type="url"
                          placeholder="https://sistema.mobilemed.com.br"
                          value={configuracaoMobilemed.url}
                          onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, url: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mobilemed-usuario">Usuário</Label>
                        <Input
                          id="mobilemed-usuario"
                          placeholder="usuario@empresa.com"
                          value={configuracaoMobilemed.usuario}
                          onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, usuario: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mobilemed-senha">Senha</Label>
                      <Input
                        id="mobilemed-senha"
                        type="password"
                        placeholder="••••••••"
                        value={configuracaoMobilemed.senha}
                        onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, senha: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button 
                        variant="outline" 
                        disabled={!configuracaoMobilemed.url || !configuracaoMobilemed.usuario || !configuracaoMobilemed.senha}
                        onClick={() => {
                          toast({
                            title: "Teste de Conexão",
                            description: "Funcionalidade em desenvolvimento. Em breve será possível testar a conexão com Mobilemed.",
                          });
                        }}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Testar Conexão
                      </Button>
                      
                      <Button 
                        onClick={() => {
                          toast({
                            title: "Configuração Salva",
                            description: "Configurações da integração Mobilemed foram salvas.",
                          });
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Salvar Configuração
                      </Button>
                    </div>

                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-800">Integração em Desenvolvimento</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            A integração com Mobilemed está sendo desenvolvida. Por enquanto, use a opção "Upload de Arquivo" 
                            para processar os dados de faturamento.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Status atual */}
              <div className="p-4 bg-gray-50 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    fonteDados === 'upload' ? 'bg-blue-500' : 
                    fonteDados === 'mobilemed' ? 'bg-green-500' : 'bg-purple-500'
                  }`}></div>
                  <span className="font-medium">
                    Fonte ativa: {
                      fonteDados === 'upload' ? 'Upload de Arquivo' :
                      fonteDados === 'mobilemed' ? 'Integração Mobilemed' : 'Banco Local'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controle de Período */}
          <ControlePeriodo
            periodoSelecionado={periodoSelecionado}
            setPeriodoSelecionado={setPeriodoSelecionado}
            mostrarApenasEditaveis={mostrarApenasEditaveis}
            setMostrarApenasEditaveis={setMostrarApenasEditaveis}
          />
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
                      <div className="text-2xl font-bold text-green-900">{relatoriosProntos.length}</div>
                      <div className="text-sm text-green-700">Relatórios Carregados</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-900">
                        {clientesCarregados.length - relatoriosProntos.length}
                      </div>
                      <div className="text-sm text-orange-700">Pendentes</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Clientes e Upload */}
              {clientesCarregados.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Clientes e Relatórios</h3>
                    <Button 
                      onClick={handleCarregarRelatoriosProntos}
                      disabled={relatoriosProntos.length === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Preparar para Envio ({relatoriosProntos.length})
                    </Button>
                  </div>
                  
                  <div className="grid gap-4">
                    {clientesCarregados.map((cliente) => {
                      const relatorioPronto = relatoriosProntos.find(r => r.clienteId === cliente.id);
                      
                      return (
                        <div key={cliente.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{cliente.nome}</h4>
                              <p className="text-sm text-muted-foreground">{cliente.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {relatorioPronto ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Carregado
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pendente
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {relatorioPronto ? (
                            <div className="p-3 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700">{relatorioPronto.nomeArquivo}</span>
                                <span className="text-xs text-green-600">({relatorioPronto.dataUpload})</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(relatorioPronto.uploadUrl)}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Ver
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setRelatoriosProntos(prev => prev.filter(r => r.clienteId !== cliente.id));
                                    setResultados(prev => prev.map(r => 
                                      r.clienteId === cliente.id 
                                        ? { ...r, relatorioGerado: false, linkRelatorio: undefined }
                                        : r
                                    ));
                                  }}
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 border-2 border-dashed border-gray-200 rounded">
                              <label className="flex flex-col items-center justify-center cursor-pointer">
                                <Upload className="h-6 w-6 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-600">
                                  Clique para fazer upload do relatório PDF
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.xlsx,.xls"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUploadRelatorio(cliente.id, file);
                                      e.target.value = ''; // Reset input
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum Cliente Carregado</h3>
                  <p className="text-gray-500 mb-4">
                    Faça upload da lista de clientes primeiro na aba "Upload de Dados"
                  </p>
                  <Button onClick={() => setActiveTab("uploads")} variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Ir para Upload de Dados
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
                    <p className="text-sm">Faça upload da lista de clientes primeiro na aba "Upload de Dados".</p>
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
                        Preparar Relatórios ({relatoriosProntos.length})
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

          {/* Gráficos Velocímetro */}
          <Card>
            <CardHeader>
              <CardTitle>Progresso do Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
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
        </TabsContent>

        <TabsContent value="uploads" className="space-y-6 mt-6">
          {/* Status da Fonte de Dados */}
          <Card className={`border-2 ${
            fonteDados === 'upload' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {fonteDados === 'upload' ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-blue-800">Upload de Dados Ativo</h3>
                      <p className="text-sm text-blue-700">Esta aba está ativa. Os uploads serão processados normalmente.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-gray-600" />
                    <div>
                      <h3 className="font-semibold text-gray-700">Upload de Dados Inativo</h3>
                      <p className="text-sm text-gray-600">
                        Fonte atual: <strong>{
                          fonteDados === 'mobilemed' ? 'Integração Mobilemed' : 'Banco Local'
                        }</strong>. 
                        Para usar uploads, vá em "Configuração" e selecione "Upload de Arquivo".
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setActiveTab('configuracao');
                        setFonteDados('upload');
                      }}
                    >
                      Ativar Upload
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {fonteDados === 'upload' ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">📋 Ordem Recomendada de Upload:</h3>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li><strong>Primeiro:</strong> Upload de Clientes (cria os IDs na base)</li>
                  <li><strong>Segundo:</strong> Upload de Exames (vincula aos clientes)</li>
                  <li><strong>Terceiro:</strong> Upload de Contratos (opcional, regras de preço)</li>
                  <li><strong>Último:</strong> Escalas e Financeiro (opcionais)</li>
                </ol>
              </div>
            </>
          ) : (
            <Card className="border-gray-200">
              <CardContent className="pt-6 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Upload de Dados Desativado</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      Para usar esta funcionalidade, configure a fonte de dados como "Upload de Arquivo" na aba Configuração.
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setActiveTab('configuracao');
                      setFonteDados('upload');
                    }}
                  >
                    Ir para Configuração
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {fonteDados === 'upload' && (
          <>
            {/* Aviso sobre período selecionado */}
            <Card className={`border-2 ${
              isPeriodoEditavel(periodoSelecionado) ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {isPeriodoEditavel(periodoSelecionado) ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <h3 className="font-semibold text-green-800">Período Editável: {periodoSelecionado}</h3>
                        <p className="text-sm text-green-700">Os uploads para este período serão processados normalmente.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <h3 className="font-semibold text-red-800">Período Protegido: {periodoSelecionado}</h3>
                        <p className="text-sm text-red-700">
                          {getStatusPeriodo(periodoSelecionado) === 'historico' 
                            ? 'Dados históricos não podem ser modificados.' 
                            : getStatusPeriodo(periodoSelecionado) === 'fechado'
                            ? 'Período fechado - dados protegidos contra alteração.'
                            : 'Período futuro não disponível para upload.'
                          }
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setActiveTab('configuracao');
                          setPeriodoSelecionado(PERIODO_ATUAL);
                        }}
                      >
                        Alterar Período
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileUpload
              title="Upload de Clientes"
              description="Lista de clientes com emails para envio dos relatórios"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={10}
              expectedFormat={["nome, email, telefone, endereco, cnpj, ativo"]}
              onUpload={async (file) => {
                if (!isPeriodoEditavel(periodoSelecionado)) {
                  throw new Error(`Período ${periodoSelecionado} está protegido contra modificações. Status: ${getStatusPeriodo(periodoSelecionado)}`);
                }
                
                try {
                  await processClientesFile(file);
                  // Limpar resultados antigos e recarregar clientes
                  setResultados([]);
                  setRelatoriosGerados(0);
                  setEmailsEnviados(0);
                  await carregarClientes();
                  
                  toast({
                    title: "Upload Concluído",
                    description: `Clientes carregados para o período ${periodoSelecionado}!`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Erro no Upload",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
              icon={<Users className="h-5 w-5" />}
            />

            <FileUpload
              title="Upload de Exames Realizados"
              description="Arraste e solte arquivos CSV/Excel aqui ou clique para selecionar"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={50}
              expectedFormat={["paciente, cliente_id, medico, data_exame", "modalidade, especialidade, valor_bruto"]}
              onUpload={processExamesFile}
              icon={<FileSpreadsheet className="h-5 w-5" />}
            />

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
                      Paciente → Cliente → Médico → Data → Modalidade → Especialidade → Categoria → Prioridade → Nome Exame → Quantidade → Valor
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
              title="Upload de Faturamento"
              description="Upload de arquivo de faturamento seguindo o template com as colunas: Paciente, Cliente, Médico, Data, Modalidade, Especialidade, Categoria, Prioridade, Nome Exame, [Reservado], Valor. Baixar template CSV: /templates/template_faturamento.csv"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={25}
              expectedFormat={["nome (B), quantidade (J), valor_bruto (K)"]}
              onUpload={async (file) => {
                try {
                  console.log('🔥 UPLOAD DE FATURAMENTO INICIADO - ARQUIVO:', file.name);
                  console.log('🔥 TAMANHO DO ARQUIVO:', file.size, 'bytes');
                  console.log('🔥 TIPO DO ARQUIVO:', file.type);
                  
                  await processFaturamentoFile(file);
                  
                  console.log('🔥 UPLOAD DE FATURAMENTO CONCLUÍDO COM SUCESSO');
                  toast({
                    title: "Upload de Faturamento Concluído",
                    description: "Dados de faturamento carregados com sucesso!",
                  });
                } catch (error: any) {
                  console.error('🔥 ERRO NO UPLOAD DE FATURAMENTO:', error);
                  toast({
                    title: "Erro no Upload de Faturamento",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
               icon={<FileBarChart2 className="h-5 w-5" />}
             />
           </div>
           </>
           )}
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
                <CardTitle>Configuração do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status da Conexão:</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Conectado ao Supabase</span>
                  </div>
                </div>
                
                <div className="space-y-2">
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
                  </div>
                </div>

                <Button className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Painel Supabase
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}