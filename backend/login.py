from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import bcrypt

app = Flask(__name__)
CORS(app)  # autorise React à appeler l’API Flask

# Connexion à PostgreSQL
conn = psycopg2.connect(
    dbname="ftn_db",
    user="postgres",
    password="your_password",
    host="localhost",
    port="5432"
)

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    cur = conn.cursor()
    cur.execute("SELECT id, email, password, role FROM users WHERE email=%s", (email,))
    user = cur.fetchone()

    if user:
        user_id, user_email, user_password, user_role = user

        if bcrypt.checkpw(password.encode("utf-8"), user_password.encode("utf-8")):
            return jsonify({"status": "success", "role": user_role})
    
    return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401


if __name__ == "__main__":
    app.run(debug=True)
