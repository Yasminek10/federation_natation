import React, { useEffect, useState } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";

function AnalysePage() {
  const [filters, setFilters] = useState({
    categorie: "",
    genre: "",
    distance: ""
  });
  const [results, setResults] = useState([]);

  // Charger les résultats depuis Flask API
  const fetchResults = async () => {
    const params = new URLSearchParams(filters);
    const res = await fetch(`http://localhost:5000/api/results/?${params}`);
    const data = await res.json();
    setResults(data);
  };

  useEffect(() => {
    fetchResults();
  }, []);

  return (
    <Container fluid>
      {/* Titre */}
      <Row className="bg-primary text-white p-3 mb-3">
        <Col><h2>Analyse des Résultats</h2></Col>
      </Row>

      <Row>
        {/* Sidebar Filtres */}
        <Col md={3} className="bg-light p-3">
          <h5>Filtres</h5>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Catégorie</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex: Junior"
                value={filters.categorie}
                onChange={(e) =>
                  setFilters({ ...filters, categorie: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Genre</Form.Label>
              <Form.Select
                value={filters.genre}
                onChange={(e) =>
                  setFilters({ ...filters, genre: e.target.value })
                }
              >
                <option value="">Tous</option>
                <option value="M">Homme</option>
                <option value="F">Femme</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Distance</Form.Label>
              <Form.Control
                type="number"
                placeholder="Ex: 100"
                value={filters.distance}
                onChange={(e) =>
                  setFilters({ ...filters, distance: e.target.value })
                }
              />
            </Form.Group>

            <Button variant="primary" onClick={fetchResults}>
              Appliquer
            </Button>
          </Form>
        </Col>

        {/* Résultats */}
        <Col md={9}>
          <h5>Résultats</h5>
          {results.length === 0 ? (
            <p>Aucun résultat trouvé</p>
          ) : (
            results.map((r) => (
              <Card key={r.id} className="mb-2">
                <Card.Body>
                  <Card.Title>{r.nageur}</Card.Title>
                  <Card.Text>
                    Catégorie: {r.categorie} | Genre: {r.genre} <br />
                    Épreuve: {r.epreuve} ({r.distance}m) <br />
                    Temps: {r.temps}
                  </Card.Text>
                </Card.Body>
              </Card>
            ))
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default AnalysePage;
