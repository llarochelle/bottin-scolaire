import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";
import Login from "./pages/Login";
import Directory from "./pages/Directory";
import MyEntries from "./pages/MyEntries";
import Admin from "./pages/Admin";
import FirstLoginPasswordDialog from "./components/FirstLoginPasswordDialog";

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? null : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Directory /></Protected>} />
      <Route path="/mes-inscriptions" element={<Protected><MyEntries /></Protected>} />
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <FirstLoginPasswordDialog />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
