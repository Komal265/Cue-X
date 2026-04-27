"""
services/clustering_service.py
-------------------------------
Reusable RFM clustering pipeline for Cue-X.

Call run_clustering() from:
  - routes/upload.py      (manual CSV upload)
  - routes/integrations.py (Google Sheets sync, webhook, manual refresh)
  - scheduler.py           (hourly auto-sync)
"""

import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime

from config import OPTIMIZER_ENABLED
from database import get_connection
from models import (
    insert_dataset, insert_customers, insert_model_metadata,
    update_data_source_sync_time,
)
from services.ml_service import auto_cluster_rfm, rfm_segment_map

logger = logging.getLogger(__name__)


def _build_archetype_segment_map(rfm_df: pd.DataFrame):
    """
    Build dynamic segment names from cluster behavior so labels remain meaningful
    when auto-selected k is not the same as the static map size.
    (Preserved from latest upload.py features)
    """
    if rfm_df.empty or "Cluster" not in rfm_df.columns:
        return {}

    cluster_profile = (
        rfm_df.groupby("Cluster", as_index=False)
        .agg(
            Recency=("Recency", "mean"),
            Frequency=("Frequency", "mean"),
            Monetary=("Monetary", "mean"),
        )
        .copy()
    )

    # Higher score means stronger customer value:
    # lower recency is better, higher frequency/monetary is better.
    cluster_profile["recency_rank"] = cluster_profile["Recency"].rank(method="dense", ascending=True)
    cluster_profile["frequency_rank"] = cluster_profile["Frequency"].rank(method="dense", ascending=True)
    cluster_profile["monetary_rank"] = cluster_profile["Monetary"].rank(method="dense", ascending=True)
    cluster_profile["composite"] = (
        cluster_profile["frequency_rank"] + cluster_profile["monetary_rank"] - cluster_profile["recency_rank"]
    )
    cluster_profile = cluster_profile.sort_values("composite", ascending=False).reset_index(drop=True)

    archetypes = [
        ("Champions", "Reward loyalty with VIP perks and premium upsells."),
        ("Loyal Customers", "Promote memberships, bundles, and referral incentives."),
        ("Potential Loyalists", "Nurture with personalized recommendations and reminders."),
        ("Promising", "Encourage second and third purchases with timed offers."),
        ("Needs Attention", "Run re-engagement nudges and value-driven campaigns."),
        ("At Risk", "Use win-back journeys with stronger urgency and incentives."),
    ]

    segment_map: dict[str, dict[str, str]] = {}
    for idx, row in cluster_profile.iterrows():
        cluster_id = str(int(row["Cluster"]))
        if idx < len(archetypes):
            name, strategy = archetypes[idx]
        else:
            name = f"Emerging Segment {idx - len(archetypes) + 1}"
            strategy = "Explore targeted experiments to refine this segment's lifecycle strategy."
        segment_map[cluster_id] = {
            "Segment_Name": name,
            "Campaign_Strategy": strategy,
        }

    return segment_map


def run_clustering(
    df: pd.DataFrame,
    workspace_id: int,
    filename: str,
    source_id: int = None,
    ingestion_type: str = "manual",
) -> dict:
    """
    Execute the full RFM clustering pipeline on a pre-loaded DataFrame.
    Supports auto-k selection and model optimizer queuing.
    """
    today = datetime.now()

    # ── Step 1: Cleaning ──────────────────────────────────────────────────────
    required_cols = {"customer_id", "transaction_date", "amount"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise ValueError(f"DataFrame is missing required columns: {missing}")

    df["transaction_date"] = pd.to_datetime(df["transaction_date"], errors="coerce")
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    original_len = len(df)
    df = df.dropna(subset=["customer_id", "transaction_date", "amount"]).copy()
    if df.empty:
        raise ValueError(f"No valid rows after cleaning (had {original_len} rows before).")

    # ── Step 2: RFM Aggregation ───────────────────────────────────────────────
    agg_dict = {
        "Recency":   ("transaction_date", lambda x: (today - x.max()).days),
        "Frequency": ("transaction_date", "count"),
        "Monetary":  ("amount", "sum"),
    }
    if "season" in df.columns:
        agg_dict["season"] = ("season", lambda x: x.mode()[0] if not x.mode().empty else "Unknown")

    rfm = df.groupby("customer_id").agg(**agg_dict).reset_index()

    # ── Step 3: Auto-select k and Cluster ─────────────────────────────────────
    rfm_features = ["Recency", "Frequency", "Monetary"]
    labels, active_scaler, active_model, clustering_diag = auto_cluster_rfm(
        rfm_df=rfm,
        feature_cols=rfm_features,
        min_k=2,
        max_k=10,
        random_state=42,
    )
    rfm["Cluster"] = labels
    selected_k = int(clustering_diag.get("selected_k", max(1, rfm["Cluster"].nunique())))
    
    # ── Step 4: Map cluster → segment name ────────────────────────────────────
    map_keys = set(rfm_segment_map.keys())
    if selected_k == len(map_keys) and map_keys == {str(i) for i in range(selected_k)}:
        active_segment_map = rfm_segment_map
    else:
        active_segment_map = _build_archetype_segment_map(rfm)

    rfm["Segment_Name"] = rfm["Cluster"].apply(
        lambda c: active_segment_map.get(str(c), {}).get("Segment_Name", f"Segment {c}")
    )
    rfm["Campaign_Strategy"] = rfm["Cluster"].apply(
        lambda c: active_segment_map.get(str(c), {}).get("Campaign_Strategy", "Standard engagement")
    )

    # ── Step 5: RFM quintile scoring (1-5) ────────────────────────────────────
    def score_quintile(series, ascending=True):
        pct = series.rank(method="average", pct=True, ascending=ascending)
        return np.ceil(pct * 5).clip(1, 5).astype(int)

    rfm["R_Score"] = score_quintile(rfm["Recency"],   ascending=False)
    rfm["F_Score"] = score_quintile(rfm["Frequency"], ascending=True)
    rfm["M_Score"] = score_quintile(rfm["Monetary"],  ascending=True)
    rfm["RFM_Score"] = rfm["R_Score"].astype(str) + rfm["F_Score"].astype(str) + rfm["M_Score"].astype(str)

    # ── Step 6: Silhouette score ──────────────────────────────────────────────
    sil_score = clustering_diag.get("silhouette_score")
    if sil_score is None and len(rfm) > 1 and rfm["Cluster"].nunique() > 1:
        try:
            from sklearn.metrics import silhouette_score as sk_silhouette
            rfm_scaled = active_scaler.transform(rfm[rfm_features])
            sil_score = float(sk_silhouette(rfm_scaled, rfm["Cluster"]))
        except Exception:
            pass

    # ── Step 7: Persist to DB ─────────────────────────────────────────────────
    dataset_id = None
    optimizer_status = "disabled"
    should_queue_optimizer = False
    
    try:
        with get_connection() as conn:
            if conn is not None:
                dataset_id = insert_dataset(
                    conn,
                    filename=filename,
                    row_count=len(df),
                    workspace_id=workspace_id,
                    source_id=source_id,
                    ingestion_type=ingestion_type,
                )
                if dataset_id:
                    rfm_db = rfm.rename(columns={"customer_id": "Customer_ID", "season": "Season"})
                    insert_customers(conn, rfm_db, dataset_id)
                    insert_model_metadata(
                        conn,
                        dataset_id=dataset_id,
                        model_name="kmeans",
                        parameters=(
                            f'k={selected_k};selection={clustering_diag.get("selection_method")};'
                            f'elbow_k={clustering_diag.get("elbow_k")}'
                        ),
                        silhouette_score=sil_score,
                    )
                    if source_id:
                        update_data_source_sync_time(conn, source_id)
                    
                    if OPTIMIZER_ENABLED:
                        optimizer_status = "queued"
                        should_queue_optimizer = True
    except Exception as db_err:
        logger.warning(f"[Clustering] DB persistence error: {db_err}")

    # Queue optimizer job if needed
    if should_queue_optimizer and dataset_id:
        try:
            from routes.upload import _queue_optimizer_job
            _queue_optimizer_job(dataset_id)
        except Exception as opt_err:
            logger.warning(f"[Clustering] Could not queue optimizer: {opt_err}")

    return {
        "dataset_id":      dataset_id,
        "total_customers": int(rfm["customer_id"].nunique()),
        "segments_found":  rfm["Segment_Name"].unique().tolist(),
        "selected_k":        selected_k,
        "optimizer_status":  optimizer_status,
        "clustering_diag":   clustering_diag,
    }

