import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Container,
  Card,
  Table,
  Spinner,
  Row,
  Col,
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
import "../styles/Statistiques.css";


// Palette “Dashboard Pro”
const COLORS = {
  dames: "#E91E63",
  messieurs: "#2196F3",
  nageLibre: "#1976D2",
  dos: "#26C6DA",
  brasse: "#FFB300",
  papillon: "#EF5350",
  medley: "#7E57C2",
  autres: "#BDBDBD",
};

// Map nage -> couleur
const getNageColor = (nage) => {
  const key = (nage || "").toUpperCase();
  if (key.includes("LIBRE")) return COLORS.nageLibre;
  if (key.includes("DOS")) return COLORS.dos;
  if (key.includes("BRASSE")) return COLORS.brasse;
  if (key.includes("PAPILLON")) return COLORS.papillon;
  if (key.includes("4 NAGES") || key.includes("MEDLEY")) return COLORS.medley;
  return COLORS.autres;
};

const formatNumber = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR") : n ?? "-";

// Garde topN entrées, regroupe le reste en “Autres”
const aggregateTopN = (arr, valueKey = "value", topN = 8) => {
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

// Tooltip custom uniforme pour tous les graphes
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="p-2"
      style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #e0e0e0",
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        fontSize: 12,
      }}
    >
      {label && (
        <div style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{formatNumber(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Statistiques({ user }) {
  const { champId } = useParams();
  const [stats, setStats] = useState([]);
  const [championnat, setChampionnat] = useState(null);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef();

  const handleDownloadPDF = async () => {
    const res = await fetch(`http://localhost:5000/api/pdf/report/${champId}`);

    if (!res.ok) {
      alert("Erreur lors de la génération du PDF");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Statistiques_${championnat?.nom || "championnat"}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!champId) return;
    setLoading(true);

    const statsReq = axios.get(
      `http://localhost:5000/api/epreuves/statistiques/cumul/${champId}`
    );
    const cumulReq = axios.get(
      `http://localhost:5000/api/bilan/cumul_points_clubs/${champId}`
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
  }, [champId]);

  // ====== Données dérivées ======

  // Points cumulés par club (toutes catégories)
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
    .reverse();

  const totalClubs = Object.keys(totalPointsParClub).length;
  const topClub = topClubs[0] || { club: "-", points: 0 };

  // Données pour les donuts
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

  // Stacked bar Dames / Messieurs par épreuve
  const stackedData = stats
    .map((s) => ({
      label: s.label,
      dames: s.dames || 0,
      messieurs: s.messieurs || 0,
    }))
    .filter((r) => r.dames || r.messieurs);

  // Groupé par nage
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

  // ====== Rendu ======

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
    <div style={{ background: "#f5f7fb", minHeight: "100vh" }}>
      <Navbar_Home user={user} />
      <Container
        ref={pageRef}
        fluid
        className="py-4 px-md-5"
        style={{ maxWidth: "1400px" }}
      >
        {/* ====== HEADER ====== */}
        <Card className="shadow-sm border-0 rounded-4 mb-4">
          <Card.Body className="d-md-flex align-items-center justify-content-between">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: "#1F2937" }}>
                🏆 {championnat.championnat}
              </h2>
              <div className="text-muted small mt-2">
                <span className="me-3">
                  Saison : <strong>{championnat.saison}</strong>
                </span>
                <span className="me-3">
                  Début : <strong>{championnat.datedeb}</strong>
                </span>
                <span>
                  Fin : <strong>{championnat.datefin}</strong>
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3 mt-3 mt-md-0">
              <Stack direction="horizontal" gap={3}>
                <Card
                  className="px-3 py-2 text-center border-0"
                  style={{
                    minWidth: 140,
                    background:
                      "linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 100%)",
                  }}
                >
                  <div className="text-muted small">Nombre de clubs</div>
                  <div
                    className="fs-4 fw-bold"
                    style={{ color: "#1D4ED8" }}
                  >
                    {totalClubs}
                  </div>
                </Card>

                <Card
                  className="px-3 py-2 text-center border-0"
                  style={{
                    minWidth: 220,
                    background:
                      "linear-gradient(135deg, #ECFDF3 0%, #DCFCE7 100%)",
                  }}
                >
                  <div className="text-muted small">Club leader</div>
                  <div className="fw-bold" style={{ color: "#166534" }}>
                    {topClub.club}
                  </div>
                  <div className="small" style={{ color: "#16A34A" }}>
                    {formatNumber(topClub.points)} pts
                  </div>
                </Card>
              </Stack>

              <Button
                variant="outline-primary"
                onClick={handleDownloadPDF}
                className="ms-2"
              >
                📥 Télécharger PDF
              </Button>
              <ButtonBack className="ms-1" style={{ minWidth: 120 }} />
            </div>
          </Card.Body>
        </Card>

        {/* Classement tableau complet */}
        <ClassementChampionnat champId={champId} />
        
        {/* ====== TABLEAU RÉCAP ====== */}
        <Card className="shadow-sm mb-5 border-0">
          <Card.Body>
            <h5 className="fw-bold mb-3" style={{ color: "#111827" }}>
              Tableau récapitulatif des épreuves
            </h5>
            <Table hover responsive size="sm" className="align-middle">
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

        {/* ====== TOP CLUBS + STACKED BAR ====== */}
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <Card className="shadow-sm h-100 border-0">
              <Card.Body>
                <h5 className="fw-bold mb-3" style={{ color: "#111827" }}>
                  Top clubs (points)
                </h5>
                {top10Clubs.length === 0 ? (
                  <div className="text-center text-muted">Aucun club</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      layout="vertical"
                      data={top10Clubs}
                      margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="club"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="points"
                        fill={COLORS.messieurs}
                        barSize={18}
                        radius={[6, 6, 6, 6]}
                        name="Points"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </div>
          <div className="dashboard-card">
            <Card className="shadow-sm h-100 border-0">
              <Card.Body>
                <h5 className="fw-bold mb-3" style={{ color: "#111827" }}>
                  Cumul par épreuve (Dames / Messieurs)
                </h5>
                {stackedData.length === 0 ? (
                  <div className="text-center text-muted">Aucune donnée</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={stackedData}
                      margin={{ top: 10, left: 0, right: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="dames"
                        stackId="a"
                        fill={COLORS.dames}
                        name="Dames"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="messieurs"
                        stackId="a"
                        fill={COLORS.messieurs}
                        name="Messieurs"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
        {/* ====== DONUTS Dames / Messieurs ====== */}
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <Card className="shadow-sm h-100 border-0">
              <Card.Body>
                <h5 className="fw-bold mb-3" style={{ color: "#111827" }}>
                  Répartition des points – Dames
                </h5>
                {pieDamesTop.every((d) => !d.value) ? (
                  <div className="text-center text-muted">
                    Aucune donnée pour les Dames
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieDamesTop}
                        dataKey="value"
                        nameKey="name"
                        cx="45%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        label={({ name, percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieDamesTop.map((entry, idx) => (
                          <Cell
                            key={`d-${idx}`}
                            fill={getNageColor(entry.nage)}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </div>
          <div className="dashboard-card">
            <Card className="shadow-sm h-100 border-0">
              <Card.Body>
                <h5 className="fw-bold mb-3" style={{ color: "#111827" }}>
                  Répartition des points – Messieurs
                </h5>
                {pieMessieursTop.every((d) => !d.value) ? (
                  <div className="text-center text-muted">
                    Aucune donnée pour les Messieurs
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieMessieursTop}
                        dataKey="value"
                        nameKey="name"
                        cx="45%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        label={({ name, percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieMessieursTop.map((entry, idx) => (
                          <Cell
                            key={`m-${idx}`}
                            fill={getNageColor(entry.nage)}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
        <div className="dashboard-grid">
  {Object.entries(groupedByNage).map(([nage, data], idx) => (
    <div className="dashboard-card" key={idx}>
      <Card className="shadow-sm h-100 border-0">
        <Card.Body>
          <h6 className="fw-bold mb-3 text-center" style={{ color: "#111827" }}>
            Cumul par distance — {nage}
          </h6>

          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="distance" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <Bar dataKey="dames" fill={COLORS.dames} barSize={14} radius={[4, 4, 0, 0]} />
              <Bar dataKey="messieurs" fill={COLORS.messieurs} barSize={14} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </div>
  ))}
</div>

        
      </Container>
    </div>
  );
}
