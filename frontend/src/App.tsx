import { Navigate, Route, Routes } from "react-router-dom";

import { IntegrationsPage } from "./IntegrationsPage";
import { Layout } from "./Layout";
import { LoginPage } from "./LoginPage";
import { ProductDetailPage } from "./ProductDetailPage";
import { ProfileDetailPage } from "./ProfileDetailPage";
import { ProfilesPage } from "./ProfilesPage";
import { PromptsPage } from "./PromptsPage";
import { TariffsPage } from "./TariffsPage";
import { RegisterPage } from "./RegisterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/profiles" replace />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/profiles/:id" element={<ProfileDetailPage />} />
        <Route path="/profiles/:id/products/:productId" element={<ProductDetailPage />} />
        <Route path="/tariffs" element={<TariffsPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/profiles" replace />} />
    </Routes>
  );
}
