'use client';

export interface CompanyConfig {
  companyName?: string;
  companyLogo?: string;
  brandColor?: string;
  tagline?: string;
  websiteUrl?: string;
  country?: string;
  currency?: string;
  currencySymbol?: string;
  [key: string]: any;
}

export function useSettings() {
  return {
    settings: {
      companyName: '180 Traffic Director',
      logoUrl: '/traffic-director-icon.svg',
      themeColor: '#4f46e5',
    },
    company: null as CompanyConfig | null,
    platform: {
      name: '180 Traffic Director',
      platformName: '180 Traffic Director',
      logo: '/traffic-director-icon.svg',
      themeColor: '#4f46e5',
    },
    featureFlags: {} as Record<string, boolean>,
    disabledApps: [] as string[],
    isAppDisabledByAdmin: (_appId: string) => false,
    refreshSettings: async () => {},
    isLoading: false,
  };
}
