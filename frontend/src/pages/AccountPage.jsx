// src/pages/AccountPage.jsx
import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner, Card } from "react-bootstrap";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/me", { credentials: "include" });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error(data.message || data.error || "Erreur serveur");
      const u = data.user;
      setNom(u.nom || "");
      setPrenom(u.prenom || "");
      setEmail(u.email || "");
      localStorage.setItem("user", JSON.stringify(u));
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (window.location.hash === "#password") {
      setTimeout(() => document.getElementById("password-block")?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, []);

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

  if (loading) {
    return (
      <div className="p-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="container p-4" style={{ marginTop: 10 }}>
      <h3>Mon compte</h3>

      {msg && (
        <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible>
          {msg.text}
        </Alert>
      )}

      {/* Profil : lecture seule */}
      <Card className="mb-3">
        <Card.Header as="h5">Profil</Card.Header>
        <Card.Body>
          <Form className="d-grid gap-3" onSubmit={(e) => e.preventDefault()}>
            <div className="row">
              <div className="col-md-6">
                <Form.Label>Prénom</Form.Label>
                <Form.Control value={prenom} readOnly disabled />
              </div>
              <div className="col-md-6">
                <Form.Label>Nom</Form.Label>
                <Form.Control value={nom} readOnly disabled />
              </div>
            </div>
            <div>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} readOnly disabled />
            </div>
            <div className="text-muted small">
              Les informations du profil sont figées. Contactez un administrateur pour les mises à jour.
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Mot de passe : modifiable */}
      <Card id="password-block">
        <Card.Header as="h5">Mot de passe</Card.Header>
        <Card.Body>
          <Form className="d-grid gap-3" onSubmit={(e) => e.preventDefault()}>
            <div className="row">
              <div className="col-md-6">
                <Form.Label>Mot de passe actuel</Form.Label>
                <Form.Control
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Nouveau mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                />
              </div>
            </div>
            <Button onClick={changePassword} disabled={savingPwd || !currentPassword || newPassword.length < 6}>
              {savingPwd ? <>Modification…</> : "Modifier"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
