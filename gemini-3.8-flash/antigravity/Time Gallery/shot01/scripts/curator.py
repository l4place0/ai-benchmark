#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Art Curator script for Time Gallery.
Downloads 56 public domain masterworks across 8 Western art periods,
verifies image dimensions using Pillow, and generates:
- Time Gallery/shot01/js/data/manifest.json
- Time Gallery/shot01/js/data/artHistoryData.js
"""

import os
import sys
import json
import time
import urllib.parse
import requests
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets", "paintings")
DATA_DIR = os.path.join(BASE_DIR, "js", "data")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

USER_AGENT = "TimeGallery/1.0 (https://github.com; contact@timegallery.art) Mozilla/5.0"

PERIODS = [
    {
        "id": "early_renaissance",
        "nameZh": "早期文艺复兴",
        "nameEn": "Early Renaissance",
        "timeSpan": "1400–1490",
        "description": "早期文艺复兴发端于15世纪的意大利佛罗伦萨，艺术家们开始摆脱中世纪神学的僵化禁锢，转向古希腊与罗马的古典文明寻求灵感。这一时期在绘画理论上取得了开创性突破，线性透视法的确立、解剖学的深入研究以及光影明暗对照法的萌芽，使画面呈现出前所未有的空间纵深感与真实的人体比例，展现了以人为本的人文主义精神。",
        "representativeWorkId": "early_renaissance_01",
        "painters": [
            {
                "id": "botticelli",
                "nameZh": "桑德罗·波提切利",
                "nameEn": "Sandro Botticelli",
                "birthDeath": "c. 1445–1510",
                "description": "佛罗伦萨画派巨匠，善用优美流畅的线条和富有诗意的抒情色调，代表作《维纳斯的诞生》与《春》成为文艺复兴早期最具辨识度的人文主义颂歌。",
                "representativeWorkId": "early_renaissance_01"
            },
            {
                "id": "masaccio",
                "nameZh": "马萨乔",
                "nameEn": "Masaccio",
                "birthDeath": "1401–1428",
                "description": "文艺复兴绘画先驱，最早将布鲁内莱斯基的线性透视法则完美应用于绘画中，确立了庄严坚实的体量感与真实的阴影刻画。",
                "representativeWorkId": "early_renaissance_03"
            },
            {
                "id": "fra_angelico",
                "nameZh": "安吉利科修士",
                "nameEn": "Fra Angelico",
                "birthDeath": "c. 1395–1455",
                "description": "早期文艺复兴宗教画大师，以圣洁明净的色彩、恬静纯粹的神情以及虔诚优雅的空间组织著称。",
                "representativeWorkId": "early_renaissance_05"
            },
            {
                "id": "piero_della_francesca",
                "nameZh": "皮耶罗·德拉·弗朗西斯卡",
                "nameEn": "Piero della Francesca",
                "birthDeath": "c. 1415–1492",
                "description": "精通数学与几何学的透视大师，构图严密沉稳，人物具有雕塑般的纪念碑感与冷静庄严的秩序感。",
                "representativeWorkId": "early_renaissance_06"
            }
        ]
    },
    {
        "id": "high_renaissance",
        "nameZh": "盛期文艺复兴",
        "nameEn": "High Renaissance",
        "timeSpan": "1490–1527",
        "description": "盛期文艺复兴是西方古典美术史上的巅峰里程碑，以达·芬奇、米开朗基罗和拉斐尔“美术三杰”为核心标志。艺术家们不仅在透视、解剖与构图技法上登峰造极，更将古典和谐、崇高理性、心理深度与宏大叙事推至人类视觉艺术的至高境界。",
        "representativeWorkId": "high_renaissance_01",
        "painters": [
            {
                "id": "da_vinci",
                "nameZh": "莱昂纳多·达·芬奇",
                "nameEn": "Leonardo da Vinci",
                "birthDeath": "1452–1519",
                "description": "博学全才与艺术巨擘，开创了薄雾渐隐法（Sfumato），精于捕捉人物微妙莫测的心理神韵与自然奥秘。",
                "representativeWorkId": "high_renaissance_01"
            },
            {
                "id": "michelangelo",
                "nameZh": "米开朗基罗·博那罗蒂",
                "nameEn": "Michelangelo Buonarroti",
                "birthDeath": "1475–1564",
                "description": "雕塑与绘画泰斗，作品洋溢着无与伦比的力量感、英雄主义气概与雄浑澎湃的悲剧崇高美。",
                "representativeWorkId": "high_renaissance_04"
            },
            {
                "id": "raphael",
                "nameZh": "拉斐尔·桑西",
                "nameEn": "Raphael",
                "birthDeath": "1483–1520",
                "description": "古典和谐与完美构图的化身，笔下圣母温柔典雅，历史壁画气度恢宏，代表了盛期文艺复兴至臻至纯的平衡美。",
                "representativeWorkId": "high_renaissance_06"
            }
        ]
    },
    {
        "id": "venetian_school",
        "nameZh": "威尼斯画派",
        "nameEn": "Venetian School",
        "timeSpan": "1500–1580",
        "description": "水城威尼斯以其繁荣的商贸、湿润充沛的海洋光线与自由开放的世俗风尚，孕育了与佛罗伦萨素描传统截然不同的画派风格。威尼斯画派以饱满浓艳的色彩、温润丰富的光泽、开创性的油画画布运用及优美抒情的世俗感官体验闻名于世。",
        "representativeWorkId": "venetian_school_03",
        "painters": [
            {
                "id": "giorgione",
                "nameZh": "乔尔乔内",
                "nameEn": "Giorgione",
                "birthDeath": "c. 1477–1510",
                "description": "威尼斯画派色彩抒情大师，擅长将神秘朦胧的情绪融入诗意田园风光与人物描绘中。",
                "representativeWorkId": "venetian_school_01"
            },
            {
                "id": "titian",
                "nameZh": "提香·韦切利奥",
                "nameEn": "Titian",
                "birthDeath": "c. 1488–1576",
                "description": "西方油画色彩之父，画风雄浑豪放、笔触层次丰富，对欧洲后世鲁本斯、委拉斯开兹等产生深远影响。",
                "representativeWorkId": "venetian_school_03"
            },
            {
                "id": "tintoretto",
                "nameZh": "丁托列托",
                "nameEn": "Tintoretto",
                "birthDeath": "1518–1594",
                "description": "以米开朗基罗的形体与提香的色彩为追求，善用戏剧性俯仰视角、剧烈动感与耀眼光芒营造史诗场面。",
                "representativeWorkId": "venetian_school_05"
            },
            {
                "id": "veronese",
                "nameZh": "保罗·委罗内塞",
                "nameEn": "Paolo Veronese",
                "birthDeath": "1528–1588",
                "description": "色彩华贵的大型历史与风俗画大师，以繁复宏大的宴饮构图与威尼斯黄金时代的奢丽衣褶见长。",
                "representativeWorkId": "venetian_school_07"
            }
        ]
    },
    {
        "id": "baroque",
        "nameZh": "巴洛克艺术",
        "nameEn": "Baroque",
        "timeSpan": "1600–1750",
        "description": "巴洛克艺术在17世纪欧洲反宗教改革运动与王权强化背景下诞生。它打破了文艺复兴的静态平衡与克制，强调动态对角线、剧烈的明暗对照（Chiaroscuro / Tenebrism）、强烈的戏剧冲突与丰富的情感张力，带给观者强烈的视听冲击与沉浸震撼。",
        "representativeWorkId": "baroque_04",
        "painters": [
            {
                "id": "caravaggio",
                "nameZh": "卡拉瓦乔",
                "nameEn": "Caravaggio",
                "birthDeath": "1571–1610",
                "description": "巴洛克现实主义开山鼻祖，以激进强烈的暗色调光影对峙与毫无美化的质朴生活真实颠覆了古典范式。",
                "representativeWorkId": "baroque_01"
            },
            {
                "id": "velazquez",
                "nameZh": "迭戈·委拉斯开兹",
                "nameEn": "Diego Velázquez",
                "birthDeath": "1599–1660",
                "description": "西班牙宫廷画师，马奈称其为‘画家中之画家’，以松动洒脱的笔触与极致真实的空气感探索光学知觉。",
                "representativeWorkId": "baroque_03"
            },
            {
                "id": "rembrandt",
                "nameZh": "伦勃朗·范·莱因",
                "nameEn": "Rembrandt van Rijn",
                "birthDeath": "1606–1669",
                "description": "荷兰黄金时代最伟大的灵魂画师，以如同舞台聚光灯般的黄金明暗法和对人类深层精神痛苦的怜悯洞察著称。",
                "representativeWorkId": "baroque_04"
            },
            {
                "id": "vermeer",
                "nameZh": "约翰内斯·维米尔",
                "nameEn": "Johannes Vermeer",
                "birthDeath": "1632–1675",
                "description": "光影魔术师与室内风俗画巨匠，以冷谧沉静的珍珠色调、严密几何空间感与细腻点状高光打动世人。",
                "representativeWorkId": "baroque_05"
            },
            {
                "id": "rubens",
                "nameZh": "彼得·保罗·鲁本斯",
                "nameEn": "Peter Paul Rubens",
                "birthDeath": "1577–1640",
                "description": "佛兰德斯巴洛克领袖，作品气势磅礴、旋律激昂、肉体丰腴、色彩绚丽，充满非凡的生命力与狂欢热情。",
                "representativeWorkId": "baroque_07"
            }
        ]
    },
    {
        "id": "rococo",
        "nameZh": "洛可可艺术",
        "nameEn": "Rococo",
        "timeSpan": "1730–1780",
        "description": "洛可可艺术在18世纪法国路易十五时期的贵族沙龙中盛行，是对凡尔赛宫严肃宏伟巴洛克风格的轻巧反拨。风格推崇精致柔美、轻盈欢快与世俗愉悦，多采用柔和粉嫩色彩、优美曲面与植物蔓藤纹饰，尽情展现风流雅宴（Fêtes galantes）、神话爱情与浪漫私语。",
        "representativeWorkId": "rococo_01",
        "painters": [
            {
                "id": "fragonard",
                "nameZh": "让-奥诺雷·弗拉戈纳尔",
                "nameEn": "Jean-Honoré Fragonard",
                "birthDeath": "1732–1806",
                "description": "洛可可晚期集大成者，笔触轻快灵动如飞，擅长表现带有俏皮与浪漫暗示的世俗爱情场景。",
                "representativeWorkId": "rococo_01"
            },
            {
                "id": "boucher",
                "nameZh": "弗朗索瓦·布歇",
                "nameEn": "François Boucher",
                "birthDeath": "1703–1770",
                "description": "蓬帕杜夫人的首席宫廷画家，以甜美曼妙的肉粉与天蓝色调、娇媚动人的神话女神与牧歌风情著称。",
                "representativeWorkId": "rococo_03"
            },
            {
                "id": "watteau",
                "nameZh": "让-安托万·华托",
                "nameEn": "Jean-Antoine Watteau",
                "birthDeath": "1684–1721",
                "description": "洛可可风格奠基者，首创‘游宴画’，在精致优雅的宫廷嬉戏中流露出一丝淡淡的哀愁与梦幻诗意。",
                "representativeWorkId": "rococo_05"
            }
        ]
    },
    {
        "id": "neoclassicism",
        "nameZh": "新古典主义",
        "nameEn": "Neoclassicism",
        "timeSpan": "1770–1830",
        "description": "新古典主义与欧洲启蒙运动、庞贝古城考古发现及法国大革命息息相关。它坚决反对洛可可的轻浮享乐与繁琐装饰，倡导理智、庄严、公民道德与爱国英雄主义，强调轮廓清晰严谨、画面平衡克制、线条优美有力与古罗马式的崇高秩序。",
        "representativeWorkId": "neoclassicism_01",
        "painters": [
            {
                "id": "david",
                "nameZh": "雅克-路易·大卫",
                "nameEn": "Jacques-Louis David",
                "birthDeath": "1748–1825",
                "description": "新古典主义旗手与革命鼓手，作品以冷峻坚定的雕塑感形体、严整舞台式构图和激昂的英雄史诗气魄闻名。",
                "representativeWorkId": "neoclassicism_01"
            },
            {
                "id": "ingres",
                "nameZh": "让-奥古斯特-多米尼克·安格尔",
                "nameEn": "Jean-Auguste-Dominique Ingres",
                "birthDeath": "1780–1867",
                "description": "西方素描线条的最高造诣者，大卫弟子，毕生坚守拉斐尔古典传统，将纯粹流转的线条美提炼到极致。",
                "representativeWorkId": "neoclassicism_04"
            },
            {
                "id": "vigee_le_brun",
                "nameZh": "伊丽莎白·维杰·勒布伦",
                "nameEn": "Élisabeth Vigée Le Brun",
                "birthDeath": "1755–1842",
                "description": "18世纪欧洲最杰出的女性肖像画家，画风兼具新古典主义的庄重清晰与亲切温婉的人文亲和力。",
                "representativeWorkId": "neoclassicism_07"
            }
        ]
    },
    {
        "id": "romanticism",
        "nameZh": "浪漫主义",
        "nameEn": "Romanticism",
        "timeSpan": "1780–1850",
        "description": "浪漫主义作为对新古典主义冷漠理性与工业化机械秩序的反叛，将人类狂放的情感、无羁的想象、崇高的自然力量与对自由平等的呼唤置于至尊地位。画面常展现汹涌的风暴、神秘的梦境、激烈的民族解放斗争与大自然的苍茫浩瀚，色调浓郁、笔触极具表现力。",
        "representativeWorkId": "romanticism_01",
        "painters": [
            {
                "id": "delacroix",
                "nameZh": "欧仁·德拉克罗瓦",
                "nameEn": "Eugène Delacroix",
                "birthDeath": "1798–1863",
                "description": "法国浪漫主义画派泰斗，色彩狂想家，以奔腾翻卷的笔触、绚烂夺目的色彩与澎湃热烈的情感震撼画坛。",
                "representativeWorkId": "romanticism_01"
            },
            {
                "id": "friedrich",
                "nameZh": "卡斯帕·大卫·弗里德里希",
                "nameEn": "Caspar David Friedrich",
                "birthDeath": "1774–1840",
                "description": "德国浪漫主义风景大师，善于以孤寂背影、浓雾孤峰与断壁残垣寄托形而上的崇高冥想与精神皈依。",
                "representativeWorkId": "romanticism_03"
            },
            {
                "id": "goya",
                "nameZh": "弗朗西斯科·戈雅",
                "nameEn": "Francisco Goya",
                "birthDeath": "1746–1828",
                "description": "西班牙艺术奇才与现代艺术先驱，早年富丽堂皇，晚年以黑色绘画直刺战争残酷与人性深渊。",
                "representativeWorkId": "romanticism_05"
            },
            {
                "id": "turner",
                "nameZh": "J. M. W. 透纳",
                "nameEn": "J. M. W. Turner",
                "birthDeath": "1775–1851",
                "description": "英国光影巨匠与现代风景画宗师，将光线与空气的纯粹运动作为主角，被誉为‘光之画家’。",
                "representativeWorkId": "romanticism_07"
            }
        ]
    },
    {
        "id": "impressionism",
        "nameZh": "印象派与后印象派",
        "nameEn": "Impressionism & Post-Impressionism",
        "timeSpan": "1870–1905",
        "description": "印象派走出暗淡画室投奔大自然，捕捉瞬息万变的光影瞬间与色彩分解视觉效果；随后后印象派更是将艺术从客观再现中解放出来，注入强烈的精神主观性、形式秩序与结构探索，直接启迪了现代绘画的辉煌序曲。",
        "representativeWorkId": "impressionism_01",
        "painters": [
            {
                "id": "monet",
                "nameZh": "克劳德·莫奈",
                "nameEn": "Claude Monet",
                "birthDeath": "1840–1926",
                "description": "印象派核心领袖与光色探求者，终其一生追逐瞬息万变的光线变化，水波与睡莲成为永恒的视觉交响乐。",
                "representativeWorkId": "impressionism_01"
            },
            {
                "id": "renoir",
                "nameZh": "皮耶罗-奥古斯特·雷诺阿",
                "nameEn": "Pierre-Auguste Renoir",
                "birthDeath": "1841–1919",
                "description": "印象派人间欢愉赞歌的吟唱者，以轻盈流动的笔触和明朗欢快的暖色调捕捉生活的美好与优雅。",
                "representativeWorkId": "impressionism_03"
            },
            {
                "id": "van_gogh",
                "nameZh": "文森特·梵高",
                "nameEn": "Vincent van Gogh",
                "birthDeath": "1853–1890",
                "description": "后印象派精神先驱，以旋转翻滚的炽热笔触、纯粹狂烈的原色对比，将灵魂的痛苦与激情永恒地燃烧在画布之上。",
                "representativeWorkId": "impressionism_04"
            },
            {
                "id": "cezanne",
                "nameZh": "保罗·塞尚",
                "nameEn": "Paul Cézanne",
                "birthDeath": "1839–1906",
                "description": "‘现代艺术之父’，致力于用色彩构建画面的坚实骨骼与永恒秩序，打破单点透视，开启立体几何新视界。",
                "representativeWorkId": "impressionism_06"
            },
            {
                "id": "seurat",
                "nameZh": "乔治·修拉",
                "nameEn": "Georges Seurat",
                "birthDeath": "1859–1891",
                "description": "新印象派（点彩派）创始人，以科学的光学色彩分割理论与无数微小色点构建静谧永恒的宏大结构。",
                "representativeWorkId": "impressionism_07"
            }
        ]
    }
]

# 56 Masterpieces list
PAINTINGS_SPEC = [
    # Period 1: Early Renaissance
    {
        "id": "early_renaissance_01",
        "periodId": "early_renaissance",
        "titleZh": "维纳斯的诞生",
        "titleEn": "The Birth of Venus",
        "artistZh": "桑德罗·波提切利",
        "artistEn": "Sandro Botticelli",
        "birthDeath": "c. 1445–1510",
        "year": "c. 1485",
        "wikiQuery": "File:Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg",
        "altSearch": "Birth of Venus Botticelli Uffizi"
    },
    {
        "id": "early_renaissance_02",
        "periodId": "early_renaissance",
        "titleZh": "春",
        "titleEn": "Primavera",
        "artistZh": "桑德罗·波提切利",
        "artistEn": "Sandro Botticelli",
        "birthDeath": "c. 1445–1510",
        "year": "c. 1480",
        "wikiQuery": "File:Botticelli-primavera.jpg",
        "altSearch": "Botticelli Primavera Uffizi"
    },
    {
        "id": "early_renaissance_03",
        "periodId": "early_renaissance",
        "titleZh": "圣三位一体",
        "titleEn": "Holy Trinity",
        "artistZh": "马萨乔",
        "artistEn": "Masaccio",
        "birthDeath": "1401–1428",
        "year": "c. 1425–1427",
        "wikiQuery": "File:Masaccio_trinity.jpg",
        "altSearch": "Masaccio Holy Trinity Santa Maria Novella"
    },
    {
        "id": "early_renaissance_04",
        "periodId": "early_renaissance",
        "titleZh": "纳税钱",
        "titleEn": "The Tribute Money",
        "artistZh": "马萨乔",
        "artistEn": "Masaccio",
        "birthDeath": "1401–1428",
        "year": "c. 1425",
        "wikiQuery": "File:Masaccio,_tributo.jpg",
        "altSearch": "Masaccio Tribute Money Brancacci Chapel"
    },
    {
        "id": "early_renaissance_05",
        "periodId": "early_renaissance",
        "titleZh": "受胎告知",
        "titleEn": "The Annunciation",
        "artistZh": "安吉利科修士",
        "artistEn": "Fra Angelico",
        "birthDeath": "c. 1395–1455",
        "year": "c. 1438–1445",
        "wikiQuery": "File:Fra_Angelico_-_The_Annunciation_-_WGA00472.jpg",
        "altSearch": "Fra Angelico Annunciation San Marco"
    },
    {
        "id": "early_renaissance_06",
        "periodId": "early_renaissance",
        "titleZh": "基督受洗",
        "titleEn": "The Baptism of Christ",
        "artistZh": "皮耶罗·德拉·弗朗西斯卡",
        "artistEn": "Piero della Francesca",
        "birthDeath": "c. 1415–1492",
        "year": "c. 1448–1450",
        "wikiQuery": "File:Piero_della_Francesca_045.jpg",
        "altSearch": "Piero della Francesca Baptism of Christ National Gallery"
    },
    {
        "id": "early_renaissance_07",
        "periodId": "early_renaissance",
        "titleZh": "乌尔比诺公爵夫妇肖像",
        "titleEn": "Diptych of the Duke and Duchess of Urbino",
        "artistZh": "皮耶罗·德拉·弗朗西斯卡",
        "artistEn": "Piero della Francesca",
        "birthDeath": "c. 1415–1492",
        "year": "c. 1472",
        "wikiQuery": "File:Piero_della_Francesca_-_Dittico_dei_duchi_d'Urbino_-_Google_Art_Project.jpg",
        "altSearch": "Piero della Francesca Duke and Duchess of Urbino"
    },

    # Period 2: High Renaissance
    {
        "id": "high_renaissance_01",
        "periodId": "high_renaissance",
        "titleZh": "蒙娜丽莎",
        "titleEn": "Mona Lisa",
        "artistZh": "莱昂纳多·达·芬奇",
        "artistEn": "Leonardo da Vinci",
        "birthDeath": "1452–1519",
        "year": "1503–1519",
        "wikiQuery": "File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg",
        "altSearch": "Mona Lisa Leonardo da Vinci Louvre"
    },
    {
        "id": "high_renaissance_02",
        "periodId": "high_renaissance",
        "titleZh": "最后的晚餐",
        "titleEn": "The Last Supper",
        "artistZh": "莱昂纳多·达·芬奇",
        "artistEn": "Leonardo da Vinci",
        "birthDeath": "1452–1519",
        "year": "1495–1498",
        "wikiQuery": "File:The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg",
        "altSearch": "The Last Supper Leonardo da Vinci Santa Maria delle Grazie"
    },
    {
        "id": "high_renaissance_03",
        "periodId": "high_renaissance",
        "titleZh": "抱银鼠的女子",
        "titleEn": "Lady with an Ermine",
        "artistZh": "莱昂纳多·达·芬奇",
        "artistEn": "Leonardo da Vinci",
        "birthDeath": "1452–1519",
        "year": "c. 1489–1490",
        "wikiQuery": "File:Lady_with_an_Ermine-Leonardo_da_Vinci_(1489-1490).jpg",
        "altSearch": "Lady with an Ermine Leonardo Czartoryski"
    },
    {
        "id": "high_renaissance_04",
        "periodId": "high_renaissance",
        "titleZh": "创造亚当",
        "titleEn": "The Creation of Adam",
        "artistZh": "米开朗基罗·博那罗蒂",
        "artistEn": "Michelangelo Buonarroti",
        "birthDeath": "1475–1564",
        "year": "c. 1512",
        "wikiQuery": "File:Michelangelo_-_Creation_of_Adam_(cropped).jpg",
        "altSearch": "Creation of Adam Michelangelo Sistine Chapel"
    },
    {
        "id": "high_renaissance_05",
        "periodId": "high_renaissance",
        "titleZh": "最后的审判",
        "titleEn": "The Last Judgment",
        "artistZh": "米开朗基罗·博那罗蒂",
        "artistEn": "Michelangelo Buonarroti",
        "birthDeath": "1475–1564",
        "year": "1536–1541",
        "wikiQuery": "File:Last_Judgement_(Michelangelo).jpg",
        "altSearch": "Last Judgement Michelangelo Sistine Chapel"
    },
    {
        "id": "high_renaissance_06",
        "periodId": "high_renaissance",
        "titleZh": "雅典学院",
        "titleEn": "The School of Athens",
        "artistZh": "拉斐尔·桑西",
        "artistEn": "Raphael",
        "birthDeath": "1483–1520",
        "year": "1509–1511",
        "wikiQuery": "File:The_School_of_Athens__by_Raffaello_Sanzio_da_Urbino.jpg",
        "altSearch": "The School of Athens Raphael Vatican"
    },
    {
        "id": "high_renaissance_07",
        "periodId": "high_renaissance",
        "titleZh": "西斯廷圣母",
        "titleEn": "Sistine Madonna",
        "artistZh": "拉斐尔·桑西",
        "artistEn": "Raphael",
        "birthDeath": "1483–1520",
        "year": "1512–1513",
        "wikiQuery": "File:RAFAEL_-_Madonna_Sixtina_(Gemäldegalerie_Alter_Meister,_Dresden,_1513-14._Óleo_sobre_lienzo,_265_x_196_cm).jpg",
        "altSearch": "Sistine Madonna Raphael Dresden"
    },

    # Period 3: Venetian School
    {
        "id": "venetian_school_01",
        "periodId": "venetian_school",
        "titleZh": "暴风雨",
        "titleEn": "The Tempest",
        "artistZh": "乔尔乔内",
        "artistEn": "Giorgione",
        "birthDeath": "c. 1477–1510",
        "year": "c. 1508",
        "wikiQuery": "File:Giorgione_-_La_Tempesta.jpg",
        "altSearch": "Giorgione La Tempesta Accademia Venice"
    },
    {
        "id": "venetian_school_02",
        "periodId": "venetian_school",
        "titleZh": "沉睡的维纳斯",
        "titleEn": "Sleeping Venus",
        "artistZh": "乔尔乔内",
        "artistEn": "Giorgione",
        "birthDeath": "c. 1477–1510",
        "year": "c. 1510",
        "wikiQuery": "File:Giorgione_-_Sleeping_Venus_-_Google_Art_Project.jpg",
        "altSearch": "Sleeping Venus Giorgione Dresden"
    },
    {
        "id": "venetian_school_03",
        "periodId": "venetian_school",
        "titleZh": "乌尔比诺的维纳斯",
        "titleEn": "Venus of Urbino",
        "artistZh": "提香·韦切利奥",
        "artistEn": "Titian",
        "birthDeath": "c. 1488–1576",
        "year": "1534",
        "wikiQuery": "File:Tiziano_-_Venere_di_Urbino_-_Google_Art_Project.jpg",
        "altSearch": "Venus of Urbino Titian Uffizi"
    },
    {
        "id": "venetian_school_04",
        "periodId": "venetian_school",
        "titleZh": "圣母升天",
        "titleEn": "Assumption of the Virgin",
        "artistZh": "提香·韦切利奥",
        "artistEn": "Titian",
        "birthDeath": "c. 1488–1576",
        "year": "1516–1518",
        "wikiQuery": "File:Tizian_041.jpg",
        "altSearch": "Titian Assumption of the Virgin Frari"
    },
    {
        "id": "venetian_school_05",
        "periodId": "venetian_school",
        "titleZh": "酒神与阿丽亚德妮",
        "titleEn": "Bacchus and Ariadne",
        "artistZh": "提香·韦切利奥",
        "artistEn": "Titian",
        "birthDeath": "c. 1488–1576",
        "year": "1520–1523",
        "wikiQuery": "File:Bacchus_and_Ariadne_by_Titian.jpg",
        "altSearch": "Bacchus and Ariadne Titian National Gallery"
    },
    {
        "id": "venetian_school_06",
        "periodId": "venetian_school",
        "titleZh": "圣马可解救奴隶",
        "titleEn": "The Miracle of the Slave",
        "artistZh": "丁托列托",
        "artistEn": "Tintoretto",
        "birthDeath": "1518–1594",
        "year": "1548",
        "wikiQuery": "File:Tintoretto,_San_Marco_salva_lo_schiavo,_1548,_Gallerie_dell'Accademia,_Venezia.jpg",
        "altSearch": "Tintoretto Miracle of the Slave Accademia"
    },
    {
        "id": "venetian_school_07",
        "periodId": "venetian_school",
        "titleZh": "加纳的婚礼",
        "titleEn": "The Wedding at Cana",
        "artistZh": "保罗·委罗内塞",
        "artistEn": "Paolo Veronese",
        "birthDeath": "1528–1588",
        "year": "1563",
        "wikiQuery": "File:Noces_de_Cana_Veronese_inv142_departement_Peintures_musee_Louvre.jpg",
        "altSearch": "Wedding at Cana Veronese Louvre"
    },

    # Period 4: Baroque
    {
        "id": "baroque_01",
        "periodId": "baroque",
        "titleZh": "圣马太蒙召",
        "titleEn": "The Calling of Saint Matthew",
        "artistZh": "卡拉瓦乔",
        "artistEn": "Caravaggio",
        "birthDeath": "1571–1610",
        "year": "1599–1600",
        "wikiQuery": "File:Caravaggio_-_The_Calling_of_Saint_Matthew.jpg",
        "altSearch": "Calling of Saint Matthew Caravaggio Contarelli"
    },
    {
        "id": "baroque_02",
        "periodId": "baroque",
        "titleZh": "犹滴割下荷罗孚尼的头颅",
        "titleEn": "Judith Beheading Holofernes",
        "artistZh": "卡拉瓦乔",
        "artistEn": "Caravaggio",
        "birthDeath": "1571–1610",
        "year": "c. 1598–1599",
        "wikiQuery": "File:Judith_Beheading_Holofernes_by_Caravaggio.jpg",
        "altSearch": "Judith Beheading Holofernes Caravaggio Barberini"
    },
    {
        "id": "baroque_03",
        "periodId": "baroque",
        "titleZh": "宫娥",
        "titleEn": "Las Meninas",
        "artistZh": "迭戈·委拉斯开兹",
        "artistEn": "Diego Velázquez",
        "birthDeath": "1599–1660",
        "year": "1656",
        "wikiQuery": "File:Las_Meninas,_by_Diego_Velázquez,_from_Prado_in_Google_Earth.jpg",
        "altSearch": "Las Meninas Velazquez Prado"
    },
    {
        "id": "baroque_04",
        "periodId": "baroque",
        "titleZh": "夜巡",
        "titleEn": "The Night Watch",
        "artistZh": "伦勃朗·范·莱因",
        "artistEn": "Rembrandt van Rijn",
        "birthDeath": "1606–1669",
        "year": "1642",
        "wikiQuery": "File:The_Nightwatch_by_Rembrandt_-_Rijksmuseum.jpg",
        "altSearch": "The Night Watch Rembrandt Rijksmuseum"
    },
    {
        "id": "baroque_05",
        "periodId": "baroque",
        "titleZh": "戴珍珠耳环的少女",
        "titleEn": "Girl with a Pearl Earring",
        "artistZh": "约翰内斯·维米尔",
        "artistEn": "Johannes Vermeer",
        "birthDeath": "1632–1675",
        "year": "c. 1665",
        "wikiQuery": "File:Johannes_Vermeer_(1632-1675)_-_The_Girl_with_a_Pearl_Earring_(1665).jpg",
        "altSearch": "Girl with a Pearl Earring Vermeer Mauritshuis"
    },
    {
        "id": "baroque_06",
        "periodId": "baroque",
        "titleZh": "倒牛奶的女仆",
        "titleEn": "The Milkmaid",
        "artistZh": "约翰内斯·维米尔",
        "artistEn": "Johannes Vermeer",
        "birthDeath": "1632–1675",
        "year": "c. 1658",
        "wikiQuery": "File:Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg",
        "altSearch": "The Milkmaid Vermeer Rijksmuseum"
    },
    {
        "id": "baroque_07",
        "periodId": "baroque",
        "titleZh": "劫夺留西帕斯的女儿们",
        "titleEn": "The Rape of the Daughters of Leucippus",
        "artistZh": "彼得·保罗·鲁本斯",
        "artistEn": "Peter Paul Rubens",
        "birthDeath": "1577–1640",
        "year": "c. 1618",
        "wikiQuery": "File:Peter_Paul_Rubens_-_The_Rape_of_the_Daughters_of_Leucippus.jpg",
        "altSearch": "Rape of the Daughters of Leucippus Rubens Alte Pinakothek"
    },

    # Period 5: Rococo
    {
        "id": "rococo_01",
        "periodId": "rococo",
        "titleZh": "秋千",
        "titleEn": "The Swing",
        "artistZh": "让-奥诺雷·弗拉戈纳尔",
        "artistEn": "Jean-Honoré Fragonard",
        "birthDeath": "1732–1806",
        "year": "1767",
        "wikiQuery": "File:The_Swing_(Fragonard).jpg",
        "altSearch": "The Swing Fragonard Wallace Collection"
    },
    {
        "id": "rococo_02",
        "periodId": "rococo",
        "titleZh": "读书少女",
        "titleEn": "A Young Girl Reading",
        "artistZh": "让-奥诺雷·弗拉戈纳尔",
        "artistEn": "Jean-Honoré Fragonard",
        "birthDeath": "1732–1806",
        "year": "c. 1770",
        "wikiQuery": "File:Jean-Honoré_Fragonard_-_Young_Girl_Reading_-_Google_Art_Project.jpg",
        "altSearch": "Young Girl Reading Fragonard NGA"
    },
    {
        "id": "rococo_03",
        "periodId": "rococo",
        "titleZh": "蓬帕杜夫人肖像",
        "titleEn": "Madame de Pompadour",
        "artistZh": "弗朗索瓦·布歇",
        "artistEn": "François Boucher",
        "birthDeath": "1703–1770",
        "year": "1756",
        "wikiQuery": "File:Francois_Boucher_-_Madame_de_Pompadour_-_WGA02919.jpg",
        "altSearch": "Boucher Madame de Pompadour Alte Pinakothek"
    },
    {
        "id": "rococo_04",
        "periodId": "rococo",
        "titleZh": "维纳斯的凯旋",
        "titleEn": "The Triumph of Venus",
        "artistZh": "弗朗索瓦·布歇",
        "artistEn": "François Boucher",
        "birthDeath": "1703–1770",
        "year": "1740",
        "wikiQuery": "File:François_Boucher_-_The_Triumph_of_Venus_-_Nationalmuseum_Stockholm.jpg",
        "altSearch": "The Triumph of Venus Boucher Nationalmuseum"
    },
    {
        "id": "rococo_05",
        "periodId": "rococo",
        "titleZh": "舟发西苔岛",
        "titleEn": "The Embarkation for Cythera",
        "artistZh": "让-安托万·华托",
        "artistEn": "Jean-Antoine Watteau",
        "birthDeath": "1684–1721",
        "year": "1717",
        "wikiQuery": "File:Antoine_Watteau_-_Pèlerinage_à_l'île_de_Cythère.jpg",
        "altSearch": "Embarkation for Cythera Watteau Louvre"
    },
    {
        "id": "rococo_06",
        "periodId": "rococo",
        "titleZh": "丑角吉尔",
        "titleEn": "Pierrot (Gilles)",
        "artistZh": "让-安托万·华托",
        "artistEn": "Jean-Antoine Watteau",
        "birthDeath": "1684–1721",
        "year": "c. 1718–1719",
        "wikiQuery": "File:Jean-Antoine_Watteau_-_Pierrot,_dit_autrefois_Gilles_-_Google_Art_Project.jpg",
        "altSearch": "Pierrot Gilles Watteau Louvre"
    },
    {
        "id": "rococo_07",
        "periodId": "rococo",
        "titleZh": "门闩",
        "titleEn": "The Bolt",
        "artistZh": "让-奥诺雷·弗拉戈纳尔",
        "artistEn": "Jean-Honoré Fragonard",
        "birthDeath": "1732–1806",
        "year": "c. 1777",
        "wikiQuery": "File:Jean-Honoré_Fragonard_-_Le_Verrou.jpg",
        "altSearch": "Le Verrou Fragonard Louvre"
    },

    # Period 6: Neoclassicism
    {
        "id": "neoclassicism_01",
        "periodId": "neoclassicism",
        "titleZh": "荷拉斯兄弟之誓",
        "titleEn": "Oath of the Horatii",
        "artistZh": "雅克-路易·大卫",
        "artistEn": "Jacques-Louis David",
        "birthDeath": "1748–1825",
        "year": "1784",
        "wikiQuery": "File:Jacques-Louis_David,_Le_Serment_des_Horaces.jpg",
        "altSearch": "Oath of the Horatii David Louvre"
    },
    {
        "id": "neoclassicism_02",
        "periodId": "neoclassicism",
        "titleZh": "马拉之死",
        "titleEn": "The Death of Marat",
        "artistZh": "雅克-路易·大卫",
        "artistEn": "Jacques-Louis David",
        "birthDeath": "1748–1825",
        "year": "1793",
        "wikiQuery": "File:Death_of_Marat_by_David.jpg",
        "altSearch": "Death of Marat David Brussels"
    },
    {
        "id": "neoclassicism_03",
        "periodId": "neoclassicism",
        "titleZh": "跨越阿尔卑斯山圣伯纳隘道的拿破仑",
        "titleEn": "Napoleon Crossing the Alps",
        "artistZh": "雅克-路易·大卫",
        "artistEn": "Jacques-Louis David",
        "birthDeath": "1748–1825",
        "year": "1801",
        "wikiQuery": "File:Jacques-Louis_David_-_Bonaparte_franchissant_le_Grand-Saint-Bernard,_20_mai_1800_-_Google_Art_Project.jpg",
        "altSearch": "Napoleon Crossing the Alps David Rueil-Malmaison"
    },
    {
        "id": "neoclassicism_04",
        "periodId": "neoclassicism",
        "titleZh": "大宫女",
        "titleEn": "Grande Odalisque",
        "artistZh": "让-奥古斯特-多米尼克·安格尔",
        "artistEn": "Jean-Auguste-Dominique Ingres",
        "birthDeath": "1780–1867",
        "year": "1814",
        "wikiQuery": "File:Une_Odalisque,_par_Jean-Auguste-Dominique_Ingres,_du_Louvre.jpg",
        "altSearch": "Grande Odalisque Ingres Louvre"
    },
    {
        "id": "neoclassicism_05",
        "periodId": "neoclassicism",
        "titleZh": "泉",
        "titleEn": "The Source (La Source)",
        "artistZh": "让-奥古斯特-多米尼克·安格尔",
        "artistEn": "Jean-Auguste-Dominique Ingres",
        "birthDeath": "1780–1867",
        "year": "1856",
        "wikiQuery": "File:Jean-Auguste-Dominique_Ingres_-_The_Source_-_Musée_d'Orsay_RF_218.jpg",
        "altSearch": "La Source Ingres Musee d'Orsay"
    },
    {
        "id": "neoclassicism_06",
        "periodId": "neoclassicism",
        "titleZh": "拿破仑一世在皇座上",
        "titleEn": "Napoleon I on his Imperial Throne",
        "artistZh": "让-奥古斯特-多米尼克·安格尔",
        "artistEn": "Jean-Auguste-Dominique Ingres",
        "birthDeath": "1780–1867",
        "year": "1806",
        "wikiQuery": "File:Ingres,_Napoleon_on_his_Imperial_throne.jpg",
        "altSearch": "Napoleon on his Imperial throne Ingres Army Museum"
    },
    {
        "id": "neoclassicism_07",
        "periodId": "neoclassicism",
        "titleZh": "戴草帽的自画像",
        "titleEn": "Self-Portrait in a Straw Hat",
        "artistZh": "伊丽莎白·维杰·勒布伦",
        "artistEn": "Élisabeth Vigée Le Brun",
        "birthDeath": "1755–1842",
        "year": "1782",
        "wikiQuery": "File:Elisabeth_Vigée-Lebrun_-_Self-Portrait_in_a_Straw_Hat_-_National_Gallery,_London.jpg",
        "altSearch": "Self-Portrait in a Straw Hat Vigee Le Brun National Gallery"
    },

    # Period 7: Romanticism
    {
        "id": "romanticism_01",
        "periodId": "romanticism",
        "titleZh": "自由引导人民",
        "titleEn": "Liberty Leading the People",
        "artistZh": "欧仁·德拉克罗瓦",
        "artistEn": "Eugène Delacroix",
        "birthDeath": "1798–1863",
        "year": "1830",
        "wikiQuery": "File:Eugène_Delacroix_-_La_liberté_guidant_le_peuple.jpg",
        "altSearch": "Liberty Leading the People Delacroix Louvre"
    },
    {
        "id": "romanticism_02",
        "periodId": "romanticism",
        "titleZh": "萨达那帕拉之死",
        "titleEn": "The Death of Sardanapalus",
        "artistZh": "欧仁·德拉克罗瓦",
        "artistEn": "Eugène Delacroix",
        "birthDeath": "1798–1863",
        "year": "1827",
        "wikiQuery": "File:Delacroix_-_La_Mort_de_Sardanapale_(1827).jpg",
        "altSearch": "Death of Sardanapalus Delacroix Louvre"
    },
    {
        "id": "romanticism_03",
        "periodId": "romanticism",
        "titleZh": "雾海上的旅人",
        "titleEn": "Wanderer above the Sea of Fog",
        "artistZh": "卡斯帕·大卫·弗里德里希",
        "artistEn": "Caspar David Friedrich",
        "birthDeath": "1774–1840",
        "year": "1818",
        "wikiQuery": "File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg",
        "altSearch": "Wanderer above the sea of fog Friedrich Kunsthalle Hamburg"
    },
    {
        "id": "romanticism_04",
        "periodId": "romanticism",
        "titleZh": "冰海",
        "titleEn": "The Sea of Ice",
        "artistZh": "卡斯帕·大卫·弗里德里希",
        "artistEn": "Caspar David Friedrich",
        "birthDeath": "1774–1840",
        "year": "1823–1824",
        "wikiQuery": "File:Caspar_David_Friedrich_-_Das_Eismeer_-_Hamburger_Kunsthalle.jpg",
        "altSearch": "The Sea of Ice Das Eismeer Friedrich Hamburger Kunsthalle"
    },
    {
        "id": "romanticism_05",
        "periodId": "romanticism",
        "titleZh": "1808年5月3日的枪杀",
        "titleEn": "The Third of May 1808",
        "artistZh": "弗朗西斯科·戈雅",
        "artistEn": "Francisco Goya",
        "birthDeath": "1746–1828",
        "year": "1814",
        "wikiQuery": "File:El_tres_de_mayo_de_1808_en_Madrid_o_Los_fusilamientos_de_la_montaña_del_Príncipe_Pío,_por_Francisco_de_Goya.jpg",
        "altSearch": "The Third of May 1808 Goya Prado"
    },
    {
        "id": "romanticism_06",
        "periodId": "romanticism",
        "titleZh": "农神吞噬其子",
        "titleEn": "Saturn Devouring His Son",
        "artistZh": "弗朗西斯科·戈雅",
        "artistEn": "Francisco Goya",
        "birthDeath": "1746–1828",
        "year": "1819–1823",
        "wikiQuery": "File:Francisco_de_Goya,_Saturno_devorando_a_su_hijo_(1819-1823).jpg",
        "altSearch": "Saturn Devouring His Son Goya Prado"
    },
    {
        "id": "romanticism_07",
        "periodId": "romanticism",
        "titleZh": "战舰无畏号",
        "titleEn": "The Fighting Temeraire",
        "artistZh": "J. M. W. 透纳",
        "artistEn": "J. M. W. Turner",
        "birthDeath": "1775–1851",
        "year": "1839",
        "wikiQuery": "File:The_Fighting_Temeraire,_JMW_Turner,_National_Gallery.jpg",
        "altSearch": "The Fighting Temeraire Turner National Gallery"
    },

    # Period 8: Impressionism & Post-Impressionism
    {
        "id": "impressionism_01",
        "periodId": "impressionism",
        "titleZh": "日出·印象",
        "titleEn": "Impression, Sunrise",
        "artistZh": "克劳德·莫奈",
        "artistEn": "Claude Monet",
        "birthDeath": "1840–1926",
        "year": "1872",
        "wikiQuery": "File:Claude_Monet,_Impression,_soleil_levant.jpg",
        "altSearch": "Impression, soleil levant Monet Marmottan"
    },
    {
        "id": "impressionism_02",
        "periodId": "impressionism",
        "titleZh": "睡莲",
        "titleEn": "Water Lilies",
        "artistZh": "克劳德·莫奈",
        "artistEn": "Claude Monet",
        "birthDeath": "1840–1926",
        "year": "1916",
        "wikiQuery": "File:Claude_Monet_-_Water_Lilies_-_1916.jpg",
        "altSearch": "Monet Water Lilies 1916 National Museum of Western Art"
    },
    {
        "id": "impressionism_03",
        "periodId": "impressionism",
        "titleZh": "煎饼磨坊的舞会",
        "titleEn": "Bal du moulin de la Galette",
        "artistZh": "皮耶罗-奥古斯特·雷诺阿",
        "artistEn": "Pierre-Auguste Renoir",
        "birthDeath": "1841–1919",
        "year": "1876",
        "wikiQuery": "File:Pierre-Auguste_Renoir_-_Bal_du_moulin_de_la_Galette_-_Musée_d'Orsay_RF_2739.jpg",
        "altSearch": "Bal du moulin de la Galette Renoir Musee d'Orsay"
    },
    {
        "id": "impressionism_04",
        "periodId": "impressionism",
        "titleZh": "星夜",
        "titleEn": "The Starry Night",
        "artistZh": "文森特·梵高",
        "artistEn": "Vincent van Gogh",
        "birthDeath": "1853–1890",
        "year": "1889",
        "wikiQuery": "File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
        "altSearch": "Starry Night Van Gogh MoMA"
    },
    {
        "id": "impressionism_05",
        "periodId": "impressionism",
        "titleZh": "向日葵",
        "titleEn": "Sunflowers",
        "artistZh": "文森特·梵高",
        "artistEn": "Vincent van Gogh",
        "birthDeath": "1853–1890",
        "year": "1888",
        "wikiQuery": "File:Vincent_Willem_van_Gogh_127.jpg",
        "altSearch": "Vincent Willem van Gogh 127 Sunflowers National Gallery"
    },
    {
        "id": "impressionism_06",
        "periodId": "impressionism",
        "titleZh": "圣维克多山",
        "titleEn": "Mont Sainte-Victoire",
        "artistZh": "保罗·塞尚",
        "artistEn": "Paul Cézanne",
        "birthDeath": "1839–1906",
        "year": "c. 1902–1904",
        "wikiQuery": "File:Paul_Cézanne_-_Mont_Sainte-Victoire_-_Google_Art_Project.jpg",
        "altSearch": "Mont Sainte-Victoire Paul Cezanne Philadelphia Museum of Art"
    },
    {
        "id": "impressionism_07",
        "periodId": "impressionism",
        "titleZh": "大碗岛的星期天下午",
        "titleEn": "A Sunday on La Grande Jatte",
        "artistZh": "乔治·修拉",
        "artistEn": "Georges Seurat",
        "birthDeath": "1859–1891",
        "year": "1884–1886",
        "wikiQuery": "File:A_Sunday_on_La_Grande_Jatte_--_Georges_Seurat.jpg",
        "altSearch": "A Sunday on La Grande Jatte Seurat Art Institute Chicago"
    }
]

period_map = {p["id"]: p for p in PERIODS}

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})

def get_wikimedia_image_info(title_or_query, alt_query=None):
    """
    Query Wikimedia Commons API to get thumburl and descriptionurl.
    First try direct title query, then generator search.
    """
    # 1. Direct title query
    if title_or_query.startswith("File:"):
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "titles": title_or_query,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": "1280",
            "format": "json"
        }
        try:
            r = session.get(url, params=params, timeout=12)
            if r.status_code == 200:
                data = r.json()
                pages = data.get("query", {}).get("pages", {})
                for pid, pdata in pages.items():
                    if pid != "-1" and "imageinfo" in pdata and pdata["imageinfo"]:
                        info = pdata["imageinfo"][0]
                        thumb = info.get("thumburl") or info.get("url")
                        desc = info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{title_or_query}"
                        if thumb:
                            return thumb, desc
        except Exception as e:
            print(f"Direct query error: {e}")

    # 2. Generator search with title_or_query
    search_terms = [title_or_query.replace("File:", "").replace(".jpg", "").replace("_", " ")]
    if alt_query:
        search_terms.append(alt_query)

    for term in search_terms:
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": term,
            "gsrnamespace": "6",
            "gsrlimit": "1",
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": "1280",
            "format": "json"
        }
        try:
            r = session.get(url, params=params, timeout=12)
            if r.status_code == 200:
                data = r.json()
                pages = data.get("query", {}).get("pages", {})
                for pid, pdata in pages.items():
                    if pid != "-1" and "imageinfo" in pdata and pdata["imageinfo"]:
                        info = pdata["imageinfo"][0]
                        thumb = info.get("thumburl") or info.get("url")
                        desc = info.get("descriptionurl") or "https://commons.wikimedia.org"
                        if thumb:
                            return thumb, desc
        except Exception as e:
            print(f"Search query error for {term}: {e}")

    return None, None

def download_and_verify_image(img_url, dest_path):
    """
    Download image, verify with Pillow, and convert/save as standard JPEG.
    Returns (width, height, aspect_ratio).
    """
    temp_path = dest_path + ".tmp"
    r = session.get(img_url, stream=True, timeout=25)
    if r.status_code != 200:
        raise Exception(f"Download failed with HTTP status {r.status_code}")

    with open(temp_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)

    # Open with PIL to verify integrity
    with Image.open(temp_path) as im:
        im.load()
        width, height = im.size
        # Convert RGBA / P to RGB if saving as JPEG
        if im.mode in ("RGBA", "P"):
            im = im.convert("RGB")
        im.save(dest_path, "JPEG", quality=92, optimize=True)

    if os.path.exists(temp_path):
        os.remove(temp_path)

    aspect_ratio = round(width / height, 4)
    return width, height, aspect_ratio

def main():
    print(f"Starting curation and download for {len(PAINTINGS_SPEC)} paintings...")
    manifest = []
    success_count = 0

    for idx, spec in enumerate(PAINTINGS_SPEC, start=1):
        pid = spec["id"]
        period = period_map[spec["periodId"]]
        filename = f"{pid}.jpg"
        dest_path = os.path.join(ASSETS_DIR, filename)
        rel_path = f"assets/paintings/{filename}"

        print(f"[{idx}/{len(PAINTINGS_SPEC)}] Processing {pid}: {spec['titleZh']} ({spec['artistZh']})...")

        # Check if already downloaded and valid
        width = 0
        height = 0
        aspect_ratio = 1.0
        source_url = ""

        need_download = True
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 10000:
            try:
                with Image.open(dest_path) as im:
                    width, height = im.size
                    aspect_ratio = round(width / height, 4)
                    need_download = False
                    source_url = f"https://commons.wikimedia.org/wiki/{spec['wikiQuery']}"
                    print(f"   Using existing verified image: {width}x{height}, ratio: {aspect_ratio}")
            except Exception:
                need_download = True

        if need_download:
            img_url, desc_url = get_wikimedia_image_info(spec["wikiQuery"], spec.get("altSearch"))
            if not img_url:
                print(f"   [ERROR] Could not find image URL for {spec['titleEn']}")
                continue
            source_url = desc_url or img_url
            print(f"   Downloading from: {img_url[:70]}...")
            try:
                width, height, aspect_ratio = download_and_verify_image(img_url, dest_path)
                print(f"   [OK] Downloaded and verified: {width}x{height}, ratio: {aspect_ratio}")
            except Exception as e:
                print(f"   [ERROR] Failed to download or verify {pid}: {e}")
                continue

        manifest_item = {
            "id": pid,
            "localPath": rel_path,
            "titleZh": spec["titleZh"],
            "titleEn": spec["titleEn"],
            "artistZh": spec["artistZh"],
            "artistEn": spec["artistEn"],
            "birthDeath": spec["birthDeath"],
            "year": spec["year"],
            "periodId": period["id"],
            "periodZh": period["nameZh"],
            "periodEn": period["nameEn"],
            "periodDesc": period["description"],
            "sourceUrl": source_url,
            "license": "Public Domain",
            "width": width,
            "height": height,
            "aspectRatio": aspect_ratio
        }
        manifest.append(manifest_item)
        success_count += 1
        time.sleep(0.3)

    print(f"\nSuccessfully cataloged {success_count} paintings!")

    # Write manifest.json
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Saved manifest to: {manifest_path}")

    # Write artHistoryData.js
    js_path = os.path.join(DATA_DIR, "artHistoryData.js")
    js_content = f"""/**
 * Time Gallery - Western Art History Dataset
 * Auto-generated by Art Curator
 * Total Periods: {len(PERIODS)}
 * Total Paintings: {len(manifest)}
 */

export const periods = {json.dumps(PERIODS, ensure_ascii=False, indent=2)};

export const paintings = {json.dumps(manifest, ensure_ascii=False, indent=2)};

export default {{
  periods,
  paintings
}};

// Attach to window global for non-module script tag usage
if (typeof window !== 'undefined') {{
  window.ArtHistoryData = {{
    periods,
    paintings
  }};
}}
"""
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Saved artHistoryData.js to: {js_path}")

if __name__ == "__main__":
    main()
