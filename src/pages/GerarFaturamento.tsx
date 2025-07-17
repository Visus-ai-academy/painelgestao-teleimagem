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
import { processExamesFile, processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const clientes = [
  { id: "550e8400-e29b-41d4-a716-446655440001", nome: "Hospital São Lucas", email: "contato@saolucas.com.br" },
  { id: "550e8400-e29b-41d4-a716-446655440002", nome: "Clínica Vida Plena", email: "admin@vidaplena.com.br" },
  { id: "550e8400-e29b-41d4-a716-446655440003", nome: "Centro Médico Norte", email: "faturamento@centronorte.com.br" },
];

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
    erro?: string;
    dataProcessamento?: string;
  }>>([]);
  
  const { toast } = useToast();

  // Carregar clientes da base de dados
  const carregarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email')
        .eq('ativo', true)
        .not('email', 'is', null);

      if (error) throw error;

      const clientesComEmail = data?.filter(cliente => cliente.email && cliente.email.trim() !== '') || [];
      
      // Se não há clientes na base, usar os hardcoded como fallback
      const clientesFinais = clientesComEmail.length > 0 ? clientesComEmail : clientes;
      
      setClientesCarregados(clientesFinais);
      
      // Inicializar resultados se ainda não foram inicializados
      if (resultados.length === 0) {
        setResultados(clientesFinais.map(cliente => ({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          relatorioGerado: false,
          emailEnviado: false,
          emailDestino: cliente.email,
        })));
      }
      
      return clientesFinais;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast({
        title: "Aviso",
        description: "Usando lista de clientes padrão. Faça upload dos clientes para usar dados reais.",
        variant: "default",
      });
      
      // Fallback para clientes hardcoded
      setClientesCarregados(clientes);
      if (resultados.length === 0) {
        setResultados(clientes.map(cliente => ({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          relatorioGerado: false,
          emailEnviado: false,
          emailDestino: cliente.email,
        })));
      }
      return clientes;
    }
  };

  // Carregar clientes na inicialização
  useEffect(() => {
    carregarClientes();
  }, []);

  const handleProcessarTodosClientes = async () => {
    setProcessandoTodos(true);
    let relatoriosCount = 0;
    let emailsCount = 0;

    try {
      // Garantir que temos clientes carregados
      const clientesParaProcessar = clientesCarregados.length > 0 ? clientesCarregados : await carregarClientes();
      
      // Se a lista de resultados estiver vazia, inicializar com os clientes carregados
      if (resultados.length === 0) {
        const novosResultados = clientesParaProcessar.map(cliente => ({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          relatorioGerado: false,
          emailEnviado: false,
          emailDestino: cliente.email,
        }));
        setResultados(novosResultados);
      }

      // Processar cada cliente
      for (const cliente of clientesParaProcessar) {
        try {
          // Atualizar estado para mostrar progresso
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { ...r, erro: undefined }
              : r
          ));

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
              data_fim: dataFim
            }
          });

          if (responseRelatorio.error) {
            throw new Error(`Erro ao gerar relatório: ${responseRelatorio.error.message}`);
          }

          // Marcar relatório como gerado E atualizar contador em tempo real
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { ...r, relatorioGerado: true, dataProcessamento: new Date().toLocaleString('pt-BR') }
              : r
          ));
          relatoriosCount++;
          setRelatoriosGerados(relatoriosCount); // ✅ Atualizar em tempo real

          // Enviar email
          const responseEmail = await supabase.functions.invoke('enviar-relatorio-email', {
            body: {
              cliente_id: cliente.id,
              relatorio: responseRelatorio.data.relatorio
            }
          });

          if (responseEmail.error) {
            throw new Error(`Erro ao enviar email: ${responseEmail.error.message}`);
          }

          // Marcar email como enviado E atualizar contador em tempo real
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { ...r, emailEnviado: true }
              : r
          ));
          emailsCount++;
          setEmailsEnviados(emailsCount); // ✅ Atualizar em tempo real

        } catch (error: any) {
          console.error(`Erro ao processar cliente ${cliente.nome}:`, error);
          
          // Marcar erro para este cliente
          setResultados(prev => prev.map(r => 
            r.clienteId === cliente.id 
              ? { ...r, erro: error.message }
              : r
          ));
        }
      }

      toast({
        title: "Processamento Concluído",
        description: `${relatoriosCount} relatórios gerados, ${emailsCount} emails enviados`,
      });

    } catch (error: any) {
      console.error("Erro geral:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro durante o processamento",
        variant: "destructive",
      });
    } finally {
      setProcessandoTodos(false);
    }
  };

  const limparResultados = () => {
    // ✅ Limpar completamente a lista (deixar vazia)
    setResultados([]);
    setRelatoriosGerados(0);
    setEmailsEnviados(0);
    
    console.log("Lista limpa completamente"); // Debug
    
    toast({
      title: "Lista Limpa",
      description: "A lista de clientes foi limpa completamente",
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
          {/* Botão Principal no Topo */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Processar Faturamento - {PERIODO_ATUAL}</h2>
                  <p className="text-muted-foreground">Gera relatórios e envia por email para todos os clientes</p>
                </div>
                
                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={handleProcessarTodosClientes}
                    disabled={processandoTodos}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {processandoTodos ? (
                      <>
                        <Clock className="h-5 w-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Gerar e Enviar Tudo
                      </>
                    )}
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
                  de {clientesCarregados.length || clientes.length} clientes
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
                      <th className="text-center p-3">Relatório Gerado</th>
                      <th className="text-left p-3">E-mail Enviado Para</th>
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
              
              {/* Mostrar erros se houver */}
              {resultados.some(r => r.erro) && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-red-600">Erros Encontrados:</h4>
                  {resultados.filter(r => r.erro).map(resultado => (
                    <div key={resultado.clienteId} className="text-sm p-3 bg-red-50 border border-red-200 rounded">
                      <span className="font-medium">{resultado.clienteNome}:</span> {resultado.erro}
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
              onUpload={processClientesFile}
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