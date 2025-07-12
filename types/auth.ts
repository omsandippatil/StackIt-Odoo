// types/auth.ts
// Define Role enum here if not exported from @prisma/client
export enum Role {
  USER = "USER",
  ADMIN = "ADMIN"
}
import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: Role
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: Role
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: Role
  image: string | null
}

export interface SignUpData {
  name: string
  email: string
  password: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AdminAuthProps {
  requiredRole?: Role
  redirectTo?: string
}