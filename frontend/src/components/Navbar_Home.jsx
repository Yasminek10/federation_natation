// src/components/Navbar_Home.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
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
          {/* ===== VUE COACH ===== */}
          {/*{user?.role === "coach" && (
            <li>
              <Link to="/coach/view" onClick={() => setMenuOpen(false)}>
                Vue Coach
              </Link>
            </li>
          )}*/}

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

      {/* Drapeau */}
      <img src={flag} alt="Drapeau tunisien" className="flag" />

      
    </header>
  );
}
