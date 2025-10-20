import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import { Users, CalendarX, ClipboardCheck, BarChart2, FileText } from "lucide-react"; 
import CoachSwimmers from "./CoachSwimmers";
import CoachAbsences from "./CoachAbsences";
import CoachTests from "./CoachTests";
import CoachStats from "./CoachStats";
import BilanCoach from "./BilanCoach";
import "../styles/coachView.css";
import Navbar_Home from "../components/Navbar_Home";

export default function CoachView({ user }) {
  const [activeTab, setActiveTab] = useState("nageurs");

  const tabs = [
    { key: "nageurs", label: "Mes Nageurs", icon: <Users size={18} /> },
    { key: "absences", label: "Absences", icon: <CalendarX size={18} /> },
    { key: "tests", label: "Tests Techniques", icon: <ClipboardCheck size={18} /> },
    { key: "stats", label: "Statistiques", icon: <BarChart2 size={18} /> },
    { key: "bilan", label: "Bilan", icon: <FileText size={18} /> },
  ];

  return (
    <div className="coach-page">
      {/* ===== Navbar globale ===== */}
      <Navbar_Home user={user} />

      {/* ===== Contenu principal ===== */}
      <div className="coach-container">
        {/* 🔹 Barre d'onglets stylée */}
        <div className="coach-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`coach-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 🔹 Zone de contenu */}
        <div className="coach-content">
          {activeTab === "nageurs" && <CoachSwimmers />}
          {activeTab === "absences" && <CoachAbsences />}
          {activeTab === "tests" && <CoachTests />}
          {activeTab === "stats" && <CoachStats />}
          {activeTab === "bilan" && <BilanCoach />}
        </div>
      </div>
    </div>
  );
}
