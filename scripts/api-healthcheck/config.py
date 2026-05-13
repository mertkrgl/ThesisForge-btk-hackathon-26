import os
from pathlib import Path
from dotenv import load_dotenv

_root = Path(__file__).parent.parent.parent
load_dotenv(_root / ".env.probe")

TCMB_EVDS_KEY = os.getenv("TCMB_EVDS_KEY", "")
MKK_API_KEY = os.getenv("MKK_API_KEY", "")
MKK_API_SECRET = os.getenv("MKK_API_SECRET", "")

TEST_TICKER = "THYAO"
TEST_START = "01-01-2026"
TEST_END = "12-05-2026"
