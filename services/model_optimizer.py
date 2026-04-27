import json
import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, DBSCAN, KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler

from database import get_connection
from sqlalchemy import text
from models import insert_model_metadata

logger = logging.getLogger(__name__)


def _safe_silhouette(X: np.ndarray, labels: np.ndarray) -> float | None:
    valid = labels != -1
    if valid.sum() < 3:
        return None
    unique = np.unique(labels[valid])
    if len(unique) < 2:
        return None
    try:
        return float(silhouette_score(X[valid], labels[valid]))
    except Exception:
        return None


def _cluster_usability(labels: np.ndarray, min_cluster_size_ratio: float) -> tuple[float, float, int]:
    n = len(labels)
    if n == 0:
        return 0.0, 1.0, 0
    valid = labels != -1
    coverage = float(valid.sum()) / float(n)
    if valid.sum() == 0:
        return coverage, 1.0, 0

    unique, counts = np.unique(labels[valid], return_counts=True)
    min_size = max(2, int(np.ceil(n * min_cluster_size_ratio)))
    tiny_points = int(sum(c for c in counts if c < min_size))
    tiny_ratio = float(tiny_points) / float(n)
    return coverage, tiny_ratio, int(len(unique))


def _normalized_score(silhouette: float | None, stability: float | None, coverage: float, tiny_ratio: float) -> float:
    sil_norm = ((silhouette + 1.0) / 2.0) if silhouette is not None else 0.0
    stab = stability if stability is not None else 0.0
    usability = max(0.0, min(1.0, coverage - tiny_ratio))
    return float(0.55 * sil_norm + 0.25 * stab + 0.20 * usability)


def _fetch_rfm_matrix(dataset_id: int) -> tuple[np.ndarray, np.ndarray] | None:
    with get_connection() as conn:
        if conn is None:
            return None
        rows = conn.execute(
            text(
                """
                SELECT recency, frequency, monetary, cluster_id
                FROM customers
                WHERE dataset_id = :dataset_id
                """
            ),
            {"dataset_id": dataset_id},
        ).fetchall()
    if not rows:
        return None
    X = np.array([[float(r[0]), float(r[1]), float(r[2])] for r in rows], dtype=float)
    baseline_labels = np.array([int(r[3]) if r[3] is not None else -1 for r in rows], dtype=int)
    return X, baseline_labels


def _fetch_rfm_rows(dataset_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return []
        rows = conn.execute(
            text(
                """
                SELECT customer_id, recency, frequency, monetary
                FROM customers
                WHERE dataset_id = :dataset_id
                ORDER BY customer_id
                """
            ),
            {"dataset_id": dataset_id},
        ).fetchall()
    return [
        {
            "customer_id": str(r[0]),
            "recency": float(r[1]),
            "frequency": float(r[2]),
            "monetary": float(r[3]),
        }
        for r in rows
    ]


def _fit_predict_candidate(model_name: str, params: dict[str, Any], X: np.ndarray) -> np.ndarray:
    if model_name == "kmeans":
        k = int(params.get("k", 4))
        model = KMeans(n_clusters=k, random_state=42, n_init=10)
        return model.fit_predict(X)
    if model_name == "gmm":
        k = int(params.get("k", 4))
        model = GaussianMixture(n_components=k, random_state=42)
        return model.fit_predict(X)
    if model_name == "agglomerative":
        k = int(params.get("k", 4))
        model = AgglomerativeClustering(n_clusters=k)
        return model.fit_predict(X)
    if model_name == "dbscan":
        eps = float(params.get("eps", 0.5))
        min_samples = int(params.get("min_samples", 5))
        model = DBSCAN(eps=eps, min_samples=min_samples)
        return model.fit_predict(X)
    raise ValueError(f"Unsupported winner model: {model_name}")


def _build_segment_name_map(labels: np.ndarray, X_raw: np.ndarray) -> dict[int, str]:
    df = pd.DataFrame(
        {
            "Cluster": labels,
            "Recency": X_raw[:, 0],
            "Frequency": X_raw[:, 1],
            "Monetary": X_raw[:, 2],
        }
    )
    if df.empty:
        return {}

    mapping: dict[int, str] = {}
    if (df["Cluster"] == -1).any():
        mapping[-1] = "Noise / Unassigned"

    non_noise = df[df["Cluster"] != -1]
    if non_noise.empty:
        return mapping

    cluster_profile = (
        non_noise.groupby("Cluster", as_index=False)
        .agg(
            Recency=("Recency", "mean"),
            Frequency=("Frequency", "mean"),
            Monetary=("Monetary", "mean"),
        )
        .copy()
    )
    cluster_profile["recency_rank"] = cluster_profile["Recency"].rank(method="dense", ascending=True)
    cluster_profile["frequency_rank"] = cluster_profile["Frequency"].rank(method="dense", ascending=True)
    cluster_profile["monetary_rank"] = cluster_profile["Monetary"].rank(method="dense", ascending=True)
    cluster_profile["composite"] = (
        cluster_profile["frequency_rank"] + cluster_profile["monetary_rank"] - cluster_profile["recency_rank"]
    )
    cluster_profile = cluster_profile.sort_values("composite", ascending=False).reset_index(drop=True)

    names = [
        "Champions",
        "Loyal Customers",
        "Potential Loyalists",
        "Promising",
        "Needs Attention",
        "At Risk",
    ]
    for idx, row in cluster_profile.iterrows():
        cluster_id = int(row["Cluster"])
        mapping[cluster_id] = names[idx] if idx < len(names) else f"Emerging Segment {idx - len(names) + 1}"
    return mapping


def run_optimizer(dataset_id: int, config: dict[str, Any]) -> dict[str, Any]:
    data = _fetch_rfm_matrix(dataset_id)
    if data is None:
        return {"status": "failed", "error": "Dataset has no customer rows."}
    X_raw, baseline_labels = data
    if len(X_raw) < 10:
        return {"status": "failed", "error": "Not enough customers for model optimization."}

    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    min_cov = float(config.get("min_coverage", 0.80))
    max_tiny = float(config.get("max_tiny_ratio", 0.20))
    min_size_ratio = float(config.get("min_cluster_size_ratio", 0.02))
    improvement_threshold = float(config.get("improvement_threshold", 0.05))
    max_k = min(int(config.get("max_k", 8)), max(2, len(X) - 1))

    baseline_sil = _safe_silhouette(X, baseline_labels)
    base_cov, base_tiny, base_clusters = _cluster_usability(baseline_labels, min_size_ratio)
    baseline_score = _normalized_score(baseline_sil, 0.8, base_cov, base_tiny)

    candidates: list[dict[str, Any]] = []

    def record_candidate(name: str, params: dict[str, Any], labels: np.ndarray, stability: float | None) -> None:
        sil = _safe_silhouette(X, labels)
        cov, tiny, n_clusters = _cluster_usability(labels, min_size_ratio)
        score = _normalized_score(sil, stability, cov, tiny)
        guardrails_ok = (cov >= min_cov) and (tiny <= max_tiny) and (n_clusters >= 2)
        candidates.append(
            {
                "model": name,
                "params": params,
                "silhouette": sil,
                "stability": stability,
                "coverage": cov,
                "tiny_cluster_ratio": tiny,
                "n_clusters": n_clusters,
                "composite_score": score,
                "guardrails_ok": guardrails_ok,
            }
        )

    # KMeans / GMM / Agglomerative sweep
    for k in range(2, max_k + 1):
        try:
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = km.fit_predict(X)
            labels2 = KMeans(n_clusters=k, random_state=7, n_init=10).fit_predict(X)
            record_candidate("kmeans", {"k": k}, labels, float(adjusted_rand_score(labels, labels2)))
        except Exception as exc:
            logger.warning("[OPT] KMeans k=%s failed: %s", k, exc)

        try:
            gmm = GaussianMixture(n_components=k, random_state=42)
            labels = gmm.fit_predict(X)
            labels2 = GaussianMixture(n_components=k, random_state=7).fit_predict(X)
            record_candidate("gmm", {"k": k}, labels, float(adjusted_rand_score(labels, labels2)))
        except Exception as exc:
            logger.warning("[OPT] GMM k=%s failed: %s", k, exc)

        try:
            agg = AgglomerativeClustering(n_clusters=k)
            labels = agg.fit_predict(X)
            # deterministic algorithm, treat as fully stable.
            record_candidate("agglomerative", {"k": k}, labels, 1.0)
        except Exception as exc:
            logger.warning("[OPT] Agglomerative k=%s failed: %s", k, exc)

    # DBSCAN sweep
    for eps in (0.3, 0.5, 0.7, 1.0):
        for min_samples in (5, 10, 15):
            try:
                db = DBSCAN(eps=eps, min_samples=min_samples)
                labels = db.fit_predict(X)
                # deterministic with fixed params.
                record_candidate("dbscan", {"eps": eps, "min_samples": min_samples}, labels, 1.0)
            except Exception as exc:
                logger.warning("[OPT] DBSCAN eps=%s min_samples=%s failed: %s", eps, min_samples, exc)

    if not candidates:
        return {"status": "failed", "error": "No model candidates could be evaluated."}

    best_candidate = max(candidates, key=lambda c: c["composite_score"])
    best_viable = [c for c in candidates if c["guardrails_ok"]]
    best_guarded = max(best_viable, key=lambda c: c["composite_score"]) if best_viable else None

    winner = best_guarded if best_guarded is not None else best_candidate
    score_gain = float(winner["composite_score"] - baseline_score)
    # Product rule: baseline is already KMeans, so avoid "upgrade" loops when
    # optimizer also picks KMeans again.
    if winner.get("model") == "kmeans":
        recommend_upgrade = False
    else:
        recommend_upgrade = bool(winner["guardrails_ok"] and score_gain >= improvement_threshold)

    result = {
        "status": "done",
        "dataset_id": dataset_id,
        "baseline": {
            "model": "kmeans_stage1",
            "silhouette": baseline_sil,
            "coverage": base_cov,
            "tiny_cluster_ratio": base_tiny,
            "n_clusters": base_clusters,
            "composite_score": baseline_score,
        },
        "winner": winner,
        "recommend_upgrade": recommend_upgrade,
        "score_gain": score_gain,
        "recommendation_reason": (
            "winner_is_kmeans_same_as_baseline"
            if winner.get("model") == "kmeans"
            else "score_and_guardrails_passed" if recommend_upgrade else "threshold_or_guardrails_not_met"
        ),
        "improvement_threshold": improvement_threshold,
        "candidates_evaluated": len(candidates),
        "top_candidates": sorted(candidates, key=lambda c: c["composite_score"], reverse=True)[:5],
    }
    return json.loads(json.dumps(result, default=float))


def apply_recommended_model(dataset_id: int, optimizer_result: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(optimizer_result, dict):
        return {"success": False, "error": "Invalid optimizer result payload."}
    if optimizer_result.get("status") != "done":
        return {"success": False, "error": "Optimizer result is not completed yet."}
    if not optimizer_result.get("recommend_upgrade"):
        return {"success": False, "error": "No upgrade recommended."}

    winner = optimizer_result.get("winner") or {}
    model_name = winner.get("model")
    params = winner.get("params") or {}
    if not model_name:
        return {"success": False, "error": "Winner model is missing."}

    rows = _fetch_rfm_rows(dataset_id)
    if not rows:
        return {"success": False, "error": "No customer rows available for apply."}

    X_raw = np.array([[r["recency"], r["frequency"], r["monetary"]] for r in rows], dtype=float)
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)
    labels = _fit_predict_candidate(model_name, params, X)
    segment_map = _build_segment_name_map(labels, X_raw)

    updates = [
        {
            "dataset_id": dataset_id,
            "customer_id": str(row["customer_id"]),
            "cluster_id": int(label),
            "segment_label": segment_map.get(int(label), f"Segment {int(label)}"),
        }
        for row, label in zip(rows, labels)
    ]

    with get_connection() as conn:
        if conn is None:
            return {"success": False, "error": "Database connection failed."}
        conn.execute(
            text(
                """
                UPDATE customers
                SET cluster_id = :cluster_id, segment_label = :segment_label
                WHERE dataset_id = :dataset_id AND customer_id = :customer_id
                """
            ),
            updates,
        )
        insert_model_metadata(
            conn,
            dataset_id=dataset_id,
            model_name=f"applied_{model_name}",
            parameters=json.dumps({"winner": winner, "applied_at": "manual"}),
            silhouette_score=winner.get("silhouette"),
        )

    return {
        "success": True,
        "applied_model": model_name,
        "updated_customers": len(updates),
        "segment_count": int(len(np.unique(labels))),
    }
