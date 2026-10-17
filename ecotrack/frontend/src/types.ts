/**
 * EcoTrack - TypeScript Interfaces & Data Models
 */

export type ActivityType =
  | 'reusable_bottle'
  | 'public_transport'
  | 'cycling_walking'
  | 'waste_segregation'
  | 'tree_care';

export interface Activity {
  _id: string;
  activityType: ActivityType;
  activityDate: string;
  quantity: number;
  description?: string;
  userId?: string | null;
  username?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
  user?: User;
}

export interface CreateActivityPayload {
  activityType: ActivityType;
  activityDate: string;
  quantity: number;
  description?: string;
}

export interface CategoryImpact {
  label: string;
  quantity: number;
  unit: string;
  co2e_saved_kg: number;
}

export interface TangibleMetrics {
  bottles_diverted: number;
  clean_transit_km: number;
  waste_sorting_sessions: number;
  trees_stewarded: number;
}

export interface ImpactData {
  success: boolean;
  total_activities_computed: number;
  total_co2e_saved_kg: number;
  category_totals: Record<string, CategoryImpact>;
  tangible_metrics: TangibleMetrics;
  is_estimate: boolean;
  service_status?: string;
  engine?: string;
  fallback_reason?: string;
  assumptions?: string[];
}

export interface DailyProgressItem {
  date: string;
  dayName: string;
  shortLabel: string;
  count: number;
}

export interface DashboardData {
  totalActivities: number;
  thisWeekActivities: number;
  impact: ImpactData;
  dailyProgress: DailyProgressItem[];
  recentActivities: Activity[];
  isEmpty: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  data?: T;
  message?: string;
  error?: string;
}

export interface ActivityTypeMeta {
  id: ActivityType;
  label: string;
  unitLabel: string;
  quantityPlaceholder: string;
  min: number;
  step: number;
  badgeClass: string;
  icon: string;
  descriptionGuide: string;
}

export const ACTIVITY_META: Record<ActivityType, ActivityTypeMeta> = {
  reusable_bottle: {
    id: 'reusable_bottle',
    label: 'Reusable Bottle',
    unitLabel: 'single-use bottles avoided',
    quantityPlaceholder: 'e.g. 2',
    min: 1,
    step: 1,
    badgeClass: 'badge-bottle',
    icon: '💧',
    descriptionGuide: 'e.g. Refilled stainless steel flask throughout classes'
  },
  public_transport: {
    id: 'public_transport',
    label: 'Public Transport',
    unitLabel: 'kilometers traveled (km)',
    quantityPlaceholder: 'e.g. 8.5',
    min: 0.5,
    step: 0.5,
    badgeClass: 'badge-transport',
    icon: '🚌',
    descriptionGuide: 'e.g. Took the city metro and bus to college campus'
  },
  cycling_walking: {
    id: 'cycling_walking',
    label: 'Cycling or Walking',
    unitLabel: 'kilometers walked/cycled (km)',
    quantityPlaceholder: 'e.g. 3.0',
    min: 0.5,
    step: 0.5,
    badgeClass: 'badge-cycling',
    icon: '🚲',
    descriptionGuide: 'e.g. Walked to library and cycled to local market'
  },
  waste_segregation: {
    id: 'waste_segregation',
    label: 'Waste Segregation',
    unitLabel: 'segregation sessions / bins',
    quantityPlaceholder: 'e.g. 1',
    min: 1,
    step: 1,
    badgeClass: 'badge-waste',
    icon: '♻️',
    descriptionGuide: 'e.g. Separated compostable food scraps and dry recyclables'
  },
  tree_care: {
    id: 'tree_care',
    label: 'Tree-Care Activity',
    unitLabel: 'trees nurtured or planted',
    quantityPlaceholder: 'e.g. 1',
    min: 1,
    step: 1,
    badgeClass: 'badge-tree',
    icon: '🌱',
    descriptionGuide: 'e.g. Watered campus saplings and mulched garden bed'
  }
};
