import { supabase, isSupabaseConfigured } from './supabase'
import { useAuthStore } from '../store/authStore'

/**
 * Completes an auth flow that was started in the browser and came back through
 * the `digiboard://` protocol.
 *
 * The desktop app is served from file://, so Supabase has no valid origin to
 * return to; a registered custom scheme is the only redirect it can trust. The
 * link carries either tokens in the fragment (implicit flow) or an error the
 * user needs to see.
 */

type DeepLinkListener = (url: string) => void

export function onAuthDeepLink(listener: DeepLinkListener): () => void {
  const bridge = (window as any).__electron_deepLink
  if (typeof bridge !== 'function') return () => {}
  return bridge(listener) as () => void
}

/**
 * Parse and apply a callback URL. Returns an error message when the link is
 * unusable (expired, already used, malformed) so the UI can explain rather than
 * silently doing nothing.
 */
export async function handleAuthCallback(rawUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured) return 'Cloud features are not configured'

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return 'That link could not be read.'
  }

  // Supabase reports failures either as a query param or in the fragment.
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
  const search = url.searchParams

  const errDesc = fragment.get('error_description') ?? search.get('error_description')
  if (errDesc) return decodeURIComponent(errDesc.replace(/\+/g, ' '))

  const errCode = fragment.get('error_code') ?? search.get('error_code')
  if (errCode === 'otp_expired') {
    return 'That link has expired. Request a new one from the sign-in screen.'
  }

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')

  if (!accessToken || !refreshToken) {
    return 'That link is missing its sign-in token.'
  }

  const { error } = await supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) return error.message

  const { data } = await supabase!.auth.getUser()
  if (data.user) useAuthStore.getState().setUser(data.user)
  return null
}
