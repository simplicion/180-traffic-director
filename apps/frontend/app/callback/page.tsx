'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const err = urlParams.get('error') || urlParams.get('error_description');

      if (err) {
        setError(err);
        toast.error(`Authentication error: ${err}`);
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: '180_IDENTITY_ERROR', error: err }, '*');
          window.close();
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: '180_IDENTITY_ERROR', error: err }, '*');
        }
        return;
      }

      if (!code) {
        setError('No authorization code provided in the callback URL.');
        return;
      }

      // If opened in popup mode, communicate back to opener
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: '180_IDENTITY_SUCCESS', code },
          '*'
        );
        window.close();
        return;
      }

      // If opened in in-DOM iframe / bottom-sheet, post to parent window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: '180_IDENTITY_SUCCESS', code },
          '*'
        );
        return;
      }

      // Otherwise handle full-page redirect grant
      try {
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        const apiBase = isLocal 
          ? 'http://localhost:4005'
          : (process.env.NEXT_PUBLIC_API_URL || 'https://api.180trafficdirector.pro');
        const redirectUri = window.location.origin + '/callback';
        const pkceVerifier = sessionStorage.getItem('180_pkce_verifier') || undefined;

        const tokenPayload = {
          grant_type: 'authorization_code',
          client_id: process.env.NEXT_PUBLIC_180_CLIENT_ID || '180_client_39d675390e2ddf3a518b8c436ae665f5',
          code,
          redirect_uri: redirectUri,
          code_verifier: pkceVerifier,
        };

        // Try backend exchange first (server-to-server with secret)
        let tokenRes = await fetch(`${apiBase}/oauth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload),
        });

        // Fallback to backend /oauth/token or core cloud oauth token endpoint
        if (!tokenRes.ok) {
          tokenRes = await fetch(`${apiBase}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenPayload),
          });
        }

        if (!tokenRes.ok) {
          tokenRes = await fetch('https://api.180core.cloud/api/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenPayload),
          });
        }

        const tokenData = await tokenRes.json();
        const token = tokenData.access_token || tokenData.token || tokenData.authToken;

        if (!tokenRes.ok || !token) {
          throw new Error(
            tokenData.error_description || tokenData.error || 'Token exchange failed'
          );
        }

        const refreshToken = tokenData.refresh_token;

        localStorage.setItem('platform_auth_token', token);
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('platform_refresh_token', refreshToken);
        if (tokenData.user) localStorage.setItem('180_user', JSON.stringify(tokenData.user));

        const isProd = window.location.protocol === 'https:';
        const is180 = window.location.hostname.endsWith('180trafficdirector.pro');
        const domainAttr = is180 ? '; domain=.180trafficdirector.pro' : '';
        const cookieFlags = `; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${
          isProd ? '; Secure' : ''
        }${domainAttr}`;
        document.cookie = `platform_auth_token=${token}${cookieFlags}`;

        toast.success('Successfully authenticated!');
        router.replace('/traffic-director/links');
      } catch (e: any) {
        console.error('Callback error:', e);
        setError(e.message || 'Failed to complete authentication.');
        toast.error(e.message || 'Failed to complete authentication.');
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-red-200 backdrop-blur-xl">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
          <p className="text-sm text-zinc-400 mb-6">{error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
        <p className="text-sm font-medium text-zinc-400">Verifying 180 Identity credentials...</p>
      </div>
    </div>
  );
}
