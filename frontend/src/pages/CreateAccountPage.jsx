import React, { useMemo, useState } from "react";
import {
  Alert, Button, Card, Form, Spinner, InputGroup, Badge
} from "react-bootstrap";
import {
  FaUserPlus, FaUser, FaEnvelope, FaLock, FaShieldAlt, FaEye, FaEyeSlash
} from "react-icons/fa";

export default function CreateAccountPage() {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role] = useState("coach");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const pwdStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  }, [password]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!nom || !prenom || !email || !password) {
      setMsg({ type: "error", text: "Tous les champs sont requis." });
      return;
    }
    if (password.length < 6) {
      setMsg({ type: "error", text: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("http://localhost:5000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom, prenom, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") {
        const code = data.error;
        const message =
          code === "email_taken" ? "Cet email est déjà utilisé."
          : code === "weak_password" ? "Mot de passe trop court (6+)."
          : code === "invalid_role" ? "Rôle invalide."
          : code === "missing_fields" ? "Champs manquants."
          : code === "forbidden" ? "Accès refusé (admin requis)."
          : "Échec de la création du compte.";
        throw new Error(message);
      }
      setMsg({ type: "success", text: `Compte créé pour ${data.user.prenom} ${data.user.nom} (${data.user.email}).` });
      setNom(""); setPrenom(""); setEmail(""); setPassword("");
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = role === "admin" ? "Administrateur" : "Coach";
  const roleVariant = role === "admin" ? "danger" : "info";

  return (
    <div className="container create-account-page">
      <Card className="create-card mx-auto">
        <Card.Header className="create-card-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="header-icon"><FaUserPlus /></div>
            <div>
              <h4 className="m-0 text-white">Créer un compte</h4>
              <div className="text-white-50 small">Ajouter un nouvel utilisateur au système</div>
            </div>
          </div>
          <Badge className="role-badge pulse" bg={roleVariant}>
            <FaShieldAlt className="me-1" /> {roleLabel}
          </Badge>
        </Card.Header>

        <Card.Body className="p-4">
          {msg && (
            <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible>
              {msg.text}
            </Alert>
          )}

          {/* >>> TOUT EN COLONNE, PLEIN-LARGEUR <<< */}
          <Form onSubmit={onSubmit} className="d-grid gap-3 form-stretch">
            <div>
              <Form.Label>Prénom</Form.Label>
              <InputGroup className="w-100">
                <InputGroup.Text className="input-ico"><FaUser /></InputGroup.Text>
                <Form.Control
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex. Amira"
                  required
                />
              </InputGroup>
            </div>

            <div>
              <Form.Label>Nom</Form.Label>
              <InputGroup className="w-100">
                <InputGroup.Text className="input-ico"><FaUser /></InputGroup.Text>
                <Form.Control
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex. Ben Ali"
                  required
                />
              </InputGroup>
            </div>

            <div>
              <Form.Label>Email</Form.Label>
              <InputGroup className="w-100">
                <InputGroup.Text className="input-ico"><FaEnvelope /></InputGroup.Text>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@ftn.tn"
                  required
                />
              </InputGroup>
              <Form.Text className="text-muted">Utilisez l’adresse officielle si possible.</Form.Text>
            </div>

            <div>
              <Form.Label>Mot de passe</Form.Label>
              <InputGroup className="w-100">
                <InputGroup.Text className="input-ico"><FaLock /></InputGroup.Text>
                <Form.Control
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  required
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="peek-btn"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPwd ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>

              <div className="progress mt-2" style={{ height: 6 }}>
                <div
                  className={`progress-bar ${
                    pwdStrength <= 1 ? "bg-danger" : pwdStrength === 2 ? "bg-warning" : "bg-success"
                  }`}
                  role="progressbar"
                  style={{ width: `${(pwdStrength / 4) * 100}%` }}
                  aria-valuenow={(pwdStrength / 4) * 100}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <Form.Text className="text-muted">Astuce : ajoutez majuscules, chiffres, symboles pour renforcer.</Form.Text>
            </div>

            <div>
              <Form.Label>Rôle</Form.Label>
              <Form.Select value={role} disabled className="readonly-select w-100">
                <option value="coach">Coach</option>
                <option value="admin">Administrateur</option>
              </Form.Select>
              <Form.Text className="text-muted">Le rôle est défini par l’administrateur.</Form.Text>
            </div>

            <div className="d-grid d-md-flex justify-content-md-end">
              <Button type="submit" className="cta-gradient" disabled={saving}>
                {saving ? (<><Spinner animation="border" size="sm" className="me-2" /> Création…</>) : ("Créer le compte")}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
