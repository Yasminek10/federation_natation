// frontend/src/pages/Resultats.js
import React, { useEffect, useState } from "react";
import { Container, Table, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

function Resultats() {
  const { epreuveId } = useParams();
  const [resultats, setResultats] = useState([]);
  const [filterGenre, setFilterGenre] = useState("");
  const [filterDistance, setFilterDistance] = useState("");
  const [filterClub, setFilterClub] = useState("");
  const [filterNage, setFilterNage] = useState("");


  

  useEffect(() => {
  fetch(`http://localhost:5000/api/epreuves/${epreuveId}/resultats`)
      .then(res => res.json())
      .then(setResultats);
  }, [epreuveId]);

  const filtered = resultats.filter(r => {
  return (
    (!filterGenre || r.genre === filterGenre) &&
    (!filterDistance || r.distance == filterDistance) && // == tolère int/str
    (!filterClub || (r.club && r.club === filterClub)) &&
    (!filterNage || r.nage === filterNage)
  );
});
  

  return (
    <Container className="mt-4">
      <h2>Résultats</h2>
      <Form className="d-flex gap-3 mb-3">
        {/* Genre */}
        <Form.Select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
          <option value="">Tous genres</option>
          <option value="Dames">Dames</option>
          <option value="Messieurs">Messieurs</option>
          <option value="Mixte">Mixte</option>
        </Form.Select>
        {/* Distance */}
        <Form.Control
          type="number"
          placeholder="Filtrer par distance"
          value={filterDistance}
          onChange={e => setFilterDistance(e.target.value)}
        />
        {/* Club */}
        <Form.Select value={filterClub} onChange={e => setFilterClub(e.target.value)}>
          <option value="">Tous clubs</option>
          {[...new Set(resultats.map(r => r.club))].map(c => (
            <option key={c} value={c}>{c}</option>
        ))}
        </Form.Select>
        {/* Nage */}
        <Form.Select value={filterNage} onChange={e => setFilterNage(e.target.value)}>
      <option value="">Toutes nages</option>
      {[...new Set(resultats.map(r => r.nage))].map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </Form.Select>
  </Form>
      {/* === Tableau === */}
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Place</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Temps</th>
            <th>Points</th>
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
            </tr>
          ))}
        </tbody>
      </Table>
       {/* === Graphiques === */}
  <h3 className="mt-4">Visualisations</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={filtered}>
      <XAxis dataKey="club" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="points" fill="#8884d8" />
    </BarChart>
  </ResponsiveContainer>
</Container>
  );
}

export default Resultats;
