// frontend/src/pages/Epreuves.js
import React, { useEffect, useState } from "react";
import { Container, Card, ListGroup, Spinner } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react"; // joli icône
import Navbar_Home from "../components/Navbar_Home";
import { Button } from "react-bootstrap";
import { BarChart3 } from "lucide-react"; 

function Epreuves({ user }) {
  const { champId } = useParams();
  const [epreuves, setEpreuves] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`http://localhost:5000/api/championnats/${champId}/epreuves`)
      .then(res => res.json())
      .then(data => {
        setEpreuves(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [champId]);

  return (
    <div>
      {/* ===== Navbar ===== */}
      <Navbar_Home user={user} />
    <Container className="mt-5">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="fw-bold text-primary">
          <Trophy size={32} className="me-2 text-warning" />
          Épreuves du Championnat
        </h2>
        <p className="text-muted">
          Cliquez sur une épreuve pour voir les résultats détaillés
        </p>
      </div>

      {/* Card */}
      <Card className="shadow-lg border-0 rounded-3">
        <Card.Body>
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : epreuves.length > 0 ? (
             <>
            <ListGroup variant="flush">
              {epreuves.map(e => (
                <ListGroup.Item
                  key={e.id}
                  action
                  onClick={() => navigate(`/epreuves/${e.epreuve_id}/resultats`)}
                  className="py-3 fw-semibold d-flex justify-content-between align-items-center list-hover"
                >
                  <span>
                    {e.distance}m {e.nage} ({e.genre})
                  </span>
                  <span className="badge bg-primary rounded-pill">
                    Voir résultats
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
            {/* === Bouton Statistiques === */}
      <div className="text-center mt-4">
        <Button
          variant="success"
          className="px-4 py-2 fw-bold shadow-sm"
          onClick={() => navigate("/statistiques")}
        >
          <BarChart3 size={20} className="me-2" />
          Afficher les statistiques
        </Button>
      </div> </>
          ) : (
            <p className="text-center text-muted">
              Aucune épreuve disponible pour ce championnat.
            </p>
          )}
        </Card.Body>
      </Card>

      {/* Custom CSS pour hover */}
      <style>
        {`
          .list-hover:hover {
            background-color: #f8f9fa;
            cursor: pointer;
            transition: 0.3s;
          }
        `}
      </style>
    </Container>
    </div>
  );
}

export default Epreuves;
