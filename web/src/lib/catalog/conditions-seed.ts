// Starter condition → salt mapping for condition-based search.
// Written for PharmaBharat (not taken from any dataset). Admins can edit tags
// after seeding; this file is only the initial content.
// Salt names are lower-case and match the spelling used in the medicine master.

export type ConditionSeed = {
  slug: string;
  name: { en: string; hi: string; mr: string };
  salts: string[];
};

export const CONDITION_SEED: ConditionSeed[] = [
  {
    slug: "diabetes",
    name: { en: "Diabetes", hi: "मधुमेह", mr: "मधुमेह" },
    salts: [
      "metformin", "glimepiride", "gliclazide", "glipizide", "glibenclamide", "sitagliptin", "vildagliptin",
      "teneligliptin", "linagliptin", "saxagliptin", "dapagliflozin", "empagliflozin", "canagliflozin",
      "pioglitazone", "voglibose", "acarbose", "repaglinide", "insulin glargine", "human insulin",
      "insulin aspart", "insulin lispro", "insulin degludec", "remogliflozin etabonate",
    ],
  },
  {
    slug: "hypertension",
    name: { en: "High blood pressure", hi: "उच्च रक्तचाप", mr: "उच्च रक्तदाब" },
    salts: [
      "amlodipine", "telmisartan", "losartan", "olmesartan medoxomil", "valsartan", "irbesartan",
      "ramipril", "enalapril", "lisinopril", "cilnidipine", "nifedipine", "atenolol", "metoprolol succinate",
      "metoprolol tartrate", "bisoprolol", "nebivolol", "carvedilol", "hydrochlorothiazide", "chlorthalidone",
      "indapamide", "prazosin", "clonidine", "azelnidipine",
    ],
  },
  {
    slug: "cholesterol",
    name: { en: "High cholesterol", hi: "उच्च कोलेस्ट्रॉल", mr: "उच्च कोलेस्टेरॉल" },
    salts: ["atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "pitavastatin", "fenofibrate", "ezetimibe", "saroglitazar"],
  },
  {
    slug: "heart",
    name: { en: "Heart & blood thinning", hi: "हृदय व रक्त पतला करना", mr: "हृदय व रक्त पातळ करणे" },
    salts: [
      "aspirin", "clopidogrel", "prasugrel", "ticagrelor", "warfarin", "acenocoumarol", "apixaban",
      "rivaroxaban", "dabigatran etexilate", "isosorbide mononitrate", "isosorbide dinitrate", "nitroglycerin",
      "ranolazine", "trimetazidine", "digoxin", "ivabradine", "sacubitril", "torasemide", "furosemide", "spironolactone",
    ],
  },
  {
    slug: "fever-pain",
    name: { en: "Fever & pain", hi: "बुखार व दर्द", mr: "ताप व वेदना" },
    salts: [
      "paracetamol", "ibuprofen", "diclofenac", "aceclofenac", "naproxen", "mefenamic acid", "nimesulide",
      "etoricoxib", "tramadol", "ketorolac", "piroxicam", "indomethacin", "etodolac", "tapentadol",
    ],
  },
  {
    slug: "infection",
    name: { en: "Bacterial infection", hi: "बैक्टीरियल संक्रमण", mr: "जिवाणू संसर्ग" },
    salts: [
      "amoxycillin", "clavulanic acid", "azithromycin", "cefixime", "cefpodoxime proxetil", "cefuroxime",
      "ceftriaxone", "cefadroxil", "cefalexin", "ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin",
      "doxycycline", "clarithromycin", "linezolid", "nitrofurantoin", "metronidazole", "ornidazole",
      "tinidazole", "sulfamethoxazole", "trimethoprim", "piperacillin", "tazobactum", "meropenem", "amikacin",
      "gentamicin", "faropenem", "cefoperazone", "sulbactam",
    ],
  },
  {
    slug: "cough-cold",
    name: { en: "Cough & cold", hi: "खाँसी व सर्दी", mr: "खोकला व सर्दी" },
    salts: [
      "ambroxol", "levosalbutamol", "guaifenesin", "bromhexine", "dextromethorphan hydrobromide",
      "chlorpheniramine maleate", "phenylephrine", "codeine", "terbutaline", "acetylcysteine", "acebrophylline",
    ],
  },
  {
    slug: "allergy",
    name: { en: "Allergy", hi: "एलर्जी", mr: "ॲलर्जी" },
    salts: [
      "cetirizine", "levocetirizine", "fexofenadine", "loratadine", "desloratadine", "bilastine",
      "montelukast", "hydroxyzine", "olopatadine", "ebastine", "rupatadine", "chlorpheniramine maleate",
    ],
  },
  {
    slug: "asthma-copd",
    name: { en: "Asthma & COPD", hi: "अस्थमा व सीओपीडी", mr: "दमा व सीओपीडी" },
    salts: [
      "salbutamol", "levosalbutamol", "budesonide", "formoterol", "fluticasone propionate", "salmeterol",
      "tiotropium", "ipratropium", "doxofylline", "theophylline", "montelukast", "glycopyrrolate",
    ],
  },
  {
    slug: "acidity",
    name: { en: "Acidity & ulcers", hi: "एसिडिटी व अल्सर", mr: "ॲसिडिटी व अल्सर" },
    salts: [
      "pantoprazole", "rabeprazole", "omeprazole", "esomeprazole", "lansoprazole", "ranitidine", "famotidine",
      "domperidone", "itopride", "levosulpiride", "sucralfate", "magaldrate", "simethicone",
    ],
  },
  {
    slug: "digestion",
    name: { en: "Nausea, diarrhoea & constipation", hi: "मतली, दस्त व कब्ज़", mr: "मळमळ, जुलाब व बद्धकोष्ठ" },
    salts: [
      "ondansetron", "domperidone", "loperamide", "racecadotril", "lactulose", "bisacodyl", "sodium picosulfate",
      "ispaghula", "rifaximin", "saccharomyces boulardii", "lactic acid bacillus", "mesalazine",
    ],
  },
  {
    slug: "thyroid",
    name: { en: "Thyroid", hi: "थायराइड", mr: "थायरॉईड" },
    salts: ["thyroxine", "carbimazole", "methimazole", "propylthiouracil"],
  },
  {
    slug: "vitamins",
    name: { en: "Vitamins & supplements", hi: "विटामिन व सप्लीमेंट", mr: "जीवनसत्त्वे व पूरक" },
    salts: [
      "vitamin d3", "methylcobalamin", "calcium carbonate", "folic acid", "ferrous ascorbate",
      "ferrous fumarate", "vitamin c", "zinc", "calcitriol", "vitamin b6 (pyridoxine)", "alpha lipoic acid",
      "ferric carboxymaltose", "iron sucrose", "elemental iron",
    ],
  },
  {
    slug: "mental-health",
    name: { en: "Depression & anxiety", hi: "अवसाद व चिंता", mr: "नैराश्य व चिंता" },
    salts: [
      "escitalopram oxalate", "sertraline", "fluoxetine", "paroxetine", "duloxetine", "venlafaxine", "desvenlafaxine",
      "mirtazapine", "amitriptyline", "clonazepam", "alprazolam", "lorazepam", "etizolam", "bupropion",
      "olanzapine", "quetiapine", "risperidone", "aripiprazole",
    ],
  },
  {
    slug: "epilepsy-nerve",
    name: { en: "Epilepsy & nerve pain", hi: "मिर्गी व नसों का दर्द", mr: "अपस्मार व मज्जातंतू वेदना" },
    salts: [
      "levetiracetam", "sodium valproate", "divalproex", "phenytoin", "carbamazepine", "oxcarbazepine",
      "lamotrigine", "topiramate", "pregabalin", "gabapentin", "lacosamide", "clobazam",
    ],
  },
  {
    slug: "skin",
    name: { en: "Skin conditions", hi: "त्वचा रोग", mr: "त्वचा विकार" },
    salts: [
      "clobetasol", "betamethasone", "mometasone", "fusidic acid", "mupirocin", "ketoconazole",
      "luliconazole", "clotrimazole", "terbinafine", "itraconazole", "fluconazole", "adapalene", "tretinoin",
      "benzoyl peroxide", "permethrin", "clindamycin", "sertaconazole", "eberconazole",
    ],
  },
  {
    slug: "eye-ear",
    name: { en: "Eye & ear", hi: "आँख व कान", mr: "डोळे व कान" },
    salts: [
      "moxifloxacin", "tobramycin", "carboxymethylcellulose", "timolol", "brimonidine", "latanoprost",
      "prednisolone", "loteprednol etabonate", "nepafenac", "hydroxypropylmethylcellulose",
    ],
  },
  {
    slug: "urinary-kidney",
    name: { en: "Urinary & prostate", hi: "मूत्र व प्रोस्टेट", mr: "मूत्र व प्रोस्टेट" },
    salts: ["tamsulosin", "silodosin", "alfuzosin", "dutasteride", "finasteride", "solifenacin", "mirabegron", "flavoxate", "sodium bicarbonate"],
  },
  {
    slug: "bone-joint",
    name: { en: "Bones & joints", hi: "हड्डी व जोड़", mr: "हाडे व सांधे" },
    salts: ["glucosamine", "diacerein", "alendronic acid", "calcitriol", "vitamin d3", "febuxostat", "allopurinol", "colchicine", "thiocolchicoside", "chlorzoxazone", "methotrexate", "hydroxychloroquine"],
  },
  {
    slug: "women-health",
    name: { en: "Women's health", hi: "महिला स्वास्थ्य", mr: "स्त्री आरोग्य" },
    salts: ["progesterone", "dydrogesterone", "clomiphene", "letrozole", "tranexamic acid", "norethisterone", "ethinyl estradiol", "levonorgestrel", "myo-inositol"],
  },
];
