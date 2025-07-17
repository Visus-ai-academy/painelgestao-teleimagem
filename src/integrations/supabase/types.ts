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
      emails_cobranca: {
        Row: {
          assunto: string
          cliente_email: string
          corpo: string
          created_at: string
          enviado_em: string | null
          erro_mensagem: string | null
          fatura_id: string
          id: string
          regua_id: string
          status: string | null
        }
        Insert: {
          assunto: string
          cliente_email: string
          corpo: string
          created_at?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          fatura_id: string
          id?: string
          regua_id: string
          status?: string | null
        }
        Update: {
          assunto?: string
          cliente_email?: string
          corpo?: string
          created_at?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          fatura_id?: string
          id?: string
          regua_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_cobranca_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "omie_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_cobranca_regua_id_fkey"
            columns: ["regua_id"]
            isOneToOne: false
            referencedRelation: "regua_cobranca"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_medicas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          data_ausencia: string | null
          especialidade: string
          id: string
          medico_id: string
          modalidade: string
          motivo_ausencia: string | null
          observacoes: string | null
          status: string
          tipo_escala: string
          turno: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          data_ausencia?: string | null
          especialidade: string
          id?: string
          medico_id: string
          modalidade: string
          motivo_ausencia?: string | null
          observacoes?: string | null
          status?: string
          tipo_escala: string
          turno: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_ausencia?: string | null
          especialidade?: string
          id?: string
          medico_id?: string
          modalidade?: string
          motivo_ausencia?: string | null
          observacoes?: string | null
          status?: string
          tipo_escala?: string
          turno?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_medicas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
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
      medicos: {
        Row: {
          ativo: boolean
          created_at: string
          crm: string
          email: string | null
          especialidade: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          crm: string
          email?: string | null
          especialidade: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          crm?: string
          email?: string | null
          especialidade?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      omie_faturas: {
        Row: {
          cliente_email: string | null
          cliente_nome: string
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_fatura: string
          omie_id: string
          status: string | null
          sync_date: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome: string
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_fatura: string
          omie_id: string
          status?: string | null
          sync_date?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_fatura?: string
          omie_id?: string
          status?: string | null
          sync_date?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
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
      regua_cobranca: {
        Row: {
          ativo: boolean | null
          created_at: string
          dias_envio: number | null
          emails_enviados: number | null
          fatura_id: string
          id: string
          max_emails: number | null
          proximo_envio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          dias_envio?: number | null
          emails_enviados?: number | null
          fatura_id: string
          id?: string
          max_emails?: number | null
          proximo_envio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          dias_envio?: number | null
          emails_enviados?: number | null
          fatura_id?: string
          id?: string
          max_emails?: number | null
          proximo_envio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regua_cobranca_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "omie_faturas"
            referencedColumns: ["id"]
          },
        ]
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
      user_menu_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          granted: boolean
          id: string
          menu_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          menu_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          menu_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_manager_or_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      promote_user_to_admin: {
        Args: { user_email: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "medico"
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
    Enums: {
      app_role: ["admin", "manager", "user", "medico"],
    },
  },
} as const
