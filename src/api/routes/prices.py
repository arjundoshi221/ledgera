"""Price/FX endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from decimal import Decimal

from src.data.database import get_session
from src.services.price_service import PriceService, YahooFinancePriceProvider
from src.api.schemas import PriceResponse
from datetime import datetime

router = APIRouter()

# Initialize price service
price_service = PriceService(YahooFinancePriceProvider())


@router.get("/fx/{base_ccy}/{quote_ccy}", response_model=PriceResponse)
def get_fx_rate(
    base_ccy: str,
    quote_ccy: str,
    session: Session = Depends(get_session)
):
    """Get FX rate between two currencies"""
    
    rate = price_service.get_fx_rate(base_ccy, quote_ccy)
    
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
        return {"error": f"Unable to fetch price for {symbol}"}
    
    return {
        "symbol": symbol,
        "price": price,
        "timestamp": datetime.utcnow(),
        "source": "yahoo_finance"
    }
