export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          source_ref: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source_ref?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source_ref?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence: {
        Row: {
          created_at: string
          event_id: string
          file_hash: string | null
          functional_label: string
          id: string
          kind: string
          processing_error: string | null
          processing_status: string
          storage_path: string | null
          supplier_id: string | null
          text_content: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_hash?: string | null
          functional_label?: string
          id?: string
          kind: string
          processing_error?: string | null
          processing_status?: string
          storage_path?: string | null
          supplier_id?: string | null
          text_content?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_hash?: string | null
          functional_label?: string
          id?: string
          kind?: string
          processing_error?: string | null
          processing_status?: string
          storage_path?: string | null
          supplier_id?: string | null
          text_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products_canonical: {
        Row: {
          created_at: string
          critical_schema: Json | null
          id: string
          name_canonical: string
          status_review: boolean | null
          unit_standard: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          critical_schema?: Json | null
          id?: string
          name_canonical: string
          status_review?: boolean | null
          unit_standard?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          critical_schema?: Json | null
          id?: string
          name_canonical?: string
          status_review?: boolean | null
          unit_standard?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          attrs: Json | null
          confidence: Json | null
          created_at: string
          description_supplier: string | null
          id: string
          needs_review: boolean | null
          normalized_qty: number | null
          normalized_unit: string | null
          normalized_unit_price: number | null
          product_canonical_id: string | null
          qty: number | null
          quote_id: string
          source_ref: Json | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
          user_id: string
        }
        Insert: {
          attrs?: Json | null
          confidence?: Json | null
          created_at?: string
          description_supplier?: string | null
          id?: string
          needs_review?: boolean | null
          normalized_qty?: number | null
          normalized_unit?: string | null
          normalized_unit_price?: number | null
          product_canonical_id?: string | null
          qty?: number | null
          quote_id: string
          source_ref?: Json | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          user_id: string
        }
        Update: {
          attrs?: Json | null
          confidence?: Json | null
          created_at?: string
          description_supplier?: string | null
          id?: string
          needs_review?: boolean | null
          normalized_qty?: number | null
          normalized_unit?: string | null
          normalized_unit_price?: number | null
          product_canonical_id?: string | null
          qty?: number | null
          quote_id?: string
          source_ref?: Json | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          confidence_overall: number | null
          created_at: string
          event_id: string
          evidence_id: string
          id: string
          lead_time_days: number | null
          lead_time_notes: string | null
          minimum_order_notes: string | null
          minimum_order_qty: number | null
          minimum_order_value: number | null
          needs_review: boolean | null
          payment_terms: string | null
          shipping_cost: number | null
          shipping_terms: string | null
          source_ref: Json | null
          supplier_id: string
          updated_at: string
          user_id: string
          validity_days: number | null
        }
        Insert: {
          confidence_overall?: number | null
          created_at?: string
          event_id: string
          evidence_id: string
          id?: string
          lead_time_days?: number | null
          lead_time_notes?: string | null
          minimum_order_notes?: string | null
          minimum_order_qty?: number | null
          minimum_order_value?: number | null
          needs_review?: boolean | null
          payment_terms?: string | null
          shipping_cost?: number | null
          shipping_terms?: string | null
          source_ref?: Json | null
          supplier_id: string
          updated_at?: string
          user_id: string
          validity_days?: number | null
        }
        Update: {
          confidence_overall?: number | null
          created_at?: string
          event_id?: string
          evidence_id?: string
          id?: string
          lead_time_days?: number | null
          lead_time_notes?: string | null
          minimum_order_notes?: string | null
          minimum_order_qty?: number | null
          minimum_order_value?: number | null
          needs_review?: boolean | null
          payment_terms?: string | null
          shipping_cost?: number | null
          shipping_terms?: string | null
          source_ref?: Json | null
          supplier_id?: string
          updated_at?: string
          user_id?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      review_queue: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event_id: string
          id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event_id: string
          id?: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_id?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name_canonical: string | null
          name_raw: string
          phone: string | null
          status_review: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_canonical?: string | null
          name_raw: string
          phone?: string | null
          status_review?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name_canonical?: string | null
          name_raw?: string
          phone?: string | null
          status_review?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
