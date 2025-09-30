import React from "react";
import { Card, Table } from "react-bootstrap";
import { FaMedal } from "react-icons/fa";

export default function MedalsCount({ historique = [], relais = [], medaillesTc = [] }) {
  // Médailles classiques (places 1/2/3 depuis résultats)
  const allResults = [...historique, ...relais];

  const base = allResults.reduce(
    (acc, res) => {
      if (res.place === 1) acc.gold += 1;
      else if (res.place === 2) acc.silver += 1;
      else if (res.place === 3) acc.bronze += 1;
      return acc;
    },
    { gold: 0, silver: 0, bronze: 0 }
  );

  // Médailles TC (tc_place 1/2/3)
  const tc = medaillesTc.reduce(
    (acc, m) => {
      if (m.tc_place === 1) acc.gold += 1;
      else if (m.tc_place === 2) acc.silver += 1;
      else if (m.tc_place === 3) acc.bronze += 1;
      return acc;
    },
    { gold: 0, silver: 0, bronze: 0 }
  );

  const totals = {
    gold: base.gold + tc.gold,
    silver: base.silver + tc.silver,
    bronze: base.bronze + tc.bronze,
  };

  const medalStyles = {
    gold: { color: "#FFD700" },
    silver: { color: "#C0C0C0" },
    bronze: { color: "#CD7F32" },
  };

  const labelForPlace = (p) => (p === 1 ? "Or" : p === 2 ? "Argent" : "Bronze");

  return (
    <Card className="shadow border-0 rounded-3 mb-4">
      <Card.Header className="bg-primary text-white fw-bold">
        🏅 Palmarès du nageur
      </Card.Header>

      <Card.Body>
        {/* Totaux (classiques + TC) */}
        <div className="d-flex justify-content-around text-center">
          <div>
            <FaMedal size={40} style={medalStyles.silver} />
            <h4 className="mt-2">{totals.silver}</h4>
            <p className="text-muted mb-0">Argent (total)</p>
          </div>
          <div>
            <FaMedal size={40} style={medalStyles.gold} />
            <h4 className="mt-2">{totals.gold}</h4>
            <p className="text-muted mb-0">Or (total)</p>
          </div>
          <div>
            <FaMedal size={40} style={medalStyles.bronze} />
            <h4 className="mt-2">{totals.bronze}</h4>
            <p className="text-muted mb-0">Bronze (total)</p>
          </div>
        </div>

        {/* Répartition TC vs non-TC (petit récap) */}
        <div className="d-flex justify-content-center gap-4 text-center mt-3 small text-muted">
          <div>Classiques — Or:{base.gold} / Ag:{base.silver} / Br:{base.bronze}</div>
          <div>TC — Or:{tc.gold} / Ag:{tc.silver} / Br:{tc.bronze}</div>
        </div>

        {/* Traçabilité des médailles TC */}
        {medaillesTc?.length > 0 && (
          <div className="mt-4">
            <h6 className="fw-bold">Médailles TC — Détails</h6>
            <Table striped bordered hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Championnat</th>
                  <th>Épreuve</th>
                  <th>Médaille</th>
                  <th>Points</th>
                  <th>Temps</th>
                </tr>
              </thead>
              <tbody>
                {medaillesTc.map((m, idx) => (
                  <tr key={idx}>
                    <td>{m.championnat}</td>
                    <td>{m.epreuve}</td>
                    <td>{labelForPlace(m.tc_place)}</td>
                    <td>{m.points}</td>
                    <td>{m.temps}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
