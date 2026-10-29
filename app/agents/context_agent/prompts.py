from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

rewrite_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a query-rewrite assistant for an educational Q&A platform. "
                "Your job is to rewrite the user's latest question into a clear, standalone "
                "query that is grounded in the recent conversation context and suitable for "
                "retrieval. The system does not know the document content in advance; users "
                "can upload different documents. Do not add facts. Do not assume missing "
                "details. If the latest question is already clear and standalone, return it "
                "unchanged.\n\n"
                "Rules:\n"
                "- Use only the last 5 messages as context.\n"
                "- Preserve the user's intent and constraints.\n"
                "- Resolve pronouns or references (e.g., “it”, “that”, “this”) using the context.\n"
                "- Keep it concise, but preserve ALL distinct topics and multiple questions if provided in a list.\n"
                "- Do not answer the question.\n"
                "- Output only the rewritten query text."
            ),
        ),
        MessagesPlaceholder(variable_name = "chat_history"),
        ("human", "{user_query}"),
    ]
)

retrieval_decision_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You decide whether external documents are needed to answer the user's question. \n"
                "If the user uses words like 'this document', 'from these', 'use docs', 'based on the text' similar, then retrieval is needed. \n"
                "Use the provided schema for your response. Do not answer the question."
            ),
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{user_query}"),
    ]
)

headings_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You break down the user's query into individual questions or distinct topics and generate headings for each. \n"
                "If the query contains a list of topics, multiple requests, or multiple questions, extract EACH ONE as a separate question/topic. \n"
                "IMPORTANT: Look closely at the user query to see if they specify a number of points/headings (e.g., 'give 3 points', 'list 4 things'). "
                "If they do, return EXACTLY that number of headings for each extracted question or topic. \n"
                "If no number is specified, default to 5 headings per question/topic. \n"
                "The headings should NEVER be overlapping in content. They should be distinct and cover different aspects of the answer.\n"
                "{context_instructions}\n\n"
                "Retrieved Context:\n{retrieved_context}\n\n"
                "Use the provided schema. Do not answer the question.\n"
            ),
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{user_query}"),
    ]
)

heading_answer_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You write a concise, explanatory answer for a single bullet point/heading. "
                "Use simple, easy-to-understand language to explain the concept, but DO NOT miss or omit important technical keywords. "
                "DO NOT include formulas, examples, or analogies in the `explanation` field itself. "
                "Instead, put formulas in the `formulas` list, examples in the `examples` list. "
                "Provide an analogy in the `analogies` string ONLY if the topic contains complex keywords or if the user EXPLICITLY asked for it (otherwise omit). "
                "Use the provided schema to strictly format your response. Do not introduce new headings.\n\n"
                "{context_instructions}\n\n"
                "Retrieved Context:\n{retrieved_context}"
            ),
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "Question: {user_query}\nHeading/Bullet Point: {heading}"),
    ]
)
