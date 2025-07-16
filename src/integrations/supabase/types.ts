export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratos_clientes: {
        Row: {
          acrescimo: number | null
          ativo: boolean | null
          categoria: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_vigencia_fim: string
          data_vigencia_inicio: string
          desconto: number | null
          especialidade: string
          id: string
          modalidade: string
          prioridade: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          acrescimo?: number | null
          ativo?: boolean | null
          categoria?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_vigencia_fim: string
          data_vigencia_inicio: string
          desconto?: number | null
          especialidade: string
          id?: string
          modalidade: string
          prioridade?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          acrescimo?: number | null
          ativo?: boolean | null
          categoria?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_vigencia_fim?: string
          data_vigencia_inicio?: string
          desconto?: number | null
          especialidade?: string
          id?: string
          modalidade?: string
          prioridade?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_realizados: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_exame: string
          especialidade: string
          id: string
          medico: string
          modalidade: string
          paciente: string
          prioridade: string | null
          status: string | null
          updated_at: string
          valor_bruto: number | null
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_exame: string
          especialidade: string
          id?: string
          medico: string
          modalidade: string
          paciente: string
          prioridade?: string | null
          status?: string | null
          updated_at?: string
          valor_bruto?: number | null
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_exame?: string
          especialidade?: string
          id?: string
          medico?: string
          modalidade?: string
          paciente?: string
          prioridade?: string | null
          status?: string | null
          updated_at?: string
          valor_bruto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exames_realizados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fatura_itens: {
        Row: {
          created_at: string
          descricao: string
          exame_id: string | null
          fatura_id: string
          id: string
          quantidade: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          exame_id?: string | null
          fatura_id: string
          id?: string
          quantidade?: number | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          created_at?: string
          descricao?: string
          exame_id?: string | null
          fatura_id?: string
          id?: string
          quantidade?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatura_itens_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_realizados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas_geradas"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_geradas: {
        Row: {
          acrescimo: number | null
          arquivo_pdf: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_email: string | null
          data_emissao: string
          data_vencimento: string
          desconto: number | null
          email_enviado: boolean | null
          id: string
          numero: string
          observacoes: string | null
          periodo: string
          status: string | null
          subtotal: number
          updated_at: string
          valor_total: number
        }
        Insert: {
          acrescimo?: number | null
          arquivo_pdf?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_email?: string | null
          data_emissao: string
          data_vencimento: string
          desconto?: number | null
          email_enviado?: boolean | null
          id?: string
          numero: string
          observacoes?: string | null
          periodo: string
          status?: string | null
          subtotal?: number
          updated_at?: string
          valor_total?: number
        }
        Update: {
          acrescimo?: number | null
          arquivo_pdf?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_email?: string | null
          data_emissao?: string
          data_vencimento?: string
          desconto?: number | null
          email_enviado?: boolean | null
          id?: string
          numero?: string
          observacoes?: string | null
          periodo?: string
          status?: string | null
          subtotal?: number
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_geradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      upload_logs: {
        Row: {
          created_at: string
          error_message: string | null
          file_type: string
          filename: string
          id: string
          records_processed: number | null
          status: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_type: string
          filename: string
          id?: string
          records_processed?: number | null
          status?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_type?: string
          filename?: string
          id?: string
          records_processed?: number | null
          status?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
