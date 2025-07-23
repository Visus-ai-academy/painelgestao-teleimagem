import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, X, Calendar as CalendarIcon, Building, Stethoscope, FileText, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  dataEspecifica?: Date | null;
  cliente: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  equipe: string;
  medico: string;
  turno: string;
  plantao: string;
  regiao: string;
  estado: string;
  cidade: string;
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
  equipes: string[];
  turnos: string[];
  plantoes: string[];
  regioes: string[];
  estados: string[];
  cidades: string[];
}

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function VolumetriaAdvancedFilters({ filters, onFiltersChange }: VolumetriaAdvancedFiltersProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Estados para controlar quais blocos estão expandidos
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    periodo: false,
    cliente: false,
    laudo: false,
    equipe: false,
    regiao: false
  });

  const [options, setOptions] = useState<FilterOptions>({
    anos: [],
    clientes: [],
    modalidades: [],
    especialidades: [],
    prioridades: [],
    medicos: [],
    equipes: [],
    turnos: [],
    plantoes: [],
    regioes: [],
    estados: [],
    cidades: []
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
          .not('data_referencia', 'is', null),
        
        // Clientes únicos
        supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA')
          .not('EMPRESA', 'is', null),
        
        // Modalidades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('MODALIDADE')
          .not('MODALIDADE', 'is', null),
        
        // Especialidades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('ESPECIALIDADE')
          .not('ESPECIALIDADE', 'is', null),
        
        // Prioridades únicas
        supabase
          .from('volumetria_mobilemed')
          .select('PRIORIDADE')
          .not('PRIORIDADE', 'is', null),
        
        // Médicos únicos
        supabase
          .from('volumetria_mobilemed')
          .select('MEDICO')
          .not('MEDICO', 'is', null)
      ]);

      // Processar anos únicos
      const anosUnicos = [...new Set(
        (anosRes.data || [])
          .map(item => item.data_referencia ? new Date(item.data_referencia).getFullYear().toString() : null)
          .filter(Boolean)
      )].sort((a, b) => b.localeCompare(a)); // Mais recente primeiro

      // Processar outros dados únicos
      const clientesUnicos = [...new Set((clientesRes.data || []).map(item => item.EMPRESA).filter(Boolean))].sort();
      const modalidadesUnicas = [...new Set((modalidadesRes.data || []).map(item => item.MODALIDADE).filter(Boolean))].sort();
      const especialidadesUnicas = [...new Set((especialidadesRes.data || []).map(item => item.ESPECIALIDADE).filter(Boolean))].sort();
      const prioridadesUnicas = [...new Set((prioridadesRes.data || []).map(item => item.PRIORIDADE).filter(Boolean))].sort();
      const medicosUnicos = [...new Set((medicosRes.data || []).map(item => item.MEDICO).filter(Boolean))].sort();

      setOptions({
        anos: anosUnicos,
        clientes: clientesUnicos,
        modalidades: modalidadesUnicas,
        especialidades: especialidadesUnicas,
        prioridades: prioridadesUnicas,
        medicos: medicosUnicos,
        equipes: [],
        turnos: [],
        plantoes: [],
        regioes: [],
        estados: [],
        cidades: []
      });

      console.log('✅ Opções dos filtros carregadas:', {
        anos: anosUnicos.length,
        clientes: clientesUnicos.length,
        modalidades: modalidadesUnicas.length,
        especialidades: especialidadesUnicas.length,
        prioridades: prioridadesUnicas.length,
        medicos: medicosUnicos.length,
        equipes: equipesUnicas.length,
        turnos: turnosUnicos.length,
        plantoes: plantoesUnicos.length,
        regioes: regioesUnicas.length,
        estados: estadosUnicos.length,
        cidades: cidadesUnicas.length
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

  const updateFilter = (key: keyof VolumetriaFilters, value: string | Date | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      ano: 'todos',
      trimestre: 'todos',
      mes: 'todos',
      semana: 'todos',
      dia: 'todos',
      dataEspecifica: null,
      cliente: 'todos',
      modalidade: 'todos',
      especialidade: 'todos',
      categoria: 'todos',
      prioridade: 'todos',
      equipe: 'todos',
      medico: 'todos',
      turno: 'todos',
      plantao: 'todos',
      regiao: 'todos',
      estado: 'todos',
      cidade: 'todos'
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== 'todos' && value !== null && value !== undefined
  );

  // Função para alternar seções
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Função para obter filtros ativos por seção
  const getActiveFiltersForSection = (section: string) => {
    switch (section) {
      case 'periodo':
        return [
          filters.ano !== 'todos' ? `Ano: ${filters.ano}` : null,
          filters.trimestre !== 'todos' ? `Trimestre: ${filters.trimestre}º` : null,
          filters.mes !== 'todos' ? `Mês: ${months[parseInt(filters.mes) - 1]}` : null,
          filters.semana !== 'todos' ? `Semana: ${filters.semana}` : null,
          filters.dia !== 'todos' ? `Dia: ${filters.dia === 'especifico' && filters.dataEspecifica ? format(filters.dataEspecifica, "dd/MM/yyyy") : filters.dia}` : null
        ].filter(Boolean);
      case 'cliente':
        return [
          filters.cliente !== 'todos' ? `Cliente: ${filters.cliente}` : null
        ].filter(Boolean);
      case 'laudo':
        return [
          filters.modalidade !== 'todos' ? `Modalidade: ${filters.modalidade}` : null,
          filters.especialidade !== 'todos' ? `Especialidade: ${filters.especialidade}` : null,
          filters.categoria !== 'todos' ? `Categoria: ${filters.categoria}` : null,
          filters.prioridade !== 'todos' ? `Prioridade: ${filters.prioridade}` : null
        ].filter(Boolean);
      case 'equipe':
        return [
          filters.equipe !== 'todos' ? `Equipe: ${filters.equipe}` : null,
          filters.medico !== 'todos' ? `Médico: ${filters.medico}` : null,
          filters.turno !== 'todos' ? `Turno: ${filters.turno}` : null,
          filters.plantao !== 'todos' ? `Plantão: ${filters.plantao}` : null
        ].filter(Boolean);
      case 'regiao':
        return [
          filters.regiao !== 'todos' ? `Região: ${filters.regiao}` : null,
          filters.estado !== 'todos' ? `Estado: ${filters.estado}` : null,
          filters.cidade !== 'todos' ? `Cidade: ${filters.cidade}` : null
        ].filter(Boolean);
      default:
        return [];
    }
  };

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
                  {Object.values(filters).filter(value => value !== 'todos' && value !== null && value !== undefined).length} ativos
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

          {/* Filtros Ativos Resumidos */}
          {hasActiveFilters && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Filtros aplicados:</div>
              <div className="flex flex-wrap gap-1">
                {[
                  ...getActiveFiltersForSection('periodo'),
                  ...getActiveFiltersForSection('cliente'),
                  ...getActiveFiltersForSection('laudo'),
                  ...getActiveFiltersForSection('equipe'),
                  ...getActiveFiltersForSection('regiao')
                ].map((filter, index) => (
                  <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Seção de Botões dos Filtros */}
          <div className="flex flex-wrap gap-2">
            {/* Botão PERÍODO */}
            <Collapsible 
              open={expandedSections.periodo} 
              onOpenChange={() => toggleSection('periodo')}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={getActiveFiltersForSection('periodo').length > 0 ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Período
                  {getActiveFiltersForSection('periodo').length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">
                      {getActiveFiltersForSection('periodo').length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Ano</label>
                    <Select value={filters.ano} onValueChange={(value) => updateFilter('ano', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border">
                        <SelectItem value="todos">Todos</SelectItem>
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
                      <SelectContent className="z-50 bg-background border">
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
                      <SelectContent className="z-50 bg-background border">
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
                      <SelectContent className="z-50 bg-background border">
                        <SelectItem value="todos">Todas</SelectItem>
                        <SelectItem value="1">Última semana</SelectItem>
                        <SelectItem value="2">Últimas 2 semanas</SelectItem>
                        <SelectItem value="4">Últimas 4 semanas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Dia</label>
                    <Select value={filters.dia} onValueChange={(value) => {
                      updateFilter('dia', value);
                      if (value !== 'especifico') {
                        updateFilter('dataEspecifica', null);
                        setShowDatePicker(false);
                      }
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border">
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="hoje">Hoje</SelectItem>
                        <SelectItem value="ontem">Ontem</SelectItem>
                        <SelectItem value="anteontem">Anteontem</SelectItem>
                        <SelectItem value="ultimos5dias">Últimos 5 dias</SelectItem>
                        <SelectItem value="especifico">Data específica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Datepicker para data específica - só aparece quando necessário */}
                  {filters.dia === 'especifico' && (
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Selecionar Data</label>
                      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8 text-xs justify-start",
                              !filters.dataEspecifica && "text-muted-foreground"
                            )}
                            onClick={() => setShowDatePicker(true)}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {filters.dataEspecifica ? format(filters.dataEspecifica, "dd/MM/yyyy") : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50 bg-background border" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dataEspecifica || undefined}
                            onSelect={(date) => {
                              updateFilter('dataEspecifica', date || null);
                              setShowDatePicker(false);
                            }}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Botão CLIENTE */}
            <Collapsible 
              open={expandedSections.cliente} 
              onOpenChange={() => toggleSection('cliente')}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={getActiveFiltersForSection('cliente').length > 0 ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <Building className="h-4 w-4" />
                  Cliente
                  {getActiveFiltersForSection('cliente').length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">
                      {getActiveFiltersForSection('cliente').length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/10">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                  <Select value={filters.cliente} onValueChange={(value) => updateFilter('cliente', value)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                      <SelectItem value="todos">Todos</SelectItem>
                      {options.clientes.map(cliente => (
                        <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Botão TIPO DE LAUDO */}
            <Collapsible 
              open={expandedSections.laudo} 
              onOpenChange={() => toggleSection('laudo')}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={getActiveFiltersForSection('laudo').length > 0 ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Tipo de Laudo
                  {getActiveFiltersForSection('laudo').length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">
                      {getActiveFiltersForSection('laudo').length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Modalidade</label>
                    <Select value={filters.modalidade} onValueChange={(value) => updateFilter('modalidade', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
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
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
                        {options.especialidades.map(especialidade => (
                          <SelectItem key={especialidade} value={especialidade}>{especialidade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                    <Select value={filters.categoria} onValueChange={(value) => updateFilter('categoria', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border">
                        <SelectItem value="todos">Todas</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgente">Urgente</SelectItem>
                        <SelectItem value="Emergência">Emergência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                    <Select value={filters.prioridade} onValueChange={(value) => updateFilter('prioridade', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
                        {options.prioridades.map(prioridade => (
                          <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Botão EQUIPE MÉDICA */}
            <Collapsible 
              open={expandedSections.equipe} 
              onOpenChange={() => toggleSection('equipe')}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={getActiveFiltersForSection('equipe').length > 0 ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <Stethoscope className="h-4 w-4" />
                  Equipe Médica
                  {getActiveFiltersForSection('equipe').length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">
                      {getActiveFiltersForSection('equipe').length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Equipe</label>
                    <Select value={filters.equipe} onValueChange={(value) => updateFilter('equipe', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
                        {options.equipes.map(equipe => (
                          <SelectItem key={equipe} value={equipe}>{equipe}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Médico</label>
                    <Select value={filters.medico} onValueChange={(value) => updateFilter('medico', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todos</SelectItem>
                        {options.medicos.map(medico => (
                          <SelectItem key={medico} value={medico}>{medico}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Turno</label>
                    <Select value={filters.turno} onValueChange={(value) => updateFilter('turno', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todos</SelectItem>
                        {options.turnos.map(turno => (
                          <SelectItem key={turno} value={turno}>{turno}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Plantão</label>
                    <Select value={filters.plantao} onValueChange={(value) => updateFilter('plantao', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todos</SelectItem>
                        {options.plantoes.map(plantao => (
                          <SelectItem key={plantao} value={plantao}>{plantao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Botão REGIÃO */}
            <Collapsible 
              open={expandedSections.regiao} 
              onOpenChange={() => toggleSection('regiao')}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={getActiveFiltersForSection('regiao').length > 0 ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Região
                  {getActiveFiltersForSection('regiao').length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">
                      {getActiveFiltersForSection('regiao').length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Região</label>
                    <Select value={filters.regiao} onValueChange={(value) => updateFilter('regiao', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
                        {options.regioes.map(regiao => (
                          <SelectItem key={regiao} value={regiao}>{regiao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Estado</label>
                    <Select value={filters.estado} onValueChange={(value) => updateFilter('estado', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todos</SelectItem>
                        {options.estados.map(estado => (
                          <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                    <Select value={filters.cidade} onValueChange={(value) => updateFilter('cidade', value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background border max-h-60 overflow-y-auto">
                        <SelectItem value="todos">Todas</SelectItem>
                        {options.cidades.map(cidade => (
                          <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}