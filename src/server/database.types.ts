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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      dataset_rows: {
        Row: {
          data: Json
          dataset_id: string
          row_number: number
        }
        Insert: {
          data: Json
          dataset_id: string
          row_number: number
        }
        Update: {
          data?: Json
          dataset_id?: string
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataset_rows_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          file_name: string
          format: string
          id: string
          name: string
          profile: Json
          row_count: number
          uploader_hash: string
        }
        Insert: {
          created_at?: string
          file_name: string
          format: string
          id?: string
          name: string
          profile: Json
          row_count: number
          uploader_hash: string
        }
        Update: {
          created_at?: string
          file_name?: string
          format?: string
          id?: string
          name?: string
          profile?: Json
          row_count?: number
          uploader_hash?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          body: string
          dataset_id: string
          id: string
          kind: string
          position: number
          related_measure: string | null
          stats: Json | null
          title: string
        }
        Insert: {
          body: string
          dataset_id: string
          id?: string
          kind: string
          position?: number
          related_measure?: string | null
          stats?: Json | null
          title: string
        }
        Update: {
          body?: string
          dataset_id?: string
          id?: string
          kind?: string
          position?: number
          related_measure?: string | null
          stats?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_related_measure_fkey"
            columns: ["related_measure"]
            isOneToOne: false
            referencedRelation: "measures"
            referencedColumns: ["slug"]
          },
        ]
      }
      measures: {
        Row: {
          annual_agg: string
          definition: string
          label: string
          side: string
          slug: string
          source_id: string | null
          unit: string
        }
        Insert: {
          annual_agg: string
          definition: string
          label: string
          side: string
          slug: string
          source_id?: string | null
          unit: string
        }
        Update: {
          annual_agg?: string
          definition?: string
          label?: string
          side?: string
          slug?: string
          source_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "measures_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          dimension: string
          geo_id: string
          grain: string
          measure_slug: string
          period: string
          value: number
        }
        Insert: {
          dimension?: string
          geo_id?: string
          grain: string
          measure_slug: string
          period: string
          value: number
        }
        Update: {
          dimension?: string
          geo_id?: string
          grain?: string
          measure_slug?: string
          period?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "observations_measure_slug_fkey"
            columns: ["measure_slug"]
            isOneToOne: false
            referencedRelation: "measures"
            referencedColumns: ["slug"]
          },
        ]
      }
      sources: {
        Row: {
          data_year: string
          id: string
          publisher: string
          retrieved_at: string
          slug: string
          title: string
          url: string
        }
        Insert: {
          data_year: string
          id?: string
          publisher: string
          retrieved_at: string
          slug: string
          title: string
          url: string
        }
        Update: {
          data_year?: string
          id?: string
          publisher?: string
          retrieved_at?: string
          slug?: string
          title?: string
          url?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
