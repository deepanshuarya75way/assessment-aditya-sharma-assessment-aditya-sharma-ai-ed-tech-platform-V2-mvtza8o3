import fitz

def is_text_pdf(path: str, min_chars: int = 50) -> bool:
    text = ""
    with fitz.open(path) as doc:
        for page in doc:
            text += page.get_text()
            if len(text) >= min_chars:
                return True
    return False