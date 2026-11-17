/**
 * Centralized frontend feature flags.
 * Flip WEBSITE_BUILDER_COMING_SOON to false (or set NEXT_PUBLIC_ENABLE_WEBSITE_BUILDER=true)
 * when ready to launch the Website Builder publicly.
 */
export const WEBSITE_BUILDER_COMING_SOON =
  process.env.NEXT_PUBLIC_ENABLE_WEBSITE_BUILDER !== 'true';
