import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, AlertTriangle, Search, Mail, FileText, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MedicoStatus {
  medicoId: string;
  medicoNome: string;
  medicoCRM: string;
  medicoCPF: string;
  demonstrativoGerado: boolean;
  relatorioGerado: boolean;
  emailEnviado: boolean;
  omieContaGerada?: boolean;
  linkRelatorio?: string;
  emailDestino?: string;
  erro?: string;
  erroEmail?: string;
}

interface StatusPorMedicoProps {
  medicos: MedicoStatus[];
  onGerarRelatorio: (medicoId: string) => void;
  onEnviarEmail: (medicoId: string) => void;
  onVisualizarRelatorio: (medicoId: string) => void;
  processandoRelatorios?: Set<string>;
  processandoEmails?: Set<string>;
  filtro: string;
  onFiltroChange: (valor: string) => void;
  ordemAlfabetica: boolean;
  onOrdemChange: (ordem: boolean) => void;
  medicosSelecionados: Set<string>;
  onMedicoToggle: (medicoId: string) => void;
  onTodosMedicosToggle: (selecionar: boolean) => void;
}

export function StatusPorMedico({
  medicos,
  onGerarRelatorio,
  onEnviarEmail,
  onVisualizarRelatorio,
  processandoRelatorios = new Set(),
  processandoEmails = new Set(),
  filtro,
  onFiltroChange,
  ordemAlfabetica,
  onOrdemChange,
  medicosSelecionados,
  onMedicoToggle,
  onTodosMedicosToggle
}: StatusPorMedicoProps) {
  
  const getStatusBadge = (medico: MedicoStatus) => {
    if (medico.erro) {
      return <Badge variant="destructive">Erro</Badge>;
    }
    if (medico.emailEnviado) {
      return <Badge className="bg-green-500">Concluído</Badge>;
    }
    if (medico.relatorioGerado) {
      return <Badge className="bg-blue-500">Relatório Gerado</Badge>;
    }
    if (medico.demonstrativoGerado) {
      return <Badge className="bg-yellow-500">Demonstrativo Gerado</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const todosSelecionados = medicos.length > 0 && medicos.every(m => medicosSelecionados.has(m.medicoId));
  const algunsSelecionados = medicos.some(m => medicosSelecionados.has(m.medicoId)) && !todosSelecionados;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Status por Médico</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar médico..."
                value={filtro}
                onChange={(e) => onFiltroChange(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOrdemChange(!ordemAlfabetica)}
            >
              {ordemAlfabetica ? "A-Z" : "Z-A"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 border-b pb-3">
          <Checkbox
            checked={todosSelecionados}
            onCheckedChange={(checked) => onTodosMedicosToggle(checked === true)}
            ref={(el) => {
              if (el) {
                (el as any).indeterminate = algunsSelecionados;
              }
            }}
          />
          <span className="text-sm font-medium">
            {medicosSelecionados.size > 0 
              ? `${medicosSelecionados.size} médico(s) selecionado(s)`
              : "Selecionar todos"
            }
          </span>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {medicos.map((medico) => (
              <div
                key={medico.medicoId}
                className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <Checkbox
                    checked={medicosSelecionados.has(medico.medicoId)}
                    onCheckedChange={() => onMedicoToggle(medico.medicoId)}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{medico.medicoNome}</h4>
                      {getStatusBadge(medico)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CRM: {medico.medicoCRM} | CPF: {medico.medicoCPF}
                    </p>
                    {medico.emailDestino && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📧 {medico.emailDestino}
                      </p>
                    )}
                    {medico.erro && (
                      <p className="text-xs text-destructive mt-1">
                        ⚠️ {medico.erro}
                      </p>
                    )}
                    {medico.erroEmail && (
                      <p className="text-xs text-destructive mt-1">
                        ⚠️ Email: {medico.erroEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Ícones de status */}
                  <div className="flex gap-1">
                    {medico.demonstrativoGerado ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                    
                    {medico.relatorioGerado ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <FileText className="h-5 w-5 text-gray-400" />
                    )}
                    
                    {medico.emailEnviado ? (
                      <Mail className="h-5 w-5 text-green-500" />
                    ) : (
                      <Mail className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* Botões de ação */}
                  {medico.relatorioGerado && medico.linkRelatorio && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onVisualizarRelatorio(medico.medicoId)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}

                  {!medico.relatorioGerado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGerarRelatorio(medico.medicoId)}
                      disabled={processandoRelatorios.has(medico.medicoId)}
                    >
                      {processandoRelatorios.has(medico.medicoId) ? "Gerando..." : "Gerar"}
                    </Button>
                  )}

                  {medico.relatorioGerado && !medico.emailEnviado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEnviarEmail(medico.medicoId)}
                      disabled={processandoEmails.has(medico.medicoId)}
                    >
                      {processandoEmails.has(medico.medicoId) ? "Enviando..." : "Enviar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {medicos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum médico encontrado</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
