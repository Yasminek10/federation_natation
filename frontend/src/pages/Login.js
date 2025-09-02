import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import logo from "../assets/logo-ftn.png";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // ⬇️ Si session déjà active, on n’affiche pas le login
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:5000/api/me", { credentials: "include" });
        if (res.ok) {
          // déjà connecté
          navigate("/home", { replace: true });
        }
      } catch {}
    })();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",        // ⬅️ important pour le cookie de session
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === "success") {
        // stocke l’utilisateur pour l’UI (navbar, etc.)
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/home", { replace: true });
      } else {
        setError(data.message || "Identifiants incorrects");
      }
    } catch {
      setError("Erreur serveur");
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img src={logo} alt="FTN Logo" className="ftn-logo" />
        <h1>Fédération Tunisienne de Natation</h1>
      </div>

      <div className="login-image"></div>

      <div className="login-form">
        <h2 className="form-title">Mon Compte</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Adresse email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-login">Se connecter</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
