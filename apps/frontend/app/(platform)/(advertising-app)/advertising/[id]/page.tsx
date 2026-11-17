import React from 'react';
import WebsiteRedirectClient from './WebsiteRedirectClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function WebsiteDetailPage() {
  return <WebsiteRedirectClient />;
}
