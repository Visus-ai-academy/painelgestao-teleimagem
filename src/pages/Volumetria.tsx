
import { useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Activity, Users } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

const volumeByModality = [
  { name: "Urgência", value: 2400, color: "#ef4444" },
  { name: "Eletivo", value: 4567, color: "#3b82f6" },
  { name: "Preventivo", value: 1398, color: "#10b981" },
];

const dailyVolume = [
  { day: "Seg", exames: 320, consultas: 180 },
  { day: "Ter", exames: 280, consultas: 220 },
  { day: "Qua", exames: 390, consultas: 190 },
  { day: "Qui", exames: 350, consultas: 250 },
  { day: "Sex", exames: 420, consultas: 280 },
  { day: "Sáb", exames: 180, consultas: 120 },
  { day: "Dom", exames: 90, consultas: 80 },
];

export default function Volumetria() {
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedModality, setSelectedModality] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Volumetria</h1>
        <p className="text-gray-600 mt-1">Análise completa do volume de exames e consultas</p>
      </div>

      <FilterBar 
        onPeriodChange={setSelectedPeriod}
        onModalityChange={setSelectedModality}
      />

      {/* Métricas de Volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Volume Total"
          value="8.765"
          change="+15% vs período anterior"
          changeType="positive"
          icon={BarChart3}
        />
        <MetricCard
          title="Exames Realizados"
          value="5.234"
          change="+12% vs período anterior"
          changeType="positive"
          icon={Activity}
        />
        <MetricCard
          title="Consultas"
          value="3.531"
          change="+18% vs período anterior"
          changeType="positive"
          icon={Users}
        />
        <MetricCard
          title="Taxa de Crescimento"
          value="15.2%"
          change="Acima da meta (10%)"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Diário */}
        <Card>
          <CardHeader>
            <CardTitle>Volume Diário da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="exames" fill="#3b82f6" name="Exames" />
                <Bar dataKey="consultas" fill="#10b981" name="Consultas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume por Modalidade */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={volumeByModality}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {volumeByModality.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Especialidades */}
      <Card>
        <CardHeader>
          <CardTitle>Volume por Especialidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Especialidade</th>
                  <th className="text-right p-2">Exames</th>
                  <th className="text-right p-2">Consultas</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Variação</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-medium">Cardiologia</td>
                  <td className="p-2 text-right">1,234</td>
                  <td className="p-2 text-right">567</td>
                  <td className="p-2 text-right font-medium">1,801</td>
                  <td className="p-2 text-right text-green-600">+12%</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Radiologia</td>
                  <td className="p-2 text-right">2,100</td>
                  <td className="p-2 text-right">200</td>
                  <td className="p-2 text-right font-medium">2,300</td>
                  <td className="p-2 text-right text-green-600">+18%</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Neurologia</td>
                  <td className="p-2 text-right">890</td>
                  <td className="p-2 text-right">445</td>
                  <td className="p-2 text-right font-medium">1,335</td>
                  <td className="p-2 text-right text-green-600">+8%</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Ortopedia</td>
                  <td className="p-2 text-right">1,010</td>
                  <td className="p-2 text-right">890</td>
                  <td className="p-2 text-right font-medium">1,900</td>
                  <td className="p-2 text-right text-green-600">+15%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
