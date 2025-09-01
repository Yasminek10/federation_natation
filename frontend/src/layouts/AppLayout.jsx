import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function AppLayout() {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  return (
    <div className="vh-100 d-flex flex-column">
      <Navbar user={currentUser} />
      <main className="flex-grow-1 bg-light" style={{ marginTop: 72 }}>
        <div className="container py-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
