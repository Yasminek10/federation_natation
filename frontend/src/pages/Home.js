import React, { useEffect, useState } from "react";
import "../styles/home.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button, Spinner } from "react-bootstrap";
import Navbar_Home from "../components/Navbar_Home";
import ClubsList from "../components/Clubs";

function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setUser(savedUser);
    //console.log("Utilisateur connecté :", savedUser);
  }, []);
  const [lastChampionnat, setLastChampionnat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the last championnat (assuming your backend returns a list sorted by date)
    axios
      .get("http://localhost:5000/api/championnats")
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) {
          const last = data[data.length - 1]; // last one added
          setLastChampionnat(last);
        }
      })
      .catch((err) => console.error("Erreur chargement championnat:", err))
      .finally(() => setLoading(false));
  }, []);

  const goToOCR = () => navigate("/ocr");
  const goToLastChampionnat = () => {
    if (lastChampionnat) {
      navigate(`/championnats/${lastChampionnat.public_id}/epreuves`);
    }
  };

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
        <h3>Accès Rapide</h3>

        {loading ? (
          <div className="text-center my-4">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <div className="news-grid">
            {/* === Analyse rapide d'image === */}
            <div
              className="news-card clickable"
              onClick={goToOCR}
              style={{ cursor: "pointer" }}
            >
              <h4>🖼️ Analyse rapide d’image</h4>
              <p>
                Importez une image de résultat et obtenez une analyse OCR
                instantanée.
              </p>
            </div>

            {/* === Dernier Championnat === */}
            <div
              className={`news-card clickable ${
                !lastChampionnat ? "disabled-card" : ""
              }`}
              onClick={goToLastChampionnat}
              style={{
                cursor: lastChampionnat ? "pointer" : "not-allowed",
                opacity: lastChampionnat ? 1 : 0.6,
              }}
            >
              <h4>🏊‍♂️ Dernier Championnat</h4>
              <p>
                Consultez les épreuves et résultats du dernier championnat
                ajouté.
              </p>
              {lastChampionnat && (
                <small className="text-muted">
                  ({lastChampionnat.nom || lastChampionnat.championnat})
                </small>
              )}
            </div>

            {/* === (Optional third card to keep design balance) === */}
            {/* <div className="news-card">
        <h4>📅 Calendrier des compétitions</h4>
        <p>Découvrez les prochains événements de la saison.</p>
      </div> */}
          </div>
        )}
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
