from fastapi import Depends, APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from core import schemas
from core.database import get_db
from core.models import user_model
from OAuth2 import OAuth2
from ..utils import hashing

router = APIRouter(
    prefix="/profile",
    tags=["profile"]
)

@router.get("/me", status_code=status.HTTP_200_OK, response_model=schemas.UserProfileOut)
async def get_profile(db: AsyncSession = Depends(get_db), id: int = Depends(OAuth2.get_current_user)):
    result = await db.execute(select(user_model.User).filter(user_model.User.id == id))
    user_data = result.scalars().first()
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user_data

@router.put("/me", status_code=status.HTTP_200_OK, response_model=schemas.UserProfileOut)
async def update_details(user_details: schemas.UserData, db: AsyncSession = Depends(get_db), id: int = Depends(OAuth2.get_current_user)):
    result = await db.execute(select(user_model.User).filter(user_model.User.id == id))
    user_data = result.scalars().first()

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_data = user_details.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user_data, field, value)

    try:
        await db.commit()
        await db.refresh(user_data)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already in use")

    return user_data


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(password: schemas.PassWord, db: AsyncSession = Depends(get_db), id: int = Depends(OAuth2.get_current_user)):
    result = await db.execute(select(user_model.User).filter(user_model.User.id == id))
    user_data = result.scalars().first()

    if not user_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    if not hashing.verify_password(
        password.current_password,
        user_data.password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    user_data.password = hashing.hash_password(
        password.new_password
    )

    await db.commit()
