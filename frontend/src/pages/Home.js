import React, { useEffect, useState } from "react";
import "../styles/home.css";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import { Link, useNavigate } from "react-router-dom";
import ClubsList from "../components/Clubs";

function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Récupérer user depuis localStorage (sauvegardé après Login)
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setUser(savedUser);
    console.log("Utilisateur connecté :", savedUser);
  }, []);

  return (
    <div className="home">
      {/* ===== Navbar ===== */}
      <header className="navbar">
        <div className="logo-container">
          <img
            src={logo}
            alt="Fédération Tunisienne de Natation"
            className="logo"
          />
          <h3>Fédération Tunisienne de Natation</h3>
        </div>
        <nav>
          <ul>
            <li>
              <a href="#accueil">Accueil</a>
            </li>
            <li>
              <Link to="/nageurs">Nageurs</Link>
            </li>
            <li>
              <Link to="/clubs">Clubs</Link>
            </li>
            <li>
              <a href="#resultats">Résultats</a>
            </li>

            {/* Role-based navigation */}
            {user?.role === "admin" && (
              <li>
                <Link to="/admin-dashboard">Admin Dashboard</Link>
              </li>
            )}
            {user?.role === "coach" && (
              <li>
                <Link to="/coach-dashboard">Coach Dashboard</Link>
              </li>
            )}
          </ul>
        </nav>
        <img src={flag} alt="Drapeau tunisien" className="flag" />
      </header>

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
          {/* Bouton qui redirige vers le bon dashboard */}
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
