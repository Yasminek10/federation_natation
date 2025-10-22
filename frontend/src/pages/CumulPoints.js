import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Table, Card, Spinner, Button } from "react-bootstrap";
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

function CumulPoints({ user }) {
  const { publicId } = useParams();
  const [cumul, setCumul] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5000/api/epreuves/${publicId}/resultats_cumul`)
      .then((res) => res.json())
      .then((data) => {
        setCumul(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [publicId]);

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

        {/* Bouton retour */}
        <div className="text-center">
          <Link to={`/epreuves/${publicId}/resultats`}>
            <Button variant="secondary">⬅ Retour aux résultats</Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

export default CumulPoints;
