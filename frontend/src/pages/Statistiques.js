import React, { useEffect, useState } from "react";
import { Container, Card, Table, Spinner, Row, Col } from "react-bootstrap";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar_Home from "../components/Navbar_Home";
import 'bootstrap/dist/css/bootstrap.min.css';


function Statistiques({ user }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  useEffect(() => {
    axios.get(`http://localhost:5000/api/epreuves/statistiques/cumul/${id}`)
    .then(res => {
    const formatted = res.data.map(s => ({
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

  // === Couleurs fixes par type de nage ===
  const NAGE_COLORS = {
    "NAGE LIBRE": "#0d6efd",  // bleu
    "DOS": "#20c997",         // vert
    "PAPILLON": "#ff5722",    // orange
    "BRASSE": "#ffc107",      // jaune
    "4 NAGES": "#6f42c1"      // violet
  };

  // === Fonction pour afficher pourcentage dans les secteurs ===
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        style={{ fontSize: "12px", fontWeight: "bold" }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // === Données pour les graphiques ===
  const pieDataDames = stats.map(c => ({
    name: c.label,
    value: c.dames || 0,
    nage: c.nage
  }));

  const pieDataMessieurs = stats.map(c => ({
    name: c.label,
    value: c.messieurs || 0,
    nage: c.nage
  }));

  const barDataGenreNage = stats.map(c => ({
    nage: c.nage,
    dames: c.dames || 0,
    messieurs: c.messieurs || 0
  }));
// Légende personnalisée en 2 colonnes
const CustomLegend = ({ payload }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr", // 2 colonnes
        gap: "6px 16px",
        fontSize: "13px",
        fontWeight: 500,
        marginLeft: "20px"
      }}
    >
      {payload.map((entry, index) => (
        <div key={`item-${index}`} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: entry.color,
              marginRight: 6,
              borderRadius: 2
            }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};
const barDataTypeNage = stats.map(c => ({
  label: `${c.distance} ${c.nage}`,  // ex: "50 NAGE LIBRE"
  dames: c.dames || 0,
  messieurs: c.messieurs || 0
}));
// Regrouper les données par type de nage
const groupedByNage = stats.reduce((acc, c) => {
  if (!acc[c.nage]) acc[c.nage] = [];
  acc[c.nage].push({
    distance: c.distance,
    dames: c.dames || 0,
    messieurs: c.messieurs || 0
  });
  return acc;
}, {});
  return (
    <div>
      <Navbar_Home user={user} />
      <Container className="mt-4">
        <h2 className="text-center fw-bold text-primary mb-4">
          Cumul des points par Distance, Nage et Genre
        </h2>

        <Row>
  <Col md={12}>
    {/* Tableau */}
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <h5 className="fw-bold text-primary mb-3">Tableau récapitulatif</h5>
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
  </Col>

  <Col md={12}>
    {/* Bar Chart global */}
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <h5 className="fw-bold text-primary mb-3">Visualisation globale par Distance et Nage</h5>
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
  </Col>
</Row>

{/* === Pie charts côte à côte === */}
<Row>
  <Col md={6}>
    <Card className="shadow-sm mb-4 h-100">
      <Card.Body>
        <h5 className="text-center text-primary fw-bold mb-3">Répartition des points - Dames</h5>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieDataDames}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius={120}
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {pieDataDames.map((entry, index) => (
                <Cell
                  key={`cell-dames-${index}`}
                  fill={NAGE_COLORS[entry.nage.toUpperCase()] || "#999999"}
                />
              ))}
            </Pie>
            <Legend content={<CustomLegend />} layout="vertical" align="right" verticalAlign="middle" />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>

  <Col md={6}>
    <Card className="shadow-sm mb-4 h-100">
      <Card.Body>
        <h5 className="text-center text-primary fw-bold mb-3">Répartition des points - Messieurs</h5>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieDataMessieurs}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius={120}
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {pieDataMessieurs.map((entry, index) => (
                <Cell
                  key={`cell-messieurs-${index}`}
                  fill={NAGE_COLORS[entry.nage.toUpperCase()] || "#999999"}
                />
              ))}
            </Pie>
            <Legend content={<CustomLegend />} layout="vertical" align="right" verticalAlign="middle" />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  </Col>
</Row>

{/* === Bar charts par type de nage === */}
<Row>
  {Object.entries(groupedByNage).map(([nage, data], idx) => (
    <Col md={6} key={idx}>
      <Card className="shadow-sm mb-4 h-100">
        <Card.Body>
          <h5 className="text-center text-primary fw-bold mb-3">
            Cumul des points {nage} par Genre
          </h5>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <XAxis dataKey="distance" />
              <YAxis />
              <Tooltip />
              <Legend layout="horizontal" align="center" verticalAlign="top" />
              <Bar dataKey="dames" fill="#e83e8c" name="Cumul Dames" />
              <Bar dataKey="messieurs" fill="#0d6efd" name="Cumul Messieurs" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Col>
  ))}
</Row>


      </Container>
    </div>
  );
}

export default Statistiques;
