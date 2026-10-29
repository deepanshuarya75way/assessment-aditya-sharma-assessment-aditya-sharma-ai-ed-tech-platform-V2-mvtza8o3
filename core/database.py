from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("POSTGRE_DB_URL")

engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as db:
        yield db




# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker
# from sqlalchemy.ext.declarative import declarative_base
# from .config import db_settings as settings
# from dotenv import load_dotenv
# import os
# load_dotenv()


# SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRE_DB_URL")


# engine = create_engine(SQLALCHEMY_DATABASE_URL)

# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = declarative_base()


# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

#
# first we create engine. engine is actually the main thing here it connects sqlalchemy was the database and converts sqlalchemy functions into sql queries
#
# second we create sessionmaker() function which establish a connection for proper transactions so that we can commit or rollback transactions if something goes wrong
#
# third is Base = declarative_base() we use this when we want to create a class which creates table so we inherit it to create tables in our database
