import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskData {
  arquivo_fonte?: string;
  lote_upload?: string;
  periodo_referencia?: string;
  upload_id?: string;
}

interface SystemTask {
  id: string;
  task_type: string;
  task_data: TaskData;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  processed_at?: string | null;
}

export function useSystemTasks() {
  const [tasks, setTasks] = useState<SystemTask[]>([]);
  const [loading, setLoading] = useState(false);

  const buscarTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('system_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Converter os dados para o tipo correto
      const tasksTyped: SystemTask[] = (data || []).map(task => ({
        ...task,
        task_data: task.task_data as TaskData,
        status: task.status as SystemTask['status']
      }));
      
      setTasks(tasksTyped);
    } catch (error) {
      console.error('Erro ao buscar tasks:', error);
    }
  };

  // Tasks são processadas automaticamente pelo sistema

  // Limpeza automática será implementada via cron job

  useEffect(() => {
    buscarTasks();
    
    // Atualizar lista a cada 10 segundos
    const interval = setInterval(buscarTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  return {
    tasks,
    loading,
    buscarTasks
  };
}