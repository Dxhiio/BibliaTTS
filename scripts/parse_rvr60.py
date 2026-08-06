import zipfile
import json
import re
import os
import html

EPUB_PATH = r"I:\Calibre\Teologia\Evangelio\De Reina, Casiodoro\Santa Biblia_ Reina-Valera 1960 (2)\Santa Biblia_ Reina-Valera 1960 - De Reina, Casiodoro.epub"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "rvr60.json")

# The exact 66 books mapping with their respective chapter counts
BOOKS = [
    ("Génesis", "GEN", "AT", "Pentateuco", 50),
    ("Éxodo", "EXO", "AT", "Pentateuco", 40),
    ("Levítico", "LEV", "AT", "Pentateuco", 27),
    ("Números", "NUM", "AT", "Pentateuco", 36),
    ("Deuteronomio", "DEU", "AT", "Pentateuco", 34),
    ("Josué", "JOS", "AT", "Históricos", 24),
    ("Jueces", "JUE", "AT", "Históricos", 21),
    ("Rut", "RUT", "AT", "Históricos", 4),
    ("1 Samuel", "1SA", "AT", "Históricos", 31),
    ("2 Samuel", "2SA", "AT", "Históricos", 24),
    ("1 Reyes", "1RE", "AT", "Históricos", 22),
    ("2 Reyes", "2RE", "AT", "Históricos", 25),
    ("1 Crónicas", "1CR", "AT", "Históricos", 29),
    ("2 Crónicas", "2CR", "AT", "Históricos", 36),
    ("Esdras", "ESD", "AT", "Históricos", 10),
    ("Nehemías", "NEH", "AT", "Históricos", 13),
    ("Ester", "EST", "AT", "Históricos", 10),
    ("Job", "JOB", "AT", "Sapienciales", 42),
    ("Salmos", "SAL", "AT", "Sapienciales", 150),
    ("Proverbios", "PRO", "AT", "Sapienciales", 31),
    ("Eclesiastés", "ECL", "AT", "Sapienciales", 12),
    ("Cantar de los Cantares", "CAN", "AT", "Sapienciales", 8),
    ("Isaías", "ISA", "AT", "Profetas Mayores", 66),
    ("Jeremías", "JER", "AT", "Profetas Mayores", 52),
    ("Lamentaciones", "LAM", "AT", "Profetas Mayores", 5),
    ("Ezequiel", "EZE", "AT", "Profetas Mayores", 48),
    ("Daniel", "DAN", "AT", "Profetas Mayores", 12),
    ("Oseas", "OSE", "AT", "Profetas Menores", 14),
    ("Joel", "JOE", "AT", "Profetas Menores", 3),
    ("Amós", "AMO", "AT", "Profetas Menores", 9),
    ("Abdías", "ABD", "AT", "Profetas Menores", 1),
    ("Jonás", "JON", "AT", "Profetas Menores", 4),
    ("Miqueas", "MIQ", "AT", "Profetas Menores", 7),
    ("Nahum", "NAH", "AT", "Profetas Menores", 3),
    ("Habacuc", "HAB", "AT", "Profetas Menores", 3),
    ("Sofonías", "SOF", "AT", "Profetas Menores", 3),
    ("Hageo", "HAG", "AT", "Profetas Menores", 2),
    ("Zacarías", "ZAC", "AT", "Profetas Menores", 14),
    ("Malaquías", "MAL", "AT", "Profetas Menores", 4),
    ("Mateo", "MAT", "NT", "Evangelios", 28),
    ("Marcos", "MAR", "NT", "Evangelios", 16),
    ("Lucas", "LUC", "NT", "Evangelios", 24),
    ("Juan", "JUA", "NT", "Evangelios", 21),
    ("Hechos", "HEC", "NT", "Historia NT", 28),
    ("Romanos", "ROM", "NT", "Cartas de Pablo", 16),
    ("1 Corintios", "1CO", "NT", "Cartas de Pablo", 16),
    ("2 Corintios", "2CO", "NT", "Cartas de Pablo", 13),
    ("Gálatas", "GAL", "NT", "Cartas de Pablo", 6),
    ("Efesios", "EFE", "NT", "Cartas de Pablo", 6),
    ("Filipenses", "FIL", "NT", "Cartas de Pablo", 4),
    ("Colosenses", "COL", "NT", "Cartas de Pablo", 4),
    ("1 Tesalonicenses", "1TE", "NT", "Cartas de Pablo", 5),
    ("2 Tesalonicenses", "2TE", "NT", "Cartas de Pablo", 3),
    ("1 Timoteo", "1TI", "NT", "Cartas de Pablo", 6),
    ("2 Timoteo", "2TI", "NT", "Cartas de Pablo", 4),
    ("Tito", "TIT", "NT", "Cartas de Pablo", 3),
    ("Filemón", "FLM", "NT", "Cartas de Pablo", 1),
    ("Hebreos", "HEB", "NT", "Cartas Generales", 13),
    ("Santiago", "SAN", "NT", "Cartas Generales", 5),
    ("1 Pedro", "1PE", "NT", "Cartas Generales", 5),
    ("2 Pedro", "2PE", "NT", "Cartas Generales", 3),
    ("1 Juan", "1JN", "NT", "Cartas Generales", 5),
    ("2 Juan", "2JN", "NT", "Cartas Generales", 1),
    ("3 Juan", "3JN", "NT", "Cartas Generales", 1),
    ("Judas", "JUD", "NT", "Cartas Generales", 1),
    ("Apocalipsis", "APO", "NT", "Profecía NT", 22)
]

def clean_text(html_str):
    """Strip tags and unescape HTML entities"""
    text = re.sub(r'<[^>]+>', '', html_str)
    return html.unescape(text).strip()

def parse_verses(html_content):
    # Find all <p> tags
    p_tags = re.findall(r'<p[^>]*>(.*?)</p>', html_content, re.IGNORECASE | re.DOTALL)
    
    verses = []
    current_verse_num = None
    current_verse_text = []
    
    for p_content in p_tags:
        # Check if this paragraph contains a verse number: <span class="vnum">NUMBER</span>
        match = re.search(r'<span[^>]*class=["\']?vnum["\']?[^>]*>(\d+)</span>', p_content, re.IGNORECASE)
        
        if match:
            # We found a new verse!
            v_num = int(match.group(1))
            
            # If we were tracking a previous verse, save it
            if current_verse_num is not None:
                combined_text = " ".join(current_verse_text)
                combined_text = re.sub(r'\s+', ' ', combined_text).strip()
                verses.append({
                    "number": current_verse_num,
                    "text": combined_text
                })
            
            # Remove the <span class="vnum">...</span> part so we don't include the number in the text
            # Wait, we can just strip all tags, but we want to exclude the verse number itself from the text.
            # Easiest way: remove the match and everything before it if it's just links.
            # Actually, `clean_text` will leave the number. Let's remove the span entirely.
            p_no_num = re.sub(r'<a[^>]*><span[^>]*class=["\']?vnum["\']?[^>]*>\d+</span></a>', '', p_content, flags=re.IGNORECASE)
            p_no_num = re.sub(r'<span[^>]*class=["\']?vnum["\']?[^>]*>\d+</span>', '', p_no_num, flags=re.IGNORECASE)
            
            current_verse_num = v_num
            current_verse_text = [clean_text(p_no_num)]
        else:
            # No verse number, could be continuation of previous verse or chapter title/index.
            # We only append to current_verse_text if we have already started tracking a verse.
            # This automatically skips the index pages and titles before verse 1!
            if current_verse_num is not None:
                current_verse_text.append(clean_text(p_content))
                
    # Don't forget to save the last verse
    if current_verse_num is not None:
        combined_text = " ".join(current_verse_text)
        combined_text = re.sub(r'\s+', ' ', combined_text).strip()
        verses.append({
            "number": current_verse_num,
            "text": combined_text
        })
        
    return verses

def run():
    print(f"Abriendo {EPUB_PATH}...")
    bible_data = {
        "version": "RVR60",
        "name": "Reina-Valera 1960",
        "books": []
    }
    
    try:
        with zipfile.ZipFile(EPUB_PATH, 'r') as archive:
            file_index = 4
            for book_idx, (name, abbr, testament, group, chapters_count) in enumerate(BOOKS):
                book_obj = {
                    "id": book_idx + 1,
                    "name": name,
                    "abbr": abbr,
                    "testament": testament,
                    "group": group,
                    "chapters": []
                }
                
                print(f"Procesando {name} ({chapters_count} capítulos)...")
                
                for chapter_num in range(1, chapters_count + 1):
                    file_name = f"OEBPS/Text/part{file_index:04d}.xhtml"
                    try:
                        content = archive.read(file_name).decode('utf-8', errors='ignore')
                        verses = parse_verses(content)
                        
                        book_obj["chapters"].append({
                            "number": chapter_num,
                            "verses": verses
                        })
                    except Exception as e:
                        print(f"Error leyendo {file_name}: {e}")
                        
                    file_index += 1
                    
                bible_data["books"].append(book_obj)
                
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(bible_data, f, ensure_ascii=False, separators=(',', ':'))
            
        print(f"\n¡Éxito! Generado: {OUTPUT_PATH}")
        print(f"Tamaño: {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MB")
        
    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    run()
