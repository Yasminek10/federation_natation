from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import relationship

db = SQLAlchemy()

# =========================
# Référentiels de base
# =========================

class Club(db.Model):
    __tablename__ = "club"
    id_club = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(255), nullable=False, unique=True)

    nageurs = relationship("Nageur", back_populates="club", cascade="all, delete-orphan")
    equipes = relationship("Equipe", back_populates="club", cascade="all, delete-orphan")


class Nageur(db.Model):
    __tablename__ = "nageur"
    id_nageur = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    prenom = db.Column(db.String(120), nullable=False)
    nationalite = db.Column(db.String(64))
    birth_year = db.Column(db.SmallInteger)  # année uniquement
    id_club = db.Column(
        db.BigInteger,
        db.ForeignKey("club.id_club", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )
    # gestion
    eligible_points = db.Column(db.Boolean, nullable=False, server_default="true")
    

    __table_args__ = (
        CheckConstraint("birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100", name="ck_birth_year"),
        # Si tu veux éviter les doublons d'identité (sensible à la casse selon la collation) :
        UniqueConstraint("nom", "prenom", "id_club", "birth_year", name="uq_nageur_identite"),
    )

    club = relationship("Club", back_populates="nageurs")
    # résultats individuels via la table enfant
    resultats_individuels = relationship("ResultatIndividuel", back_populates="nageur", cascade="all, delete-orphan")


class Categorie(db.Model):
    __tablename__ = "categorie"
    categorie_id = db.Column(db.BigInteger, primary_key=True)
    nom = db.Column(db.String(80), nullable=False, unique=True)
    max_places_indiv = db.Column(db.SmallInteger)
    max_places_relay = db.Column(db.SmallInteger)


class Epreuve(db.Model):
    __tablename__ = "epreuve"
    epreuve_id = db.Column(db.BigInteger, primary_key=True)
    nage = db.Column(db.String(40), nullable=False)       # 'Nage Libre','Papillon','Brasse','Dos','4 Nages'
    distance = db.Column(db.Integer, nullable=False)      # distance PAR relais pour les relais (ex: 50 pour 4x50)
    genre = db.Column(db.String(16), nullable=False)      # 'Dames' | 'Messieurs' | 'Mixte'
    is_relay = db.Column(db.Boolean, nullable=False, server_default="false")

    legs_count = db.Column(db.Integer)                    # NULL si individuel, 4/10 si relais
    __table_args__ = (
        CheckConstraint("genre in ('Dames','Messieurs','Mixte')", name="ck_epreuve_genre"),
        # Unicité incluant legs_count pour distinguer 4x50 vs 10x50
        UniqueConstraint("nage", "distance", "genre", "is_relay", "legs_count", name="uq_epreuve"),
        CheckConstraint(
            "(is_relay = FALSE AND legs_count IS NULL) OR (is_relay = TRUE AND legs_count IN (4,10))",
            name="ck_legs_count",
        ),
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

    champ_id = db.Column(
        db.BigInteger,
        db.ForeignKey("championnat.champ_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )
    epreuve_id = db.Column(
        db.BigInteger,
        db.ForeignKey("epreuve.epreuve_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )
    categorie_id = db.Column(
        db.BigInteger,
        db.ForeignKey("categorie.categorie_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("champ_id", "epreuve_id", "categorie_id", name="uq_cec"),
        Index("idx_cec_champ", "champ_id"),
        Index("idx_cec_epr", "epreuve_id"),
        Index("idx_cec_cat", "categorie_id"),
    )

    championnat = relationship("Championnat", back_populates="cecs")
    epreuve = relationship("Epreuve")
    categorie = relationship("Categorie")

    # accès pratiques
    resultats_base = relationship("ResultatBase", back_populates="cec", cascade="all, delete-orphan")
    equipes = relationship("Equipe", back_populates="cec", cascade="all, delete-orphan")


class Minimas(db.Model):
    __tablename__ = "minimas"
    min_id = db.Column(db.BigInteger, primary_key=True)
    epreuve_id = db.Column(
        db.BigInteger,
        db.ForeignKey("epreuve.epreuve_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )
    categorie_id = db.Column(
        db.BigInteger,
        db.ForeignKey("categorie.categorie_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )
    temp_min = db.Column(db.String(32), nullable=False)

    __table_args__ = (
        UniqueConstraint("epreuve_id", "categorie_id", name="uq_minimas"),
        Index("idx_minimas_lookup", "epreuve_id", "categorie_id"),
    )

    epreuve = relationship("Epreuve")
    categorie = relationship("Categorie")


# =========================
# Relais (équipe & membres)
# =========================

class Equipe(db.Model):
    __tablename__ = "equipe"
    equipe_id = db.Column(db.BigInteger, primary_key=True)
    cec_id = db.Column(
        db.BigInteger,
        db.ForeignKey("championnat_epreuve_categorie.cec_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )
    id_club = db.Column(
        db.BigInteger,
        db.ForeignKey("club.id_club", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("cec_id", "id_club", name="uq_equipe_cec_club"),)

    cec = relationship("CEC", back_populates="equipes")
    club = relationship("Club", back_populates="equipes")
    membres = relationship("EquipeMembre", back_populates="equipe", cascade="all, delete-orphan")
    # résultats relais via la table enfant
    resultats_relais = relationship("ResultatRelais", back_populates="equipe", cascade="all, delete-orphan")


class EquipeMembre(db.Model):
    __tablename__ = "equipe_membre"
    equipe_membre_id = db.Column(db.BigInteger, primary_key=True)
    equipe_id = db.Column(
        db.BigInteger,
        db.ForeignKey("equipe.equipe_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )
    nageur_id = db.Column(
        db.BigInteger,
        db.ForeignKey("nageur.id_nageur", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
    )
    leg_order = db.Column(db.Integer, nullable=False)
    split_time = db.Column(db.String(32))

    __table_args__ = (
        CheckConstraint("leg_order BETWEEN 1 AND 10", name="ck_leg_order"),
        UniqueConstraint("equipe_id", "leg_order", name="uq_equipe_ordre"),
        UniqueConstraint("equipe_id", "nageur_id", name="uq_equipe_nageur"),
        Index("idx_equipe_membre", "equipe_id", "leg_order"),
        Index("idx_equipe_membre_nageur", "nageur_id"),
    )

    equipe = relationship("Equipe", back_populates="membres")
    nageur = relationship("Nageur")


# ======================================
# Résultats : parent + deux sous-types
# ======================================

class ResultatBase(db.Model):
    __tablename__ = "resultat_base"
    resultat_id = db.Column(db.BigInteger, primary_key=True)
    cec_id = db.Column(
        db.BigInteger,
        db.ForeignKey("championnat_epreuve_categorie.cec_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )
    points = db.Column(db.Integer, nullable=False, server_default="0")
    place = db.Column(db.Integer)
    temps = db.Column(db.String(32))
    statut = db.Column(db.String(8), server_default="OK")  # 'OK','DSQ','DNS','DNF','NC'

    __table_args__ = (
        CheckConstraint("statut in ('OK','DSQ','DNS','DNF','NC')", name="ck_statut"),
        Index("idx_resultat_base_cec", "cec_id"),
        Index("idx_resultat_base_place", "cec_id", "place"),
    )

    cec = relationship("CEC", back_populates="resultats_base")
    # liens 1–1 vers les enfants
    resultat_individuel = relationship("ResultatIndividuel", back_populates="base", uselist=False, cascade="all, delete-orphan")
    resultat_relais = relationship("ResultatRelais", back_populates="base", uselist=False, cascade="all, delete-orphan")


class ResultatIndividuel(db.Model):
    __tablename__ = "resultat_individuel"
    resultat_id = db.Column(
        db.BigInteger,
        db.ForeignKey("resultat_base.resultat_id", ondelete="CASCADE"),
        primary_key=True,
    )
    id_nageur = db.Column(
        db.BigInteger,
        db.ForeignKey("nageur.id_nageur", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (Index("idx_res_indiv_nageur", "id_nageur"),)

    base = relationship("ResultatBase", back_populates="resultat_individuel")
    nageur = relationship("Nageur", back_populates="resultats_individuels")


class ResultatRelais(db.Model):
    __tablename__ = "resultat_relais"
    resultat_id = db.Column(
        db.BigInteger,
        db.ForeignKey("resultat_base.resultat_id", ondelete="CASCADE"),
        primary_key=True,
    )
    equipe_id = db.Column(
        db.BigInteger,
        db.ForeignKey("equipe.equipe_id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (Index("idx_res_relais_equipe", "equipe_id"),)

    base = relationship("ResultatBase", back_populates="resultat_relais")
    equipe = relationship("Equipe", back_populates="resultats_relais")


# =========================
# Utilisateurs
# =========================

class User(db.Model):
    __tablename__ = "user"

    user_id = db.Column(db.BigInteger, primary_key=True,autoincrement=True)
    nom = db.Column(db.String(120), nullable=False)
    prenom = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    mdp_hash = db.Column(db.String(255), nullable=False)  # bcrypt hash
    role = db.Column(db.String(16), nullable=False)       # 'admin' | 'coach'
    __table_args__ = (CheckConstraint("role in ('admin','coach')", name="ck_user_role"),)
