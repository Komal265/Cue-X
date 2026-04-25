import os
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from services.ml_service import rfm_model, rfm_scaler, rfm_segment_map
from services.session_store import UPLOAD_FOLDER, load_session
from config import BASE_URL
from database import get_connection
from models import insert_dataset, insert_customers, insert_model_metadata
from utils.auth import login_required

logger = logging.getLogger(__name__)

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/')
def home():
    return jsonify({"status": "CUE-X API running", "version": "2.0-RFM"})


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
        ws = conn.execute(text("SELECT id FROM workspaces WHERE id = :id AND user_id = :user_id"), {"id": workspace_id, "user_id": user_id}).fetchone()
        if not ws:
            return jsonify({'error': 'Workspace not found or unauthorized'}), 403

    filename  = f"{datetime.now().timestamp()}_{file.filename}"
    filepath  = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # ── Step 1: Load ──────────────────────────────────────────────────────
        raw = pd.read_csv(filepath)

        required_columns = ['Customer_ID', 'Purchase_Date', 'Total_Price']
        for col in required_columns:
            if col not in raw.columns:
                return jsonify({'error': f'Missing required column: {col}'}), 400

        raw['Purchase_Date'] = pd.to_datetime(raw['Purchase_Date'])
        today = datetime.now()

        # ── Step 2: RFM feature engineering per customer ──────────────────────
        agg_dict = {
            'Recency': ('Purchase_Date', lambda x: (today - x.max()).days),
            'Frequency': ('Purchase_Date', 'count'),
            'Monetary': ('Total_Price', 'sum')
        }
        if 'Season' in raw.columns:
            agg_dict['Season'] = ('Season', lambda x: x.mode()[0] if not x.mode().empty else 'Unknown')

        rfm = raw.groupby('Customer_ID').agg(**agg_dict).reset_index()

        # ── Step 3: Scale & predict ───────────────────────────────────────────
        if rfm_scaler is None or rfm_model is None:
            return jsonify({'error': 'RFM model not loaded. Run train_rfm_model.py first.'}), 500

        rfm_features = ['Recency', 'Frequency', 'Monetary']
        rfm_scaled   = rfm_scaler.transform(rfm[rfm_features])
        rfm['Cluster'] = rfm_model.predict(rfm_scaled)

        # ── Step 4: RFM quintile scoring (1-5) ───────────────────────────────
        def score_quintile(series, ascending=True):
            pct = series.rank(method='average', pct=True, ascending=ascending)
            return np.ceil(pct * 5).clip(1, 5).astype(int)

        rfm['R_Score'] = score_quintile(rfm['Recency'],   ascending=False) # lower recency = better
        rfm['F_Score'] = score_quintile(rfm['Frequency'], ascending=True)  # higher freq = better
        rfm['M_Score'] = score_quintile(rfm['Monetary'],  ascending=True)  # higher monetary = better
        rfm['RFM_Score'] = rfm['R_Score'].astype(str) + rfm['F_Score'].astype(str) + rfm['M_Score'].astype(str)

        # ── Step 5: Map cluster → segment name ───────────────────────────────
        rfm['Segment_Name']      = rfm['Cluster'].apply(
            lambda c: rfm_segment_map.get(str(c), {}).get('Segment_Name', f'Segment {c}'))
        rfm['Campaign_Strategy'] = rfm['Cluster'].apply(
            lambda c: rfm_segment_map.get(str(c), {}).get('Campaign_Strategy', 'Standard engagement'))

        # ── Step 6: Merge back onto raw (row-level, one row per transaction) ──
        customer_df = raw.merge(
            rfm[['Customer_ID','Recency','Frequency','Monetary',
                  'R_Score','F_Score','M_Score','RFM_Score',
                  'Cluster','Segment_Name','Campaign_Strategy']],
            on='Customer_ID', how='left'
        )

        # Keep extra columns if present
        if 'Quantity' in customer_df.columns and 'Total_Price' in customer_df.columns:
            customer_df['Avg_Order_Value'] = (
                customer_df['Total_Price'] / customer_df['Quantity'].replace(0, 1)
            )

        # ── Step 7: Save outputs ──────────────────────────────────────────────
        output_path  = os.path.join(UPLOAD_FOLDER, 'output.csv')
        customer_df.to_csv(output_path, index=False)

        session_id   = datetime.now().strftime("%Y%m%d%H%M%S")
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        customer_df.to_csv(session_path, index=False)

        # ── Step 8: Persist to PostgreSQL (non-blocking) ──────────────────────
        dataset_id = None
        
        try:
            # Silhouette score — measures cluster quality (−1 to 1, higher is better)
            from sklearn.metrics import silhouette_score as sk_silhouette
            sil_score = None
            if len(rfm) > 1 and rfm['Cluster'].nunique() > 1:
                sil_score = float(sk_silhouette(rfm_scaled, rfm['Cluster']))

            with get_connection() as conn:
                if conn is not None:
                    dataset_id = insert_dataset(
                        conn,
                        filename=file.filename,
                        row_count=len(raw),
                        workspace_id=int(workspace_id) if workspace_id else None
                    )
                    if dataset_id:
                        insert_customers(conn, rfm, dataset_id)
                        insert_model_metadata(
                            conn,
                            dataset_id=dataset_id,
                            model_name='kmeans',
                            parameters=f'k={rfm_model.n_clusters}',
                            silhouette_score=sil_score,
                        )
        except Exception as db_err:
            logger.warning(f"[DB] Persistence skipped due to error: {db_err}")

        # BASE_URL from config is already imported, avoid shadowing
        return jsonify({
            'message':           'File processed successfully!',
            'download_url':      f'{BASE_URL}/download',
            'session_id':        session_id,
            'visualization_url': f'/visualization/{session_id}',
            'total_customers':   int(rfm['Customer_ID'].nunique()),
            'segments_found':    rfm['Segment_Name'].unique().tolist(),
            'dataset_id':        dataset_id,
            'workspace_id':      workspace_id
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
