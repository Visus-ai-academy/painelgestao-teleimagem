import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegraExclusao {
  id: string;
  nome: string;
  descricao?: string;
  tipo_regra: string;
  criterios: any;
  prioridade: number;
  data_inicio?: string;
  data_fim?: string;
  aplicar_legado: boolean;
  aplicar_incremental: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function ListarRegrasExclusao() {
  const [regras, setRegras] = useState<RegraExclusao[]>([]);
  const [loading, setLoading] = useState(true);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});

  const buscarRegras = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('regras_exclusao_faturamento')
        .select('*')
        .order('prioridade', { ascending: true });

      if (error) {
        throw error;
      }

      setRegras(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar regras:', error);
      toast.error('Erro ao carregar regras de exclusão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarRegras();
  }, []);

  const formatarCriterios = (criterios: any) => {
    if (!criterios) return '';
    
    try {
      return JSON.stringify(criterios, null, 2);
    } catch {
      return String(criterios);
    }
  };

  const getStatusColor = (ativo: boolean) => {
    return ativo ? 'default' : 'secondary';
  };

  const getTipoColor = (tipo: string) => {
    const cores = {
      'cliente': 'blue',
      'modalidade': 'green',
      'especialidade': 'purple',
      'categoria': 'orange',
      'medico': 'pink',
      'periodo': 'yellow',
      'valor': 'red'
    };
    return cores[tipo as keyof typeof cores] || 'gray';
  };

  const getTipoNome = (tipo: string) => {
    const nomes = {
      'cliente': 'Clientes',
      'modalidade': 'Modalidades', 
      'especialidade': 'Especialidades',
      'categoria': 'Categorias',
      'medico': 'Médicos',
      'periodo': 'Períodos',
      'valor': 'Valores',
      'volumetria': 'Volumetria',
      'faturamento': 'Faturamento',
      'precos': 'Preços'
    };
    return nomes[tipo as keyof typeof nomes] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const toggleGrupo = (tipo: string) => {
    setGruposAbertos(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  // Agrupar regras por tipo
  const regrasAgrupadas = regras.reduce((grupos, regra) => {
    const tipo = regra.tipo_regra;
    if (!grupos[tipo]) {
      grupos[tipo] = [];
    }
    grupos[tipo].push(regra);
    return grupos;
  }, {} as Record<string, RegraExclusao[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Regras de Exclusão de Dados</h2>
        <Button 
          onClick={buscarRegras} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              Carregando regras de exclusão...
            </div>
          </CardContent>
        </Card>
      ) : regras.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              Nenhuma regra de exclusão encontrada
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(regrasAgrupadas).map(([tipo, regrasDoTipo]) => (
            <Card key={tipo}>
              <Collapsible
                open={gruposAbertos[tipo] ?? true}
                onOpenChange={() => toggleGrupo(tipo)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {gruposAbertos[tipo] ?? true ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-lg">{getTipoNome(tipo)}</CardTitle>
                        <Badge 
                          variant="outline"
                          className={`border-${getTipoColor(tipo)}-500 text-${getTipoColor(tipo)}-700`}
                        >
                          {regrasDoTipo.length} regra{regrasDoTipo.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          Ativas: {regrasDoTipo.filter(r => r.ativo).length}
                        </Badge>
                        <Badge variant="secondary">
                          Inativas: {regrasDoTipo.filter(r => !r.ativo).length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {regrasDoTipo.map((regra) => (
                        <Card key={regra.id} className={`${!regra.ativo ? 'opacity-60' : ''} border-l-4 border-l-${getTipoColor(tipo)}-500`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <CardTitle className="text-base">{regra.nome}</CardTitle>
                                {regra.descricao && (
                                  <p className="text-sm text-muted-foreground">
                                    {regra.descricao}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Badge variant={getStatusColor(regra.ativo)}>
                                  {regra.ativo ? 'Ativo' : 'Inativo'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Prioridade: {regra.prioridade}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <strong>Aplicar Legado:</strong> {regra.aplicar_legado ? 'Sim' : 'Não'}
                              </div>
                              <div>
                                <strong>Aplicar Incremental:</strong> {regra.aplicar_incremental ? 'Sim' : 'Não'}
                              </div>
                              <div>
                                <strong>Criado em:</strong> {new Date(regra.created_at).toLocaleDateString('pt-BR')}
                              </div>
                              {regra.data_inicio && (
                                <div>
                                  <strong>Data Início:</strong> {new Date(regra.data_inicio).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              {regra.data_fim && (
                                <div>
                                  <strong>Data Fim:</strong> {new Date(regra.data_fim).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <strong className="text-sm">Critérios:</strong>
                              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                                {formatarCriterios(regra.criterios)}
                              </pre>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground text-center">
        Total de regras: {regras.length} | Ativas: {regras.filter(r => r.ativo).length}
      </div>
    </div>
  );
}