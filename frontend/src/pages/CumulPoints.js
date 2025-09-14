import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Table, Card, Spinner, Button } from "react-bootstrap";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,PieChart, Pie, Cell } from "recharts";
import Navbar_Home from "../components/Navbar_Home";

function CumulPoints({ user }) {
  const { epreuveId } = useParams();
  const [cumul, setCumul] = useState([]);
  const [loading, setLoading] = useState(true);
  // couleurs pour les pie charts
const COLORS = ["#0d6efd", "#e83e8c", "#ffc107", "#20c997"];

// cumul dames vs messieurs
const totalDames = cumul.reduce((acc, c) => acc + (c.dames || 0), 0);
const totalMessieurs = cumul.reduce((acc, c) => acc + (c.messieurs || 0), 0);

const pieDataDames = cumul.map(c => ({
  name: c.club,
  value: c.dames || 0
}));

const pieDataMessieurs = cumul.map(c => ({
  name: c.club,
  value: c.messieurs || 0
}));

// cumul par genre et nage
const barDataGenreNage = [];
cumul.forEach(c => {
  barDataGenreNage.push(
    { nage: c.nage, genre: "Dames", points: c.dames || 0 },
    { nage: c.nage, genre: "Messieurs", points: c.messieurs || 0 }
  );
});

  useEffect(() => {
    fetch(`http://localhost:5000/api/epreuves/${epreuveId}/resultats_cumul`)
      .then(res => res.json())
      .then(data => {
        setCumul(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [epreuveId]);

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
        <h2 className="text-center mb-4">Cumul des points par club</h2>

        {/* === Tableau === */}
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead className="table-light">
                  <tr>
                    <th>Club</th>
                    <th>Points cumulés</th>
                  </tr>
                </thead>
                <tbody>
                  {cumul.map((c, i) => (
                    <tr key={i}>
                      <td>{c.club}</td>
                      <td>{c.points_cumules}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>

        {/* === Graphique === */}
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={cumul}>
                <XAxis dataKey="club" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="points_cumules" fill="#0d6efd" />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
{/* === Pie Chart Dames === */}
<Card className="shadow-sm mb-4">
  <Card.Body>
    <h5 className="text-center">Répartition des points - Dames</h5>
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={pieDataDames}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label
        >
          {pieDataDames.map((entry, index) => (
            <Cell key={`cell-dames-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </Card.Body>
</Card>

{/* === Pie Chart Messieurs === */}
<Card className="shadow-sm mb-4">
  <Card.Body>
    <h5 className="text-center">Répartition des points - Messieurs</h5>
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={pieDataMessieurs}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label
        >
          {pieDataMessieurs.map((entry, index) => (
            <Cell key={`cell-messieurs-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </Card.Body>
</Card>

{/* === Bar Chart Genre & Nage === */}
<Card className="shadow-sm mb-4">
  <Card.Body>
    <h5 className="text-center">Cumul des points par Genre et Nage</h5>
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={barDataGenreNage}>
        <XAxis dataKey="nage" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="points" fill="#0d6efd" name="Points" />
      </BarChart>
    </ResponsiveContainer>
  </Card.Body>
</Card>

        {/* Bouton retour */}
        <div className="text-center">
          <Link to={`/epreuves/${epreuveId}/resultats`}>
            <Button variant="secondary">⬅ Retour aux résultats</Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

export default CumulPoints;
