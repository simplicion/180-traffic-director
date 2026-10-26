'use client';

export interface OneEightyPayCheckoutOptions {
  sessionId: string;
  amount?: number;
  currency?: string;
  title?: string;
  planCode?: string;
  description?: string;
  payServerUrl?: string;
  uxMode?: 'bottom_sheet' | 'popup' | 'full_page';
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface OneEightySubscriptionManagerOptions {
  subscriptionId: string;
  payServerUrl?: string;
  onCancelled?: () => void;
  onClose?: () => void;
}

export const OneEightyPay = {
  checkout: async (options: OneEightyPayCheckoutOptions): Promise<any> => {
    return new Promise((resolve, reject) => {
      const baseUrl =
        options.payServerUrl ||
        (typeof window !== 'undefined' && window.location.hostname.endsWith('180workspace.com')
          ? 'https://pay.180workspace.com'
          : 'https://pay.180workspace.com');

      const sid = options.sessionId;
      const query = [
        options.amount ? `amount=${encodeURIComponent(options.amount)}` : '',
        options.currency ? `currency=${encodeURIComponent(options.currency)}` : 'currency=USD',
        options.planCode ? `plan=${encodeURIComponent(options.planCode)}` : '',
        options.title ? `title=${encodeURIComponent(options.title || '180 Traffic Director')}` : '',
        'appName=' + encodeURIComponent('180 Traffic Director'),
        'ux_mode=' + encodeURIComponent(options.uxMode || 'popup'),
      ]
        .filter(Boolean)
        .join('&');

      const checkoutUrl = `${baseUrl}/checkout/${encodeURIComponent(sid)}${
        query ? `?${query}` : ''
      }`;

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

        if (data.type === '180_PAY_SUCCESS' || data.type === '180_PAYMENT_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          if (options.onSuccess) options.onSuccess(data);
          resolve(data);
        } else if (data.type === '180_PAY_ERROR' || data.type === '180_PAYMENT_ERROR') {
          window.removeEventListener('message', handleMessage);
          const err = new Error(
            data.error_description || data.error || data.message || 'Payment failed'
          );
          if (options.onError) options.onError(err);
          reject(err);
        } else if (
          data.type === '180_PAY_CLOSE' ||
          data.type === '180_PAYMENT_CLOSE' ||
          data.type === '180_MODAL_CLOSE'
        ) {
          window.removeEventListener('message', handleMessage);
          if (options.onCancel) options.onCancel();
          resolve(null);
        }
      };

      window.addEventListener('message', handleMessage);

      const width = 500;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        checkoutUrl,
        '180_pay_checkout',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.removeEventListener('message', handleMessage);
        window.location.href = checkoutUrl;
      } else {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener('message', handleMessage);
            if (options.onCancel) options.onCancel();
          }
        }, 500);
      }
    });
  },

  openSubscriptionManager: (options: OneEightySubscriptionManagerOptions) => {
    const baseUrl =
      options.payServerUrl ||
      (typeof window !== 'undefined' && window.location.hostname.endsWith('180workspace.com')
        ? 'https://pay.180workspace.com'
        : 'https://pay.180workspace.com');
    const manageUrl = `${baseUrl}/subscriptions/${encodeURIComponent(options.subscriptionId)}`;

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

      if (data.type === '180_SUB_CANCELLED' || data.type === '180_SUBSCRIPTION_CANCELLED') {
        window.removeEventListener('message', handleMessage);
        if (options.onCancelled) options.onCancelled();
      } else if (data.type === '180_SUB_CLOSE' || data.type === '180_MODAL_CLOSE') {
        window.removeEventListener('message', handleMessage);
        if (options.onClose) options.onClose();
      }
    };

    window.addEventListener('message', handleMessage);

    const width = 520;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      manageUrl,
      '180_subscription_manager',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = manageUrl;
    }
  },
};
