import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Row, Col, Spinner, Button, Nav } from "react-bootstrap";
import Navbar_Home from "../components/Navbar_Home";
import IndividualResults from "../components/IndividualResults";
import RelayResults from "../components/RelayResults";
import MedalsCount from "../components/MedailCountNageur";
import "../styles/nageurDetails.css";
export default function SwimmerDetails({ user }) {
  const { nageurId } = useParams();

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("individuels");

  useEffect(() => {
    fetch(`http://localhost:5000/api/nageursDetails/${nageurId}`)
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, [nageurId]);

  if (loading) return <Spinner animation="border" className="m-5" />;

  if (!data || data.error)
    return (
      <div className="text-center text-danger mt-5">
        {data?.error || "Erreur"}
      </div>
    );

  const { nageur, historique = [], analyses, relais = [] } = data;

  return (
    <div>
      <Navbar_Home user={user} />

      <div className="container py-4">
        {/* Header Nageur */}
        <Card className="shadow-sm border-0 mb-4 rounded-3">
          <Card.Body
            className="rounded-3"
            style={{
              background:
                "linear-gradient(14deg,rgba(255, 255, 255, 1) 0%, rgba(230, 245, 255, 1) 100%)",
            }}
          >
            <Row className="align-items-center">
              <Col xs="auto">
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    backgroundColor: "#0e3e84dd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: "white",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  {nageur.prenom.charAt(0).toUpperCase()}
                </div>
              </Col>

              <Col>
                <h3 className="fw-bold mb-1" style={{ color: "#0e3e84dd" }}>
                  {nageur.prenom} {nageur.nom}
                </h3>
                <div className="d-flex gap-3 small text-secondary fw-semibold">
                  <span>
                    Club: <strong>{nageur.club}</strong>
                  </span>
                  <span>
                    Nationalité: <strong>{nageur.nationalite}</strong>
                  </span>
                  <span>
                    Année: <strong>{nageur.birth_year}</strong>
                  </span>
                </div>
              </Col>

              <Col xs="auto">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => navigate(-1)}
                >
                  ← Retour
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Analyses */}
        <Row className="mb-4 text-center">
          <Col>
            <Card className="shadow-sm border-0 text-center">
              <Card.Body>
                <Card.Title>Nombre de courses</Card.Title>
                <h2>{analyses.nb_courses}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card className="shadow-sm border-0 text-center">
              <Card.Body>
                <Card.Title>Meilleur temps</Card.Title>
                <h2>{analyses.meilleur_temps || "-"}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card className="shadow-sm border-0 text-center">
              <Card.Body>
                <Card.Title>Points moyens</Card.Title>
                <h2>{analyses.points_moyens?.toFixed(1) || "-"}</h2>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Onglets Résultats */}
  <Nav
  activeKey={activeTab}
  onSelect={(selectedKey) => setActiveTab(selectedKey)}
  className="nav-simple justify-content-center mb-4"
>
  <Nav.Item>
    <Nav.Link eventKey="individuels"> Individuels</Nav.Link>
  </Nav.Item>
  <Nav.Item>
    <Nav.Link eventKey="relais">Relais</Nav.Link>
  </Nav.Item>
  <Nav.Item>
    <Nav.Link eventKey="medails">Médailles</Nav.Link>
  </Nav.Item>
</Nav>


        {/* Composants selon l'onglet */}
        {activeTab === "individuels" && (
          <IndividualResults historique={historique} />
        )}
        {activeTab === "relais" && <RelayResults relais={relais} />}
        {activeTab === "medails" && (
          <MedalsCount historique={historique} relais={relais} />
        )}
      </div>
    </div>
  );
}
