"""Category, Subcategory, and Fund endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.data.database import get_session
from src.data.repositories import CategoryRepository, SubcategoryRepository, FundRepository
from src.data.models import CategoryModel, SubcategoryModel, FundModel
from src.api.schemas import (
    CategoryCreate, CategoryResponse,
    SubcategoryCreate, SubcategoryResponse,
    FundCreate, FundResponse
)
from src.api.deps import get_workspace_id

router = APIRouter()


# =====================
# Categories
# =====================

@router.post("/", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new category in the current workspace"""
    db_category = CategoryModel(
        workspace_id=workspace_id,
        name=category.name,
        emoji=category.emoji,
        type=category.type,
        description=category.description
    )
    
    repo = CategoryRepository(session)
    repo.create(db_category)
    
    return db_category


@router.get("/", response_model=list[CategoryResponse])
def list_categories(
    workspace_id: str = Depends(get_workspace_id),
    category_type: str = None,
    session: Session = Depends(get_session)
):
    """List all categories in the current workspace"""
    repo = CategoryRepository(session)

    if category_type:
        categories = repo.read_by_workspace_and_type(workspace_id, category_type)
    else:
        categories = repo.read_by_workspace(workspace_id)

    return categories


# =====================
# Subcategories
# =====================

@router.post("/subcategories", response_model=SubcategoryResponse)
def create_subcategory(
    subcategory: SubcategoryCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new subcategory"""
    # Verify category exists and belongs to workspace
    cat_repo = CategoryRepository(session)
    category = cat_repo.read(subcategory.category_id)
    
    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_subcategory = SubcategoryModel(
        category_id=subcategory.category_id,
        name=subcategory.name,
        description=subcategory.description
    )
    
    repo = SubcategoryRepository(session)
    repo.create(db_subcategory)
    
    return db_subcategory


@router.get("/subcategories", response_model=list[SubcategoryResponse])
def list_subcategories(
    category_id: str = None,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List subcategories (optionally filter by category)"""
    repo = SubcategoryRepository(session)
    
    if category_id:
        # Verify category belongs to workspace
        cat_repo = CategoryRepository(session)
        category = cat_repo.read(category_id)
        if not category or category.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Category not found")
        
        subcategories = repo.read_by_category(category_id)
    else:
        # Get all subcategories for workspace categories
        cat_repo = CategoryRepository(session)
        categories = cat_repo.read_by_workspace(workspace_id)
        subcategories = [
            sub for category in categories 
            for sub in repo.read_by_category(category.id)
        ]
    
    return subcategories


@router.get("/subcategories/{subcategory_id}", response_model=SubcategoryResponse)
def get_subcategory(
    subcategory_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get subcategory by ID"""
    repo = SubcategoryRepository(session)
    subcategory = repo.read(subcategory_id)
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    # Verify category belongs to workspace
    cat_repo = CategoryRepository(session)
    category = cat_repo.read(subcategory.category_id)
    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return subcategory


@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryResponse)
def update_subcategory(
    subcategory_id: str,
    subcategory_data: SubcategoryCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update subcategory"""
    repo = SubcategoryRepository(session)
    subcategory = repo.read(subcategory_id)
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    # Verify old category belongs to workspace
    cat_repo = CategoryRepository(session)
    old_category = cat_repo.read(subcategory.category_id)
    if not old_category or old_category.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify new category exists and belongs to workspace
    new_category = cat_repo.read(subcategory_data.category_id)
    if not new_category or new_category.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    subcategory.category_id = subcategory_data.category_id
    subcategory.name = subcategory_data.name
    subcategory.description = subcategory_data.description
    
    repo.update(subcategory)
    return subcategory


@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(
    subcategory_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete subcategory"""
    repo = SubcategoryRepository(session)
    subcategory = repo.read(subcategory_id)
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    # Verify category belongs to workspace
    cat_repo = CategoryRepository(session)
    category = cat_repo.read(subcategory.category_id)
    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    repo.delete(subcategory_id)
    return {"message": "Subcategory deleted"}


# =====================
# Funds
# =====================

def _build_fund_response(fund: FundModel) -> dict:
    """Build a FundResponse dict with linked accounts and allocation %."""
    return {
        "id": fund.id,
        "name": fund.name,
        "emoji": fund.emoji,
        "description": fund.description,
        "allocation_percentage": fund.allocation_percentage,
        "is_active": fund.is_active,
        "is_system": fund.is_system,
        "created_at": fund.created_at,
        "linked_accounts": [
            {
                "id": link.account.id,
                "name": link.account.name,
                "institution": link.account.institution,
                "account_currency": link.account.account_currency,
                "allocation_percentage": link.allocation_percentage,
            }
            for link in (fund.account_links or [])
        ],
    }


@router.post("/funds", response_model=FundResponse)
def create_fund(
    fund: FundCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new fund in the current workspace"""
    db_fund = FundModel(
        workspace_id=workspace_id,
        name=fund.name,
        emoji=fund.emoji,
        description=fund.description,
        allocation_percentage=fund.allocation_percentage
    )

    repo = FundRepository(session)
    repo.create(db_fund)

    # Prefer account_allocations over legacy account_ids
    allocations = fund.account_allocations or [
        {"account_id": aid, "allocation_percentage": 100} for aid in fund.account_ids
    ]
    if allocations:
        try:
            repo.set_account_links(db_fund, [a.dict() if hasattr(a, 'dict') else a for a in allocations], workspace_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return _build_fund_response(db_fund)


@router.get("/funds", response_model=list[FundResponse])
def list_funds(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all active funds in the current workspace"""
    repo = FundRepository(session)
    funds = repo.read_by_workspace(workspace_id)

    return [_build_fund_response(f) for f in funds]


@router.get("/funds/{fund_id}", response_model=FundResponse)
def get_fund(
    fund_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get fund by ID"""
    repo = FundRepository(session)
    fund = repo.read(fund_id)

    if not fund or fund.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Fund not found")

    return _build_fund_response(fund)


@router.put("/funds/{fund_id}", response_model=FundResponse)
def update_fund(
    fund_id: str,
    fund_data: FundCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update fund"""
    repo = FundRepository(session)
    fund = repo.read(fund_id)

    if not fund or fund.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Fund not found")

    fund.name = fund_data.name
    fund.emoji = fund_data.emoji
    fund.description = fund_data.description
    fund.allocation_percentage = fund_data.allocation_percentage

    # Prefer account_allocations over legacy account_ids
    allocations = fund_data.account_allocations or [
        {"account_id": aid, "allocation_percentage": 100} for aid in fund_data.account_ids
    ]
    try:
        repo.set_account_links(fund, [a.dict() if hasattr(a, 'dict') else a for a in allocations], workspace_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    repo.update(fund)
    return _build_fund_response(fund)


@router.delete("/funds/{fund_id}")
def delete_fund(
    fund_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete fund"""
    repo = FundRepository(session)
    fund = repo.read(fund_id)

    if not fund or fund.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Fund not found")

    if fund.is_system:
        raise HTTPException(status_code=400, detail="System funds cannot be deleted")

    repo.delete(fund_id)
    return {"message": "Fund deleted"}


# =====================
# Category CRUD by ID (must come after subcategories and funds routes)
# =====================

@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get category by ID"""
    repo = CategoryRepository(session)
    category = repo.read(category_id)

    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Category not found")

    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    category_data: CategoryCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update category"""
    repo = CategoryRepository(session)
    category = repo.read(category_id)

    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Category not found")

    category.name = category_data.name
    category.emoji = category_data.emoji
    category.type = category_data.type
    category.description = category_data.description

    repo.update(category)
    return category


@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete category"""
    repo = CategoryRepository(session)
    category = repo.read(category_id)

    if not category or category.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Category not found")

    if category.is_system:
        raise HTTPException(status_code=400, detail="System categories cannot be deleted")

    repo.delete(category_id)
    return {"message": "Category deleted"}
