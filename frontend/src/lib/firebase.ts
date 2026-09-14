"use client"

import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  ...(process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== undefined && {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  }),
  ...(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== undefined && {
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  }),
  ...(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== undefined && {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }),
  ...(process.env.NEXT_PUBLIC_FIREBASE_APP_ID !== undefined && {
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }),
}

const app = getApps()[0] ?? initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(app)
