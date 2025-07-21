import sys
from TTS.api import TTS

if len(sys.argv) < 3:
    print("Usage: python yuki_tts.py <text> <output_path>")
    sys.exit(1)

text = sys.argv[1]
output_path = sys.argv[2]

tts = TTS(model_name="tts_models/ar/mai/tts", progress_bar=False)
tts.tts_to_file(text=text, file_path=output_path) 