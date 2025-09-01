import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

import AdminDashboard from "./pages/AdminDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import Minimas from "./pages/Minimas";
import OCRUploader from "./components/OCRUploader";
import ImportResults from "./pages/ImportResults";
import EligibilityPage from "./pages/EligibilityPage";
import MaxPlacesPage from "./pages/MaxPlaces";
import AccountPage from "./pages/AccountPage";
import CreateAccountPage from "./pages/CreateAccountPage";

// Read user from localStorage
const currentUser = JSON.parse(localStorage.getItem("user"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<Home user={currentUser} />} />
      <Route path="/login" element={<Login />} />


      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard user={currentUser} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coach-dashboard"
        element={
          <ProtectedRoute allowedRoles={["coach"]}>
            <CoachDashboard user={currentUser} />
          </ProtectedRoute>
        }
      />

      {/* Layout avec navbar toujours visible */}
      <Route element={<AppLayout />}>
        {/* Scraping / Import résultats (admin + coach) */}
        <Route
          path="/import"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <ImportResults />
            </ProtectedRoute>
          }
        />

      {/* OCR uploader (admin + coach) */}
        <Route
          path="/ocr"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <OCRUploader user={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Règles (lecture seule pour coach, modif pour admin) */}
        <Route
          path="/regles/minimas"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <Minimas user={currentUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/regles/eligibilite"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <EligibilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/regles/max-places"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <MaxPlacesPage />
            </ProtectedRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/admin/users/create"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CreateAccountPage />
            </ProtectedRoute>
          }
        />

        {/* Mon compte (admin + coach) */}
        <Route
          path="/account"
          element={
            <ProtectedRoute allowedRoles={["admin", "coach"]}>
              <AccountPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/import" replace />} />
    </Routes>
  );
}
