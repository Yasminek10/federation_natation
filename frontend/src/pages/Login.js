import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import logo from "../assets/logo-ftn.png"; // place your logo inside src/assets/

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.status === "success") {
        localStorage.setItem("user", JSON.stringify(data));
        if (data.role === "admin") {
          navigate("/home");
        } else if (data.role === "coach") {
          navigate("/home");
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Erreur serveur");
    }
  };
  return (
    <div className="login-container">
      {/* Header always top-right */}
      <div className="login-header">
        <img src={logo} alt="FTN Logo" className="ftn-logo" />
        <h1>Fédération Tunisienne de Natation</h1>
      </div>

      {/* Left side with background image */}
      <div className="login-image"></div>

      {/* Right side with login form */}
      <div className="login-form">
        {/* Centered form title */}
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
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-login">
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
