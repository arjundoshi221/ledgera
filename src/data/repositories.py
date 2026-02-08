"""Repository pattern implementations for data access"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    AccountModel, TransactionModel, PostingModel, CategoryModel,
    TagModel, PriceModel, ScenarioModel
)


class BaseRepository(ABC):
    """Abstract base repository"""

    def __init__(self, session: Session):
        self.session = session

    @abstractmethod
    def create(self, entity):
        """Create entity"""
        pass

    @abstractmethod
    def read(self, entity_id: UUID):
        """Read entity by ID"""
        pass

    @abstractmethod
    def update(self, entity):
        """Update entity"""
        pass

    @abstractmethod
    def delete(self, entity_id: UUID):
        """Delete entity"""
        pass


class AccountRepository(BaseRepository):
    """Repository for Account entities"""

    def create(self, account: AccountModel) -> AccountModel:
        self.session.add(account)
        self.session.commit()
        return account

    def read(self, account_id: UUID) -> Optional[AccountModel]:
        return self.session.query(AccountModel).filter(AccountModel.id == account_id).first()

    def read_all(self) -> List[AccountModel]:
        return self.session.query(AccountModel).all()

    def update(self, account: AccountModel) -> AccountModel:
        account.updated_at = datetime.utcnow()
        self.session.commit()
        return account

    def delete(self, account_id: UUID) -> None:
        account = self.read(account_id)
        if account:
            self.session.delete(account)
            self.session.commit()


class TransactionRepository(BaseRepository):
    """Repository for Transaction entities"""

    def create(self, transaction: TransactionModel) -> TransactionModel:
        self.session.add(transaction)
        self.session.commit()
        return transaction

    def read(self, transaction_id: UUID) -> Optional[TransactionModel]:
        return self.session.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()

    def read_by_account(
        self,
        account_id: UUID,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> List[TransactionModel]:
        """Get transactions for an account in date range"""
        query = self.session.query(TransactionModel).join(
            PostingModel,
            TransactionModel.id == PostingModel.transaction_id
        ).filter(PostingModel.account_id == account_id)

        if start_date:
            query = query.filter(TransactionModel.timestamp >= start_date)
        if end_date:
            query = query.filter(TransactionModel.timestamp <= end_date)

        return query.order_by(TransactionModel.timestamp).all()

    def update(self, transaction: TransactionModel) -> TransactionModel:
        transaction.updated_at = datetime.utcnow()
        self.session.commit()
        return transaction

    def delete(self, transaction_id: UUID) -> None:
        transaction = self.read(transaction_id)
        if transaction:
            self.session.delete(transaction)
            self.session.commit()


class CategoryRepository(BaseRepository):
    """Repository for Category entities"""

    def create(self, category: CategoryModel) -> CategoryModel:
        self.session.add(category)
        self.session.commit()
        return category

    def read(self, category_id: UUID) -> Optional[CategoryModel]:
        return self.session.query(CategoryModel).filter(CategoryModel.id == category_id).first()

    def read_all(self) -> List[CategoryModel]:
        return self.session.query(CategoryModel).all()

    def read_by_name(self, name: str) -> Optional[CategoryModel]:
        return self.session.query(CategoryModel).filter(CategoryModel.name == name).first()

    def update(self, category: CategoryModel) -> CategoryModel:
        self.session.commit()
        return category

    def delete(self, category_id: UUID) -> None:
        category = self.read(category_id)
        if category:
            self.session.delete(category)
            self.session.commit()


class PriceRepository(BaseRepository):
    """Repository for Price entities (FX rates, security prices)"""

    def create(self, price: PriceModel) -> PriceModel:
        self.session.add(price)
        self.session.commit()
        return price

    def read(self, price_id: UUID) -> Optional[PriceModel]:
        return self.session.query(PriceModel).filter(PriceModel.id == price_id).first()

    def read_latest_rate(
        self,
        base_ccy: str,
        quote_ccy: str
    ) -> Optional[PriceModel]:
        """Get latest FX rate between two currencies"""
        return self.session.query(PriceModel).filter(
            PriceModel.base_ccy == base_ccy,
            PriceModel.quote_ccy == quote_ccy
        ).order_by(PriceModel.timestamp.desc()).first()

    def update(self, price: PriceModel) -> PriceModel:
        self.session.commit()
        return price

    def delete(self, price_id: UUID) -> None:
        price = self.read(price_id)
        if price:
            self.session.delete(price)
            self.session.commit()


class ScenarioRepository(BaseRepository):
    """Repository for Scenario entities"""

    def create(self, scenario: ScenarioModel) -> ScenarioModel:
        self.session.add(scenario)
        self.session.commit()
        return scenario

    def read(self, scenario_id: UUID) -> Optional[ScenarioModel]:
        return self.session.query(ScenarioModel).filter(ScenarioModel.id == scenario_id).first()

    def read_all(self) -> List[ScenarioModel]:
        return self.session.query(ScenarioModel).all()

    def update(self, scenario: ScenarioModel) -> ScenarioModel:
        scenario.updated_at = datetime.utcnow()
        self.session.commit()
        return scenario

    def delete(self, scenario_id: UUID) -> None:
        scenario = self.read(scenario_id)
        if scenario:
            self.session.delete(scenario)
            self.session.commit()
