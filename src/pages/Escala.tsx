import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Filter,
  Users,
  Eye
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";

interface EscalaData {
  id: string;
  medico: string;
  data: string;
  turno: "Manhã" | "Tarde" | "Noite";
  tipoEscala: "Plantão" | "Turno";
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  status: "Presente" | "Ausente" | "Pendente";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA";
}

const escalasData: EscalaData[] = [
  {
    id: "1",
    medico: "Dr. João Silva",
    data: "2024-01-15",
    turno: "Manhã",
    tipoEscala: "Plantão",
    modalidade: "MR",
    status: "Presente",
    especialidade: "NE"
  },
  {
    id: "2",
    medico: "Dra. Maria Santos",
    data: "2024-01-15",
    turno: "Tarde",
    tipoEscala: "Turno",
    modalidade: "CT",
    status: "Presente",
    especialidade: "CA"
  },
  {
    id: "3",
    medico: "Dr. Carlos Lima",
    data: "2024-01-15",
    turno: "Noite",
    tipoEscala: "Plantão",
    modalidade: "DO",
    status: "Ausente",
    especialidade: "ME"
  },
  {
    id: "4",
    medico: "Dra. Ana Costa",
    data: "2024-01-16",
    turno: "Manhã",
    tipoEscala: "Turno",
    modalidade: "MG",
    status: "Pendente",
    especialidade: "MI"
  },
  {
    id: "5",
    medico: "Dr. Pedro Oliveira",
    data: "2024-01-16",
    turno: "Tarde",
    tipoEscala: "Plantão",
    modalidade: "RX",
    status: "Presente",
    especialidade: "MA"
  }
];

// Dados das equipes com médicos
const equipesData = [
  {
    nome: "Equipe A - Manhã",
    turno: "Manhã",
    medicos: [
      { name: "Dr. João Silva", especialidade: "NE", modalidade: "MR", status: "Ativo", experiencia: "5 anos" },
      { name: "Dra. Ana Costa", especialidade: "CA", modalidade: "CT", status: "Ativo", experiencia: "8 anos" },
      { name: "Dr. Carlos Lima", especialidade: "ME", modalidade: "DO", status: "Férias", experiencia: "3 anos" }
    ]
  },
  {
    nome: "Equipe B - Tarde",
    turno: "Tarde", 
    medicos: [
      { name: "Dra. Maria Santos", especialidade: "MI", modalidade: "MG", status: "Ativo", experiencia: "12 anos" },
      { name: "Dr. Pedro Oliveira", especialidade: "MA", modalidade: "RX", status: "Ativo", experiencia: "7 anos" },
      { name: "Dra. Sofia Mendes", especialidade: "CA", modalidade: "CT", status: "Licença", experiencia: "4 anos" }
    ]
  },
  {
    nome: "Equipe C - Noite",
    turno: "Noite",
    medicos: [
      { name: "Dr. Bruno Alves", especialidade: "NE", modalidade: "MR", status: "Ativo", experiencia: "6 anos" },
      { name: "Dra. Lucia Rocha", especialidade: "ME", modalidade: "DO", status: "Ativo", experiencia: "9 anos" },
      { name: "Dr. Ricardo Santos", especialidade: "CA", modalidade: "CT", status: "Ativo", experiencia: "11 anos" }
    ]
  },
  {
    nome: "Equipe Plantão",
    turno: "24h",
    medicos: [
      { name: "Dr. Fernando Costa", especialidade: "MI", modalidade: "MG", status: "Ativo", experiencia: "15 anos" },
      { name: "Dra. Carla Oliveira", especialidade: "MA", modalidade: "RX", status: "Ativo", experiencia: "10 anos" },
      { name: "Dr. Marcelo Silva", especialidade: "NE", modalidade: "MR", status: "Ativo", experiencia: "8 anos" }
    ]
  }
];

export default function Escala() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filtroTurno, setFiltroTurno] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [ausenciaMotivo, setAusenciaMotivo] = useState<string>("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Presente":
        return <Badge className="bg-green-100 text-green-800">Presente</Badge>;
      case "Ausente":
        return <Badge className="bg-red-100 text-red-800">Ausente</Badge>;
      case "Pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTurnoBadge = (turno: string) => {
    const colors = {
      "Manhã": "bg-blue-100 text-blue-800",
      "Tarde": "bg-orange-100 text-orange-800",
      "Noite": "bg-purple-100 text-purple-800"
    };
    return <Badge className={colors[turno as keyof typeof colors]}>{turno}</Badge>;
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === "Plantão" 
      ? <Badge className="bg-indigo-100 text-indigo-800">Plantão</Badge>
      : <Badge className="bg-gray-100 text-gray-800">Turno</Badge>;
  };

  const escalasFiltradas = escalasData.filter(escala => {
    const matchTurno = filtroTurno === "todos" || escala.turno === filtroTurno;
    const matchTipo = filtroTipo === "todos" || escala.tipoEscala === filtroTipo;
    const matchStatus = filtroStatus === "todos" || escala.status === filtroStatus;
    return matchTurno && matchTipo && matchStatus;
  });

  const handleInformarAusencia = () => {
    // Aqui seria implementada a lógica para informar ausência
    console.log("Ausência informada:", ausenciaMotivo);
    setAusenciaMotivo("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Escala Médica</h1>
        <p className="text-gray-600 mt-1">Gestão de escalas, turnos e disponibilidade dos médicos</p>
      </div>

      <FilterBar />

      {/* Resumo de Escalas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Presentes Hoje</p>
                <p className="text-2xl font-bold text-gray-900">18</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserX className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ausentes</p>
                <p className="text-2xl font-bold text-gray-900">2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Plantões Ativos</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário de Escalas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="turno">Turno</Label>
              <Select value={filtroTurno} onValueChange={setFiltroTurno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os turnos</SelectItem>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Tarde">Tarde</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Escala</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="Plantão">Plantão</SelectItem>
                  <SelectItem value="Turno">Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="Presente">Presente</SelectItem>
                  <SelectItem value="Ausente">Ausente</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Informar Ausência
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Informar Ausência</DialogTitle>
                  <DialogDescription>
                    Informe o motivo da sua ausência para registro na escala.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="motivo" className="text-right">
                      Motivo
                    </Label>
                    <Textarea
                      id="motivo"
                      value={ausenciaMotivo}
                      onChange={(e) => setAusenciaMotivo(e.target.value)}
                      className="col-span-3"
                      placeholder="Descreva o motivo da ausência..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleInformarAusencia}>Confirmar Ausência</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Escala</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                <p className="text-sm font-medium text-red-800">Ausência não justificada</p>
                <p className="text-xs text-red-600">Dr. Carlos Lima - Turno da noite</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <p className="text-sm font-medium text-yellow-800">Confirmação pendente</p>
                <p className="text-xs text-yellow-600">Dra. Ana Costa - Turno da manhã</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm font-medium text-blue-800">Nova escala disponível</p>
                <p className="text-xs text-blue-600">Próxima semana - Revisar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Escalas */}
      <Card>
        <CardHeader>
          <CardTitle>Escalas do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Médico</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalasFiltradas.map((escala) => (
                <TableRow key={escala.id}>
                  <TableCell className="font-medium">{escala.medico}</TableCell>
                  <TableCell>{new Date(escala.data).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{getTurnoBadge(escala.turno)}</TableCell>
                  <TableCell>{getTipoBadge(escala.tipoEscala)}</TableCell>
                  <TableCell>{escala.modalidade}</TableCell>
                  <TableCell>{escala.especialidade}</TableCell>
                  <TableCell>{getStatusBadge(escala.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Demonstrativo de Médicos por Equipe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demonstrativo de Médicos por Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {equipesData.map((equipe, equipeIndex) => (
              <div key={equipeIndex} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{equipe.nome}</h3>
                    <p className="text-sm text-gray-600">Turno: {equipe.turno}</p>
                  </div>
                  <Badge variant="outline">
                    {equipe.medicos.length} médicos
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {equipe.medicos.map((medico, medicoIndex) => (
                    <div key={medicoIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{medico.name}</p>
                        <p className="text-sm text-gray-600">
                          {medico.especialidade} | {medico.modalidade} | {medico.experiencia}
                        </p>
                      </div>
                      <Badge 
                        variant={medico.status === "Ativo" ? "default" : 
                                medico.status === "Férias" ? "secondary" : "destructive"}
                      >
                        {medico.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Médicos Ativos:</span>
                    <span className="font-medium">
                      {equipe.medicos.filter(m => m.status === "Ativo").length} / {equipe.medicos.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}