// frontend/src/pages/Championnats.js
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Navbar_Home from "../components/Navbar_Home";

function Championnats({ user }) {
  const [championnats, setChampionnats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/api/championnats/")
      .then(res => res.json())
      .then(data => {
        setChampionnats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <div>
      {/* ===== Navbar ===== */}
      <Navbar_Home user={user} />
    <Container className="mt-4">
      <h2 className="text-center mb-4">🏆 Liste des Championnats</h2>
      <Row className="g-4">
        {championnats.map(c => (
          <Col key={c.id} xs={12} sm={6} md={4} lg={3}>
            <Card
              className="shadow-sm h-100 hover-card"
              onClick={() => navigate(`/championnats/${c.id}/epreuves`)}
              style={{ cursor: "pointer", borderRadius: "12px" }}
            >
              <Card.Body className="d-flex flex-column justify-content-between">
                <Card.Title className="text-primary fw-bold">
                  {c.nom}
                </Card.Title>
                <Card.Text>
                  <strong>Saison :</strong> {c.saison} <br />
                  <strong>Lieu :</strong> {c.lieu}
                </Card.Text>
                <div className="mt-auto text-end">
                  <span className="btn btn-outline-primary btn-sm">
                    Voir détails →
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
    </div>
  );
}

export default Championnats;
