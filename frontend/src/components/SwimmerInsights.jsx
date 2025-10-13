import React from "react";
import { Card, Table, Badge, ProgressBar } from "react-bootstrap";

export default function SwimmerInsights({ insights }) {
  if (!insights) return null;

  const { events_summary = [], best_events = [], stroke_averages = {}, versatility, trend = {}, dq_stats = {}, suggestions = [] } = insights;

  return (
    <div className="d-flex flex-column gap-4">
      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Top épreuves</Card.Header>
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
                    <td>{e.distance}m {e.nage}</td>
                    <td>{e.starts}</td>
                    <td><Badge bg="success">{e.avg_points}</Badge></td>
                    <td>{e.best_time || "-"}</td>
                    <td>
                      {e.minima_success != null ? (
                        <>
                          <ProgressBar now={e.minima_success} label={`${e.minima_success}%`} />
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Résumé par épreuve</Card.Header>
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
                  <td>{e.distance}m {e.nage}</td>
                  <td>{e.starts}</td>
                  <td>{e.avg_points}</td>
                  <td>{e.best_time || "-"}</td>
                  <td>{e.minima_success != null ? `${e.minima_success}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Moyennes par nage & tendance</Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-3">
            {Object.entries(stroke_averages).map(([stroke, avg]) => (
              <Badge key={stroke} bg="info" className="p-2">{stroke}: {avg} pts</Badge>
            ))}
            <Badge bg="secondary" className="p-2">Variété: {versatility} nage(s)</Badge>
          </div>
          <div className="mt-3">
            {trend?.by_year?.length ? (
              <Table size="sm" className="mb-0">
                <thead><tr><th>Année</th><th>Points moyens</th></tr></thead>
                <tbody>
                  {trend.by_year.map((t, i) => (
                    <tr key={i}><td>{t.year}</td><td>{t.avg_points.toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </Table>
            ) : <div className="text-muted">Pas de tendance calculable.</div>}
          </div>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Conseils d’entraînement</Card.Header>
        <Card.Body>
          {suggestions.length ? (
            <ul className="mb-0">
              {suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : <div className="text-muted">Pas de conseil spécifique pour l’instant.</div>}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 rounded-3">
        <Card.Header className="bg-primary text-white">Disqualifications / DNS-DNF</Card.Header>
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
