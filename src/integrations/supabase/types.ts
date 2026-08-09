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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      edit_configurations: {
        Row: {
          clip_max_seconds: number | null
          clip_min_seconds: number | null
          created_at: string
          highlights_target_seconds: number | null
          id: string
          long_edit_intensity:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          project_id: string
          updated_at: string
          want_highlights: boolean
          want_long_edit: boolean
          want_short_clips: boolean
        }
        Insert: {
          clip_max_seconds?: number | null
          clip_min_seconds?: number | null
          created_at?: string
          highlights_target_seconds?: number | null
          id?: string
          long_edit_intensity?:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          project_id: string
          updated_at?: string
          want_highlights?: boolean
          want_long_edit?: boolean
          want_short_clips?: boolean
        }
        Update: {
          clip_max_seconds?: number | null
          clip_min_seconds?: number | null
          created_at?: string
          highlights_target_seconds?: number | null
          id?: string
          long_edit_intensity?:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          project_id?: string
          updated_at?: string
          want_highlights?: boolean
          want_long_edit?: boolean
          want_short_clips?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "edit_configurations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_videos: {
        Row: {
          created_at: string
          cuts_count: number | null
          final_duration_seconds: number | null
          id: string
          kind: Database["public"]["Enums"]["generated_video_kind"]
          original_duration_seconds: number | null
          project_id: string
          removed_seconds: number | null
          segment_ids: string[]
          thumbnail_url: string | null
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          cuts_count?: number | null
          final_duration_seconds?: number | null
          id?: string
          kind: Database["public"]["Enums"]["generated_video_kind"]
          original_duration_seconds?: number | null
          project_id: string
          removed_seconds?: number | null
          segment_ids?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          cuts_count?: number | null
          final_duration_seconds?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["generated_video_kind"]
          original_duration_seconds?: number | null
          project_id?: string
          removed_seconds?: number | null
          segment_ids?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          cancel_requested: boolean
          created_at: string
          current_step: string | null
          error_message: string | null
          estimated_seconds_remaining: number | null
          finished_at: string | null
          id: string
          progress: number
          project_id: string
          queued_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          steps: Json
          updated_at: string
        }
        Insert: {
          cancel_requested?: boolean
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          finished_at?: string | null
          id?: string
          progress?: number
          project_id: string
          queued_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          steps?: Json
          updated_at?: string
        }
        Update: {
          cancel_requested?: boolean
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          finished_at?: string | null
          id?: string
          progress?: number
          project_id?: string
          queued_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          name: string
          notes: string | null
          processing_types: string[]
          source_file_name: string | null
          source_file_size: number | null
          source_format: string | null
          source_mime_type: string | null
          source_storage_path: string | null
          source_stored_file_name: string | null
          source_uploaded_at: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          thumbnail_url: string | null
          updated_at: string
          upload_error: string | null
          upload_status: Database["public"]["Enums"]["upload_status"]
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name: string
          notes?: string | null
          processing_types?: string[]
          source_file_name?: string | null
          source_file_size?: number | null
          source_format?: string | null
          source_mime_type?: string | null
          source_storage_path?: string | null
          source_stored_file_name?: string | null
          source_uploaded_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          updated_at?: string
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"]
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name?: string
          notes?: string | null
          processing_types?: string[]
          source_file_name?: string | null
          source_file_size?: number | null
          source_format?: string | null
          source_mime_type?: string | null
          source_storage_path?: string | null
          source_stored_file_name?: string | null
          source_uploaded_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          updated_at?: string
          upload_error?: string | null
          upload_status?: Database["public"]["Enums"]["upload_status"]
        }
        Relationships: []
      }
      short_clips: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string
          duration_seconds: number
          id: string
          kept: boolean
          project_id: string
          source_start_seconds: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          duration_seconds: number
          id?: string
          kept?: boolean
          project_id: string
          source_start_seconds: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          duration_seconds?: number
          id?: string
          kept?: boolean
          project_id?: string
          source_start_seconds?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_segments: {
        Row: {
          category: string | null
          created_at: string
          decision: Database["public"]["Enums"]["segment_decision"]
          duration_seconds: number
          end_seconds: number
          id: string
          project_id: string
          reason: string | null
          related_result_id: string | null
          score: number | null
          start_seconds: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["segment_decision"]
          duration_seconds: number
          end_seconds: number
          id?: string
          project_id: string
          reason?: string | null
          related_result_id?: string | null
          score?: number | null
          start_seconds: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["segment_decision"]
          duration_seconds?: number
          end_seconds?: number
          id?: string
          project_id?: string
          reason?: string | null
          related_result_id?: string | null
          score?: number | null
          start_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      edit_intensity: "conservative" | "balanced" | "aggressive"
      generated_video_kind: "highlights" | "long_edit"
      job_status: "queued" | "running" | "completed" | "cancelled" | "error"
      project_status:
        | "draft"
        | "ready"
        | "queued"
        | "processing"
        | "analyzing"
        | "generating_clips"
        | "rendering"
        | "completed"
        | "error"
      segment_decision: "keep" | "cut" | "undecided"
      upload_status:
        | "none"
        | "preparing"
        | "uploading"
        | "finalizing"
        | "uploaded"
        | "error"
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
      edit_intensity: ["conservative", "balanced", "aggressive"],
      generated_video_kind: ["highlights", "long_edit"],
      job_status: ["queued", "running", "completed", "cancelled", "error"],
      project_status: [
        "draft",
        "ready",
        "queued",
        "processing",
        "analyzing",
        "generating_clips",
        "rendering",
        "completed",
        "error",
      ],
      segment_decision: ["keep", "cut", "undecided"],
      upload_status: [
        "none",
        "preparing",
        "uploading",
        "finalizing",
        "uploaded",
        "error",
      ],
    },
  },
} as const
