// src/components/Navbar_Home.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import "../styles/home.css";

export default function Navbar_Home({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="home-navbar">
      {/* Logo + Wordmark */}
      <div className="logo-container">
        <img src={logo} alt="FTN" className="logo" />
        <h3 className="brand-title">Fédération Tunisienne de Natation</h3>
      </div>

      {/* Burger (mobile) */}
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Ouvrir le menu"
      >
        ☰
      </button>

      {/* Navigation */}
      <nav className={`nav-links ${menuOpen ? "active" : ""}`}>
        <ul onClick={() => setMenuOpen(false)}>
          <li><Link to="/home">Accueil</Link></li>
          <li><Link to="/nageurs">Nageurs</Link></li>
          <li><Link to="/clubs">Clubs</Link></li>
          <li><Link to="/championnats">Championnat</Link></li>

          {user?.role === "admin" && (
            <li><Link to="/admin-dashboard">Admin Dashboard</Link></li>
          )}
          {user?.role === "coach" && (
            <li><Link to="/coach-dashboard">Coach Dashboard</Link></li>
          )}
        </ul>
      </nav>

      {/* Drapeau (garde-le tel quel) */}
      <img src={flag} alt="Drapeau tunisien" className="flag" />
    </header>
  );
}
