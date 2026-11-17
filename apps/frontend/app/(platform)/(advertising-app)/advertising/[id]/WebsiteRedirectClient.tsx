'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WebsiteRedirectClient() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/advertising');
  }, [router]);
  return null;
}
