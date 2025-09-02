// src/components/ProfileModal.jsx
import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";

export default function ProfileModal({ show, onClose, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (!show) return;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const res = await fetch("http://localhost:5000/api/me", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Erreur serveur");
        const u = data.user;
        setNom(u.nom || "");
        setPrenom(u.prenom || "");
        setEmail(u.email || "");
      } catch (e) {
        setMsg({ type: "error", text: String(e.message || e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [show]);

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom, prenom, email }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") throw new Error(data.error || "Échec de l'enregistrement");
      localStorage.setItem("user", JSON.stringify(data.user));
      onUpdated && onUpdated(data.user);
      setMsg({ type: "success", text: "Profil mis à jour." });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSavingPwd(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") {
        throw new Error(
          data.error === "bad_credentials"
            ? "Mot de passe actuel incorrect."
            : data.error === "weak_password"
            ? "Nouveau mot de passe trop court (6+)."
            : "Échec du changement de mot de passe"
        );
      }
      setMsg({ type: "success", text: "Mot de passe modifié." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Mon compte</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div><Spinner animation="border" size="sm" className="me-2" /> Chargement…</div>
        ) : (
          <>
            {msg && (
              <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible>
                {msg.text}
              </Alert>
            )}

            <h6 className="mb-2">Profil</h6>
            <Form className="d-grid gap-3 mb-3" onSubmit={(e) => e.preventDefault()}>
              <div className="row">
                <div className="col-md-6">
                  <Form.Label>Prénom</Form.Label>
                  <Form.Control value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <Form.Label>Nom</Form.Label>
                  <Form.Control value={nom} onChange={(e) => setNom(e.target.value)} required />
                </div>
              </div>
              <div>
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <>Enregistrement…</> : "Enregistrer"}
              </Button>
            </Form>

            <h6 className="mb-2">Mot de passe</h6>
            <Form className="d-grid gap-3" onSubmit={(e) => e.preventDefault()}>
              <div className="row">
                <div className="col-md-6">
                  <Form.Label>Mot de passe actuel</Form.Label>
                  <Form.Control type="password" value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Nouveau mot de passe</Form.Label>
                  <Form.Control type="password" value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="6 caractères minimum" />
                </div>
              </div>
              <Button onClick={changePassword} disabled={savingPwd || !currentPassword || newPassword.length < 6}>
                {savingPwd ? <>Modification…</> : "Modifier"}
              </Button>
            </Form>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </Modal.Footer>
    </Modal>
  );
}
