'use client';

import { useState, useCallback, useEffect } from 'react';

export interface Launch180IdentityOptions {
  clientId?: string;
  authServerUrl?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  uxMode?: 'bottom_sheet' | 'modal' | 'popup' | 'redirect';
  onSuccess?: (res: any) => void;
  onError?: (err: any) => void;
}

// ─── PKCE Utilities (RFC 7636) ────────────────────────────────────────────────
function generateCodeVerifier(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, (dec) => dec.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return verifier;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Modern 180 Identity Hook conforming to the latest 180 Core Specification.
 * Implements Zero UI Mandate with Adaptive In-DOM Bottom Sheet (Mobile) & Glass Modal (Desktop).
 */
export function use180Identity() {
  const [isOpeningIdentity, setIsOpeningIdentity] = useState(false);

  // Auto-inject 180 Core SDK client in the background if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.querySelector('script[src*="180-core-sdk.js"]')) return;
    const script = document.createElement('script');
    script.src = 'https://profile.180core.cloud/sdk/v1/180-core-sdk.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const closeIdentity = useCallback(() => {
    if (typeof window === 'undefined') return;
    const modalRoot = document.getElementById('__180_identity_adaptive_modal__');
    if (modalRoot) {
      modalRoot.classList.add('opacity-0');
      setTimeout(() => modalRoot.remove(), 200);
    }
    setIsOpeningIdentity(false);
  }, []);

  const launch180Identity = useCallback(async (options: Launch180IdentityOptions = {}) => {
    setIsOpeningIdentity(true);

    const clientId =
      options.clientId ||
      process.env.NEXT_PUBLIC_180_CLIENT_ID ||
      '180_client_39d675390e2ddf3a518b8c436ae665f5';

    const authServerUrl =
      options.authServerUrl ||
      process.env.NEXT_PUBLIC_180_AUTH_URL ||
      'https://profile.180core.cloud';

    const redirectUri =
      options.redirectUri ||
      (typeof window !== 'undefined' ? `${window.location.origin}/callback` : 'https://180trafficdirector.pro/callback');

    const state = options.state || Math.random().toString(36).substring(2, 15);
    const scope = options.scope || 'openid identity:read identity:email';

    // Generate RFC 7636 PKCE pair
    let verifier = '';
    let challenge = '';
    try {
      verifier = generateCodeVerifier();
      challenge = await generateCodeChallenge(verifier);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('180_pkce_verifier', verifier);
        sessionStorage.setItem('180_auth_state', state);
      }
    } catch (_) {}

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const uxMode = options.uxMode || 'bottom_sheet';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      ux_mode: 'bottom_sheet',
      app: 'auth',
    });

    if (challenge) {
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    const loginUrl = `${authServerUrl}/auth/login?${params.toString()}`;

    // Clean up any stale modal
    const existing = document.getElementById('__180_identity_adaptive_modal__');
    if (existing) existing.remove();

    // ─── PostMessage Event Handler ──────────────────────────────────────────
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
        closeIdentity();

        const token = data.authToken || data.accessToken || data.token;
        if (token && typeof window !== 'undefined') {
          try {
            localStorage.setItem('platform_auth_token', token);
            localStorage.setItem('token', token);
            const isProd = window.location.protocol === 'https:';
            document.cookie = `platform_auth_token=${token}; path=/; max-age=604800; SameSite=Lax${isProd ? '; Secure' : ''}`;
            if (data.user) {
              localStorage.setItem('180_user', JSON.stringify(data.user));
              localStorage.setItem('user', JSON.stringify(data.user));
            }
          } catch (_) {}
        }

        if (options.onSuccess) {
          options.onSuccess(data);
        }
      } else if (data.type === '180_IDENTITY_CLOSE' || data.type === '180_AUTH_CLOSE') {
        window.removeEventListener('message', handleMessage);
        closeIdentity();
      } else if (data.type === '180_IDENTITY_ERROR' || data.type === '180_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        closeIdentity();
        if (options.onError) {
          options.onError(new Error(data.error_description || data.error || 'Authentication error'));
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // ─── Presentation Mode Routing ──────────────────────────────────────────
    if (uxMode === 'popup') {
      const width = 480;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        loginUrl,
        '180_identity_login',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to Adaptive Modal if popup blocked
        createAdaptiveModal(loginUrl, handleMessage, isMobile, closeIdentity);
      } else {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener('message', handleMessage);
            setIsOpeningIdentity(false);
          }
        }, 500);
      }
      return;
    }

    if (uxMode === 'redirect') {
      window.removeEventListener('message', handleMessage);
      window.location.href = loginUrl;
      return;
    }

    // Default: In-DOM Adaptive Bottom Sheet / Centered Glass Modal (Zero Popup Blocking)
    createAdaptiveModal(loginUrl, handleMessage, isMobile, closeIdentity);
  }, [closeIdentity]);

  return { launch180Identity, isOpeningIdentity, closeIdentity };
}

// ─── Helper: Create In-DOM Adaptive Bottom Sheet / Glass Modal ────────────────
function createAdaptiveModal(
  url: string,
  messageHandler: (e: MessageEvent) => void,
  isMobile: boolean,
  onClose: () => void
) {
  if (typeof document === 'undefined') return;

  const root = document.createElement('div');
  root.id = '__180_identity_adaptive_modal__';
  root.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999999;
    display: flex;
    flex-direction: column;
    justify-content: ${isMobile ? 'flex-end' : 'center'};
    align-items: center;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: opacity 0.2s ease-out;
  `;

  // Backdrop click to close
  root.addEventListener('click', (e) => {
    if (e.target === root) {
      window.removeEventListener('message', messageHandler);
      onClose();
    }
  });

  const card = document.createElement('div');
  card.style.cssText = `
    position: relative;
    width: ${isMobile ? '100%' : '460px'};
    max-width: 100%;
    height: ${isMobile ? '86vh' : '680px'};
    max-height: 92vh;
    background: #09090b;
    border-radius: ${isMobile ? '24px 24px 0 0' : '24px'};
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: ${isMobile ? 'sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'modalZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'};
  `;

  // Inject Keyframe styles once
  if (!document.getElementById('__180_identity_styles__')) {
    const style = document.createElement('style');
    style.id = '__180_identity_styles__';
    style.textContent = `
      @keyframes sheetSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes modalZoomIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Header handle for mobile bottom sheet
  if (isMobile) {
    const handleBar = document.createElement('div');
    handleBar.style.cssText = `
      width: 40px;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 9999px;
      margin: 10px auto 4px auto;
    `;
    card.appendChild(handleBar);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText = `
    position: absolute;
    top: 14px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #a1a1aa;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.15s ease;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.color = '#ffffff';
    closeBtn.style.background = 'rgba(255, 255, 255, 0.16)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.color = '#a1a1aa';
    closeBtn.style.background = 'rgba(255, 255, 255, 0.08)';
  };
  closeBtn.onclick = () => {
    window.removeEventListener('message', messageHandler);
    onClose();
  };
  card.appendChild(closeBtn);

  // Embedded Sovereign Auth Iframe
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = `
    flex: 1;
    width: 100%;
    border: none;
    background: transparent;
  `;
  iframe.allow = 'clipboard-read; clipboard-write; web-share';
  card.appendChild(iframe);

  root.appendChild(card);
  document.body.appendChild(root);
}
