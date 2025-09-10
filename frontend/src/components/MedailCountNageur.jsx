import React from "react";
import { Card } from "react-bootstrap";
import { FaMedal } from "react-icons/fa";

export default function MedalsCount({ historique = [], relais = [] }) {
  // Fusionner résultats individuels + relais
  const allResults = [...historique, ...relais];

  // Compter les médailles
  const medals = allResults.reduce(
    (acc, res) => {
      if (res.place === 1) acc.gold += 1;
      else if (res.place === 2) acc.silver += 1;
      else if (res.place === 3) acc.bronze += 1;
      return acc;
    },
    { gold: 0, silver: 0, bronze: 0 }
  );

  const medalStyles = {
    gold: { color: "#FFD700" },
    silver: { color: "#C0C0C0" },
    bronze: { color: "#CD7F32" },
  };

  return (
    <Card className="shadow border-0 rounded-3 mb-4">
      <Card.Header className="bg-primary text-white fw-bold">
        🏅 Palmarès du nageur
      </Card.Header>
      <Card.Body className="d-flex justify-content-around text-center">
        <div>
          <FaMedal size={40} style={medalStyles.silver} />
          <h4 className="mt-2">{medals.silver}</h4>
          <p className="text-muted mb-0">Argent</p>
        </div>
        <div>
          <FaMedal size={40} style={medalStyles.gold} />
          <h4 className="mt-2">{medals.gold}</h4>
          <p className="text-muted mb-0">Or</p>
        </div>
        <div>
          <FaMedal size={40} style={medalStyles.bronze} />
          <h4 className="mt-2">{medals.bronze}</h4>
          <p className="text-muted mb-0">Bronze</p>
        </div>
      </Card.Body>
    </Card>
  );
}
