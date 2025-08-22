import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      {/* add other pages later */}
    </Routes>
  );
}