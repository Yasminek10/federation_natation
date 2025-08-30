import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ImportResults from "./pages/ImportResults";
import EligibilityPage from "./pages/EligibilityPage";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/import" element={<ImportResults />} />
      <Route path="/eligibilite" element={<EligibilityPage />} />

      {/* add other pages later */}
    </Routes>
  );
}