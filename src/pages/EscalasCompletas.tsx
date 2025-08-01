import React, { useState, useEffect } from 'react';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { useEscalasAvancadas } from '@/hooks/useEscalasAvancadas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle,
  Copy,
  Plus,
  FileText,
  Settings,
  UserCheck,
  UserX
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EscalasCompletas() {
  const {
    escalas,
    tiposAusencia,
    ausencias,
    configuracao,
    loading,
    fetchEscalas,
    criarEscala,
    atualizarEscala,
    criarAusencia,
    aprovarAusencia,
    replicarEscala,
    canManageAll,
    isMedico
  } = useEscalasAvancadas();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterMedico, setFilterMedico] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAusenciaModal, setShowAusenciaModal] = useState(false);
  const [showReplicarModal, setShowReplicarModal] = useState(false);

  // Forms
  const [newEscala, setNewEscala] = useState({
    medico_id: '',
    data: '',
    turno: 'manha' as const,
    tipo_escala: 'normal' as const,
    modalidade: '',
    especialidade: '',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    capacidade_maxima_exames: 50,
    observacoes: ''
  });

  const [newAusencia, setNewAusencia] = useState({
    medico_id: '',
    tipo_ausencia_id: '',
    data_inicio: '',
    data_fim: '',
    turno: '',
    motivo: ''
  });

  const [replicarForm, setReplicarForm] = useState({
    medico_id: '',
    mes_origem: new Date().getMonth() + 1,
    ano_origem: new Date().getFullYear(),
    mes_destino: new Date().getMonth() + 2,
    ano_destino: new Date().getFullYear()
  });

  const medicos = Array.from(new Set(escalas.map(e => e.medico?.nome).filter(Boolean)));
  const mesAnoAtual = { mes: currentMonth.getMonth() + 1, ano: currentMonth.getFullYear() };

  useEffect(() => {
    fetchEscalas(filterMedico || undefined, mesAnoAtual);
  }, [currentMonth, filterMedico]);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      confirmada: { label: 'Confirmada', variant: 'default' },
      pendente: { label: 'Pendente', variant: 'secondary' },
      ausencia: { label: 'Ausência', variant: 'destructive' },
      cancelada: { label: 'Cancelada', variant: 'outline' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.pendente;
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getTurnoBadge = (turno: string) => {
    const turnoMap = {
      manha: { label: 'Manhã', color: 'bg-blue-500' },
      tarde: { label: 'Tarde', color: 'bg-orange-500' },
      noite: { label: 'Noite', color: 'bg-purple-500' },
      plantao: { label: 'Plantão', color: 'bg-red-500' }
    };
    const config = turnoMap[turno as keyof typeof turnoMap] || turnoMap.manha;
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const handleCreateEscala = async () => {
    if (!newEscala.medico_id || !newEscala.data) return;
    
    const success = await criarEscala(newEscala);
    if (success) {
      setShowCreateModal(false);
      setNewEscala({
        medico_id: '',
        data: '',
        turno: 'manha',
        tipo_escala: 'normal',
        modalidade: '',
        especialidade: '',
        horario_inicio: '08:00',
        horario_fim: '18:00',
        capacidade_maxima_exames: 50,
        observacoes: ''
      });
    }
  };

  const handleCreateAusencia = async () => {
    if (!newAusencia.medico_id || !newAusencia.tipo_ausencia_id || !newAusencia.data_inicio || !newAusencia.data_fim) return;
    
    const success = await criarAusencia(newAusencia);
    if (success) {
      setShowAusenciaModal(false);
      setNewAusencia({
        medico_id: '',
        tipo_ausencia_id: '',
        data_inicio: '',
        data_fim: '',
        turno: '',
        motivo: ''
      });
    }
  };

  const handleReplicarEscala = async () => {
    if (!replicarForm.medico_id) return;
    
    const success = await replicarEscala(
      replicarForm.medico_id,
      replicarForm.mes_origem,
      replicarForm.ano_origem,
      replicarForm.mes_destino,
      replicarForm.ano_destino
    );
    
    if (success) {
      setShowReplicarModal(false);
    }
  };

  const escalasDoMes = escalas.filter(escala => {
    const escalaDate = new Date(escala.data);
    return escalaDate.getMonth() === currentMonth.getMonth() && 
           escalaDate.getFullYear() === currentMonth.getFullYear();
  });

  const ausenciasPendentes = ausencias.filter(a => !a.aprovado);

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager', 'medico']}>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6">
        <div className="container mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Gestão de Escalas Médicas</h1>
              <p className="text-muted-foreground">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              {canManageAll && (
                <>
                  <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Escala
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Criar Nova Escala</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Médico</Label>
                          <Select 
                            value={newEscala.medico_id} 
                            onValueChange={(value) => setNewEscala(prev => ({...prev, medico_id: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o médico" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicos.map(medico => (
                                <SelectItem key={medico} value={medico || ''}>{medico}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Data</Label>
                          <Input 
                            type="date"
                            value={newEscala.data}
                            onChange={(e) => setNewEscala(prev => ({...prev, data: e.target.value}))}
                          />
                        </div>
                        <div>
                          <Label>Turno</Label>
                          <Select 
                            value={newEscala.turno} 
                            onValueChange={(value: any) => setNewEscala(prev => ({...prev, turno: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manha">Manhã</SelectItem>
                              <SelectItem value="tarde">Tarde</SelectItem>
                              <SelectItem value="noite">Noite</SelectItem>
                              <SelectItem value="plantao">Plantão</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Tipo de Escala</Label>
                          <Select 
                            value={newEscala.tipo_escala} 
                            onValueChange={(value: any) => setNewEscala(prev => ({...prev, tipo_escala: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="plantao">Plantão</SelectItem>
                              <SelectItem value="extra">Extra</SelectItem>
                              <SelectItem value="backup">Backup</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Horário Início</Label>
                          <Input 
                            type="time"
                            value={newEscala.horario_inicio}
                            onChange={(e) => setNewEscala(prev => ({...prev, horario_inicio: e.target.value}))}
                          />
                        </div>
                        <div>
                          <Label>Horário Fim</Label>
                          <Input 
                            type="time"
                            value={newEscala.horario_fim}
                            onChange={(e) => setNewEscala(prev => ({...prev, horario_fim: e.target.value}))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Observações</Label>
                          <Textarea 
                            value={newEscala.observacoes}
                            onChange={(e) => setNewEscala(prev => ({...prev, observacoes: e.target.value}))}
                            rows={3}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateEscala}>
                          Criar Escala
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showReplicarModal} onOpenChange={setShowReplicarModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Copy className="h-4 w-4 mr-2" />
                        Replicar Escala
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Replicar Escala</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Médico</Label>
                          <Select 
                            value={replicarForm.medico_id} 
                            onValueChange={(value) => setReplicarForm(prev => ({...prev, medico_id: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o médico" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicos.map(medico => (
                                <SelectItem key={medico} value={medico || ''}>{medico}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Mês Origem</Label>
                            <Input 
                              type="number"
                              min="1"
                              max="12"
                              value={replicarForm.mes_origem}
                              onChange={(e) => setReplicarForm(prev => ({...prev, mes_origem: parseInt(e.target.value)}))}
                            />
                          </div>
                          <div>
                            <Label>Ano Origem</Label>
                            <Input 
                              type="number"
                              value={replicarForm.ano_origem}
                              onChange={(e) => setReplicarForm(prev => ({...prev, ano_origem: parseInt(e.target.value)}))}
                            />
                          </div>
                          <div>
                            <Label>Mês Destino</Label>
                            <Input 
                              type="number"
                              min="1"
                              max="12"
                              value={replicarForm.mes_destino}
                              onChange={(e) => setReplicarForm(prev => ({...prev, mes_destino: parseInt(e.target.value)}))}
                            />
                          </div>
                          <div>
                            <Label>Ano Destino</Label>
                            <Input 
                              type="number"
                              value={replicarForm.ano_destino}
                              onChange={(e) => setReplicarForm(prev => ({...prev, ano_destino: parseInt(e.target.value)}))}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowReplicarModal(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleReplicarEscala}>
                          Replicar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              <Dialog open={showAusenciaModal} onOpenChange={setShowAusenciaModal}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserX className="h-4 w-4 mr-2" />
                    Registrar Ausência
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Ausência</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {canManageAll && (
                      <div>
                        <Label>Médico</Label>
                        <Select 
                          value={newAusencia.medico_id} 
                          onValueChange={(value) => setNewAusencia(prev => ({...prev, medico_id: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o médico" />
                          </SelectTrigger>
                          <SelectContent>
                            {medicos.map(medico => (
                              <SelectItem key={medico} value={medico || ''}>{medico}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Tipo de Ausência</Label>
                      <Select 
                        value={newAusencia.tipo_ausencia_id} 
                        onValueChange={(value) => setNewAusencia(prev => ({...prev, tipo_ausencia_id: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposAusencia.map(tipo => (
                            <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Início</Label>
                        <Input 
                          type="date"
                          value={newAusencia.data_inicio}
                          onChange={(e) => setNewAusencia(prev => ({...prev, data_inicio: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label>Data Fim</Label>
                        <Input 
                          type="date"
                          value={newAusencia.data_fim}
                          onChange={(e) => setNewAusencia(prev => ({...prev, data_fim: e.target.value}))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Turno (opcional)</Label>
                      <Select 
                        value={newAusencia.turno} 
                        onValueChange={(value) => setNewAusencia(prev => ({...prev, turno: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os turnos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todos os turnos</SelectItem>
                          <SelectItem value="manha">Manhã</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="noite">Noite</SelectItem>
                          <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Textarea 
                        value={newAusencia.motivo}
                        onChange={(e) => setNewAusencia(prev => ({...prev, motivo: e.target.value}))}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAusenciaModal(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateAusencia}>
                      Registrar Ausência
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filtros e Navegação */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    ← Anterior
                  </Button>
                  <span className="font-medium">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    Próximo →
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  {canManageAll && (
                    <Select value={filterMedico} onValueChange={setFilterMedico}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Todos os médicos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os médicos</SelectItem>
                        {medicos.map(medico => (
                          <SelectItem key={medico} value={medico || ''}>{medico}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">Calendário</SelectItem>
                      <SelectItem value="list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Escalas</p>
                    <p className="text-2xl font-bold">{escalasDoMes.length}</p>
                  </div>
                  <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Confirmadas</p>
                    <p className="text-2xl font-bold text-green-600">
                      {escalasDoMes.filter(e => e.status === 'confirmada').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {escalasDoMes.filter(e => e.status === 'pendente').length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ausências</p>
                    <p className="text-2xl font-bold text-red-600">
                      {ausenciasPendentes.length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conteúdo Principal */}
          <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <TabsList>
              <TabsTrigger value="calendar">Calendário</TabsTrigger>
              <TabsTrigger value="list">Lista</TabsTrigger>
            </TabsList>
            
            <TabsContent value="calendar">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center font-medium p-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 42 }, (_, i) => {
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i - 6);
                      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                      const escalasData = escalasDoMes.filter(e => 
                        new Date(e.data).getDate() === date.getDate()
                      );
                      
                      return (
                        <div 
                          key={i} 
                          className={`min-h-24 p-2 border rounded-lg ${
                            isCurrentMonth ? 'bg-background' : 'bg-muted/50'
                          }`}
                        >
                          <div className="text-sm font-medium mb-1">
                            {date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {escalasData.slice(0, 2).map(escala => (
                              <div 
                                key={escala.id} 
                                className="text-xs p-1 rounded bg-primary/10 text-primary truncate"
                              >
                                {escala.medico?.nome}
                              </div>
                            ))}
                            {escalasData.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{escalasData.length - 2} mais
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {escalasDoMes.map(escala => (
                      <div key={escala.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{escala.medico?.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(escala.data), 'dd/MM/yyyy')} - {escala.horario_inicio} às {escala.horario_fim}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {getTurnoBadge(escala.turno)}
                            {getStatusBadge(escala.status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{escala.modalidade}</Badge>
                          <Badge variant="outline">{escala.especialidade}</Badge>
                        </div>
                      </div>
                    ))}
                    {escalasDoMes.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma escala encontrada para este período
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Ausências Pendentes */}
          {canManageAll && ausenciasPendentes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ausências Pendentes de Aprovação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ausenciasPendentes.map(ausencia => (
                    <div key={ausencia.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Médico: {ausencia.medico_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {ausencia.tipo_ausencia?.nome} - {ausencia.data_inicio} a {ausencia.data_fim}
                        </p>
                        {ausencia.motivo && (
                          <p className="text-sm text-muted-foreground">Motivo: {ausencia.motivo}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => aprovarAusencia(ausencia.id, false)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => aprovarAusencia(ausencia.id, true)}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleProtectedRoute>
  );
}