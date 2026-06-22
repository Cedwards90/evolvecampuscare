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
      active_time_sessions: {
        Row: {
          case_manager_id: string
          created_at: string
          notes: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          start_time: string
          student_id: string | null
        }
        Insert: {
          case_manager_id: string
          created_at?: string
          notes?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_time?: string
          student_id?: string | null
        }
        Update: {
          case_manager_id?: string
          created_at?: string
          notes?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_time?: string
          student_id?: string | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          case_manager_id: string | null
          content: Json
          created_at: string
          id: string
          insight_type: string
          is_dismissed: boolean | null
          request_id: string | null
        }
        Insert: {
          case_manager_id?: string | null
          content: Json
          created_at?: string
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          request_id?: string | null
        }
        Update: {
          case_manager_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          case_manager_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          meeting_link: string | null
          qr_session_id: string | null
          request_id: string | null
          scheduled_at: string
          status: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_manager_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          qr_session_id?: string | null
          request_id?: string | null
          scheduled_at: string
          status?: string | null
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          case_manager_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          qr_session_id?: string | null
          request_id?: string | null
          scheduled_at?: string
          status?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_invite_job_items: {
        Row: {
          created_at: string
          email: string
          error: string | null
          full_name: string | null
          id: string
          invitation_id: string | null
          job_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          full_name?: string | null
          id?: string
          invitation_id?: string | null
          job_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          full_name?: string | null
          id?: string
          invitation_id?: string | null
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_invite_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "bulk_invite_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_invite_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          failed: number
          id: string
          notes: string | null
          organization_id: string | null
          processed: number
          skipped: number
          status: string
          succeeded: number
          total: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          failed?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          processed?: number
          skipped?: number
          status?: string
          succeeded?: number
          total?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failed?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          processed?: number
          skipped?: number
          status?: string
          succeeded?: number
          total?: number
        }
        Relationships: []
      }
      career_intake_responses: {
        Row: {
          accomplishment_goal: string | null
          assistance_areas: string[]
          availability: Json
          career_influences: string | null
          completed_at: string | null
          considered_majors: string | null
          created_at: string
          created_by: string | null
          current_major: string | null
          dream_career: string | null
          educational_goal: string | null
          favorite_subjects: string | null
          has_computer_access: boolean | null
          id: string
          internet_skill_level: string | null
          least_favorite_subjects: string | null
          obstacles: string[]
          prior_assessments: string | null
          referral_sources: string[]
          strengths_skills: string | null
          student_id: string
          student_status: string | null
          updated_at: string
          work_experience: string | null
        }
        Insert: {
          accomplishment_goal?: string | null
          assistance_areas?: string[]
          availability?: Json
          career_influences?: string | null
          completed_at?: string | null
          considered_majors?: string | null
          created_at?: string
          created_by?: string | null
          current_major?: string | null
          dream_career?: string | null
          educational_goal?: string | null
          favorite_subjects?: string | null
          has_computer_access?: boolean | null
          id?: string
          internet_skill_level?: string | null
          least_favorite_subjects?: string | null
          obstacles?: string[]
          prior_assessments?: string | null
          referral_sources?: string[]
          strengths_skills?: string | null
          student_id: string
          student_status?: string | null
          updated_at?: string
          work_experience?: string | null
        }
        Update: {
          accomplishment_goal?: string | null
          assistance_areas?: string[]
          availability?: Json
          career_influences?: string | null
          completed_at?: string | null
          considered_majors?: string | null
          created_at?: string
          created_by?: string | null
          current_major?: string | null
          dream_career?: string | null
          educational_goal?: string | null
          favorite_subjects?: string | null
          has_computer_access?: boolean | null
          id?: string
          internet_skill_level?: string | null
          least_favorite_subjects?: string | null
          obstacles?: string[]
          prior_assessments?: string | null
          referral_sources?: string[]
          strengths_skills?: string | null
          student_id?: string
          student_status?: string | null
          updated_at?: string
          work_experience?: string | null
        }
        Relationships: []
      }
      certification_catalog: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          default_validity_months: number | null
          id: string
          is_active: boolean
          issuing_organization: string | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_validity_months?: number | null
          id?: string
          is_active?: boolean
          issuing_organization?: string | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_validity_months?: number | null
          id?: string
          is_active?: boolean
          issuing_organization?: string | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cohort_case_managers: {
        Row: {
          assigned_by: string | null
          case_manager_id: string
          cohort_id: string
          created_at: string
          id: string
        }
        Insert: {
          assigned_by?: string | null
          case_manager_id: string
          cohort_id: string
          created_at?: string
          id?: string
        }
        Update: {
          assigned_by?: string | null
          case_manager_id?: string
          cohort_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_case_managers_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "training_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_report_templates: {
        Row: {
          branding: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          sections: Json
          title: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sections?: Json
          title: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sections?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      file_notes: {
        Row: {
          author_id: string
          contact_date: string | null
          contact_type: string | null
          content: string
          created_at: string
          duration_minutes: number | null
          id: string
          identified_needs: number[]
          next_steps: string | null
          note_type: string
          referral_agency: string | null
          referral_contact: string | null
          student_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          contact_date?: string | null
          contact_type?: string | null
          content: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          identified_needs?: number[]
          next_steps?: string | null
          note_type?: string
          referral_agency?: string | null
          referral_contact?: string | null
          student_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          contact_date?: string | null
          contact_type?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          identified_needs?: number[]
          next_steps?: string | null
          note_type?: string
          referral_agency?: string | null
          referral_contact?: string | null
          student_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      folder_summary_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          evidence_counts: Json
          id: string
          section_counts: Json
          student_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          evidence_counts?: Json
          id?: string
          section_counts?: Json
          student_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          evidence_counts?: Json
          id?: string
          section_counts?: Json
          student_id?: string
        }
        Relationships: []
      }
      funding_goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metric_key: string
          organization_id: string | null
          period_end: string
          period_start: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_key: string
          organization_id?: string | null
          period_end: string
          period_start: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_key?: string
          organization_id?: string | null
          period_end?: string
          period_start?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      impact_report_audit: {
        Row: {
          actor_id: string
          created_at: string
          format: string
          id: string
          scope: Json
          template_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          format: string
          id?: string
          scope?: Json
          template_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          format?: string
          id?: string
          scope?: Json
          template_id?: string | null
        }
        Relationships: []
      }
      impact_survey_assignments: {
        Row: {
          created_at: string
          id: string
          last_completed_at: string | null
          next_due_at: string
          student_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_completed_at?: string | null
          next_due_at?: string
          student_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_completed_at?: string | null
          next_due_at?: string
          student_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_survey_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "impact_survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_survey_responses: {
        Row: {
          id: string
          responses: Json
          score_summary: Json
          student_id: string
          submitted_at: string
          template_id: string
        }
        Insert: {
          id?: string
          responses?: Json
          score_summary?: Json
          student_id: string
          submitted_at?: string
          template_id: string
        }
        Update: {
          id?: string
          responses?: Json
          score_summary?: Json
          student_id?: string
          submitted_at?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_survey_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "impact_survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_survey_templates: {
        Row: {
          cadence_days: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_builtin: boolean
          questions: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cadence_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          questions?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cadence_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          questions?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      intake_responses: {
        Row: {
          created_at: string
          id: string
          responses: Json
          section: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          responses?: Json
          section: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          responses?: Json
          section?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mfa_exemption_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nda_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          nda_document_id: string
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          nda_document_id: string
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          nda_document_id?: string
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nda_acceptances_nda_document_id_fkey"
            columns: ["nda_document_id"]
            isOneToOne: false
            referencedRelation: "nda_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nda_documents: {
        Row: {
          body_markdown: string
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_current: boolean
          title: string
          version: number
        }
        Insert: {
          body_markdown: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_current?: boolean
          title: string
          version: number
        }
        Update: {
          body_markdown?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_current?: boolean
          title?: string
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offline_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          id: string
          synced: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_data: Json
          id?: string
          synced?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: string
          synced?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: []
      }
      org_suspension_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "training_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_demographics: {
        Row: {
          age_range: string | null
          consent_at: string
          consent_version: string
          created_at: string
          disability_status: boolean | null
          ethnicity: string[] | null
          gender: string | null
          justice_involved: boolean | null
          student_id: string
          updated_at: string
          veteran_status: boolean | null
        }
        Insert: {
          age_range?: string | null
          consent_at: string
          consent_version?: string
          created_at?: string
          disability_status?: boolean | null
          ethnicity?: string[] | null
          gender?: string | null
          justice_involved?: boolean | null
          student_id: string
          updated_at?: string
          veteran_status?: boolean | null
        }
        Update: {
          age_range?: string | null
          consent_at?: string
          consent_version?: string
          created_at?: string
          disability_status?: boolean | null
          ethnicity?: string[] | null
          gender?: string | null
          justice_involved?: boolean | null
          student_id?: string
          updated_at?: string
          veteran_status?: boolean | null
        }
        Relationships: []
      }
      participant_funnel_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          organization_id: string | null
          qr_session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          qr_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          qr_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      participant_outcomes: {
        Row: {
          baseline_wage: number | null
          completion_reason: string | null
          created_at: string
          employer: string | null
          employment_status: string | null
          hourly_wage: number | null
          id: string
          job_title: string | null
          placement_date: string | null
          program_completed: boolean | null
          program_completion_date: string | null
          retention_180_date: string | null
          retention_180_met: boolean | null
          retention_30_date: string | null
          retention_30_met: boolean | null
          retention_365_date: string | null
          retention_365_met: boolean | null
          retention_60_date: string | null
          retention_60_met: boolean | null
          retention_90_date: string | null
          retention_90_met: boolean | null
          student_id: string
          updated_at: string
          updated_by: string | null
          weekly_hours: number | null
        }
        Insert: {
          baseline_wage?: number | null
          completion_reason?: string | null
          created_at?: string
          employer?: string | null
          employment_status?: string | null
          hourly_wage?: number | null
          id?: string
          job_title?: string | null
          placement_date?: string | null
          program_completed?: boolean | null
          program_completion_date?: string | null
          retention_180_date?: string | null
          retention_180_met?: boolean | null
          retention_30_date?: string | null
          retention_30_met?: boolean | null
          retention_365_date?: string | null
          retention_365_met?: boolean | null
          retention_60_date?: string | null
          retention_60_met?: boolean | null
          retention_90_date?: string | null
          retention_90_met?: boolean | null
          student_id: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours?: number | null
        }
        Update: {
          baseline_wage?: number | null
          completion_reason?: string | null
          created_at?: string
          employer?: string | null
          employment_status?: string | null
          hourly_wage?: number | null
          id?: string
          job_title?: string | null
          placement_date?: string | null
          program_completed?: boolean | null
          program_completion_date?: string | null
          retention_180_date?: string | null
          retention_180_met?: boolean | null
          retention_30_date?: string | null
          retention_30_met?: boolean | null
          retention_365_date?: string | null
          retention_365_met?: boolean | null
          retention_60_date?: string | null
          retention_60_met?: boolean | null
          retention_90_date?: string | null
          retention_90_met?: boolean | null
          student_id?: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours?: number | null
        }
        Relationships: []
      }
      post_graduation_plans: {
        Row: {
          additional_notes: string | null
          career_goals: string
          created_at: string
          education_goals: string
          financial_plan: string
          graduation_date: string | null
          health_wellness: string
          housing_plan: string
          id: string
          month_1_3_actions: string
          month_10_12_actions: string
          month_4_6_actions: string
          month_7_9_actions: string
          student_id: string
          support_needed: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          career_goals?: string
          created_at?: string
          education_goals?: string
          financial_plan?: string
          graduation_date?: string | null
          health_wellness?: string
          housing_plan?: string
          id?: string
          month_1_3_actions?: string
          month_10_12_actions?: string
          month_4_6_actions?: string
          month_7_9_actions?: string
          student_id: string
          support_needed?: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          career_goals?: string
          created_at?: string
          education_goals?: string
          financial_plan?: string
          graduation_date?: string | null
          health_wellness?: string
          housing_plan?: string
          id?: string
          month_1_3_actions?: string
          month_10_12_actions?: string
          month_4_6_actions?: string
          month_7_9_actions?: string
          student_id?: string
          support_needed?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cmf_preferred_contact_type: string | null
          cohort_id: string | null
          cohort_start_date: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          department: string | null
          email: string
          full_name: string | null
          graduation_date: string | null
          id: string
          mfa_exempt: boolean
          mfa_exempt_at: string | null
          mfa_exempt_by: string | null
          mfa_exempt_reason: string | null
          onboarding_completed_at: string | null
          organization_id: string | null
          phone: string | null
          placement_date: string | null
          preferred_contact: string | null
          preferred_language: string | null
          reactivated_at: string | null
          reactivated_by: string | null
          student_id: string | null
          updated_at: string
          user_id: string
          year_of_study: string | null
        }
        Insert: {
          avatar_url?: string | null
          cmf_preferred_contact_type?: string | null
          cohort_id?: string | null
          cohort_start_date?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          department?: string | null
          email: string
          full_name?: string | null
          graduation_date?: string | null
          id?: string
          mfa_exempt?: boolean
          mfa_exempt_at?: string | null
          mfa_exempt_by?: string | null
          mfa_exempt_reason?: string | null
          onboarding_completed_at?: string | null
          organization_id?: string | null
          phone?: string | null
          placement_date?: string | null
          preferred_contact?: string | null
          preferred_language?: string | null
          reactivated_at?: string | null
          reactivated_by?: string | null
          student_id?: string | null
          updated_at?: string
          user_id: string
          year_of_study?: string | null
        }
        Update: {
          avatar_url?: string | null
          cmf_preferred_contact_type?: string | null
          cohort_id?: string | null
          cohort_start_date?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          department?: string | null
          email?: string
          full_name?: string | null
          graduation_date?: string | null
          id?: string
          mfa_exempt?: boolean
          mfa_exempt_at?: string | null
          mfa_exempt_by?: string | null
          mfa_exempt_reason?: string | null
          onboarding_completed_at?: string | null
          organization_id?: string | null
          phone?: string | null
          placement_date?: string | null
          preferred_contact?: string | null
          preferred_language?: string | null
          reactivated_at?: string | null
          reactivated_by?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "training_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_cost_settings: {
        Row: {
          annual_program_cost: number
          avg_public_benefit_offset: number | null
          cost_per_participant_override: number | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          organization_id: string | null
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          annual_program_cost: number
          avg_public_benefit_offset?: number | null
          cost_per_participant_override?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          annual_program_cost?: number
          avg_public_benefit_offset?: number | null
          cost_per_participant_override?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string | null
          destination_type: string
          destination_url: string | null
          id: string
          is_active: boolean
          label: string
          organization_id: string | null
          prefill_category:
            | Database["public"]["Enums"]["request_category"]
            | null
          title: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          destination_type?: string
          destination_url?: string | null
          id?: string
          is_active?: boolean
          label: string
          organization_id?: string | null
          prefill_category?:
            | Database["public"]["Enums"]["request_category"]
            | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          destination_type?: string
          destination_url?: string | null
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string | null
          prefill_category?:
            | Database["public"]["Enums"]["request_category"]
            | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "training_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_events: {
        Row: {
          action_kind: Database["public"]["Enums"]["qr_action_kind"] | null
          created_at: string
          event_type: Database["public"]["Enums"]["qr_event_type"]
          id: string
          qr_code_id: string
          session_id: string
          target_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_kind?: Database["public"]["Enums"]["qr_action_kind"] | null
          created_at?: string
          event_type: Database["public"]["Enums"]["qr_event_type"]
          id?: string
          qr_code_id: string
          session_id: string
          target_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_kind?: Database["public"]["Enums"]["qr_action_kind"] | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["qr_event_type"]
          id?: string
          qr_code_id?: string
          session_id?: string
          target_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scan_events_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          request_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_share_audit: {
        Row: {
          action: Database["public"]["Enums"]["share_action"]
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          recipients: string[] | null
          request_id: string
          share_link_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["share_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          recipients?: string[] | null
          request_id: string
          share_link_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["share_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          recipients?: string[] | null
          request_id?: string
          share_link_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      request_share_links: {
        Row: {
          access_count: number
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          request_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          request_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          access_count?: number
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          request_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      request_updates: {
        Row: {
          created_at: string
          id: string
          is_internal: boolean | null
          new_status: Database["public"]["Enums"]["request_status"] | null
          note: string | null
          previous_status: Database["public"]["Enums"]["request_status"] | null
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean | null
          new_status?: Database["public"]["Enums"]["request_status"] | null
          note?: string | null
          previous_status?: Database["public"]["Enums"]["request_status"] | null
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean | null
          new_status?: Database["public"]["Enums"]["request_status"] | null
          note?: string | null
          previous_status?: Database["public"]["Enums"]["request_status"] | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_updates_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_survey_distributions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error: string | null
          failed_count: number
          id: string
          notes: string | null
          recipient_ids: string[]
          scheduled_for: string
          sent_count: number
          skipped_count: number
          status: string
          survey_type: string
          total_recipients: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          failed_count?: number
          id?: string
          notes?: string | null
          recipient_ids?: string[]
          scheduled_for: string
          sent_count?: number
          skipped_count?: number
          status?: string
          survey_type: string
          total_recipients?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          failed_count?: number
          id?: string
          notes?: string | null
          recipient_ids?: string[]
          scheduled_for?: string
          sent_count?: number
          skipped_count?: number
          status?: string
          survey_type?: string
          total_recipients?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      staff_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string
          request_id: string | null
          sender_id: string
          student_id: string | null
          subject: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id: string
          request_id?: string | null
          sender_id: string
          student_id?: string | null
          subject?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          request_id?: string | null
          sender_id?: string
          student_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_assignments: {
        Row: {
          assigned_by: string | null
          case_manager_id: string
          created_at: string
          id: string
          notes: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          case_manager_id: string
          created_at?: string
          id?: string
          notes?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          case_manager_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_certifications: {
        Row: {
          catalog_id: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          credential_id: string | null
          custom_name: string | null
          expiration_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          issuing_organization: string | null
          mime_type: string | null
          notes: string | null
          status: Database["public"]["Enums"]["certification_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          catalog_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          custom_name?: string | null
          expiration_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issuing_organization?: string | null
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["certification_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          custom_name?: string | null
          expiration_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issuing_organization?: string | null
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["certification_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_certifications_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "certification_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      student_checkins: {
        Row: {
          additional_notes: string | null
          blockers: string | null
          created_at: string
          id: string
          mood_rating: number
          progress_rating: number
          student_id: string
          updated_at: string
          wins: string | null
        }
        Insert: {
          additional_notes?: string | null
          blockers?: string | null
          created_at?: string
          id?: string
          mood_rating: number
          progress_rating: number
          student_id: string
          updated_at?: string
          wins?: string | null
        }
        Update: {
          additional_notes?: string | null
          blockers?: string | null
          created_at?: string
          id?: string
          mood_rating?: number
          progress_rating?: number
          student_id?: string
          updated_at?: string
          wins?: string | null
        }
        Relationships: []
      }
      student_files: {
        Row: {
          cmf_identified_needs: number[]
          created_at: string
          id: string
          intake_completed_at: string | null
          mentor_name: string | null
          primary_reason_for_contact: string | null
          received_on_caseload_date: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          cmf_identified_needs?: number[]
          created_at?: string
          id?: string
          intake_completed_at?: string | null
          mentor_name?: string | null
          primary_reason_for_contact?: string | null
          received_on_caseload_date?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          cmf_identified_needs?: number[]
          created_at?: string
          id?: string
          intake_completed_at?: string | null
          mentor_name?: string | null
          primary_reason_for_contact?: string | null
          received_on_caseload_date?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_personality_profiles: {
        Row: {
          assessed_on: string | null
          assessment_source: string | null
          assessment_url: string | null
          attachment_path: string | null
          created_at: string
          created_by: string | null
          energy_label: string | null
          energy_pct: number | null
          id: string
          identity_label: string | null
          identity_pct: number | null
          mind_label: string | null
          mind_pct: number | null
          nature_label: string | null
          nature_pct: number | null
          strengths: string[]
          student_id: string
          summary: string | null
          tactics_label: string | null
          tactics_pct: number | null
          type_code: string | null
          type_name: string | null
          updated_at: string
          weaknesses: string[]
        }
        Insert: {
          assessed_on?: string | null
          assessment_source?: string | null
          assessment_url?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          energy_label?: string | null
          energy_pct?: number | null
          id?: string
          identity_label?: string | null
          identity_pct?: number | null
          mind_label?: string | null
          mind_pct?: number | null
          nature_label?: string | null
          nature_pct?: number | null
          strengths?: string[]
          student_id: string
          summary?: string | null
          tactics_label?: string | null
          tactics_pct?: number | null
          type_code?: string | null
          type_name?: string | null
          updated_at?: string
          weaknesses?: string[]
        }
        Update: {
          assessed_on?: string | null
          assessment_source?: string | null
          assessment_url?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          energy_label?: string | null
          energy_pct?: number | null
          id?: string
          identity_label?: string | null
          identity_pct?: number | null
          mind_label?: string | null
          mind_pct?: number | null
          nature_label?: string | null
          nature_pct?: number | null
          strengths?: string[]
          student_id?: string
          summary?: string | null
          tactics_label?: string | null
          tactics_pct?: number | null
          type_code?: string | null
          type_name?: string | null
          updated_at?: string
          weaknesses?: string[]
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          approved_amount: number | null
          assigned_case_manager_id: string | null
          category: Database["public"]["Enums"]["request_category"]
          created_at: string
          description: string
          escalated_at: string | null
          id: string
          is_emergency: boolean | null
          priority: Database["public"]["Enums"]["request_priority"]
          qr_session_id: string | null
          requested_amount: number | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          assigned_case_manager_id?: string | null
          category: Database["public"]["Enums"]["request_category"]
          created_at?: string
          description: string
          escalated_at?: string | null
          id?: string
          is_emergency?: boolean | null
          priority?: Database["public"]["Enums"]["request_priority"]
          qr_session_id?: string | null
          requested_amount?: number | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          assigned_case_manager_id?: string | null
          category?: Database["public"]["Enums"]["request_category"]
          created_at?: string
          description?: string
          escalated_at?: string | null
          id?: string
          is_emergency?: boolean | null
          priority?: Database["public"]["Enums"]["request_priority"]
          qr_session_id?: string | null
          requested_amount?: number | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_invitations: {
        Row: {
          completed_at: string | null
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          email_status: string | null
          id: string
          notes: string | null
          sent_by: string
          student_id: string
          survey_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          notes?: string | null
          sent_by: string
          student_id: string
          survey_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          notes?: string | null
          sent_by?: string
          student_id?: string
          survey_type?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          billable: boolean
          case_manager_id: string
          created_at: string
          duration_minutes: number
          end_time: string
          entry_date: string
          id: string
          notes: string | null
          organization_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          start_time: string
          status: Database["public"]["Enums"]["time_entry_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          billable?: boolean
          case_manager_id: string
          created_at?: string
          duration_minutes?: number
          end_time: string
          entry_date: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_time: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          billable?: boolean
          case_manager_id?: string
          created_at?: string
          duration_minutes?: number
          end_time?: string
          entry_date?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_time?: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entry_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          diff: Json | null
          id: string
          time_entry_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          diff?: Json | null
          id?: string
          time_entry_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          diff?: Json | null
          id?: string
          time_entry_id?: string
        }
        Relationships: []
      }
      training_organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_filter_preferences: {
        Row: {
          filters: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          filters?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          filters?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          auto_assign_case_manager: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          invited_role: Database["public"]["Enums"]["app_role"]
          notes: string | null
          organization_id: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          auto_assign_case_manager?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          invited_role: Database["public"]["Enums"]["app_role"]
          notes?: string | null
          organization_id?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          auto_assign_case_manager?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_role?: Database["public"]["Enums"]["app_role"]
          notes?: string | null
          organization_id?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "training_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_status_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_student_data_health: {
        Args: never
        Returns: {
          certifications: number
          checkins: number
          intake_responses: number
          organization_id: string
          organization_name: string
          post_grad_plans: number
          student_folders: number
          students: number
          support_requests: number
        }[]
      }
      can_staff_access_request: {
        Args: { _request_id: string; _user: string }
        Returns: boolean
      }
      can_staff_manage_student: {
        Args: { _actor: string; _student: string }
        Returns: boolean
      }
      cm_can_access_student: {
        Args: { _actor: string; _student: string }
        Returns: boolean
      }
      cm_has_assignment: {
        Args: { _actor: string; _student: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin_of: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_suspended: { Args: { _org_id: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      is_user_org_suspended: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_admin_can_access_time_entry: {
        Args: { _actor: string; _entry_id: string }
        Returns: boolean
      }
      org_admin_orgs: { Args: { _user_id: string }; Returns: string[] }
      org_admin_sees_user: {
        Args: { _admin: string; _user: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_in_org_admin_scope: {
        Args: { _actor: string; _target_user: string }
        Returns: boolean
      }
      user_in_org_admin_scope_v2: {
        Args: { _actor: string; _target_user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "case_manager" | "admin" | "org_admin"
      certification_status: "in_progress" | "completed" | "expired" | "revoked"
      qr_action_kind: "request" | "meeting"
      qr_event_type:
        | "scan"
        | "auth_required"
        | "auth_completed"
        | "action_selected"
        | "action_started"
        | "action_completed"
      request_category:
        | "academic"
        | "financial"
        | "mental_health"
        | "housing"
        | "other"
      request_priority: "low" | "medium" | "high" | "emergency"
      request_status:
        | "submitted"
        | "in_progress"
        | "escalated"
        | "resolved"
        | "cancelled"
      service_type:
        | "direct_service"
        | "case_management"
        | "documentation"
        | "meeting"
        | "outreach"
        | "travel"
        | "other"
      share_action:
        | "download"
        | "email"
        | "link_created"
        | "link_revoked"
        | "link_accessed"
      time_entry_status: "pending" | "approved" | "rejected"
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
      app_role: ["student", "case_manager", "admin", "org_admin"],
      certification_status: ["in_progress", "completed", "expired", "revoked"],
      qr_action_kind: ["request", "meeting"],
      qr_event_type: [
        "scan",
        "auth_required",
        "auth_completed",
        "action_selected",
        "action_started",
        "action_completed",
      ],
      request_category: [
        "academic",
        "financial",
        "mental_health",
        "housing",
        "other",
      ],
      request_priority: ["low", "medium", "high", "emergency"],
      request_status: [
        "submitted",
        "in_progress",
        "escalated",
        "resolved",
        "cancelled",
      ],
      service_type: [
        "direct_service",
        "case_management",
        "documentation",
        "meeting",
        "outreach",
        "travel",
        "other",
      ],
      share_action: [
        "download",
        "email",
        "link_created",
        "link_revoked",
        "link_accessed",
      ],
      time_entry_status: ["pending", "approved", "rejected"],
    },
  },
} as const
