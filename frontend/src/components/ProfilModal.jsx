import React, { useEffect, useMemo, useState } from "react";
import {
  Modal, Button, Form, Alert, Spinner, Row, Col, InputGroup
} from "react-bootstrap";
import {
  FaUser, FaEnvelope, FaLock, FaKey, FaEye, FaEyeSlash, FaIdCard
} from "react-icons/fa";

export default function ProfileModal({ show, onClose }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // œils (afficher/masquer)
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Robustesse du nouveau mot de passe
  const pwdScore = useMemo(() => {
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return Math.min(s, 4);
  }, [newPassword]);

  const pwdPercent = (pwdScore / 4) * 100;
  const pwdBarClass =
    pwdScore <= 1 ? "bg-danger"
    : pwdScore === 2 ? "bg-warning"
    : "bg-success";
  const pwdLabel =
    pwdScore <= 1 ? "Faible"
    : pwdScore === 2 ? "Moyen"
    : "Fort";

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
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="lg"
      scrollable
      fullscreen="sm-down"      // plein écran en mobile
      className="profile-modal" // styles dédiés
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="modal-title-icon"><FaIdCard /></span>
          <span>Mon compte</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading ? (
          <div className="d-flex align-items-center">
            <Spinner animation="border" size="sm" className="me-2" /> Chargement…
          </div>
        ) : (
          <>
            {msg && (
              <Alert
                variant={msg.type === "error" ? "danger" : "success"}
                onClose={() => setMsg(null)}
                dismissible
              >
                {msg.text}
              </Alert>
            )}

            {/* --- Section Profil (lecture seule) --- */}
            <div className="pm-section">
              <div className="pm-section-title">
                <FaUser className="me-2" /> Profil
              </div>

              <Form className="profile-form" onSubmit={(e) => e.preventDefault()}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Prénom</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="input-ico"><FaUser /></InputGroup.Text>
                      <Form.Control
                        value={prenom}
                        readOnly
                        className="readonly-input"
                        placeholder="—"
                      />
                    </InputGroup>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Nom</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="input-ico"><FaUser /></InputGroup.Text>
                      <Form.Control
                        value={nom}
                        readOnly
                        className="readonly-input"
                        placeholder="—"
                      />
                    </InputGroup>
                  </Col>
                </Row>

                <div className="mt-3">
                  <Form.Label>Email</Form.Label>
                  <InputGroup>
                    <InputGroup.Text className="input-ico"><FaEnvelope /></InputGroup.Text>
                    <Form.Control
                      type="email"
                      value={email}
                      readOnly
                      className="readonly-input"
                      placeholder="—"
                    />
                  </InputGroup>
                </div>

                {/* plus de bouton Enregistrer ici */}
                <div className="form-hint mt-2">
                  Les informations du profil sont figées. Contactez un administrateur pour les mises à jour.
                </div>

                
              </Form>
            </div>

            {/* --- Section Mot de passe --- */}
            <div className="pm-section mt-4">
              <div className="pm-section-title">
                <FaLock className="me-2" /> Mot de passe
              </div>

              <Form onSubmit={(e) => e.preventDefault()}>
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Label>Mot de passe actuel</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="input-ico"><FaKey /></InputGroup.Text>
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
                        onClick={() => setShowCurrent(v => !v)}
                        aria-label={showCurrent ? "Masquer" : "Afficher"}
                      >
                        {showCurrent ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </InputGroup>
                  </Col>

                  <Col md={12}>
                    <Form.Label>Nouveau mot de passe</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="input-ico"><FaLock /></InputGroup.Text>
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
                        onClick={() => setShowNew(v => !v)}
                        aria-label={showNew ? "Masquer" : "Afficher"}
                      >
                        {showNew ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </InputGroup>

                    {/* barre de robustesse */}
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-muted">
                        Robustesse : <strong>{pwdLabel}</strong>
                      </span>
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
                  </Col>
                </Row>

                <div className="d-grid d-sm-flex gap-2 mt-3">
                  <Button
                    className="cta-gradient"
                    onClick={changePassword}
                    disabled={savingPwd || !currentPassword || newPassword.length < 6}
                  >
                    {savingPwd ? "Modification…" : "Modifier"}
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
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
