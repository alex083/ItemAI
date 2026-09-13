import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { IntegrationsPage } from "./IntegrationsPage";
import { JobsPage } from "./JobsPage";
import { LandingPage } from "./LandingPage";
import { Layout } from "./Layout";
import { LoginPage } from "./LoginPage";
import { ProductDetailPage } from "./ProductDetailPage";
import { ProfileDetailPage } from "./ProfileDetailPage";
import { ProfilesPage } from "./ProfilesPage";
import { PromptsPage } from "./PromptsPage";
import { TariffsPage } from "./TariffsPage";
import { RegisterPage } from "./RegisterPage";

function HomeRoute() {
  const { loggedIn } = useAuth();
  if (loggedIn) {
    return <Navigate to="/profiles" replace />;
  }
  return <LandingPage />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loggedIn } = useAuth();
  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/profiles/:id" element={<ProfileDetailPage />} />
        <Route path="/profiles/:id/products/:productId" element={<ProductDetailPage />} />
        <Route path="/tariffs" element={<TariffsPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
