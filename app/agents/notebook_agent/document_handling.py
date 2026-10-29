import fitz
from .utils import clean_pdf_text


def get_formatted_text(document_path):
    formatted_text = []

    try:
        with fitz.open(document_path) as document:
            for page_number, page in enumerate(document, start=1):

                text = clean_pdf_text(page.get_text('text'))

                formatted_text.append(
                    {
                    'page_number': page_number,
                    'page_text': text
                     }
                )
    except Exception as e:
        print(e)

    return formatted_text

get_formatted_text = get_formatted_text(r'E:\1.0 Ed-Tech\app\agents\notebook_agent\testing.pdf')



print(get_formatted_text[0])
