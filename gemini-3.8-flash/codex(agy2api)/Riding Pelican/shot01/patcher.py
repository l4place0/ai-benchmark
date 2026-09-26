with open("Riding Pelican/shot01/build_svg_revised.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(175, 186):
    print(f"{i+1}: {repr(lines[i])}")
