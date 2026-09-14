import os
import pathlib

# Paths
SRC_DIR = pathlib.Path(__file__).resolve().parent
SP2_DIR = SRC_DIR.parent
SPIKES_DIR = SP2_DIR.parent
PROJECT_ROOT = SPIKES_DIR.parent
ENV_FILE = SPIKES_DIR / ".env.local"
FIXTURES_DIR = SPIKES_DIR / "fixtures"
RULES_FILE = FIXTURES_DIR / "sp2-approval-rules.md"
EVIDENCE_DIR = SP2_DIR / "evidence"

# Load .env.local
env_vars = {}
if ENV_FILE.exists():
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", env_vars.get("LLM_BASE_URL", "https://ark.ap-southeast.bytepluses.com/api/coding/v3"))
LLM_API_KEY = os.environ.get("LLM_API_KEY", env_vars.get("LLM_API_KEY", ""))
LLM_MODEL_STRONG = os.environ.get("LLM_MODEL_STRONG", env_vars.get("LLM_MODEL_STRONG", "deepseek-v4-pro-ga-260813"))
LLM_MODEL_CHEAP = os.environ.get("LLM_MODEL_CHEAP", env_vars.get("LLM_MODEL_CHEAP", "deepseek-v4-flash-ga-260731"))

if not LLM_API_KEY:
    raise ValueError("LLM_API_KEY is not set in environment or .env.local")
