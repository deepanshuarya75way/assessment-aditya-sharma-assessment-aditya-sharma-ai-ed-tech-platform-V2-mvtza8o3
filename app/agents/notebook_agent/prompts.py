from langchain_core.prompts import ChatPromptTemplate

notes_generation_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are an expert academic synthesis AI. Your job is to generate comprehensive, "
            "well-structured notes from the provided text window of a book. "
            "Your output must be formatted in clean Markdown, using headings (##, ###), bullet points, and bold text for key terms. "
            "If previous notes exist, DO NOT repeat the concepts already covered in the previous notes, "
            "but DO ensure that your new notes flow logically from the previous context. "
            "Focus only on extracting the most important concepts, formulas, examples, and definitions from the CURRENT text window.\n\n"
            "Previous Notes Context:\n{previous_notes}"
        )
    ),
    (
        "human", 
        "Current Text Window to Summarize:\n\n{current_window_text}"
    )
])
