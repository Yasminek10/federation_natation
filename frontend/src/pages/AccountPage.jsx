import React from "react";

export default function AccountPage() {
  const user = JSON.parse(localStorage.getItem("user"));
  return (
    <div className="bg-white p-3 rounded shadow-sm">
      <h3>Mon compte</h3>
      <div className="mt-2">
        <div><strong>Nom:</strong> {user?.name || "-"}</div>
        <div><strong>Email:</strong> {user?.email || "-"}</div>
        <div><strong>Rôle:</strong> {user?.role || "-"}</div>
      </div>
    </div>
  );
}
