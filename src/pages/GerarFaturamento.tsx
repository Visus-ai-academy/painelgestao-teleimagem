
import { useState, useEffect } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Send, 
  Calendar,
  DollarSign,
  Users,
  Calculator,
  CheckCircle,
  AlertTriangle,
  Lock,
  Play,
  Clock,
  Mail,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  ExternalLink,
  Upload,
  Database,
  FileSpreadsheet,
  Settings,
  CloudUpload
} from "lucide-react";
import { useFaturamento } from "@/hooks/useFaturamento";
import { FileUpload } from "@/components/FileUpload";
import { processExamesFile, processContratosFile, processEscalasFile, processFinanceiroFile } from "@/lib/supabase";
import { CalculoFaturamento } from "@/types/faturamento";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const clientes = [
  { id: "todos", nome: "Todos" },
  { id: "1", nome: "Hospital São Lucas" },
  { id: "2", nome: "Clínica Vida Plena" },
  { id: "3", nome: "Centro Médico Norte" },
];

export default function GerarFaturamento() {
  // Período atual automático (julho/2025)
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const [faturamentoPeriodo, setFaturamentoPeriodo] = useState(currentMonth);
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [calculoAtual, setCalculoAtual] = useState<CalculoFaturamento | null>(null);
  const [activeTab, setActiveTab] = useState("faturamento");
  
  const { 
    periodos, 
    processarFaturamento, 
    gerarFatura, 
    gerarFaturaCompleta,
    podeSerFaturado,
    processos,
    logs,
    limparProcessos,
    cancelarProcesso,
    reenviarEmail,
    loading 
  } = useFaturamento();
  
  const { toast } = useToast();

  // Processar faturamento quando cliente e período forem selecionados
  useEffect(() => {
    if (clienteSelecionado && faturamentoPeriodo) {
      handleProcessarFaturamento();
    }
  }, [clienteSelecionado, faturamentoPeriodo]);

  const handleProcessarFaturamento = async () => {
    if (!clienteSelecionado || !faturamentoPeriodo) return;

    // Verificar se período pode ser faturado
    if (!podeSerFaturado(faturamentoPeriodo)) {
      toast({
        title: "Período Bloqueado",
        description: "Este período já foi faturado e está bloqueado para novo faturamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const calculo = await processarFaturamento(clienteSelecionado, faturamentoPeriodo);
      setCalculoAtual(calculo);
      
      if (calculo.resumo.totalExames === 0) {
        toast({
          title: "Nenhum Exame Encontrado",
          description: "Não foram encontrados exames para faturar neste período.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao Processar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const handleGerarFaturamento = async () => {
    if (!calculoAtual) {
      toast({
        title: "Dados Incompletos",
        description: "Selecione um período/cliente.",
        variant: "destructive"
      });
      return;
    }

    try {
      const fatura = await gerarFatura(calculoAtual, "", "");
      
      toast({
        title: "Fatura Calculada",
        description: `Fatura ${fatura.numero} calculada internamente!`,
      });
      
    } catch (error) {
      toast({
        title: "Erro ao Calcular Fatura",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const handleGerarRelatorio = async () => {
    if (!clienteSelecionado || !faturamentoPeriodo) {
      toast({
        title: "Erro",
        description: "Selecione um cliente e período",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calcular datas do período
      const ano = parseInt(faturamentoPeriodo.substring(0, 4));
      const mes = parseInt(faturamentoPeriodo.substring(5, 7));
      const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
      const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

      const response = await supabase.functions.invoke('gerar-relatorio-faturamento', {
        body: {
          cliente_id: clienteSelecionado,
          periodo: faturamentoPeriodo,
          data_inicio: dataInicio,
          data_fim: dataFim
        }
      });

      if (response.error) {
        throw response.error;
      }

      const { relatorio } = response.data;
      setCalculoAtual(relatorio);

      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${relatorio.resumo.total_laudos} exames`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar relatório",
        variant: "destructive",
      });
    }
  };

  const handleEnviarEmail = async () => {
    if (!calculoAtual || !clienteSelecionado) {
      toast({
        title: "Erro", 
        description: "Você precisa gerar o relatório primeiro",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await supabase.functions.invoke('enviar-relatorio-email', {
        body: {
          cliente_id: clienteSelecionado,
          relatorio: calculoAtual
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Sucesso",
        description: `Email enviado com sucesso`,
      });
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar email",
        variant: "destructive",
      });
    }
  };

  const clienteNome = clientes.find(c => c.id === clienteSelecionado)?.nome || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerar Faturamento</h1>
        <p className="text-gray-600 mt-1">Geração e emissão de faturas baseadas nos contratos dos clientes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
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

      {/* Resumo Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 461.000</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exames Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.254</div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              Com pendências de faturamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturas Geradas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87</div>
            <p className="text-xs text-muted-foreground">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {processos.filter(p => p.statusRelatorio === "gerando" || p.statusEmail === "enviando").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Em andamento agora
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuração e Processamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Configurar Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="periodo">Período de Faturamento</Label>
              <div className="p-3 bg-muted rounded-md">
                <span className="font-medium">{faturamentoPeriodo}</span>
                <p className="text-sm text-muted-foreground">Período atual</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {calculoAtual && (
              <>
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Exames Encontrados:</span>
                    <span className="font-medium">{calculoAtual.resumo.totalExames}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {calculoAtual.resumo.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Valor Total:</span>
                    <span className="text-green-600">
                      R$ {calculoAtual.resumo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button 
                onClick={handleGerarFaturamento} 
                variant="outline"
                className="flex-1"
                disabled={!calculoAtual || loading}
              >
                <Calculator className="h-4 w-4 mr-2" />
                {loading ? "Calculando..." : "Calcular Fatura"}
              </Button>
              <Button variant="outline" disabled={!calculoAtual}>
                <Download className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={handleGerarRelatorio}
                className="w-full"
                disabled={!clienteSelecionado || !faturamentoPeriodo || loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              
              <Button 
                onClick={handleEnviarEmail}
                variant="outline"
                className="w-full"
                disabled={!calculoAtual || loading}
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Enviando..." : "Enviar por Email"}
              </Button>
            </div>
              <p className="text-xs text-muted-foreground text-center">
                Gera PDF e envia automaticamente por email
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detalhamento dos Exames */}
        <Card>
          <CardHeader>
            <CardTitle>
              {calculoAtual ? `Exames - ${clienteNome} (${faturamentoPeriodo})` : "Detalhamento dos Exames"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calculoAtual ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {calculoAtual.items.map((item) => {
                  const exame = calculoAtual.exames.find(e => e.id === item.exameId);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{exame?.paciente}</p>
                        <p className="text-sm text-gray-600">
                          {item.modalidade} - {item.especialidade} ({item.categoria})
                        </p>
                        <p className="text-xs text-gray-500">
                          {exame?.dataExame} | {item.prioridade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">R$ {item.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  );
                })}
                
                {calculoAtual.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum exame encontrado para este período</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p>Selecione um cliente e período para ver os exames</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status dos Processos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status dos Processos
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={limparProcessos}
                  disabled={processos.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {processos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhum processo em andamento</p>
                </div>
              ) : (
                processos.map((processo) => (
                  <div key={processo.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{processo.clienteNome}</p>
                        <p className="text-sm text-muted-foreground">Período: {processo.periodo}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(processo.dataInicio).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">Relatório PDF</span>
                        </div>
                        <Badge 
                          variant={
                            processo.statusRelatorio === "gerado" ? "default" :
                            processo.statusRelatorio === "gerando" ? "secondary" :
                            processo.statusRelatorio === "erro" ? "destructive" : "outline"
                          }
                          className="text-xs"
                        >
                          {processo.statusRelatorio === "pendente" ? "Pendente" :
                           processo.statusRelatorio === "gerando" ? "Gerando..." :
                           processo.statusRelatorio === "gerado" ? "Gerado" : "Erro"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span className="text-sm">Email</span>
                        </div>
                        <Badge 
                          variant={
                            processo.statusEmail === "enviado" ? "default" :
                            processo.statusEmail === "enviando" ? "secondary" :
                            processo.statusEmail === "erro" ? "destructive" : "outline"
                          }
                          className="text-xs"
                        >
                          {processo.statusEmail === "pendente" ? "Pendente" :
                           processo.statusEmail === "enviando" ? "Enviando..." :
                           processo.statusEmail === "enviado" ? "Enviado" : "Erro"}
                        </Badge>
                      </div>
                    </div>
                    
                    {processo.arquivoPdf && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          📄 {processo.arquivoPdf}
                        </p>
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    )}
                    
                    {processo.emailDestinatario && processo.statusEmail !== "pendente" && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          📧 {processo.emailDestinatario}
                        </p>
                        <div className="flex gap-1">
                          {processo.statusEmail === "erro" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => reenviarEmail(processo.id)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Reenviar
                            </Button>
                          )}
                          {(processo.statusRelatorio === "gerando" || processo.statusEmail === "enviando") && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => cancelarProcesso(processo.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Log de Operações
              </div>
              <Badge variant="outline">
                {logs.length} registros
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhuma operação registrada</p>
                </div>
              ) : (
                logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-2 text-sm border-l-2 border-l-primary">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.mensagem}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      {log.detalhes && (
                        <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                          <details>
                            <summary className="cursor-pointer">Detalhes</summary>
                            <pre className="mt-1 text-xs">
                              {JSON.stringify(log.detalhes, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Badge 
                          variant={
                            log.tipo === "erro" ? "destructive" :
                            log.tipo === "email" ? "secondary" : "outline"
                          }
                          className="text-xs"
                        >
                          {log.tipo}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {logs.length > 20 && (
                <div className="text-center py-2 border-t">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    Ver todos ({logs.length})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Faturas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Faturas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Período</th>
                  <th className="text-left p-3">Data Emissão</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">#2024001</td>
                  <td className="p-3">Hospital São Lucas</td>
                  <td className="p-3">2023-12</td>
                  <td className="p-3">15/01/2024</td>
                  <td className="p-3">15/02/2024</td>
                  <td className="p-3 text-right">R$ 125.000</td>
                  <td className="p-3">
                    <Badge className="bg-green-100 text-green-800">
                      Pago
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm">
                        <Send className="h-3 w-3 mr-1" />
                        Enviar
                      </Button>
                    </div>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">#2024002</td>
                  <td className="p-3">Clínica Vida Plena</td>
                  <td className="p-3">2023-12</td>
                  <td className="p-3">16/01/2024</td>
                  <td className="p-3">16/02/2024</td>
                  <td className="p-3 text-right">R$ 85.000</td>
                  <td className="p-3">
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Pendente
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm">
                        <Send className="h-3 w-3 mr-1" />
                        Enviar
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="uploads" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileUpload
              title="Upload de Exames Realizados"
              description="Arraste e solte arquivos CSV/Excel aqui ou clique para selecionar"
              acceptedTypes={['.csv', '.xlsx', '.xls']}
              maxSizeInMB={50}
              expectedFormat={["ID do Exame, Paciente, Cliente, Médico, Data", "Modalidade, Especialidade, Status"]}
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

          {/* Status dos Uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">exames_janeiro_2024.xlsx</p>
                      <p className="text-sm text-muted-foreground">Upload em 15/01/2024 às 14:30</p>
                    </div>
                  </div>
                  <Badge variant="default">Processado</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">contratos_2024.csv</p>
                      <p className="text-sm text-muted-foreground">Upload em 10/01/2024 às 09:15</p>
                    </div>
                  </div>
                  <Badge variant="default">Processado</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">escalas_janeiro.xlsx</p>
                      <p className="text-sm text-muted-foreground">Upload em 05/01/2024 às 16:45</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Processando...</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
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
                      <p className="text-sm text-muted-foreground">15.430 registros</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">contratos_clientes</p>
                      <p className="text-sm text-muted-foreground">1.245 regras</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">escalas_medicas</p>
                      <p className="text-sm text-muted-foreground">3.890 turnos</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">faturas_geradas</p>
                      <p className="text-sm text-muted-foreground">287 faturas</p>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sincronização de Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Última sincronização:</span>
                  <span className="text-sm font-medium">Hoje às 14:30</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Próxima sincronização:</span>
                  <span className="text-sm font-medium">Hoje às 18:00</span>
                </div>
                <Separator />
                <Button className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Agora
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Backup
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Queries e Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics da Base de Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">15.4K</div>
                  <div className="text-sm text-muted-foreground">Exames Total</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">1.2K</div>
                  <div className="text-sm text-muted-foreground">Regras Ativas</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">3.9K</div>
                  <div className="text-sm text-muted-foreground">Escalas</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">287</div>
                  <div className="text-sm text-muted-foreground">Faturas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração Supabase</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status da Conexão:</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Conectado</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Edge Functions:</Label>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>gerar-fatura</span>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>processar-upload</span>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>enviar-email</span>
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

            <Card>
              <CardHeader>
                <CardTitle>Configuração de Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-server">Servidor SMTP</Label>
                  <Input id="smtp-server" value="smtp.gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Porta</Label>
                  <Input id="smtp-port" value="587" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-from">Email Remetente</Label>
                  <Input id="email-from" value="faturamento@suaempresa.com" />
                </div>
                <Button variant="outline" className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Testar Configuração
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Templates de Email */}
          <Card>
            <CardHeader>
              <CardTitle>Templates de Email</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-template">Template de Fatura</Label>
                  <Textarea 
                    id="email-template"
                    rows={6}
                    value="Prezado(a) {CLIENTE_NOME},\n\nSegue em anexo a fatura referente ao período {PERIODO}.\n\nValor Total: {VALOR_TOTAL}\nData de Vencimento: {DATA_VENCIMENTO}\n\nAtenciosamente,\nEquipe de Faturamento"
                  />
                </div>
                <Button>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Salvar Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
