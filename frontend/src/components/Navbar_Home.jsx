// src/components/Navbar.js
import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import "../styles/home.css"; // ou crée un Navbar.css si tu veux isoler le style

export default function Navbar_Home({ user }) {
  return (
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
            <Link to="/championnats">Championnat</Link>
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
  );
}
