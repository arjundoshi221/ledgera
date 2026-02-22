"""Price/FX endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from src.data.database import get_session
from src.services.price_service import PriceService, YahooFinancePriceProvider
from src.api.schemas import PriceResponse

router = APIRouter()

price_service = PriceService(YahooFinancePriceProvider())


@router.get("/fx/{base_ccy}/{quote_ccy}", response_model=PriceResponse)
def get_fx_rate(
    base_ccy: str,
    quote_ccy: str,
    session: Session = Depends(get_session)
):
    """Get FX rate between two currencies (cached in DB)"""
    rate = price_service.get_fx_rate(base_ccy, quote_ccy, session=session)

    return {
        "base_ccy": base_ccy,
        "quote_ccy": quote_ccy,
        "rate": rate,
        "timestamp": datetime.utcnow(),
        "source": "yahoo_finance"
    }


@router.get("/stock/{symbol}")
def get_stock_price(
    symbol: str,
    session: Session = Depends(get_session)
):
    """Get stock/ETF price"""
    price = price_service.get_security_price(symbol)

    if not price:
        raise HTTPException(status_code=404, detail=f"Unable to fetch price for {symbol}")

    return {
        "symbol": symbol,
        "price": price,
        "timestamp": datetime.utcnow(),
        "source": "yahoo_finance"
    }
