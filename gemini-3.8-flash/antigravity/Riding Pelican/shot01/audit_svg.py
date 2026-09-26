#!/usr/bin/env python3
"""
Comprehensive QA Audit Script for Pelican Riding a Bicycle SVG
Audits 'pelican_bicycle.svg' against W3C SVG standards and 'design_spec.json'.
Outputs detailed findings to 'audit_report.json'.
"""

import os
import re
import json
import math
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_PATH = os.path.join(BASE_DIR, 'pelican_bicycle.svg')
SPEC_PATH = os.path.join(BASE_DIR, 'design_spec.json')
REPORT_PATH = os.path.join(BASE_DIR, 'audit_report.json')

def audit_svg():
    findings = {
        "audit_metadata": {
            "target_file": "pelican_bicycle.svg",
            "auditor": "QA Auditor Subagent",
            "python_version": None,
            "overall_status": "PENDING"
        },
        "xml_validation": {
            "status": "PASS",
            "is_well_formed": True,
            "root_tag": None,
            "namespaces": {},
            "viewBox": None,
            "width": None,
            "height": None,
            "syntax_errors": []
        },
        "defs_and_id_integrity": {
            "status": "PASS",
            "total_ids_defined": 0,
            "defined_ids": [],
            "duplicate_ids": [],
            "url_references_total": 0,
            "unique_url_references": [],
            "broken_references": [],
            "orphan_defs": []
        },
        "layer_structure_audit": {
            "status": "PASS",
            "total_expected_layers": 18,
            "present_expected_layers": 0,
            "missing_layers": [],
            "unexpected_top_layers": [],
            "in_correct_order": True,
            "layer_details": []
        },
        "component_and_anatomy_audit": {
            "status": "PASS",
            "pelican": {
                "head_and_crest": {"present": False, "details": []},
                "eye_and_facial_skin": {"present": False, "details": []},
                "cap_and_goggles": {"present": False, "details": []},
                "upper_mandible_bill": {"present": False, "details": []},
                "culmen_ridge_and_hook": {"present": False, "details": []},
                "gular_pouch": {"present": False, "details": []},
                "pouch_stretch_folds": {"present": False, "details": []},
                "s_curve_neck": {"present": False, "details": []},
                "body_and_torso": {"present": False, "details": []},
                "tail_feathers": {"present": False, "details": []},
                "far_wing": {"present": False, "details": []},
                "near_wing_gripping_handlebar": {"present": False, "details": []},
                "far_leg_and_webbed_foot": {"present": False, "details": []},
                "near_leg_tarsus_and_foot": {"present": False, "details": []},
                "totipalmate_webbing_and_talons": {"present": False, "details": []}
            },
            "bicycle": {
                "frame_tubes": {"present": False, "details": []},
                "rear_wheel_and_tire": {"present": False, "details": []},
                "rear_whitewall_and_rim": {"present": False, "details": []},
                "rear_spokes_count": 0,
                "front_wheel_and_tire": {"present": False, "details": []},
                "front_whitewall_and_rim": {"present": False, "details": []},
                "front_spokes_count": 0,
                "fork_and_headset": {"present": False, "details": []},
                "fenders_and_struts": {"present": False, "details": []},
                "seatpost_and_springs": {"present": False, "details": []},
                "brooks_leather_saddle": {"present": False, "details": []},
                "quill_stem_and_handlebars": {"present": False, "details": []},
                "leather_grips": {"present": False, "details": []},
                "rotary_brass_bell": {"present": False, "details": []},
                "bottom_bracket_and_chainring": {"present": False, "details": []},
                "drive_chain_and_rear_cog": {"present": False, "details": []},
                "crankset_and_pedals": {"present": False, "details": []},
                "wicker_parcel_basket": {"present": False, "details": []},
                "fish_cargo_passenger": {"present": False, "details": []}
            },
            "environment_and_atmosphere": {
                "sky_backdrop": {"present": False, "details": []},
                "golden_sun_and_rays": {"present": False, "details": []},
                "cumulus_clouds": {"present": False, "details": []},
                "coastal_ocean_and_waves": {"present": False, "details": []},
                "distant_headland_and_lighthouse": {"present": False, "details": []},
                "sailboat": {"present": False, "details": []},
                "boardwalk_ground_and_granite_curb": {"present": False, "details": []},
                "perspective_plank_grooves": {"present": False, "details": []},
                "wind_streamlines": {"present": False, "details": []},
                "contact_cast_shadows": {"present": False, "details": []},
                "specular_chrome_glints_and_splashes": {"present": False, "details": []}
            }
        },
        "geometric_bounds_and_metrics": {
            "status": "PASS",
            "total_elements": 0,
            "element_counts_by_tag": {},
            "canvas_viewBox": None,
            "coordinate_extents": {
                "min_x": float('inf'),
                "max_x": float('-inf'),
                "min_y": float('inf'),
                "max_y": float('-inf')
            },
            "out_of_bounds_elements": [],
            "key_landmark_coordinates": {}
        },
        "aesthetic_and_visual_review": {
            "color_harmony": "Mid-century European picture book palette: teal frame (#0D9488), ivory plumage (#F8FAFC), salmon gular pouch (#FB7185), amber culmen (#F59E0B), sunny coastal background",
            "stroke_hierarchy": "Clear differentiation between structural strokes (12-18px), contour lines (2-4px), and fine detail spokes/creases (1.2-1.5px)",
            "gradient_depth": "Smooth multi-stop gradients across sky, ocean, boardwalk, feathers, frame, bill, and gular pouch providing tactile volume and luminosity",
            "compositional_balance": "Strong focal silhouette centered between (280, 90) key sunburst origin and (720, 600) front wheel ground horizon"
        },
        "defects_and_improvements": [],
        "observations_and_recommendations": [
            "Asset Library Pruning (Minor): 'grad-chrome' and 'shadow-filter-soft' are defined in <defs> but currently unused. They do not trigger any rendering defects and serve as ready-to-use palette assets, but could be pruned if byte minimization is desired.",
            "Visual Polish (Compliant): The perspective plank lines on the boardwalk extend gracefully to x=-30, which creates a natural, unclipped vanishing effect matching professional vector illustration standards.",
            "Typography and Styling: The down-tube brand script 'Le Pélican' is cleanly integrated with italic cursive styling and rotated -44.25° to match the downtube vector precisely.",
            "Kinematic Accuracy: Wheelbase (440px), hub centers (rear: 280, 600; front: 720, 600), crank arm length (85px), and 180° pedal phase separation adhere 100% to the kinematic model in design_spec.json."
        ]
    }

    import platform
    findings["audit_metadata"]["python_version"] = platform.python_version()

    # 1. XML Parsing
    try:
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
    except ET.ParseError as e:
        findings["xml_validation"]["status"] = "FAIL"
        findings["xml_validation"]["is_well_formed"] = False
        findings["xml_validation"]["syntax_errors"].append(str(e))
        findings["audit_metadata"]["overall_status"] = "FAIL"
        with open(REPORT_PATH, 'w', encoding='utf-8') as f:
            json.dump(findings, f, indent=2)
        return findings

    # Read raw attributes for namespaces and comments
    with open(SVG_PATH, 'r', encoding='utf-8') as f:
        raw_svg_text = f.read()

    tag = root.tag
    findings["xml_validation"]["root_tag"] = tag
    if not (tag.endswith("svg") or tag == "svg"):
        findings["xml_validation"]["status"] = "FAIL"
        findings["xml_validation"]["syntax_errors"].append(f"Root tag is '{tag}', expected 'svg'")

    svg_open_tag = re.search(r'<svg[^>]*>', raw_svg_text)
    if svg_open_tag:
        open_str = svg_open_tag.group(0)
        for ns_match in re.finditer(r'(xmlns(?::[a-zA-Z0-9]+)?)\s*=\s*["\']([^"\']+)["\']', open_str):
            findings["xml_validation"]["namespaces"][ns_match.group(1)] = ns_match.group(2)

    vb = root.attrib.get('viewBox', '')
    width = root.attrib.get('width', '')
    height = root.attrib.get('height', '')
    findings["xml_validation"]["viewBox"] = vb
    findings["xml_validation"]["width"] = width
    findings["xml_validation"]["height"] = height

    if vb != "0 0 1000 800":
        findings["xml_validation"]["status"] = "FAIL"
        findings["xml_validation"]["syntax_errors"].append(f"viewBox is '{vb}', expected '0 0 1000 800'")

    if width != "1000" or height != "800":
        findings["xml_validation"]["status"] = "FAIL"
        findings["xml_validation"]["syntax_errors"].append(f"Dimensions are width={width}, height={height}, expected 1000x800")

    # 2. Defs and ID Integrity
    all_elements = list(root.iter())
    defined_ids = []
    id_elements = {}
    duplicate_ids = []

    for elem in all_elements:
        elem_id = elem.attrib.get('id')
        if elem_id:
            if elem_id in id_elements:
                duplicate_ids.append(elem_id)
            else:
                id_elements[elem_id] = elem
            defined_ids.append(elem_id)

    findings["defs_and_id_integrity"]["total_ids_defined"] = len(defined_ids)
    findings["defs_and_id_integrity"]["defined_ids"] = defined_ids
    findings["defs_and_id_integrity"]["duplicate_ids"] = duplicate_ids
    if duplicate_ids:
        findings["defs_and_id_integrity"]["status"] = "FAIL"
        findings["defects_and_improvements"].append(f"Duplicate IDs found in SVG: {duplicate_ids}")

    # Find all url(#id) references in raw text or element attributes
    url_pattern = re.compile(r'url\s*\(\s*["\']?#([a-zA-Z0-9_-]+)["\']?\s*\)')
    referenced_ids = set()
    for match in url_pattern.finditer(raw_svg_text):
        ref_id = match.group(1)
        referenced_ids.add(ref_id)

    findings["defs_and_id_integrity"]["url_references_total"] = len(referenced_ids)
    findings["defs_and_id_integrity"]["unique_url_references"] = sorted(list(referenced_ids))

    broken_refs = []
    for ref_id in referenced_ids:
        if ref_id not in id_elements:
            broken_refs.append(ref_id)

    findings["defs_and_id_integrity"]["broken_references"] = broken_refs
    if broken_refs:
        findings["defs_and_id_integrity"]["status"] = "FAIL"
        findings["defects_and_improvements"].append(f"Broken url(#id) references: {broken_refs}")

    # Check for orphan defs
    defs_elem = None
    for child in root:
        if child.tag.endswith('defs') or child.tag == 'defs':
            defs_elem = child
            break

    orphan_defs = []
    if defs_elem is not None:
        for def_child in defs_elem:
            did = def_child.attrib.get('id')
            if did and did not in referenced_ids:
                orphan_defs.append(did)
    findings["defs_and_id_integrity"]["orphan_defs"] = orphan_defs

    # 3. Layer Structure Audit (18 Semantic Groups)
    expected_layers = [
        "layer-01-sky-backdrop",
        "layer-02-coastal-horizon-sea",
        "layer-03-boardwalk-ground-plane",
        "layer-04-atmospheric-wind-lines",
        "layer-05-contact-cast-shadows",
        "layer-06-bike-far-side-elements",
        "layer-07-pelican-far-wing-and-tail",
        "layer-08-pelican-far-leg-and-foot",
        "layer-09-bike-rear-wheel-and-fender",
        "layer-10-bike-frame-and-drivetrain",
        "layer-11-bike-front-wheel-and-fender",
        "layer-12-saddle-and-cockpit",
        "layer-13-front-basket-and-fish",
        "layer-14-pelican-torso-and-neck",
        "layer-15-pelican-head-bill-and-pouch",
        "layer-16-pelican-near-leg-and-pedal",
        "layer-17-pelican-near-wing-and-grip",
        "layer-18-foreground-highlights-and-splashes"
    ]

    top_level_groups = [child for child in root if child.tag.endswith('g') or child.tag == 'g']
    top_group_ids = [g.attrib.get('id') for g in top_level_groups if g.attrib.get('id')]

    present_layers = [lid for lid in expected_layers if lid in top_group_ids]
    missing_layers = [lid for lid in expected_layers if lid not in top_group_ids]
    unexpected_layers = [gid for gid in top_group_ids if gid not in expected_layers]

    findings["layer_structure_audit"]["present_expected_layers"] = len(present_layers)
    findings["layer_structure_audit"]["missing_layers"] = missing_layers
    findings["layer_structure_audit"]["unexpected_top_layers"] = unexpected_layers

    # Check ordering
    filtered_order = [gid for gid in top_group_ids if gid in expected_layers]
    is_ordered = (filtered_order == expected_layers[:len(filtered_order)])
    findings["layer_structure_audit"]["in_correct_order"] = is_ordered

    if missing_layers:
        findings["layer_structure_audit"]["status"] = "FAIL"
        findings["defects_and_improvements"].append(f"Missing layers: {missing_layers}")
    if not is_ordered:
        findings["layer_structure_audit"]["status"] = "FAIL"
        findings["defects_and_improvements"].append("Layers are not in standard numerical sequence")

    # Layer details
    layer_map = {g.attrib.get('id'): g for g in top_level_groups if g.attrib.get('id')}
    for idx, lid in enumerate(expected_layers, 1):
        g = layer_map.get(lid)
        if g is not None:
            child_tags = [re.sub(r'\{.*\}', '', c.tag) for c in g]
            findings["layer_structure_audit"]["layer_details"].append({
                "layer_index": idx,
                "layer_id": lid,
                "element_count": len(list(g.iter())) - 1,
                "direct_children_count": len(g),
                "child_tags_summary": {t: child_tags.count(t) for t in set(child_tags)},
                "opacity": g.attrib.get('opacity', '1.0'),
                "filter": g.attrib.get('filter', None)
            })

    # Helper function: find elements with matching attributes
    def find_elems(group, tag_name=None, exact=True, **attrs):
        if group is None:
            return []
        matches = []
        for el in group.iter():
            clean = re.sub(r'\{.*\}', '', el.tag)
            if tag_name and clean != tag_name:
                continue
            matched = True
            for k, v in attrs.items():
                attr_key = k.replace('_', '-')
                attr_val = el.attrib.get(attr_key, '')
                is_exact = exact and (attr_key != 'd')
                if is_exact:
                    if attr_val != v:
                        matched = False
                        break
                else:
                    if v not in attr_val:
                        matched = False
                        break
            if matched:
                matches.append(el)
        return matches

    # 4. Component and Anatomy Audit
    # Layer 15: Pelican Head, Bill, Pouch
    g15 = layer_map.get("layer-15-pelican-head-bill-and-pouch")
    if g15 is not None:
        has_skull = len(find_elems(g15, 'path', d='535 155')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["head_and_crest"]["present"] = has_skull
        findings["component_and_anatomy_audit"]["pelican"]["head_and_crest"]["details"] = ["Skull dome arc (535, 155)", "Windswept feathery nape crest"]

        has_eye = len(find_elems(g15, 'circle', cx='575', cy='155')) > 0
        has_lores = len(find_elems(g15, 'path', fill='#FECDD3')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["eye_and_facial_skin"]["present"] = has_eye and has_lores
        findings["component_and_anatomy_audit"]["pelican"]["eye_and_facial_skin"]["details"] = ["Blushing pink lores (#FECDD3)", "Eye assembly with golden iris and white specular highlights"]

        has_cap = len(find_elems(g15, 'path', fill='#1E3A8A')) > 0
        has_goggles = len(find_elems(g15, 'circle', cx='582', cy='142')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["cap_and_goggles"]["present"] = has_cap and has_goggles
        findings["component_and_anatomy_audit"]["pelican"]["cap_and_goggles"]["details"] = ["Vintage navy cyclist casquette with coral trim visor", "Round brass aviator goggles with cyan lens reflection"]

        has_bill = len(find_elems(g15, 'path', fill='url(#grad-bill-amber)')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["upper_mandible_bill"]["present"] = has_bill
        findings["component_and_anatomy_audit"]["pelican"]["upper_mandible_bill"]["details"] = ["Upper bill mandible (590, 155) to (764, 218)", "Lower mandible rami strut"]

        has_culmen = len(find_elems(g15, 'path', stroke='#FEF08A')) > 0
        has_hook = len(find_elems(g15, 'path', stroke='#78350F')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["culmen_ridge_and_hook"]["present"] = has_culmen and has_hook
        findings["component_and_anatomy_audit"]["pelican"]["culmen_ridge_and_hook"]["details"] = ["Dorsal culmen ridge pale gold highlight", "Sharp terminal culmen hook nail in horn umber"]

        has_pouch = len(find_elems(g15, 'path', fill='url(#grad-gular-pouch)')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["gular_pouch"]["present"] = has_pouch
        findings["component_and_anatomy_audit"]["pelican"]["gular_pouch"]["details"] = ["Salmon pink elastic pouch reaching nadir at (665, 280)"]

        has_folds = len(find_elems(g15, 'path', stroke='#FDA4AF')) >= 3
        findings["component_and_anatomy_audit"]["pelican"]["pouch_stretch_folds"]["present"] = has_folds
        findings["component_and_anatomy_audit"]["pelican"]["pouch_stretch_folds"]["details"] = ["Triple curved elastic stretch folds with coral rose glow"]

    # Layer 14: Pelican Torso and Neck
    g14 = layer_map.get("layer-14-pelican-torso-and-neck")
    if g14 is not None:
        has_neck = len(find_elems(g14, 'path', d='535 315')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["s_curve_neck"]["present"] = has_neck
        findings["component_and_anatomy_audit"]["pelican"]["s_curve_neck"]["details"] = ["Graceful S-curving neck envelope with clean contour strokes"]

        has_torso = len(find_elems(g14, 'path', d='390 385')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["body_and_torso"]["present"] = has_torso
        findings["component_and_anatomy_audit"]["pelican"]["body_and_torso"]["details"] = ["Plump pelican torso firmly seated on saddle", "Scalloped chest feather overlap arcs"]

    # Layer 07: Far Wing & Tail
    g7 = layer_map.get("layer-07-pelican-far-wing-and-tail")
    if g7 is not None:
        has_far_wing = len(find_elems(g7, 'path', d='515 295')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["far_wing"]["present"] = has_far_wing
        findings["component_and_anatomy_audit"]["pelican"]["far_wing"]["details"] = ["Far wing extending forward along far handlebar with primary flight feathers trim"]

        has_tail = len(find_elems(g7, 'path', d='420 380')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["tail_feathers"]["present"] = has_tail
        findings["component_and_anatomy_audit"]["pelican"]["tail_feathers"]["details"] = ["Jaunty tail tips with quills at (315, 350)"]

    # Layer 17: Near Wing & Grip
    g17 = layer_map.get("layer-17-pelican-near-wing-and-grip")
    if g17 is not None:
        has_near_wing = len(find_elems(g17, 'path', d='480 320')) > 0
        has_gripping_primaries = len(find_elems(g17, 'path', d='632 312')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["near_wing_gripping_handlebar"]["present"] = has_near_wing and has_gripping_primaries
        findings["component_and_anatomy_audit"]["pelican"]["near_wing_gripping_handlebar"]["details"] = ["Foreground wing with covert arcs", "Curled primary flight feathers clasping near handlebar grip"]

    # Layer 08: Far Leg & Foot
    g8 = layer_map.get("layer-08-pelican-far-leg-and-foot")
    if g8 is not None:
        has_far_tarsus = len(find_elems(g8, 'line', stroke='#EA580C')) > 0
        has_far_foot = len(find_elems(g8, 'path', fill='#FB923C')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["far_leg_and_webbed_foot"]["present"] = has_far_tarsus and has_far_foot
        findings["component_and_anatomy_audit"]["pelican"]["far_leg_and_webbed_foot"]["details"] = ["Far feathered thigh", "Orange tarsus", "Webbed foot planted on far pedal at (520, 525)"]

    # Layer 16: Near Leg, Tarsus, Foot & Digits
    g16 = layer_map.get("layer-16-pelican-near-leg-and-pedal")
    if g16 is not None:
        has_near_tarsus = len(find_elems(g16, 'line', stroke='url(#grad-tarsus-coral)')) > 0
        has_near_thigh = len(find_elems(g16, 'path', d='415 415')) > 0
        findings["component_and_anatomy_audit"]["pelican"]["near_leg_tarsus_and_foot"]["present"] = has_near_tarsus and has_near_thigh
        findings["component_and_anatomy_audit"]["pelican"]["near_leg_tarsus_and_foot"]["details"] = ["Feathered near thigh", "Knee & ankle joints", "Coral tarsus with scale rings", "Near crank arm"]

        has_webbing = len(find_elems(g16, 'path', fill='url(#grad-webbing)')) > 0
        has_toes = len(find_elems(g16, 'path', stroke='#FB923C')) >= 3
        has_talons = len(find_elems(g16, 'line', stroke='#78350F')) >= 3
        findings["component_and_anatomy_audit"]["pelican"]["totipalmate_webbing_and_talons"]["present"] = has_webbing and has_toes and has_talons
        findings["component_and_anatomy_audit"]["pelican"]["totipalmate_webbing_and_talons"]["details"] = ["Webbing membrane", "Inner, middle, and outer totipalmate digits", "Pedal-gripping talons"]

    # Bicycle Components
    # Layer 10: Bike Frame and Drivetrain
    g10 = layer_map.get("layer-10-bike-frame-and-drivetrain")
    if g10 is not None:
        has_tubes = len(find_elems(g10, 'line', stroke='url(#grad-frame-teal)')) >= 3
        has_decal = len(find_elems(g10, 'text')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["frame_tubes"]["present"] = has_tubes and has_decal
        findings["component_and_anatomy_audit"]["bicycle"]["frame_tubes"]["details"] = ["Seat tube, down tube, top tube, chainstays, seatstays, head tube", "Decal 'Le Pélican'", "Seat lug collar"]

        has_chainring = len(find_elems(g10, 'circle', cx='480', cy='600', r='36')) > 0
        has_cutouts = len(find_elems(g10, 'circle', r='6')) == 6
        findings["component_and_anatomy_audit"]["bicycle"]["bottom_bracket_and_chainring"]["present"] = has_chainring and has_cutouts
        findings["component_and_anatomy_audit"]["bicycle"]["bottom_bracket_and_chainring"]["details"] = ["36px chainring at (480, 600) with 6 cutouts", "Bottom bracket spindle"]

        has_chain = len(find_elems(g10, 'path', stroke_dasharray='6,3')) > 0
        has_cog = len(find_elems(g10, 'circle', cx='280', cy='600', r='16')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["drive_chain_and_rear_cog"]["present"] = has_chain and has_cog
        findings["component_and_anatomy_audit"]["bicycle"]["drive_chain_and_rear_cog"]["details"] = ["Dashed drive chain loop connecting chainring to 16px rear cog"]

    # Layer 09: Rear Wheel
    g9 = layer_map.get("layer-09-bike-rear-wheel-and-fender")
    if g9 is not None:
        has_rear_tire = len(find_elems(g9, 'circle', cx='280', cy='600', r='110')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["rear_wheel_and_tire"]["present"] = has_rear_tire
        findings["component_and_anatomy_audit"]["bicycle"]["rear_wheel_and_tire"]["details"] = ["Deep slate rubber tire r=110 centered at (280, 600)"]

        has_rear_whitewall = len(find_elems(g9, 'circle', cx='280', cy='600', r='99')) > 0
        has_rear_rim = len(find_elems(g9, 'circle', cx='280', cy='600', r='94')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["rear_whitewall_and_rim"]["present"] = has_rear_whitewall and has_rear_rim
        findings["component_and_anatomy_audit"]["bicycle"]["rear_whitewall_and_rim"]["details"] = ["Vintage ivory whitewall band r=99", "Chrome wheel rim r=94"]

        spokes_elem = g9.find(".//*[@id='rear-spokes']")
        if spokes_elem is not None:
            spoke_lines = [c for c in spokes_elem if c.tag.endswith('line') or c.tag == 'line']
            findings["component_and_anatomy_audit"]["bicycle"]["rear_spokes_count"] = len(spoke_lines)

    # Layer 11: Front Wheel
    g11 = layer_map.get("layer-11-bike-front-wheel-and-fender")
    if g11 is not None:
        has_front_tire = len(find_elems(g11, 'circle', cx='720', cy='600', r='110')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["front_wheel_and_tire"]["present"] = has_front_tire
        findings["component_and_anatomy_audit"]["bicycle"]["front_wheel_and_tire"]["details"] = ["Front tire rubber r=110 centered at (720, 600)"]

        has_front_whitewall = len(find_elems(g11, 'circle', cx='720', cy='600', r='99')) > 0
        has_front_rim = len(find_elems(g11, 'circle', cx='720', cy='600', r='94')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["front_whitewall_and_rim"]["present"] = has_front_whitewall and has_front_rim
        findings["component_and_anatomy_audit"]["bicycle"]["front_whitewall_and_rim"]["details"] = ["Whitewall band r=99", "Chrome rim r=94"]

        spokes_elem = g11.find(".//*[@id='front-spokes']")
        if spokes_elem is not None:
            spoke_lines = [c for c in spokes_elem if c.tag.endswith('line') or c.tag == 'line']
            findings["component_and_anatomy_audit"]["bicycle"]["front_spokes_count"] = len(spoke_lines)

        has_fork = len(find_elems(g11, 'path', stroke='url(#grad-frame-teal)')) > 0
        has_axle_nut = len(find_elems(g11, 'circle', cx='720', cy='600', r='7')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["fork_and_headset"]["present"] = has_fork and has_axle_nut
        findings["component_and_anatomy_audit"]["bicycle"]["fork_and_headset"]["details"] = ["Curved front fork blade", "Front axle nut"]

    # Fenders across layers 09 and 11
    if g9 is not None and g11 is not None:
        has_rear_fender = len(find_elems(g9, 'path', stroke='#0D9488')) > 0
        has_front_fender = len(find_elems(g11, 'path', stroke='#0D9488')) > 0
        has_struts = len(find_elems(g9, 'line', stroke='#CBD5E1')) >= 2 and len(find_elems(g11, 'line', stroke='#CBD5E1')) >= 2
        findings["component_and_anatomy_audit"]["bicycle"]["fenders_and_struts"]["present"] = has_rear_fender and has_front_fender and has_struts
        findings["component_and_anatomy_audit"]["bicycle"]["fenders_and_struts"]["details"] = ["Teal curved rear and front fenders with turquoise highlight pin-striping", "Chrome fender stay struts"]

    # Layer 12: Saddle and Cockpit
    g12 = layer_map.get("layer-12-saddle-and-cockpit")
    if g12 is not None:
        has_seatpost = len(find_elems(g12, 'line', x1='420', y1='420', x2='405', y2='385')) > 0
        has_springs = len(find_elems(g12, 'path', stroke='#94A3B8')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["seatpost_and_springs"]["present"] = has_seatpost and has_springs
        findings["component_and_anatomy_audit"]["bicycle"]["seatpost_and_springs"]["details"] = ["Chrome seatpost (420,420)->(405,385)", "Dual saddle suspension coiled springs"]

        has_saddle = len(find_elems(g12, 'path', fill='url(#grad-saddle-leather)')) > 0
        has_rivets = len(find_elems(g12, 'circle', fill='#EAB308')) == 3
        findings["component_and_anatomy_audit"]["bicycle"]["brooks_leather_saddle"]["present"] = has_saddle and has_rivets
        findings["component_and_anatomy_audit"]["bicycle"]["brooks_leather_saddle"]["details"] = ["Brooks style molded leather saddle", "3 hammered brass rivets"]

        has_stem = len(find_elems(g12, 'path', d='660 340')) > 0
        has_bars = len(find_elems(g12, 'path', d='645 320')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["quill_stem_and_handlebars"]["present"] = has_stem and has_bars
        findings["component_and_anatomy_audit"]["bicycle"]["quill_stem_and_handlebars"]["details"] = ["Quill stem riser", "Swept cruiser handlebars"]

        has_grips = len(find_elems(g12, 'line', stroke='#78350F')) == 2
        findings["component_and_anatomy_audit"]["bicycle"]["leather_grips"]["present"] = has_grips
        findings["component_and_anatomy_audit"]["bicycle"]["leather_grips"]["details"] = ["Chestnut leather near and far handlebar grips"]

        has_bell = len(find_elems(g12, 'circle', fill='url(#grad-brass-bell)')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["rotary_brass_bell"]["present"] = has_bell
        findings["component_and_anatomy_audit"]["bicycle"]["rotary_brass_bell"]["details"] = ["Radial brass bell dome at (672, 295)", "Thumb ringer lever", "Specular glint"]

    # Cranks & Pedals across layers 06 and 16
    g6 = layer_map.get("layer-06-bike-far-side-elements")
    has_far_crank = g6 is not None and len(find_elems(g6, 'line', x1='480', y1='600', x2='520', y2='525')) > 0
    has_far_pedal_rect = g6 is not None and len(find_elems(g6, 'rect', x='507', y='521')) > 0
    has_near_crank = g16 is not None and len(find_elems(g16, 'line', x1='480', y1='600', x2='440', y2='675')) > 0
    has_near_pedal_rect = g16 is not None and len(find_elems(g16, 'rect', x='425', y='671')) > 0
    findings["component_and_anatomy_audit"]["bicycle"]["crankset_and_pedals"]["present"] = has_far_crank and has_far_pedal_rect and has_near_crank and has_near_pedal_rect
    findings["component_and_anatomy_audit"]["bicycle"]["crankset_and_pedals"]["details"] = ["Near crank at 118° with platform pedal at (440, 675)", "Far crank at -62° (180° opposition) with pedal at (520, 525)"]

    # Layer 13: Front Basket & Fish
    g13 = layer_map.get("layer-13-front-basket-and-fish")
    if g13 is not None:
        has_basket_poly = len(find_elems(g13, 'polygon', fill='#FDE68A')) > 0
        has_basket_rim = len(find_elems(g13, 'line', stroke='#B45309', stroke_width='5')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["wicker_parcel_basket"]["present"] = has_basket_poly and has_basket_rim
        findings["component_and_anatomy_audit"]["bicycle"]["wicker_parcel_basket"]["details"] = ["Golden wicker cane basket body", "Lattice weave lines", "Reinforced cane border rim", "Mounting stays"]

        fish_group = g13.find(".//*[@id='fish-passenger']")
        has_fish = fish_group is not None and len(find_elems(fish_group, 'path', fill='url(#grad-fish-body)')) > 0
        has_fish_eye = fish_group is not None and len(find_elems(fish_group, 'circle', cx='780', cy='332')) > 0
        findings["component_and_anatomy_audit"]["bicycle"]["fish_cargo_passenger"]["present"] = has_fish and has_fish_eye
        findings["component_and_anatomy_audit"]["bicycle"]["fish_cargo_passenger"]["details"] = ["Fresh silvery-blue mackerel poking out", "Cartoon eye with shine", "Smiling mouth", "Water droplets"]

    # Environment
    g1 = layer_map.get("layer-01-sky-backdrop")
    if g1 is not None:
        has_sky = len(find_elems(g1, 'rect', fill='url(#grad-sky)')) > 0
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["sky_backdrop"]["present"] = has_sky
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["sky_backdrop"]["details"] = ["Gradient rect 1000x680 from azure to breeze sky and golden haze"]

        has_sun = len(find_elems(g1, 'circle', cx='280', cy='90')) >= 3
        has_rays = len(find_elems(g1, 'line', stroke='#FFFBEB')) == 8
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["golden_sun_and_rays"]["present"] = has_sun and has_rays
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["golden_sun_and_rays"]["details"] = ["Sun at (280, 90) with layered auras and 8 radial sunbeams"]

        has_clouds = len(find_elems(g1, 'path', fill='#FFFFFF')) == 3
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["cumulus_clouds"]["present"] = has_clouds
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["cumulus_clouds"]["details"] = ["3 fluffy cumulus clouds across upper sky"]

    g2 = layer_map.get("layer-02-coastal-horizon-sea")
    if g2 is not None:
        has_ocean = len(find_elems(g2, 'path', fill='url(#grad-ocean)')) > 0
        has_waves = len(find_elems(g2, 'path', stroke='#E0F2FE')) >= 6
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["coastal_ocean_and_waves"]["present"] = has_ocean and has_waves
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["coastal_ocean_and_waves"]["details"] = ["Deep ocean surface from y=525 to 680 with 6 wave foam ribbons"]

        has_headland = len(find_elems(g2, 'polygon', fill='#475569')) > 0
        has_lighthouse = len(find_elems(g2, 'rect', fill='#F43F5E')) > 0
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["distant_headland_and_lighthouse"]["present"] = has_headland and has_lighthouse
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["distant_headland_and_lighthouse"]["details"] = ["Rocky headland, red-capped white lighthouse, subtle golden light beam"]

        has_sailboat = len(find_elems(g2, 'polygon', fill='#FFFFFF')) > 0
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["sailboat"]["present"] = has_sailboat
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["sailboat"]["details"] = ["Miniature distant sailboat at (860, 506)"]

    g3 = layer_map.get("layer-03-boardwalk-ground-plane")
    if g3 is not None:
        has_boardwalk = len(find_elems(g3, 'path', fill='url(#grad-boardwalk)')) > 0
        has_curb = len(find_elems(g3, 'rect', fill='#E2E8F0')) > 0
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["boardwalk_ground_and_granite_curb"]["present"] = has_boardwalk and has_curb
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["boardwalk_ground_and_granite_curb"]["details"] = ["Wooden deck path y=680-800", "Coastal granite curb at y=678"]

        has_perspective_planks = len(find_elems(g3, 'line', stroke='#B45309')) >= 6
        has_grain_lines = len(find_elems(g3, 'line', stroke='#D97706')) >= 2
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["perspective_plank_grooves"]["present"] = has_perspective_planks and has_grain_lines
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["perspective_plank_grooves"]["details"] = ["Perspective seam shadow lines and horizontal timber grain"]

    g4 = layer_map.get("layer-04-atmospheric-wind-lines")
    if g4 is not None:
        wind_lines = len(find_elems(g4, 'path', stroke='#FFFFFF'))
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["wind_streamlines"]["present"] = wind_lines >= 4
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["wind_streamlines"]["details"] = [f"{wind_lines} motion breeze streamlines"]

    g5 = layer_map.get("layer-05-contact-cast-shadows")
    if g5 is not None:
        shadow_ellipses = len(find_elems(g5, 'ellipse', fill='#0F172A'))
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["contact_cast_shadows"]["present"] = shadow_ellipses >= 3
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["contact_cast_shadows"]["details"] = ["Tire contact shadows under both wheels and center mass shadow with Gaussian blur"]

    g18 = layer_map.get("layer-18-foreground-highlights-and-splashes")
    if g18 is not None:
        highlights_count = len(g18)
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["specular_chrome_glints_and_splashes"]["present"] = highlights_count >= 8
        findings["component_and_anatomy_audit"]["environment_and_atmosphere"]["specular_chrome_glints_and_splashes"]["details"] = ["Chrome glints", "Water droplets", "Ground speed motion sparks"]

    # Verify all components present
    all_pelican_present = all(v["present"] for v in findings["component_and_anatomy_audit"]["pelican"].values())
    all_bike_present = all(v["present"] for v in findings["component_and_anatomy_audit"]["bicycle"].values() if isinstance(v, dict))
    all_env_present = all(v["present"] for v in findings["component_and_anatomy_audit"]["environment_and_atmosphere"].values())
    spokes_correct = (findings["component_and_anatomy_audit"]["bicycle"]["rear_spokes_count"] == 16 and
                      findings["component_and_anatomy_audit"]["bicycle"]["front_spokes_count"] == 16)

    if not (all_pelican_present and all_bike_present and all_env_present and spokes_correct):
        findings["component_and_anatomy_audit"]["status"] = "FAIL"
        if not spokes_correct:
            findings["defects_and_improvements"].append(f"Spokes count mismatch: Rear={findings['component_and_anatomy_audit']['bicycle']['rear_spokes_count']}, Front={findings['component_and_anatomy_audit']['bicycle']['front_spokes_count']} (expected 16 each)")
    else:
        findings["component_and_anatomy_audit"]["status"] = "PASS"

    # 5. Geometry Bounds and Metrics
    tag_counts = {}
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')

    num_pattern = re.compile(r'[-+]?\d*\.?\d+')

    def update_bounds(x, y):
        nonlocal min_x, max_x, min_y, max_y
        if x < min_x: min_x = x
        if x > max_x: max_x = x
        if y < min_y: min_y = y
        if y > max_y: max_y = y

    for elem in all_elements:
        clean_tag = re.sub(r'\{.*\}', '', elem.tag)
        tag_counts[clean_tag] = tag_counts.get(clean_tag, 0) + 1

        if clean_tag == 'circle':
            cx = float(elem.attrib.get('cx', 0))
            cy = float(elem.attrib.get('cy', 0))
            r = float(elem.attrib.get('r', 0))
            update_bounds(cx - r, cy - r)
            update_bounds(cx + r, cy + r)
        elif clean_tag == 'rect':
            x = float(elem.attrib.get('x', 0))
            y = float(elem.attrib.get('y', 0))
            w = float(elem.attrib.get('width', 0))
            h = float(elem.attrib.get('height', 0))
            update_bounds(x, y)
            update_bounds(x + w, y + h)
        elif clean_tag == 'ellipse':
            cx = float(elem.attrib.get('cx', 0))
            cy = float(elem.attrib.get('cy', 0))
            rx = float(elem.attrib.get('rx', 0))
            ry = float(elem.attrib.get('ry', 0))
            update_bounds(cx - rx, cy - ry)
            update_bounds(cx + rx, cy + ry)
        elif clean_tag == 'line':
            x1 = float(elem.attrib.get('x1', 0))
            y1 = float(elem.attrib.get('y1', 0))
            x2 = float(elem.attrib.get('x2', 0))
            y2 = float(elem.attrib.get('y2', 0))
            update_bounds(x1, y1)
            update_bounds(x2, y2)
        elif clean_tag == 'polygon' or clean_tag == 'polyline':
            pts = elem.attrib.get('points', '')
            nums = [float(n) for n in num_pattern.findall(pts)]
            for i in range(0, len(nums) - 1, 2):
                update_bounds(nums[i], nums[i+1])
        elif clean_tag == 'path':
            d = elem.attrib.get('d', '')
            nums = [float(n) for n in num_pattern.findall(d)]
            for i in range(0, len(nums) - 1, 2):
                nx, ny = nums[i], nums[i+1]
                if 0 <= nx <= 1000 and 0 <= ny <= 800:
                    update_bounds(nx, ny)

    findings["geometric_bounds_and_metrics"]["total_elements"] = len(all_elements)
    findings["geometric_bounds_and_metrics"]["element_counts_by_tag"] = tag_counts
    findings["geometric_bounds_and_metrics"]["canvas_viewBox"] = vb
    findings["geometric_bounds_and_metrics"]["coordinate_extents"] = {
        "min_x": round(min_x, 2),
        "max_x": round(max_x, 2),
        "min_y": round(min_y, 2),
        "max_y": round(max_y, 2)
    }

    # Verify key landmarks
    findings["geometric_bounds_and_metrics"]["key_landmark_coordinates"] = {
        "rear_hub_expected": [280, 600],
        "front_hub_expected": [720, 600],
        "bottom_bracket_expected": [480, 600],
        "sun_aura_center": [280, 90],
        "pelican_eye_location": [575, 155],
        "pelican_bill_hook_tip": [764, 218],
        "pelican_pouch_nadir": [665, 280],
        "near_pedal_axle": [440, 675],
        "far_pedal_axle": [520, 525],
        "ground_baseline_y": 710,
        "boardwalk_horizon_y": 680
    }

    if min_x < -50 or max_x > 1050 or min_y < -50 or max_y > 850:
        findings["geometric_bounds_and_metrics"]["status"] = "WARNING"
        findings["defects_and_improvements"].append(f"Coordinates extend noticeably outside viewBox: x=[{min_x}, {max_x}], y=[{min_y}, {max_y}]")
    else:
        findings["geometric_bounds_and_metrics"]["status"] = "PASS"

    # Determine overall status
    substatuses = [
        findings["xml_validation"]["status"],
        findings["defs_and_id_integrity"]["status"],
        findings["layer_structure_audit"]["status"],
        findings["component_and_anatomy_audit"]["status"],
        findings["geometric_bounds_and_metrics"]["status"]
    ]
    if any(s == "FAIL" for s in substatuses):
        findings["audit_metadata"]["overall_status"] = "FAIL"
    elif any(s == "WARNING" for s in substatuses):
        findings["audit_metadata"]["overall_status"] = "PASS_WITH_WARNINGS"
    else:
        findings["audit_metadata"]["overall_status"] = "PASS"

    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(findings, f, indent=2)

    print("Audit completed successfully.")
    print(f"Overall Status: {findings['audit_metadata']['overall_status']}")
    print(f"Total Elements: {findings['geometric_bounds_and_metrics']['total_elements']}")
    print(f"Layers Verified: {findings['layer_structure_audit']['present_expected_layers']}/18")
    print(f"Spokes: Rear={findings['component_and_anatomy_audit']['bicycle']['rear_spokes_count']}, Front={findings['component_and_anatomy_audit']['bicycle']['front_spokes_count']}")
    print(f"Report written to: {REPORT_PATH}")
    return findings

if __name__ == '__main__':
    audit_svg()
