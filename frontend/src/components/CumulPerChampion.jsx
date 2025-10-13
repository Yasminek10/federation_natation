import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Spinner,
  Accordion,
  Badge,
} from "react-bootstrap";
import axios from "axios";


export default function ClassementChampionnat({ id }) {
  const [championnat, setChampionnat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axios
      .get(`http://localhost:5000/api/bilan/cumul_points_clubs/${id}`)
      .then((res) => setChampionnat(res.data))
      .catch((err) => {
        console.error("Erreur fetch cumul:", err);
        setChampionnat(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center my-5">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!championnat) {
    return (
      <Container className="mt-4 text-center">
        <h5 className="text-danger">Championnat non trouvé.</h5>
      </Container>
    );
  }

  // Somme totale des points par club (toutes catégories)
  const totalPointsParClub = {};
  (championnat.categories || []).forEach((cat) =>
    (cat.classement || []).forEach((c) => {
      totalPointsParClub[c.club] =
        (totalPointsParClub[c.club] || 0) + (c.points || 0);
    })
  );

  const top3Clubs = Object.entries(totalPointsParClub)
    .map(([club, points]) => ({ club, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return (
    <Container className="mb-5 mt-5" style={{ maxWidth: "1400px" }}>
       
      <Card className="shadow-sm border-0 rounded-3 mb-4">
        
        <Card.Body>
          <h5 className="fw-bold text-primary  mb-3">Top 3 — Points cumulés</h5>

          <Table hover responsive bordered className="align-middle text-center">
            <thead className="table-light">
              <tr>
                <th style={{ width: 90 }}>Rang</th>
                <th>Club</th>
                <th style={{ width: 160 }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {top3Clubs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-3">
                    Aucun club avec des points
                  </td>
                </tr>
              ) : (
                top3Clubs.map((c, i) => (
                  <tr key={c.club}>
                    <td>
                      <Badge
                        bg={
                          i === 0 ? "warning" : i === 1 ? "secondary" : "light"
                        }
                        text={i === 2 ? "dark" : "dark"}
                      >
                        {i + 1}
                      </Badge>
                    </td>
                    <td className="fw-semibold">{c.club}</td>
                    <td className="fw-bold text-success">{c.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Classement détaillé par catégorie */}
      <Accordion alwaysOpen>
        {(championnat.categories || []).map((cat, idx) => (
          <Accordion.Item eventKey={String(idx)} key={idx}>
            <Accordion.Header>
              <span className="fw-bold text-primary">{cat.categorie}</span>
            </Accordion.Header>
            <Accordion.Body>
              <Table
                hover
                responsive
                bordered
                className="align-middle text-center mb-0"
              >
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 90 }}>Rang</th>
                    <th>Club</th>
                    <th style={{ width: 140 }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(cat.classement || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-3">
                        Aucun club classé pour cette catégorie
                      </td>
                    </tr>
                  ) : (
                    (cat.classement || []).map((club, i) => (
                      <tr key={club.club + i}>
                        <td>
                          <Badge
                            bg={
                              i === 0
                                ? "warning"
                                : i === 1
                                ? "secondary"
                                : "light"
                            }
                            text="dark"
                          >
                            {i + 1}
                          </Badge>
                        </td>
                        <td>{club.club}</td>
                        <td className="fw-bold">{club.points}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
    </Container>
  );
}
