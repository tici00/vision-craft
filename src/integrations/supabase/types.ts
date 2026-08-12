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
      clip_candidates: {
        Row: {
          analysis_notes: string | null
          analysis_sources: string[]
          clarity_score: number | null
          comment_potential_score: number | null
          created_at: string
          creator_affinity_score: number | null
          criteria: string[]
          curiosity_score: number | null
          description: string | null
          duration_seconds: number
          emotion_score: number | null
          end_seconds: number
          evaluated_at: string | null
          evaluation_model: string | null
          evaluations: Json
          has_speech: boolean | null
          hook_score: number | null
          id: string
          job_id: string | null
          keywords: string[]
          order_index: number
          originality_score: number | null
          overall_potential_score: number | null
          pacing_score: number | null
          payoff_score: number | null
          project_id: string
          quality_score: number | null
          reach_expansion_score: number | null
          reason: string | null
          relevance_score: number | null
          replay_score: number | null
          retention_score: number | null
          score: number | null
          shareability_score: number | null
          start_seconds: number
          status: string
          status_message: string | null
          title: string
          topic: string | null
          transcript_excerpt: string | null
          updated_at: string
        }
        Insert: {
          analysis_notes?: string | null
          analysis_sources?: string[]
          clarity_score?: number | null
          comment_potential_score?: number | null
          created_at?: string
          creator_affinity_score?: number | null
          criteria?: string[]
          curiosity_score?: number | null
          description?: string | null
          duration_seconds: number
          emotion_score?: number | null
          end_seconds: number
          evaluated_at?: string | null
          evaluation_model?: string | null
          evaluations?: Json
          has_speech?: boolean | null
          hook_score?: number | null
          id?: string
          job_id?: string | null
          keywords?: string[]
          order_index?: number
          originality_score?: number | null
          overall_potential_score?: number | null
          pacing_score?: number | null
          payoff_score?: number | null
          project_id: string
          quality_score?: number | null
          reach_expansion_score?: number | null
          reason?: string | null
          relevance_score?: number | null
          replay_score?: number | null
          retention_score?: number | null
          score?: number | null
          shareability_score?: number | null
          start_seconds: number
          status?: string
          status_message?: string | null
          title?: string
          topic?: string | null
          transcript_excerpt?: string | null
          updated_at?: string
        }
        Update: {
          analysis_notes?: string | null
          analysis_sources?: string[]
          clarity_score?: number | null
          comment_potential_score?: number | null
          created_at?: string
          creator_affinity_score?: number | null
          criteria?: string[]
          curiosity_score?: number | null
          description?: string | null
          duration_seconds?: number
          emotion_score?: number | null
          end_seconds?: number
          evaluated_at?: string | null
          evaluation_model?: string | null
          evaluations?: Json
          has_speech?: boolean | null
          hook_score?: number | null
          id?: string
          job_id?: string | null
          keywords?: string[]
          order_index?: number
          originality_score?: number | null
          overall_potential_score?: number | null
          pacing_score?: number | null
          payoff_score?: number | null
          project_id?: string
          quality_score?: number | null
          reach_expansion_score?: number | null
          reason?: string | null
          relevance_score?: number | null
          replay_score?: number | null
          retention_score?: number | null
          score?: number | null
          shareability_score?: number | null
          start_seconds?: number
          status?: string
          status_message?: string | null
          title?: string
          topic?: string | null
          transcript_excerpt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clip_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_configurations: {
        Row: {
          analysis_mode: Database["public"]["Enums"]["analysis_mode"]
          analysis_notes: string | null
          avoid_similar_clips: boolean
          clip_max_seconds: number | null
          clip_min_seconds: number | null
          clips_duration_preference: string
          clips_quantity: number | null
          clips_quantity_mode: string
          clips_selection_criteria: string[]
          content_types: string[]
          created_at: string
          has_multiple_languages: boolean
          highlights_context_level: Database["public"]["Enums"]["context_level"]
          highlights_criteria: string[]
          highlights_duration_minutes: number
          highlights_duration_mode: string
          highlights_editing_style: Database["public"]["Enums"]["highlights_style"]
          highlights_target_seconds: number | null
          id: string
          important_audio_video_flags: string[]
          language_mode: Database["public"]["Enums"]["language_mode"]
          long_edit_intensity:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          long_edit_remove_flags: string[]
          main_activity: string | null
          preserve_context_level: Database["public"]["Enums"]["context_level"]
          preserve_visual_events: boolean
          preserve_webcam_reactions: boolean
          primary_language: string
          project_id: string
          remove_low_activity: boolean
          remove_repetitions: boolean
          remove_silences: boolean
          remove_waiting: boolean
          secondary_languages: string[]
          silence_threshold_seconds: number | null
          speech_priority: Database["public"]["Enums"]["speech_priority"]
          transcription_language: string | null
          updated_at: string
          video_context: string | null
          want_highlights: boolean
          want_long_edit: boolean
          want_short_clips: boolean
        }
        Insert: {
          analysis_mode?: Database["public"]["Enums"]["analysis_mode"]
          analysis_notes?: string | null
          avoid_similar_clips?: boolean
          clip_max_seconds?: number | null
          clip_min_seconds?: number | null
          clips_duration_preference?: string
          clips_quantity?: number | null
          clips_quantity_mode?: string
          clips_selection_criteria?: string[]
          content_types?: string[]
          created_at?: string
          has_multiple_languages?: boolean
          highlights_context_level?: Database["public"]["Enums"]["context_level"]
          highlights_criteria?: string[]
          highlights_duration_minutes?: number
          highlights_duration_mode?: string
          highlights_editing_style?: Database["public"]["Enums"]["highlights_style"]
          highlights_target_seconds?: number | null
          id?: string
          important_audio_video_flags?: string[]
          language_mode?: Database["public"]["Enums"]["language_mode"]
          long_edit_intensity?:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          long_edit_remove_flags?: string[]
          main_activity?: string | null
          preserve_context_level?: Database["public"]["Enums"]["context_level"]
          preserve_visual_events?: boolean
          preserve_webcam_reactions?: boolean
          primary_language?: string
          project_id: string
          remove_low_activity?: boolean
          remove_repetitions?: boolean
          remove_silences?: boolean
          remove_waiting?: boolean
          secondary_languages?: string[]
          silence_threshold_seconds?: number | null
          speech_priority?: Database["public"]["Enums"]["speech_priority"]
          transcription_language?: string | null
          updated_at?: string
          video_context?: string | null
          want_highlights?: boolean
          want_long_edit?: boolean
          want_short_clips?: boolean
        }
        Update: {
          analysis_mode?: Database["public"]["Enums"]["analysis_mode"]
          analysis_notes?: string | null
          avoid_similar_clips?: boolean
          clip_max_seconds?: number | null
          clip_min_seconds?: number | null
          clips_duration_preference?: string
          clips_quantity?: number | null
          clips_quantity_mode?: string
          clips_selection_criteria?: string[]
          content_types?: string[]
          created_at?: string
          has_multiple_languages?: boolean
          highlights_context_level?: Database["public"]["Enums"]["context_level"]
          highlights_criteria?: string[]
          highlights_duration_minutes?: number
          highlights_duration_mode?: string
          highlights_editing_style?: Database["public"]["Enums"]["highlights_style"]
          highlights_target_seconds?: number | null
          id?: string
          important_audio_video_flags?: string[]
          language_mode?: Database["public"]["Enums"]["language_mode"]
          long_edit_intensity?:
            | Database["public"]["Enums"]["edit_intensity"]
            | null
          long_edit_remove_flags?: string[]
          main_activity?: string | null
          preserve_context_level?: Database["public"]["Enums"]["context_level"]
          preserve_visual_events?: boolean
          preserve_webcam_reactions?: boolean
          primary_language?: string
          project_id?: string
          remove_low_activity?: boolean
          remove_repetitions?: boolean
          remove_silences?: boolean
          remove_waiting?: boolean
          secondary_languages?: string[]
          silence_threshold_seconds?: number | null
          speech_priority?: Database["public"]["Enums"]["speech_priority"]
          transcription_language?: string | null
          updated_at?: string
          video_context?: string | null
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
          metadata: Json
          order_index: number
          original_duration_seconds: number | null
          project_id: string
          removed_seconds: number | null
          segment_ids: string[]
          source_end_seconds: number | null
          source_start_seconds: number | null
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
          metadata?: Json
          order_index?: number
          original_duration_seconds?: number | null
          project_id: string
          removed_seconds?: number | null
          segment_ids?: string[]
          source_end_seconds?: number | null
          source_start_seconds?: number | null
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
          metadata?: Json
          order_index?: number
          original_duration_seconds?: number | null
          project_id?: string
          removed_seconds?: number | null
          segment_ids?: string[]
          source_end_seconds?: number | null
          source_start_seconds?: number | null
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
          attempt_count: number
          cancel_requested: boolean
          configuration_snapshot: Json | null
          created_at: string
          current_step: string | null
          error_message: string | null
          estimated_seconds_remaining: number | null
          failed_stage: Database["public"]["Enums"]["analysis_stage"] | null
          finished_at: string | null
          id: string
          last_heartbeat_at: string | null
          logs: Json
          progress: number
          project_id: string
          queued_at: string
          request_payload: Json | null
          requested_outputs: string[]
          stage: Database["public"]["Enums"]["analysis_stage"]
          stage_message: string | null
          stage_started_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          steps: Json
          updated_at: string
          waiting_for_worker: boolean
          worker_last_sync_at: string | null
          worker_payload: Json | null
          worker_stage: string | null
          worker_task_id: string | null
        }
        Insert: {
          attempt_count?: number
          cancel_requested?: boolean
          configuration_snapshot?: Json | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          failed_stage?: Database["public"]["Enums"]["analysis_stage"] | null
          finished_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          logs?: Json
          progress?: number
          project_id: string
          queued_at?: string
          request_payload?: Json | null
          requested_outputs?: string[]
          stage?: Database["public"]["Enums"]["analysis_stage"]
          stage_message?: string | null
          stage_started_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          steps?: Json
          updated_at?: string
          waiting_for_worker?: boolean
          worker_last_sync_at?: string | null
          worker_payload?: Json | null
          worker_stage?: string | null
          worker_task_id?: string | null
        }
        Update: {
          attempt_count?: number
          cancel_requested?: boolean
          configuration_snapshot?: Json | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          failed_stage?: Database["public"]["Enums"]["analysis_stage"] | null
          finished_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          logs?: Json
          progress?: number
          project_id?: string
          queued_at?: string
          request_payload?: Json | null
          requested_outputs?: string[]
          stage?: Database["public"]["Enums"]["analysis_stage"]
          stage_message?: string | null
          stage_started_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          steps?: Json
          updated_at?: string
          waiting_for_worker?: boolean
          worker_last_sync_at?: string | null
          worker_payload?: Json | null
          worker_stage?: string | null
          worker_task_id?: string | null
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
      processing_usage: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          project_id: string | null
          rendered_clips: number | null
          source_duration_seconds: number | null
          stage_details: Json
          transcribed_seconds: number | null
          worker_seconds: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          project_id?: string | null
          rendered_clips?: number | null
          source_duration_seconds?: number | null
          stage_details?: Json
          transcribed_seconds?: number | null
          worker_seconds?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          project_id?: string | null
          rendered_clips?: number | null
          source_duration_seconds?: number | null
          stage_details?: Json
          transcribed_seconds?: number | null
          worker_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          analysis_completed_at: string | null
          analysis_error: string | null
          analysis_progress: number
          analysis_stage: Database["public"]["Enums"]["analysis_stage"] | null
          analysis_started_at: string | null
          analysis_status: Database["public"]["Enums"]["analysis_status"]
          created_at: string
          detected_language: string | null
          duration_seconds: number | null
          id: string
          language_confidence: number | null
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
          analysis_completed_at?: string | null
          analysis_error?: string | null
          analysis_progress?: number
          analysis_stage?: Database["public"]["Enums"]["analysis_stage"] | null
          analysis_started_at?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          created_at?: string
          detected_language?: string | null
          duration_seconds?: number | null
          id?: string
          language_confidence?: number | null
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
          analysis_completed_at?: string | null
          analysis_error?: string | null
          analysis_progress?: number
          analysis_stage?: Database["public"]["Enums"]["analysis_stage"] | null
          analysis_started_at?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          created_at?: string
          detected_language?: string | null
          duration_seconds?: number | null
          id?: string
          language_confidence?: number | null
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
          actual_result: Json
          candidate_id: string | null
          category: string | null
          confidence: number | null
          created_at: string
          criteria: string[]
          duration_seconds: number
          feedback: Json
          file_size_bytes: number | null
          id: string
          job_id: string | null
          kept: boolean
          metrics: Json
          metrics_updated_at: string | null
          order_index: number
          performance: Json
          platform: string | null
          predicted_performance: Json
          project_id: string
          publication_caption: string | null
          publication_hashtags: string[]
          publication_url: string | null
          published: boolean
          published_at: string | null
          reason: string | null
          render_error: string | null
          render_status: string
          source_end_seconds: number | null
          source_start_seconds: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          actual_result?: Json
          candidate_id?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          criteria?: string[]
          duration_seconds: number
          feedback?: Json
          file_size_bytes?: number | null
          id?: string
          job_id?: string | null
          kept?: boolean
          metrics?: Json
          metrics_updated_at?: string | null
          order_index?: number
          performance?: Json
          platform?: string | null
          predicted_performance?: Json
          project_id: string
          publication_caption?: string | null
          publication_hashtags?: string[]
          publication_url?: string | null
          published?: boolean
          published_at?: string | null
          reason?: string | null
          render_error?: string | null
          render_status?: string
          source_end_seconds?: number | null
          source_start_seconds: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          actual_result?: Json
          candidate_id?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          criteria?: string[]
          duration_seconds?: number
          feedback?: Json
          file_size_bytes?: number | null
          id?: string
          job_id?: string | null
          kept?: boolean
          metrics?: Json
          metrics_updated_at?: string | null
          order_index?: number
          performance?: Json
          platform?: string | null
          predicted_performance?: Json
          project_id?: string
          publication_caption?: string | null
          publication_hashtags?: string[]
          publication_url?: string | null
          published?: boolean
          published_at?: string | null
          reason?: string | null
          render_error?: string | null
          render_status?: string
          source_end_seconds?: number | null
          source_start_seconds?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_clips_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "clip_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_clips_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transcriptions: {
        Row: {
          created_at: string
          detected_language: string | null
          duration_seconds: number | null
          id: string
          job_id: string | null
          language: string | null
          model: string | null
          project_id: string
          provider: string | null
          requested_language: string | null
          segments: Json
          source_kind: string | null
          source_storage_path: string | null
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_language?: string | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          language?: string | null
          model?: string | null
          project_id: string
          provider?: string | null
          requested_language?: string | null
          segments?: Json
          source_kind?: string | null
          source_storage_path?: string | null
          text?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_language?: string | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          language?: string | null
          model?: string | null
          project_id?: string
          provider?: string | null
          requested_language?: string | null
          segments?: Json
          source_kind?: string | null
          source_storage_path?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcriptions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_segments: {
        Row: {
          analysis_sources: string[]
          audio_energy_score: number | null
          category: string | null
          context_score: number | null
          created_at: string
          decision: Database["public"]["Enums"]["segment_decision"]
          duration_seconds: number
          end_seconds: number
          id: string
          novelty_score: number | null
          overall_score: number | null
          project_id: string
          reaction_score: number | null
          reason: string | null
          reason_codes: string[]
          reason_summary: string | null
          related_result_id: string | null
          score: number | null
          speech_score: number | null
          start_seconds: number
          transcript_score: number | null
          updated_at: string
          visual_score: number | null
        }
        Insert: {
          analysis_sources?: string[]
          audio_energy_score?: number | null
          category?: string | null
          context_score?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["segment_decision"]
          duration_seconds: number
          end_seconds: number
          id?: string
          novelty_score?: number | null
          overall_score?: number | null
          project_id: string
          reaction_score?: number | null
          reason?: string | null
          reason_codes?: string[]
          reason_summary?: string | null
          related_result_id?: string | null
          score?: number | null
          speech_score?: number | null
          start_seconds: number
          transcript_score?: number | null
          updated_at?: string
          visual_score?: number | null
        }
        Update: {
          analysis_sources?: string[]
          audio_energy_score?: number | null
          category?: string | null
          context_score?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["segment_decision"]
          duration_seconds?: number
          end_seconds?: number
          id?: string
          novelty_score?: number | null
          overall_score?: number | null
          project_id?: string
          reaction_score?: number | null
          reason?: string | null
          reason_codes?: string[]
          reason_summary?: string | null
          related_result_id?: string | null
          score?: number | null
          speech_score?: number | null
          start_seconds?: number
          transcript_score?: number | null
          updated_at?: string
          visual_score?: number | null
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
      analysis_mode: "audio_only" | "audio_speech" | "multimodal"
      analysis_stage:
        | "queued"
        | "preparing"
        | "extracting_audio"
        | "detecting_language"
        | "transcribing"
        | "analyzing_audio"
        | "analyzing_video"
        | "combining_signals"
        | "scoring_segments"
        | "preparing_outputs"
        | "rendering"
        | "completed"
        | "failed"
      analysis_status:
        | "not_configured"
        | "configured"
        | "queued"
        | "running"
        | "completed"
        | "error"
      context_level: "minimal" | "balanced" | "high"
      edit_intensity: "conservative" | "balanced" | "aggressive"
      generated_video_kind: "highlights" | "long_edit"
      highlights_style: "dynamic" | "balanced" | "complete"
      job_status: "queued" | "running" | "completed" | "cancelled" | "error"
      language_mode: "manual" | "auto"
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
      speech_priority: "always" | "preferred" | "optional"
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
      analysis_mode: ["audio_only", "audio_speech", "multimodal"],
      analysis_stage: [
        "queued",
        "preparing",
        "extracting_audio",
        "detecting_language",
        "transcribing",
        "analyzing_audio",
        "analyzing_video",
        "combining_signals",
        "scoring_segments",
        "preparing_outputs",
        "rendering",
        "completed",
        "failed",
      ],
      analysis_status: [
        "not_configured",
        "configured",
        "queued",
        "running",
        "completed",
        "error",
      ],
      context_level: ["minimal", "balanced", "high"],
      edit_intensity: ["conservative", "balanced", "aggressive"],
      generated_video_kind: ["highlights", "long_edit"],
      highlights_style: ["dynamic", "balanced", "complete"],
      job_status: ["queued", "running", "completed", "cancelled", "error"],
      language_mode: ["manual", "auto"],
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
      speech_priority: ["always", "preferred", "optional"],
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
