// lib/auth-helpers.ts
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
// Define Role enum manually since it's not exported from @prisma/client
export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/signin")
  }
  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== Role.ADMIN) {
    redirect("/auth/signin")
  }
  return user
}

export async function checkRole(requiredRole: Role) {
  const user = await getCurrentUser()
  return user?.role === requiredRole
}

export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === Role.ADMIN
}

export async function isAuthenticated() {
  const user = await getCurrentUser()
  return !!user
}