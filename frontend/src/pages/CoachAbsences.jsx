import React, { useEffect, useState } from "react";
import {
  Accordion,
  Button,
  Spinner,
  Form,
  Table,
  Alert,
  Modal,
} from "react-bootstrap";

export default function CoachAbsences() {
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSeance, setSelectedSeance] = useState(null);
  const [presences, setPresences] = useState({});
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newSession, setNewSession] = useState("AM");
  const [newLieu, setNewLieu] = useState("");
  const [nageurs, setNageurs] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // 🔍 Recherche globale pour modal
  const [searchInSeance, setSearchInSeance] = useState(""); // 🔍 Recherche dans séance
  const today = new Date().toISOString().split("T")[0];

  // 🔁 Masquer le message après 3 secondes
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // =====================================================
  // 🔹 Charger l’historique
  // =====================================================
  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/coach/seances/history", {
        credentials: "include",
      });
      const data = await res.json();

      const grouped = {};
      data.seances.forEach((s) => {
        const d = new Date(s.date);
        const year = d.getFullYear();
        const month = d.toLocaleString("fr-FR", { month: "long" });
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(s);
      });

      Object.keys(grouped).forEach((y) => {
        Object.keys(grouped[y]).forEach((m) => {
          grouped[y][m].sort((a, b) => new Date(b.date) - new Date(a.date));
        });
      });

      setHistory(grouped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    loadNageurs();
  }, []);

  // =====================================================
  // 🔹 Charger tous les nageurs
  // =====================================================
  const loadNageurs = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/coach/nageurs/mine", {
        credentials: "include",
      });
      const data = await res.json();
      setNageurs(data.nageurs || []);
    } catch (err) {
      console.error("Erreur chargement nageurs :", err);
    }
  };

  // =====================================================
  // 🔹 Charger les présences
  // =====================================================
  const loadSeanceDetails = async (date, session) => {
    if (selectedSeance?.date === date && selectedSeance?.session === session) {
      setSelectedSeance(null);
      return;
    }

    setSelectedSeance({ date, session });
    setMessage("");
    setPresences({});
    setLoading(true);
    setSearchInSeance(""); // reset recherche

    try {
      const res = await fetch(
        `http://localhost:5000/api/coach/presences/by_date?date=${date}&session=${session}`,
        { credentials: "include" }
      );
      const data = await res.json();
      const map = {};
      data.presences.forEach((p) => (map[p.id_nageur] = p.present));
      setPresences(map);
      setSelectedSeance({
        seance_id: data.seance_id,
        date,
        session,
        lieu: data.lieu,
        nageurs: data.presences,
      });
    } catch (err) {
      console.error("Erreur chargement séance :", err);
      setMessage("❌ Erreur chargement des présences.");
    } finally {
      setLoading(false);
    }
  };

  const togglePresence = (id) => {
    setPresences((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // =====================================================
  // 🔹 Enregistrer modification de présence
  // =====================================================
  const savePresences = async () => {
    if (!selectedSeance?.seance_id) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/api/coach/presences/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          seance_id: selectedSeance.seance_id,
          presences: selectedSeance.nageurs.map((n) => ({
            nageur_id: n.id_nageur,
            present: presences[n.id_nageur],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage("✅ Modifications enregistrées !");
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🔹 Ajouter une séance
  // =====================================================
  const handleAddSeance = async () => {
    if (!newDate || !newLieu) {
      setMessage("❗Veuillez remplir tous les champs.");
      return;
    }
    if (newDate > today) {
      setMessage("❌ Impossible d’ajouter une date future.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:5000/api/coach/seances/get_or_create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: newDate,
            session: newSession,
            lieu: newLieu,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      const presencesPayload = nageurs.map((n) => ({
        nageur_id: n.id_nageur,
        present: presences[n.id_nageur] ?? true,
      }));

      await fetch("http://localhost:5000/api/coach/presences/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          seance_id: data.seance_id,
          presences: presencesPayload,
        }),
      });

      setMessage("✅ Séance ajoutée et présences enregistrées !");
      setShowAddModal(false);
      setNewDate("");
      setNewLieu("");
      setPresences({});
      await loadHistory();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🔹 Rendu JSX
  // =====================================================
  return (
    <div className="container py-4">
      <h3 className="text-center mb-4">Historique et gestion des absences</h3>

      <div className="d-flex justify-content-end mb-3">
        <Button onClick={() => setShowAddModal(true)}> Ajouter une séance</Button>
      </div>

      {loading && <Spinner animation="border" />}
      {message && <Alert>{message}</Alert>}

      <Accordion alwaysOpen>
        {Object.keys(history)
          .sort((a, b) => b - a)
          .map((year) => (
            <Accordion.Item eventKey={year} key={year}>
              <Accordion.Header>{year}</Accordion.Header>
              <Accordion.Body>
                <Accordion alwaysOpen>
                  {Object.keys(history[year]).map((month) => (
                    <Accordion.Item eventKey={`${year}-${month}`} key={month}>
                      <Accordion.Header>{month}</Accordion.Header>
                      <Accordion.Body>
                        {history[year][month].map((s) => (
                          <div key={s.seance_id} className="mb-3 border p-2 rounded">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{s.date}</strong> ({s.session}) - {s.lieu}
                              </div>
                              <Button
                                size="sm"
                                variant={
                                  selectedSeance?.date === s.date &&
                                  selectedSeance?.session === s.session
                                    ? "danger"
                                    : "outline-primary"
                                }
                                onClick={() => loadSeanceDetails(s.date, s.session)}
                              >
                                {selectedSeance?.date === s.date &&
                                selectedSeance?.session === s.session
                                  ? "Fermer"
                                  : "Voir / Modifier"}
                              </Button>
                            </div>

                            {selectedSeance?.date === s.date &&
                              selectedSeance?.session === s.session && (
                                <div className="mt-3">
                                  {message && (
                                    <Alert
                                      variant={
                                        message.includes("✅") ? "success" : "danger"
                                      }
                                      className="py-2 mb-3 text-center"
                                    >
                                      {message}
                                    </Alert>
                                  )}
                                  <div className="text-end">
                                    <Button
                                      variant="success"
                                      onClick={savePresences}
                                      disabled={loading}
                                    >
                                       Enregistrer
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline-success"
                                      onClick={() => window.open(
                                        `http://localhost:5000/api/coach/presences/export?date=${s.date}&session=${s.session}`,
                                        "_blank"
                                      )}
                                    >
                                    Télécharger
                                    </Button>
                                  </div>
                                  <br></br>
                                  {/*  Barre de recherche locale */}
                                  <Form.Control
                                    type="text"
                                    placeholder="Rechercher un nageur..."
                                    className="mb-3"
                                    value={searchInSeance}
                                    onChange={(e) =>
                                      setSearchInSeance(e.target.value)
                                    }
                                  />

                                  <Table bordered responsive className="text-center">
                                    <thead>
                                      <tr>
                                        <th>Présent</th>
                                        <th>Nom</th>
                                        <th>Prénom</th>
                                        <th>Catégorie</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedSeance.nageurs
                                        ?.filter(
                                          (n) =>
                                            n.nom
                                              .toLowerCase()
                                              .includes(
                                                searchInSeance.toLowerCase()
                                              ) ||
                                            n.prenom
                                              .toLowerCase()
                                              .includes(
                                                searchInSeance.toLowerCase()
                                              )
                                        )
                                        .map((n) => (
                                          <tr key={n.id_nageur}>
                                            <td>
                                              <Form.Check
                                                type="checkbox"
                                                checked={presences[n.id_nageur] ?? true}
                                                onChange={() =>
                                                  togglePresence(n.id_nageur)
                                                }
                                              />
                                            </td>
                                            <td>{n.nom}</td>
                                            <td>{n.prenom}</td>
                                            <td>{n.categorie}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </Table>

                                  
                                </div>
                              )}
                          </div>
                        ))}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </Accordion.Body>
            </Accordion.Item>
          ))}
      </Accordion>

      {/* === MODAL AJOUT SÉANCE === */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Ajouter une séance et présences</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Date :</Form.Label>
            <Form.Control
              type="date"
              max={today}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Session :</Form.Label>
            <Form.Select
              value={newSession}
              onChange={(e) => setNewSession(e.target.value)}
            >
              <option value="AM">Matin</option>
              <option value="PM">Après-midi</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Lieu :</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Piscine municipale"
              value={newLieu}
              onChange={(e) => setNewLieu(e.target.value)}
            />
          </Form.Group>

          {/* 🔍 Barre de recherche dans le modal */}
          <Form.Control
            type="text"
            placeholder="Rechercher un nageur..."
            className="mb-3"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <h6 className="mt-4">Présences des nageurs</h6>
          <Table bordered responsive className="text-center">
            <thead>
              <tr>
                <th>Présent</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {nageurs
                .filter(
                  (n) =>
                    n.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    n.prenom.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((n) => (
                  <tr key={n.id_nageur}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={presences[n.id_nageur] ?? true}
                        onChange={() => togglePresence(n.id_nageur)}
                      />
                    </td>
                    <td>{n.nom}</td>
                    <td>{n.prenom}</td>
                    <td>{n.categorie}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleAddSeance}>
            Enregistrer la séance
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
