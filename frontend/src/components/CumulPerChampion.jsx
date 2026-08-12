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

export default function ClassementChampionnat({ champId }) {
  const [championnat, setChampionnat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!champId) return;
    setLoading(true);
    axios
      .get(`http://localhost:5000/api/bilan/cumul_points_clubs/${champId}`)
      .then((res) => setChampionnat(res.data))
      .catch((err) => {
        console.error("Erreur fetch cumul:", err);
        setChampionnat(null);
      })
      .finally(() => setLoading(false));
  }, [champId]);

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
  const formatPoints = (value) =>
    new Intl.NumberFormat("fr-FR").format(value || 0);

  const totalPointsParClub = {};
  (championnat.categories || []).forEach((cat) =>
    (cat.classement || []).forEach((c) => {
      const current = totalPointsParClub[c.club] || {
        points_individuels: 0,
        points_relais_bruts: 0,
        points_relais: 0,
        points: 0,
      };
      current.points_individuels += c.points_individuels || 0;
      current.points_relais_bruts += c.points_relais_bruts || 0;
      current.points_relais += c.points_relais || 0;
      current.points += c.points || 0;
      totalPointsParClub[c.club] = current;
    })
  );

  const top3Clubs = Object.entries(totalPointsParClub)
    .map(([club, details]) => ({ club, ...details }))
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
                <th>Individuels</th>
                <th>Relais bruts</th>
                <th>Relais &times;2</th>
                <th style={{ width: 160 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {top3Clubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
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
                    <td>{formatPoints(c.points_individuels)}</td>
                    <td>{formatPoints(c.points_relais_bruts)}</td>
                    <td>{formatPoints(c.points_relais)}</td>
                    <td className="fw-bold text-success">{formatPoints(c.points)}</td>
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
          <Accordion.Item eventKey={String(idx)} key={cat.champId ?? idx}>
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
                    <th>Individuels</th>
                    <th>Relais bruts</th>
                    <th>Relais &times;2</th>
                    <th style={{ width: 140 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(cat.classement || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-3">
                        Aucun club classé pour cette catégorie
                      </td>
                    </tr>
                  ) : (
                    (cat.classement || []).map((club, i) => (
                      <React.Fragment key={`${cat.categorie}-${club.club}`}>
                        <tr>
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
                          <td>{formatPoints(club.points_individuels)}</td>
                          <td>{formatPoints(club.points_relais_bruts)}</td>
                          <td>{formatPoints(club.points_relais)}</td>
                          <td className="fw-bold">{formatPoints(club.points)}</td>
                        </tr>
                        <tr>
                          <td colSpan={6} className="p-0 bg-light text-start">
                            <details className="px-3 py-2">
                              <summary className="text-primary fw-semibold">
                                D&eacute;tail du calcul ({(club.details || []).length} nages)
                              </summary>
                              <Table responsive bordered size="sm" className="mt-2 mb-1 bg-white">
                                <thead className="table-light">
                                  <tr>
                                    <th>&Eacute;preuve</th>
                                    <th>Nageur / &Eacute;quipe</th>
                                    <th>Type</th>
                                    <th>Points bruts</th>
                                    <th>Points compt&eacute;s</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(club.details || []).map((detail, detailIndex) => (
                                    <tr key={`${detail.epreuve}-${detail.participant}-${detailIndex}`}>
                                      <td>{detail.epreuve}</td>
                                      <td>{detail.participant}</td>
                                      <td>{detail.type}</td>
                                      <td>{formatPoints(detail.points_bruts)}</td>
                                      <td className="fw-semibold">{formatPoints(detail.points)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </details>
                          </td>
                        </tr>
                      </React.Fragment>
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
