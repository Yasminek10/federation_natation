import React, { useEffect, useState } from "react";
import "../styles/home.css";
import { useNavigate } from "react-router-dom";
import Navbar_Home from "../components/Navbar_Home"; // ✅ Import
import ClubsList from "../components/Clubs";

function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setUser(savedUser);
    console.log("Utilisateur connecté :", savedUser);
  }, []);

  return (
    <div className="home">
      {/* ===== Navbar ===== */}
      <Navbar_Home user={user} />

      {/* ===== Bannière ===== */}
      <section className="banner">
        <h2>
          Bienvenue{" "}
          {user ? (user.role === "admin" ? "Administrateur" : "Coach") : ""}
        </h2>
        <p>
          Explorez les compétitions de natation Tunisiennes, consultez les
          profils des athlètes et suivez les résultats.
        </p>
        <div className="btn-container">
          {user?.role === "admin" ? (
            <button
              className="connect-btn"
              onClick={() => navigate("/admin-dashboard")}
            >
              Aller au Dashboard Admin
            </button>
          ) : user?.role === "coach" ? (
            <button
              className="connect-btn"
              onClick={() => navigate("/coach-dashboard")}
            >
              Aller à Mon Dashboard
            </button>
          ) : (
            <button className="connect-btn">Explorer</button>
          )}
        </div>
      </section>

      {/* ===== Section Actualités ===== */}
      <section id="actualites" className="news-section">
        <h3>Dernières actualités</h3>
        <div className="news-grid">
          <div className="news-card">
            <h4>Championnat National 2025</h4>
            <p>
              Retrouvez les résultats complets et les photos de l'événement.
            </p>
          </div>
          <div className="news-card">
            <h4>Stage de préparation</h4>
            <p>Les équipes nationales en stage intensif à Hammamet.</p>
          </div>
          <div className="news-card">
            <h4>Nouvelle piscine olympique</h4>
            <p>Inauguration de la nouvelle piscine olympique de Tunis.</p>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <p>
          &copy; 2025 Fédération Tunisienne de Natation - Tous droits réservés
        </p>
      </footer>
    </div>
  );
}

export default Home;
