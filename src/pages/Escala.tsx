import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, User, AlertTriangle, CheckCircle, XCircle, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEscalasMedicas } from '@/hooks/useEscalasMedicas';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';

export default function Escala() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTurno, setSelectedTurno] = useState<string>('todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [ausenciaMotivo, setAusenciaMotivo] = useState('');
  const [selectedEscalaId, setSelectedEscalaId] = useState<string>('');
  
  const { escalas, loading, informarAusencia, confirmarEscala, canManageAll, isMedico } = useEscalasMedicas();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmada':
        return <Badge className="bg-green-100 text-green-800">Confirmada</Badge>;
      case 'ausencia':
        return <Badge className="bg-red-100 text-red-800">Ausência</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'cancelada':
        return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTurnoBadge = (turno: string) => {
    const colors = {
      'manha': 'bg-blue-100 text-blue-800',
      'tarde': 'bg-orange-100 text-orange-800',
      'noite': 'bg-purple-100 text-purple-800',
      'plantao': 'bg-indigo-100 text-indigo-800'
    };
    return <Badge className={colors[turno as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {turno === 'manha' ? 'Manhã' : turno === 'tarde' ? 'Tarde' : turno === 'noite' ? 'Noite' : 'Plantão'}
    </Badge>;
  };

  const getTipoBadge = (tipo: string) => {
    const colors = {
      'normal': 'bg-gray-100 text-gray-800',
      'plantao': 'bg-indigo-100 text-indigo-800',
      'extra': 'bg-green-100 text-green-800',
      'backup': 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={colors[tipo as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {tipo === 'plantao' ? 'Plantão' : tipo === 'extra' ? 'Extra' : tipo === 'backup' ? 'Backup' : 'Normal'}
    </Badge>;
  };

  // Filtrar escalas com base nos filtros selecionados
  const escalasFiltradas = escalas.filter(escala => {
    const matchDate = !selectedDate || escala.data === format(selectedDate, 'yyyy-MM-dd');
    const matchTurno = selectedTurno === 'todos' || escala.turno === selectedTurno;
    const matchTipo = selectedTipo === 'todos' || escala.tipo_escala === selectedTipo;
    const matchStatus = selectedStatus === 'todos' || escala.status === selectedStatus;
    
    return matchDate && matchTurno && matchTipo && matchStatus;
  });

  const handleInformarAusencia = async () => {
    if (!selectedEscalaId || !ausenciaMotivo.trim()) return;
    
    const success = await informarAusencia(selectedEscalaId, ausenciaMotivo);
    if (success) {
      setAusenciaMotivo('');
      setSelectedEscalaId('');
    }
  };

  // Calcular estatísticas
  const estatisticas = {
    presentes: escalas.filter(e => e.status === 'confirmada').length,
    ausentes: escalas.filter(e => e.status === 'ausencia').length,
    pendentes: escalas.filter(e => e.status === 'pendente').length,
    plantoes: escalas.filter(e => e.tipo_escala === 'plantao').length
  };

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager', 'medico']}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Escala Médica</h1>
            <p className="text-muted-foreground">
              {isMedico ? 'Visualize suas escalas médicas' : 'Gerencie e visualize as escalas médicas'}
            </p>
          </div>
        </div>

        {/* Resumo de Escalas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Confirmadas</p>
                  <p className="text-2xl font-bold">{estatisticas.presentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Ausências</p>
                  <p className="text-2xl font-bold">{estatisticas.ausentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Plantões</p>
                  <p className="text-2xl font-bold">{estatisticas.plantoes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{estatisticas.pendentes}</p>
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
                <CalendarDays className="h-5 w-5" />
                Calendário de Escalas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="turno">Turno</Label>
                <Select value={selectedTurno} onValueChange={setSelectedTurno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os turnos</SelectItem>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tipo">Tipo de Escala</Label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                    <SelectItem value="ausencia">Ausência</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isMedico && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Informar Ausência
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Informar Ausência</DialogTitle>
                      <DialogDescription>
                        Informe o motivo da sua ausência na escala selecionada.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="motivo">Motivo da Ausência</Label>
                        <Textarea
                          id="motivo"
                          placeholder="Descreva o motivo da ausência..."
                          value={ausenciaMotivo}
                          onChange={(e) => setAusenciaMotivo(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline">
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleInformarAusencia}
                          disabled={!selectedEscalaId || !ausenciaMotivo.trim()}
                        >
                          Confirmar Ausência
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Alertas */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Escala</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {escalas.filter(e => e.status === 'ausencia').slice(0, 3).map((escala) => (
                  <div key={escala.id} className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                    <p className="text-sm font-medium text-red-800">Ausência registrada</p>
                    <p className="text-xs text-red-600">
                      {escala.medico?.nome} - {format(new Date(escala.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                ))}
                
                {escalas.filter(e => e.status === 'pendente').slice(0, 3).map((escala) => (
                  <div key={escala.id} className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                    <p className="text-sm font-medium text-yellow-800">Confirmação pendente</p>
                    <p className="text-xs text-yellow-600">
                      {escala.medico?.nome} - {format(new Date(escala.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Escalas do Período</CardTitle>
            <CardDescription>
              {loading ? 'Carregando escalas...' : `${escalasFiltradas.length} escalas encontradas`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {(canManageAll || !isMedico) && <TableHead>Médico</TableHead>}
                    <TableHead>Data</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Status</TableHead>
                    {isMedico && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalasFiltradas.map((escala) => (
                    <TableRow key={escala.id}>
                      {(canManageAll || !isMedico) && (
                        <TableCell className="font-medium">
                          {escala.medico?.nome || 'N/A'}
                        </TableCell>
                      )}
                      <TableCell>{format(new Date(escala.data), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{getTurnoBadge(escala.turno)}</TableCell>
                      <TableCell>{getTipoBadge(escala.tipo_escala)}</TableCell>
                      <TableCell>{escala.modalidade}</TableCell>
                      <TableCell>{escala.especialidade}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(escala.status)}
                          {escala.motivo_ausencia && (
                            <span className="text-xs text-muted-foreground">
                              {escala.motivo_ausencia}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {isMedico && (
                        <TableCell>
                          <div className="flex space-x-2">
                            {escala.status !== 'ausencia' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedEscalaId(escala.id)}
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    Ausência
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Informar Ausência</DialogTitle>
                                    <DialogDescription>
                                      Confirme a ausência para esta escala.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="motivo">Motivo da Ausência</Label>
                                      <Textarea
                                        id="motivo"
                                        placeholder="Descreva o motivo da ausência..."
                                        value={ausenciaMotivo}
                                        onChange={(e) => setAusenciaMotivo(e.target.value)}
                                      />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                      <Button variant="outline">
                                        Cancelar
                                      </Button>
                                      <Button 
                                        onClick={handleInformarAusencia}
                                        disabled={!selectedEscalaId || !ausenciaMotivo.trim()}
                                      >
                                        Confirmar Ausência
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            {escala.status === 'ausencia' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => confirmarEscala(escala.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirmar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleProtectedRoute>
  );
}