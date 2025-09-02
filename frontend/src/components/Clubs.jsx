import React, { useEffect, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
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
    <div className="container p-4" style={{ maxWidth: 1000, marginTop: "80px" }}>
      <Navbar user={user} />
      <h1 className="mb-1 text-dark fw-bold">Liste des clubs</h1>
      <p className="text-muted mb-3">Nombre total de clubs : {clubs.length}</p>

      <div className="clubs-grid">
        {currentClubs.map((club) => (
          <Card
            key={club.id}
            className="club-card shadow-sm"
            onClick={() => navigate(`/clubs/${club.id}/nageurs`)}
          >
            <Card.Body className="d-flex flex-column align-items-center justify-content-center">
              <Card.Title className="text-center">{club.nom}</Card.Title>
              <p className="text-muted">Nageurs: {club.nbre_nageurs}</p>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Pagination controls */}
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
  );
}
