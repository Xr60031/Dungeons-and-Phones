"""
Configuración de la base de datos SQLite usando SQLAlchemy.
La PC del DM es el servidor y dueño único de esta base de datos:
todo el estado de la campaña (personajes, monstruos, HP, iniciativa)
se persiste aquí entre sesiones.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./dungeons_and_phones.db"

# check_same_thread=False porque FastAPI puede usar múltiples hilos
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency de FastAPI para obtener una sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    Migración liviana para bases ya existentes: `create_all` no altera
    tablas que ya estaban creadas, así que si el .db es de antes de que
    existieran `condition`/`condition_rounds`, las agregamos a mano.
    """
    with engine.connect() as conn:
        existing_cols = {
            row[1] for row in conn.execute(text('PRAGMA table_info(characters)'))
        }
        if not existing_cols:
            return  # la tabla todavía no existe, create_all se encarga

        if "condition" not in existing_cols:
            conn.execute(
                text('ALTER TABLE characters ADD COLUMN "condition" VARCHAR DEFAULT \'Healthy\'')
            )
        if "condition_rounds" not in existing_cols:
            conn.execute(
                text('ALTER TABLE characters ADD COLUMN condition_rounds INTEGER')
            )
        if "temp_hp" not in existing_cols:
            conn.execute(
                text('ALTER TABLE characters ADD COLUMN temp_hp INTEGER DEFAULT 0')
            )
        if "armor_class" not in existing_cols:
            conn.execute(
                text('ALTER TABLE characters ADD COLUMN armor_class INTEGER DEFAULT 10')
            )
        if "condition_note" not in existing_cols:
            conn.execute(
                text('ALTER TABLE characters ADD COLUMN condition_note VARCHAR')
            )
        if "char_type" not in existing_cols:
            conn.execute(
                text("ALTER TABLE characters ADD COLUMN char_type VARCHAR DEFAULT 'player'")
            )
            # Migrar el flag viejo `is_monster` (booleano) al nuevo
            # `char_type` (con tres valores: player/npc/monster), para
            # no perder la categoría de los personajes ya guardados.
            if "is_monster" in existing_cols:
                conn.execute(
                    text("UPDATE characters SET char_type = 'monster' WHERE is_monster = 1")
                )
        conn.commit()
