from flask import Blueprint, jsonify, make_response
import pandas as pd
from database import get_connection, text
from utils.auth import login_required
from services.cache import get_cache, set_cache

charts_bp = Blueprint('charts', __name__)

def get_customers_df(dataset_id, user_id):
    """Helper to fetch customers from DB and return a DataFrame, ensuring ownership."""
    with get_connection() as conn:
        if conn is None:
            return None, "Database connection failed"
        try:
            # Check ownership via workspace
            res = conn.execute(text("""
                SELECT d.id FROM datasets d
                JOIN workspaces w ON d.workspace_id = w.id
                WHERE d.id = :id AND w.user_id = :user_id
            """), {"id": dataset_id, "user_id": user_id}).fetchone()
            
            if not res:
                return None, "Dataset not found or unauthorized"

            result = conn.execute(
                text("SELECT * FROM customers WHERE dataset_id = :id"),
                {"id": dataset_id}
            )
            rows = [dict(row._mapping) for row in result.fetchall()]
            if not rows:
                return None, f"No data found for dataset {dataset_id}"
            return pd.DataFrame(rows), None
        except Exception as e:
            return None, str(e)

# ── Segment Counts ────────────────────────────────────────────────────────────
@charts_bp.route('/api/segment-counts/<int:dataset_id>')
@login_required
def segment_counts(user_id, dataset_id):
    cache_key = f"dashboard:{dataset_id}:segment_counts"
    cached = get_cache(cache_key)
    if cached:
        response = make_response(jsonify(cached))
        response.headers["X-Cache"] = "HIT"
        return response

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404
    try:
        counts = df['segment_label'].value_counts().to_dict()
        res = {'labels': list(counts.keys()), 'values': list(counts.values())}
        set_cache(cache_key, res, ttl=600)
        response = make_response(jsonify(res))
        response.headers["X-Cache"] = "MISS"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Spending by Segment ───────────────────────────────────────────────────────
@charts_bp.route('/api/spending-by-segment/<int:dataset_id>')
@login_required
def spending_by_segment(user_id, dataset_id):
    cache_key = f"dashboard:{dataset_id}:spending_by_segment"
    cached = get_cache(cache_key)
    if cached:
        response = make_response(jsonify(cached))
        response.headers["X-Cache"] = "HIT"
        return response

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404
    try:
        avg_spend = df.groupby('segment_label')['monetary'].mean().to_dict()
        res = {'labels': list(avg_spend.keys()), 'values': list(avg_spend.values())}
        set_cache(cache_key, res, ttl=600)
        response = make_response(jsonify(res))
        response.headers["X-Cache"] = "MISS"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Recency / Monetary Scatter ────────────────────────────────────────────────
@charts_bp.route('/api/recency-value-scatter/<int:dataset_id>')
@login_required
def recency_value_scatter(user_id, dataset_id):
    cache_key = f"dashboard:{dataset_id}:recency_value_scatter"
    cached = get_cache(cache_key)
    if cached:
        response = make_response(jsonify(cached))
        response.headers["X-Cache"] = "HIT"
        return response

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404
    try:
        result = []
        for seg in df['segment_label'].unique():
            seg_df = df[df['segment_label'] == seg]
            result.append({
                'name': seg,
                'data': seg_df[['recency', 'monetary', 'customer_id']].values.tolist()
            })
        set_cache(cache_key, result, ttl=600)
        response = make_response(jsonify(result))
        response.headers["X-Cache"] = "MISS"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Seasonal Distribution ─────────────────────────────────────────────────────
@charts_bp.route('/api/seasonal-distribution/<int:dataset_id>')
@login_required
def seasonal_distribution(user_id, dataset_id):
    cache_key = f"dashboard:{dataset_id}:seasonal_distribution"
    cached = get_cache(cache_key)
    if cached:
        response = make_response(jsonify(cached))
        response.headers["X-Cache"] = "HIT"
        return response

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404
    try:
        if 'season' not in df.columns or df['season'].isnull().all():
            return jsonify({'labels': [], 'datasets': []})
        
        # In DB, column names are lowercase
        counts = df.groupby(['season', 'segment_label']).size().unstack(fill_value=0)
        labels = counts.index.tolist()
        datasets = [{'label': col, 'data': counts[col].tolist()} for col in counts.columns]
        res = {'labels': labels, 'datasets': datasets}
        set_cache(cache_key, res, ttl=600)
        response = make_response(jsonify(res))
        response.headers["X-Cache"] = "MISS"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── RFM Scores per Segment (heatmap data) ─────────────────────────────────────
@charts_bp.route('/api/rfm-scores/<int:dataset_id>')
@login_required
def rfm_scores(user_id, dataset_id):
    cache_key = f"dashboard:{dataset_id}:rfm_scores"
    cached = get_cache(cache_key)
    if cached:
        response = make_response(jsonify(cached))
        response.headers["X-Cache"] = "HIT"
        return response

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404
    try:
        # Calculate scores 1-5 based on quintiles
        df['R_Score'] = pd.qcut(df['recency'], 5, labels=[5, 4, 3, 2, 1]).astype(int)
        df['F_Score'] = pd.qcut(df['frequency'].rank(method='first'), 5, labels=[1, 2, 3, 4, 5]).astype(int)
        df['M_Score'] = pd.qcut(df['monetary'], 5, labels=[1, 2, 3, 4, 5]).astype(int)

        scores = df.groupby('segment_label').agg(
            R_Score=('R_Score', 'mean'),
            F_Score=('F_Score', 'mean'),
            M_Score=('M_Score', 'mean'),
            Recency=('recency', 'mean'),
            Frequency=('frequency', 'mean'),
            Monetary=('monetary', 'mean'),
            Count=('customer_id', 'count')
        ).reset_index()
        
        scores = scores.rename(columns={'segment_label': 'Segment_Name'})
        res = scores.to_dict(orient='records')
        set_cache(cache_key, res, ttl=600)
        response = make_response(jsonify(res))
        response.headers["X-Cache"] = "MISS"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500
