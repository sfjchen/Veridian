export type UserRole = "teacher" | "student";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
}

export interface AssignmentConfig {
  check_button_visible: boolean;
  dot_threshold: "notational" | "mechanical" | "procedural" | "conceptual";
  max_dots_shown: number;
  analysis_trigger: "auto_idle" | "auto_page_change" | "manual_only" | "passive";
  analysis_debounce_seconds: number;
  notification_style: "silent" | "toast" | "badge";
  chat_enabled: boolean;
  hint_level: "guided" | "minimal" | "detailed";
  student_mistake_visibility: boolean;
}

export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  class_code: string;
  created_at: string;
  config: Partial<AssignmentConfig>;
}

export interface Assignment {
  id: string;
  classroom_id: string;
  title: string;
  prompt_storage_path: string | null;
  answer_key_storage_path: string | null;
  context_file_ids: string[];
  due_date: string | null;
  created_at: string;
  config: Partial<AssignmentConfig>;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  storage_path: string;
  submitted_at: string;
  download_url?: string | null;
  student_display_name?: string | null;
}

export interface CorpusFile {
  id: string;
  classroom_id: string;
  display_name: string;
  storage_path: string;
  file_type: string;
  uploaded_at: string;
  download_url: string | null;
}

export interface AssignmentDetail extends Assignment {
  assignment_file_download_url?: string;
  answer_key_download_url?: string;
  resolved_config?: AssignmentConfig;
  classroom_config?: Partial<AssignmentConfig>;
}

export interface ClassroomStudent {
  student_id: string;
  display_name: string | null;
  joined_at: string;
}

export interface FaqTopic {
  topic: string;
  message_count: number;
  unique_students: number;
  student_percentage: number;
  sample_questions: string[];
}

export interface MistakeHeatmapStudent {
  student_id: string;
  display_name: string;
  tag_counts: Record<string, number>;
  total: number;
}

export interface MistakeHeatmapResponse {
  tags: string[];
  students: MistakeHeatmapStudent[];
  tag_totals: Record<string, number>;
}

export interface SeverityDistribution {
  conceptual: number;
  procedural: number;
  mechanical: number;
  notational: number;
}

export interface StudentMistakeProfile {
  student_id: string;
  display_name: string;
  total_mistakes: number;
  problems_attempted: number;
  mistake_rate: number;
  severity_distribution: SeverityDistribution;
  top_tags: { tag: string; count: number; severity: string }[];
  temporal: {
    assignment_id: string;
    assignment_title: string;
    date: string;
    mistake_count: number;
    tags: Record<string, number>;
  }[];
}

export interface ClassroomOverview {
  classroom_id: string;
  student_count: number;
  active_students: number;
  total_problems: number;
  total_mistakes: number;
  avg_mistakes_per_student: number;
  avg_mistakes_per_problem: number;
  most_common_tag: string | null;
  most_common_tag_count: number;
  severity_distribution: SeverityDistribution;
}

export interface AssignmentTrend {
  assignment_id: string;
  assignment_title: string;
  date: string;
  student_count: number;
  problem_count: number;
  total_mistakes: number;
  severity_distribution: SeverityDistribution;
}
