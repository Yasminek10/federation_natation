// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ClubsList from "./components/Clubs";
import SwimmersList from "./components/SwimmersList";
// Read user from localStorage
import { RequireAuth, GuestOnly, RequireRole } from "./components/guards";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AccountPage from "./pages/AccountPage";
import Minimas from "./pages/Minimas";
import MaxPlacesPage from "./pages/MaxPlaces";
import EligibilityPage from "./pages/EligibilityPage";
import ImportResults from "./pages/ImportResults";
import OCRUploader from "./components/OCRUploader";
import AdminDashboard from "./pages/AdminDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import CreateAccountPage from "./pages/CreateAccountPage";
const currentUser = JSON.parse(localStorage.getItem("user"));
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<Home user={currentUser} />} />
      <Route path="/login" element={<Login />} />
      <Route path="/clubs" element={<ClubsList user={currentUser} />} />
      <Route path="/clubs/:clubId/nageurs" element={<SwimmersList user={currentUser}/>} />


      {/* /login accessible seulement si NON connecté */}
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />

      {/* ===== Routes PROTÉGÉES SANS NAVBAR ===== */}
      <Route
        path="/home"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          <RequireRole roles={["admin"]}>
            <AdminDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/coach-dashboard"
        element={
          <RequireRole roles={["coach"]}>
            <CoachDashboard />
          </RequireRole>
        }
      />

      {/* ===== Routes PROTÉGÉES AVEC NAVBAR (via AppLayout) ===== */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          path="/import"
          element={
            <RequireRole roles={["admin", "coach"]}>
              <ImportResults />
            </RequireRole>
          }
        />
        <Route
          path="/ocr"
          element={
            <RequireRole roles={["admin", "coach"]}>
              <OCRUploader />
            </RequireRole>
          }
        />
        <Route
          path="/regles/minimas"
          element={
            <RequireRole roles={["admin", "coach"]}>
              <Minimas />
            </RequireRole>
          }
        />
        <Route
          path="/regles/eligibilite"
          element={
            <RequireRole roles={["admin", "coach"]}>
              <EligibilityPage />
            </RequireRole>
          }
        />
        <Route
          path="/regles/max-places"
          element={
            <RequireRole roles={["admin", "coach"]}>
              <MaxPlacesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users/create"
          element={
            <RequireRole roles={["admin"]}>
              <CreateAccountPage />
            </RequireRole>
          }
        />
        <Route path="/account" element={<AccountPage />} />
      </Route>

      {/* racine + fallback */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<div className="p-4">Page introuvable</div>} />
    </Routes>
  );
}
