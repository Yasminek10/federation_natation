import React, { useState } from "react";
import "../styles/login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      setLoading(true);
      // Appel backend optionnel (Flask): http://localhost:5000/api/login
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, remember, provider: "basic" })
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setMessage(data.message || "Connexion réussie ✅");
    } catch (err) {
      setMessage("Impossible de se connecter. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <section className="login__card" aria-labelledby="loginTitle">
        <header className="login__header">
          <h1 id="loginTitle" className="login__title">Bienvenue</h1>
          <p className="login__subtitle">Connectez-vous pour accéder à votre compte</p>
        </header>

        <form className="login__form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="prenom.nom@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password" className="label">Mot de passe</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="row between">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Se souvenir de moi</span>
            </label>
            <a className="link" href="#">Mot de passe oublié ?</a>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          {message && <p className="status" role="status">{message}</p>}
        </form>

        <footer className="login__footer">
          <span>Pas de compte ?</span>
          <a className="link" href="#">Créer un compte</a>
        </footer>
      </section>
    </main>
  );
}