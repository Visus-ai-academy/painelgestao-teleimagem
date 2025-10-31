import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Plus, Trash2, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Adicional {
  id?: string;
  data?: Date;
  valor: string;
  descricao: string;
}

interface MedicoAdicionais {
  medico_id: string;
  medico_nome: string;
  medico_cpf: string;
  medico_email: string;
  adicionais: Adicional[];
}

interface AdicionaisMedicosProps {
  periodoSelecionado: string;
  periodoBloqueado: boolean;
}

export function AdicionaisMedicos({ periodoSelecionado, periodoBloqueado }: AdicionaisMedicosProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [medicosAdicionais, setMedicosAdicionais] = useState<MedicoAdicionais[]>([]);

  // Carregar médicos ativos e seus adicionais
  useEffect(() => {
    carregarDados();
  }, [periodoSelecionado]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Buscar médicos ativos
      const { data: medicos, error: medicoError } = await supabase
        .from('medicos')
        .select('id, nome, cpf, email')
        .eq('ativo', true)
        .order('nome');

      if (medicoError) throw medicoError;

      // Buscar adicionais do período
      const { data: adicionais, error: adicionaisError } = await supabase
        .from('medicos_valores_adicionais')
        .select('*')
        .eq('periodo', periodoSelecionado);

      if (adicionaisError) throw adicionaisError;

      // Montar estrutura com médicos e seus adicionais
      const medicosComAdicionais: MedicoAdicionais[] = (medicos || []).map(medico => {
        const adicionaisMedico = (adicionais || [])
          .filter(a => a.medico_id === medico.id)
          .map(a => ({
            id: a.id,
            data: a.data_adicional ? new Date(a.data_adicional) : undefined,
            valor: String(a.valor_adicional || 0),
            descricao: a.descricao || ''
          }));

        // Garantir pelo menos 5 slots vazios
        while (adicionaisMedico.length < 5) {
          adicionaisMedico.push({
            id: undefined,
            data: undefined,
            valor: '',
            descricao: ''
          });
        }

        return {
          medico_id: medico.id,
          medico_nome: medico.nome,
          medico_cpf: medico.cpf || '',
          medico_email: medico.email || '',
          adicionais: adicionaisMedico.slice(0, 5) // Máximo 5 adicionais
        };
      });

      setMedicosAdicionais(medicosComAdicionais);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados dos médicos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdicionalChange = (medicoIndex: number, adicionalIndex: number, field: keyof Adicional, value: any) => {
    setMedicosAdicionais(prev => {
      const novos = [...prev];
      novos[medicoIndex].adicionais[adicionalIndex] = {
        ...novos[medicoIndex].adicionais[adicionalIndex],
        [field]: value
      };
      return novos;
    });
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);

      // Preparar dados para salvar
      const dadosParaSalvar = medicosAdicionais.flatMap(medico =>
        medico.adicionais
          .filter(a => a.data && a.valor && parseFloat(a.valor) > 0)
          .map(a => ({
            id: a.id,
            medico_id: medico.medico_id,
            periodo: periodoSelecionado,
            data_adicional: format(a.data!, 'yyyy-MM-dd'),
            valor_adicional: parseFloat(a.valor),
            descricao: a.descricao || null
          }))
      );

      // Deletar adicionais antigos do período
      await supabase
        .from('medicos_valores_adicionais')
        .delete()
        .eq('periodo', periodoSelecionado);

      // Inserir novos adicionais
      if (dadosParaSalvar.length > 0) {
        const { error } = await supabase
          .from('medicos_valores_adicionais')
          .insert(dadosParaSalvar);

        if (error) throw error;
      }

      toast({
        title: "Adicionais salvos",
        description: `${dadosParaSalvar.length} adicionais foram salvos com sucesso.`
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar adicionais:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os adicionais.",
        variant: "destructive"
      });
    } finally {
      setSalvando(false);
    }
  };

  const totalAdicionaisPorMedico = useMemo(() => {
    return medicosAdicionais.reduce((acc, medico) => {
      const total = medico.adicionais.reduce((sum, a) => {
        const valor = parseFloat(a.valor) || 0;
        return sum + valor;
      }, 0);
      acc[medico.medico_id] = total;
      return acc;
    }, {} as Record<string, number>);
  }, [medicosAdicionais]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Valores Adicionais</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Valores Adicionais - {periodoSelecionado}
            </CardTitle>
            <CardDescription>
              Adicione até 5 valores extras por médico (bonificações, horas extras, etc.)
            </CardDescription>
          </div>
          {periodoBloqueado && (
            <Badge variant="destructive">Período Bloqueado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {medicosAdicionais.map((medico, medicoIndex) => (
          <div key={medico.medico_id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{medico.medico_nome}</h3>
                <p className="text-sm text-muted-foreground">
                  CPF: {medico.medico_cpf} | {medico.medico_email}
                </p>
              </div>
              {totalAdicionaisPorMedico[medico.medico_id] > 0 && (
                <Badge variant="secondary" className="text-lg font-semibold">
                  Total: R$ {totalAdicionaisPorMedico[medico.medico_id].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              )}
            </div>

            <Separator />

            <div className="grid gap-3">
              {medico.adicionais.map((adicional, adicionalIndex) => (
                <div key={adicionalIndex} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !adicional.data && "text-muted-foreground"
                          )}
                          disabled={periodoBloqueado}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {adicional.data ? format(adicional.data, "dd/MM/yyyy", { locale: ptBR }) : "Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={adicional.data}
                          onSelect={(date) => handleAdicionalChange(medicoIndex, adicionalIndex, 'data', date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={adicional.valor}
                      onChange={(e) => handleAdicionalChange(medicoIndex, adicionalIndex, 'valor', e.target.value)}
                      disabled={periodoBloqueado}
                    />
                  </div>

                  <div className="col-span-6">
                    <Input
                      placeholder="Descrição (opcional)"
                      value={adicional.descricao}
                      onChange={(e) => handleAdicionalChange(medicoIndex, adicionalIndex, 'descricao', e.target.value)}
                      disabled={periodoBloqueado}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!periodoBloqueado && (
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSalvar}
              disabled={salvando}
              size="lg"
            >
              <Save className="mr-2 h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar Adicionais"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
