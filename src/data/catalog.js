export const catalogData = {
    BaHaMa: {
        name: "BaHaMa",
        type: "builder",
        currency: "EUR",
        models: {
            "Jumbrella": {
                name: "Jumbrella",
                sizes: {
                    // Kvadrat
                    "3x3 Kvadrat": { price: 2390 },
                    "3,5x3,5 Kvadrat": { price: 2860 },
                    "4x4 Kvadrat": { price: 3060 },
                    "4,5x4,5 Kvadrat": { price: 3360 },
                    "5x5 Kvadrat": { price: 4070 },
                    // Runda
                    "3* Runda": { price: 2110 },
                    "3,5* Runda": { price: 2230 },
                    "4* Runda": { price: 2390 },
                    "4,5* Runda": { price: 2790 },
                    "5* Runda": { price: 3260 },
                    "5,6* Runda": { price: 3670 },
                    "6,3* Runda": { price: 4070 },
                    "7* Runda": { price: 5210 },
                    // Rektangel
                    "3x1,5 Rektangel": { price: 2110 },
                    "3x3,5 Rektangel": { price: 2650 },
                    "4x2 Rektangel": { price: 2390 },
                    "4x3 Rektangel": { price: 2790 },
                    "4x3,5 Rektangel": { price: 2880 },
                    "4x4,5 Rektangel": { price: 3540 },
                    "4,5x3 Rektangel": { price: 3050 },
                    "4,5x3,5 Rektangel": { price: 3330 },
                    "5x2,5 Rektangel": { price: 2790 },
                    "5x3 Rektangel": { price: 3200 },
                    "5x3,75 Rektangel": { price: 3520 },
                    "5x4 Rektangel": { price: 3730 },
                    "6x3 Rektangel": { price: 3730 },
                    "6x4 Rektangel": { price: 4190 },
                    "6x4,5 Rektangel": { price: 5060 }
                },
                addonCategories: [
                    {
                        name: "Gjuthylsa",
                        items: [
                            { id: "gjuthylsa_jumbrella", name: "Gjuthylsa Jumbrella", price: 560 }
                        ]
                    },
                    {
                        name: "Installations alternativ",
                        items: [
                            { id: "conn_comp_tipping", name: "Connecting Components - for In-Ground Tipping Base", price: 320 },
                            { id: "in_ground_ext", name: "In-Ground Installation Extension", price: 410 },
                            { id: "in_ground_sleeve", name: "In-Ground Sleeve", price: 450 },
                            { id: "conn_comp_sleeve", name: "Connecting component for In-Ground Sleeve", price: 320 },
                            { id: "oct_surface_mount", name: "Octagonal Surface Mount", price: 560 },
                            { id: "base_8_flags", name: "Parasollfot ovan mark - 8 flagstones (100x100)", price: 670 },
                            { id: "base_12_flags", name: "Parasollfot ovan mark - 12 flagstones", price: 780 },
                            { id: "base_16_flags", name: "Parasollfot ovan mark - 16 flagstones", price: 1770 },
                            { id: "powder_coat", name: "Powder coating in RAL 9016/7016", price: 270 },
                            { id: "cementsten", name: "Cementsten (flagstone) (50x50)", price: 5 },
                            { id: "justerbara_fotter", name: "4 st Justerbara hörnfötter", price: 130 },
                            { id: "fancy_frame", name: "Fancy Frame", price: 670 }
                        ]
                    },
                    {
                        name: "Classic Light",
                        items: [
                            { id: "classic_light", name: "4 Lampor längs centrumstativet", price: 640 }
                        ]
                    },
                    {
                        name: "Magic Light",
                        items: [
                            { id: "magic_light", name: "Med 8 RGBW led-strips integrerade i armarna", price: 1400 }
                        ]
                    },
                    {
                        name: "Heating",
                        items: [
                            { id: "heating_2_rad", name: "2 Radiators", price: 2290 },
                            { id: "heating_4_kvarts", name: "Kvartsvärmare FLEX 1500 watt 4 per parasoll", price: 3070 },
                            { id: "premod_heating", name: "Premodification for heating", price: 1510 }
                        ]
                    },
                    {
                        name: "Cover",
                        items: [
                            { id: "cover_comfort", name: "Protective Cover –comfort", price: 400 },
                            { id: "telescopic_rod", name: "Telescopic rod for Comfort cover", price: 490 }
                        ]
                    },
                    {
                        name: "Textilduk RUND",
                        items: [
                            { id: "jumb_textil_o3", name: "JUMBRELLA Textilduk 3*", price: 690 },
                            { id: "jumb_textil_o35", name: "JUMBRELLA Textilduk 3,5*", price: 780 },
                            { id: "jumb_textil_o4", name: "JUMBRELLA Textilduk 4*", price: 960 },
                            { id: "jumb_textil_o45", name: "JUMBRELLA Textilduk 4,5*", price: 1130 },
                            { id: "jumb_textil_o5", name: "JUMBRELLA Textilduk 5*", price: 1280 },
                            { id: "jumb_textil_o56", name: "JUMBRELLA Textilduk 5,6*", price: 1560 },
                            { id: "jumb_textil_o63", name: "JUMBRELLA Textilduk 6,3*", price: 1940 },
                            { id: "jumb_textil_o7", name: "JUMBRELLA Textilduk 7*", price: 1940 }
                        ]
                    },
                    {
                        name: "Textilduk Kvadrat",
                        items: [
                            { id: "jumb_textil_3x3", name: "JUMBRELLA Textilduk 3x3", price: 820 },
                            { id: "jumb_textil_35x35", name: "JUMBRELLA Textilduk 3,5x3,5", price: 1100 },
                            { id: "jumb_textil_4x4", name: "JUMBRELLA Textilduk 4x4", price: 1220 },
                            { id: "jumb_textil_45x45", name: "JUMBRELLA Textilduk 4,5x4,5", price: 1410 },
                            { id: "jumb_textil_5x5", name: "JUMBRELLA Textilduk 5x5", price: 1780 }
                        ]
                    },
                    {
                        name: "Textilduk Rektangel",
                        items: [
                            { id: "jumb_textil_3x15", name: "JUMBRELLA Textilduk 3x1,5", price: 620 },
                            { id: "jumb_textil_35x35_rek", name: "JUMBRELLA Textilduk 3,5x3,5", price: 1020 },
                            { id: "jumb_textil_4x2", name: "JUMBRELLA Textilduk 4x2", price: 800 },
                            { id: "jumb_textil_4x3", name: "JUMBRELLA Textilduk 4x3", price: 1080 },
                            { id: "jumb_textil_4x35", name: "JUMBRELLA Textilduk 4x3,5", price: 1140 },
                            { id: "jumb_textil_45x3", name: "JUMBRELLA Textilduk 4,5x3", price: 1140 },
                            { id: "jumb_textil_45x35", name: "JUMBRELLA Textilduk 4,5x3,5", price: 1190 },
                            { id: "jumb_textil_45x4", name: "JUMBRELLA Textilduk 4,5x4", price: 1260 },
                            { id: "jumb_textil_5x25", name: "JUMBRELLA Textilduk 5x2,5", price: 1080 },
                            { id: "jumb_textil_5x3", name: "JUMBRELLA Textilduk 5x3", price: 1140 },
                            { id: "jumb_textil_5x375", name: "JUMBRELLA Textilduk 5x3,75", price: 1420 },
                            { id: "jumb_textil_5x4", name: "JUMBRELLA Textilduk 5x4", price: 1420 },
                            { id: "jumb_textil_6x3", name: "JUMBRELLA Textilduk 6x3", price: 1420 },
                            { id: "jumb_textil_6x4", name: "JUMBRELLA Textilduk 6x4", price: 1690 },
                            { id: "jumb_textil_6x45", name: "JUMBRELLA Textilduk 6x4,5", price: 1940 }
                        ]
                    },
                    {
                        name: "Hängränna Rektangel – Långsidan",
                        items: [
                            { id: "jumb_hang_lng_3x15", name: "Hängränna långsidan 3x1,5", price: 620 },
                            { id: "jumb_hang_lng_35x3", name: "Hängränna långsidan 3,5x3", price: 670 },
                            { id: "jumb_hang_lng_4x2", name: "Hängränna långsidan 4x2", price: 710 },
                            { id: "jumb_hang_lng_4x3", name: "Hängränna långsidan 4x3", price: 710 },
                            { id: "jumb_hang_lng_4x35", name: "Hängränna långsidan 4x3,5", price: 710 },
                            { id: "jumb_hang_lng_45x3", name: "Hängränna långsidan 4,5x3", price: 810 },
                            { id: "jumb_hang_lng_45x35", name: "Hängränna långsidan 4,5x3,5", price: 810 },
                            { id: "jumb_hang_lng_45x4", name: "Hängränna långsidan 4,5x4", price: 810 },
                            { id: "jumb_hang_lng_5x25", name: "Hängränna långsidan 5x2,5", price: 830 },
                            { id: "jumb_hang_lng_5x3", name: "Hängränna långsidan 5x3", price: 830 },
                            { id: "jumb_hang_lng_5x375", name: "Hängränna långsidan 5x3,75", price: 830 },
                            { id: "jumb_hang_lng_5x4", name: "Hängränna långsidan 5x4", price: 830 },
                            { id: "jumb_hang_lng_6x3", name: "Hängränna långsidan 6x3", price: 940 },
                            { id: "jumb_hang_lng_6x4", name: "Hängränna långsidan 6x4", price: 940 },
                            { id: "jumb_hang_lng_6x45", name: "Hängränna långsidan 6x4,5", price: 940 }
                        ]
                    },
                    {
                        name: "Hängränna Rektangel – Kortsidan",
                        items: [
                            { id: "jumb_hang_krt_3x15", name: "Hängränna kortsidan 3x1,5", price: 450 },
                            { id: "jumb_hang_krt_35x3", name: "Hängränna kortsidan 3,5x3", price: 620 },
                            { id: "jumb_hang_krt_4x2", name: "Hängränna kortsidan 4x2", price: 470 },
                            { id: "jumb_hang_krt_4x3", name: "Hängränna kortsidan 4x3", price: 620 },
                            { id: "jumb_hang_krt_4x35", name: "Hängränna kortsidan 4x3,5", price: 670 },
                            { id: "jumb_hang_krt_45x3", name: "Hängränna kortsidan 4,5x3", price: 620 },
                            { id: "jumb_hang_krt_45x35", name: "Hängränna kortsidan 4,5x3,5", price: 670 },
                            { id: "jumb_hang_krt_45x4", name: "Hängränna kortsidan 4,5x4", price: 710 },
                            { id: "jumb_hang_krt_5x25", name: "Hängränna kortsidan 5x2,5", price: 550 },
                            { id: "jumb_hang_krt_5x3", name: "Hängränna kortsidan 5x3", price: 620 },
                            { id: "jumb_hang_krt_5x375", name: "Hängränna kortsidan 5x3,75", price: 690 },
                            { id: "jumb_hang_krt_5x4", name: "Hängränna kortsidan 5x4", price: 710 },
                            { id: "jumb_hang_krt_6x3", name: "Hängränna kortsidan 6x3", price: 620 },
                            { id: "jumb_hang_krt_6x4", name: "Hängränna kortsidan 6x4", price: 710 },
                            { id: "jumb_hang_krt_6x45", name: "Hängränna kortsidan 6x4,5", price: 810 }
                        ]
                    },
                    {
                        name: "Annat",
                        items: [
                            { id: "jumb_tophatt", name: "Tophatt", price: 358 },
                            { id: "jumb_topboll", name: "Topboll", price: 186 }
                        ]
                    }
                ]
            },
            "Jumbrella XL": {
                name: "Jumbrella XL",
                sizes: {
                    // Kvadrat
                    "5x5 Kvadrat": { price: 7440 },
                    "5,5x5,5 Kvadrat": { price: 8010 },
                    "6x6 Kvadrat": { price: 8670 },
                    "7x7 Kvadrat": { price: 10700 },
                    // Rektangel
                    "6x5,14 Rektangel": { price: 8670 },
                    "7x5 Rektangel": { price: 9920 },
                    "7x6 Rektangel": { price: 11100 }
                },
                addonCategories: [
                    {
                        name: "Gjuthylsa",
                        items: [
                            { id: "xl_gjuthylsa", name: "Gjuthylsa XL", price: 740 }
                        ]
                    },
                    {
                        name: "Textilduk XL – Kvadrat",
                        items: [
                            { id: "xl_textil_5x5", name: "Textilduk XL 5x5", price: 3310 },
                            { id: "xl_textil_55x55", name: "Textilduk XL 5,5x5,5", price: 3420 },
                            { id: "xl_textil_6x6", name: "Textilduk XL 6x6", price: 3550 },
                            { id: "xl_textil_7x7", name: "Textilduk XL 7x7", price: 4250 }
                        ]
                    },
                    {
                        name: "Textilduk XL – Rektangel",
                        items: [
                            { id: "xl_textil_6x514", name: "Textilduk XL 6x5,14", price: 3420 },
                            { id: "xl_textil_7x5", name: "Textilduk XL 7x5", price: 3520 },
                            { id: "xl_textil_7x6", name: "Textilduk XL 7x6", price: 3870 }
                        ]
                    },
                    {
                        name: "Hängränna Kvadrat",
                        items: [
                            { id: "xl_hang_kv_5x5", name: "Hängränna 5x5", price: 1190 },
                            { id: "xl_hang_kv_55x55", name: "Hängränna 5,5x5,5", price: 1280 },
                            { id: "xl_hang_kv_6x6", name: "Hängränna 6x6", price: 1340 },
                            { id: "xl_hang_kv_7x7", name: "Hängränna 7x7", price: 1560 }
                        ]
                    },
                    {
                        name: "Hängränna Rektangel – Långsidan",
                        items: [
                            { id: "xl_hang_lng_6x514", name: "Hängränna långsidan 6x5,14", price: 1990 },
                            { id: "xl_hang_lng_7x5", name: "Hängränna långsidan 7x5", price: 1990 },
                            { id: "xl_hang_lng_7x6", name: "Hängränna långsidan 7x6", price: 1340 }
                        ]
                    },
                    {
                        name: "Hängränna Rektangel – Kortsidan",
                        items: [
                            { id: "xl_hang_krt_6x514", name: "Hängränna kortsidan 6x5,14", price: 1340 },
                            { id: "xl_hang_krt_7x5", name: "Hängränna kortsidan 7x5", price: 1560 },
                            { id: "xl_hang_krt_7x6", name: "Hängränna kortsidan 7x6", price: 1560 }
                        ]
                    },
                    {
                        name: "Installationsalternativ",
                        items: [
                            { id: "xl_conn_tipping", name: "Connecting component for In-Ground Tipping base", price: 440 },
                            { id: "xl_in_ground_ext", name: "In-Ground Installation Extension", price: 420 },
                            { id: "xl_surface_mount", name: "Surface Mount", price: 1610 },
                            { id: "xl_dual_console", name: "Dual Mounting Console", price: 2020 },
                            { id: "xl_spacer", name: "Spacer", price: 610 },
                            { id: "xl_spacer_electrics", name: "Spacer for Electrics", price: 660 }
                        ]
                    },
                    {
                        name: "Steel Plate Base",
                        items: [
                            { id: "xl_steel_base_4", name: "Steel Plate Base 4", price: 2830 },
                            { id: "xl_steel_base_8", name: "Steel Plate Base 8", price: 4940 }
                        ]
                    },
                    {
                        name: "Cross-Frame & Flagstones",
                        items: [
                            { id: "xl_crossframe_16", name: "Cross-Frame 16 flagstones", price: 1880 },
                            { id: "xl_flagstones_16", name: "Flagstones 16st", price: 440 }
                        ]
                    },
                    {
                        name: "Cosmetic",
                        items: [
                            { id: "xl_frame_fancy", name: "Frame Color fancy designs", price: 890 },
                            { id: "xl_frame_custom", name: "Frame Color custom finish", price: 660 }
                        ]
                    },
                    {
                        name: "V4A",
                        items: [
                            { id: "xl_v4a_maritime", name: "V4A | Maritime Edition", price: 540 }
                        ]
                    },
                    {
                        name: "Classic Light",
                        items: [
                            { id: "xl_classic_light_4", name: "4 Lampor längs centrumstativet", price: 720 },
                            { id: "xl_classic_light_6", name: "6 Lampor längs centrumstativet", price: 910 }
                        ]
                    },
                    {
                        name: "Magic Light",
                        items: [
                            { id: "xl_magic_light", name: "Med 8 RGBW led-strips integrerade i armarna", price: 1690 }
                        ]
                    },
                    {
                        name: "Heating",
                        items: [
                            { id: "xl_premod_heating", name: "Pre modifacation for heating", price: 1980 },
                            { id: "xl_kvarts_flex", name: "Kvartsvärmare FLEX 1500 watt 4 per parasoll", price: 3540 }
                        ]
                    },
                    {
                        name: "Cover",
                        items: [
                            { id: "xl_cover_comfort", name: "Protective Cover – comfort", price: 500 },
                            { id: "xl_telescopic_rod", name: "Telescopic rod for Comfort cover", price: 170 }
                        ]
                    },
                    {
                        name: "Soft Foam Safeguard",
                        items: [
                            { id: "xl_soft_foam", name: "Soft Foam Safeguard", price: 600 }
                        ]
                    }
                ]
            },
            "Pure": {
                name: "Pure",
                sizes: {
                    // KVADRAT
                    "2x2": { price: 1460 },
                    "2,5x2,5": { price: 1510 },
                    "3x3": { price: 1700 },
                    "3,5x3,5": { price: 1940 },
                    "4x4": { price: 2150 },
                    // Rund (Asterisk mapped to Ø for clarity)
                    "Ø2": { price: 1320 },
                    "Ø2,5": { price: 1340 },
                    "Ø3": { price: 1450 },
                    "Ø3,5": { price: 1670 },
                    "Ø4": { price: 1860 },
                    // Rektangel
                    "2,5x2": { price: 1320 },
                    "3x2": { price: 1320 },
                    "3x2,5": { price: 1560 },
                    "3,5x2": { price: 1560 },
                    "3,5x2,5": { price: 1670 },
                    "3,5x3": { price: 1810 },
                    "4x2": { price: 1670 },
                    "4x2,5": { price: 1810 },
                    "4x3": { price: 1960 },
                    "4x3,5": { price: 2120 }
                },
                addons: [],
                addonCategories: [
                    {
                        name: "Textilduk Kvadrat",
                        items: [
                            { id: "pure_textil_2x2", name: "PURE Textilduk 2x2", price: 690 },
                            { id: "pure_textil_25x25", name: "PURE Textilduk 2,5x2,5", price: 710 },
                            { id: "pure_textil_3x3", name: "PURE Textilduk 3x3", price: 800 },
                            { id: "pure_textil_35x35", name: "PURE Textilduk 3,5x3,5", price: 910 },
                            { id: "pure_textil_4x4", name: "PURE Textilduk 4x4", price: 1010 }
                        ]
                    },
                    {
                        name: "Textilduk Runda",
                        items: [
                            { id: "pure_textil_o2", name: "PURE Textilduk Ø2", price: 620 },
                            { id: "pure_textil_o25", name: "PURE Textilduk Ø2,5", price: 620 },
                            { id: "pure_textil_o3", name: "PURE Textilduk Ø3", price: 670 },
                            { id: "pure_textil_o35", name: "PURE Textilduk Ø3,5", price: 780 },
                            { id: "pure_textil_o4", name: "PURE Textilduk Ø4", price: 870 }
                        ]
                    },
                    {
                        name: "Textilduk Rektangel",
                        items: [
                            { id: "pure_textil_25x2", name: "PURE Textilduk 2,5x2", price: 620 },
                            { id: "pure_textil_3x2", name: "PURE Textilduk 3x2", price: 620 },
                            { id: "pure_textil_3x25", name: "PURE Textilduk 3x2,5", price: 730 },
                            { id: "pure_textil_35x2", name: "PURE Textilduk 3,5x2", price: 730 },
                            { id: "pure_textil_35x25", name: "PURE Textilduk 3,5x2,5", price: 780 },
                            { id: "pure_textil_35x3", name: "PURE Textilduk 3,5x3", price: 840 },
                            { id: "pure_textil_4x2", name: "PURE Textilduk 4x2", price: 780 },
                            { id: "pure_textil_4x25", name: "PURE Textilduk 4x2,5", price: 840 },
                            { id: "pure_textil_4x3", name: "PURE Textilduk 4x3", price: 920 },
                            { id: "pure_textil_4x35", name: "PURE Textilduk 4x3,5", price: 1000 }
                        ]
                    },
                    {
                        name: "Gjuthylsa",
                        items: [
                            { id: "pure_gjuthylsa", name: "Gjuthylsa PURE", price: 360 }
                        ]
                    },
                    {
                        name: "Tillbehör Pure (Surface/Bases)",
                        items: [
                            { id: "pure_surface_mount", name: "Surface Mount", price: 510 },
                            { id: "pure_surface_above", name: "Surface Mount (ovan markinstallation)", price: 510 },
                            { id: "pure_steel_base_4", name: "Steel Plate Base with 4 Steel Plates", price: 1580 },
                            { id: "pure_steel_base_8", name: "Steel Plate Base with 8 Steel Plates", price: 2480 },
                            { id: "pure_powder_coat_4", name: "Powder Coating of 4 Steel Plate", price: 540 }
                        ]
                    },
                    {
                        name: "Protective Covers",
                        items: [
                            { id: "pure_cover_basic", name: "Protective Cover - basic", price: 140 },
                            { id: "pure_cover_comfort", name: "Protective Cover - comfort", price: 400 },
                            { id: "pure_cover_comfort_rod", name: "Protective Cover - comfort with telescopic rod", price: 490 }
                        ]
                    },
                    {
                        name: "Flagstones & Feet",
                        items: [
                            { id: "pure_crossframe_8", name: "Cross-Frame for 8 flagstones", price: 670 },
                            { id: "pure_flagstone", name: "Cementsten (flagstone)", price: 7 },
                            { id: "pure_flagstones_8", name: "8 Standard Flagstones", price: 220 },
                            { id: "pure_leveling_feet", name: "4 Leveling Feet", price: 130 }
                        ]
                    },
                    {
                        name: "Mounts & Consoles",
                        items: [
                            { id: "pure_dual_console", name: "Dual Mounting Console", price: 820 },
                            { id: "pure_spacer", name: "Spacer", price: 390 },
                            { id: "pure_tilt_conn", name: "Tiltable Connecting Components", price: 260 }
                        ]
                    },
                    {
                        name: "Cosmetic & Special",
                        items: [
                            { id: "pure_frame_custom", name: "Frame Color custom finish", price: 560 },
                            { id: "pure_v4a_maritime", name: "V4A | Maritime", price: 230 }
                        ]
                    }
                ]
            }
        }
    },
    ClickitUP: {
        name: "ClickitUP",
        type: "grid",
        currency: "SEK",
        gridItems: [
            {
                model: "ClickitUp Sektion", sizes: [
                    { size: "700", price: 11134 },
                    { size: "1000", price: 11134 },
                    { size: "1100", price: 11379 },
                    { size: "1200", price: 11624 },
                    { size: "1300", price: 11869 },
                    { size: "1400", price: 12114 },
                    { size: "1500", price: 12358 },
                    { size: "1600", price: 12603 },
                    { size: "1700", price: 12848 },
                    { size: "1800", price: 13093 },
                    { size: "1900", price: 13338 },
                    { size: "2000", price: 13582 }
                ]
            },
            { model: "Curved Rundat Hörn", sizes: [{ size: "500x500", price: 21200 }] },
            {
                model: "ClickitUp Hane", sizes: [
                    { size: "1000", price: 11869 },
                    { size: "1100", price: 12114 }
                ]
            },
            {
                model: "ClickitUp Dörr", sizes: [
                    { size: "700", price: 16932 },
                    { size: "1000", price: 16932 },
                    { size: "1100", price: 17177 }
                ]
            }
        ],
        addonCategories: [
            {
                name: "Fraktkostnad",
                items: [
                    { id: "frakt_glas", name: "Glasfrakt Specialpall", price: 2120 }
                ]
            },
            {
                name: "Nödvändiga Tillval",
                items: [
                    { id: "stodben_stort", name: "Stödben stort (45°)", price: 1074 },
                    { id: "stodben_litet", name: "Stödben litet (Slimline)", price: 404 },
                    { id: "passbit_alu", name: "Passbit Alu stolpe (50x80mm) inkl. Täcklock", price: 1233 }
                ]
            },
            {
                name: "Rekommenderade tillval",
                items: [
                    { id: "svartanodiserade", name: "Svartanodiserade profiler", price: 340, autoScale: true },
                    { id: "stoppknapp", name: "Stoppknapp 140 cm", price: 564, autoScale: true }
                ]
            },
            {
                name: "Andra Tillval / Tillkommande",
                items: [
                    { id: "montering_gangjarn", name: "Montering Gångjärn Rostfritt", price: 1140 },
                    { id: "rostfritt_vinkel", name: "Rostfritt vinkelbeslag", price: 124 },
                    { id: "galvad_stall", name: "Galvad Ställfot (ovan mark inst)", price: 967 },
                    { id: "panikregel", name: "Panikregel", price: 5000 },
                    { id: "projektering", name: "Projektering. (Fast timpris)", price: 720 }
                ]
            }
        ]
    },
    Fiesta: {
        name: "Fiesta",
        type: "builder",
        currency: "SEK",
        models: {
            "FIESTA Biogasstolpe 12 kW": {
                name: "FIESTA Biogasstolpe 12 kW",
                sizes: {
                    "Standard": { price: 19115 }
                },
                addons: [
                    { id: "fiesta_foderrör", name: "Rostfritt Foderrör + Markplatta", price: 2815 },
                    { id: "fiesta_passram", name: "Passram + Däxel", price: 3406 },
                    { id: "fiesta_tipphylsa", name: "Tipphylsa - Demo exemplar", price: 2920 }
                ]
            }
        }
    }
};
