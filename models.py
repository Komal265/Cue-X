"""
models.py
---------
Thin helper functions for inserting data into the CUE-X PostgreSQL tables.

Each function accepts a live SQLAlchemy connection (from database.get_connection)
and returns the newly created primary-key id where applicable.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


# ── datasets ──────────────────────────────────────────────────────────────────
def insert_dataset(conn, filename: str, row_count: int) -> int | None:
    """
    Insert a record for the uploaded CSV file.
    Returns the new dataset_id (int) or None on failure.
    """
    try:
        result = conn.execute(
            text(
                "INSERT INTO datasets (filename, row_count) "
                "VALUES (:filename, :row_count) RETURNING id"
            ),
            {"filename": filename, "row_count": row_count},
        )
        dataset_id = result.fetchone()[0]
        logger.info(f"[DB] Dataset inserted: id={dataset_id}, file={filename}")
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
                " cluster_id, segment_label) "
                "VALUES (:dataset_id, :customer_id, :recency, :frequency, "
                "        :monetary, :cluster_id, :segment_label)"
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
        logger.info(
            f"[DB] Model metadata inserted: id={model_row_id}, "
            f"model={model_name}, silhouette={silhouette_score:.4f}"
        )
        return model_row_id
    except Exception as exc:
        logger.error(f"[DB] insert_model_metadata failed: {exc}")
        return None
