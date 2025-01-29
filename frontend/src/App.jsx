import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

// Reusable Protected Route Component
const PrivateRoute = ({ children, isAuthenticated }) => {
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Reusable Guest Route Component
const PublicRoute = ({ children, isAuthenticated }) => {
  return !isAuthenticated ? children : <Navigate to="/" />;
};

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, onlineUsers } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    checkAuth().catch((error) => {
      console.error("Error checking authentication:", error);
    });
  }, [checkAuth]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader className="size-10 animate-spin" />
          <span className="mt-4 text-lg font-medium">Checking Authentication...</span>
        </div>
      </div>
    );

  return (
    <div data-theme={theme}>
      <Navbar />

      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute isAuthenticated={!!authUser}>
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute isAuthenticated={!!authUser}>
              <SignUpPage />
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute isAuthenticated={!!authUser}>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/profile"
          element={
            <PrivateRoute isAuthenticated={!!authUser}>
              <ProfilePage />
            </PrivateRoute>
          }
        />
      </Routes>

      <Toaster />
    </div>
  );
};

export default App;
