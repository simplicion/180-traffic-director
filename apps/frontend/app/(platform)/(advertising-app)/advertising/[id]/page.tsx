import React from 'react';
import WebsiteRedirectClient from './WebsiteRedirectClient';
import { WEBSITE_BUILDER_COMING_SOON } from '@/lib/feature-flags';
import WebsiteBuilderComingSoon from '@/components/shared/WebsiteBuilderComingSoon';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function WebsiteDetailPage() {
  if (WEBSITE_BUILDER_COMING_SOON) {
    return <WebsiteBuilderComingSoon />;
  }
  return <WebsiteRedirectClient />;
}
