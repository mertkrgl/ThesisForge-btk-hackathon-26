"""Teknik indikatörler — pandas-ta (lokal hesap).

Kullanım:
    from product.prices import get_ohlcv
    from product.technicals import compute_indicators

    df = get_ohlcv("THYAO", days=90)
    ind = compute_indicators(df)
    # → {'rsi_14': 56.2, 'macd': ..., 'bb_upper': ..., 'atr_14': ...}
"""
import pandas as pd
import pandas_ta as ta


def compute_indicators(ohlcv: pd.DataFrame) -> dict:
    """OHLCV DataFrame'i alır, son barın indikatör değerlerini döndürür.

    Args:
        ohlcv: 'Open', 'High', 'Low', 'Close', 'Volume' kolonlu DataFrame

    Returns:
        {
            'last_close': 305.75,
            'rsi_14': 56.2,
            'macd': 1.23,
            'macd_signal': 1.45,
            'macd_hist': -0.22,
            'bb_upper': 312.5,
            'bb_middle': 308.0,
            'bb_lower': 303.5,
            'atr_14': 4.32,
            'sma_20': 307.8,
            'sma_50': 295.3,
            'ema_12': 308.5,
            'volume_avg_20': 50_000_000,
        }
    """
    close = ohlcv["Close"]
    high = ohlcv["High"]
    low = ohlcv["Low"]
    volume = ohlcv["Volume"]

    rsi = ta.rsi(close, length=14)
    macd_df = ta.macd(close)
    bb_df = ta.bbands(close, length=20, std=2)
    atr = ta.atr(high, low, close, length=14)
    sma20 = ta.sma(close, length=20)
    sma50 = ta.sma(close, length=50)
    ema12 = ta.ema(close, length=12)

    def _last(s):
        if s is None or len(s) == 0:
            return None
        v = s.iloc[-1]
        return round(float(v), 4) if pd.notna(v) else None

    def _col(df, prefix: str):
        """pandas-ta sürümleri arası kolon adı farkını absorb et."""
        if df is None:
            return None
        for c in df.columns:
            if c.startswith(prefix):
                return df[c]
        return None

    return {
        "last_close": _last(close),
        "rsi_14": _last(rsi),
        "macd": _last(_col(macd_df, "MACD_")),
        "macd_signal": _last(_col(macd_df, "MACDs_")),
        "macd_hist": _last(_col(macd_df, "MACDh_")),
        "bb_upper": _last(_col(bb_df, "BBU_")),
        "bb_middle": _last(_col(bb_df, "BBM_")),
        "bb_lower": _last(_col(bb_df, "BBL_")),
        "atr_14": _last(atr),
        "sma_20": _last(sma20),
        "sma_50": _last(sma50),
        "ema_12": _last(ema12),
        "volume_avg_20": int(volume.tail(20).mean()) if len(volume) >= 20 else None,
    }


def technical_signal(indicators: dict) -> dict:
    """İndikatörlerden basit AL/SAT/TUT sinyali.

    Returns:
        {
            'trend': 'bullish' | 'bearish' | 'neutral',
            'momentum': 'overbought' | 'oversold' | 'neutral',
            'volatility': 'high' | 'normal' | 'low',
        }
    """
    signal = {}

    # Trend: SMA20 vs SMA50
    sma20, sma50 = indicators.get("sma_20"), indicators.get("sma_50")
    if sma20 and sma50:
        if sma20 > sma50 * 1.02:
            signal["trend"] = "bullish"
        elif sma20 < sma50 * 0.98:
            signal["trend"] = "bearish"
        else:
            signal["trend"] = "neutral"

    # Momentum: RSI
    rsi = indicators.get("rsi_14")
    if rsi:
        if rsi > 70:
            signal["momentum"] = "overbought"
        elif rsi < 30:
            signal["momentum"] = "oversold"
        else:
            signal["momentum"] = "neutral"

    # Volatility: ATR / Close
    atr, close = indicators.get("atr_14"), indicators.get("last_close")
    if atr and close:
        atr_pct = atr / close
        if atr_pct > 0.04:
            signal["volatility"] = "high"
        elif atr_pct < 0.015:
            signal["volatility"] = "low"
        else:
            signal["volatility"] = "normal"

    return signal


if __name__ == "__main__":
    import json
    from prices import get_ohlcv

    print("=== THYAO teknik indikatörler ===")
    df = get_ohlcv("THYAO", days=90)
    ind = compute_indicators(df)
    print(json.dumps(ind, indent=2, ensure_ascii=False))

    print("\n=== Sinyal ===")
    print(json.dumps(technical_signal(ind), indent=2, ensure_ascii=False))
