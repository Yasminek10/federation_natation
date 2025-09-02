import React from "react";
import { Navigate } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import useUser from "../hooks/useUser";

/** Nécessite une session (sinon -> /login) */
export function RequireAuth({ children }) {
  const { user, loading } = useUser();
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Empêche d'ouvrir /login quand on est déjà connecté (-> /home) */
export function GuestOnly({ children }) {
  const { user, loading } = useUser();
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Chargement…
      </div>
    );
  }
  if (user) return <Navigate to="/home" replace />;
  return children;
}

/** Optionnel : exige un rôle spécifique (admin/coach) */
export function RequireRole({ roles = [], children }) {
  const { user, loading } = useUser();
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length > 0 && !roles.includes(user.role)) {
    // pas autorisé -> redirige où tu veux (home par ex.)
    return <Navigate to="/home" replace />;
  }
  return children;
}
