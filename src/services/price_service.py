"""Price service for FX rates and security prices"""

import logging
from abc import ABC, abstractmethod
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, Dict, List, Tuple
import yfinance as yf
from sqlalchemy.orm import Session

from src.data.models import PriceModel
from src.data.repositories import PriceRepository

logger = logging.getLogger(__name__)


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

    @abstractmethod
    def get_historical_rates(
        self,
        base_ccy: str,
        quote_ccy: str,
        start_date: date,
        end_date: date
    ) -> Dict[date, Decimal]:
        """Get historical daily rates for a date range"""
        pass


class YahooFinancePriceProvider(PriceProvider):
    """Yahoo Finance price provider"""

    def get_rate(
        self,
        base_ccy: str,
        quote_ccy: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        if base_ccy == quote_ccy:
            return Decimal(1)

        symbol = f"{base_ccy}{quote_ccy}=X"

        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d")

            if data.empty:
                logger.warning(f"No data returned for {symbol}")
                return None

            price = data['Close'].iloc[-1]
            return Decimal(str(price))
        except Exception as e:
            logger.error(f"Error fetching {symbol}: {e}")
            return None

    def get_stock_price(
        self,
        symbol: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d")

            if data.empty:
                return None

            price = data['Close'].iloc[-1]
            return Decimal(str(price))
        except Exception as e:
            logger.error(f"Error fetching {symbol}: {e}")
            return None

    def get_historical_rates(
        self,
        base_ccy: str,
        quote_ccy: str,
        start_date: date,
        end_date: date
    ) -> Dict[date, Decimal]:
        if base_ccy == quote_ccy:
            return {}

        symbol = f"{base_ccy}{quote_ccy}=X"
        result = {}

        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(
                start=start_date.isoformat(),
                end=end_date.isoformat()
            )

            if data.empty:
                logger.warning(f"No historical data for {symbol} ({start_date} to {end_date})")
                return result

            for idx, row in data.iterrows():
                d = idx.date() if hasattr(idx, 'date') else idx
                result[d] = Decimal(str(row['Close']))

            logger.info(f"Fetched {len(result)} historical rates for {symbol}")
        except Exception as e:
            logger.error(f"Error fetching historical {symbol}: {e}")

        return result


class PriceService:
    """Main price service with DB-backed caching and Yahoo Finance fallback"""

    def __init__(self, primary_provider: PriceProvider = None):
        self.primary_provider = primary_provider or YahooFinancePriceProvider()

    def get_fx_rate(
        self,
        base_ccy: str,
        quote_ccy: str,
        session: Session = None
    ) -> Decimal:
        """
        Get FX rate with DB caching.

        1. Same currency → 1.0
        2. Check DB for fresh rate (< 24h old)
        3. Fetch live from Yahoo Finance, persist to DB
        4. Fall back to any DB rate, then 1.0
        """
        if base_ccy == quote_ccy:
            return Decimal(1)

        repo = PriceRepository(session) if session else None

        # Check DB cache
        if repo:
            cached = repo.read_latest_rate_within(base_ccy, quote_ccy, max_age_hours=24)
            if cached:
                return Decimal(str(cached.rate))

        # Fetch live
        rate = self.primary_provider.get_rate(base_ccy, quote_ccy)

        if rate and repo:
            price = PriceModel(
                base_ccy=base_ccy,
                quote_ccy=quote_ccy,
                rate=rate,
                timestamp=datetime.utcnow(),
                source="yahoo_finance",
            )
            try:
                repo.create(price)
            except Exception as e:
                logger.error(f"Failed to persist rate {base_ccy}/{quote_ccy}: {e}")

        if rate:
            return rate

        # Fallback: any DB rate (even stale)
        if repo:
            stale = repo.read_latest_rate(base_ccy, quote_ccy)
            if stale:
                logger.warning(f"Using stale rate for {base_ccy}/{quote_ccy} from {stale.timestamp}")
                return Decimal(str(stale.rate))

        logger.warning(f"No rate available for {base_ccy}/{quote_ccy}, defaulting to 1.0")
        return Decimal(1)

    def get_bulk_fx_rates(
        self,
        pairs: List[Tuple[str, str]],
        session: Session = None
    ) -> Dict[Tuple[str, str], Decimal]:
        """Fetch rates for multiple currency pairs"""
        result = {}
        for base_ccy, quote_ccy in pairs:
            result[(base_ccy, quote_ccy)] = self.get_fx_rate(base_ccy, quote_ccy, session)
        return result

    def get_historical_rates(
        self,
        base_ccy: str,
        quote_ccy: str,
        start_date: date,
        end_date: date,
        session: Session = None
    ) -> Dict[date, Decimal]:
        """
        Get historical daily rates. Fetches from Yahoo Finance and persists to DB.
        Returns dict of {date: rate}.
        """
        if base_ccy == quote_ccy:
            return {}

        repo = PriceRepository(session) if session else None

        # Fetch from Yahoo Finance
        rates = self.primary_provider.get_historical_rates(
            base_ccy, quote_ccy, start_date, end_date
        )

        # Persist to DB
        if rates and repo:
            prices = []
            for d, rate in rates.items():
                prices.append(PriceModel(
                    base_ccy=base_ccy,
                    quote_ccy=quote_ccy,
                    rate=rate,
                    timestamp=datetime(d.year, d.month, d.day, 23, 59, 59),
                    source="yahoo_finance",
                ))
            try:
                repo.bulk_create(prices)
            except Exception as e:
                logger.error(f"Failed to persist historical rates {base_ccy}/{quote_ccy}: {e}")

        return rates

    def get_rate_at_date(
        self,
        base_ccy: str,
        quote_ccy: str,
        target_date: date,
        session: Session = None
    ) -> Decimal:
        """Get rate at a specific date from DB. Returns 1.0 if not found."""
        if base_ccy == quote_ccy:
            return Decimal(1)

        if session:
            repo = PriceRepository(session)
            dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)
            price = repo.read_rate_at_date(base_ccy, quote_ccy, dt)
            if price:
                return Decimal(str(price.rate))

        return Decimal(1)

    def get_security_price(
        self,
        symbol: str,
        as_of: datetime = None
    ) -> Optional[Decimal]:
        """Get security price"""
        return self.primary_provider.get_stock_price(symbol, as_of)
