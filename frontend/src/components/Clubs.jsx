import React, { useEffect, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo-ftn.png";
import flag from "../assets/drapeau-tunisie.png";
import "../styles/ClubsList.css";

export default function ClubsList({ user }) {
  const [clubs, setClubs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const clubsPerPage = 6; // nombre de clubs par page
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/api/clubs")
      .then((res) => res.json())
      .then((data) => setClubs(data))
      .catch((err) => console.error("Erreur chargement clubs:", err));
  }, []);

  // Pagination logic
  const indexOfLastClub = currentPage * clubsPerPage;
  const indexOfFirstClub = indexOfLastClub - clubsPerPage;
  const currentClubs = clubs.slice(indexOfFirstClub, indexOfLastClub);

  const nextPage = () => {
    if (currentPage < Math.ceil(clubs.length / clubsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div>
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
              <a href="/home">Accueil</a>
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
      <div className="container mt-5">
        <h3 className="mb-2 text-dark fw-bold">Liste des clubs</h3>
        <p className="text-muted mb-4">
          Nombre total de clubs : {clubs.length}
        </p>

        {/* Grille des clubs */}
        <div className="clubs-grid">
          {currentClubs.map((club) => (
            <Card
              key={club.id}
              className="club-card shadow-sm border-0"
              onClick={() => navigate(`/clubs/${club.id}/nageurs`)}
            >
              <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                <Card.Title className="text-center fw-bold">
                  {club.nom}
                </Card.Title>
                <p className="text-muted">Nageurs : {club.nbre_nageurs}</p>
              </Card.Body>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between align-items-center mt-4">
          <Button
            variant="outline-primary"
            disabled={currentPage === 1}
            onClick={prevPage}
          >
            ⬅️ Précédent
          </Button>
          <span>
            Page {currentPage} sur {Math.ceil(clubs.length / clubsPerPage)}
          </span>
          <Button
            variant="outline-primary"
            disabled={currentPage === Math.ceil(clubs.length / clubsPerPage)}
            onClick={nextPage}
          >
            Suivant ➡️
          </Button>
        </div>
      </div>
    </div>
  );
}
