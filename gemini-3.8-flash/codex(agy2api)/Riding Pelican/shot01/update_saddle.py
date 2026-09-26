with open("Riding Pelican/shot01/build_svg_revised.py", "r", encoding="utf-8") as f:
    text = f.read()

# Fix unterminated string
text = text.replace("emit('  </g>\\n')", "emit('  </g>\\n')")
# Or simpler:
text = text.replace("emit('  </g>\n')", "emit('  </g>')\n    emit('\\n')")

with open("Riding Pelican/shot01/build_svg_revised.py", "w", encoding="utf-8") as f:
    f.write(text)
