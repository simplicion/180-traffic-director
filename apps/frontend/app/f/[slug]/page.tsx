import React, { Suspense } from 'react';
import PublicFormClient from './PublicFormClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ slug: 'default' }];
}

export default function PublicFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LogoLoader size={40} className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <PublicFormClient />
    </Suspense>
  );
}
