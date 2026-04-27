"""
models.py
---------
Thin helper functions for inserting data into the CUE-X PostgreSQL tables.

Each function accepts a live SQLAlchemy connection (from database.get_connection)
and returns the newly created primary-key id where applicable.
"""

import logging
from sqlalchemy import text
from datetime import datetime

logger = logging.getLogger(__name__)

def serialize_datetime(value):
    """Safely convert datetime to ISO format string."""
    return value.isoformat() if value else None

# ── users ──────────────────────────────────────────────────────────────────────
def create_user(conn, email: str, password_hash: str) -> int | None:
    try:
        result = conn.execute(
            text("INSERT INTO users (email, password_hash) VALUES (:email, :password_hash) RETURNING id"),
            {"email": email, "password_hash": password_hash}
        )
        return result.fetchone()[0]
    except Exception as exc:
        logger.error(f"[DB] create_user failed: {exc}")
        return None

def get_user_by_email(conn, email: str) -> dict | None:
    try:
        result = conn.execute(
            text("SELECT id, email, password_hash FROM users WHERE email = :email"),
            {"email": email}
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None
    except Exception as exc:
        logger.error(f"[DB] get_user_by_email failed: {exc}")
        return None

# ── workspaces ────────────────────────────────────────────────────────────────
def insert_workspace(conn, name: str, user_id: int) -> int | None:
    """
    Insert a new workspace.
    Returns the new workspace_id (int) or None on failure.
    """
    try:
        result = conn.execute(
            text("INSERT INTO workspaces (name, user_id) VALUES (:name, :user_id) RETURNING id"),
            {"name": name, "user_id": user_id},
        )
        workspace_id = result.fetchone()[0]
        logger.info(f"[DB] Workspace created: id={workspace_id}, name={name}, user_id={user_id}")
        return workspace_id
    except Exception as exc:
        logger.error(f"[DB] insert_workspace failed: {exc}")
        return None

def get_workspaces(conn, user_id: int):
    """List all workspaces for a specific user."""
    try:
        result = conn.execute(
            text("SELECT id, name, created_at FROM workspaces WHERE user_id = :user_id ORDER BY created_at DESC"),
            {"user_id": user_id}
        )
        rows = []
        for row in result.fetchall():
            d = dict(row._mapping)
            if 'created_at' in d:
                d['created_at'] = serialize_datetime(d['created_at'])
            rows.append(d)
        return rows
    except Exception as exc:
        logger.error(f"[DB] get_workspaces failed: {exc}")
        return []

# ── datasets ──────────────────────────────────────────────────────────────────
def get_datasets_by_workspace(conn, workspace_id: int):
    """List all datasets in a workspace."""
    try:
        result = conn.execute(
            text("SELECT id, filename, uploaded_at, row_count FROM datasets WHERE workspace_id = :ws_id ORDER BY uploaded_at DESC"),
            {"ws_id": workspace_id}
        )
        rows = []
        for row in result.fetchall():
            d = dict(row._mapping)
            if 'uploaded_at' in d:
                d['uploaded_at'] = serialize_datetime(d['uploaded_at'])
            rows.append(d)
        return rows
    except Exception as exc:
        logger.error(f"[DB] get_datasets_by_workspace failed: {exc}")
        return []

def insert_dataset(conn, filename: str, row_count: int, workspace_id: int = None) -> int | None:
    """
    Insert a record for the uploaded CSV file.
    Returns the new dataset_id (int) or None on failure.
    """
    try:
        result = conn.execute(
            text(
                "INSERT INTO datasets (filename, row_count, workspace_id) "
                "VALUES (:filename, :row_count, :workspace_id) RETURNING id"
            ),
            {"filename": filename, "row_count": row_count, "workspace_id": workspace_id},
        )
        dataset_id = result.fetchone()[0]
        logger.info(f"[DB] Dataset inserted: id={dataset_id}, file={filename}, ws={workspace_id}")
        return dataset_id
    except Exception as exc:
        logger.error(f"[DB] insert_dataset failed: {exc}")
        return None


# ── customers ─────────────────────────────────────────────────────────────────
def insert_customers(conn, rfm_df, dataset_id: int) -> bool:
    """
    Bulk-insert one row per customer from the clustered RFM DataFrame.
    Expected columns: Customer_ID, Recency, Frequency, Monetary,
                      Cluster, Segment_Name.
    Returns True on success, False on failure.
    """
    rows = [
        {
            "dataset_id":    dataset_id,
            "customer_id":   str(row["Customer_ID"]),
            "recency":       float(row["Recency"]),
            "frequency":     float(row["Frequency"]),
            "monetary":      float(row["Monetary"]),
            "cluster_id":    int(row["Cluster"]),
            "segment_label": str(row["Segment_Name"]),
            "season":        str(row["Season"]) if "Season" in row else None,
        }
        for _, row in rfm_df.iterrows()
    ]

    if not rows:
        logger.warning("[DB] insert_customers called with empty DataFrame.")
        return False

    try:
        conn.execute(
            text(
                "INSERT INTO customers "
                "(dataset_id, customer_id, recency, frequency, monetary, "
                " cluster_id, segment_label, season) "
                "VALUES (:dataset_id, :customer_id, :recency, :frequency, "
                "        :monetary, :cluster_id, :segment_label, :season)"
            ),
            rows,
        )
        logger.info(f"[DB] {len(rows)} customer(s) inserted for dataset_id={dataset_id}")
        return True
    except Exception as exc:
        logger.error(f"[DB] insert_customers failed: {exc}")
        return False


# ── models_used ───────────────────────────────────────────────────────────────
def insert_model_metadata(
    conn,
    dataset_id: int,
    model_name: str,
    parameters: str,
    silhouette_score: float,
) -> int | None:
    """
    Insert one record describing the clustering model used.
    Returns the new models_used.id or None on failure.
    """
    try:
        result = conn.execute(
            text(
                "INSERT INTO models_used "
                "(dataset_id, model_name, parameters, silhouette_score) "
                "VALUES (:dataset_id, :model_name, :parameters, :silhouette_score) "
                "RETURNING id"
            ),
            {
                "dataset_id":       dataset_id,
                "model_name":       model_name,
                "parameters":       parameters,
                "silhouette_score": float(silhouette_score) if silhouette_score is not None else None,
            },
        )
        model_row_id = result.fetchone()[0]
        sil_text = f"{float(silhouette_score):.4f}" if silhouette_score is not None else "None"
        logger.info(
            f"[DB] Model metadata inserted: id={model_row_id}, "
            f"model={model_name}, silhouette={sil_text}"
        )
        return model_row_id
    except Exception as exc:
        logger.error(f"[DB] insert_model_metadata failed: {exc}")
        return None
