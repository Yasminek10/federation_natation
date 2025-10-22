import React, { useEffect, useState } from "react";
import {
  Container,
  Table,
  Form,
  Card,
  Row,
  Col,
  Spinner,
} from "react-bootstrap";
import { useParams, Link } from "react-router-dom";
import Navbar_Home from "../components/Navbar_Home";
import "../styles/results.css";

function Resultats({ user }) {
  const { champId, publicId } = useParams();
  const [resultats, setResultats] = useState([]);
  const [filterClub, setFilterClub] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [loading, setLoading] = useState(true);

  // === Charger les résultats ===
  useEffect(() => {
    fetch(`http://localhost:5000/api/epreuves/${champId}/${publicId}/resultats`)
      .then((res) => res.json())
      .then((data) => {
        setResultats(data); // API renvoie directement la liste
        setLoading(false);      })
      .catch(() => setLoading(false));
  }, [champId, publicId]);

  // === Listes dynamiques pour les filtres ===
  const clubs = Array.from(
    new Set(resultats.map((r) => r.club).filter(Boolean))
  );
  const categories = Array.from(
    new Set(resultats.map((r) => r.categorie).filter(Boolean))
  );

  // === Appliquer filtres ===
  const filtered = resultats.filter((r) => {
    const byClub = !filterClub || (r.club && r.club === filterClub);
    const byCategorie =
      !filterCategorie || (r.categorie && r.categorie === filterCategorie);
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
    <div>
      <Navbar_Home user={user} />

      <Container className="mt-4">
        <h2 className="text-center mb-4">Résultats de l'épreuve</h2>

        {/* === Filtres === */}
        <Card className="p-3 mb-4 shadow-sm">
          <Row className="g-3">
            <Col xs={12} md={6} lg={4}>
              <Form.Select
                value={filterClub}
                onChange={(e) => setFilterClub(e.target.value)}
              >
                <option value="">Tous les clubs</option>
                {clubs.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={6} lg={4}>
              <Form.Select
                value={filterCategorie}
                onChange={(e) => setFilterCategorie(e.target.value)}
              >
                <option value="">Toutes catégories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col>
              <Link to={`/epreuves/${champId}/${publicId}/cumul`}>
                <button className="btn btn-primary">
                  Afficher le cumul des points
                </button>
              </Link>
            </Col>
          </Row>
        </Card>

        {/* === Tableau des résultats === */}
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
                  {(() => {
                    const sorted = [...filtered].sort((a, b) =>
                      (a.categorie || "").localeCompare(b.categorie || "")
                    );
                    let lastCategorie = null;
                    const rows = [];

                    sorted.forEach((r, i) => {
                      if (r.categorie !== lastCategorie) {
                        rows.push(
                          <tr
                            key={`cat-${r.categorie}`}
                            className="table-group-divider bg-light"
                          >
                            <td colSpan="7" className="fw-bold text-center">
                              {r.categorie}
                            </td>
                          </tr>
                        );
                        lastCategorie = r.categorie;
                      }
                      rows.push(
                        <tr key={`res-${i}`}>
                          <td>{r.place}</td>
                          <td>{r.nom}</td>
                          <td>{r.prenom}</td>
                          <td>{r.temps}</td>
                          <td>{r.points}</td>
                          <td>{r.club}</td>
                          <td>{r.categorie}</td>
                        </tr>
                      );
                    });

                    return rows;
                  })()}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default Resultats;
