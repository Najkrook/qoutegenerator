import type { BuilderCatalogLineData, CatalogData } from '../types/contracts';

function slugifyBuilderCategoryId(value: unknown, fallback: string): string {
    const normalized = String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    return normalized || fallback;
}

function withBuilderAddonCategoryIds(catalog: CatalogData): CatalogData {
    return Object.entries(catalog).reduce<CatalogData>((catalogAcc, [lineId, lineData]) => {
        if (lineData?.type !== 'builder' || !lineData?.models) {
            catalogAcc[lineId] = lineData;
            return catalogAcc;
        }

        const models = Object.entries(lineData.models).reduce<BuilderCatalogLineData['models']>((modelsAcc, [modelId, modelData]) => {
            if (!Array.isArray(modelData?.addonCategories)) {
                modelsAcc[modelId] = modelData;
                return modelsAcc;
            }

            modelsAcc[modelId] = {
                ...modelData,
                addonCategories: modelData.addonCategories.map((category, index) => ({
                    ...category,
                    id: String(category?.id || slugifyBuilderCategoryId(category?.name, `category_${index}`))
                }))
            };
            return modelsAcc;
        }, {});

        catalogAcc[lineId] = {
            ...lineData,
            models
        };
        return catalogAcc;
    }, {});
}

const rawCatalogData: CatalogData = {
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
                    "6x6 Kvadrat": { price: 5600 },
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
                        name: "Installationsalternativ",
                        items: [
                            { id: "gjuthylsa_jumbrella", name: "Gjuthylsa Jumbrella", price: 560 },
                            { id: "jumb_in_ground_tipping_base_electrical", name: "In-Ground Tipping Base with electrical connection", price: 560 },
                            { id: "conn_comp_tipping", name: "Connecting Components - for In-Ground Tipping Base", price: 320 },
                            { id: "in_ground_ext", name: "In-Ground Installation Extension", price: 410 },
                            { id: "conn_comp_sleeve", name: "Connecting component for In-Ground Sleeve", price: 320 },
                            { id: "oct_surface_mount", name: "Octagonal Surface Mount", price: 560 },
                            { id: "base_8_flags", name: "Parasollfot ovan mark - 8 flagstones (100x100)", price: 670 },
                            { id: "base_12_flags", name: "Parasollfot ovan mark - 12 flagstones", price: 780 },
                            { id: "base_16_flags", name: "Parasollfot ovan mark - 16 flagstones", price: 1770 },
                            { id: "justerbara_fotter", name: "4 st Justerbara hörnfötter till Parasollfot", price: 130 },
                            { id: "jumb_steel_base_4_490", name: "Steel Plate Base with 4 Steel Plates (490x490)", price: 1590 },
                            { id: "jumb_steel_base_8_490", name: "Steel Plate Base with 8 Steel Plates (490x490)", price: 2480 },
                            { id: "jumb_steel_base_4_740", name: "Steel Plate Base with 4 Steel Plates (740x740)", price: 2670 },
                            { id: "jumb_steel_base_8_740", name: "Steel Plate Base with 8 Steel Plates (740x740)", price: 4680 },
                            { id: "jumb_liro_mobile_stand", name: "Liro Mobile Stand - Liro Maxi Plus", price: 2955 },
                            { id: "jumb_delschen_mobile_stand", name: "Delschen Mobile Stand - Concrete Stand", price: 1166 },
                            { id: "jumb_spacer_steel_plate_base", name: "Spacer for Steel Plate Base", price: 390 },
                            { id: "jumb_spacer_electrics", name: "Spacer for Electrics", price: 430 },
                            { id: "jumb_powder_coat_steel_4_490", name: "Powder Coating of 4 Steel Plates (490x490)", price: 530 },
                            { id: "jumb_powder_coat_steel_4_740", name: "Powder Coating of 4 Steel Plates (740x740)", price: 640 },
                            { id: "powder_coat", name: "Powder coating in RAL 9016/7016", price: 270 },
                            { id: "jumb_fischer_bolts", name: "Optional: 'fischer' heavy duty anchoring bolts", price: 340 },
                            { id: "jumb_multi_use_flange_plate", name: "Multi-use Flange Plate", price: 260 },
                            { id: "cementsten", name: "Cementsten (flagstone) (50x50)", price: 5 },
                            { id: "fancy_frame", name: "Fancy Frame", price: 670 }
                        ]
                    },
                    {
                        name: "Classic Light",
                        items: [
                            { id: "classic_light", name: "Classic-Light - 4 LED Lampor längs centrumstativet", price: 640 }
                        ]
                    },
                    {
                        name: "Magic Light",
                        items: [
                            { id: "magic_light", name: "Magic-Light - 8 RGBW LED-strips integrerade i armarna", price: 1400 }
                        ]
                    },
                    {
                        name: "Heating",
                        items: [
                            { id: "heating_2_rad", name: "2 Radiators", price: 2290 },
                            { id: "heating_4_kvarts", name: "Kvartsvärmare FLEX 1500 watt 4 per parasoll", price: 3070 },
                            { id: "premod_heating", name: "Premodification for heating", price: 1510 },
                            { id: "heater_unit_with_mount", name: "Värmare med fäste (styckepris)", price: 540 },
                            { id: "heater_unit_without_mount", name: "Värmare utan fäste (styckepris)", price: 450 }
                        ]
                    },
                    {
                        name: "Cover",
                        items: [
                            { id: "cover_comfort", name: "Protective Cover –comfort", price: 400 },
                            { id: "jumb_cover_basic", name: "Protective Cover - basic", price: 140 },
                            { id: "telescopic_rod", name: "Telescopic rod for Comfort cover", price: 490 }
                        ]
                    },
                    {
                        id: "jumb_soft_foam_safeguard",
                        name: "Soft Foam Safeguard",
                        items: [
                            { id: "jumb_soft_foam", name: "Soft Foam Safeguard", price: 350 }
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
                        id: "jumb_textil_valance_round",
                        name: "Textilduk RUND med kappa",
                        items: [
                            { id: "jumb_textil_valance_o3", name: "JUMBRELLA Textilduk med kappa 3*", price: 900 },
                            { id: "jumb_textil_valance_o35", name: "JUMBRELLA Textilduk med kappa 3,5*", price: 1010 },
                            { id: "jumb_textil_valance_o4", name: "JUMBRELLA Textilduk med kappa 4*", price: 1220 },
                            { id: "jumb_textil_valance_o45", name: "JUMBRELLA Textilduk med kappa 4,5*", price: 1450 },
                            { id: "jumb_textil_valance_o5", name: "JUMBRELLA Textilduk med kappa 5*", price: 1610 },
                            { id: "jumb_textil_valance_o56", name: "JUMBRELLA Textilduk med kappa 5,6*", price: 1940 },
                            { id: "jumb_textil_valance_o63", name: "JUMBRELLA Textilduk med kappa 6,3*", price: 2320 },
                            { id: "jumb_textil_valance_o7", name: "JUMBRELLA Textilduk med kappa 7*", price: 2420 }
                        ]
                    },
                    {
                        name: "Textilduk Kvadrat",
                        items: [
                            { id: "jumb_textil_3x3", name: "JUMBRELLA Textilduk 3x3", price: 820 },
                            { id: "jumb_textil_35x35", name: "JUMBRELLA Textilduk 3,5x3,5", price: 1100 },
                            { id: "jumb_textil_4x4", name: "JUMBRELLA Textilduk 4x4", price: 1220 },
                            { id: "jumb_textil_45x45", name: "JUMBRELLA Textilduk 4,5x4,5", price: 1410 },
                            { id: "jumb_textil_5x5", name: "JUMBRELLA Textilduk 5x5", price: 1780 },
                            { id: "jumb_textil_6x6", name: "JUMBRELLA Textilduk 6x6", price: 2240 }
                        ]
                    },
                    {
                        id: "jumb_textil_valance_square",
                        name: "Textilduk Kvadrat med kappa",
                        items: [
                            { id: "jumb_textil_valance_3x3", name: "JUMBRELLA Textilduk med kappa 3x3", price: 1070 },
                            { id: "jumb_textil_valance_35x35", name: "JUMBRELLA Textilduk med kappa 3,5x3,5", price: 1410 },
                            { id: "jumb_textil_valance_4x4", name: "JUMBRELLA Textilduk med kappa 4x4", price: 1540 },
                            { id: "jumb_textil_valance_45x45", name: "JUMBRELLA Textilduk med kappa 4,5x4,5", price: 1750 },
                            { id: "jumb_textil_valance_5x5", name: "JUMBRELLA Textilduk med kappa 5x5", price: 2220 },
                            { id: "jumb_textil_valance_6x6", name: "JUMBRELLA Textilduk med kappa 6x6", price: 2460 }
                        ]
                    },
                    {
                        name: "Hängränna Kvadrat",
                        items: [
                            { id: "jumb_hang_kv_3x3", name: "Hängränna 3x3", price: 620 },
                            { id: "jumb_hang_kv_35x35", name: "Hängränna 3,5x3,5", price: 670 },
                            { id: "jumb_hang_kv_4x4", name: "Hängränna 4x4", price: 710 },
                            { id: "jumb_hang_kv_45x45", name: "Hängränna 4,5x4,5", price: 810 },
                            { id: "jumb_hang_kv_5x5", name: "Hängränna 5x5", price: 830 },
                            { id: "jumb_hang_kv_6x6", name: "Hängränna 6x6", price: 940 }
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
                        id: "jumb_textil_valance_rect",
                        name: "Textilduk Rektangel med kappa",
                        items: [
                            { id: "jumb_textil_valance_3x15", name: "JUMBRELLA Textilduk med kappa 3x1,5", price: 830 },
                            { id: "jumb_textil_valance_3x35", name: "JUMBRELLA Textilduk med kappa 3x3,5", price: 1330 },
                            { id: "jumb_textil_valance_4x2", name: "JUMBRELLA Textilduk med kappa 4x2", price: 1050 },
                            { id: "jumb_textil_valance_4x3", name: "JUMBRELLA Textilduk med kappa 4x3", price: 1390 },
                            { id: "jumb_textil_valance_4x35", name: "JUMBRELLA Textilduk med kappa 4x3,5", price: 1450 },
                            { id: "jumb_textil_valance_45x3", name: "JUMBRELLA Textilduk med kappa 4,5x3", price: 1450 },
                            { id: "jumb_textil_valance_45x35", name: "JUMBRELLA Textilduk med kappa 4,5x3,5", price: 1500 },
                            { id: "jumb_textil_valance_45x4", name: "JUMBRELLA Textilduk med kappa 4,5x4", price: 1590 },
                            { id: "jumb_textil_valance_5x25", name: "JUMBRELLA Textilduk med kappa 5x2,5", price: 1390 },
                            { id: "jumb_textil_valance_5x3", name: "JUMBRELLA Textilduk med kappa 5x3", price: 1460 },
                            { id: "jumb_textil_valance_5x375", name: "JUMBRELLA Textilduk med kappa 5x3,75", price: 1780 },
                            { id: "jumb_textil_valance_5x4", name: "JUMBRELLA Textilduk med kappa 5x4", price: 1780 },
                            { id: "jumb_textil_valance_6x3", name: "JUMBRELLA Textilduk med kappa 6x3", price: 1780 },
                            { id: "jumb_textil_valance_6x4", name: "JUMBRELLA Textilduk med kappa 6x4", price: 2100 },
                            { id: "jumb_textil_valance_6x45", name: "JUMBRELLA Textilduk med kappa 6x4,5", price: 2420 }
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
                        name: "Cosmetic",
                        items: [
                            { id: "jumb_frame_fancy", name: "Frame Color fancy designs", price: 670 },
                            { id: "jumb_frame_custom", name: "Frame Color custom finish", price: 540 },
                            { id: "jumb_v4a_maritime", name: "V4A | Maritime Edition", price: 280 },
                            { id: "jumb_pole_extension", name: "Umbrella Center Pole Extension", price: 180 },
                            { id: "jumb_pole_reduction", name: "Umbrella Center Pole Reduction", price: 180 },
                            { id: "jumb_print_on_membrane", name: "Print on membrane (ca pris)", price: 1100 }
                        ]
                    },
                    {
                        name: "Valance Runda",
                        items: [
                            { id: "jumb_valance_o3", name: "Valance Ø3", price: 200 },
                            { id: "jumb_valance_o35", name: "Valance Ø3,5", price: 230 },
                            { id: "jumb_valance_o4", name: "Valance Ø4", price: 250 },
                            { id: "jumb_valance_o45", name: "Valance Ø4,5", price: 310 },
                            { id: "jumb_valance_o5", name: "Valance Ø5", price: 330 },
                            { id: "jumb_valance_o56", name: "Valance Ø5,6", price: 370 },
                            { id: "jumb_valance_o63", name: "Valance Ø6,3", price: 370 },
                            { id: "jumb_valance_o7", name: "Valance Ø7", price: 470 }
                        ]
                    },
                    {
                        name: "Valance Kvadrat",
                        items: [
                            { id: "jumb_valance_3x3", name: "Valance 3x3", price: 250 },
                            { id: "jumb_valance_35x35", name: "Valance 3,5x3,5", price: 310 },
                            { id: "jumb_valance_4x4", name: "Valance 4x4", price: 310 },
                            { id: "jumb_valance_45x45", name: "Valance 4,5x4,5", price: 340 },
                            { id: "jumb_valance_5x5", name: "Valance 5x5", price: 420 },
                            { id: "jumb_valance_6x6", name: "Valance 6x6", price: 560 }
                        ]
                    },
                    {
                        name: "Valance Rektangel",
                        items: [
                            { id: "jumb_valance_3x15", name: "Valance 3x1,5", price: 200 },
                            { id: "jumb_valance_3x35", name: "Valance 3x3,5", price: 300 },
                            { id: "jumb_valance_4x2", name: "Valance 4x2", price: 250 },
                            { id: "jumb_valance_4x3", name: "Valance 4x3", price: 300 },
                            { id: "jumb_valance_4x35", name: "Valance 4x3,5", price: 300 },
                            { id: "jumb_valance_4x45", name: "Valance 4x4,5", price: 310 },
                            { id: "jumb_valance_45x3", name: "Valance 4,5x3", price: 300 },
                            { id: "jumb_valance_45x35", name: "Valance 4,5x3,5", price: 310 },
                            { id: "jumb_valance_5x25", name: "Valance 5x2,5", price: 300 },
                            { id: "jumb_valance_5x3", name: "Valance 5x3", price: 310 },
                            { id: "jumb_valance_5x375", name: "Valance 5x3,75", price: 350 },
                            { id: "jumb_valance_5x4", name: "Valance 5x4", price: 350 },
                            { id: "jumb_valance_6x3", name: "Valance 6x3", price: 350 },
                            { id: "jumb_valance_6x4", name: "Valance 6x4", price: 400 },
                            { id: "jumb_valance_6x45", name: "Valance 6x4,5", price: 460 }
                        ]
                    },
                    {
                        name: "Annat",
                        items: [
                            { id: "jumb_tophatt", name: "Tophatt", price: 358 },
                            { id: "jumb_topboll", name: "Topboll", price: 186 },
                            { id: "jumb_textil_roll_1m", name: "1m textile on roll", price: 50 }
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
                        name: "Installationsalternativ",
                        items: [
                            { id: "xl_gjuthylsa", name: "Gjuthylsa XL", price: 740 },
                            { id: "xl_conn_tipping", name: "Connecting component for In-Ground Tipping base", price: 440 },
                            { id: "xl_in_ground_ext", name: "In-Ground Installation Extension", price: 420 },
                            { id: "xl_surface_mount", name: "Surface Mount", price: 1610 },
                            { id: "xl_dual_console", name: "Dual Mounting Console", price: 2020 },
                            { id: "xl_spacer", name: "Spacer", price: 610 },
                            { id: "xl_spacer_electrics", name: "Spacer for Electrics", price: 660 },
                            { id: "xl_steel_base_4", name: "Steel Plate Base 4", price: 2830 },
                            { id: "xl_steel_base_8", name: "Steel Plate Base 8", price: 4940 },
                            { id: "xl_powder_coat_steel_base", name: "Powder Coating for Steel Plate Base", price: 640 },
                            { id: "xl_crossframe_16", name: "Cross-Frame 16 flagstones", price: 1880 },
                            { id: "xl_flagstones_16", name: "Flagstones 16st", price: 440 },
                            { id: "xl_powder_coat_crossframe", name: "Powder Coating for Cross-Frame", price: 270 }
                        ]
                    },
                    {
                        name: "Classic Light",
                        items: [
                            { id: "xl_classic_light_4", name: "4 LED Lampor längs centrumstativet", price: 720 },
                            { id: "xl_classic_light_6", name: "6 LED Lampor längs centrumstativet", price: 910 }
                        ]
                    },
                    {
                        name: "Magic Light",
                        items: [
                            { id: "xl_magic_light", name: "8 RGBW LED-strips integrerade i armarna", price: 1690 }
                        ]
                    },
                    {
                        name: "Heating",
                        items: [
                            { id: "xl_premod_heating", name: "Pre modifacation for heating", price: 1980 },
                            { id: "xl_kvarts_flex", name: "Kvartsvärmare FLEX 1500 watt 4 per parasoll", price: 3540 },
                            { id: "heater_unit_with_mount", name: "Värmare med fäste (styckepris)", price: 540 },
                            { id: "heater_unit_without_mount", name: "Värmare utan fäste (styckepris)", price: 450 }
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
                        name: "Cosmetic",
                        items: [
                            { id: "xl_frame_fancy", name: "Frame Color fancy designs", price: 890 },
                            { id: "xl_frame_custom", name: "Frame Color custom finish", price: 660 },
                            { id: "xl_print_on_membrane", name: "Print on membrane (ca pris)", price: 1100 }
                        ]
                    },
                    {
                        name: "V4A",
                        items: [
                            { id: "xl_v4a_maritime", name: "V4A | Maritime Edition", price: 540 }
                        ]
                    },
                    {
                        name: "Valance Kvadrat",
                        items: [
                            { id: "xl_valance_5x5", name: "Valance 5x5", price: 450 },
                            { id: "xl_valance_55x55", name: "Valance 5,5x5,5", price: 500 },
                            { id: "xl_valance_6x6", name: "Valance 6x6", price: 560 },
                            { id: "xl_valance_7x7", name: "Valance 7x7", price: 780 }
                        ]
                    },
                    {
                        name: "Valance Rektangel",
                        items: [
                            { id: "xl_valance_6x514", name: "Valance 6x5,14", price: 560 },
                            { id: "xl_valance_7x5", name: "Valance 7x5", price: 670 },
                            { id: "xl_valance_7x6", name: "Valance 7x6", price: 780 }
                        ]
                    },
                    {
                        name: "Soft Foam Safeguard",
                        items: [
                            { id: "xl_soft_foam", name: "Soft Foam Safeguard", price: 600 }
                        ]
                    },
                    {
                        name: "TV & WLAN",
                        items: [
                            { id: "xl_tv_mod_1", name: "TV Frame Modification for 1 TV", price: 670 },
                            { id: "xl_tv_mod_2", name: "TV Frame Modification for 2 TVs", price: 1330 },
                            { id: "xl_wifi_mod", name: "Wifi Frame Modification", price: 1870 }
                        ]
                    },
                    {
                        name: "Hängränna – Frame Modification",
                        items: [
                            { id: "xl_gutter_frame_mod", name: "Frame Modification for Textile Gutter", price: 210 }
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
                        name: "Installationsalternativ",
                        items: [
                            { id: "pure_gjuthylsa", name: "Gjuthylsa PURE", price: 360 },
                            { id: "pure_surface_mount", name: "Surface Mount", price: 510 },
                            { id: "pure_surface_above", name: "Surface Mount (ovan markinstallation)", price: 510 },
                            { id: "pure_fischer_bolts", name: "Optional: 'fischer' heavy duty anchoring bolts", price: 190 },
                            { id: "pure_steel_base_4", name: "Steel Plate Base with 4 Steel Plates", price: 1580 },
                            { id: "pure_steel_base_8", name: "Steel Plate Base with 8 Steel Plates", price: 2480 },
                            { id: "pure_liro_mobile_stand", name: "Liro Mobile Stand - Liro Maxi Plus", price: 2955 },
                            { id: "pure_delschen_mobile_stand", name: "Delschen Mobile Stand - Concrete Stand", price: 1166 },
                            { id: "pure_powder_coat_4", name: "Powder Coating of 4 Steel Plate", price: 540 },
                            { id: "pure_crossframe_8", name: "Cross-Frame for 8 flagstones", price: 670 },
                            { id: "pure_flagstone", name: "Cementsten (flagstone)", price: 7 },
                            { id: "pure_flagstones_8", name: "8 Standard Flagstones", price: 220 },
                            { id: "pure_leveling_feet", name: "4 Leveling Feet", price: 130 },
                            { id: "pure_powder_coat_crossframe", name: "Powder Coating for Cross-Frame", price: 230 },
                            { id: "pure_krinner_plate", name: "Adaptation Plate for Krinner Ground Screw", price: 240 },
                            { id: "pure_multi_use_flange_plate", name: "Multi-use Flange Plate", price: 240 },
                            { id: "pure_tilt_conn_above", name: "Tiltable Connecting Components (Above-ground)", price: 260 }
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
                        id: "pure_textil_valance_square",
                        name: "Textilduk Kvadrat med kappa",
                        items: [
                            { id: "pure_textil_valance_2x2", name: "PURE Textilduk med kappa 2x2", price: 860 },
                            { id: "pure_textil_valance_25x25", name: "PURE Textilduk med kappa 2,5x2,5", price: 890 },
                            { id: "pure_textil_valance_3x3", name: "PURE Textilduk med kappa 3x3", price: 1000 },
                            { id: "pure_textil_valance_35x35", name: "PURE Textilduk med kappa 3,5x3,5", price: 1110 },
                            { id: "pure_textil_valance_4x4", name: "PURE Textilduk med kappa 4x4", price: 1230 }
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
                        id: "pure_textil_valance_round",
                        name: "Textilduk Runda med kappa",
                        items: [
                            { id: "pure_textil_valance_o2", name: "PURE Textilduk med kappa Ø2", price: 790 },
                            { id: "pure_textil_valance_o25", name: "PURE Textilduk med kappa Ø2,5", price: 790 },
                            { id: "pure_textil_valance_o3", name: "PURE Textilduk med kappa Ø3", price: 880 },
                            { id: "pure_textil_valance_o35", name: "PURE Textilduk med kappa Ø3,5", price: 980 },
                            { id: "pure_textil_valance_o4", name: "PURE Textilduk med kappa Ø4", price: 1100 }
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
                        id: "pure_textil_valance_rect",
                        name: "Textilduk Rektangel med kappa",
                        items: [
                            { id: "pure_textil_valance_25x2", name: "PURE Textilduk med kappa 2,5x2", price: 790 },
                            { id: "pure_textil_valance_3x2", name: "PURE Textilduk med kappa 3x2", price: 790 },
                            { id: "pure_textil_valance_3x25", name: "PURE Textilduk med kappa 3x2,5", price: 910 },
                            { id: "pure_textil_valance_35x2", name: "PURE Textilduk med kappa 3,5x2", price: 910 },
                            { id: "pure_textil_valance_35x25", name: "PURE Textilduk med kappa 3,5x2,5", price: 990 },
                            { id: "pure_textil_valance_35x3", name: "PURE Textilduk med kappa 3,5x3", price: 1040 },
                            { id: "pure_textil_valance_4x2", name: "PURE Textilduk med kappa 4x2", price: 990 },
                            { id: "pure_textil_valance_4x25", name: "PURE Textilduk med kappa 4x2,5", price: 1040 },
                            { id: "pure_textil_valance_4x3", name: "PURE Textilduk med kappa 4x3", price: 1140 },
                            { id: "pure_textil_valance_4x35", name: "PURE Textilduk med kappa 4x3,5", price: 1220 }
                        ]
                    },
                    {
                        name: "Mounts & Consoles",
                        items: [
                            { id: "pure_dual_console", name: "Dual Mounting Console", price: 820 },
                            { id: "pure_spacer", name: "Spacer", price: 390 },
                            { id: "pure_spacer_tipping", name: "Spacer for In-Ground Tipping Base", price: 310 },
                            { id: "pure_tilt_conn", name: "Tiltable Connecting Components", price: 260 }
                        ]
                    },
                    {
                        name: "Cosmetic & Special",
                        items: [
                            { id: "pure_frame_custom", name: "Frame Color custom finish", price: 560 },
                            { id: "pure_v4a_maritime", name: "V4A | Maritime", price: 230 },
                            { id: "pure_pole_extension", name: "Umbrella Center Pole Extension", price: 180 },
                            { id: "pure_pole_reduction", name: "Umbrella Center Pole Reduction", price: 180 },
                            { id: "custom_edge_binding", name: "Custom Edge Binding", price: 250 },
                            { id: "pure_print_on_membrane", name: "Print on membrane (ca pris)", price: 1100 }
                        ]
                    },
                    {
                        id: "pure_soft_foam_safeguard",
                        name: "Soft Foam Safeguard",
                        items: [
                            { id: "pure_soft_foam", name: "Soft Foam Safeguard", price: 350 }
                        ]
                    },
                    {
                        name: "Valance Kvadrat",
                        items: [
                            { id: "pure_valance_2x2", name: "Valance 2x2", price: 170 },
                            { id: "pure_valance_25x25", name: "Valance 2,5x2,5", price: 170 },
                            { id: "pure_valance_3x3", name: "Valance 3x3", price: 200 },
                            { id: "pure_valance_35x35", name: "Valance 3,5x3,5", price: 200 },
                            { id: "pure_valance_4x4", name: "Valance 4x4", price: 220 }
                        ]
                    },
                    {
                        name: "Valance Runda",
                        items: [
                            { id: "pure_valance_o2", name: "Valance Ø2", price: 170 },
                            { id: "pure_valance_o25", name: "Valance Ø2,5", price: 170 },
                            { id: "pure_valance_o3", name: "Valance Ø3", price: 200 },
                            { id: "pure_valance_o35", name: "Valance Ø3,5", price: 200 },
                            { id: "pure_valance_o4", name: "Valance Ø4", price: 220 }
                        ]
                    },
                    {
                        name: "Valance Rektangel",
                        items: [
                            { id: "pure_valance_25x2", name: "Valance 2,5x2", price: 170 },
                            { id: "pure_valance_3x2", name: "Valance 3x2", price: 170 },
                            { id: "pure_valance_3x25", name: "Valance 3x2,5", price: 170 },
                            { id: "pure_valance_35x2", name: "Valance 3,5x2", price: 170 },
                            { id: "pure_valance_35x25", name: "Valance 3,5x2,5", price: 200 },
                            { id: "pure_valance_35x3", name: "Valance 3,5x3", price: 190 },
                            { id: "pure_valance_4x2", name: "Valance 4x2", price: 200 },
                            { id: "pure_valance_4x25", name: "Valance 4x2,5", price: 190 },
                            { id: "pure_valance_4x3", name: "Valance 4x3", price: 220 },
                            { id: "pure_valance_4x35", name: "Valance 4x3,5", price: 230 }
                        ]
                    }
                ]
            },
            "Jumbrella outSide": {
                name: "Jumbrella outSide",
                sizes: {
                    "3* Runda": { price: 6780 },
                    "3,5* Runda": { price: 6900 },
                    "4* Runda": { price: 7110 },
                    "3x3 Kvadrat": { price: 6900 },
                    "3,5x3,5 Kvadrat": { price: 7110 },
                    "4x4 Kvadrat": { price: 7320 }
                },
                addonCategories: [
                    {
                        id: "installationsalternativ",
                        name: "Installationsalternativ",
                        items: [
                            { id: "outside_tipping_base", name: "In-Ground Tipping Base", price: 630 },
                            { id: "outside_tipping_base_electric", name: "In-Ground Tipping Base WITH electrical connection", price: 740 },
                            { id: "outside_conn_tipping", name: "Connecting Components - for In-Ground Tipping Base", price: 460 },
                            { id: "outside_in_ground_ext", name: "In-Ground Installation Extension", price: 420 },
                            { id: "outside_surface_mount", name: "Surface Mount", price: 1610 },
                            { id: "outside_fischer_bolts", name: "Optional: 'fischer' heavy duty anchoring bolts", price: 680 },
                            { id: "outside_wall_brackets", name: "Wall Brackets", price: 670 },
                            { id: "outside_wall_fastening_std", name: "Fastening set for Wall Brackets (standard)", price: 100 },
                            { id: "outside_wall_fastening_insulation", name: "Fastening set for Wall Brackets (with external thermal insulation)", price: 370 }
                        ]
                    },
                    {
                        id: "classic_light",
                        name: "Classic Light",
                        items: [
                            { id: "outside_classic_light_4", name: "LED-Lighting with 4 RGBW-LED strips", price: 0, priceUponRequest: true },
                            { id: "outside_classic_light_8", name: "LED-Lighting with 8 RGBW-LED strips", price: 0, priceUponRequest: true }
                        ]
                    },
                    {
                        id: "heating",
                        name: "Heating",
                        items: [
                            { id: "outside_heating_2", name: "2 Radiators", price: 0, priceUponRequest: true },
                            { id: "outside_heating_4", name: "4 Radiators", price: 0, priceUponRequest: true },
                            { id: "outside_premod_heating", name: "Premodification for heating equipment", price: 0, priceUponRequest: true },
                            { id: "heater_unit_with_mount", name: "Värmare med fäste (styckepris)", price: 540 },
                            { id: "heater_unit_without_mount", name: "Värmare utan fäste (styckepris)", price: 450 }
                        ]
                    },
                    {
                        id: "cover",
                        name: "Cover",
                        items: [
                            { id: "outside_cover_comfort", name: "Protective Cover – comfort", price: 500 },
                            { id: "outside_cover_comfort_rod", name: "Protective Cover – comfort with telescopic rod", price: 670 }
                        ]
                    },
                    {
                        id: "textilduk_rund",
                        name: "Textilduk RUND",
                        items: [
                            { id: "outside_textil_o3_betex", name: "Textilduk Ø3 (betex® 05)", price: 690 },
                            { id: "outside_textil_o35_betex", name: "Textilduk Ø3,5 (betex® 05)", price: 780 },
                            { id: "outside_textil_o4_betex", name: "Textilduk Ø4 (betex® 05)", price: 960 },
                            { id: "outside_textil_o3_acryl", name: "Textilduk Ø3 (acryl)", price: 690 },
                            { id: "outside_textil_o35_acryl", name: "Textilduk Ø3,5 (acryl)", price: 780 },
                            { id: "outside_textil_o4_acryl", name: "Textilduk Ø4 (acryl)", price: 960 },
                            { id: "outside_textil_o3_precontraint", name: "Textilduk Ø3 (Precontraint 302)", price: 1020 },
                            { id: "outside_textil_o35_precontraint", name: "Textilduk Ø3,5 (Precontraint 302)", price: 1130 },
                            { id: "outside_textil_o4_precontraint", name: "Textilduk Ø4 (Precontraint 302)", price: 1340 },
                            { id: "outside_textil_o3_elegance", name: "Textilduk Ø3 (elegance)", price: 1020 },
                            { id: "outside_textil_o35_elegance", name: "Textilduk Ø3,5 (elegance)", price: 1130 },
                            { id: "outside_textil_o4_elegance", name: "Textilduk Ø4 (elegance)", price: 1340 },
                            { id: "outside_textil_o3_elegance_striped", name: "Textilduk Ø3 (elegance randig)", price: 1250 },
                            { id: "outside_textil_o35_elegance_striped", name: "Textilduk Ø3,5 (elegance randig)", price: 1400 },
                            { id: "outside_textil_o4_elegance_striped", name: "Textilduk Ø4 (elegance randig)", price: 1630 }
                        ]
                    },
                    {
                        id: "textilduk_kvadrat",
                        name: "Textilduk Kvadrat",
                        items: [
                            { id: "outside_textil_3x3_betex", name: "Textilduk 3x3 (betex® 05)", price: 820 },
                            { id: "outside_textil_35x35_betex", name: "Textilduk 3,5x3,5 (betex® 05)", price: 1100 },
                            { id: "outside_textil_4x4_betex", name: "Textilduk 4x4 (betex® 05)", price: 1220 },
                            { id: "outside_textil_3x3_acryl", name: "Textilduk 3x3 (acryl)", price: 820 },
                            { id: "outside_textil_35x35_acryl", name: "Textilduk 3,5x3,5 (acryl)", price: 1100 },
                            { id: "outside_textil_4x4_acryl", name: "Textilduk 4x4 (acryl)", price: 1220 },
                            { id: "outside_textil_3x3_precontraint", name: "Textilduk 3x3 (Precontraint 302)", price: 1190 },
                            { id: "outside_textil_35x35_precontraint", name: "Textilduk 3,5x3,5 (Precontraint 302)", price: 1540 },
                            { id: "outside_textil_4x4_precontraint", name: "Textilduk 4x4 (Precontraint 302)", price: 1710 },
                            { id: "outside_textil_3x3_elegance", name: "Textilduk 3x3 (elegance)", price: 1190 },
                            { id: "outside_textil_35x35_elegance", name: "Textilduk 3,5x3,5 (elegance)", price: 1540 },
                            { id: "outside_textil_4x4_elegance", name: "Textilduk 4x4 (elegance)", price: 1710 },
                            { id: "outside_textil_3x3_elegance_striped", name: "Textilduk 3x3 (elegance randig)", price: 1490 },
                            { id: "outside_textil_35x35_elegance_striped", name: "Textilduk 3,5x3,5 (elegance randig)", price: 1900 },
                            { id: "outside_textil_4x4_elegance_striped", name: "Textilduk 4x4 (elegance randig)", price: 2070 }
                        ]
                    },
                    {
                        id: "hangranna_kvadrat",
                        name: "Hängränna Kvadrat",
                        items: [
                            { id: "outside_gutter_frame_mod", name: "Frame Modification for Textile Gutter (per spoke)", price: 21 },
                            { id: "outside_gutter_3x3_betex", name: "Textilränna 3x3 (betex® 05)", price: 620 },
                            { id: "outside_gutter_35x35_betex", name: "Textilränna 3,5x3,5 (betex® 05)", price: 670 },
                            { id: "outside_gutter_4x4_betex", name: "Textilränna 4x4 (betex® 05)", price: 710 },
                            { id: "outside_gutter_3x3_precontraint", name: "Textilränna 3x3 (Precontraint 302)", price: 700 },
                            { id: "outside_gutter_35x35_precontraint", name: "Textilränna 3,5x3,5 (Precontraint 302)", price: 750 },
                            { id: "outside_gutter_4x4_precontraint", name: "Textilränna 4x4 (Precontraint 302)", price: 800 }
                        ]
                    },
                    {
                        id: "cosmetic",
                        name: "Cosmetic",
                        items: [
                            { id: "outside_v4a_maritime", name: "V4A | Maritime Edition", price: 540 },
                            { id: "outside_pole_extension", name: "Umbrella Center Pole Extension", price: 340 },
                            { id: "outside_frame_fancy", name: "Frame Color fancy designs", price: 0, priceUponRequest: true },
                            { id: "outside_frame_custom", name: "Frame Color custom finish", price: 0, priceUponRequest: true },
                            { id: "outside_upgrade_precontraint_o3", name: "Uppgradering: Precontraint 302 / elegance duk (3m Runda)", price: 320 },
                            { id: "outside_upgrade_precontraint_o35", name: "Uppgradering: Precontraint 302 / elegance duk (3.5m Runda)", price: 340 },
                            { id: "outside_upgrade_precontraint_o4_kv3", name: "Uppgradering: Precontraint 302 / elegance duk (4m Runda / 3x3 Kvadrat)", price: 370 },
                            { id: "outside_upgrade_precontraint_kv35", name: "Uppgradering: Precontraint 302 / elegance duk (3.5x3.5 Kvadrat)", price: 430 },
                            { id: "outside_upgrade_precontraint_kv4", name: "Uppgradering: Precontraint 302 / elegance duk (4x4 Kvadrat)", price: 470 },
                            { id: "outside_upgrade_striped_o3", name: "Uppgradering: elegance duk randig (3m Runda)", price: 550 },
                            { id: "outside_upgrade_striped_o35", name: "Uppgradering: elegance duk randig (3.5m Runda)", price: 590 },
                            { id: "outside_upgrade_striped_o4_kv3", name: "Uppgradering: elegance duk randig (4m Runda / 3x3 Kvadrat)", price: 650 },
                            { id: "outside_upgrade_striped_kv35", name: "Uppgradering: elegance duk randig (3.5x3.5 Kvadrat)", price: 780 },
                            { id: "outside_upgrade_striped_kv4", name: "Uppgradering: elegance duk randig (4x4 Kvadrat)", price: 820 }
                        ]
                    },
                    {
                        id: "sidovaggar",
                        name: "Sidoväggar",
                        items: [
                            { id: "outside_side_panel_frame_mod", name: "Frame Modification for Side Panel (per spoke)", price: 21 },
                            { id: "outside_side_no_window_3x3_betex", name: "Sidovägg utan fönster 3x3 (betex® 05/acryl)", price: 400 },
                            { id: "outside_side_no_window_35x35_betex", name: "Sidovägg utan fönster 3,5x3,5 (betex® 05/acryl)", price: 450 },
                            { id: "outside_side_no_window_4x4_betex", name: "Sidovägg utan fönster 4x4 (betex® 05/acryl)", price: 500 },
                            { id: "outside_side_no_window_3x3_precontraint", name: "Sidovägg utan fönster 3x3 (Precontraint 302)", price: 550 },
                            { id: "outside_side_no_window_35x35_precontraint", name: "Sidovägg utan fönster 3,5x3,5 (Precontraint 302)", price: 615 },
                            { id: "outside_side_no_window_4x4_precontraint", name: "Sidovägg utan fönster 4x4 (Precontraint 302)", price: 685 },
                            { id: "outside_side_door_no_window_3x3_betex", name: "Sidovägg utan fönster med dörr 3x3 (betex® 05/acryl)", price: 570 },
                            { id: "outside_side_door_no_window_35x35_betex", name: "Sidovägg utan fönster med dörr 3,5x3,5 (betex® 05/acryl)", price: 610 },
                            { id: "outside_side_door_no_window_4x4_betex", name: "Sidovägg utan fönster med dörr 4x4 (betex® 05/acryl)", price: 670 },
                            { id: "outside_side_door_no_window_3x3_precontraint", name: "Sidovägg utan fönster med dörr 3x3 (Precontraint 302)", price: 820 },
                            { id: "outside_side_door_no_window_35x35_precontraint", name: "Sidovägg utan fönster med dörr 3,5x3,5 (Precontraint 302)", price: 880 },
                            { id: "outside_side_door_no_window_4x4_precontraint", name: "Sidovägg utan fönster med dörr 4x4 (Precontraint 302)", price: 965 },
                            { id: "outside_side_window_3x3_betex", name: "Sidovägg med fönster 3x3 (betex® 05/acryl)", price: 420 },
                            { id: "outside_side_window_35x35_betex", name: "Sidovägg med fönster 3,5x3,5 (betex® 05/acryl)", price: 470 },
                            { id: "outside_side_window_4x4_betex", name: "Sidovägg med fönster 4x4 (betex® 05/acryl)", price: 520 },
                            { id: "outside_side_window_3x3_precontraint", name: "Sidovägg med fönster 3x3 (Precontraint 302)", price: 575 },
                            { id: "outside_side_window_35x35_precontraint", name: "Sidovägg med fönster 3,5x3,5 (Precontraint 302)", price: 645 },
                            { id: "outside_side_window_4x4_precontraint", name: "Sidovägg med fönster 4x4 (Precontraint 302)", price: 710 },
                            { id: "outside_side_door_window_3x3_betex", name: "Sidovägg med fönster & dörr 3x3 (betex® 05/acryl)", price: 590 },
                            { id: "outside_side_door_window_35x35_betex", name: "Sidovägg med fönster & dörr 3,5x3,5 (betex® 05/acryl)", price: 630 },
                            { id: "outside_side_door_window_4x4_betex", name: "Sidovägg med fönster & dörr 4x4 (betex® 05/acryl)", price: 690 },
                            { id: "outside_side_door_window_3x3_precontraint", name: "Sidovägg med fönster & dörr 3x3 (Precontraint 302)", price: 850 },
                            { id: "outside_side_door_window_35x35_precontraint", name: "Sidovägg med fönster & dörr 3,5x3,5 (Precontraint 302)", price: 905 },
                            { id: "outside_side_door_window_4x4_precontraint", name: "Sidovägg med fönster & dörr 4x4 (Precontraint 302)", price: 995 },
                            { id: "outside_conn_piece_betex", name: "Skarvstycke för 2 parasoller (betex® 05/acryl)", price: 140 },
                            { id: "outside_conn_piece_precontraint", name: "Skarvstycke för 2 parasoller (Precontraint 302)", price: 190 }
                        ]
                    },
                    {
                        id: "annat",
                        name: "Annat",
                        items: [
                            { id: "outside_soft_foam", name: "Soft Foam Safeguard for center pole", price: 600 }
                        ]
                    }
                ]
            },
            "Magnum": {
                name: "Magnum",
                sizes: {
                    "7* Runda": { price: 32900 },
                    "8* Runda": { price: 37500 },
                    "9* Runda": { price: 45100 },
                    "10* Runda": { price: 56700 },
                    "11* Runda": { price: 79600 },
                    "12* Runda": { price: 88400 },
                    "7x7 Kvadrat": { price: 37800 },
                    "8x8 Kvadrat": { price: 50400 },
                    "9,3x9,3 Kvadrat": { price: 63100 },
                    "10x10 Kvadrat": { price: 82000 },
                    "12x12 Kvadrat": { price: 113600 }
                },
                addonCategories: [
                    {
                        name: "Motorization",
                        items: [
                            { id: "magnum_motor_standard", name: "E-geared motor (ø7-ø10, 7x7-9.3x9.3)", price: 7550 },
                            { id: "magnum_motor_large", name: "E-geared motor (ø11-ø12, 10x10-12x12)", price: 0 }
                        ]
                    },
                    {
                        name: "Textilduk (Replacement Membrane)",
                        items: [
                            { id: "magnum_textil_o7", name: "Textilduk 7*", price: 8820 },
                            { id: "magnum_textil_o8", name: "Textilduk 8*", price: 10100 },
                            { id: "magnum_textil_o9", name: "Textilduk 9*", price: 11300 },
                            { id: "magnum_textil_o10", name: "Textilduk 10*", price: 12400 },
                            { id: "magnum_textil_o11", name: "Textilduk 11*", price: 13500 },
                            { id: "magnum_textil_o12", name: "Textilduk 12*", price: 15900 },
                            { id: "magnum_textil_7x7", name: "Textilduk 7x7", price: 10200 },
                            { id: "magnum_textil_8x8", name: "Textilduk 8x8", price: 11700 },
                            { id: "magnum_textil_93x93", name: "Textilduk 9,3x9,3", price: 13500 },
                            { id: "magnum_textil_10x10", name: "Textilduk 10x10", price: 14500 },
                            { id: "magnum_textil_12x12", name: "Textilduk 12x12", price: 17500 }
                        ]
                    },
                    {
                        name: "Footing Console",
                        items: [
                            { id: "magnum_footing", name: "Footing Console", price: 3260 }
                        ]
                    },
                    {
                        name: "Hängränna",
                        items: [
                            { id: "magnum_gutter_mod", name: "Frame Modification for Textile Gutter", price: 410 },
                            { id: "magnum_gutter_7x7", name: "Textile Gutter 7x7", price: 3670 },
                            { id: "magnum_gutter_8x8", name: "Textile Gutter 8x8", price: 4200 },
                            { id: "magnum_gutter_93x93", name: "Textile Gutter 9,3x9,3", price: 4930 },
                            { id: "magnum_gutter_10x10", name: "Textile Gutter 10x10", price: 5300 },
                            { id: "magnum_gutter_12x12", name: "Textile Gutter 12x12", price: 6300 }
                        ]
                    },
                    {
                        name: "Sidoväggar",
                        items: [
                            { id: "magnum_side_mod", name: "Frame Modification for Side Panel", price: 410 },
                            { id: "magnum_side_without_7x7", name: "Sidovägg WITHOUT window 7x7", price: 1470 },
                            { id: "magnum_side_without_8x8", name: "Sidovägg WITHOUT window 8x8", price: 1680 },
                            { id: "magnum_side_without_93x93", name: "Sidovägg WITHOUT window 9,3x9,3", price: 1940 },
                            { id: "magnum_side_without_10x10", name: "Sidovägg WITHOUT window 10x10", price: 2100 },
                            { id: "magnum_side_without_12x12", name: "Sidovägg WITHOUT window 12x12", price: 2520 },
                            { id: "magnum_side_door_7x7", name: "Sidovägg WITH door 7x7", price: 2100 },
                            { id: "magnum_side_door_8x8", name: "Sidovägg WITH door 8x8", price: 2260 },
                            { id: "magnum_side_door_93x93", name: "Sidovägg WITH door 9,3x9,3", price: 2630 },
                            { id: "magnum_side_door_10x10", name: "Sidovägg WITH door 10x10", price: 2780 },
                            { id: "magnum_side_door_12x12", name: "Sidovägg WITH door 12x12", price: 3360 },
                            { id: "magnum_side_window_7x7", name: "Sidovägg WITH window 7x7", price: 1580 },
                            { id: "magnum_side_window_8x8", name: "Sidovägg WITH window 8x8", price: 1840 },
                            { id: "magnum_side_window_93x93", name: "Sidovägg WITH window 9,3x9,3", price: 2150 },
                            { id: "magnum_side_window_10x10", name: "Sidovägg WITH window 10x10", price: 2310 },
                            { id: "magnum_side_window_12x12", name: "Sidovägg WITH window 12x12", price: 2780 },
                            { id: "magnum_side_window_door_7x7", name: "Sidovägg WITH window and door 7x7", price: 2210 },
                            { id: "magnum_side_window_door_8x8", name: "Sidovägg WITH window and door 8x8", price: 2360 },
                            { id: "magnum_side_window_door_93x93", name: "Sidovägg WITH window and door 9,3x9,3", price: 2730 },
                            { id: "magnum_side_window_door_10x10", name: "Sidovägg WITH window and door 10x10", price: 2940 },
                            { id: "magnum_side_window_door_12x12", name: "Sidovägg WITH window and door 12x12", price: 3520 },
                            { id: "magnum_side_conn_angled", name: "Connecting Piece (angled corners 45°)", price: 630 },
                            { id: "magnum_side_conn_straight", name: "Connecting Piece for joining 2 parasols", price: 630 }
                        ]
                    },
                    {
                        name: "Lighting & Heating",
                        items: [
                            { id: "magnum_lighting_8led", name: "8 LED-lamps", price: 2400 },
                            { id: "magnum_lighting_rgbw_8_10", name: "LED-Lighting with 8 or 10 RGBW-LED strips (ø7-10x10)", price: 3260 },
                            { id: "magnum_lighting_rgbw_10_12x12", name: "LED-Lighting with 10 RGBW-LED strips (12x12)", price: 3780 },
                            { id: "magnum_lighting_rgbw_16_20", name: "LED-Lighting with 16 or 20 RGBW-LED strips (ø7-10x10)", price: 6300 },
                            { id: "magnum_lighting_rgbw_20_12x12", name: "LED-Lighting with 20 RGBW-LED strips (12x12)", price: 7550 },
                            { id: "magnum_heating", name: "Heating (8 electric radiators)", price: 5300 },
                            { id: "magnum_light_heat_discount", name: "Price Reduction for combination of lighting & radiators", price: -320 },
                            { id: "heater_unit_with_mount", name: "Värmare med fäste (styckepris)", price: 540 },
                            { id: "heater_unit_without_mount", name: "Värmare utan fäste (styckepris)", price: 450 }
                        ]
                    },
                    {
                        name: "Technology / Electronics",
                        items: [
                            { id: "magnum_speakers", name: "Speakers (frame integrated audio system)", price: 0, priceUponRequest: true },
                            { id: "magnum_tv", name: "TV Frame Modification for 1 or 2 TVs", price: 3150 },
                            { id: "magnum_wifi", name: "Wifi Frame Modification", price: 0, priceUponRequest: true }
                        ]
                    },
                    {
                        name: "Maritime Edition",
                        items: [
                            { id: "magnum_v4a", name: "V4A Maritime Edition", price: 4930 }
                        ]
                    }
                ]
            }
        }
    },
    ClickitUp: {
        name: "ClickitUp",
        type: "grid",
        currency: "SEK",
        gridItems: [
            {
                model: "ClickitUp Sektion", exportNameEn: "ClickitUp section", sizes: [
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
            { model: "Curved Rundat Hörn", exportNameEn: "ClickitUpCurved", sizes: [{ size: "500x500", price: 21200 }] },
            {
                model: "ClickitUp Hane", exportNameEn: "ClickitUp male section", sizes: [
                    { size: "700", price: 11869 },
                    { size: "1000", price: 11869 },
                    { size: "1100", price: 12114 }
                ]
            },
            {
                model: "ClickitUp Dörr", exportNameEn: "ClickitUp Door", sizes: [
                    { size: "700", price: 16932 },
                    { size: "1000", price: 16932 },
                    { size: "1100", price: 17177 }
                ]
            }
        ],
        addonCategories: [
            {
                id: "freight",
                name: "Fraktkostnad",
                items: [
                    { id: "frakt_glas", name: "Glasfrakt Specialpall", exportNameEn: "Glass freight – special pallet", price: 2120, autoScale: true, autoScaleDivisor: 6 }
                ]
            },
            {
                id: "required",
                name: "Nödvändiga Tillval",
                items: [
                    { id: "stodben_stort", name: "Stödben stort (45°)", exportNameEn: "Large support leg (45°)", price: 1024 },
                    { id: "stodben_litet", name: "Stödben litet (Slimline)", exportNameEn: "Small support leg (Slimline)", price: 364 },
                    { id: "passbit_alu", name: "Passbit Alu stolpe (50x80mm) inkl. Täcklock", exportNameEn: "Aluminium post spacer (50 × 80 mm), incl. cover cap", price: 1233 }
                ]
            },
            {
                id: "recommended",
                name: "Rekommenderade tillval",
                items: [
                    { id: "svartanodiserade", name: "Svartanodiserade profiler", exportNameEn: "Black-anodised profiles", price: 340, autoScale: true },
                    { id: "stoppknapp", name: "Stoppknapp 140 cm", exportNameEn: "Stop button, 140 cm", price: 564, autoScale: true }
                ]
            },
            {
                id: "additional",
                name: "Andra Tillval / Tillkommande",
                items: [
                    { id: "montering_gangjarn", name: "Montering Gångjärn Rostfritt", exportNameEn: "Stainless-steel hinge installation", price: 1140 },
                    { id: "rostfritt_vinkel", name: "Rostfritt vinkelbeslag", exportNameEn: "Stainless-steel angle bracket", price: 124 },
                    { id: "galvad_stall", name: "Galvad Ställfot (ovan mark inst)", exportNameEn: "Galvanised adjustable foot (above-ground installation)", price: 967 },
                    { id: "vitlackerade_profiler", name: "Vitlackerade profiler", exportNameEn: "White powder-coated profiles", price: 680 },
                    { id: "stallavgift_lackering", name: "Ställavgift lackering", exportNameEn: "Powder-coating setup fee", price: 4900 },
                    { id: "panikregel", name: "Panikregel", exportNameEn: "Panic bar", price: 5000 },
                    { id: "projektering", name: "Projektering. (Fast timpris)", exportNameEn: "Engineering (fixed hourly rate)", price: 720 }
                ]
            },
            {
                id: "blomsterlada",
                name: "Blomsterlåda (svartlackad)",
                items: [
                    { id: "blomsterlada_1800", name: "Blomsterlåda 1800 mm", exportNameEn: "Planter box 1800 mm", price: 6150 },
                    { id: "blomsterlada_1500", name: "Blomsterlåda 1500 mm", exportNameEn: "Planter box 1500 mm", price: 6000 },
                    { id: "blomsterlada_1000", name: "Blomsterlåda 1000 mm", exportNameEn: "Planter box 1000 mm", price: 5850 },
                    { id: "tillval_hjul", name: "Tillval hjul", exportNameEn: "Wheels", price: 600 },
                    { id: "tillval_tralav", name: "Tillval Trälav", exportNameEn: "Wooden bench", price: 2200 },
                    { id: "startkostnad_special", name: "Startkostnad specialmått (närmast större sektionsstorlek + en startkostnad)", exportNameEn: "Custom-size setup fee", price: 3000 },
                    { id: "startkostnad_ral", name: "Startkostnad RAL-lack (antal RAL + en startkostnad)", exportNameEn: "RAL powder-coating setup fee", price: 4900 },
                    { id: "ral_blomsterlador", name: "RAL (antal blomsterlådor)", exportNameEn: "RAL powder coating (quantity of planter boxes)", price: 340 }
                ]
            },
            {
                id: "stickfotter",
                name: "Stickfötter",
                items: [
                    { id: "stickfot_std_singel", name: "Stickfot Standard Singel", exportNameEn: "Standard ground spike, single", price: 222 },
                    { id: "stickfot_std_dubbel", name: "Stickfot Standard Dubbel", exportNameEn: "Standard ground spike, double", price: 349 },
                    { id: "stickfot_std_kapad", name: "Stickfot Standard Kapad", exportNameEn: "Standard ground spike, cut to size", price: 295 },
                    { id: "stickfot_plus30_singel", name: "Stickfot +30 Singel", exportNameEn: "+30 ground spike, single", price: 251 },
                    { id: "stickfot_plus30_dubbel", name: "Stickfot +30 Dubbel", exportNameEn: "+30 ground spike, double", price: 412 },
                    { id: "stickfot_plus60_singel", name: "Stickfot +60 Singel", exportNameEn: "+60 ground spike, single", price: 263 },
                    { id: "stickfot_plus60_dubbel", name: "Stickfot +60 Dubbel", exportNameEn: "+60 ground spike, double", price: 414 }
                ]
            }
        ]
    },
    ClickitUpFixed: {
        name: "ClickitUp Fixed",
        type: "grid",
        currency: "SEK",
        gridItems: [
            {
                model: "ClickitUp Sektion", exportNameEn: "CiUFixed section", sizes: [
                    { size: "700", price: 4396 },
                    { size: "1000", price: 4396 },
                    { size: "1100", price: 4516 },
                    { size: "1200", price: 4636 },
                    { size: "1300", price: 4756 },
                    { size: "1400", price: 4876 },
                    { size: "1500", price: 4996 },
                    { size: "1600", price: 5116 },
                    { size: "1700", price: 5236 },
                    { size: "1800", price: 5356 },
                    { size: "1900", price: 5476 },
                    { size: "2000", price: 5596 }
                ]
            },
            {
                model: "ClickitUp Hane", exportNameEn: "CiUFixed male section", sizes: [
                    { size: "1000", price: 4396 },
                    { size: "1100", price: 4396 }
                ]
            },
            {
                model: "ClickitUp Dörr", exportNameEn: "CiUFixedDoor", sizes: [
                    { size: "1000", price: 11756 },
                    { size: "1100", price: 11836 }
                ]
            }
        ],
        addonCategories: [
            {
                id: "freight",
                name: "Fraktkostnad",
                items: [
                    { id: "frakt_glas", name: "Glasfrakt Specialpall", exportNameEn: "Glass freight – special pallet", price: 2120, autoScale: true, autoScaleDivisor: 6 }
                ]
            },
            {
                id: "required",
                name: "Nödvändiga Tillval",
                items: [
                    { id: "stodben_stort", name: "Stödben stort (45°)", exportNameEn: "Large support leg (45°)", price: 1024 },
                    { id: "stodben_litet", name: "Stödben litet (Slimline)", exportNameEn: "Small support leg (Slimline)", price: 364 },
                    { id: "passbit_alu", name: "Passbit Alu stolpe (50x80mm) inkl. Täcklock", exportNameEn: "Aluminium post spacer (50 × 80 mm), incl. cover cap", price: 1233 }
                ]
            },
            {
                id: "recommended",
                name: "Rekommenderade tillval",
                items: [
                    { id: "svartanodiserade", name: "Svartanodiserade profiler", exportNameEn: "Black-anodised profiles", price: 340, autoScale: true }
                ]
            },
            {
                id: "additional",
                name: "Andra Tillval / Tillkommande",
                items: [
                    { id: "montering_gangjarn", name: "Montering Gångjärn Rostfritt", exportNameEn: "Stainless-steel hinge installation", price: 1140 },
                    { id: "rostfritt_vinkel", name: "Rostfritt vinkelbeslag", exportNameEn: "Stainless-steel angle bracket", price: 124 },
                    { id: "galvad_stall", name: "Galvad Ställfot (ovan mark inst)", exportNameEn: "Galvanised adjustable foot (above-ground installation)", price: 967 },
                    { id: "vitlackerade_profiler", name: "Vitlackerade profiler", exportNameEn: "White powder-coated profiles", price: 680 },
                    { id: "stallavgift_lackering", name: "Ställavgift lackering", exportNameEn: "Powder-coating setup fee", price: 4900 },
                    { id: "panikregel", name: "Panikregel", exportNameEn: "Panic bar", price: 5000 },
                    { id: "projektering", name: "Projektering. (Fast timpris)", exportNameEn: "Engineering (fixed hourly rate)", price: 720 }
                ]
            },
            {
                id: "blomsterlada",
                name: "Blomsterlåda (svartlackad)",
                items: [
                    { id: "blomsterlada_1800", name: "Blomsterlåda 1800 mm", exportNameEn: "Planter box 1800 mm", price: 6150 },
                    { id: "blomsterlada_1500", name: "Blomsterlåda 1500 mm", exportNameEn: "Planter box 1500 mm", price: 6000 },
                    { id: "blomsterlada_1000", name: "Blomsterlåda 1000 mm", exportNameEn: "Planter box 1000 mm", price: 5850 },
                    { id: "tillval_hjul", name: "Tillval hjul", exportNameEn: "Wheels", price: 600 },
                    { id: "tillval_tralav", name: "Tillval Trälav", exportNameEn: "Wooden bench", price: 2200 },
                    { id: "startkostnad_special", name: "Startkostnad specialmått (närmast större sektionsstorlek + en startkostnad)", exportNameEn: "Custom-size setup fee", price: 3000 },
                    { id: "startkostnad_ral", name: "Startkostnad RAL-lack (antal RAL + en startkostnad)", exportNameEn: "RAL powder-coating setup fee", price: 4900 },
                    { id: "ral_blomsterlador", name: "RAL (antal blomsterlådor)", exportNameEn: "RAL powder coating (quantity of planter boxes)", price: 340 }
                ]
            },
            {
                id: "stickfotter",
                name: "Stickfötter",
                items: [
                    { id: "stickfot_std_singel", name: "Stickfot Standard Singel", exportNameEn: "Standard ground spike, single", price: 222 },
                    { id: "stickfot_std_dubbel", name: "Stickfot Standard Dubbel", exportNameEn: "Standard ground spike, double", price: 349 },
                    { id: "stickfot_std_kapad", name: "Stickfot Standard Kapad", exportNameEn: "Standard ground spike, cut to size", price: 295 },
                    { id: "stickfot_plus30_singel", name: "Stickfot +30 Singel", exportNameEn: "+30 ground spike, single", price: 251 },
                    { id: "stickfot_plus30_dubbel", name: "Stickfot +30 Dubbel", exportNameEn: "+30 ground spike, double", price: 412 },
                    { id: "stickfot_plus60_singel", name: "Stickfot +60 Singel", exportNameEn: "+60 ground spike, single", price: 263 },
                    { id: "stickfot_plus60_dubbel", name: "Stickfot +60 Dubbel", exportNameEn: "+60 ground spike, double", price: 414 }
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
                    "Slim": { price: 19815 }
                },
                addons: [
                    { id: "fiesta_foderrör", name: "Rostfritt Foderrör + Markplatta", price: 2815 },
                    { id: "fiesta_passram", name: "Passram + Däxel", price: 3406 },
                    { id: "fiesta_tipphylsa", name: "Tipphylsa", price: 3260 }
                ]
            },
            "Vent-Twist": {
                name: "Vent-Twist",
                sizes: {
                    "Slim": { price: 20886 }
                },
                addons: [
                    { id: "fiesta_foderrör", name: "Rostfritt Foderrör + Markplatta", price: 2815 },
                    { id: "fiesta_passram", name: "Passram + Däxel", price: 3406 },
                    { id: "fiesta_tipphylsa", name: "Tipphylsa", price: 3260 }
                ]
            }
        }
    }
};

export const catalogData: CatalogData = withBuilderAddonCategoryIds(rawCatalogData);
