import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import CoachSwimmers from "./CoachSwimmers";
import CoachAbsences from "./CoachAbsences";
import CoachTests from "./CoachTests";
import CoachStats from "./CoachStats";
import BilanCoach from "./BilanCoach";
import "../styles/coachView.css";

export default function CoachView() {
  const [activeTab, setActiveTab] = useState("nageurs");

  return (
    <div className="container py-4">
      <h2 className="text-center mb-4">Vue Coach</h2>

      {/* Navigation par onglets */}
      <Nav
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="nav-simple justify-content-center mb-4"
      >
        <Nav.Item>
          <Nav.Link eventKey="nageurs">Mes Nageurs</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="absences">Absences</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="tests">Tests Techniques</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="stats">Statistiques</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="bilan">Bilan</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Contenu selon l'onglet */}
      <div style={{ minHeight: "60vh" }}>
        {activeTab === "nageurs" && <CoachSwimmers />}
        {activeTab === "absences" && <CoachAbsences />}
        {activeTab === "tests" && <CoachTests />}
        {activeTab === "stats" && <CoachStats />}
        {activeTab === "bilan" && <BilanCoach />}
      </div>
    </div>
  );
}
