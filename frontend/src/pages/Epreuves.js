// frontend/src/pages/Epreuves.js
import React, { useEffect, useState } from "react";
import { Container, ListGroup } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";

function Epreuves() {
  const { champId } = useParams();
  const [epreuves, setEpreuves] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`http://localhost:5000/api/championnats/${champId}/epreuves`)
      .then(res => res.json())
      .then(setEpreuves);
  }, [champId]);

  return (
    <Container className="mt-4">
      <h2>Épreuves du championnat</h2>
      <ListGroup>
        {epreuves.map(e => (
          <ListGroup.Item
            key={e.id}
            action
            onClick={() => navigate(`/epreuves/${e.id}/resultats`)}
          >
            {e.distance}m {e.nage} - {e.genre}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Container>
  );
}

export default Epreuves;
