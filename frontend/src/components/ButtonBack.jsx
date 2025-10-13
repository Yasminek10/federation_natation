import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";

export default function ButtonBack({ to, label = "Retour" }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
    else navigate(-1); // revenir à la page précédente
  };

  return (
    <Button
      variant="outline-primary"
      onClick={handleClick}
      className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm"
      style={{
        fontWeight: "500",
        borderRadius: "10px",
        fontSize: "0.95rem",
        transition: "all 0.3s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#0d6efd";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "#0d6efd";
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>←</span>
      {label}
    </Button>
  );
}
