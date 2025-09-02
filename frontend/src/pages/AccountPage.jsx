import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Form, Spinner, Card, Badge, InputGroup
} from "react-bootstrap";
import {
  FaIdCard, FaEnvelope, FaUser, FaLock, FaKey, FaShieldAlt, FaEye, FaEyeSlash
} from "react-icons/fa";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const initials = ([prenom, nom].filter(Boolean).join(" ") || email || "U")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  // Score de robustesse
  const pwdScore = useMemo(() => {
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return Math.min(s, 4);
  }, [newPassword]);

  const pwdPercent = (pwdScore / 4) * 100;
  const pwdLabel = pwdScore <= 1 ? "Faible" : pwdScore === 2 ? "Moyen" : "Fort";
  const pwdBarClass = pwdScore <= 1 ? "bg-danger" : pwdScore === 2 ? "bg-warning" : "bg-success";

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/me", { credentials: "include" });
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(data.message || data.error || "Erreur serveur");
      const u = data.user;
      setNom(u.nom || ""); setPrenom(u.prenom || ""); setEmail(u.email || "");
      localStorage.setItem("user", JSON.stringify(u));
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally { setLoading(false); }
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
          data.error === "bad_credentials" ? "Mot de passe actuel incorrect."
          : data.error === "weak_password" ? "Nouveau mot de passe trop court (6+)."
          : "Échec du changement de mot de passe"
        );
      }
      setMsg({ type: "success", text: "Mot de passe modifié." });
      setCurrentPassword(""); setNewPassword("");
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally { setSavingPwd(false); }
  };

  if (loading) {
    return (<div className="p-4"><Spinner animation="border" size="sm" className="me-2" />Chargement…</div>);
  }

  return (
    <div className="container account-page">
      <Card className="account-card mx-auto">
        <Card.Header className="account-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <div className="avatar-badge">{initials}</div>
            <div className="ms-3">
              <div className="acc-title">{prenom || "—"} {nom || ""}</div>
              <div className="acc-subtitle">{email || "—"}</div>
            </div>
          </div>
          <Badge bg="light" text="dark" className="security-badge">
            <FaShieldAlt className="me-2" /> Sécurité du compte
          </Badge>
        </Card.Header>

        {msg && (
          <div className="px-3 pt-3">
            <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible className="mb-0">
              {msg.text}
            </Alert>
          </div>
        )}

        <Card.Body className="p-3 p-md-4">
          {/* === Contenu centré === */}
          <div className="account-body-inner mx-auto">
            {/* Profil (lecture seule) */}
            <div className="section-box">
              <div className="section-head"><FaIdCard className="me-2" /> Informations personnelles</div>
              <Form className="d-grid gap-3" onSubmit={(e) => e.preventDefault()}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Form.Label className="tiny-label"><FaUser className="me-2" />Prénom</Form.Label>
                    <Form.Control value={prenom} readOnly className="readonly-input" title="Lecture seule" />
                  </div>
                  <div className="col-md-6">
                    <Form.Label className="tiny-label"><FaUser className="me-2" />Nom</Form.Label>
                    <Form.Control value={nom} readOnly className="readonly-input" title="Lecture seule" />
                  </div>
                </div>
                <div>
                  <Form.Label className="tiny-label"><FaEnvelope className="me-2" />Email</Form.Label>
                  <Form.Control type="email" value={email} readOnly className="readonly-input" title="Lecture seule" />
                </div>
                <div className="form-hint">Les informations du profil sont figées. Contactez un administrateur pour les mises à jour.</div>
              </Form>
            </div>

            {/* Mot de passe */}
            <div className="section-box emphasis mt-4" id="password-block">
              <div className="section-head"><FaLock className="me-2" /> Mot de passe</div>
              <Form className="d-grid gap-3" onSubmit={(e) => e.preventDefault()}>
                <div className="row g-3">
                  <div className="col-12">
                    <Form.Label className="tiny-label">Mot de passe actuel</Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaKey /></InputGroup.Text>
                      <Form.Control
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Votre mot de passe actuel"
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        className="peek-btn"
                        onClick={() => setShowCurrent((v) => !v)}
                        aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        {showCurrent ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </InputGroup>
                  </div>

                  <div className="col-12">
                    <Form.Label className="tiny-label">Nouveau mot de passe</Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaLock /></InputGroup.Text>
                      <Form.Control
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="6 caractères minimum"
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        className="peek-btn"
                        onClick={() => setShowNew((v) => !v)}
                        aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        {showNew ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </InputGroup>

                    {/* Barre de robustesse */}
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-muted">Robustesse : <strong>{pwdLabel}</strong></span>
                      <span className="text-muted">{Math.round(pwdPercent)}%</span>
                    </div>
                    <div className="progress mt-1" style={{ height: 6 }}>
                      <div
                        className={`progress-bar ${pwdBarClass}`}
                        role="progressbar"
                        style={{ width: `${pwdPercent}%` }}
                        aria-valuenow={pwdPercent}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <div className="form-hint">Astuce : combinez lettres, chiffres et symboles.</div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <Button
                    className="cta-gradient"
                    onClick={changePassword}
                    disabled={savingPwd || !currentPassword || newPassword.length < 6}
                  >
                    {savingPwd ? (<><Spinner animation="border" size="sm" className="me-2" /> Modification…</>) : ("Modifier le mot de passe")}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => { setCurrentPassword(""); setNewPassword(""); }}
                    disabled={savingPwd}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
