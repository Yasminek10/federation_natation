import React, { useEffect, useState } from "react";
import { Container, Card, Table, Spinner } from "react-bootstrap";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import Navbar_Home from "../components/Navbar_Home";

function Statistiques({ user }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/epreuves/statistiques/cumul")
      .then(res => res.json())
      .then(data => {
        // ajoute un label combiné Distance + Nage
        const formatted = data.map(s => ({
          ...s,
          label: `${s.distance}m ${s.nage.toUpperCase()}`,
        }));
        setStats(formatted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        <h2 className="text-center fw-bold text-primary mb-4">
          Cumul des points par Distance, Nage et Genre
        </h2>

        {/* === Tableau === */}
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead className="table-light">
                <tr>
                  <th>Distance</th>
                  <th>Type de Nage</th>
                  <th>Cumul Dames</th>
                  <th>Cumul Messieurs</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i}>
                    <td>{s.distance}</td>
                    <td>{s.nage}</td>
                    <td>{s.dames}</td>
                    <td>{s.messieurs}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>

        {/* === Graphique en barres empilées === */}
        <Card className="shadow-sm">
          <Card.Body>
            <h5 className="mb-3">Visualisation par Distance et Nage</h5>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stats}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="dames" stackId="a" fill="#e83e8c" name="Dames" />
                <Bar dataKey="messieurs" stackId="a" fill="#0d6efd" name="Messieurs" />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default Statistiques;
