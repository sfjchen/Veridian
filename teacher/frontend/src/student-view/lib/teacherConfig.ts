export const DOT_THRESHOLDS = ['notational', 'mechanical', 'procedural', 'conceptual'] as const;
export const ANALYSIS_TRIGGERS = ['auto_idle', 'auto_page_change', 'manual_only', 'passive'] as const;
export const NOTIFICATION_STYLES = ['silent', 'toast', 'badge'] as const;
export const HINT_LEVELS = ['guided', 'minimal', 'detailed'] as const;

export type DotThreshold = (typeof DOT_THRESHOLDS)[number];
export type AnalysisTrigger = (typeof ANALYSIS_TRIGGERS)[number];
export type NotificationStyle = (typeof NOTIFICATION_STYLES)[number];
export type HintLevel = (typeof HINT_LEVELS)[number];

export type ResolvedConfig = {
  check_button_visible: boolean;
  dot_threshold: DotThreshold;
  max_dots_shown: number;
  analysis_trigger: AnalysisTrigger;
  analysis_debounce_seconds: number;
  notification_style: NotificationStyle;
  chat_enabled: boolean;
  hint_level: HintLevel;
  student_mistake_visibility: boolean;
};

export const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  check_button_visible: true,
  dot_threshold: 'mechanical',
  max_dots_shown: 0,
  analysis_trigger: 'auto_idle',
  analysis_debounce_seconds: 15,
  notification_style: 'toast',
  chat_enabled: true,
  hint_level: 'guided',
  student_mistake_visibility: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function asEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

export function normalizeResolvedConfig(value: unknown): ResolvedConfig {
  const raw = isRecord(value) ? value : {};
  return {
    check_button_visible: asBoolean(raw.check_button_visible, DEFAULT_RESOLVED_CONFIG.check_button_visible),
    dot_threshold: asEnum(raw.dot_threshold, DOT_THRESHOLDS, DEFAULT_RESOLVED_CONFIG.dot_threshold),
    max_dots_shown: asInt(raw.max_dots_shown, 0, 50, DEFAULT_RESOLVED_CONFIG.max_dots_shown),
    analysis_trigger: asEnum(raw.analysis_trigger, ANALYSIS_TRIGGERS, DEFAULT_RESOLVED_CONFIG.analysis_trigger),
    analysis_debounce_seconds: asInt(
      raw.analysis_debounce_seconds,
      1,
      300,
      DEFAULT_RESOLVED_CONFIG.analysis_debounce_seconds,
    ),
    notification_style: asEnum(
      raw.notification_style,
      NOTIFICATION_STYLES,
      DEFAULT_RESOLVED_CONFIG.notification_style,
    ),
    chat_enabled: asBoolean(raw.chat_enabled, DEFAULT_RESOLVED_CONFIG.chat_enabled),
    hint_level: asEnum(raw.hint_level, HINT_LEVELS, DEFAULT_RESOLVED_CONFIG.hint_level),
    student_mistake_visibility: asBoolean(raw.student_mistake_visibility, DEFAULT_RESOLVED_CONFIG.student_mistake_visibility),
  };
}
