import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Tabs,
  Tab,
  Container,
  Button,
  Col,
  Card,
  Row,
  Spinner,
} from "react-bootstrap";
import SwimmersList from "../components/SwimmersList";
import ClubAnalyses from "../components/ClubsAnalyses";
import Navbar_Home from "../components/Navbar_Home";

export default function ClubDetails({ user }) {
  const { public_id } = useParams();
  const [club, setClub] = useState(null);
  const [swimmers, setSwimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`http://localhost:5000/api/clubs/${public_id}`).then((res) => res.json()),
      fetch(`http://localhost:5000/api/clubs/${public_id}/nageurs`).then((res) =>
        res.json()
      ),
    ])
      .then(([clubData, swimmersData]) => {
        setClub(clubData);
        setSwimmers(swimmersData);
      })
      .catch((err) => console.error("Erreur fetch club ou nageurs:", err))
      .finally(() => setLoading(false));
  }, [public_id]);

  if (loading)
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-gray-500">Chargement des informations...</p>
      </div>
    );

  return (
    <div>
      <Navbar_Home user={user} />
      <div className="container mt-4 mb-5">
        {club && (
          <Card className="shadow-sm border-0 mb-4 rounded-3">
            <Card.Body
              className="rounded-3"
              style={{
                background: "linear-gradient(14deg, #ffffff 0%, #e6f5ff 100%)",
              }}
            >
              <Row className="align-items-center">
                <Col xs="auto">
                  {club.logo ? (
                    <img
                      src={club.logo}
                      alt={club.nom}
                      style={{ width: 90, height: 90 }}
                      className="rounded-circle border shadow-sm"
                    />
                  ) : (
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
                      {club.nom.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Col>

                <Col>
                  <h3 className="fw-bold mb-1" style={{ color: "#0e3e84dd" }}>
                    {club.nom}
                  </h3>
                  <div className="d-flex gap-4 small text-secondary fw-semibold">
                    <i className="bi bi-people-fill"></i> {swimmers.length}{" "}
                    Nageurs
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
        )}

        <Tabs defaultActiveKey="swimmers" id="club-tabs" className="mb-3">
          <Tab eventKey="swimmers" title="🏊 Nageurs">
            <SwimmersList clubId={public_id} />
          </Tab>
          <Tab eventKey="analyses" title="📊 Analyses">
            <ClubAnalyses clubId={public_id} />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
