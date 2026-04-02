import { useConvexAuth } from "convex/react"
import { Navigate, useSearchParams } from "react-router-dom"
import { SignInPage } from "../components/SignInPage"

export const LoginScreen = () => {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dir"
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-5 h-5 rounded-full border-2 border-[#e7ecf1] border-t-[#8fa0b1] animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return <SignInPage redirectTo={redirectTo} />
}
