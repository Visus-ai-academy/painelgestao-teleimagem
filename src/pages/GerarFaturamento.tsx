
import { useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  CheckCircle
} from "lucide-react";

export default function GerarFaturamento() {
  const [faturamentoPeriodo, setFaturamentoPeriodo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [valorTotal, setValorTotal] = useState(0);

  const clientes = [
    { id: "1", nome: "Hospital São Lucas", valorPendente: 125000 },
    { id: "2", nome: "Clínica Central", valorPendente: 85000 },
    { id: "3", nome: "Medical Center", valorPendente: 95000 },
    { id: "4", nome: "Hospital Regional", valorPendente: 156000 },
  ];

  const examsPendentes = [
    { id: "1", paciente: "João Silva", exame: "Ressonância Magnética", valor: 850, data: "2024-01-15" },
    { id: "2", paciente: "Maria Santos", exame: "Tomografia", valor: 650, data: "2024-01-15" },
    { id: "3", paciente: "Pedro Costa", exame: "Ultrassom", valor: 280, data: "2024-01-16" },
    { id: "4", paciente: "Ana Oliveira", exame: "Raio-X", valor: 120, data: "2024-01-16" },
  ];

  const handleGerarFaturamento = () => {
    // Lógica para gerar faturamento
    console.log("Gerando faturamento...");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerar Faturamento</h1>
        <p className="text-gray-600 mt-1">Geração e emissão de faturas para clientes</p>
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

      {/* Formulário de Geração */}
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
                  <SelectItem value="janeiro-2024">Janeiro 2024</SelectItem>
                  <SelectItem value="fevereiro-2024">Fevereiro 2024</SelectItem>
                  <SelectItem value="marco-2024">Março 2024</SelectItem>
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
                      {cliente.nome} - R$ {cliente.valorPendente.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento">Data de Vencimento</Label>
              <Input type="date" id="vencimento" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input 
                id="observacoes" 
                placeholder="Observações adicionais para a fatura"
              />
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Valor Total:</span>
              <span className="text-2xl font-bold text-green-600">
                R$ {valorTotal.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGerarFaturamento} className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Fatura
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Exames Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle>Exames Pendentes de Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {examsPendentes.map((exame) => (
                <div key={exame.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{exame.paciente}</p>
                    <p className="text-sm text-gray-600">{exame.exame}</p>
                    <p className="text-xs text-gray-500">{exame.data}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {exame.valor}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />
            
            <div className="flex justify-between font-semibold">
              <span>Total Selecionado:</span>
              <span>R$ 1.900</span>
            </div>
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
                  <td className="p-3">15/01/2024</td>
                  <td className="p-3">15/02/2024</td>
                  <td className="p-3 text-right">R$ 125.000</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Pago
                    </span>
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
                  <td className="p-3">Clínica Central</td>
                  <td className="p-3">16/01/2024</td>
                  <td className="p-3">16/02/2024</td>
                  <td className="p-3 text-right">R$ 85.000</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                      Pendente
                    </span>
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
