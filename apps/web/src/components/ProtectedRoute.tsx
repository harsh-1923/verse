import { useConvexAuth } from "convex/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "@xstate/react";
import { useAppShortcuts } from "../services/shortcuts";
import { appActor } from "../store";

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const zenMode = useSelector(appActor, (snap) => snap.context.zenMode);
  useAppShortcuts()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-5 h-5 rounded-full border-2 border-[#e7ecf1] border-t-[#8fa0b1] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={
          "/login?redirect=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  }

  return (
    <div className="relative h-screen w-screen p-2">
      {zenMode && (
        <img
          src="/images/landscape.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover -z-10"
        />
      )}
      <Outlet />
    </div>
  );
};
