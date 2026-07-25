/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be in your gitignore
// unless you are using TypeScript and want to type your environment variables.
// See https://docs.expo.dev/guides/environment-variables/

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    }
  }
}

export {};
