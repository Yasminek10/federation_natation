import React, { useEffect, useState } from "react";

export default function CoachSwimmers() {
  const [nageurs, setNageurs] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/coach/nageurs", { credentials: "include" })
      .then(r => r.json())
      .then(data => setNageurs(data.nageurs || []))
      .catch(console.error);
  }, []);

  return (
    <div className="container py-4">
      <h3>Mes nageurs</h3>
      <table className="table">
        <thead><tr><th>Nom</th><th>Prénom</th><th>Club</th><th>Année</th></tr></thead>
        <tbody>
          {nageurs.map(n => (
            <tr key={n.id}><td>{n.nom}</td><td>{n.prenom}</td><td>{n.club}</td><td>{n.birth_year}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
