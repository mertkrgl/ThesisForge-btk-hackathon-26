"""Hisse fiyatı (OHLCV) ve endeks — yfinance primary, isyatirimhisse fallback.

Kullanım:
    from product.prices import get_ohlcv, get_index, get_dividends
    df = get_ohlcv("THYAO", days=90)     # 90 günlük OHLCV
    idx = get_index("XU100", days=90)    # BIST 100
"""
from datetime import date, timedelta
import pandas as pd
import yfinance as yf


def get_ohlcv(ticker: str, days: int = 90) -> pd.DataFrame:
    """Hisse OHLCV verisi — yfinance primary, isyatirim fallback.

    Args:
        ticker: BIST sembolü (ör. 'THYAO' — .IS otomatik eklenir)
        days: Kaç günlük geçmiş

    Returns:
        DataFrame with columns: Open, High, Low, Close, Volume (Date index)

    Raises:
        RuntimeError: Hem primary hem fallback başarısız olursa
    """
    # Primary: yfinance
    try:
        period = f"{max(1, days // 30)}mo" if days >= 30 else f"{days}d"
        df = yf.Ticker(f"{ticker}.IS").history(period=period)
        if not df.empty:
            df = df.tail(days)
            df.attrs["source"] = "yfinance"
            return df
    except Exception:
        pass

    # Fallback: isyatirimhisse
    try:
        from isyatirimhisse import fetch_stock_data
        end = date.today().strftime("%d-%m-%Y")
        start = (date.today() - timedelta(days=days)).strftime("%d-%m-%Y")
        df = fetch_stock_data(ticker, start, end)
        if df is not None and not df.empty:
            # isyatirim kolon adları farklı, standartlaştır
            df = df.rename(columns={
                "HGDG_HS_KODU": "Symbol",
                "DD_DATE": "Date",
                "HGDG_KAPANIS": "Close",
                "HGDG_MAX": "High",
                "HGDG_MIN": "Low",
                "HGDG_AOF": "Open",
                "HGDG_HACIM": "Volume",
            })
            if "Date" in df.columns:
                df["Date"] = pd.to_datetime(df["Date"])
                df = df.set_index("Date")
            df.attrs["source"] = "isyatirim"
            return df
    except Exception:
        pass

    raise RuntimeError(f"{ticker} için ne yfinance ne isyatirim veri verdi")


def get_index(index_code: str = "XU100", days: int = 90) -> pd.DataFrame:
    """BIST endeksi — yfinance primary.

    Args:
        index_code: 'XU100', 'XU030', 'XBANK', vb.
        days: Kaç günlük geçmiş

    Returns:
        OHLCV DataFrame
    """
    try:
        period = f"{max(1, days // 30)}mo" if days >= 30 else f"{days}d"
        df = yf.Ticker(f"{index_code}.IS").history(period=period)
        if not df.empty:
            df = df.tail(days)
            df.attrs["source"] = "yfinance"
            return df
    except Exception:
        pass

    # Fallback: isyatirimhisse
    try:
        from isyatirimhisse import fetch_index_data
        end = date.today().strftime("%d-%m-%Y")
        start = (date.today() - timedelta(days=days)).strftime("%d-%m-%Y")
        df = fetch_index_data(index_code, start, end)
        if df is not None and not df.empty:
            df.attrs["source"] = "isyatirim"
            return df
    except Exception:
        pass

    raise RuntimeError(f"{index_code} endeksi için veri alınamadı")


def get_dividends(ticker: str) -> pd.Series:
    """Temettü geçmişi — yfinance."""
    return yf.Ticker(f"{ticker}.IS").dividends


def get_brent_oil(days: int = 30) -> pd.DataFrame:
    """Brent petrolü — Energy squad için (TUPRS, AKSEN korelasyon)."""
    period = f"{max(1, days // 30)}mo" if days >= 30 else f"{days}d"
    df = yf.Ticker("BZ=F").history(period=period)
    df.attrs["source"] = "yfinance"
    return df


if __name__ == "__main__":
    print("=== THYAO 90 gün OHLCV ===")
    df = get_ohlcv("THYAO", days=90)
    print(f"Kaynak: {df.attrs.get('source')} | {len(df)} satır")
    print(df.tail(3)[["Open", "High", "Low", "Close", "Volume"]])

    print("\n=== XU100 (BIST 100) ===")
    idx = get_index("XU100", days=30)
    print(f"Son kapanış: {idx.iloc[-1]['Close']:.0f}")

    print("\n=== Brent ===")
    brent = get_brent_oil(days=30)
    print(f"Son kapanış: ${brent.iloc[-1]['Close']:.2f}")

    print("\n=== THYAO temettü ===")
    div = get_dividends("THYAO")
    print(f"{len(div)} temettü kaydı")
