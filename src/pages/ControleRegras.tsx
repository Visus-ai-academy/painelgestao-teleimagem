import { ControleRegrasNegocio } from '@/components/ControleRegrasNegocio';
import { SistemaRegrasUnificado } from '@/components/SistemaRegrasUnificado';
import { MonitorTasks } from '@/components/MonitorTasks';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de Regras de Negócio</h1>
        <p className="text-muted-foreground mt-1">
          Sistema unificado de aplicação e validação de regras com processamento em lotes
        </p>
      </div>
      
      <MonitorTasks />
      <SistemaRegrasUnificado />
      <ControleRegrasNegocio />
    </div>
  );
}