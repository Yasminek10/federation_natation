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

export default function CoachTests() {
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results, setResults] = useState([]);
  const [presences, setPresences] = useState({});
  const [message, setMessage] = useState("");
  const [epreuves, setEpreuves] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newEpreuveId, setNewEpreuveId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [nageurs, setNageurs] = useState([]);


  // 🕒 auto-hide message after 3s
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
      const res = await fetch("http://localhost:5000/api/coach/tests/history", {
        credentials: "include",
      });
      const data = await res.json();
      const grouped = {};
      data.tests.forEach((t) => {
        const d = new Date(t.date);
        const year = d.getFullYear();
        const month = d.toLocaleString("fr-FR", { month: "long" });
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(t);
      });
      setHistory(grouped);
    } catch (err) {
      console.error("Erreur chargement historique :", err);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🔹 Charger les épreuves disponibles
  // =====================================================
  const loadEpreuves = async () => {
    const res = await fetch("http://localhost:5000/api/coach/tests/epreuves", {
      credentials: "include",
    });
    const data = await res.json();
    setEpreuves(data.epreuves || []);
  };

  useEffect(() => {
    loadHistory();
    loadEpreuves();
  }, []);
  
  const loadNageursForEpreuve = async (epreuveId) => {
  if (!epreuveId) return;
  try {
    const res = await fetch(`http://localhost:5000/api/coach/tests/nageurs_by_genre?epreuve_id=${epreuveId}`, {
      credentials: "include",
    });
    const data = await res.json();
    setNageurs(
      data.nageurs.map((n) => ({
        ...n,
        temps: "",
      }))
    );
  } catch (err) {
    console.error("Erreur chargement nageurs :", err);
  }
};

  // =====================================================
  // 🔹 Charger les résultats d’un test
  // =====================================================
  const loadTestDetails = async (t) => {
  const { date, epreuve_id, label, session_test_id } = t;

  if (
    selectedTest?.session_test_id === session_test_id
  ) {
    setSelectedTest(null);
    return;
  }

  setSelectedTest({ date, epreuve_id, label, session_test_id });
  setLoading(true);
  setMessage("");

  try {
    const res = await fetch(
      `http://localhost:5000/api/coach/tests/by_date_epreuve?date=${date}&epreuve_id=${epreuve_id}`,
      { credentials: "include" }
    );
    const data = await res.json();
    setResults(data.results || []);
  } catch (err) {
    console.error(err);
    setMessage("❌ Erreur chargement test.");
  } finally {
    setLoading(false);
  }
};

  // =====================================================
  // 🔹 Sauvegarder les résultats
  // =====================================================
  const saveResults = async () => {
    if (!selectedTest) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/coach/tests/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: selectedTest.date,
          epreuve_id: selectedTest.epreuve_id,
          results,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage("✅ Résultats enregistrés avec succès !");
      await loadHistory();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🔹 Modifier un temps
  // =====================================================
  const handleChange = (id, value) => {
    setResults((prev) =>
      prev.map((r) => (r.id_nageur === id ? { ...r, temps: value } : r))
    );
  };

  // =====================================================
  // 🔹 Ajouter un nouveau test
  // =====================================================
  const handleAddTest = async () => {
  if (!newDate || !newEpreuveId) {
    setMessage("❗Veuillez remplir la date et l’épreuve.");
    return;
  }

  setLoading(true);
  try {
    await fetch("http://localhost:5000/api/coach/tests/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date: newDate,
        epreuve_id: newEpreuveId,
        results: nageurs.map((n) => ({
          id_nageur: n.id_nageur,
          temps: n.temps || "0",
        })),
      }),
    });

    setMessage("✅ Test ajouté avec succès !");
    setShowAddModal(false);
    setNewDate("");
    setNewEpreuveId("");
    setNageurs([]);
    await loadHistory();
  } catch (err) {
    setMessage("❌ Erreur lors de l’ajout du test.");
  } finally {
    setLoading(false);
  }
};

  // =====================================================
  // 🔹 Rendu JSX
  // =====================================================
  return (
    <div className="container py-4">
      <h3 className="text-center mb-4">Historique des Tests Techniques</h3>

      <div className="d-flex justify-content-end mb-3">
        <Button onClick={() => setShowAddModal(true)}> Ajouter un test</Button>
      </div>

      {message && (
        <Alert
          variant={message.includes("✅") ? "success" : "danger"}
          className="text-center py-2"
        >
          {message}
        </Alert>
      )}

      {loading && <Spinner animation="border" />}

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
                        {history[year][month].map((t) => (
                          <div key={t.session_test_id} className="mb-3 border p-2 rounded">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{t.date}</strong> — {t.epreuve}
                              </div>
                              <Button
                                size="sm"
                                variant={
                                  selectedTest?.session_test_id === t.session_test_id
                                    ? "danger"
                                    : "outline-primary"
                                }
                                onClick={() =>
                                  loadTestDetails({
                                    date: t.date,
                                    epreuve_id: epreuves.find(
                                      (e) => e.label === t.epreuve
                                    )?.epreuve_id,
                                    label: t.epreuve,
                                    session_test_id: t.session_test_id,
                                })
                                }
                              >
                                {selectedTest?.session_test_id  === t.session_test_id  ? "Fermer" : "Voir / Modifier"}
                              </Button>
                            </div>
                             
                            {selectedTest?.session_test_id === t.session_test_id && (
                              <div className="mt-3">
                              <div className="text-end">
                                  <Button
                                    variant="success"
                                    onClick={saveResults}
                                    disabled={loading}
                                  >
                                     Enregistrer
                                  </Button>
                                  
                                  <Button
                                  size="sm"
                                  variant="outline-success"
                                    onClick={() => {
                                    const epreuveId = epreuves.find((e) => e.label === t.epreuve)?.epreuve_id;
                                    window.open(
                                      `http://localhost:5000/api/coach/tests/export?date=${t.date}&epreuve_id=${epreuveId}`,
                                      "_blank"
                                    );
                                    }}
                                    >
                                    Télécharger
                                  </Button>
                                </div>
                                <br></br>
                                {/* 🔍 Barre de recherche */}
                                <Form.Control
                                  type="text"
                                  placeholder="Rechercher un nageur..."
                                  className="mb-3"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />

                                <Table bordered responsive className="text-center">
                                  <thead>
                                    <tr>
                                      <th>Nom</th>
                                      <th>Prénom</th>
                                      <th>Catégorie</th>
                                      <th>Temps</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {results
                                      .filter(
                                        (r) =>
                                          r.nom
                                            .toLowerCase()
                                            .includes(searchTerm.toLowerCase()) ||
                                          r.prenom
                                            .toLowerCase()
                                            .includes(searchTerm.toLowerCase())
                                      )
                                      .map((r) => (
                                        <tr key={r.id_nageur}>
                                          <td>{r.nom}</td>
                                          <td>{r.prenom}</td>
                                          <td>{r.categorie}</td>
                                          <td>
                                            <Form.Control
                                              type="text"
                                              value={r.temps || ""}
                                              onChange={(e) =>
                                                handleChange(
                                                  r.id_nageur,
                                                  e.target.value
                                                )
                                              }
                                              placeholder="Ex: 1:23.45"
                                            />
                                          </td>
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

      {/* === MODAL AJOUT TEST === */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Ajouter un test</Modal.Title>
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
            <Form.Label>Épreuve :</Form.Label>
            <Form.Select
              value={newEpreuveId}
              onChange={(e) => {setNewEpreuveId(e.target.value); loadNageursForEpreuve(e.target.value);}}
            >
              <option value="">Choisir une épreuve...</option>
              {epreuves.map((e) => (
                <option key={e.epreuve_id} value={e.epreuve_id}>
                  {e.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {nageurs.length > 0 ? (
  <>
    <Alert variant="secondary">
      Entrez les temps pour chaque nageur :
    </Alert>
    <Table bordered responsive className="text-center">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Prénom</th>
          <th>Catégorie</th>
          <th>Temps</th>
        </tr>
      </thead>
      <tbody>
        {nageurs.map((n) => (
          <tr key={n.id_nageur}>
            <td>{n.nom}</td>
            <td>{n.prenom}</td>
            <td>{n.categorie}</td>
            <td>
              <Form.Control
                type="text"
                value={n.temps || ""}
                placeholder="Ex: 1:23.45"
                onChange={(e) => {
                  const val = e.target.value;
                  setNageurs((prev) =>
                    prev.map((x) =>
                      x.id_nageur === n.id_nageur ? { ...x, temps: val } : x
                    )
                  );
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </>
) : (
  <Alert variant="warning">
    Choisissez une épreuve pour afficher la liste des nageurs.
  </Alert>
)}

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleAddTest}>
            Enregistrer le test
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
