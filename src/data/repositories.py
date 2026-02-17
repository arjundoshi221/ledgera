"""Repository pattern implementations for data access"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    UserModel, WorkspaceModel, AccountModel, TransactionModel, PostingModel,
    CategoryModel, SubcategoryModel, FundModel, FundAllocationOverrideModel, TagModel, PriceModel, ScenarioModel
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


class UserRepository(BaseRepository):
    """Repository for User entities"""

    def create(self, user: UserModel) -> UserModel:
        self.session.add(user)
        self.session.commit()
        return user

    def read(self, user_id) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(UserModel.id == str(user_id)).first()

    def read_by_email(self, email: str) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(UserModel.email == email).first()

    def update(self, user: UserModel) -> UserModel:
        user.updated_at = datetime.utcnow()
        self.session.commit()
        return user

    def delete(self, user_id: UUID) -> None:
        user = self.read(user_id)
        if user:
            self.session.delete(user)
            self.session.commit()


class WorkspaceRepository(BaseRepository):
    """Repository for Workspace entities"""

    def create(self, workspace: WorkspaceModel) -> WorkspaceModel:
        self.session.add(workspace)
        self.session.commit()
        return workspace

    def read(self, workspace_id) -> Optional[WorkspaceModel]:
        return self.session.query(WorkspaceModel).filter(WorkspaceModel.id == str(workspace_id)).first()

    def read_by_owner(self, owner_user_id) -> List[WorkspaceModel]:
        return self.session.query(WorkspaceModel).filter(
            WorkspaceModel.owner_user_id == str(owner_user_id)
        ).all()

    def update(self, workspace: WorkspaceModel) -> WorkspaceModel:
        workspace.updated_at = datetime.utcnow()
        self.session.commit()
        return workspace

    def delete(self, workspace_id: UUID) -> None:
        workspace = self.read(workspace_id)
        if workspace:
            self.session.delete(workspace)
            self.session.commit()


class AccountRepository(BaseRepository):
    """Repository for Account entities"""

    def create(self, account: AccountModel) -> AccountModel:
        self.session.add(account)
        self.session.commit()
        return account

    def read(self, account_id) -> Optional[AccountModel]:
        return self.session.query(AccountModel).filter(AccountModel.id == str(account_id)).first()

    def read_all(self) -> List[AccountModel]:
        return self.session.query(AccountModel).all()

    def read_by_workspace(self, workspace_id: str) -> List[AccountModel]:
        return self.session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id
        ).all()

    def read_for_workspace(self, account_id, workspace_id: str) -> Optional[AccountModel]:
        return self.session.query(AccountModel).filter(
            AccountModel.id == str(account_id),
            AccountModel.workspace_id == workspace_id
        ).first()

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

    def read(self, transaction_id) -> Optional[TransactionModel]:
        return self.session.query(TransactionModel).filter(TransactionModel.id == str(transaction_id)).first()

    def read_by_account(
        self,
        account_id,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> List[TransactionModel]:
        """Get transactions for an account in date range"""
        query = self.session.query(TransactionModel).join(
            PostingModel,
            TransactionModel.id == PostingModel.transaction_id
        ).filter(PostingModel.account_id == str(account_id))

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

    def read(self, category_id: str) -> Optional[CategoryModel]:
        return self.session.query(CategoryModel).filter(CategoryModel.id == str(category_id)).first()

    def read_by_workspace(self, workspace_id: str) -> List[CategoryModel]:
        return self.session.query(CategoryModel).filter(
            CategoryModel.workspace_id == workspace_id
        ).all()

    def read_by_workspace_and_type(self, workspace_id: str, category_type: str) -> List[CategoryModel]:
        return self.session.query(CategoryModel).filter(
            CategoryModel.workspace_id == workspace_id,
            CategoryModel.type == category_type
        ).all()

    def read_by_name(self, name: str) -> Optional[CategoryModel]:
        return self.session.query(CategoryModel).filter(CategoryModel.name == name).first()

    def update(self, category: CategoryModel) -> CategoryModel:
        category.updated_at = datetime.utcnow()
        self.session.commit()
        return category

    def delete(self, category_id: str) -> None:
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

    def read(self, scenario_id) -> Optional[ScenarioModel]:
        return self.session.query(ScenarioModel).filter(ScenarioModel.id == str(scenario_id)).first()

    def read_all(self) -> List[ScenarioModel]:
        return self.session.query(ScenarioModel).all()

    def read_by_workspace(self, workspace_id: str) -> List[ScenarioModel]:
        return self.session.query(ScenarioModel).filter(
            ScenarioModel.workspace_id == workspace_id
        ).order_by(ScenarioModel.updated_at.desc()).all()

    def read_active(self, workspace_id: str) -> Optional[ScenarioModel]:
        return self.session.query(ScenarioModel).filter(
            ScenarioModel.workspace_id == workspace_id,
            ScenarioModel.is_active == True
        ).first()

    def deactivate_all(self, workspace_id: str) -> None:
        self.session.query(ScenarioModel).filter(
            ScenarioModel.workspace_id == workspace_id,
            ScenarioModel.is_active == True
        ).update({"is_active": False, "updated_at": datetime.utcnow()})
        self.session.flush()

    def activate(self, scenario_id: str, workspace_id: str) -> Optional[ScenarioModel]:
        self.deactivate_all(workspace_id)
        scenario = self.session.query(ScenarioModel).filter(
            ScenarioModel.id == scenario_id,
            ScenarioModel.workspace_id == workspace_id
        ).first()
        if scenario:
            scenario.is_active = True
            scenario.updated_at = datetime.utcnow()
            self.session.commit()
        return scenario

    def update(self, scenario: ScenarioModel) -> ScenarioModel:
        scenario.updated_at = datetime.utcnow()
        self.session.commit()
        return scenario

    def delete(self, scenario_id) -> None:
        scenario = self.read(scenario_id)
        if scenario:
            self.session.delete(scenario)
            self.session.commit()


class SubcategoryRepository(BaseRepository):
    """Repository for Subcategory entities"""

    def create(self, subcategory: SubcategoryModel) -> SubcategoryModel:
        self.session.add(subcategory)
        self.session.commit()
        return subcategory

    def read(self, subcategory_id: str) -> Optional[SubcategoryModel]:
        return self.session.query(SubcategoryModel).filter(
            SubcategoryModel.id == str(subcategory_id)
        ).first()

    def read_by_category(self, category_id: str) -> List[SubcategoryModel]:
        return self.session.query(SubcategoryModel).filter(
            SubcategoryModel.category_id == category_id
        ).all()

    def update(self, subcategory: SubcategoryModel) -> SubcategoryModel:
        subcategory.updated_at = datetime.utcnow()
        self.session.commit()
        return subcategory

    def delete(self, subcategory_id: str) -> None:
        subcategory = self.read(subcategory_id)
        if subcategory:
            self.session.delete(subcategory)
            self.session.commit()


class FundRepository(BaseRepository):
    """Repository for Fund entities"""

    def create(self, fund: FundModel) -> FundModel:
        self.session.add(fund)
        self.session.commit()
        return fund

    def read(self, fund_id: str) -> Optional[FundModel]:
        return self.session.query(FundModel).filter(FundModel.id == str(fund_id)).first()

    def read_by_workspace(self, workspace_id: str) -> List[FundModel]:
        return self.session.query(FundModel).filter(
            FundModel.workspace_id == workspace_id,
            FundModel.is_active == True
        ).all()

    def read_all_by_workspace(self, workspace_id: str) -> List[FundModel]:
        return self.session.query(FundModel).filter(
            FundModel.workspace_id == workspace_id
        ).all()

    def update(self, fund: FundModel) -> FundModel:
        fund.updated_at = datetime.utcnow()
        self.session.commit()
        return fund

    def delete(self, fund_id: str) -> None:
        fund = self.read(fund_id)
        if fund:
            self.session.delete(fund)
            self.session.commit()


class FundAllocationOverrideRepository(BaseRepository):
    """Repository for FundAllocationOverride entities"""

    def create(self, override: FundAllocationOverrideModel) -> FundAllocationOverrideModel:
        self.session.add(override)
        self.session.commit()
        return override

    def read(self, override_id: str) -> Optional[FundAllocationOverrideModel]:
        return self.session.query(FundAllocationOverrideModel).filter(
            FundAllocationOverrideModel.id == str(override_id)
        ).first()

    def read_by_fund_and_period(
        self,
        workspace_id: str,
        fund_id: str,
        year: int,
        month: int
    ) -> Optional[FundAllocationOverrideModel]:
        """Get override for specific fund and month"""
        return self.session.query(FundAllocationOverrideModel).filter(
            FundAllocationOverrideModel.workspace_id == workspace_id,
            FundAllocationOverrideModel.fund_id == fund_id,
            FundAllocationOverrideModel.year == year,
            FundAllocationOverrideModel.month == month
        ).first()

    def read_by_period(
        self,
        workspace_id: str,
        year: int,
        month: int
    ) -> List[FundAllocationOverrideModel]:
        """Get all overrides for a specific month"""
        return self.session.query(FundAllocationOverrideModel).filter(
            FundAllocationOverrideModel.workspace_id == workspace_id,
            FundAllocationOverrideModel.year == year,
            FundAllocationOverrideModel.month == month
        ).all()

    def read_by_workspace(self, workspace_id: str) -> List[FundAllocationOverrideModel]:
        """Get all overrides for a workspace"""
        return self.session.query(FundAllocationOverrideModel).filter(
            FundAllocationOverrideModel.workspace_id == workspace_id
        ).all()

    def update(self, override: FundAllocationOverrideModel) -> FundAllocationOverrideModel:
        override.updated_at = datetime.utcnow()
        self.session.commit()
        return override

    def delete(self, override_id: str) -> None:
        override = self.read(override_id)
        if override:
            self.session.delete(override)
            self.session.commit()

    def delete_by_fund_and_period(
        self,
        workspace_id: str,
        fund_id: str,
        year: int,
        month: int
    ) -> None:
        """Delete override for specific fund and month"""
        override = self.read_by_fund_and_period(workspace_id, fund_id, year, month)
        if override:
            self.session.delete(override)
            self.session.commit()
