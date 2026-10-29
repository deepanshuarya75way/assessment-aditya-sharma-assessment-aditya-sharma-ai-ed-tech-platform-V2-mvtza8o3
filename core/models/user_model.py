from ..database import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.sql.expression import text

class User(Base):
    __tablename__ = 'users_database'
    id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, default="")
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    date_joined = Column(TIMESTAMP(timezone=True), nullable=False, default=text('now()'))

