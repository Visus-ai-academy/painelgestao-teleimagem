import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ExternalLink
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { Speedometer } from "@/components/Speedometer";
import { processExamesFile, processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

// ❌ REMOVIDO: Lista de clientes fictícios
// Agora usa APENAS clientes reais carregados via upload

// Período atual (julho/2025)
const PERIODO_ATUAL = "2025-07";

export default function GerarFaturamento() {
  const [activeTab, setActiveTab] = useState("faturamento");
  const [relatoriosGerados, setRelatoriosGerados] = useState(0);
  const [emailsEnviados, setEmailsEnviados] = useState(0);
  const [processandoTodos, setProcessandoTodos] = useState(false);
  const [clientesCarregados, setClientesCarregados] = useState<Array<{
    id: string;
    nome: string;
    email: string;
  }>>([]);
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

  const criarClientesTeste = async () => {
    try {
      const clientesTeste = [
        { nome: 'IMAX', email: 'adm@medforlife.com.br' },
        { nome: 'MRI', email: 'administracao@teleimagem.com.br' },
        { nome: 'PARANAVAI', email: 'financeiro@dustestudio.com.br' }
      ];

      const { error } = await supabase
        .from('clientes')
        .insert(clientesTeste.map(cliente => ({
          nome: cliente.nome,
          email: cliente.email,
          ativo: true
        })));

      if (error) throw error;

      toast({
        title: "Clientes criados",
        description: `${clientesTeste.length} clientes de teste criados com sucesso`,
      });

      await carregarClientes();
    } catch (error: any) {
      toast({
        title: "Erro ao criar clientes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Carregar clientes apenas na inicialização
  useEffect(() => {
    carregarClientes();
  }, []);

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
          // Calcular datas do período
          const ano = parseInt(PERIODO_ATUAL.substring(0, 4));
          const mes = parseInt(PERIODO_ATUAL.substring(5, 7));
          const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
          const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

          // Gerar relatório
          const responseRelatorio = await supabase.functions.invoke('gerar-relatorio-faturamento', {
            body: {
              cliente_id: cliente.id,
              periodo: PERIODO_ATUAL,
              data_inicio: dataInicio,
              data_fim: dataFim,
              formato: 'pdf'
            }
          });

          if (responseRelatorio.error) {
            throw new Error(`Erro ao gerar relatório: ${responseRelatorio.error.message}`);
          }

          // Marcar relatório como gerado
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
                    total_laudos: responseRelatorio.data?.relatorio?.resumo?.total_laudos || 0,
                    valor_total: responseRelatorio.data?.relatorio?.resumo?.valor_total || 0
                  },
                  relatorioData: responseRelatorio.data.relatorio // Salvar dados do relatório para envio posterior
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
          description: "Gere os relatórios primeiro antes de enviar os emails.",
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

          const responseEmail = await supabase.functions.invoke('enviar-relatorio-email', {
            body: {
              cliente_id: cliente.clienteId,
              relatorio: cliente.relatorioData
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Faturamento
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
                    onClick={handleGerarTodosRelatorios}
                    disabled={processandoTodos || clientesCarregados.length === 0}
                    size="lg"
                    className="min-w-[180px]"
                  >
                    {processandoTodos ? (
                      <>
                        <Clock className="h-5 w-5 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        Gerar Relatórios
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
                    onClick={handleProcessarTodosClientes}
                    disabled={processandoTodos || clientesCarregados.length === 0}
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
                  
                  {clientesCarregados.length === 0 && (
                    <Button 
                      variant="outline"
                      onClick={criarClientesTeste}
                      disabled={processandoTodos}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Criar Clientes Teste
                    </Button>
                  )}
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Ordem Recomendada de Upload:</h3>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li><strong>Primeiro:</strong> Upload de Clientes (cria os IDs na base)</li>
              <li><strong>Segundo:</strong> Upload de Exames (vincula aos clientes)</li>
              <li><strong>Terceiro:</strong> Upload de Contratos (opcional, regras de preço)</li>
              <li><strong>Último:</strong> Escalas e Financeiro (opcionais)</li>
            </ol>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileUpload
              title="Upload de Clientes"
              description="Lista de clientes com emails para envio dos relatórios"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={10}
              expectedFormat={["nome, email, telefone, endereco, cnpj, ativo"]}
              onUpload={async (file) => {
                try {
                  await processClientesFile(file);
                  // Limpar resultados antigos e recarregar clientes
                  setResultados([]);
                  setRelatoriosGerados(0);
                  setEmailsEnviados(0);
                  await carregarClientes();
                  
                  toast({
                    title: "Upload Concluído",
                    description: "Clientes carregados com sucesso! Agora você pode gerar relatórios.",
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