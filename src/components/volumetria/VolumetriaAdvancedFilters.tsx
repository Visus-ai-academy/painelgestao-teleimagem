import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X, Calendar, Building, Stethoscope, Users, Zap, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  cliente: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  medico: string;
  equipe: string;
  tipoCliente: string;
}

interface VolumetriaAdvancedFiltersProps {
  filters: VolumetriaFilters;
  onFiltersChange: (filters: VolumetriaFilters) => void;
}

interface FilterOptions {
  anos: string[];
  clientes: string[];
  modalidades: string[];
  especialidades: string[];
  prioridades: string[];
  medicos: string[];
}

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function VolumetriaAdvancedFilters({ filters, onFiltersChange }: VolumetriaAdvancedFiltersProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FilterOptions>({
    anos: [],
    clientes: [],
    modalidades: [],
    especialidades: [],
    prioridades: [],
    medicos: []
  });

  // Carregar opções dos filtros baseado nos dados reais
  const loadFilterOptions = useCallback(async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      console.log('🔄 Carregando opções dos filtros...');

      // Buscar todos os dados únicos em paralelo
      const [anosRes, clientesRes, modalidadesRes, especialidadesRes, prioridadesRes, medicosRes] = await Promise.all([
        // Anos únicos baseados em data_referencia
        supabase
          .from('volumetria_mobilemed')
          .select('data_referencia')
          .not('data_referencia', 'is', null)
          .order('data_referencia', { ascending: false }),
        
        // Clientes únicos
        supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA')
          .not('EMPRESA', 'is', null)
          .order('EMPRESA'),
        
        // Modalidades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('MODALIDADE')
          .not('MODALIDADE', 'is', null)
          .order('MODALIDADE'),
        
        // Especialidades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('ESPECIALIDADE')
          .not('ESPECIALIDADE', 'is', null)
          .order('ESPECIALIDADE'),
        
        // Prioridades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('PRIORIDADE')
          .not('PRIORIDADE', 'is', null)
          .order('PRIORIDADE'),
        
        // Médicos únicos
        supabase
          .from('volumetria_mobilemed')
          .select('MEDICO')
          .not('MEDICO', 'is', null)
          .order('MEDICO')
      ]);

      // Processar anos únicos
      const anosUnicos = [...new Set(
        (anosRes.data || [])
          .map(item => item.data_referencia ? new Date(item.data_referencia).getFullYear().toString() : null)
          .filter(Boolean)
      )].sort((a, b) => b.localeCompare(a)); // Mais recente primeiro

      // Processar outros dados únicos
      const clientesUnicos = [...new Set((clientesRes.data || []).map(item => item.EMPRESA).filter(Boolean))];
      const modalidadesUnicas = [...new Set((modalidadesRes.data || []).map(item => item.MODALIDADE).filter(Boolean))];
      const especialidadesUnicas = [...new Set((especialidadesRes.data || []).map(item => item.ESPECIALIDADE).filter(Boolean))];
      const prioridadesUnicas = [...new Set((prioridadesRes.data || []).map(item => item.PRIORIDADE).filter(Boolean))];
      const medicosUnicos = [...new Set((medicosRes.data || []).map(item => item.MEDICO).filter(Boolean))];

      setOptions({
        anos: anosUnicos,
        clientes: clientesUnicos,
        modalidades: modalidadesUnicas,
        especialidades: especialidadesUnicas,
        prioridades: prioridadesUnicas,
        medicos: medicosUnicos
      });

      console.log('✅ Opções dos filtros carregadas:', {
        anos: anosUnicos.length,
        clientes: clientesUnicos.length,
        modalidades: modalidadesUnicas.length,
        especialidades: especialidadesUnicas.length,
        prioridades: prioridadesUnicas.length,
        medicos: medicosUnicos.length
      });

    } catch (error) {
      console.error('❌ Erro ao carregar opções dos filtros:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar opções dos filtros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const updateFilter = (key: keyof VolumetriaFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      ano: 'todos',
      trimestre: 'todos',
      mes: 'todos',
      semana: 'todos',
      dia: 'todos',
      cliente: 'todos',
      modalidade: 'todos',
      especialidade: 'todos',
      categoria: 'todos',
      prioridade: 'todos',
      medico: 'todos',
      equipe: 'todos',
      tipoCliente: 'todos'
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== 'todos');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando filtros...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Filtros Avançados</h3>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  {Object.values(filters).filter(value => value !== 'todos').length} ativos
                </Badge>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filtros de Tempo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Período</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ano</label>
                <Select value={filters.ano} onValueChange={(value) => updateFilter('ano', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Anos</SelectItem>
                    {options.anos.map(ano => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Trimestre</label>
                <Select value={filters.trimestre} onValueChange={(value) => updateFilter('trimestre', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="1">1º Trimestre</SelectItem>
                    <SelectItem value="2">2º Trimestre</SelectItem>
                    <SelectItem value="3">3º Trimestre</SelectItem>
                    <SelectItem value="4">4º Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Mês</label>
                <Select value={filters.mes} onValueChange={(value) => updateFilter('mes', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {months.map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Semana</label>
                <Select value={filters.semana} onValueChange={(value) => updateFilter('semana', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="1">Última semana</SelectItem>
                    <SelectItem value="2">Últimas 2 semanas</SelectItem>
                    <SelectItem value="4">Últimas 4 semanas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Dia Específico</label>
                <Select value={filters.dia} onValueChange={(value) => updateFilter('dia', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="ontem">Ontem</SelectItem>
                    <SelectItem value="anteontem">Anteontem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Filtros de Cliente */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Cliente</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                <Select value={filters.cliente} onValueChange={(value) => updateFilter('cliente', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Clientes ({options.clientes.length})</SelectItem>
                    {options.clientes.map(cliente => (
                      <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select value={filters.tipoCliente} onValueChange={(value) => updateFilter('tipoCliente', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Categorias</SelectItem>
                    <SelectItem value="CO">Cliente CO (Corporativo)</SelectItem>
                    <SelectItem value="NC">Cliente NC (Nacional)</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="padrao">Padrão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Filtros Médicos */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Dados Médicos</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Modalidade</label>
                <Select value={filters.modalidade} onValueChange={(value) => updateFilter('modalidade', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas ({options.modalidades.length})</SelectItem>
                    {options.modalidades.map(modalidade => (
                      <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Especialidade</label>
                <Select value={filters.especialidade} onValueChange={(value) => updateFilter('especialidade', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas ({options.especialidades.length})</SelectItem>
                    {options.especialidades.map(especialidade => (
                      <SelectItem key={especialidade} value={especialidade}>{especialidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                <Select value={filters.prioridade} onValueChange={(value) => updateFilter('prioridade', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas ({options.prioridades.length})</SelectItem>
                    {options.prioridades.map(prioridade => (
                      <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Filtros de Equipe */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Equipe Médica</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Médico</label>
                <Select value={filters.medico} onValueChange={(value) => updateFilter('medico', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Médicos ({options.medicos.length})</SelectItem>
                    {options.medicos.map(medico => (
                      <SelectItem key={medico} value={medico}>{medico}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Equipe</label>
                <Select value={filters.equipe} onValueChange={(value) => updateFilter('equipe', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Equipes</SelectItem>
                    <SelectItem value="manhã">Equipe Manhã</SelectItem>
                    <SelectItem value="tarde">Equipe Tarde</SelectItem>
                    <SelectItem value="noite">Equipe Noite</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Resumo dos Filtros Ativos */}
          {hasActiveFilters && (
            <div className="pt-2 border-t">
              <div className="flex flex-wrap gap-1">
                {Object.entries(filters).map(([key, value]) => {
                  if (value === 'todos') return null;
                  
                  const getFilterLabel = (key: string) => {
                    const labels: Record<string, string> = {
                      ano: 'Ano',
                      trimestre: 'Trimestre',
                      mes: 'Mês',
                      semana: 'Semana',
                      dia: 'Dia',
                      cliente: 'Cliente',
                      modalidade: 'Modalidade',
                      especialidade: 'Especialidade',
                      categoria: 'Categoria',
                      prioridade: 'Prioridade',
                      medico: 'Médico',
                      equipe: 'Equipe',
                      tipoCliente: 'Categoria'
                    };
                    return labels[key] || key;
                  };

                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {getFilterLabel(key)}: {value}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}