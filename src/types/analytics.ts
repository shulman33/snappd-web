/**
 * Analytics types for screenshot view tracking
 */

export interface ViewEventData {
  screenshot_id: string;
  ip_hash: string;
  country: string | null;
  is_authenticated: boolean;
  is_owner: boolean;
  user_agent_hash: string | null;
}

export interface AnalyticsResponse {
  screenshot_id: string;
  total_views: number;
  unique_viewers: number;
  daily_stats: DailyStat[];
  country_distribution: CountryStats;
  created_at: string;
  updated_at: string;
}

export interface DailyStat {
  date: string;
  view_count: number;
  unique_viewers: number;
}

export type CountryStats = Record<string, number>;

export interface TrackViewRequest {
  shortId: string;
}

export interface TrackViewResponse {
  success: boolean;
}
