'use client';

import { useState, useCallback } from 'react';

export interface Launch180IdentityOptions {
  clientId?: string;
  authServerUrl?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  uxMode?: 'popup' | 'redirect';
  onSuccess?: (res: any) => void;
  onError?: (err: any) => void;
}

export function use180Identity() {
  const [isOpeningIdentity, setIsOpeningIdentity] = useState(false);

  const launch180Identity = useCallback((options: Launch180IdentityOptions = {}) => {
    setIsOpeningIdentity(true);
    const clientId =
      options.clientId ||
      process.env.NEXT_PUBLIC_180_CLIENT_ID ||
      '180_client_39d675390e2ddf3a518b8c436ae665f5';
    const authServerUrl =
      options.authServerUrl ||
      process.env.NEXT_PUBLIC_180_AUTH_URL ||
      'https://profile.180workspace.com';
    const redirectUri =
      options.redirectUri ||
      (typeof window !== 'undefined' ? `${window.location.origin}/callback` : '');
    const state = options.state || Math.random().toString(36).substring(2, 15);
    const scope = options.scope || 'openid identity:read identity:email';

    const loginUrl = `${authServerUrl}/auth/login?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(
      scope
    )}&state=${encodeURIComponent(state)}&app=auth`;

    // Listen for postMessage from callback popup
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      const data =
        typeof event.data === 'string'
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch (_) {
                return null;
              }
            })()
          : event.data;
      if (!data) return;

      if (data.type === '180_IDENTITY_SUCCESS' || data.type === '180_AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        setIsOpeningIdentity(false);
        if (options.onSuccess) {
          options.onSuccess(data);
        }
      } else if (data.type === '180_IDENTITY_ERROR' || data.type === '180_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        setIsOpeningIdentity(false);
        if (options.onError) {
          options.onError(
            new Error(data.error_description || data.error || 'Authentication failed')
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);

    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      loginUrl,
      '180_identity_login',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Fallback to full page redirect if popup was blocked
      window.removeEventListener('message', handleMessage);
      window.location.href = loginUrl;
    } else {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleMessage);
          setIsOpeningIdentity(false);
        }
      }, 500);
    }
  }, []);

  return { launch180Identity, isOpeningIdentity };
}
