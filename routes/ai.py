import json
import re
import pandas as pd
import numpy as np
from flask import Blueprint, request, jsonify
from services.session_store import load_session
from services.gemini_service import gemini_client, gemini_generate
from services.ml_service import rfm_segment_map

from database import get_connection, text
from utils.auth import login_required

ai_bp = Blueprint('ai', __name__)

def get_customers_df(dataset_id, user_id):
    """Helper to fetch customers from DB and return a DataFrame, ensuring ownership."""
    with get_connection() as conn:
        if conn is None:
            return None, "Database connection failed"
        try:
            # Check ownership
            res = conn.execute(text("""
                SELECT d.id FROM datasets d
                JOIN workspaces w ON d.workspace_id = w.id
                WHERE d.id = :id AND w.user_id = :user_id
            """), {"id": dataset_id, "user_id": user_id}).fetchone()
            
            if not res:
                return None, "Dataset not found or unauthorized"

            result = conn.execute(
                text("SELECT customer_id as \"Customer_ID\", recency as \"Recency\", frequency as \"Frequency\", monetary as \"Monetary\", segment_label as \"Segment_Name\", season as \"Season\", cluster_id as \"Cluster\" FROM customers WHERE dataset_id = :id"),
                {"id": dataset_id}
            )
            rows = [dict(row._mapping) for row in result.fetchall()]
            if not rows:
                return None, f"No data found for dataset {dataset_id}"
            return pd.DataFrame(rows), None
        except Exception as e:
            return None, str(e)

# ── RAG Chat — Ask Your Data ──────────────────────────────────────────────────
@ai_bp.route('/api/chat', methods=['POST'])
@login_required
def chat_query(user_id):
    body       = request.get_json(silent=True) or {}
    dataset_id = body.get('dataset_id')
    question   = body.get('question', '').strip()

    if not question:
        return jsonify({'error': 'Question is required'}), 400
    if not dataset_id:
        return jsonify({'error': 'Dataset ID is required'}), 400

    per_customer, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404

    # ── Build rich context for Gemini ─────────────────────────────────────────
    schema_info = {col: str(per_customer[col].dtype) for col in per_customer.columns}
    sample_rows = per_customer.head(3).to_dict(orient='records')

    # Pre-compute segment stats to always give Gemini real numbers
    try:
        seg_stats = per_customer.groupby('Segment_Name').agg(
            Count=('Customer_ID', 'count'),
            AvgMonetary=('Monetary', 'mean'),
            AvgRecency=('Recency', 'mean'),
            AvgFrequency=('Frequency', 'mean'),
        ).reset_index()
        seg_stats_dict = seg_stats.to_dict(orient='records')
        total_customers = int(len(per_customer))
        total_revenue   = float(per_customer['Monetary'].sum())
    except Exception:
        seg_stats_dict = []
        total_customers = int(len(per_customer))
        total_revenue   = 0.0

    # Classify: is this a data/numbers question, advisory, or compound?
    DATA_KEYWORDS = [
        'how many', 'count', 'total', 'average', 'avg', 'mean', 'max', 'min',
        'sum', 'top', 'bottom', 'list', 'show', 'which customers', 'who',
        'percentage', 'percent', '%', 'days', 'purchased', 'spent', 'spend',
        'recency', 'frequency', 'monetary', 'revenue', 'orders', 'products',
        'season', 'highest', 'lowest',
    ]
    ADVISORY_KEYWORDS = [
        'how can', 'how do', 'how to', 'what should', 'what can', 'convert',
        'improve', 'increase', 'grow', 'strategy', 'recommend', 'suggest',
        'win back', 'retain', 'engage', 'boost', 'reduce churn', 'turn into',
    ]
    q_lower = question.lower()
    is_data_question     = any(kw in q_lower for kw in DATA_KEYWORDS)
    is_advisory_question = any(kw in q_lower for kw in ADVISORY_KEYWORDS)
    # Compound = has BOTH data and advisory intent (e.g. "how many X AND how to convert them")
    is_compound_question = is_data_question and is_advisory_question

    # ── Gemini-powered path ────────────────────────────────────────────────────
    if gemini_client:

        # ── Path A0: Compound question (data + advisory) ───────────────────────
        if is_compound_question:
            try:
                compound_prompt = f"""You are an expert marketing analyst and CRM strategist.
The user has a customer segmentation dataset for an e-commerce brand with {total_customers:,} customers.
Total lifetime revenue: ${total_revenue:,.0f}.

Segment breakdown (with real metrics):
{json.dumps(seg_stats_dict, indent=2, default=str)}

The user asks: "{question}"

Answer in two clear parts:
1. Give the exact numbers they asked about (reference the segment data above).
2. Give 3 concrete, actionable steps to achieve what they asked (e.g. convert at-risk to champions).
Use bullet points for the steps. Reference real numbers from the data. Keep the total answer under 120 words.
Do NOT mention pandas, dataframes, or code."""
                answer = gemini_generate(compound_prompt)
                return jsonify({
                    'answer':     answer,
                    'data':       seg_stats_dict,
                    'query':      None,
                    'powered_by': 'gemini',
                })
            except Exception as e:
                print(f"Gemini compound error: {e}")
                # fall through to rule-based

        # ── Path A: Advisory / strategic question ─────────────────────────────
        elif not is_data_question:
            try:
                advisory_prompt = f"""You are an expert marketing analyst and CRM strategist.
The user has a customer segmentation dataset for an e-commerce brand with {total_customers:,} customers.
Total lifetime revenue: ${total_revenue:,.0f}.

Segment breakdown (with real metrics):
{json.dumps(seg_stats_dict, indent=2, default=str)}

The user asks: "{question}"

Give a concrete, actionable answer in 3-5 sentences.
- Reference specific segments and their real numbers from above
- Prioritise the most impactful actions
- Be direct and business-focused, not generic
- Do NOT mention pandas, dataframes, or code"""
                answer = gemini_generate(advisory_prompt)
                return jsonify({
                    'answer':     answer,
                    'data':       seg_stats_dict,
                    'query':      None,
                    'powered_by': 'gemini',
                })
            except Exception as e:
                print(f"Gemini advisory error: {e}")
                # fall through to rule-based advisory

        # ── Path B: Data / numbers question ───────────────────────────────────
        elif is_data_question:
            try:
                code_prompt = f"""You are a Python data analyst. You have a pandas DataFrame called `df`.

DataFrame schema:
{json.dumps(schema_info, indent=2)}

Sample rows:
{json.dumps(sample_rows, indent=2, default=str)}

The user asks: "{question}"

Write ONLY executable Python pandas code (no markdown, no imports, no comments) that:
1. Uses `df` as the dataframe variable
2. Stores the final answer in a variable named `result`
3. `result` must be a scalar, dict, or list — NOT a raw dataframe
4. Handles missing columns and empty results gracefully
5. Does NOT write files, print, or make plots

Return ONLY raw Python code. No explanations."""

                generated_code = gemini_generate(code_prompt)
                generated_code = re.sub(r'^```(?:python)?\n?', '', generated_code)
                generated_code = re.sub(r'\n?```$', '', generated_code)

                safe_globals = {
                    'df': per_customer.copy(),
                    'pd': pd,
                    'np': np,
                    '__builtins__': {
                        'len': len, 'range': range, 'enumerate': enumerate,
                        'zip': zip, 'list': list, 'dict': dict, 'int': int,
                        'float': float, 'str': str, 'round': round,
                        'sum': sum, 'min': min, 'max': max, 'abs': abs,
                        'sorted': sorted, 'isinstance': isinstance, 'bool': bool,
                        'any': any, 'all': all, 'set': set, 'tuple': tuple,
                    }
                }
                exec(generated_code, safe_globals)
                result = safe_globals.get('result', None)

                def to_serializable(obj):
                    if isinstance(obj, (np.integer,)):  return int(obj)
                    if isinstance(obj, (np.floating,)): return float(obj)
                    if isinstance(obj, np.ndarray):     return obj.tolist()
                    if isinstance(obj, pd.DataFrame):   return obj.to_dict(orient='records')
                    if isinstance(obj, pd.Series):      return obj.to_dict()
                    return obj

                result_serializable = to_serializable(result)

                answer_prompt = f"""The user asked: "{question}"
The data result is: {json.dumps(result_serializable, default=str)}

Write a concise, friendly 2-4 sentence response that directly answers the question.
Include specific numbers. Do not mention code, pandas, or dataframes."""

                answer = gemini_generate(answer_prompt)
                return jsonify({
                    'answer':     answer,
                    'data':       result_serializable,
                    'query':      generated_code,
                    'powered_by': 'gemini',
                })

            except Exception as e:
                print(f"Gemini data-query error: {e}")
                # fall through to rule-based

    # ── Fallback: rule-based answers ──────────────────────────────────────────
    try:
        # Compound rule-based: at-risk count + conversion advice
        if is_compound_question and any(k in q_lower for k in ['at risk', 'at-risk', 'churn', 'lost', 'convert', 'champion']):
            at_risk = per_customer[per_customer['Segment_Name'].str.contains('Risk|Lost', case=False, na=False)]
            champs  = per_customer[per_customer['Segment_Name'].str.contains('Champion', case=False, na=False)]
            ar_rev  = float(at_risk['Monetary'].sum()) if len(at_risk) > 0 else 0
            ar_avg_recency = float(at_risk['Recency'].mean()) if len(at_risk) > 0 else 0
            champ_avg_m = float(champs['Monetary'].mean()) if len(champs) > 0 else 0
            answer = (
                f"You have **{len(at_risk):,} At Risk / Lost customers** representing ${ar_rev:,.0f} in recoverable revenue.\n\n"
                f"Here's how to convert them into Champions (who average ${champ_avg_m:,.0f} spend):\n"
                f"1. 🎯 **Win-back campaign** — Send a personalised email with a 20-25% time-limited discount code to all {len(at_risk):,} at-risk customers this week.\n"
                f"2. 💬 **Re-engagement sequence** — Follow up with a 3-email drip (Day 1: we miss you, Day 5: exclusive offer, Day 9: last chance) referencing their past purchases.\n"
                f"3. 🚀 **Loyalty bridge** — Once reactivated, enroll them in a loyalty programme with spend-threshold rewards to progressively move them toward the {len(champs):,} Champion tier."
            )

        elif any(k in q_lower for k in ['how many', 'count', 'segment']):
            counts = per_customer['Segment_Name'].value_counts().to_dict()
            lines  = [f"• {seg}: {cnt:,} customers" for seg, cnt in counts.items()]
            answer = f"Your {total_customers:,} customers are distributed across segments:\n" + "\n".join(lines)

        elif any(k in q_lower for k in ['average', 'avg', 'spend', 'monetary']):
            avg = per_customer.groupby('Segment_Name')['Monetary'].mean().round(2).to_dict()
            lines = [f"• {seg}: ${v:,.2f}" for seg, v in avg.items()]
            answer = "Average total spend by segment:\n" + "\n".join(lines)

        elif 'champion' in q_lower:
            champs = per_customer[per_customer['Segment_Name'].str.contains('Champion', case=False, na=False)]
            avg_m  = champs['Monetary'].mean() if len(champs) > 0 else 0
            answer = (f"You have {len(champs):,} Champions — your most valuable customers. "
                      f"They average ${avg_m:,.0f} in lifetime spend and buy frequently. "
                      f"Reward them with VIP perks and early access to new products.")

        elif any(k in q_lower for k in ['at risk', 'churn', 'lost']):
            at_risk = per_customer[per_customer['Segment_Name'].str.contains('Risk|Lost', case=False, na=False)]
            ar_rev  = at_risk['Monetary'].sum() if len(at_risk) > 0 else 0
            answer  = (f"There are {len(at_risk):,} At Risk / Lost customers representing "
                       f"${ar_rev:,.0f} in recoverable revenue. "
                       f"Launch a win-back campaign with time-limited discount codes immediately.")

        elif any(k in q_lower for k in ['recency', 'recent', 'days']):
            avg_r = per_customer.groupby('Segment_Name')['Recency'].mean().round(0).to_dict()
            lines  = [f"• {seg}: {int(v)} days since last purchase" for seg, v in avg_r.items()]
            answer = "Average days since last purchase by segment:\n" + "\n".join(lines)

        elif any(k in q_lower for k in ['frequency', 'often', 'purchases', 'orders']):
            avg_f = per_customer.groupby('Segment_Name')['Frequency'].mean().round(1).to_dict()
            lines  = [f"• {seg}: {v:.1f} purchases" for seg, v in avg_f.items()]
            answer = "Average purchase frequency by segment:\n" + "\n".join(lines)

        elif any(k in q_lower for k in ['revenue', 'total spend', 'total revenue']):
            rev = per_customer.groupby('Segment_Name')['Monetary'].sum().round(0).to_dict()
            lines = [f"• {seg}: ${v:,.0f}" for seg, v in rev.items()]
            answer = f"Total revenue of ${total_revenue:,.0f} broken down by segment:\n" + "\n".join(lines)

        elif any(k in q_lower for k in ['increase', 'grow', 'improve', 'strategy', 'should', 'recommend', 'what to do', 'how to']):
            # Advisory fallback with real numbers
            segs = per_customer['Segment_Name'].value_counts().to_dict()
            at_risk_n = sum(v for k, v in segs.items() if 'risk' in k.lower() or 'lost' in k.lower())
            champ_n   = sum(v for k, v in segs.items() if 'champion' in k.lower())
            answer = (
                f"Based on your {total_customers:,} customers, here are the top 3 priorities:\n"
                f"1. 🎯 Win back {at_risk_n:,} at-risk customers with personalised re-engagement emails and discount codes.\n"
                f"2. 👑 Reward {champ_n:,} Champions with VIP loyalty perks and early product access to increase their order frequency.\n"
                f"3. 🚀 Convert Potential Loyalists with cross-sell campaigns targeting products popular with Champions."
            )

        else:
            # Generic but still useful
            seg_lines = "\n".join([f"• {k}: {v:,} customers" for k, v in
                                    per_customer['Segment_Name'].value_counts().to_dict().items()])
            answer = (
                f"Your dataset has {total_customers:,} customers across "
                f"{per_customer['Segment_Name'].nunique()} segments:\n{seg_lines}\n\n"
                f"Try asking: 'What's the average spend per segment?', "
                f"'How many at-risk customers do I have?', or 'What should I do to increase sales?'"
            )

    except Exception as e:
        answer = f"Could not process your question: {str(e)}"

    return jsonify({'answer': answer, 'data': None, 'query': None, 'powered_by': 'rule-based'})


# ── Executive Summary ─────────────────────────────────────────────────────────
@ai_bp.route('/api/executive-summary/<int:dataset_id>')
@login_required
def executive_summary(user_id, dataset_id):
    per_customer, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404

    try:
        total_customers  = len(per_customer)
        total_revenue    = float(per_customer['Monetary'].sum())
        avg_order_value  = float(per_customer['Monetary'].mean())
        num_segments     = per_customer['Segment_Name'].nunique()

        # ── Per-segment stats ─────────────────────────────────────────────────
        seg_stats = per_customer.groupby('Segment_Name').agg(
            Count     = ('Customer_ID', 'count'),
            Revenue   = ('Monetary',    'sum'),
            AvgSpend  = ('Monetary',    'mean'),
            AvgRecency= ('Recency',     'mean'),
            AvgFreq   = ('Frequency',   'mean'),
        ).reset_index()

        segments = []
        for _, row in seg_stats.iterrows():
            rev_pct = (row['Revenue'] / total_revenue * 100) if total_revenue > 0 else 0
            seg_info = {
                'name':        row['Segment_Name'],
                'count':       int(row['Count']),
                'revenue':     round(float(row['Revenue']), 2),
                'revenue_pct': round(rev_pct, 1),
                'avg_spend':   round(float(row['AvgSpend']), 2),
                'avg_recency': round(float(row['AvgRecency']), 0),
                'avg_freq':    round(float(row['AvgFreq']), 1),
                'rfm_scores':  {
                    'R': 0, # Placeholder or calc if needed
                    'F': 0,
                    'M': 0,
                },
                'campaign': rfm_segment_map.get(
                    str(per_customer[per_customer['Segment_Name'] == row['Segment_Name']]['Cluster'].iloc[0]),
                    {}
                ).get('Campaign_Strategy', ''),
            }
            segments.append(seg_info)

        # Sort by revenue descending
        segments.sort(key=lambda x: x['revenue'], reverse=True)

        # ── Key Findings ──────────────────────────────────────────────────────
        findings = []

        # Top revenue segment
        if segments:
            top = segments[0]
            findings.append(
                f"**{top['name']}** generate {top['revenue_pct']}% of total revenue "
                f"({top['count']:,} customers, avg ${top['avg_spend']:,.0f} spend)"
            )

        # At-risk detection
        at_risk = per_customer[per_customer['Segment_Name'].str.contains('Risk|Lost', na=False, case=False)]
        if len(at_risk) > 0:
            ar_rev = float(at_risk['Monetary'].sum())
            findings.append(
                f"**{len(at_risk):,} at-risk customers** represent ${ar_rev:,.0f} in recoverable revenue"
            )


        # Dormant detection (recency > 90 days)
        dormant = per_customer[per_customer['Recency'] > 90]
        if len(dormant) > 0:
            dormant_pct = len(dormant) / total_customers * 100
            findings.append(
                f"**{dormant_pct:.0f}% of customers** ({len(dormant):,}) haven't purchased in 90+ days"
            )

        # High frequency champions
        champs = per_customer[per_customer['Segment_Name'].str.contains('Champion', na=False, case=False)]
        if len(champs) > 0:
            avg_freq_champs = float(champs['Frequency'].mean())
            findings.append(
                f"**Champions** average {avg_freq_champs:.1f} purchases — "
                f"{avg_freq_champs / float(per_customer['Frequency'].mean()):.1f}x the base rate"
            )

        # ── Recommended Actions ────────────────────────────────────────────────
        actions = []
        if at_risk.empty is False:
            actions.append({
                'priority': 1,
                'emoji': '🎯',
                'title': f"Win-back {len(at_risk):,} at-risk customers",
                'detail': "Launch personalised re-engagement email sequence with time-limited discount codes."
            })

        if champs.empty is False:
            actions.append({
                'priority': 2,
                'emoji': '👑',
                'title': f"Reward {len(champs):,} Champions",
                'detail': "Deploy VIP loyalty programme, early product access, and dedicated account perks."
            })

        if len(dormant) > 0:
            actions.append({
                'priority': 3,
                'emoji': '💤',
                'title': f"Re-engage {len(dormant):,} dormant customers",
                'detail': "Send 'We miss you' campaign with product recommendations based on past purchases."
            })

        # Fallback action if list is short
        if len(actions) < 2:
            potential = per_customer[per_customer['Segment_Name'].str.contains('Potential|Loyalist', na=False, case=False)]
            if len(potential) > 0:
                actions.append({
                    'priority': len(actions) + 1,
                    'emoji': '🚀',
                    'title': f"Convert {len(potential):,} Potential Loyalists",
                    'detail': "Cross-sell complementary products and trigger nurture email series."
                })

        # ── Headline ──────────────────────────────────────────────────────────
        headline = (
            f"Your {total_customers:,} customers split into {num_segments} distinct segments "
            f"with ${total_revenue:,.0f} total lifetime revenue — "
            f"{'top priority: at-risk recovery' if len(at_risk) > 0 else 'focus on Champion retention'}."
        )

        # ── Optional Gemini enhancement ────────────────────────────────────────
        ai_headline = None
        if gemini_client:
            try:
                stats_payload = {
                    'total_customers': total_customers,
                    'total_revenue':   round(total_revenue, 2),
                    'avg_order_value': round(avg_order_value, 2),
                    'segments': [{'name': s['name'], 'count': s['count'],
                                  'revenue_pct': s['revenue_pct']} for s in segments]
                }
                ai_prompt = f"""You are a senior marketing analyst writing an executive summary.
Customer segmentation data:
{json.dumps(stats_payload, indent=2)}

Write ONE punchy executive headline sentence (max 25 words) that:
- Includes a specific number or percentage
- Identifies the most important business opportunity
- Sounds boardroom-ready, not technical

Return only the sentence."""
                ai_headline = gemini_generate(ai_prompt)
                ai_headline = ai_headline.strip('"')
            except Exception as e:
                print(f"Gemini summary error: {e}")

        return jsonify({
            'headline':    ai_headline or headline,
            'rule_headline': headline,
            'segments':    segments,
            'key_findings': findings,
            'recommended_actions': actions,
            'stats': {
                'total_customers': total_customers,
                'total_revenue':   round(total_revenue, 2),
                'avg_order_value': round(avg_order_value, 2),
                'num_segments':    num_segments,
            },
            'ai_powered': ai_headline is not None,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Strategy Agent ────────────────────────────────────────────────────────────
strategy_cache: dict = {}

@ai_bp.route('/api/strategy/<int:dataset_id>/<int:segment_id>')
@login_required
def strategy_agent(user_id, dataset_id, segment_id):
    if segment_id not in range(4):
        return jsonify({'success': False, 'error': 'invalid_segment'}), 400

    cache_key = f"{dataset_id}_{segment_id}"
    if cache_key in strategy_cache:
        return jsonify({'success': True, 'strategy': strategy_cache[cache_key]})

    df, err = get_customers_df(dataset_id, user_id)
    if err:
        return jsonify({'error': err}), 404

    seg_df = df[df['Cluster'] == segment_id]
    if seg_df.empty:
        return jsonify({'success': False, 'error': 'segment_empty'}), 400

    try:
        count           = len(seg_df)
        avg_recency     = float(seg_df['Recency'].mean())   if 'Recency'    in seg_df.columns else 0
        avg_frequency   = float(seg_df['Frequency'].mean()) if 'Frequency'  in seg_df.columns else 0
        avg_monetary    = float(seg_df['Monetary'].mean())  if 'Monetary'   in seg_df.columns else 0
        top_season      = seg_df['Season'].mode()[0]        if 'Season'     in seg_df.columns else 'Unknown'

        user_prompt = f"""
Segment ID: {segment_id}
Segment Name: {SEGMENT_NAMES[segment_id]}

RFM + Behavioral Data:
- Customer count: {count}
- Avg Recency (days since last purchase): {avg_recency:.0f} days
- Avg Frequency (purchase count): {avg_frequency:.1f}
- Avg Monetary value: ₹{avg_monetary:,.0f}
- Most active season: {top_season}

Generate the marketing strategy. Return ONLY the JSON object.
"""
        full_prompt = STRATEGY_SYSTEM_PROMPT + "\n\n" + user_prompt

        strategy = None
        try:
            raw_text = gemini_generate(full_prompt)
            raw_text = re.sub(r'^```[a-z]*\n?', '', raw_text.strip())
            raw_text = re.sub(r'\n?```$', '', raw_text.strip())
            strategy = json.loads(raw_text)
        except json.JSONDecodeError as je:
            print(f"[WARN] Strategy JSON parse failed: {je}. Using rule-based fallback.")
        except Exception as ge:
            print(f"[WARN] Strategy Gemini failed (quota?): {ge}. Using rule-based fallback.")

        if strategy is None:
            cur = 'Rs.'
            segment_label = SEGMENT_NAMES[segment_id]
            rule_strategies = {
                0: {"segment_label": segment_label, "segment_summary": f"{count:,} customers buy frequently but spend modestly at {cur}{avg_monetary:,.0f} avg.", "urgency": "MEDIUM", "rfm_insight": f"High frequency ({avg_frequency:.1f}x) with low monetary ({cur}{avg_monetary:,.0f}) and {avg_recency:.0f}-day recency signals budget-conscious habitual buyers.", "primary_campaign": {"name": "Value Ladder Program", "tagline": "Spend more, earn more.", "objective": "Increase average order value through tiered spend rewards.", "channels": ["Email", "In-App", "Push"], "offer": "15% off orders above Rs.2,000 + free shipping above Rs.3,000", "cta": "Unlock Your Reward"}, "copy_hooks": [f"You've shopped {avg_frequency:.0f} times — your next order unlocks VIP status.", "Small upgrades, big rewards. See what you're missing."], "kpis": ["Increase avg order value by 30% within 60 days", "Achieve 25% coupon redemption rate on tiered offer", "Reduce churn rate by 15% within 90 days"], "risk": "Discount fatigue may condition these buyers to only purchase during promotions, eroding long-term margins.", "next_best_action": f"Send a personalised email to all {count:,} customers this week featuring a spend-threshold offer with a 7-day countdown."},
                1: {"segment_label": segment_label, "segment_summary": f"{count:,} VIP customers drive premium revenue at {cur}{avg_monetary:,.0f} avg monetary — these are your brand champions.", "urgency": "LOW", "rfm_insight": f"Low recency ({avg_recency:.0f} days), high frequency ({avg_frequency:.1f}x), and high monetary ({cur}{avg_monetary:,.0f}) mark these as your most valuable customers.", "primary_campaign": {"name": "CUE-X Inner Circle", "tagline": "You're one of a kind.", "objective": "Deepen loyalty and increase referrals through an exclusive membership tier.", "channels": ["Email", "WhatsApp", "Instagram"], "offer": "Early access to new collections + 20% loyalty discount + free priority shipping", "cta": "Claim VIP Access"}, "copy_hooks": [f"As one of our top {count:,} customers, you get access before anyone else.", f"Your {avg_frequency:.0f} purchases have earned you something special.", f"New {top_season} collection drops Friday — you're on the list."], "kpis": ["Maintain 90%+ retention rate over next 6 months", f"Generate 30 referrals per 100 VIP customers in {top_season} campaign", f"Increase purchase frequency from {avg_frequency:.1f}x to {avg_frequency+1:.1f}x within 6 months"], "risk": "Over-communicating with VIP customers risks perceived intrusiveness; quality matters more than volume.", "next_best_action": f"Launch a WhatsApp broadcast to your {count:,} VIP customers announcing early access to the {top_season} collection this weekend."},
                2: {"segment_label": segment_label, "segment_summary": f"{count:,} customers have not purchased in {avg_recency:.0f} days on average — urgent win-back action needed before permanent churn.", "urgency": "HIGH", "rfm_insight": f"High recency ({avg_recency:.0f} days), low frequency ({avg_frequency:.1f}x), and declining monetary ({cur}{avg_monetary:,.0f}) signal customers who have fully disengaged.", "primary_campaign": {"name": "We Miss You", "tagline": "Come back. We've kept something for you.", "objective": "Reactivate lapsed customers with a time-limited high-value win-back offer.", "channels": ["Email", "SMS", "Retargeting Ads"], "offer": "25% off your next purchase — valid for 10 days only", "cta": "Reclaim Your Offer"}, "copy_hooks": [f"It's been {avg_recency:.0f} days. We haven't forgotten you.", "Your 25% comeback offer expires in 10 days. Don't miss it.", "Your favourite product is back in stock — and it's waiting for you."], "kpis": [f"Reactivate at least 20% of {count:,} lost customers within 30 days", "Achieve email open rate above 22% on win-back sequence", f"Recover revenue from at least {int(count * 0.2):,} reactivated customers"], "risk": "Aggressive discounting may attract one-time buyers who churn again, lowering LTV.", "next_best_action": f"Launch a 3-email win-back drip today: Day 1 (we miss you), Day 5 (25% offer), Day 9 (last chance) targeting all {count:,} lapsed customers."},
                3: {"segment_label": segment_label, "segment_summary": f"{count:,} customers purchase primarily in {top_season} and are dormant otherwise — seasonal activation is the key lever.", "urgency": "MEDIUM", "rfm_insight": f"Moderate recency ({avg_recency:.0f} days) and low frequency ({avg_frequency:.1f}x) with spend concentrated in {top_season} indicates season-driven, not brand-driven, intent.", "primary_campaign": {"name": f"{top_season} First Access", "tagline": f"Your {top_season} picks are waiting.", "objective": f"Convert seasonal intent into repeat purchases before and after the {top_season} peak.", "channels": ["Email", "Instagram", "Push"], "offer": f"Free gift with {top_season} orders + 10% early bird discount", "cta": f"Shop {top_season} Now"}, "copy_hooks": [f"Your {top_season} wishlist just got cheaper. 10% off, this week only.", "Buy now, wear it all season — free gift included."], "kpis": [f"Increase purchase frequency by 0.5x during {top_season} window", "Drive 35% click-through rate on seasonal campaign email", "Achieve 25% uplift in avg monetary per customer during campaign period"], "risk": f"If the {top_season} campaign underperforms, these customers may remain once-a-year buyers with no off-season engagement.", "next_best_action": f"Build a {top_season}-themed lookbook email featuring your products, scheduled 2 weeks before {top_season} begins."},
            }
            strategy = rule_strategies[segment_id]
            strategy['powered_by'] = 'rule-based'

        strategy_cache[cache_key] = strategy
        return jsonify({'success': True, 'strategy': strategy})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
