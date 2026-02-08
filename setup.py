"""Setup configuration"""
# This file can be used with setuptools if needed
# python setup.py install

from setuptools import setup, find_packages

setup(
    name="ledgera",
    version="0.1.0",
    description="Dual-approach banking + projections + line-by-line accounting",
    author="Ledgera Team",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "sqlalchemy>=2.0.0",
        "pydantic>=2.0.0",
        "yfinance>=0.2.32",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
    ],
)
