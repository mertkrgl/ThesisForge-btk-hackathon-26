"""Ortam değişkenleri ve sabitler — .env.probe'dan okur."""
import os
from pathlib import Path
from dotenv import load_dotenv

_root = Path(__file__).parent.parent.parent
load_dotenv(_root / ".env.probe")

# API anahtarları
TCMB_EVDS_KEY = os.getenv("TCMB_EVDS_KEY", "")
MKK_API_KEY = os.getenv("MKK_API_KEY", "")
MKK_API_SECRET = os.getenv("MKK_API_SECRET", "")

# Base URL'ler
TCMB_BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis"
MKK_BASE = "https://apigwdev.mkk.com.tr"

# Varsayılan ayarlar
DEFAULT_TIMEOUT = 15
USER_AGENT = "ThesisForge/0.1"
