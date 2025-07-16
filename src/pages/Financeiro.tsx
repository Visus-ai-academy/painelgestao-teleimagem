
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, PiggyBank } from "lucide-react";
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const revenueData = [
  { month: "Jan", faturamento: 2100000, custos: 1500000, lucro: 600000 },
  { month: "Fev", faturamento: 2300000, custos: 1600000, lucro: 700000 },
  { month: "Mar", faturamento: 2000000, custos: 1550000, lucro: 450000 },
  { month: "Abr", faturamento: 2500000, custos: 1700000, lucro: 800000 },
  { month: "Mai", faturamento: 2400000, custos: 1650000, lucro: 750000 },
  { month: "Jun", faturamento: 2600000, custos: 1750000, lucro: 850000 },
];

const cashFlowData = [
  { day: "1", entrada: 95000, saida: 75000, saldo: 20000 },
  { day: "5", entrada: 120000, saida: 85000, saldo: 35000 },
  { day: "10", entrada: 110000, saida: 95000, saldo: 15000 },
  { day: "15", entrada: 140000, saida: 105000, saldo: 35000 },
  { day: "20", entrada: 115000, saida: 90000, saldo: 25000 },
  { day: "25", entrada: 135000, saida: 100000, saldo: 35000 },
  { day: "30", entrada: 125000, saida: 88000, saldo: 37000 },
];

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
          value="R$ 2.6M"
          change="+8.3% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
        />
        <MetricCard
          title="Margem Líquida"
          value="32.7%"
          change="+2.1% vs mês anterior"
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="Recebimentos"
          value="R$ 2.2M"
          change="84.6% do faturamento"
          changeType="neutral"
          icon={CreditCard}
        />
        <MetricCard
          title="Caixa Disponível"
          value="R$ 1.8M"
          change="+5% vs mês anterior"
          changeType="positive"
          icon={PiggyBank}
        />
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Receitas</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Exames Diagnósticos</span>
                  <span className="font-medium">R$ 1.800.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Consultas Médicas</span>
                  <span className="font-medium">R$ 650.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Convênios</span>
                  <span className="font-medium">R$ 150.000</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Receitas</span>
                  <span>R$ 2.600.000</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Despesas</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Salários e Encargos</span>
                  <span className="font-medium">R$ 950.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Materiais e Insumos</span>
                  <span className="font-medium">R$ 380.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Infraestrutura</span>
                  <span className="font-medium">R$ 220.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Outras Despesas</span>
                  <span className="font-medium">R$ 200.000</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Despesas</span>
                  <span>R$ 1.750.000</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Lucro Bruto</p>
                <p className="text-2xl font-bold text-green-600">R$ 850.000</p>
                <p className="text-sm text-green-600">32.7% margem</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">EBITDA</p>
                <p className="text-2xl font-bold text-blue-600">R$ 920.000</p>
                <p className="text-sm text-blue-600">35.4% margem</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Lucro Líquido</p>
                <p className="text-2xl font-bold text-purple-600">R$ 650.000</p>
                <p className="text-sm text-purple-600">25.0% margem</p>
              </div>
            </div>
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
                <tr className="border-b">
                  <td className="p-3">Dr. Silva</td>
                  <td className="p-3">Cardiologia</td>
                  <td className="p-3 text-right">45</td>
                  <td className="p-3 text-right">R$ 180</td>
                  <td className="p-3 text-right">R$ 8.100</td>
                  <td className="p-3 text-right">R$ 2.025</td>
                  <td className="p-3 text-right font-medium">R$ 6.075</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">Dra. Santos</td>
                  <td className="p-3">Radiologia</td>
                  <td className="p-3 text-right">62</td>
                  <td className="p-3 text-right">R$ 220</td>
                  <td className="p-3 text-right">R$ 13.640</td>
                  <td className="p-3 text-right">R$ 3.410</td>
                  <td className="p-3 text-right font-medium">R$ 10.230</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">Dr. Costa</td>
                  <td className="p-3">Neurologia</td>
                  <td className="p-3 text-right">38</td>
                  <td className="p-3 text-right">R$ 250</td>
                  <td className="p-3 text-right">R$ 9.500</td>
                  <td className="p-3 text-right">R$ 2.375</td>
                  <td className="p-3 text-right font-medium">R$ 7.125</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
