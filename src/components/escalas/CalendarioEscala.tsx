import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarioEscalaProps {
  onCriarEscala: ((escala: any) => void) | ((data: Date, turno: string, tipo: string) => void);
  canManage?: boolean;
  medicoId?: string;
  // Legacy props for EscalaMedica.tsx
  escalas?: any[];
  onSelecionarData?: (date: Date) => void;
  canEdit?: boolean;
}

export const CalendarioEscala: React.FC<CalendarioEscalaProps> = ({
  onCriarEscala,
  canManage,
  medicoId
}) => {
  const { toast } = useToast();
  const [datasSelecionadas, setDatasSelecionadas] = useState<Date[] | undefined>(undefined);
  const [turno, setTurno] = useState<string>('');
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Buscar dados do médico logado
  useEffect(() => {
    const buscarDadosMedico = async () => {
      try {
        setLoading(true);
        
        // Se medicoId foi fornecido, usar ele
        if (medicoId) {
          await buscarModalidadesEspecialidades(medicoId);
          return;
        }

        // Senão, buscar pelo usuário logado
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          const { data: medico, error } = await supabase
            .from('medicos')
            .select('id, modalidades, especialidades, especialidade')
            .eq('user_id', user.user.id)
            .single();
          
          if (error || !medico) {
            console.error('Erro ao buscar médico:', error);
            return;
          }

          await buscarModalidadesEspecialidades(medico.id);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do médico:', error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosMedico();
  }, [medicoId]);

  const buscarModalidadesEspecialidades = async (id: string) => {
    try {
      const { data: medico, error } = await supabase
        .from('medicos')
        .select('modalidades, especialidades, especialidade')
        .eq('id', id)
        .single();

      if (error || !medico) {
        console.error('Erro ao buscar dados do médico:', error);
        return;
      }

      // Definir modalidades (array ou string única)
      const modalidadesList = medico.modalidades && medico.modalidades.length > 0 
        ? medico.modalidades 
        : [];
      
      // Definir especialidades (array ou string única)
      const especialidadesList = medico.especialidades && medico.especialidades.length > 0 
        ? medico.especialidades 
        : medico.especialidade ? [medico.especialidade] : [];

      setModalidades(modalidadesList);
      setEspecialidades(especialidadesList);

      // Se há apenas uma opção, selecionar automaticamente
      if (modalidadesList.length === 1) {
        setModalidadeSelecionada(modalidadesList[0]);
      }
      if (especialidadesList.length === 1) {
        setEspecialidadeSelecionada(especialidadesList[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades e especialidades:', error);
    }
  };

  const handleCriarEscala = () => {
    if (!datasSelecionadas?.length || !turno || !modalidadeSelecionada || !especialidadeSelecionada) {
      toast({
        title: "Atenção",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    datasSelecionadas.forEach(data => {
      // Check if onCriarEscala expects 3 parameters (legacy interface)
      if (onCriarEscala.length === 3) {
        (onCriarEscala as (data: Date, turno: string, tipo: string) => void)(data, turno, 'normal');
      } else {
        // New interface with escala object
        const escala = {
          data: format(data, 'yyyy-MM-dd'),
          turno,
          modalidade: modalidadeSelecionada,
          especialidade: especialidadeSelecionada,
          tipo_escala: 'normal',
          status: 'confirmada'
        };
        (onCriarEscala as (escala: any) => void)(escala);
      }
    });

    // Limpar apenas as datas e turno
    setDatasSelecionadas(undefined);
    setTurno('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Calendário de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="multiple"
            selected={datasSelecionadas}
            onSelect={setDatasSelecionadas}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da Escala</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="turno">Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o turno" />
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
            <Label htmlFor="modalidade">Modalidade</Label>
            {modalidades.length > 1 ? (
              <Select value={modalidadeSelecionada} onValueChange={setModalidadeSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {modalidades.map((modalidade) => (
                    <SelectItem key={modalidade} value={modalidade}>
                      {modalidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                {modalidades.length === 1 ? modalidades[0] : loading ? 'Carregando...' : 'Não definido no cadastro'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="especialidade">Especialidade</Label>
            {especialidades.length > 1 ? (
              <Select value={especialidadeSelecionada} onValueChange={setEspecialidadeSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {especialidades.map((especialidade) => (
                    <SelectItem key={especialidade} value={especialidade}>
                      {especialidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                {especialidades.length === 1 ? especialidades[0] : loading ? 'Carregando...' : 'Não definido no cadastro'}
              </div>
            )}
          </div>

          <Button 
            onClick={handleCriarEscala}
            disabled={!datasSelecionadas?.length || !turno || !modalidadeSelecionada || !especialidadeSelecionada || loading}
            className="w-full"
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            {loading ? 'Carregando...' : 'Criar Escala'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};