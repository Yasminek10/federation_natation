// frontend/src/pages/Resultats.js
import React, { useEffect, useState } from "react";
import { Container, Table, Form, Card, Row, Col, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "../styles/results.css"; // <-- custom styles

function Resultats() {
  const { epreuveId } = useParams();
  const [resultats, setResultats] = useState([]);
  const [filterClub, setFilterClub] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [loading, setLoading] = useState(true);

  // Liste dynamique des clubs
  const clubs = Array.from(new Set(resultats.map(r => r.club).filter(Boolean)));

  // Liste statique des catégories
  const categories = [
    { id: 1, label: "Juniors/Seniors" },
    { id: 2, label: "Cadets" },
    { id: 3, label: "Minimes" },
    { id: 4, label: "Benjamins" },
    { id: 5, label: "TC" },
  ];

  useEffect(() => {
    fetch(`http://localhost:5000/api/epreuves/${epreuveId}/resultats`)
      .then(res => res.json())
      .then(data => {
        setResultats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [epreuveId]);

  // === Appliquer filtres ===
  const filtered = resultats.filter(r => {
    const byClub = !filterClub || (r.club && r.club === filterClub);
    const byCategorie = !filterCategorie || (r.categorie && r.categorie === filterCategorie);
    return byClub && byCategorie;
  });

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <h2 className="text-center mb-4"> Résultats de l'épreuve</h2>

      {/* === Filtres === */}
      <Card className="p-3 mb-4 shadow-sm">
        <Row className="g-3">
          {/* Filtre club */}
          <Col xs={12} md={6} lg={4}>
            <Form.Select
              value={filterClub}
              onChange={e => setFilterClub(e.target.value)}
            >
              <option value="">Tous les clubs</option>
              {clubs.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Form.Select>
          </Col>

          {/* Filtre catégorie */}
          <Col xs={12} md={6} lg={4}>
            <Form.Select
              value={filterCategorie}
              onChange={e => setFilterCategorie(e.target.value)}
            >
              <option value="">Toutes catégories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.label}>
                  {cat.label}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      </Card>

      {/* === Tableau === */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <h5 className="mb-3">Classement</h5>
          <div className="table-responsive">
            <Table striped bordered hover responsive>
              <thead className="table-light">
                <tr>
                  <th>Place</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Temps</th>
                  <th>Points</th>
                  <th>Club</th>
                  <th>Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>{r.place}</td>
                    <td>{r.nom}</td>
                    <td>{r.prenom}</td>
                    <td>{r.temps}</td>
                    <td>{r.points}</td>
                    <td>{r.club}</td>
                    <td>{r.categorie}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* === Graphiques === */}
      <Card className="shadow-sm">
        <Card.Body>
          <h5 className="mb-3">Répartition des points par club</h5>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={filtered}>
              <XAxis dataKey="club" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="points" fill="#0d6efd" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default Resultats;
