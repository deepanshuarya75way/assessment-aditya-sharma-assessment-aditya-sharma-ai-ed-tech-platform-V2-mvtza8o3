from datetime import datetime, timedelta
from core.config import jwt_settings
from fastapi import Depends, HTTPException, status, Request
from core import database, models, schemas
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


def create_access_token(data: dict):
    to_encode = data.copy()
    expiry = datetime.now() + timedelta(minutes=jwt_settings.ACCESS_TOKEN_EXPIRE_MINUTES)  # set expiry time
    to_encode.update({"exp": expiry}) # add expiry time in the payload to know about expiry time

    encoded_jwt = jwt.encode(to_encode, algorithm=jwt_settings.ALGORITHM, key=jwt_settings.SECRET_KEY) # use jwt.encode to encode payload and secret key to create a token
    # this encoded_jwt is a string which is the token we will send to the client and client will send it back in the headers for authentication and authorization
    # after successful login this encoded token will be given
    return encoded_jwt


def verify_access_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, jwt_settings.SECRET_KEY, algorithms=[jwt_settings.ALGORITHM])
        id = payload.get("id") # fetch id from the payload to know which user is logged in and also we can fetch other details if we want to
        first_name = payload.get("first_name")

        if id is None:
            raise credentials_exception
        token_data = schemas.TokenData(id=int(id), first_name=first_name)
    except JWTError:
        raise credentials_exception

    return token_data


async def get_current_user(request: Request, db: AsyncSession = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )

    token = request.cookies.get("access_token")
    if not token:
        raise credentials_exception

    token_data = verify_access_token(token, credentials_exception)

    result = await db.execute(
        select(models.user_model.User).filter(models.user_model.User.id == token_data.id)
    )
    user = result.scalars().first()

    if not user:
        raise credentials_exception

    return int(user.id)

# jwt.encode() & jwt.decode() for verification at each request
# to get headers and tokens we use request: Request in fastapi to get cookies and browser stuff and after getting it we verify

