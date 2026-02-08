"""Price service for FX rates and security prices"""

from abc import ABC, abstractmethod
from decimal import Decimal
from datetime import datetime
from typing import Optional
import yfinance as yf


class PriceProvider(ABC):
    """Abstract base for price data providers"""

    @abstractmethod
    def get_rate(
        self,
        base_ccy: str,
        quote_ccy: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """Get exchange rate between two currencies"""
        pass

    @abstractmethod
    def get_stock_price(
        self,
        symbol: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """Get stock/ETF price"""
        pass


class YahooFinancePriceProvider(PriceProvider):
    """Yahoo Finance price provider"""

    def __init__(self, cache_ttl_seconds: int = 3600):
        """
        Initialize provider.
        
        Args:
            cache_ttl_seconds: Cache TTL in seconds (default 1 hour)
        """
        self.cache_ttl = cache_ttl_seconds
        self._cache = {}

    def get_rate(
        self,
        base_ccy: str,
        quote_ccy: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """
        Get FX rate via Yahoo Finance.
        
        Args:
            base_ccy: Base currency code (e.g., "SGD")
            quote_ccy: Quote currency code (e.g., "USD")
            as_of: Historical date (not supported yet, uses latest)
            
        Returns:
            Exchange rate or None if unavailable
        """
        if base_ccy == quote_ccy:
            return Decimal(1)

        symbol = f"{base_ccy}{quote_ccy}=X"
        
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1d")
            
            if data.empty:
                return None
            
            # Get closing price
            price = data['Close'].iloc[-1]
            return Decimal(str(price))
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return None

    def get_stock_price(
        self,
        symbol: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """Get stock/ETF price"""
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1d")
            
            if data.empty:
                return None
            
            price = data['Close'].iloc[-1]
            return Decimal(str(price))
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return None


class PriceService:
    """Main price service with caching and fallback"""

    def __init__(self, primary_provider: PriceProvider = None):
        """
        Initialize service.
        
        Args:
            primary_provider: Primary price provider (defaults to YahooFinance)
        """
        self.primary_provider = primary_provider or YahooFinancePriceProvider()

    def get_fx_rate(
        self,
        base_ccy: str,
        quote_ccy: str,
        as_of: datetime = None
    ) -> Decimal:
        """
        Get FX rate with fallback.
        
        Args:
            base_ccy: Base currency
            quote_ccy: Quote currency
            as_of: Historical date
            
        Returns:
            Exchange rate (defaults to 1 if unavailable)
        """
        rate = self.primary_provider.get_rate(base_ccy, quote_ccy, as_of)
        return rate or Decimal(1)

    def get_security_price(
        self,
        symbol: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """Get security price"""
        return self.primary_provider.get_stock_price(symbol, as_of)
