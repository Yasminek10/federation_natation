// src/components/Navbar_Home.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import "../styles/home.css";

export default function Navbar_Home({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // --- Bilan modal state ---
  const [showBilan, setShowBilan] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const [champs, setChamps] = useState([]); // [{id, label}]
  const [cats, setCats] = useState([]); // [{id, nom, max_indiv, max_relay}]
  const [clubs, setClubs] = useState([]); // [{id, nom}]
  const [champPublicId, setChampPublicId] = useState("");
  const [catPublicId, setCatPublicId] = useState("");
  const [clubPublicId, setClubPublicId] = useState("");

  const openBilan = async () => {
    setShowBilan(true);
    setError(null);
    // charge championnats + clubs si pas encore faits
    if (champs.length === 0) {
      setLoadingOpts(true);
      try {
        const r = await fetch(
          `http://localhost:5000/api/bilan/categories?champ_id=${encodeURIComponent(
            champPublicId
          )}`,
          { credentials: "include" }
        );
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.message || "Erreur chargement championnats");
        setChamps(data.championnats || []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingOpts(false);
      }
    }
    if (clubs.length === 0) {
      setLoadingClubs(true);
      try {
        const r = await fetch("http://localhost:5000/api/bilan/clubs", {
          credentials: "include",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Erreur chargement clubs");
        setClubs(data.clubs || []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingClubs(false);
      }
    }
  };

  const onChampChange = async (id) => {
    setChampPublicId(id);
    setCatPublicId("");
    setCatPublicId([]);
    if (!id) return;
    setLoadingCats(true);
    setError(null);
    try {
      const r = await fetch(
        `http://localhost:5000/api/bilan/categories?champ_id=${encodeURIComponent(
          id
        )}`,
        { credentials: "include" }
      );
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.message || "Erreur chargement catégories");
      setCats(data.categories || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingCats(false);
    }
  };

  const downloadBilan = () => {
    setError(null);
    if (!champPublicId || !catPublicId || !clubPublicId) {
      setError("Merci de choisir un championnat, une catégorie et un club.");
      return;
    }
    const q = new URLSearchParams({
      champ_id: champPublicId,
      categorie_id: catPublicId,
      club_id: clubPublicId,
    });

    // Ouvre un onglet avec la page imprimable (puis “Enregistrer en PDF”)
    window.open(
      `http://localhost:5000/api/bilan/generate?${q.toString()}`,
      "_blank"
    );
  };

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
          <li>
            {user?.role === "coach" ? (
              <Link to="/coach/view" onClick={() => setMenuOpen(false)}>
                Vue Coach
              </Link>
            ) : (
              <Link
                to="#"
                onClick={() => {
                  setMenuOpen(false);
                  openBilan();
                }}
              >
                Bilan
              </Link>
            )}
          </li>

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

      {/* ---- Modal Bilan ---- */}
      <Modal
        show={showBilan}
        onHide={() => setShowBilan(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Créer un bilan (PDF)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Form className="d-grid gap-3">
            <Form.Group>
              <Form.Label>Championnat</Form.Label>
              <Form.Select
                value={champPublicId}
                onChange={(e) => onChampChange(e.target.value)}
                disabled={loadingOpts}
                required
              >
                <option value="">— choisir —</option>
                {champs.map((c) => (
                  <option key={c.public_id} value={c.public_id}>
                    {c.label}
                  </option>
                ))}
              </Form.Select>

              {loadingOpts && (
                <div className="mt-2">
                  <Spinner size="sm" /> Chargement…
                </div>
              )}
            </Form.Group>

            <Form.Group>
              <Form.Label>Catégorie</Form.Label>
              <Form.Select
                value={catPublicId}
                onChange={(e) => setCatPublicId(e.target.value)}
                disabled={!champPublicId || loadingCats}
                required
              >
                <option value="">— choisir —</option>
                {cats.map((x) => (
                  <option key={x.public_id} value={x.public_id}>
                    {x.nom}
                  </option>
                ))}
              </Form.Select>
              {loadingCats && (
                <div className="mt-2">
                  <Spinner size="sm" /> Chargement…
                </div>
              )}
            </Form.Group>

            <Form.Group>
              <Form.Label>Club</Form.Label>
              <Form.Select
                value={clubPublicId}
                onChange={(e) => setClubPublicId(e.target.value)}
                disabled={loadingClubs}
                required
              >
                <option value="">— choisir —</option>
                {clubs.map((cl) => (
                  <option key={cl.public_id} value={cl.public_id}>
                    {cl.nom}
                  </option>
                ))}
              </Form.Select>
              {loadingClubs && (
                <div className="mt-2">
                  <Spinner size="sm" /> Chargement…
                </div>
              )}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBilan(false)}>
            Fermer
          </Button>
          <Button
            variant="primary"
            onClick={downloadBilan}
            disabled={!champPublicId || !catPublicId || !clubPublicId}
          >
            {downloading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Génération…
              </>
            ) : (
              "Télécharger PDF"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </header>
  );
}
