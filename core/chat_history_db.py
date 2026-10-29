from pymongo import MongoClient
from pymongo.server_api import ServerApi
from core.config import mongoDB

client = MongoClient(f"mongodb+srv://{mongoDB.MONGO_USERNAME}:{mongoDB.MONGO_PASSWORD}@{mongoDB.MONGO_CLUSTER}.{mongoDB.MONGO_KEY}.mongodb.net/?appName={mongoDB.MONGO_CLUSTER}", server_api=ServerApi('1'))

db = client["chatbot_db"]

chat_sessions = db["chat_sessions"]
messages = db["messages"]


