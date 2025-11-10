import React from "react";
import { Card, Table, Badge, ProgressBar } from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SwimmerInsights({ insights }) {
  const [selectedEvent, setSelectedEvent] = React.useState("");

  if (!insights) return null;

  const {
    events_summary = [],
    best_events = [],
    stroke_averages = {},
    versatility,
    trend = {},
    dq_stats = {},
    suggestions = [],
  } = insights;

  return (
    <div className="d-flex flex-column gap-4">
      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">
          Top épreuves
        </Card.Header>
        <Card.Body>
          {best_events.length === 0 ? (
            <div className="text-muted">Pas encore assez de données.</div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Épreuve</th>
                  <th>Départs</th>
                  <th>Pts moyens</th>
                  <th>Meilleur</th>
                  <th>Minimas</th>
                </tr>
              </thead>
              <tbody>
                {best_events.map((e, i) => (
                  <tr key={i}>
                    <td>
                      {e.distance}m {e.nage}
                    </td>
                    <td>{e.starts}</td>
                    <td>
                      <Badge bg="success">{e.avg_points}</Badge>
                    </td>
                    <td>{e.best_time || "-"}</td>
                    <td>
                      {e.minima_success != null ? (
                        <>
                          <ProgressBar
                            now={e.minima_success}
                            label={`${e.minima_success}%`}
                          />
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">
          Résumé par épreuve
        </Card.Header>
        <Card.Body>
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Épreuve</th>
                <th>Départs</th>
                <th>Pts moyens</th>
                <th>Meilleur temps</th>
                <th>Minimas</th>
              </tr>
            </thead>
            <tbody>
              {events_summary.map((e, i) => (
                <tr key={i}>
                  <td>
                    {e.distance}m {e.nage}
                  </td>
                  <td>{e.starts}</td>
                  <td>{e.avg_points}</td>
                  <td>{e.best_time || "-"}</td>
                  <td>
                    {e.minima_success != null ? `${e.minima_success}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">
          Moyennes par nage & tendance
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-3">
            {Object.entries(stroke_averages).map(([stroke, avg]) => (
              <Badge key={stroke} bg="info" className="p-2">
                {stroke}: {avg} pts
              </Badge>
            ))}
            <Badge bg="secondary" className="p-2">
              Variété: {versatility} nage(s)
            </Badge>
          </div>
          <div className="mt-3">
            {trend?.by_year?.length ? (
              <Table size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Année</th>
                    <th>Points moyens</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.by_year.map((t, i) => (
                    <tr key={i}>
                      <td>{t.year}</td>
                      <td>{t.avg_points.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-muted">Pas de tendance calculable.</div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Conseils d’entraînement</Card.Header>
        <Card.Body>
          {suggestions.length ? (
            <ul className="mb-0">
              {suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : <div className="text-muted">Pas de conseil spécifique pour l’instant.</div>}
        </Card.Body>
      </Card> */}

      

<Card className="shadow-sm border-0 rounded-3">
  <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
    <span>Progression par épreuve</span>
    {trend?.over_time?.length > 0 && (
      <select
        className="form-select form-select-sm w-auto"
        value={selectedEvent}
        onChange={(e) => setSelectedEvent(e.target.value)}
      >
        <option value="">Toutes les épreuves</option>
        {Array.from(new Set(trend.over_time.map((d) => d.epreuve))).map((ep, i) => (
          <option key={i} value={ep}>
            {ep}
          </option>
        ))}
      </select>
    )}
  </Card.Header>

  <Card.Body style={{ height: "420px" }}>
    {trend?.over_time?.length ? (() => {
      // 🔹 Filtrage dynamique des données selon l’épreuve choisie
      const filteredData = selectedEvent
        ? trend.over_time.filter((d) => d.epreuve === selectedEvent)
        : trend.over_time;

      // 🔹 Tri chronologique
      const sorted = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));

      // 🔹 Regroupement (chaque ligne = une date)
      const grouped = {};
      sorted.forEach((d) => {
        const key = d.date;
        if (!grouped[key]) grouped[key] = { date: d.date };
        grouped[key][d.epreuve] = d.points;
      });

      const chartData = Object.values(grouped);

      // 🔹 Liste des épreuves à tracer
      const epreuves = Array.from(new Set(filteredData.map((d) => d.epreuve)));

      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value, name) => [`${value} pts`, name]}
              labelFormatter={(label) => `Compétition : ${label}`}
            />

            {epreuves.map((epreuve, i) => {
              const color = `hsl(${i * 55}, 80%, 50%)`;
              return (
                <Line
                  key={epreuve}
                  type="monotone"
                  dataKey={epreuve}
                  name={epreuve}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      );
    })() : (
      <div className="text-muted text-center">
        Pas de données disponibles pour afficher la courbe.
      </div>
    )}
  </Card.Body>
</Card>


      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">
          Disqualifications / DNS-DNF
        </Card.Header>
        <Card.Body>
          <div className="d-flex gap-3">
            <Badge bg="danger">DSQ: {dq_stats.dsq || 0}</Badge>
            <Badge bg="warning">DNS/DNF: {dq_stats.dns_dnf || 0}</Badge>
            <Badge bg="secondary">Total courses: {dq_stats.total || 0}</Badge>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
