import os
from config import GEMINI_API_KEY

genai = None
GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-1.5-flash']

if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        print("[OK] Gemini AI (google-generativeai) loaded successfully")
    except Exception as e:
        genai = None
        print(f"[WARN] Gemini not available: {e}")
else:
    print("[WARN] GEMINI_API_KEY not set -- chat and AI summary will use fallback mode")

def gemini_generate(prompt: str) -> str:
    """Call Gemini, auto-fallback across model list on quota errors."""
    if not genai:
        raise RuntimeError("Gemini client not initialised or missing API key")
    
    last_err = None
    for model_name in GEMINI_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            return resp.text.strip()
        except Exception as e:
            last_err = e
            if '429' not in str(e) and 'RESOURCE_EXHAUSTED' not in str(e):
                raise   # Non-quota error — don't retry other models
            print(f"[WARN] {model_name} quota hit, trying next model...")
            
    raise RuntimeError(f"All Gemini models quota-exhausted: {last_err}")
