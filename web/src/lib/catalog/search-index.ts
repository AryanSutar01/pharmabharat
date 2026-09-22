// Atlas Search index for the products collection (works on the free M0 tier,
// which allows up to 3 search indexes). Created/updated by scripts/import-medicines.ts.
// Keep this file free of "@/" imports so Node can run the script directly.

export const PRODUCT_SEARCH_INDEX = "products_search";

export const productSearchIndexDefinition = {
  mappings: {
    dynamic: false,
    fields: {
      name: [
        { type: "string", analyzer: "lucene.standard" },
        { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
      ],
      salts: [
        { type: "string", analyzer: "lucene.standard" },
        { type: "autocomplete", tokenization: "edgeGram", minGrams: 3, maxGrams: 15, foldDiacritics: true },
      ],
      manufacturer: { type: "string", analyzer: "lucene.standard" },
      conditions: { type: "token" },
      form: { type: "token" },
      active: { type: "boolean" },
    },
  },
};
