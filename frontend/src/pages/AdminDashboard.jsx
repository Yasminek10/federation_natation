import React from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function AdminDashboard({ user }) {
  return (
    <div className="vh-100 d-flex flex-column">
      <Navbar user={user} />
      <Navigate to="/import" replace />
    </div>
  );
}
