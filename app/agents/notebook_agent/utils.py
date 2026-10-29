import re



def clean_pdf_text(text: str) -> str:

    # Normalize line endings
    text = text.replace("\r", "\n")

    # Remove excessive empty lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove repeated dots
    text = re.sub(r"\.{3,}", " ", text)

    # Remove repeated symbols
    text = re.sub(r"[@#$%^&*_=+~`|<>]{3,}", " ", text)

    # Remove repeated separators
    text = re.sub(r"[-_]{3,}", " ", text)

    # Remove excessive punctuation spam
    text = re.sub(r"[!?;:,]{3,}", " ", text)

    # Normalize spaces but preserve newlines
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()




