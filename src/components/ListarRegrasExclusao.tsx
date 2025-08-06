import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
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
        <div className="grid gap-4">
          {regras.map((regra) => (
            <Card key={regra.id} className={!regra.ativo ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{regra.nome}</CardTitle>
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
                    <Badge 
                      variant="outline"
                      className={`border-${getTipoColor(regra.tipo_regra)}-500 text-${getTipoColor(regra.tipo_regra)}-700`}
                    >
                      {regra.tipo_regra.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Prioridade:</strong> {regra.prioridade}
                  </div>
                  <div>
                    <strong>Aplicar Legado:</strong> {regra.aplicar_legado ? 'Sim' : 'Não'}
                  </div>
                  <div>
                    <strong>Aplicar Incremental:</strong> {regra.aplicar_incremental ? 'Sim' : 'Não'}
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
                  <div>
                    <strong>Criado em:</strong> {new Date(regra.created_at).toLocaleDateString('pt-BR')}
                  </div>
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
      )}

      <div className="text-sm text-muted-foreground text-center">
        Total de regras: {regras.length} | Ativas: {regras.filter(r => r.ativo).length}
      </div>
    </div>
  );
}