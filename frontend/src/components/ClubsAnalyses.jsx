import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Badge, Spinner, Button } from "react-bootstrap";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

/* ---------- ChartCard: wrapper propre et responsive ---------- */
const ChartCard = ({ title, children, colSize = "col-12 col-md-6 col-lg-5" }) => (
  <div className={colSize}>
    <Card
      className="shadow-sm border-0 h-100"
      style={{
        borderRadius: 16,
        background: "linear-gradient(145deg, #f9fafb, #f0f9ff)",
      }}
    >
      <Card.Body>
        <h6 className="fw-bold text-primary mb-3" style={{ fontSize: "0.95rem" }}>
          {title}
        </h6>
        {children}
      </Card.Body>
    </Card>
  </div>
);

/* ---------- Placeholder pour charts vides ---------- */
const ChartPlaceholder = ({ message = "Aucune donnée", height = 250 }) => (
  <div
    style={{
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#6b7280",
      fontSize: 14,
      background: "transparent",
    }}
  >
    {message}
  </div>
);

/* ---------- Affichage mobile en cartes ---------- */
const MobileList = ({ items, renderItem }) => {
  if (!items || items.length === 0) return <div className="text-muted">Aucune donnée</div>;
  return (
    <div className="d-block d-md-none">
      {items.map((it, idx) => (
        <Card key={it.id ?? idx} className="mb-2 shadow-sm" style={{ borderRadius: 12 }}>
          <Card.Body className="p-2">{renderItem(it, idx)}</Card.Body>
        </Card>
      ))}
    </div>
  );
};

export default function ClubAnalyses({ clubId }) {
  const navigate = useNavigate();
  const pdfRef = useRef(); 

  const [data, setData] = useState({
    relais_or: [],
    top_females: [],
    top_males: [],
    medailles_par_genre: [],
    classement_par_saison: [],
    medailles_par_categorie: [],
    medailles_par_nage: [],
  });
  const [clubName, setClubName] = useState("...");
  const [loading, setLoading] = useState(true);

  const COLORS = ["#0ea5e9", "#3b82f6", "#6366f1", "#22d3ee", "#38bdf8"];

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch(`http://localhost:5000/api/clubs/${clubId}/analyses`)
      .then((res) => res.json())
      .then((d) => {
        if (!mounted) return;
        setData({
          relais_or: d.relais_or || [],
          top_females: d.top_females || [],
          top_males: d.top_males || [],
          medailles_par_genre: d.medailles_par_genre || [],
          classement_par_saison: d.classement_par_saison || [],
          medailles_par_categorie: d.medailles_par_categorie || [],
          medailles_par_nage: d.medailles_par_nage || [],
        });
        setClubName(d.club_name || "...");
      })
      .catch((err) => {
        console.error(err);
        if (mounted) {
          setData({
            relais_or: [],
            top_females: [],
            top_males: [],
            medailles_par_genre: [],
            classement_par_saison: [],
            medailles_par_categorie: [],
            medailles_par_nage: [],
          });
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [clubId]);

  const downloadPDF = () => {
    const input = pdfRef.current;
    if (!input) return;
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`club_${clubId}_analyses.pdf`);
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" style={{ width: 48, height: 48 }} />
        <p className="mt-3 text-secondary">Chargement des analyses...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3">
      <div className="d-flex justify-content-end mb-3">
        <Button variant="danger" onClick={downloadPDF}>
          Télécharger en PDF
        </Button>
      </div>
      <div ref={pdfRef} className="row g-4">
        <h5>Analyse d'efficacité du club : {clubName}</h5>

        {/* Médailles par genre */}
        <ChartCard title="🏅 Médailles par genre">
          {data.medailles_par_genre?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.medailles_par_genre}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="genre" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="nb_medailles" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        {/* Classement par saison */}
   {/* Classement par saison */}
<ChartCard title="📅 Classement par saison">
  {data.classement_par_saison?.length > 0 ? (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data.classement_par_saison}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {/* changer dataKey de "annee" à "saison" */}
        <XAxis dataKey="saison" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="medailles" fill="#3b82f6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <ChartPlaceholder />
  )}
</ChartCard>


        {/* Médailles par catégorie */}
        <ChartCard title="📊 Médailles par catégorie">
          {data.medailles_par_categorie?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.medailles_par_categorie}
                  dataKey="nb_medailles"
                  nameKey="categorie"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.medailles_par_categorie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        {/* Médailles par nage */}
        <ChartCard title="🏊 Médailles par nage">
          {data.medailles_par_nage?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.medailles_par_nage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nage" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="nb_medailles" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        {/* Top Females */}
        <ChartCard title="🏊 Top 10 Females">
          <div className="table-responsive d-none d-md-block">
            <Table hover className="align-middle mb-0" style={{ background: "#f8fafc" }}>
              <thead style={{ background: "#0ea5e9", color: "white" }}>
                <tr>
                  <th>#</th>
                  <th>Nom complet</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {data.top_females?.map((n, idx) => (
                  <tr key={n.id ?? idx}>
                    <td>{idx + 1}</td>
                    <td
                      className="text-uppercase"
                      style={{ cursor: "pointer", color: "#174ea6" }}
                      onClick={() => navigate(`/nageurs/${n.id}`)}
                    >
                      {n.full_name}
                    </td>
                    <td>
                      <Badge bg="primary">{n.points_total}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList
            items={data.top_females}
            renderItem={(n, idx) => (
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>#{idx + 1}</div>
                  <div
                    onClick={() => navigate(`/nageurs/${n.id}`)}
                    style={{ cursor: "pointer", fontWeight: 600, textTransform: "uppercase", color: "#174ea6" }}
                  >
                    {n.full_name}
                  </div>
                </div>
                <Badge bg="primary" pill>{n.points_total}</Badge>
              </div>
            )}
          />
        </ChartCard>

        {/* Top Males */}
        <ChartCard title="🏊 Top 10 Males">
          <div className="table-responsive d-none d-md-block">
            <Table hover className="align-middle mb-0" style={{ background: "#f8fafc" }}>
              <thead style={{ background: "#3b82f6", color: "white" }}>
                <tr>
                  <th>#</th>
                  <th>Nom complet</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {data.top_males?.map((n, idx) => (
                  <tr key={n.id ?? idx}>
                    <td>{idx + 1}</td>
                    <td
                      className="text-uppercase"
                      style={{ cursor: "pointer", color: "#174ea6" }}
                      onClick={() => navigate(`/nageurs/${n.id}`)}
                    >
                      {n.full_name}
                    </td>
                    <td>
                      <Badge bg="info">{n.points_total}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList
            items={data.top_males}
            renderItem={(n, idx) => (
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>#{idx + 1}</div>
                  <div
                    onClick={() => navigate(`/nageurs/${n.id}`)}
                    style={{ cursor: "pointer", fontWeight: 600, textTransform: "uppercase", color: "#174ea6" }}
                  >
                    {n.full_name}
                  </div>
                </div>
                <Badge bg="info" pill>{n.points_total}</Badge>
              </div>
            )}
          />
        </ChartCard>

        {/* Relais d'or */}
        <ChartCard title="🥇 Médailles d’or en relais" colSize="col-12">
          {data.relais_or?.length > 0 ? (
            <div style={{ maxHeight: 500, overflowY: "auto", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <Table hover responsive className="align-middle mb-0" style={{ background: "#ffffff", fontSize: "0.9rem" }}>
                <thead style={{ background: "#16a34a", color: "white" }}>
                  <tr>
                    <th>#</th>
                    <th>Épreuve</th>
                    <th>Catégorie</th>
                    <th>Saison</th>
                    <th>Temps</th>
                    <th>Compétition</th>
                  </tr>
                </thead>
                <tbody>
                  {data.relais_or.map((r, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{r.epreuve}</td>
                      <td>{r.categorie}</td>
                      <td>{r.saison}</td>
                      <td><Badge bg="success" pill>{r.temps}</Badge></td>
                      <td>{r.competition}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-muted text-center my-3">Aucun résultat disponible pour le moment.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
