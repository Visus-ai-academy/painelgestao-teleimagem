import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { Speedometer } from "@/components/Speedometer";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, PiggyBank } from "lucide-react";
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const revenueData: any[] = [];

const cashFlowData: any[] = [];

export default function Financeiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-gray-600 mt-1">Gestão financeira e análise de resultados</p>
      </div>

      <FilterBar />

      {/* Métricas Financeiras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Faturamento Mensal"
          value="—"
          change="Aguardando dados"
          changeType="neutral"
          icon={DollarSign}
        />
        <MetricCard
          title="Margem Líquida"
          value="—"
          change="Aguardando dados"
          changeType="neutral"
          icon={TrendingUp}
        />
        <MetricCard
          title="Recebimentos"
          value="—"
          change="Aguardando dados"
          changeType="neutral"
          icon={CreditCard}
        />
        <MetricCard
          title="Caixa Disponível"
          value="—"
          change="Aguardando dados"
          changeType="neutral"
          icon={PiggyBank}
        />
      </div>

      {/* Velocímetros Financeiros */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores Financeiros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Speedometer
              value={32.7}
              max={40}
              label="Margem Líquida"
              unit="%"
            />
            <Speedometer
              value={84.6}
              max={100}
              label="Taxa de Recebimento"
              unit="%"
            />
            <Speedometer
              value={68}
              max={100}
              label="Eficiência de Custos"
              unit="%"
            />
            <Speedometer
              value={92}
              max={100}
              label="Meta Faturamento"
              unit="%"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sinaleiros Financeiros */}
      <Card>
        <CardHeader>
          <CardTitle>Status Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusIndicator
              status="pendente"
              label="Fluxo de Caixa"
              value="—"
              description="Sem dados"
            />
            <StatusIndicator
              status="pendente"
              label="Inadimplência"
              value="—"
              description="Sem dados"
            />
            <StatusIndicator
              status="pendente"
              label="Contas a Pagar"
              value="—"
              description="Sem dados"
            />
            <StatusIndicator
              status="pendente"
              label="ROI"
              value="—"
              description="Sem dados"
            />
          </div>
        </CardContent>
      </Card>

      {/* Gráficos Financeiros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento vs Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${(Number(value) / 1000000).toFixed(1)}M`} />
                <Legend />
                <Bar dataKey="faturamento" fill="#3b82f6" name="Faturamento" />
                <Bar dataKey="custos" fill="#ef4444" name="Custos" />
                <Bar dataKey="lucro" fill="#10b981" name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Caixa Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="entrada" stroke="#10b981" name="Entradas" />
                <Line type="monotone" dataKey="saida" stroke="#ef4444" name="Saídas" />
                <Line type="monotone" dataKey="saldo" stroke="#3b82f6" name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* DRE Simplificado */}
      <Card>
        <CardHeader>
          <CardTitle>DRE - Demonstrativo do Resultado do Exercício</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Sem dados para DRE no momento. Os valores serão exibidos após o processamento financeiro real.
          </div>
        </CardContent>
      </Card>

      {/* Pagamentos Médicos */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Médicos - Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Médico</th>
                  <th className="text-left p-3">Especialidade</th>
                  <th className="text-right p-3">Exames</th>
                  <th className="text-right p-3">Valor/Exame</th>
                  <th className="text-right p-3">Total Bruto</th>
                  <th className="text-right p-3">Descontos</th>
                  <th className="text-right p-3">Total Líquido</th>
                </tr>
              </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      Sem dados de pagamentos médicos neste resumo. Utilize a página Pagamento Médico para calcular e visualizar.
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
