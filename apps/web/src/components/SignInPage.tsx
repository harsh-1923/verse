import { useAuthActions } from "@convex-dev/auth/react"

export function SignInPage() {
  const { signIn } = useAuthActions()

  return (
    <div className="flex h-screen items-center justify-center bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">
        <div className="text-center">
          <h1 className="text-[30px] font-semibold text-[#1a1c1d] tracking-tight">Verse</h1>
          <p className="mt-2 text-[16px] text-[#8fa0b1]">Collaborative writing with AI</p>
        </div>
        <button
          onClick={() => void signIn("google")}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#e7ecf1] bg-white px-5 py-3 text-[14px] font-medium text-[#1a1c1d] shadow-sm hover:bg-[#f9fafb] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
