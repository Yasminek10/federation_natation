import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import Minimas from "./pages/Minimas";
import OCRUploader from "./components/OCRUploader";
import ImportResults from "./pages/ImportResults";
import EligibilityPage from "./pages/EligibilityPage";


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

      <Route
        path="/admin/minimas"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Minimas user={currentUser} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coach/ocr-uploader"
        element={
          <ProtectedRoute allowedRoles={["coach"]}>
            <OCRUploader user={currentUser} />
          </ProtectedRoute>
        }
      />
=======
      <Route path="/import" element={<ImportResults />} />
      <Route path="/eligibilite" element={<EligibilityPage />} />

      {/* add other pages later */}

    </Routes>
  );
}
