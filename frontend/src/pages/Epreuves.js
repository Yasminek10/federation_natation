import React, { useEffect, useState } from "react";
import { Container, Card, ListGroup, Spinner, Button } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, BarChart3 } from "lucide-react";
import Navbar_Home from "../components/Navbar_Home";
import ButtonBack from "../components/ButtonBack";

function Epreuves({ user }) {
  const { public_id } = useParams();
  const [epreuves, setEpreuves] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {

    fetch(`http://localhost:5000/api/championnats/${public_id}/epreuves`)
      .then((res) => res.json())
      .then((data) => {
        setEpreuves(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [public_id]);

  return (
    <div>
      {/* ===== Navbar ===== */}
      <Navbar_Home user={user} />

      <Container className="mt-5">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          {/* === Left side (title) === */}
          <div className="d-flex align-items-center gap-3">
            <div>
              <h2 className="fw-bold text-primary mb-1 d-flex align-items-center gap-2">
                <Trophy size={32} className="text-warning" />
                Épreuves du Championnat
              </h2>
              <p className="text-muted mb-0">
                Cliquez sur une épreuve pour voir les résultats détaillés
              </p>
            </div>
          </div>

          {/* === Right side (buttons) === */}
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="success"
              className="px-4 py-2 fw-bold shadow-sm"
              onClick={() => navigate(`/statistiques/${public_id}`)}
            >
              <BarChart3 size={20} className="me-2" />
              Afficher les statistiques
            </Button>
            <ButtonBack />
          </div>
        </div>

        {/* ===== Liste des épreuves ===== */}
        <Card className="shadow-lg border-0 rounded-3">
          <Card.Body>
            {loading ? (
              <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : epreuves.length > 0 ? (
              <ListGroup variant="flush">
                {epreuves.map((e) => (
                  <ListGroup.Item
                    key={e.id}
                    action
                    onClick={() =>
                      navigate(`/epreuves/${e.public_id}/resultats`)
                    }
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
            ) : (
              <p className="text-center text-muted">
                Aucune épreuve disponible pour ce championnat.
              </p>
            )}
          </Card.Body>
        </Card>

        {/* ===== Style Hover ===== */}
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
