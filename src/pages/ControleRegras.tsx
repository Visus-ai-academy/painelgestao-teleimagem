import { AutoRegrasMaster } from '@/components/AutoRegrasMaster';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sistema Automático de Regras</h1>
        <p className="text-muted-foreground mt-1">
          Aplicação automática garantida das 27 regras de negócio sempre que dados são inseridos
        </p>
      </div>
      
      <AutoRegrasMaster />
      
      <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
        <h3 className="font-semibold text-lg mb-2">Como funciona o Sistema Automático</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Detecção Automática:</strong> Monitora uploads concluídos em tempo real</li>
          <li>• <strong>Aplicação Instantânea:</strong> Aplica todas as 27 regras automaticamente</li>
          <li>• <strong>Validação Garantida:</strong> Dados só são aceitos após aplicação bem-sucedida</li>
          <li>• <strong>Zero Intervenção:</strong> Não requer cliques ou ações manuais</li>
          <li>• <strong>Monitoramento:</strong> Logs e alertas para qualquer problema</li>
        </ul>
      </div>
    </div>
  );
}