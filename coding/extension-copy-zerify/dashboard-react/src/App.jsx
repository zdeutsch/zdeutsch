import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { LesenLibraryPage } from "./pages/LesenLibraryPage";
import { LesenEditorPage } from "./pages/LesenEditorPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/dashboard/lesen" element={<LesenLibraryPage />} />
        <Route path="/dashboard/lesen/:partKey" element={<LesenEditorPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
