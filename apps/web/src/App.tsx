import { Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { LoginScreen } from "./screens/LoginScreen"
import { DirectoryScreen } from "./screens/DirectoryScreen"
import { DocumentScreen } from "./screens/DocumentScreen"
import { SettingsScreen } from "./screens/SettingsScreen"

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dir" element={<DirectoryScreen />}>
          <Route path=":id" element={<DocumentScreen />} />
        </Route>
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/dir" replace />} />
    </Routes>
  )
}
