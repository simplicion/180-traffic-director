export type ConditionType = 
  | 'geo_country' 
  | 'geo_postal_code'
  | 'geo_region'
  | 'geo_city' 
  | 'geo_timezone'
  | 'device_type' 
  | 'os' 
  | 'browser' 
  | 'referrer'
  | 'sec_ch_ua'
  | 'ip_address'
  | 'header' 
  | 'query_param' 
  | 'bot_status' 
  | 'time_range' 
  | 'language'
  | 'network_type'       // residential, datacenter, cellular, vpn
  | 'asn_provider'       // AWS, GOOGLE_CLOUD, AZURE, DIGITALOCEAN, HETZNER, ORACLE, etc.
  | 'isp_provider'       // Jio, Airtel, Comcast, Verizon, AT&T, Vodafone, etc.
  | 'spy_service'        // AdPlexity, SpyOver, Anstrex, Dropispy, BigSpy, etc.
  | 'vpn_status'         // vpn, proxy, tor, clean
  | 'threat_list'        // system or custom threat blacklist/whitelist
  | 'timezone_delta'     // browser vs IP timezone mismatch
  | 'touch_support'      // boolean (mobile with touchpoints vs emulated)
  | 'gpu_renderer'       // checks against SwiftShader software renderer
  | 'battery_valid';     // checks against static 100% cloud test runners

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'in' 
  | 'not_in' 
  | 'regex' 
  | 'exists' 
  | 'not_exists'
  | 'starts_with';

export interface RuleCondition {
  type: ConditionType;
  operator: ConditionOperator;
  key?: string; // for custom header or query param name
  value: any;
}

export interface ExtractedSignals {
  ipAddress: string;
  country: string;
  city: string;
  postalCode?: string;
  region?: string;
  timezone?: string;
  clientTimezone?: string;
  hasTimezoneDelta?: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;
  browser: string;
  userAgent: string;
  referrer: string;
  isBot: boolean;
  botName?: string;
  isSpyService?: boolean;
  spyServiceName?: string;
  isVpn?: boolean;
  vpnReason?: string;
  isTor?: boolean;
  isp?: string;
  language: string;
  networkType: 'residential' | 'datacenter' | 'cellular' | 'vpn' | 'unknown';
  asn?: string;
  asnOrg?: string;
  touchPoints?: number;
  gpuRenderer?: string;
  batteryLevel?: number;
  isEmulated?: boolean;
  secFetchSite?: string;
  secFetchMode?: string;
  secFetchDest?: string;
  headers: Record<string, string | string[] | undefined>;
  queryParams: Record<string, any>;
  timestamp: Date;
}

export type TrafficActionType = 
  | 'redirect_302' 
  | 'redirect_301' 
  | 'redirect_307' 
  | 'rewrite'
  | 'proxy_safe_page'
  | 'proxy_target_offer'
  | 'js_replace';

export interface EvaluationResult {
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  destinationUrl: string;
  actionType: TrafficActionType;
  isFallback: boolean;
  evaluationLatencyMs: number;
  signals: ExtractedSignals;
  warmupBlocked?: boolean;
  datacenterBlocked?: boolean;
  rampUpApplied?: boolean;
}

export interface LinkThreatFeedsConfig {
  meta_reviewers: boolean;
  google_compliance: boolean;
  tiktok_qa: boolean;
  spy_scrapers: boolean;
  tor_network: boolean;
  cloud_datacenters: boolean;
  [key: string]: boolean;
}

export const DEFAULT_LINK_THREAT_FEEDS: LinkThreatFeedsConfig = {
  meta_reviewers: true,
  google_compliance: true,
  tiktok_qa: true,
  spy_scrapers: true,
  tor_network: true,
  cloud_datacenters: true,
};

export interface CustomThreatEntry {
  id: string;
  userId?: string;
  name?: string;
  type: 'ip' | 'cidr' | 'asn' | 'user_agent';
  value: string;
  action?: 'block' | 'allow';
  mode?: 'blacklist' | 'whitelist';
  note?: string;
  description?: string;
  createdAt: string;
}

export interface ThreatCheckResult {
  isThreat: boolean;
  isWhitelisted?: boolean;
  matchedFeed?: string;
  reason?: string;
}

export interface CreateTrafficLinkDTO {
  userId?: string;
  name: string;
  slug: string;
  description?: string;
  fallbackUrl: string;
  customDomain?: string;
  tags?: string[];
  warmupUntil?: Date | string | null;
  rampUpEnabled?: boolean;
  rampUpDurationHours?: number;
  shieldMode?: 'server' | 'client_shield' | 'hybrid';
  datacenterBlocked?: boolean;
  safePageProxyMode?: boolean;
  threatFeeds?: LinkThreatFeedsConfig | Record<string, boolean>;
  customThreatList?: CustomThreatEntry[];
}

export interface UpdateTrafficLinkDTO {
  name?: string;
  slug?: string;
  description?: string;
  fallbackUrl?: string;
  customDomain?: string;
  tags?: string[];
  isActive?: boolean;
  warmupUntil?: Date | string | null;
  rampUpEnabled?: boolean;
  rampUpDurationHours?: number;
  shieldMode?: 'server' | 'client_shield' | 'hybrid';
  datacenterBlocked?: boolean;
  safePageProxyMode?: boolean;
  threatFeeds?: LinkThreatFeedsConfig | Record<string, boolean>;
  customThreatList?: CustomThreatEntry[];
}

export interface CreateTrafficRuleDTO {
  linkId: string;
  name: string;
  priority?: number;
  destinationUrl: string;
  actionType?: TrafficActionType;
  conditions: RuleCondition[];
  weight?: number;
  isActive?: boolean;
}

export interface UpdateTrafficRuleDTO {
  name?: string;
  priority?: number;
  destinationUrl?: string;
  actionType?: TrafficActionType;
  conditions?: RuleCondition[];
  weight?: number;
  isActive?: boolean;
}

// ─── Analytics & Telemetry Types ──────────────────────────────────────────────

export type AnalyticsTimeRange = 'today' | 'yesterday' | '24h' | '7d' | '30d' | 'this_month' | 'all' | 'custom';

export interface TrafficAnalyticsQueryOptions {
  timeRange?: AnalyticsTimeRange;
  startDate?: string | Date;
  endDate?: string | Date;
  country?: string;
  routingAction?: 'all' | 'target_offer' | 'safe_page' | 'bot' | 'datacenter';
  isBot?: boolean;
  deviceType?: string;
  limit?: number;
  page?: number;
}

export interface TrafficAnalyticsKPIs {
  totalViews: number;
  targetViews: number;
  safeViews: number;
  targetRate: number; // percentage 0-100
  botViews: number;
  botRate: number; // percentage 0-100
  datacenterViews: number;
  datacenterRate: number; // percentage 0-100
  avgLatencyMs: number;
  // Period-over-period comparison deltas
  viewsDeltaPct?: number | null;
  targetViewsDeltaPct?: number | null;
  safeViewsDeltaPct?: number | null;
  targetRateDeltaPct?: number | null;
  botRateDeltaPct?: number | null;
}

export interface TrafficTimeseriesPoint {
  time: string;
  timestamp: number;
  label: string;
  total: number;
  target: number;
  safe: number;
  bot: number;
  datacenter: number;
}

export interface TrafficCloakingReason {
  reasonKey: string;
  label: string;
  description: string;
  count: number;
  percentage: number;
  category: 'target' | 'safe' | 'blocked';
  color: string;
}

export interface TrafficCountryStat {
  code: string;
  name: string;
  flag: string;
  total: number;
  target: number;
  safe: number;
  targetRatePct: number;
  percentage: number;
}

export interface TrafficBreakdownItem {
  name: string;
  count: number;
  percentage: number;
  iconName?: string;
  color?: string;
}

export interface LinkAnalyticsResponse {
  linkId?: string;
  linkName?: string;
  slug?: string;
  fallbackUrl?: string;
  timeRange: AnalyticsTimeRange;
  startDate: string;
  endDate: string;
  kpis: TrafficAnalyticsKPIs;
  timeseries: TrafficTimeseriesPoint[];
  cloakingReasons: TrafficCloakingReason[];
  countryDistribution: TrafficCountryStat[];
  deviceBreakdown: TrafficBreakdownItem[];
  osBreakdown: TrafficBreakdownItem[];
  browserBreakdown: TrafficBreakdownItem[];
  referrerBreakdown: TrafficBreakdownItem[];
  asnBreakdown: TrafficBreakdownItem[];
}

// ==========================================
// UNIVERSAL MULTI-PLATFORM PIXEL & CAPI TYPES
// ==========================================

export type AdvertisingPlatformMode = 'meta' | 'google' | 'both';

export type PixelTriggerType = 'form_submit' | 'click' | 'element_visible' | 'url_match' | 'custom_js';

export interface PixelEventDto {
  id?: string;
  eventName: string; // Lead, Purchase, AddToCart, ViewContent, CompleteRegistration, etc.
  triggerType: PixelTriggerType;
  selector?: string;
  urlPattern?: string;
  eventValueKey?: string;
  currency?: string;
  isEnabled?: boolean;
}

export interface UpsertPixelConfigDto {
  linkId: string;
  activePlatform?: AdvertisingPlatformMode;
  
  // Meta Ads Configuration
  masterPixelId?: string | null;
  backupPixelIds?: string[];
  capiToken?: string;
  testEventCode?: string;
  enableCapi?: boolean;
  enableLdu?: boolean;

  // Google Ads Configuration
  googleConversionId?: string | null;
  googleConversionLabels?: Record<string, string> | null;
  enableGoogleEnhancedConversions?: boolean;
  enableGoogleConsentMode?: boolean;
  googleDefaultConsent?: 'granted' | 'denied';

  // Shared Behaviors & Triggers
  fireOnBots?: boolean;
  trackPageViews?: boolean;
  trackOutbound?: boolean;
  events?: PixelEventDto[];
}

export interface PixelConfigResponse {
  id: string;
  linkId: string;
  userId: string;
  activePlatform: AdvertisingPlatformMode;

  // Meta Ads Configuration
  masterPixelId: string | null;
  backupPixelIds: string[];
  hasCapiToken: boolean;
  testEventCode?: string | null;
  enableCapi: boolean;
  enableLdu: boolean;

  // Google Ads Configuration
  googleConversionId: string | null;
  googleConversionLabels: Record<string, string> | null;
  enableGoogleEnhancedConversions: boolean;
  enableGoogleConsentMode: boolean;
  googleDefaultConsent: string;

  // Shared Behaviors & Triggers
  fireOnBots: boolean;
  trackPageViews: boolean;
  trackOutbound: boolean;
  events: PixelEventDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CapiUserData {
  em?: string[]; // SHA-256 hashed email
  ph?: string[]; // SHA-256 hashed phone
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
  country?: string[];
  fn?: string[]; // First Name
  ln?: string[]; // Last Name
  ct?: string[]; // City
  st?: string[]; // State / Province
  zp?: string[]; // Postal Code
  external_id?: string[];
}

export interface GoogleEnhancedUserData {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  street?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface CapiCustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  order_id?: string;
  status?: string;
  [key: string]: any;
}

export interface CapiEventPayload {
  event_name: string;
  event_time: number;
  event_id: string; // Shared browser/server deduplication key
  event_source_url: string;
  action_source: 'website' | 'app' | 'system_generated';
  user_data: CapiUserData;
  custom_data?: CapiCustomData;
  opt_out?: boolean;
}
