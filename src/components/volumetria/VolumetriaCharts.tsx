import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Activity, Users } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

interface ClienteData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
}

interface ModalidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
}

interface EspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
}

interface VolumetriaChartsProps {
  clientes: ClienteData[];
  modalidades: ModalidadeData[];
  especialidades: EspecialidadeData[];
  categorias: ModalidadeData[];
  prioridades: ModalidadeData[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

export function VolumetriaCharts({ clientes, modalidades, especialidades, categorias, prioridades }: VolumetriaChartsProps) {
  return (
    <>
      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Clientes por Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientes.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name === 'total_exames' ? 'Exames' : 'Registros'
                  ]}
                />
                <Legend />
                <Bar dataKey="total_exames" fill="#3b82f6" name="Exames" />
                <Bar dataKey="total_registros" fill="#10b981" name="Registros" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Modalidades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Distribuição por Modalidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modalidades.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({nome, percentual}) => `${nome}: ${percentual.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_exames"
                >
                  {modalidades.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Especialidades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Top 10 Especialidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={especialidades.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']}
                />
                <Bar dataKey="total_exames" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Categorias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top 10 Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={categorias.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  tick={{fontSize: 10}}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']}
                />
                <Bar dataKey="total_exames" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Prioridades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Distribuição por Prioridade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={prioridades}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="nome" 
                tick={{fontSize: 12}}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Exames']}
              />
              <Bar dataKey="total_exames" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}