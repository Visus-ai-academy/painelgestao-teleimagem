import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  UserPlus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar,
  AlertTriangle,
  Users,
  Hand
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CoberturaDisponivel {
  cobertura_id: string;
  escala_id: string;
  medico_ofereceu_nome: string;
  data_inicio: string;
  data_fim: string;
  turno: string;
  especialidade: string;
  modalidade: string;
  motivo: string;
  dias_restantes_aceite: number;
}

interface SistemaCoberturasProps {
  medicoId?: string;
  canManage?: boolean;
}

export const SistemaCoberturas: React.FC<SistemaCoberturasProps> = ({
  medicoId,
  canManage = false
}) => {
  const { toast } = useToast();
  const [coberturasDisponiveis, setCoberturasDisponiveis] = useState<CoberturaDisponivel[]>([]);
  const [minhasEscalas, setMinhasEscalas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para oferecer cobertura
  const [escalasSelecionada, setEscalaSelecionada] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [tipoCobertura, setTipoCobertura] = useState<string>('dia');

  useEffect(() => {
    if (medicoId) {
      buscarCoberturasDisponiveis();
      buscarMinhasEscalas();
    }
  }, [medicoId]);

  const buscarCoberturasDisponiveis = async () => {
    if (!medicoId) return;
    
    try {
      const { data, error } = await supabase.rpc('listar_coberturas_disponiveis', {
        p_medico_id: medicoId
      });

      if (error) throw error;
      setCoberturasDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao buscar coberturas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar coberturas disponíveis",
        variant: "destructive"
      });
    }
  };

  const buscarMinhasEscalas = async () => {
    if (!medicoId) return;
    
    try {
      const { data, error } = await supabase
        .from('escalas_medicas')
        .select('*')
        .eq('medico_id', medicoId)
        .gte('data', new Date().toISOString().split('T')[0])
        .order('data', { ascending: true });

      if (error) throw error;
      setMinhasEscalas(data || []);
    } catch (error) {
      console.error('Erro ao buscar escalas:', error);
    }
  };

  const oferecerCobertura = async () => {
    if (!escalasSelecionada || !dataInicio || !dataFim || !medicoId) {
      toast({
        title: "Atenção",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('oferecer_escala_cobertura', {
        p_escala_id: escalasSelecionada,
        p_medico_id: medicoId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_motivo: motivo,
        p_tipo_cobertura: tipoCobertura
      });

      if (error) throw error;

      const result = data as any;
      if (result?.sucesso) {
        toast({
          title: "Sucesso",
          description: `Cobertura oferecida com sucesso! ${result.dias_antecedencia} dias de antecedência.`
        });
        
        // Limpar formulário
        setEscalaSelecionada('');
        setDataInicio('');
        setDataFim('');
        setMotivo('');
        setTipoCobertura('dia');
        
        buscarCoberturasDisponiveis();
      } else {
        toast({
          title: "Erro",
          description: result?.erro || "Erro ao oferecer cobertura",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao oferecer cobertura",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const aceitarCobertura = async (coberturaId: string) => {
    if (!medicoId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('aceitar_cobertura_escala', {
        p_cobertura_id: coberturaId,
        p_medico_aceitou_id: medicoId
      });

      if (error) throw error;

      const result = data as any;
      if (result?.sucesso) {
        toast({
          title: "Sucesso",
          description: "Cobertura aceita com sucesso! A escala foi transferida para você."
        });
        
        buscarCoberturasDisponiveis();
        buscarMinhasEscalas();
      } else {
        toast({
          title: "Erro",
          description: result?.erro || "Erro ao aceitar cobertura",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao aceitar cobertura",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (diasRestantes: number) => {
    if (diasRestantes < 0) {
      return <Badge variant="destructive">Expirado</Badge>;
    } else if (diasRestantes <= 2) {
      return <Badge variant="secondary">Urgente</Badge>;
    } else {
      return <Badge variant="default">{diasRestantes} dias restantes</Badge>;
    }
  };

  if (!medicoId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sistema de Coberturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sistema disponível apenas para médicos logados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Sistema de Coberturas de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="disponiveis" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="disponiveis" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Coberturas Disponíveis
              </TabsTrigger>
              <TabsTrigger value="oferecer" className="flex items-center gap-2">
                <Hand className="h-4 w-4" />
                Oferecer Cobertura
              </TabsTrigger>
            </TabsList>

            <TabsContent value="disponiveis" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Coberturas Disponíveis para Você</h3>
                <Button onClick={buscarCoberturasDisponiveis} variant="outline" size="sm">
                  Atualizar
                </Button>
              </div>

              {coberturasDisponiveis.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma cobertura disponível no momento</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {coberturasDisponiveis.map((cobertura) => (
                    <Card key={cobertura.cobertura_id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium">{cobertura.medico_ofereceu_nome}</h4>
                            <p className="text-sm text-muted-foreground">
                              {cobertura.especialidade} • {cobertura.modalidade}
                            </p>
                          </div>
                          {getStatusBadge(cobertura.dias_restantes_aceite)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(cobertura.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                              {cobertura.data_inicio !== cobertura.data_fim && 
                                ` - ${format(new Date(cobertura.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`
                              }
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{cobertura.turno}</span>
                          </div>
                        </div>

                        {cobertura.motivo && (
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">
                              <strong>Motivo:</strong> {cobertura.motivo}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => aceitarCobertura(cobertura.cobertura_id)}
                            disabled={loading || cobertura.dias_restantes_aceite < 0}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Aceitar Cobertura
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="oferecer" className="space-y-4">
              <h3 className="text-lg font-medium">Oferecer Cobertura das Suas Escalas</h3>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="escala">Escala</Label>
                  <Select value={escalasSelecionada} onValueChange={setEscalaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma escala" />
                    </SelectTrigger>
                    <SelectContent>
                      {minhasEscalas.map((escala) => (
                        <SelectItem key={escala.id} value={escala.id}>
                          {format(new Date(escala.data), 'dd/MM/yyyy', { locale: ptBR })} - 
                          {escala.turno} - {escala.especialidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dataInicio">Data Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dataFim">Data Fim</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tipoCobertura">Tipo de Cobertura</Label>
                  <Select value={tipoCobertura} onValueChange={setTipoCobertura}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dia">Dia Completo</SelectItem>
                      <SelectItem value="turno">Apenas Turno</SelectItem>
                      <SelectItem value="periodo">Período Específico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="motivo">Motivo (Opcional)</Label>
                  <Textarea
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Explique o motivo da cobertura..."
                    rows={3}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Regras para Cobertura:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Mínimo 7 dias de antecedência</li>
                        <li>Máximo 60 dias de antecedência</li>
                        <li>Outros médicos têm até 5 dias antes para aceitar</li>
                        <li>Deve ser da mesma especialidade/modalidade</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={oferecerCobertura}
                  disabled={loading || !escalasSelecionada || !dataInicio || !dataFim}
                  className="w-full"
                >
                  <Hand className="h-4 w-4 mr-2" />
                  {loading ? 'Oferecendo...' : 'Oferecer Cobertura'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};