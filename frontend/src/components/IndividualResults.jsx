import React from "react";
import { Card, Accordion, Badge, Table } from "react-bootstrap";

export default function IndividualResults({ historique = [] }) {
  // === Regrouper par année (extraite depuis "championnat") ===
  const groupedByYear = historique.reduce((acc, item) => {
    let year = "Inconnue";

    if (item.championnat) {
      const match = item.championnat.match(/\((\d{4})\)/); // capture (2025)
      if (match) {
        year = match[1];
      }
    }

    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  const years = Object.keys(groupedByYear).sort((a, b) => b - a); // ordre décroissant

  return (
    <Card className="shadow-sm border-0 rounded-3">
      <Card.Header className="bg-primary text-white">
        Historique des résultats individuels
      </Card.Header>
      <Card.Body>
        {years.length > 0 ? (
          <Accordion defaultActiveKey={years[0]}>
            {years.map((year, idx) => (
              <Accordion.Item eventKey={year} key={idx}>
                <Accordion.Header>
                  {year}{" "}
                  <Badge bg="info" className="ms-2">
                    {groupedByYear[year].length} résultats
                  </Badge>
                </Accordion.Header>
                <Accordion.Body className="p-0">
                  <Table hover responsive className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Championnat</th>
                        <th>Saison</th>
                        <th>Épreuve</th>
                        <th>Catégorie</th>
                        <th>Temps</th>
                        <th>Points</th>
                        <th>Place</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByYear[year].map((h, i) => (
                        <tr key={i}>
                          <td>{h.championnat}</td>
                          <td>{h.saison}</td>
                          <td>{h.epreuve}</td>
                          <td>
                            <Badge bg="secondary">{h.categorie}</Badge>
                          </td>
                          <td>{h.temps}</td>
                          <td>{h.points}</td>
                          <td>{h.place}</td>
                          <td>
                            <Badge bg={h.statut === "OK" ? "success" : "danger"}>
                              {h.statut}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : (
          <div className="text-center text-muted py-3">
            Aucun résultat individuel trouvé.
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
