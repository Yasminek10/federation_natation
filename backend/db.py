from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, CheckConstraint, ForeignKey
from sqlalchemy.orm import relationship

db = SQLAlchemy()

# ---------- Core tables ----------

class Club(db.Model):
    __tablename__ = "club"
    id_club = db.BigInteger().with_variant(db.BigInteger, "postgresql")  # BIGSERIAL PK
    id_club = db.Column(db.BigInteger, primary_key=True)  # works with Postgres
    nom = db.Column(db.String(255), nullable=False, unique=True)

    nageurs = relationship("Nageur", back_populates="club")


class Nageur(db.Model):
    __tablename__ = "nageur"
    id_nageur = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    prenom = db.Column(db.String(120), nullable=False)
    nationalite = db.Column(db.String(64))
    date_naissance = db.Column(db.Date)

    id_club = db.Column(db.BigInteger, db.ForeignKey("club.id_club", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    club = relationship("Club", back_populates="nageurs")

    resultats = relationship("Resultat", back_populates="nageur")


class Categorie(db.Model):
    __tablename__ = "categorie"
    categorie_id = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(80), nullable=False, unique=True)


class Epreuve(db.Model):
    __tablename__ = "epreuve"
    epreuve_id = db.Column(db.BigInteger, primary_key=True)
    nage = db.Column(db.String(40), nullable=False)
    distance = db.Column(db.Integer, nullable=False)
    genre = db.Column(db.String(16), nullable=False)   # 'Dames' | 'Messieurs' | 'Mixte'
    is_relay = db.Column(db.Boolean, nullable=False, server_default="false")
    legs_count = db.Column(db.Integer, nullable=True)  # Nombre de nageurs pour le relais, ou null si non-relais

    __table_args__ = (
        CheckConstraint("genre in ('Dames','Messieurs','Mixte')", name="ck_epreuve_genre"),
        UniqueConstraint("nage", "distance", "genre", "is_relay", name="uq_epreuve"),
    )



class Championnat(db.Model):
    __tablename__ = "championnat"
    champ_id = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(255), nullable=False)
    saison = db.Column(db.String(32), nullable=False)
    datedeb = db.Column(db.Date, nullable=False)
    datefin = db.Column(db.Date, nullable=False)
    lieu = db.Column(db.String(255))
    bassin = db.Column(db.Integer, nullable=False)

    __table_args__ = (CheckConstraint("bassin in (25,50)", name="ck_bassin"),)

    cecs = relationship("CEC", back_populates="championnat", cascade="all, delete-orphan")


class CEC(db.Model):
    """championnat_epreuve_categorie"""
    __tablename__ = "championnat_epreuve_categorie"
    cec_id = db.Column(db.BigInteger, primary_key=True)

    champ_id = db.Column(db.BigInteger,
        db.ForeignKey("championnat.champ_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False)
    epreuve_id = db.Column(db.BigInteger,
        db.ForeignKey("epreuve.epreuve_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False)
    categorie_id = db.Column(db.BigInteger,
        db.ForeignKey("categorie.categorie_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False)

    __table_args__ = (UniqueConstraint("champ_id", "epreuve_id", "categorie_id", name="uq_cec"),)

    championnat = relationship("Championnat", back_populates="cecs")
    epreuve = relationship("Epreuve")
    categorie = relationship("Categorie")
    resultats = relationship("Resultat", back_populates="cec", cascade="all, delete-orphan")


class Minimas(db.Model):
    __tablename__ = "minimas"
    min_id = db.Column(db.BigInteger, primary_key=True)

    epreuve_id = db.Column(db.BigInteger,
        db.ForeignKey("epreuve.epreuve_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False)
    categorie_id = db.Column(db.BigInteger,
        db.ForeignKey("categorie.categorie_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False)

    temp_min = db.Column(db.String(32), nullable=False)

    __table_args__ = (UniqueConstraint("epreuve_id", "categorie_id", name="uq_minimas"),)

    epreuve = relationship("Epreuve")
    categorie = relationship("Categorie")


class Resultat(db.Model):
    __tablename__ = "resultat"
    resultat_id = db.Column(db.BigInteger, primary_key=True)

    id_nageur = db.Column(db.BigInteger,
        db.ForeignKey("nageur.id_nageur", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False)
    cec_id = db.Column(db.BigInteger,
        db.ForeignKey("championnat_epreuve_categorie.cec_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False)

    points = db.Column(db.Integer, nullable=False, server_default="0")
    place = db.Column(db.Integer)
    temps = db.Column(db.String(32))

    nageur = relationship("Nageur", back_populates="resultats")
    cec = relationship("CEC", back_populates="resultats")


class User(db.Model):
    __tablename__ = "user"
    user_id = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    prenom = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    mdp_hash = db.Column(db.String(255), nullable=False)  # bcrypt hash
    role = db.Column(db.String(16), nullable=False)       # 'admin' | 'coach'
    __table_args__ = (CheckConstraint("role in ('admin','coach')", name="ck_user_role"),)