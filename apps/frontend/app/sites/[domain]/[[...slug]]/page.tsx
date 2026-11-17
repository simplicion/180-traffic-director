import React, { Suspense } from 'react';
import PublicSiteClient from './PublicSiteClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ domain: 'default', slug: [] }];
}

export default function PublicSitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <LogoLoader size={40} className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <PublicSiteClient />
    </Suspense>
  );
}
