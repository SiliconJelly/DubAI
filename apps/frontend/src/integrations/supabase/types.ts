export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          subscription_tier: string
          total_processing_time: number
          total_jobs_completed: number
          monthly_usage_minutes: number
          monthly_usage_reset_date: string
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: string
          total_processing_time?: number
          total_jobs_completed?: number
          monthly_usage_minutes?: number
          monthly_usage_reset_date?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: string
          total_processing_time?: number
          total_jobs_completed?: number
          monthly_usage_minutes?: number
          monthly_usage_reset_date?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      storage_files: {
        Row: {
          id: string
          user_id: string
          filename: string
          file_size: number
          mime_type: string
          storage_path: string
          file_type: string
          file_category: string
          metadata: Json
          is_temporary: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          file_size: number
          mime_type: string
          storage_path: string
          file_type: string
          file_category?: string
          metadata?: Json
          is_temporary?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          file_size?: number
          mime_type?: string
          storage_path?: string
          file_type?: string
          file_category?: string
          metadata?: Json
          is_temporary?: boolean
          expires_at?: string | null
          created_at?: string
        }
      }
      dubbing_jobs: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: string
          progress: number
          priority: number
          input_video_file_id: string | null
          input_srt_file_id: string | null
          output_audio_file_id: string | null
          output_srt_file_id: string | null
          output_video_file_id: string | null
          target_language: string
          tts_service_preference: string | null
          quality_preset: string
          processing_metrics: Json
          cost_breakdown: Json
          error_message: string | null
          error_details: Json | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: string
          progress?: number
          priority?: number
          input_video_file_id?: string | null
          input_srt_file_id?: string | null
          output_audio_file_id?: string | null
          output_srt_file_id?: string | null
          output_video_file_id?: string | null
          target_language?: string
          tts_service_preference?: string | null
          quality_preset?: string
          processing_metrics?: Json
          cost_breakdown?: Json
          error_message?: string | null
          error_details?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: string
          progress?: number
          priority?: number
          input_video_file_id?: string | null
          input_srt_file_id?: string | null
          output_audio_file_id?: string | null
          output_srt_file_id?: string | null
          output_video_file_id?: string | null
          target_language?: string
          tts_service_preference?: string | null
          quality_preset?: string
          processing_metrics?: Json
          cost_breakdown?: Json
          error_message?: string | null
          error_details?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      processing_metrics: {
        Row: {
          id: string
          job_id: string
          step_name: string
          step_order: number
          status: string
          start_time: string | null
          end_time: string | null
          duration_ms: number | null
          service_used: string | null
          cost_estimate: number
          input_size: number | null
          output_size: number | null
          metadata: Json
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          step_name: string
          step_order: number
          status?: string
          start_time?: string | null
          end_time?: string | null
          duration_ms?: number | null
          service_used?: string | null
          cost_estimate?: number
          input_size?: number | null
          output_size?: number | null
          metadata?: Json
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          step_name?: string
          step_order?: number
          status?: string
          start_time?: string | null
          end_time?: string | null
          duration_ms?: number | null
          service_used?: string | null
          cost_estimate?: number
          input_size?: number | null
          output_size?: number | null
          metadata?: Json
          error_message?: string | null
          created_at?: string
        }
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
