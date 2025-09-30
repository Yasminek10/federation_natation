import React from "react";
import { Card, Accordion, Badge, Table } from "react-bootstrap";

export default function RelayResults({ relais = [] }) {
  // === Regrouper par année (extraite depuis "championnat") ===
  const groupedByYear = relais.reduce((acc, item) => {
    let year = "Inconnue";

    if (item.championnat) {
      const match = item.championnat.match(/\((\d{4})\)/); // ex: "Coupe Nationale (2024)"
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
        Historique des résultats en relais
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
                        <th>Club</th>
                        <th>Ordre de passage</th>
                        <th>Temps de passage</th>
                        <th>Temps total</th>
                        <th>Place</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByYear[year].map((r, i) => (
                        <tr key={i}>
                          <td>{r.championnat}</td>
                          <td>{r.saison}</td>
                          <td>{r.epreuve}</td>
                          <td>
                            <Badge bg="secondary">{r.categorie}</Badge>
                          </td>
                          <td>{r.club}</td>
                          <td>
                            {r.leg_order || (r.role && (r.role.match(/\d+/)?.[0])) || "-"}
                          </td> 
                          <td>
                            {r.split_50}
                            {r.split_2nd_50 ? ` / ${r.split_2nd_50}` : ""}
                          </td>
                          <td>{r.temps_total || "-"}</td>
                          <td>{r.place}</td>
                          <td>
                            <Badge bg={r.statut === "OK" ? "success" : "danger"}>
                              {r.statut}
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
            Aucun résultat relais trouvé.
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
