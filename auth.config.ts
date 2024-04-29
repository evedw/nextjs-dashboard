import type { NextAuthConfig } from 'next-auth';

// This object will contain the configuration options for NextAuth.js
export const authConfig = {
  pages: {
    signIn: '/login',               // by adding signIn: '/login' into our pages option, the user will be redirected to our custom login page
  },
  // prevent users from accessing the dashboard pages unless they are logged 
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;