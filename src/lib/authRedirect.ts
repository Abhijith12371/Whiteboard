/**
 * Auth redirect configuration, kept free of imports so both the auth store and
 * the deep-link handler can depend on it without an import cycle.
 */
export const DEEP_LINK_SCHEME = 'digiboard'

/**
 * Where Supabase sends password-reset and confirmation emails.
 *
 * The desktop app is served from a file:// origin, which is not a redirect target
 * Supabase will accept, so auth completes through a registered custom scheme.
 */
export const authRedirectUrl = `${DEEP_LINK_SCHEME}://auth/callback`
