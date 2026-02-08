"""Configuration file for the project"""

import os
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration"""
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./ledgera.db")
    
    # API
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", 8000))
    API_DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Services
    PRICE_PROVIDER: str = os.getenv("PRICE_PROVIDER", "yahoo_finance")
    PRICE_CACHE_TTL: int = int(os.getenv("PRICE_CACHE_TTL", 3600))
    
    # Base currency
    BASE_CURRENCY: str = os.getenv("BASE_CURRENCY", "SGD")


config = Config()
