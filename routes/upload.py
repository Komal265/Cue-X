import os
import logging
import json
import threading
import numpy as np
import pandas as pd
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from services.ml_service import auto_cluster_rfm, rfm_segment_map
from services.model_optimizer import run_optimizer, apply_recommended_model
from services.session_store import UPLOAD_FOLDER, load_session
from config import settings

from database import get_connection
from models import insert_dataset, insert_customers, insert_model_metadata
from utils.auth import login_required

logger = logging.getLogger(__name__)

upload_bp = Blueprint('upload', __name__)
_optimizer_jobs: dict[int, dict] = {}
_optimizer_lock = threading.Lock()


def _optimizer_config() -> dict:
    return {
        "max_k":                 getattr(settings, "OPTIMIZER_MAX_K", 10),
        "improvement_threshold": getattr(settings, "OPTIMIZER_IMPROVEMENT_THRESHOLD", 0.02),
        "min_coverage":          getattr(settings, "OPTIMIZER_MIN_COVERAGE", 0.70),
        "max_tiny_ratio":        getattr(settings, "OPTIMIZER_MAX_TINY_CLUSTER_RATIO", 0.20),
        "min_cluster_size_ratio":getattr(settings, "OPTIMIZER_MIN_CLUSTER_SIZE_RATIO", 0.02),
        "bootstrap_repeats":     getattr(settings, "OPTIMIZER_BOOTSTRAP_REPEATS", 3),
        "bootstrap_sample_ratio":getattr(settings, "OPTIMIZER_BOOTSTRAP_SAMPLE_RATIO", 0.75),
    }


def _user_can_access_dataset(user_id: int, dataset_id: int) -> bool:
    with get_connection() as conn:
        if conn is None:
            return False
        row = conn.execute(
            text(
                """
                SELECT d.id
                FROM datasets d
                JOIN workspaces w ON d.workspace_id = w.id
                WHERE d.id = :dataset_id AND w.user_id = :user_id
                """
            ),
            {"dataset_id": dataset_id, "user_id": user_id},
        ).fetchone()
        return row is not None


def _run_optimizer_job(dataset_id: int) -> None:
    with _optimizer_lock:
        _optimizer_jobs[dataset_id] = {
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "dataset_id": dataset_id,
        }
    try:
        result = run_optimizer(dataset_id, _optimizer_config())
        result["finished_at"] = datetime.utcnow().isoformat()
        with _optimizer_lock:
            _optimizer_jobs[dataset_id] = result

        # Persist run metadata snapshot for audit/versioning.
        with get_connection() as conn:
            if conn is not None:
                insert_model_metadata(
                    conn,
                    dataset_id=dataset_id,
                    model_name="optimizer_v1",
                    parameters=json.dumps(result),
                    silhouette_score=(
                        result.get("winner", {}).get("silhouette")
                        if isinstance(result, dict)
                        else None
                    ),
                )
    except Exception as exc:
        with _optimizer_lock:
            _optimizer_jobs[dataset_id] = {
                "status": "failed",
                "dataset_id": dataset_id,
                "error": str(exc),
                "finished_at": datetime.utcnow().isoformat(),
            }
        logger.exception("[OPT] Optimizer job failed for dataset_id=%s", dataset_id)


def _queue_optimizer_job(dataset_id: int) -> None:
    with _optimizer_lock:
        _optimizer_jobs[dataset_id] = {
            "status": "queued",
            "dataset_id": dataset_id,
            "queued_at": datetime.utcnow().isoformat(),
        }
    threading.Thread(
        target=_run_optimizer_job,
        args=(dataset_id,),
        daemon=True,
    ).start()


def _normalize_col_name(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', str(name).strip().lower())


CANONICAL_ALIASES = {
    "customer_id": {
        "customerid", "customer", "customerkey", "customercode", "custid", "custno",
        "clientid", "clientno", "buyerid", "userid", "memberid"
    },
    "transaction_date": {
        "purchasedate", "transactiondate", "orderdate", "invoicedate", "date", "datetime",
        "billdate", "saledate"
    },
    "amount": {
        "totalprice", "amount", "totalsales", "sales", "revenue", "value", "spend",
        "netsales", "grosssales", "ordertotal"
    },
    "quantity": {"quantity", "qty", "units", "itemcount"},
    "unit_price": {"unitprice", "priceperitem", "price", "itemprice", "sellingprice"},
    "season": {"season"},
}


def _find_by_alias(columns, alias_set):
    for col in columns:
        if _normalize_col_name(col) in alias_set:
            return col
    return None


def _infer_numeric_column(df: pd.DataFrame, name_hints: tuple[str, ...]):
    for col in df.columns:
        norm = _normalize_col_name(col)
        if not any(hint in norm for hint in name_hints):
            continue
        numeric_ratio = pd.to_numeric(df[col], errors="coerce").notna().mean()
        if numeric_ratio >= 0.8:
            return col
    return None


def _infer_date_column(df: pd.DataFrame):
    for col in df.columns:
        norm = _normalize_col_name(col)
        if not any(hint in norm for hint in ("date", "time", "invoice", "order", "purchase")):
            continue
        parsed_ratio = pd.to_datetime(df[col], errors="coerce").notna().mean()
        if parsed_ratio >= 0.8:
            return col
    return None


def _infer_customer_column(df: pd.DataFrame):
    for col in df.columns:
        norm = _normalize_col_name(col)
        if not any(hint in norm for hint in ("customer", "cust", "client", "buyer", "user", "member")):
            continue
        non_null = df[col].notna().mean()
        if non_null >= 0.8:
            return col
    return None


def map_sales_columns(raw: pd.DataFrame):
    mapping = {}
    columns = list(raw.columns)

    for canonical, aliases in CANONICAL_ALIASES.items():
        mapped = _find_by_alias(columns, aliases)
        if mapped:
            mapping[canonical] = mapped

    if "customer_id" not in mapping:
        inferred = _infer_customer_column(raw)
        if inferred:
            mapping["customer_id"] = inferred

    if "transaction_date" not in mapping:
        inferred = _infer_date_column(raw)
        if inferred:
            mapping["transaction_date"] = inferred

    if "amount" not in mapping:
        inferred = _infer_numeric_column(raw, ("amount", "total", "sales", "revenue", "price", "value", "spend"))
        if inferred:
            mapping["amount"] = inferred

    missing = [field for field in ("customer_id", "transaction_date", "amount") if field not in mapping]
    if missing:
        available_columns = ", ".join(list(raw.columns))
        raise ValueError(
            "Could not map required sales fields: "
            f"{', '.join(missing)}. Required meaning is customer id, transaction date, and amount. "
            f"Available columns: {available_columns}"
        )

    standardized = raw.copy()
    standardized["customer_id"] = standardized[mapping["customer_id"]]
    standardized["transaction_date"] = standardized[mapping["transaction_date"]]

    amount_source = mapping.get("amount")
    if amount_source in {mapping.get("unit_price"), mapping.get("quantity")}:
        amount_source = None

    if amount_source:
        mapping["amount"] = amount_source
    elif mapping.get("quantity") and mapping.get("unit_price"):
        mapping["amount"] = "__derived_quantity_x_unit_price__"

    if "amount" in mapping and mapping["amount"] != "__derived_quantity_x_unit_price__":
        standardized["amount"] = pd.to_numeric(standardized[mapping["amount"]], errors="coerce")
    else:
        standardized["amount"] = np.nan

    quantity_col = mapping.get("quantity")
    unit_price_col = mapping.get("unit_price")
    if quantity_col:
        standardized["quantity"] = standardized[quantity_col]
    if unit_price_col:
        standardized["unit_price"] = standardized[unit_price_col]
    if (mapping.get("amount") == "__derived_quantity_x_unit_price__" or standardized["amount"].isna().all()) and quantity_col and unit_price_col:
        qty = pd.to_numeric(standardized[quantity_col], errors="coerce")
        unit_price = pd.to_numeric(standardized[unit_price_col], errors="coerce")
        standardized["amount"] = qty * unit_price

    if "season" in mapping:
        standardized["season"] = standardized[mapping["season"]]

    return standardized, mapping


def _build_fallback_segment_map(rfm_df: pd.DataFrame):
    """
    Build dynamic segment names from cluster behavior so labels remain meaningful
    when auto-selected k is not the same as the static map size.
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


def _validation_error(message: str, details: dict | None = None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return jsonify(payload), 400

@upload_bp.route('/')
def home():
    return jsonify({"status": "CUE-X API running", "version": "2.0-RFM"})


@upload_bp.route('/api/model-optimizer/status/<int:dataset_id>', methods=['GET'])
@login_required
def optimizer_status(user_id, dataset_id):
    if not _user_can_access_dataset(user_id, dataset_id):
        return jsonify({"error": "Dataset not found or unauthorized"}), 404

    with _optimizer_lock:
        job = _optimizer_jobs.get(dataset_id)
    if (
        isinstance(job, dict)
        and job.get("status") == "failed"
        and "no customer rows" in str(job.get("error", "")).lower()
    ):
        # Retry once if failure was caused by early read before rows became visible.
        with get_connection() as conn:
            if conn is not None:
                cnt = conn.execute(
                    text("SELECT COUNT(*) FROM customers WHERE dataset_id = :dataset_id"),
                    {"dataset_id": dataset_id},
                ).scalar()
                if cnt and int(cnt) > 0:
                    _queue_optimizer_job(dataset_id)
                    with _optimizer_lock:
                        job = _optimizer_jobs.get(dataset_id)
    if job:
        return jsonify(job), 200

    # Fallback: check persisted metadata if process restarted.
    with get_connection() as conn:
        if conn is None:
            return jsonify({"status": "unknown", "dataset_id": dataset_id}), 200
        row = conn.execute(
            text(
                """
                SELECT parameters, created_at
                FROM models_used
                WHERE dataset_id = :dataset_id AND model_name = 'optimizer_v1'
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"dataset_id": dataset_id},
        ).fetchone()
    if not row:
        return jsonify({"status": "queued", "dataset_id": dataset_id}), 200
    try:
        payload = json.loads(row[0]) if row[0] else {}
        if isinstance(payload, dict):
            if (
                payload.get("status") == "failed"
                and "no customer rows" in str(payload.get("error", "")).lower()
            ):
                with get_connection() as conn:
                    if conn is not None:
                        cnt = conn.execute(
                            text("SELECT COUNT(*) FROM customers WHERE dataset_id = :dataset_id"),
                            {"dataset_id": dataset_id},
                        ).scalar()
                        if cnt and int(cnt) > 0:
                            _queue_optimizer_job(dataset_id)
                            with _optimizer_lock:
                                running_job = _optimizer_jobs.get(dataset_id)
                            if running_job:
                                return jsonify(running_job), 200
            payload.setdefault("dataset_id", dataset_id)
            payload.setdefault("status", "done")
            payload.setdefault("persisted", True)
            return jsonify(payload), 200
    except Exception:
        pass
    return jsonify({"status": "done", "dataset_id": dataset_id, "persisted": True}), 200


@upload_bp.route('/api/model-optimizer/apply/<int:dataset_id>', methods=['POST'])
@login_required
def optimizer_apply(user_id, dataset_id):
    if not _user_can_access_dataset(user_id, dataset_id):
        return jsonify({"error": "Dataset not found or unauthorized"}), 404
    with _optimizer_lock:
        job = _optimizer_jobs.get(dataset_id)
    if not job:
        # Fallback to persisted optimizer result when app process restarted.
        with get_connection() as conn:
            if conn is None:
                return jsonify({"success": False, "message": "Database unavailable."}), 500
            row = conn.execute(
                text(
                    """
                    SELECT parameters
                    FROM models_used
                    WHERE dataset_id = :dataset_id AND model_name = 'optimizer_v1'
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                {"dataset_id": dataset_id},
            ).fetchone()
        if not row:
            return jsonify({"success": False, "status": "queued", "message": "Optimizer result not ready yet."}), 202
        try:
            job = json.loads(row[0]) if row[0] else {}
        except Exception:
            job = {}

    if job.get("status") != "done":
        return jsonify({"success": False, "status": job.get("status", "running"), "message": "Optimizer still running."}), 202

    if not job.get("recommend_upgrade"):
        return jsonify(
            {
                "success": True,
                "applied": False,
                "message": "No upgrade recommended. Baseline segmentation remains active.",
                "winner": job.get("winner"),
            }
        ), 200

    apply_result = apply_recommended_model(dataset_id, job)
    if not apply_result.get("success"):
        return jsonify(
            {
                "success": False,
                "applied": False,
                "message": apply_result.get("error", "Failed to apply optimized model."),
            }
        ), 500

    return jsonify(
        {
            "success": True,
            "applied": True,
            "message": "Updated segmentation is ready. Click 'Load Updated Results' to view changes.",
            "winner": job.get("winner"),
            "details": apply_result,
        }
    ), 200


# ── Upload & Segment ──────────────────────────────────────────────────────────
@upload_bp.route('/upload', methods=['POST'])
@login_required
def upload_file(user_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    workspace_id = request.form.get('workspace_id')
    if not workspace_id:
        return jsonify({'error': 'workspace_id is required'}), 400

    # Verify workspace belongs to user
    with get_connection() as conn:
        if conn is None:
            return jsonify({'error': 'Database connection failed'}), 500
        ws = conn.execute(
            text("SELECT id FROM workspaces WHERE id = :id AND user_id = :user_id"),
            {"id": workspace_id, "user_id": user_id}
        ).fetchone()
        if not ws:
            return jsonify({'error': 'Workspace not found or unauthorized'}), 403

    filename  = f"{datetime.now().timestamp()}_{file.filename}"
    filepath  = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # ── Load and map columns ──────────────────────────────────────────────
        raw = pd.read_csv(filepath)
        raw, column_mapping = map_sales_columns(raw)

        # Basic validation feedback
        invalid_counts = {
            "customer_id_null_rows":          int(raw["customer_id"].isna().sum()),
            "transaction_date_invalid_rows":  int(pd.to_datetime(raw["transaction_date"], errors="coerce").isna().sum()),
            "amount_invalid_rows":            int(pd.to_numeric(raw["amount"], errors="coerce").isna().sum()),
        }
        if raw["customer_id"].isna().all():
            return _validation_error("Mapped customer_id is empty for all rows.",
                                     {"column_mapping": column_mapping, "invalid_counts": invalid_counts})
        if pd.to_datetime(raw["transaction_date"], errors="coerce").isna().all():
            return _validation_error("Mapped transaction_date could not be parsed as dates.",
                                     {"column_mapping": column_mapping, "invalid_counts": invalid_counts})
        raw["amount"] = pd.to_numeric(raw["amount"], errors="coerce")
        if raw["amount"].isna().all():
            return _validation_error("Mapped amount is non-numeric or empty for all rows.",
                                     {"column_mapping": column_mapping, "invalid_counts": invalid_counts})

        # ── Create manual data_source entry ───────────────────────────────────
        source_id = None
        try:
            from models import insert_data_source
            with get_connection() as conn:
                if conn is not None:
                    source_id = insert_data_source(
                        conn,
                        workspace_id=int(workspace_id),
                        source_type="manual",
                        config={"original_filename": file.filename},
                        auto_sync_enabled=False,
                    )
        except Exception as src_err:
            logger.warning(f"[Upload] Could not create data_source entry: {src_err}")

        # ── Save output CSV for backward-compat download ───────────────────────
        session_id = datetime.now().strftime("%Y%m%d%H%M%S")

        # ── Run clustering pipeline ───────────────────────────────────────────
        from services.clustering_service import run_clustering
        result = run_clustering(
            df=raw,
            workspace_id=int(workspace_id),
            filename=file.filename,
            source_id=source_id,
            ingestion_type="manual",
        )

        # Save output CSV for /download endpoint (backward compat)
        output_path  = os.path.join(UPLOAD_FOLDER, 'output.csv')
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        raw.to_csv(output_path, index=False)
        raw.to_csv(session_path, index=False)

        return jsonify({
            'message':           'File processed successfully!',
            'download_url':      f'{getattr(settings, "BASE_URL", "http://localhost:10000")}/download',
            'session_id':        session_id,
            'visualization_url': f'/visualization/{session_id}',
            'total_customers':   result.get("total_customers"),
            'segments_found':    result.get("segments_found"),
            'selected_k':        result.get("selected_k"),
            'clustering_diag':   result.get("clustering_diag"),
            'column_mapping':    column_mapping,
            'dataset_id':        result.get("dataset_id"),
            'workspace_id':      workspace_id,
            'source_id':         source_id,
            'optimizer_status':  result.get("optimizer_status"),
        }), 200


    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Download ─────────────────────────────────────────────────────────────────
@upload_bp.route('/download')
@login_required
def download_file(user_id):
    # TODO: Could restrict download based on ownership
    output_path = os.path.join(UPLOAD_FOLDER, 'output.csv')
    if os.path.exists(output_path):
        return send_file(output_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404
