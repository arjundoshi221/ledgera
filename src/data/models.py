"""SQLAlchemy database models"""

from sqlalchemy import (
    Column, String, Numeric, DateTime, ForeignKey,
    Enum, Text, Boolean, Table
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


# Association table for transaction tags
transaction_tags = Table(
    'transaction_tags',
    Base.metadata,
    Column('transaction_id', UUID(as_uuid=True), ForeignKey('transactions.id')),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'))
)


class AccountModel(Base):
    """ORM model for Account entity"""
    __tablename__ = 'accounts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # asset, liability, income, expense, equity
    currency = Column(String(3), nullable=False, default='SGD')
    institution = Column(String(255))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    postings = relationship("PostingModel", back_populates="account")


class CategoryModel(Base):
    """ORM model for Category entity"""
    __tablename__ = 'categories'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('categories.id'))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    children = relationship("CategoryModel", remote_side=[id])


class TagModel(Base):
    """ORM model for Tag entity"""
    __tablename__ = 'tags'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    transactions = relationship(
        "TransactionModel",
        secondary=transaction_tags,
        back_populates="tags"
    )


class TransactionModel(Base):
    """ORM model for Transaction entity"""
    __tablename__ = 'transactions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, nullable=False, index=True)
    payee = Column(String(255))
    memo = Column(Text)
    status = Column(String(50), nullable=False, default='unreconciled')  # unreconciled, reconciled, pending
    source = Column(String(50))  # manual, csv_import, sync
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    postings = relationship("PostingModel", back_populates="transaction", cascade="all, delete-orphan")
    tags = relationship(
        "TagModel",
        secondary=transaction_tags,
        back_populates="transactions"
    )


class PostingModel(Base):
    """ORM model for Posting entity (double-entry line)"""
    __tablename__ = 'postings'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey('transactions.id'), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=False, index=True)
    amount = Column(Numeric(19, 4), nullable=False)  # Native currency
    currency = Column(String(3), nullable=False, default='SGD')
    base_amount = Column(Numeric(19, 4), nullable=False)  # Converted to base currency
    fx_rate = Column(Numeric(19, 6), nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    transaction = relationship("TransactionModel", back_populates="postings")
    account = relationship("AccountModel", back_populates="postings")


class PriceModel(Base):
    """ORM model for Price entity (FX rates or security prices)"""
    __tablename__ = 'prices'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, nullable=False, index=True)
    base_ccy = Column(String(3), nullable=False)
    quote_ccy = Column(String(3), nullable=False)
    rate = Column(Numeric(19, 6), nullable=False)
    source = Column(String(50), nullable=False)  # yahoo_finance, manual, etc.
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ScenarioModel(Base):
    """ORM model for Scenario entity"""
    __tablename__ = 'scenarios'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    assumptions = relationship("ProjectionAssumptionModel", back_populates="scenario", cascade="all, delete-orphan")
    results = relationship("ProjectionResultModel", back_populates="scenario", cascade="all, delete-orphan")


class ProjectionAssumptionModel(Base):
    """ORM model for ProjectionAssumption entity"""
    __tablename__ = 'projection_assumptions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey('scenarios.id'), nullable=False, index=True)
    key = Column(String(255), nullable=False)  # monthly_salary, tax_rate, etc.
    value = Column(Text, nullable=False)  # Stored as string
    currency = Column(String(3))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    scenario = relationship("ScenarioModel", back_populates="assumptions")


class ProjectionResultModel(Base):
    """ORM model for ProjectionResult entity"""
    __tablename__ = 'projection_results'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey('scenarios.id'), nullable=False, index=True)
    period = Column(String(50), nullable=False)  # 2026-01, 2026-Q1, etc.
    metric_key = Column(String(255), nullable=False)  # net_income, savings_rate, etc.
    value = Column(Numeric(19, 4), nullable=False)
    currency = Column(String(3), nullable=False, default='SGD')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    scenario = relationship("ScenarioModel", back_populates="results")
