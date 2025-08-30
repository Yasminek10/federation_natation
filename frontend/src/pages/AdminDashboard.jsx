import React from "react";
import { Outlet, Link } from "react-router-dom";
import { FaUsers, FaSwimmer, FaChartBar } from "react-icons/fa";
import Navbar from "../components/Navbar";
import "../styles/adminDashboard.css";

export default function AdminDashboard({ user }) {
  console.log("AdminDashboard user:", user);
  return (
    <div className="admin-dashboard vh-100 d-flex flex-column">
      <Navbar user={user} />

      <main className="flex-grow-1 bg-light p-4" style={{ marginTop: "80px" }}>
        {/* Dashboard Cards */}
        <div className="d-flex flex-wrap gap-4 mb-4">
          <Link
            to="/admin/users"
            className="card flex-fill text-dark text-decoration-none shadow-sm"
            style={{ minWidth: "200px" }}
          >
            <div className="card-body d-flex flex-column align-items-center justify-content-center py-4">
              <FaUsers size={40} className="mb-2 text-primary" />
              <h5 className="card-title">Utilisateurs</h5>
            </div>
          </Link>

          <Link
            to="/admin/minimas"
            className="card flex-fill text-dark text-decoration-none shadow-sm"
            style={{ minWidth: "200px" }}
          >
            <div className="card-body d-flex flex-column align-items-center justify-content-center py-4">
              <FaSwimmer size={40} className="mb-2 text-info" />
              <h5 className="card-title">Minimas</h5>
            </div>
          </Link>

          <Link
            to="/admin/results"
            className="card flex-fill text-dark text-decoration-none shadow-sm"
            style={{ minWidth: "200px" }}
          >
            <div className="card-body d-flex flex-column align-items-center justify-content-center py-4">
              <FaChartBar size={40} className="mb-2 text-success" />
              <h5 className="card-title">Résultats</h5>
            </div>
          </Link>
          <Link
            to="/admin/results"
            className="card flex-fill text-dark text-decoration-none shadow-sm"
            style={{ minWidth: "200px" }}
          >
            <div className="card-body d-flex flex-column align-items-center justify-content-center py-4">
              <FaChartBar size={40} className="mb-2 text-success" />
              <h5 className="card-title">Résultats</h5>
            </div>
          </Link>
        </div>

        {/* Contenu React Router */}
        <div className="bg-white rounded shadow-sm p-4 h-100">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
