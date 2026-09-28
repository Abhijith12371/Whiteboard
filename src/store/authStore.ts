import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { authRedirectUrl } from '../lib/authRedirect'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  syncStatus: SyncStatus
  isOnline: boolean

  // Actions
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setError: (error: string | null) => void
  setSyncStatus: (status: SyncStatus) => void
  setOnlineStatus: (isOnline: boolean) => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  syncStatus: 'idle',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  signUp: async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured', name: 'ConfigError', status: 500 } as AuthError }
    }

    set({ loading: true, error: null })
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl,
      },
    })

    set({ loading: false })

    if (error) {
      set({ error: error.message })
      return { error }
    }

    if (data.user && data.session) {
      set({ user: data.user, session: data.session })
    }

    return { error: null }
  },

  signIn: async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured', name: 'ConfigError', status: 500 } as AuthError }
    }

    set({ loading: true, error: null })
    const { data, error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    })

    set({ loading: false })

    if (error) {
      set({ error: error.message })
      return { error }
    }

    set({ user: data.user, session: data.session })
    return { error: null }
  },

  signOut: async () => {
    if (!isSupabaseConfigured) return

    set({ loading: true })
    await supabase!.auth.signOut()
    set({ user: null, session: null, loading: false, syncStatus: 'idle' })
  },

  resetPassword: async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured', name: 'ConfigError', status: 500 } as AuthError }
    }

    set({ loading: true, error: null })
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      // The app runs from file://, so a web origin is not a valid target.
      redirectTo: authRedirectUrl,
    })

    set({ loading: false })

    if (error) {
      set({ error: error.message })
      return { error }
    }

    return { error: null }
  },

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setError: (error) => set({ error }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setOnlineStatus: (isOnline) => set({ isOnline }),

  initAuth: async () => {
    if (!isSupabaseConfigured) {
      set({ loading: false })
      return
    }

    try {
      // Get initial session
      const { data: { session } } = await supabase!.auth.getSession()
      
      if (session) {
        set({ session, user: session.user, loading: false })
      } else {
        set({ loading: false })
      }

      // Listen for auth changes
      supabase!.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null })
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ loading: false })
    }
  },
}))

// Initialize online/offline status listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAuthStore.getState().setOnlineStatus(true)
  })

  window.addEventListener('offline', () => {
    useAuthStore.getState().setOnlineStatus(false)
    useAuthStore.getState().setSyncStatus('offline')
  })
}
