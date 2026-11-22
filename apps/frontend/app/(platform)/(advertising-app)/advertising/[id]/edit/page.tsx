import React, { Suspense } from 'react';
import WebsiteEditorClient from './WebsiteEditorClient';
import { LogoLoader } from '@workspace/ui';
import { WEBSITE_BUILDER_COMING_SOON } from '@/lib/feature-flags';
import WebsiteBuilderComingSoon from '@/components/shared/WebsiteBuilderComingSoon';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function WebsiteEditorPage() {
  if (WEBSITE_BUILDER_COMING_SOON) {
    return <WebsiteBuilderComingSoon />;
  }
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
          <LogoLoader size={40} className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Loading Website Editor...</p>
        </div>
      }
    >
      <WebsiteEditorClient />
    </Suspense>
  );
}
