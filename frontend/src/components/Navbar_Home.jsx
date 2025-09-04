import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import "../styles/home.css";

export default function Navbar_Home({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="navbar">
      {/* Logo */}
      <div className="logo-container">
        <img src={logo} alt="FTN" className="logo" />
        <h3>Fédération Tunisienne de Natation</h3>
      </div>

      {/* Bouton hamburger (mobile) */}
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </button>

      {/* Navigation */}
      <nav className={`nav-links ${menuOpen ? "active" : ""}`}>
        <ul>
          <li>
            <Link to="/home" onClick={() => setMenuOpen(false)}>
              Accueil
            </Link>
          </li>
          <li>
            <Link to="/nageurs" onClick={() => setMenuOpen(false)}>
              Nageurs
            </Link>
          </li>
          <li>
            <Link to="/clubs" onClick={() => setMenuOpen(false)}>
              Clubs
            </Link>
          </li>
          <li>
            <Link to="/championnats" onClick={() => setMenuOpen(false)}>
              Championnat
            </Link>
          </li>

          {user?.role === "admin" && (
            <li>
              <Link to="/admin-dashboard" onClick={() => setMenuOpen(false)}>
                Admin Dashboard
              </Link>
            </li>
          )}
          {user?.role === "coach" && (
            <li>
              <Link to="/coach-dashboard" onClick={() => setMenuOpen(false)}>
                Coach Dashboard
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* Flag */}
      <img src={flag} alt="Drapeau tunisien" className="flag" />
    </header>
  );
}
