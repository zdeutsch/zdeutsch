import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { LesenLibraryPage } from "./pages/LesenLibraryPage";
import { LesenEditorPage } from "./pages/LesenEditorPage";
import { HorenPage } from "./pages/HorenPage";
import { SchreibenPage } from "./pages/SchreibenPage";
import { SprechenPage } from "./pages/SprechenPage";
import { BeitraegePage } from "./pages/BeitraegePage";
import { EinstellungenPage } from "./pages/EinstellungenPage";
import { SharingPage } from "./pages/SharingPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/dashboard/lesen" element={<LesenLibraryPage />} />
        <Route path="/dashboard/lesen/:partKey" element={<LesenEditorPage />} />
        <Route path="/dashboard/hoeren" element={<HorenPage />} />
        <Route path="/dashboard/schreiben" element={<SchreibenPage />} />
        <Route path="/dashboard/sprechen" element={<SprechenPage />} />
        <Route path="/dashboard/beitraege" element={<BeitraegePage />} />
        <Route path="/dashboard/sharing" element={<SharingPage />} />
        <Route path="/dashboard/einstellungen" element={<EinstellungenPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
