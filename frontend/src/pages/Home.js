import React from "react";
import { useEffect, useState } from "react";

import "../styles/home.css";
import logo from "../assets/logo-ftn.png"; // Logo de la fédération
import flag from "../assets/drapeau-tunisie.png"; // Drapeau tunisien

function Home() {
  
  return (
    <div className="home">
      {/* ===== Navbar ===== */}
      <header className="navbar">
        <div className="logo-container">
          <img src={logo} alt="Fédération Tunisienne de Natation" className="logo" />
          <h3>Fédération Tunisienne de Natation</h3>
        </div>
        <nav>
          <ul>
            <li> <a href="#accueil">Accueil</a></li>
            <li><a href="#nageurs">Nageurs</a></li>
            <li><a href="#clubs">Clubs</a></li>
            <li><a href="#resultats">Résultats</a></li>
          </ul>
        </nav>
        <img src={flag} alt="Drapeau tunisien" className="flag" />
      </header>

      {/* ===== Bannière ===== */}
      <section className="banner">
        <h2>Bienvenue sur le site officiel</h2>
        <p>Explorez les compétitions de natation Tunisiennes, consultez les profils des athlètes et suivez les résultats.</p>
        <div class="btn-container">
          <button className="connect-btn" >Explorer</button>
        </div>
      </section>



      {/* ===== Section Actualités ===== */}
      <section id="actualites" className="news-section">
        <h3>Dernières actualités</h3>
        <div className="news-grid">
          <div className="news-card">
            <h4>Championnat National 2025</h4>
            <p>Retrouvez les résultats complets et les photos de l'événement.</p>
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
        <p>&copy; 2025 Fédération Tunisienne de Natation - Tous droits réservés</p>
      </footer>
    </div>
  );
}

export default Home;
