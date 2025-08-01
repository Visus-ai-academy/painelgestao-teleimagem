import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Copy, Calendar, Clock } from 'lucide-react';
import { EscalaMedicaCompleta, ConfiguracaoEscala } from '@/hooks/useEscalasMedicasCompleto';

interface ReplicarEscalaDialogProps {
  escala: EscalaMedicaCompleta;
  configuracao: ConfiguracaoEscala | null;
  onReplicar: (escalaId: string, meses: { mes: number; ano: number }[]) => Promise<boolean>;
  trigger?: React.ReactNode;
}

export const ReplicarEscalaDialog = ({ 
  escala, 
  configuracao, 
  onReplicar, 
  trigger 
}: ReplicarEscalaDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mesesSelecionados, setMesesSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const maxMeses = configuracao?.meses_antecipacao || 6;
  
  const gerarMesesDisponiveis = () => {
    const meses = [];
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    for (let i = 1; i <= maxMeses; i++) {
      const novoMes = (mesAtual + i) % 12;
      const novoAno = novoMes < mesAtual ? anoAtual + 1 : anoAtual;
      
      meses.push({
        mes: novoMes + 1, // Corrigir para 1-based
        ano: novoAno,
        key: `${novoAno}-${String(novoMes + 1).padStart(2, '0')}`,
        nome: new Date(novoAno, novoMes, 1).toLocaleDateString('pt-BR', { 
          month: 'long', 
          year: 'numeric' 
        })
      });
    }

    return meses;
  };

  const mesesDisponiveis = gerarMesesDisponiveis();

  const handleToggleMes = (mesKey: string) => {
    const novos = new Set(mesesSelecionados);
    if (novos.has(mesKey)) {
      novos.delete(mesKey);
    } else {
      novos.add(mesKey);
    }
    setMesesSelecionados(novos);
  };

  const handleReplicar = async () => {
    if (mesesSelecionados.size === 0) return;

    setLoading(true);
    try {
      const mesesParaReplicar = mesesDisponiveis
        .filter(mes => mesesSelecionados.has(mes.key))
        .map(mes => ({ mes: mes.mes, ano: mes.ano }));

      const sucesso = await onReplicar(escala.id, mesesParaReplicar);
      if (sucesso) {
        setOpen(false);
        setMesesSelecionados(new Set());
      }
    } catch (error) {
      console.error('Erro ao replicar escala:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTurnoBadge = (turno: string) => {
    const cores = {
      manha: 'bg-blue-500',
      tarde: 'bg-orange-500',
      noite: 'bg-purple-500',
      plantao: 'bg-red-500'
    };
    
    const nomes = {
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite',
      plantao: 'Plantão'
    };

    return (
      <Badge className={`${cores[turno as keyof typeof cores]} text-white`}>
        {nomes[turno as keyof typeof nomes]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Replicar
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Replicar Escala
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo da Escala */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Escala a ser Replicada</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Médico:</span>
                  <p className="font-medium">{escala.medico?.nome}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CRM:</span>
                  <p className="font-medium">{escala.medico?.crm}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Turno:</span>
                  <div className="mt-1">
                    {getTurnoBadge(escala.turno)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium capitalize">{escala.tipo_escala}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Modalidade:</span>
                  <p className="font-medium">{escala.modalidade}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Especialidade:</span>
                  <p className="font-medium">{escala.especialidade}</p>
                </div>
                {escala.horario_inicio && escala.horario_fim && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Horário:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {escala.horario_inicio} - {escala.horario_fim}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Meses */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Selecione os meses para replicação
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {mesesDisponiveis.map((mes) => (
                <Card 
                  key={mes.key} 
                  className={`cursor-pointer transition-colors ${
                    mesesSelecionados.has(mes.key) 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleToggleMes(mes.key)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={mesesSelecionados.has(mes.key)}
                        onChange={() => handleToggleMes(mes.key)}
                      />
                      <span className="text-sm font-medium capitalize">
                        {mes.nome}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {mesesSelecionados.size > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {mesesSelecionados.size} mês(es) selecionado(s) para replicação
                </p>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleReplicar}
              disabled={mesesSelecionados.size === 0 || loading}
            >
              {loading ? 'Replicando...' : `Replicar para ${mesesSelecionados.size} mês(es)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};