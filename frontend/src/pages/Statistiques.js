import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Container,
  Card,
  Table,
  Spinner,
  Row,
  Col,
  Badge,
  Stack,
  Button,
} from "react-bootstrap";
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
  Cell,
  CartesianGrid,
} from "recharts";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar_Home from "../components/Navbar_Home";
import ClassementChampionnat from "../components/CumulPerChampion";
import "bootstrap/dist/css/bootstrap.min.css";
import ButtonBack from "../components/ButtonBack";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
const COLORS = {
  dames: "#e83e8c",
  messieurs: "#0d6efd",
  "NAGE LIBRE": "#0d6efd",
  DOS: "#20c997",
  PAPILLON: "#ff5722",
  BRASSE: "#ffc107",
  "4 NAGES": "#6f42c1",
  others: "#cccccc",
};

const formatNumber = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR") : n ?? "-";

const aggregateTopN = (arr, valueKey = "value", topN = 8) => {
  // arr: [{name, value, nage}]
  const sorted = [...arr].sort(
    (a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)
  );
  const top = sorted.slice(0, topN);
  const others = sorted.slice(topN);
  const othersSum = others.reduce((s, it) => s + (it[valueKey] || 0), 0);
  if (othersSum > 0)
    top.push({ name: "Autres", value: othersSum, nage: "Autres" });
  return top;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="p-2"
      style={{
        background: "white",
        border: "1px solid #eee",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{formatNumber(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Statistiques({ user }) {
  const { id } = useParams();
  const [stats, setStats] = useState([]);
  const [championnat, setChampionnat] = useState(null);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef();
  // 🧾 Fonction de téléchargement PDF

  const handleDownloadPDF = async () => {
    const res = await fetch(`http://localhost:5000/api/pdf/report/${id}`);
    console.log("id du championnat:", id);
    if (!res.ok) {
      alert("Erreur lors de la génération du PDF");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Statistiques_${championnat.nom}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const statsReq = axios.get(
      `http://localhost:5000/api/epreuves/statistiques/cumul/${id}`
    );
    const cumulReq = axios.get(
      `http://localhost:5000/api/bilan/cumul_points_clubs/${id}`
    );

    Promise.all([statsReq, cumulReq])
      .then(([sRes, cRes]) => {
        const formatted = (sRes.data || []).map((s) => ({
          ...s,
          label: `${s.distance}m ${s.nage}`,
          distanceLabel: `${s.distance}m`,
        }));
        setStats(formatted);
        setChampionnat(cRes.data || null);
      })
      .catch((err) => {
        console.error("Erreur fetch:", err);
        setStats([]);
        setChampionnat(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // derived data
  const totalPointsParClub = useMemo(() => {
    const tot = {};
    if (!championnat?.categories) return tot;
    championnat.categories.forEach((cat) => {
      (cat.classement || []).forEach((c) => {
        tot[c.club] = (tot[c.club] || 0) + (c.points || 0);
      });
    });
    return tot;
  }, [championnat]);

  const topClubs = useMemo(() => {
    return Object.entries(totalPointsParClub)
      .map(([club, points]) => ({ club, points }))
      .sort((a, b) => b.points - a.points);
  }, [totalPointsParClub]);

  const top10Clubs = topClubs
    .slice(0, 10)
    .map((c) => ({ club: c.club, points: c.points }))
    .reverse(); // reverse for vertical chart (largest at top)

  const totalClubs = Object.keys(totalPointsParClub).length;

  const topClub = topClubs[0] || { club: "-", points: 0 };

  // pie data and aggregation
  const pieDames = stats.map((s) => ({
    name: s.label,
    value: s.dames || 0,
    nage: s.nage,
  }));
  const pieMessieurs = stats.map((s) => ({
    name: s.label,
    value: s.messieurs || 0,
    nage: s.nage,
  }));

  const pieDamesTop = aggregateTopN(pieDames, "value", 7);
  const pieMessieursTop = aggregateTopN(pieMessieurs, "value", 7);

  // stacked bar (by label) - keep only labels with any value
  const stackedData = stats
    .map((s) => ({
      label: s.label,
      dames: s.dames || 0,
      messieurs: s.messieurs || 0,
    }))
    .filter((r) => r.dames || r.messieurs);

  // grouped by nage charts
  const groupedByNage = useMemo(() => {
    const map = {};
    stats.forEach((s) => {
      if (!map[s.nage]) map[s.nage] = [];
      map[s.nage].push({
        distance: s.distance,
        dames: s.dames || 0,
        messieurs: s.messieurs || 0,
      });
    });
    return map;
  }, [stats]);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (!championnat) {
    return (
      <Container className="mt-5 text-center">
        <h4 className="text-danger">Championnat non trouvé.</h4>
      </Container>
    );
  }

  return (
    <div>
      <Navbar_Home user={user} />
      <Container
        ref={pageRef}
        fluid
        className="py-4 px-md-5"
        style={{ maxWidth: "1400px" }}
      >
        {/* header */}

        <Card className="shadow-lg border-0 rounded-4 mb-4 p-3">
          <Card.Body className="d-md-flex align-items-center justify-content-between">
            <div>
              <h2 className="fw-bold text-primary mb-1">
                🏆 {championnat.championnat}
              </h2>
              <div className="text-muted small">
                <span className="me-3">
                  Saison: <strong>{championnat.saison}</strong>
                </span>
                <span className="me-3">
                  Début: <strong>{championnat.datedeb}</strong>
                </span>
                <span>
                  Fin: <strong>{championnat.datefin}</strong>
                </span>
              </div>
            </div>

            {/* Right side: KPIs + Back Button */}
            <div className="d-flex align-items-center gap-3">
              <Stack direction="horizontal" gap={3}>
                <Card className="p-2 text-center" style={{ minWidth: 140 }}>
                  <div className="text-muted small">Clubs</div>
                  <div className="fs-4 fw-bold">{totalClubs}</div>
                </Card>

                <Card className="p-2 text-center" style={{ minWidth: 220 }}>
                  <div className="text-muted small">Leader</div>
                  <div className="fs-6 fw-bold">{topClub.club}</div>
                  <div className="small text-success">
                    {formatNumber(topClub.points)} pts
                  </div>
                </Card>
              </Stack>
              <Button variant="outline-danger" onClick={handleDownloadPDF}>
                📥 Télécharger PDF
              </Button>
              {/* Button on the right */}
              <ButtonBack style={{ minWidth: 140 }} />
            </div>
          </Card.Body>
        </Card>

        <ClassementChampionnat id={id} />

        {/* top clubs + stacked bars */}

        <Row className="g-4 mb-4">
          <Col lg={4}>
            <Card className="shadow-sm h-100 stat-card">
              <Card.Body>
                <h5 className="fw-bold text-primary mb-3">
                  Top clubs (points)
                </h5>
                {top10Clubs.length === 0 ? (
                  <div className="text-center text-muted">Aucun club</div>
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      layout="vertical"
                      data={top10Clubs}
                      margin={{ right: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="club"
                        width={100}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Bar
                        dataKey="points"
                        fill="#0d6efd"
                        barSize={20}
                        radius={[5, 5, 5, 5]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={7}>
            <Card className="shadow-sm h-100 stat-card">
              <Card.Body>
                <h5 className="fw-bold text-primary mb-3">
                  Cumul par épreuve (Dames / Messieurs)
                </h5>
                {stackedData.length === 0 ? (
                  <div className="text-center text-muted">Aucune donnée</div>
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      data={stackedData}
                      margin={{ left: 10, right: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="dames"
                        stackId="a"
                        fill={COLORS.dames}
                        name="Dames"
                      />
                      <Bar
                        dataKey="messieurs"
                        stackId="a"
                        fill={COLORS.messieurs}
                        name="Messieurs"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Donuts côte-à-côte */}
        <Row className="g-4 mb-4">
          <Col md={5}>
            <Card className="shadow-sm h-100 stat-card">
              <Card.Body>
                <h5 className="fw-bold text-primary mb-3">
                  Répartition - Dames
                </h5>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieDamesTop}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      paddingAngle={3}
                    >
                      {pieDamesTop.map((entry, idx) => (
                        <Cell
                          key={`d-${idx}`}
                          fill={
                            COLORS[entry.nage?.toUpperCase()] || COLORS.others
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatNumber(v)} />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="shadow-sm h-100 stat-card">
              <Card.Body>
                <h5 className="fw-bold text-primary mb-3">
                  Répartition - Messieurs
                </h5>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieMessieursTop}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      paddingAngle={3}
                    >
                      {pieMessieursTop.map((entry, idx) => (
                        <Cell
                          key={`m-${idx}`}
                          fill={
                            COLORS[entry.nage?.toUpperCase()] || COLORS.others
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatNumber(v)} />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* charts par type de nage */}
        <Row className="g-4 mb-5">
          {Object.entries(groupedByNage).map(([nage, data], idx) => (
            <Col xs={12} sm={6} lg={4} key={idx}>
              <Card className="shadow-sm h-100 stat-card">
                <Card.Body>
                  <h6 className="fw-bold text-primary mb-3 text-center">
                    Cumul — {nage}
                  </h6>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="distance" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="dames" fill={COLORS.dames} name="Dames" />
                      <Bar
                        dataKey="messieurs"
                        fill={COLORS.messieurs}
                        name="Messieurs"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* tableau récapitulatif basique */}
        <Card className="shadow-sm mb-5">
          <Card.Body>
            <h5 className="fw-bold text-primary mb-3">Tableau récapitulatif</h5>
            <Table striped bordered hover responsive>
              <thead className="table-light">
                <tr>
                  <th>Distance</th>
                  <th>Nage</th>
                  <th>Cumul Dames</th>
                  <th>Cumul Messieurs</th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Aucune donnée
                    </td>
                  </tr>
                ) : (
                  stats.map((s, i) => (
                    <tr key={i}>
                      <td>{s.distance}m</td>
                      <td>{s.nage}</td>
                      <td>{formatNumber(s.dames)}</td>
                      <td>{formatNumber(s.messieurs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
