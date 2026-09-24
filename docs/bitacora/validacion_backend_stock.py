"""
Validacion: stock producible del backend de Food Store vs. consulta original
(02_query_original.sql) vs. consulta canonica (04_consulta_canonica.sql).

- No modifica el backend: lo importa desde su carpeta.
- Solo lectura: la conexion usa default_transaction_read_only=on y la
  transaccion es REPEATABLE READ READ ONLY, se cierra con ROLLBACK.
- Las tres fuentes leen la MISMA instantanea (misma transaccion).

Uso (desde cualquier lado, con el python del venv del backend):
    <backend>/venv/Scripts/python.exe validacion_backend_stock.py
"""
import os
import sys
from pathlib import Path

BACKEND = Path(r"C:\Users\messi\OneDrive\Documentos\Proyectos\FoodStore-Backend-FastAPI")
SQL_DIR = Path(__file__).resolve().parents[2] / "openspec" / "changes" / "CH-16b-vistas-canonicas" / "sql"

os.chdir(BACKEND)  # para que pydantic-settings lea el .env del backend
sys.path.insert(0, str(BACKEND))

from sqlalchemy import create_engine, text  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.modules.product.service import ProductService  # noqa: E402


def load_sql(name: str) -> str:
    raw = (SQL_DIR / name).read_text(encoding="utf-8")
    # El SET search_path es del fixture (esquema foodstore); la base real usa public.
    lines = [l for l in raw.splitlines() if not l.strip().upper().startswith("SET SEARCH_PATH")]
    return "\n".join(lines).strip().rstrip(";")


def dump(title, cols, rows):
    print(f"\n### {title} ({len(rows)} filas)")
    print(" | ".join(cols))
    for r in rows:
        print(" | ".join("NULL" if v is None else str(v) for v in r))


engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"options": "-c default_transaction_read_only=on"},
)

with engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
    meta = conn.execute(text(
        "SELECT now(), current_database(), current_setting('transaction_isolation'), "
        "current_setting('transaction_read_only'), version()"
    )).one()
    print("### Transaccion")
    print(f"now()={meta[0]} db={meta[1]} isolation={meta[2]} read_only={meta[3]}")
    print(meta[4])

    # Universo: todo producto que tenga al menos una fila en product_ingredient.
    universe = conn.execute(text(
        "SELECT p.id, p.name, p.available, p.deleted_at, p.stock_quantity "
        "FROM product p WHERE EXISTS (SELECT 1 FROM product_ingredient pi WHERE pi.product_id = p.id) "
        "ORDER BY p.id"
    )).all()
    dump("Productos con receta (sin filtrar)", ["id", "name", "available", "deleted_at", "stock_quantity"], universe)

    recipe = conn.execute(text(
        "SELECT pi.product_id, pi.ingredient_id, i.name, pi.quantity, i.stock_quantity, i.deleted_at "
        "FROM product_ingredient pi JOIN ingredient i ON i.id = pi.ingredient_id "
        "ORDER BY pi.product_id, pi.ingredient_id"
    )).all()
    dump("Recetas (product_ingredient + ingredient, sin filtrar)",
         ["product_id", "ingredient_id", "ingredient", "quantity", "stock_quantity", "ingredient_deleted_at"], recipe)

    # Backend: ProductService.get_by_id -> _compute_available_stock, sesion atada
    # a la misma transaccion; el commit del UoW solo libera un savepoint.
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    backend = {}
    for pid, *_ in universe:
        backend[pid] = ProductService(session).get_by_id(pid).available_stock
    dump("Backend (ProductService.get_by_id(...).available_stock)", ["id", "available_stock"],
         sorted(backend.items()))

    res = conn.execute(text(load_sql("02_query_original.sql")))
    original = res.all()
    dump("02_query_original.sql (sin HAVING, sin SET search_path)", list(res.keys()), original)

    res = conn.execute(text(load_sql("04_consulta_canonica.sql")))
    canonica = res.all()
    dump("04_consulta_canonica.sql", list(res.keys()), canonica)

    orig_map = {int(r[0]): r[2] for r in original}
    can_map = {int(r[0]): r[2] for r in canonica}

    print("\n### Comparacion")
    print("| id | producto | available | deleted_at | backend | original | canonica | coinciden |")
    print("|---|---|---|---|---|---|---|---|")
    ids = sorted(set(backend) | set(orig_map) | set(can_map))
    names = {r[0]: r for r in universe}
    diffs = 0
    for pid in ids:
        u = names.get(pid)
        vals = [backend.get(pid), orig_map.get(pid), can_map.get(pid)]
        norm = [None if v is None else int(v) for v in vals]
        ok = norm[0] == norm[1] == norm[2]
        diffs += not ok
        shown = ["—" if v is None else str(v) for v in norm]
        print(f"| {pid} | {u[1] if u else '?'} | {u[2] if u else '?'} | {u[3] if u else '?'} | "
              f"{shown[0]} | {shown[1]} | {shown[2]} | {'si' if ok else 'NO'} |")
    print(f"\nFilas con diferencia: {diffs} de {len(ids)}")

    session.close()
    conn.rollback()
