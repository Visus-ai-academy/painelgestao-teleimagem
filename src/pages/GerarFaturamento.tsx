
import { useState, useEffect } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  Lock
} from "lucide-react";
import { useFaturamento } from "@/hooks/useFaturamento";
import { CalculoFaturamento } from "@/types/faturamento";
import { useToast } from "@/hooks/use-toast";

const clientes = [
  { id: "1", nome: "Hospital São Lucas" },
  { id: "2", nome: "Clínica Vida Plena" },
  { id: "3", nome: "Centro Médico Norte" },
];

export default function GerarFaturamento() {
  const [faturamentoPeriodo, setFaturamentoPeriodo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [calculoAtual, setCalculoAtual] = useState<CalculoFaturamento | null>(null);
  
  const { 
    periodos, 
    processarFaturamento, 
    gerarFatura, 
    podeSerFaturado,
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
    if (!calculoAtual || !dataVencimento) {
      toast({
        title: "Dados Incompletos",
        description: "Selecione um período/cliente e defina a data de vencimento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const fatura = await gerarFatura(calculoAtual, dataVencimento, observacoes);
      
      toast({
        title: "Fatura Gerada",
        description: `Fatura ${fatura.numero} gerada com sucesso!`,
      });

      // Limpar formulário
      setFaturamentoPeriodo("");
      setClienteSelecionado("");
      setDataVencimento("");
      setObservacoes("");
      setCalculoAtual(null);
      
    } catch (error) {
      toast({
        title: "Erro ao Gerar Fatura",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
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

      <FilterBar />

      {/* Resumo de Pendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <Select value={faturamentoPeriodo} onValueChange={setFaturamentoPeriodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((periodo) => (
                    <SelectItem 
                      key={periodo.id} 
                      value={periodo.periodo}
                      disabled={periodo.bloqueado}
                    >
                      <div className="flex items-center gap-2">
                        {periodo.bloqueado && <Lock className="h-3 w-3" />}
                        {periodo.periodo} 
                        {periodo.bloqueado && <Badge variant="secondary" className="text-xs">Faturado</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2">
              <Label htmlFor="vencimento">Data de Vencimento</Label>
              <Input 
                type="date" 
                id="vencimento" 
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input 
                id="observacoes" 
                placeholder="Observações adicionais para a fatura"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
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

            <div className="flex gap-2">
              <Button 
                onClick={handleGerarFaturamento} 
                className="flex-1"
                disabled={!calculoAtual || !dataVencimento || loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                {loading ? "Processando..." : "Gerar Fatura"}
              </Button>
              <Button variant="outline" disabled={!calculoAtual}>
                <Download className="h-4 w-4 mr-2" />
                Preview
              </Button>
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

      {/* Histórico de Faturas Geradas */}
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
    </div>
  );
}
