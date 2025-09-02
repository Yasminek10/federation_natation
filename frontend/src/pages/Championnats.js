// frontend/src/pages/Championnats.js
import React, { useEffect, useState } from "react";
import { Container, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function Championnats() {
  const [championnats, setChampionnats] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/api/championnats/")
      .then(res => res.json())
      .then(setChampionnats);
  }, []);

  return (
    <Container className="mt-4">
      <h2>Liste des Championnats</h2>
      <ListGroup>
        {championnats.map(c => (
          <ListGroup.Item
            key={c.id}
            action
            onClick={() => navigate(`/championnats/${c.id}/epreuves`)}
          >
            {c.nom} ({c.saison}) - {c.lieu}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Container>
  );
}

export default Championnats;
