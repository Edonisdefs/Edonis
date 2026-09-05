import type { Trade } from "@prisma/client";

/**
 * Branchenprofile.
 *
 * Das MVP ist auf SHK optimiert. Weitere Gewerke lassen sich hier ergänzen,
 * ohne Datenmodell oder Workflow zu ändern – Katalog, Standardtätigkeiten und
 * Einheiten hängen ausschließlich an diesem Profil.
 */

export type CatalogEntry = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultPrice: number | null;
  aliases: string[];
};

export type TradeConfig = {
  label: string;
  units: string[];
  commonActivities: string[];
  catalog: CatalogEntry[];
};

const SHK: TradeConfig = {
  label: "Sanitär · Heizung · Klima",
  units: ["Stück", "m", "l", "kg", "Satz", "Packung", "Rolle", "Pauschale"],
  commonActivities: [
    "Alte Armatur ausgebaut",
    "Neue Armatur eingebaut",
    "Anlage geprüft, dicht",
    "Heizung entlüftet",
    "Druckprobe durchgeführt",
    "Therme gewartet",
    "Abfluss gereinigt",
    "Kunde eingewiesen",
  ],
  catalog: [
    {
      sku: "SHK-1001",
      name: "Flexschlauch",
      category: "Verbindungstechnik",
      unit: "Stück",
      defaultPrice: 8.9,
      aliases: ["Panzerschlauch", "Anschlussschlauch", "Flexi"],
    },
    {
      sku: "SHK-1002",
      name: "Eckventil",
      category: "Armaturen",
      unit: "Stück",
      defaultPrice: 12.5,
      aliases: ["Eckregulierventil", "Ventil"],
    },
    {
      sku: "SHK-1003",
      name: "Waschtischarmatur",
      category: "Armaturen",
      unit: "Stück",
      defaultPrice: 149.0,
      aliases: ["Armatur", "Mischbatterie", "Einhebelmischer"],
    },
    {
      sku: "SHK-1004",
      name: "Kupferrohr 15 mm",
      category: "Rohrleitung",
      unit: "m",
      defaultPrice: 9.4,
      aliases: ["Kupferrohr", "Kupfer"],
    },
    {
      sku: "SHK-1005",
      name: "Winkel 90° 15 mm",
      category: "Fittinge",
      unit: "Stück",
      defaultPrice: 3.2,
      aliases: ["Winkel", "Bogen", "Winkelstück"],
    },
    {
      sku: "SHK-1006",
      name: "Pressfitting 15 mm",
      category: "Fittinge",
      unit: "Stück",
      defaultPrice: 4.8,
      aliases: ["Pressfitting", "Fitting", "Presskupplung"],
    },
    {
      sku: "SHK-1007",
      name: "Kugelhahn 1/2 Zoll",
      category: "Armaturen",
      unit: "Stück",
      defaultPrice: 14.9,
      aliases: ["Kugelhahn", "Absperrventil", "Absperrhahn"],
    },
    {
      sku: "SHK-1008",
      name: "Siphon Waschtisch",
      category: "Entwässerung",
      unit: "Stück",
      defaultPrice: 19.9,
      aliases: ["Siphon", "Geruchsverschluss"],
    },
    {
      sku: "SHK-1009",
      name: "HT-Rohr DN 50",
      category: "Entwässerung",
      unit: "m",
      defaultPrice: 6.5,
      aliases: ["HT-Rohr", "Abflussrohr"],
    },
    {
      sku: "SHK-1010",
      name: "Dichtung",
      category: "Kleinteile",
      unit: "Stück",
      defaultPrice: 0.9,
      aliases: ["Dichtungsring", "Gummidichtung", "O-Ring"],
    },
    {
      sku: "SHK-1011",
      name: "Wartungsset Therme",
      category: "Heizung",
      unit: "Satz",
      defaultPrice: 89.0,
      aliases: ["Wartungsset", "Serviceset", "Wartungspaket"],
    },
    {
      sku: "SHK-1012",
      name: "Umwälzpumpe",
      category: "Heizung",
      unit: "Stück",
      defaultPrice: 289.0,
      aliases: ["Heizungspumpe", "Pumpe"],
    },
    {
      sku: "SHK-1013",
      name: "Thermostatventil",
      category: "Heizung",
      unit: "Stück",
      defaultPrice: 34.5,
      aliases: ["Thermostat", "Heizkörperventil"],
    },
    {
      sku: "SHK-1014",
      name: "Spülkasten Unterputz",
      category: "Sanitär",
      unit: "Stück",
      defaultPrice: 219.0,
      aliases: ["Spülkasten", "UP-Spülkasten"],
    },
    {
      sku: "SHK-1015",
      name: "Vorwandelement WC",
      category: "Sanitär",
      unit: "Stück",
      defaultPrice: 179.0,
      aliases: ["Vorwandelement", "Vorwandinstallation", "Montageelement"],
    },
    {
      sku: "SHK-1016",
      name: "Silikon sanitär",
      category: "Kleinteile",
      unit: "Stück",
      defaultPrice: 7.9,
      aliases: ["Silikon", "Kartusche", "Sanitärsilikon"],
    },
    {
      sku: "SHK-1017",
      name: "Hanf & Dichtpaste",
      category: "Kleinteile",
      unit: "Satz",
      defaultPrice: 11.5,
      aliases: ["Hanf", "Dichtpaste", "Dichtmittel"],
    },
    {
      sku: "SHK-1018",
      name: "Rohrisolierung 15 mm",
      category: "Dämmung",
      unit: "m",
      defaultPrice: 3.8,
      aliases: ["Isolierung", "Dämmschlauch", "Rohrdämmung"],
    },
    {
      sku: "SHK-1019",
      name: "Heizkörper Typ 22",
      category: "Heizung",
      unit: "Stück",
      defaultPrice: 245.0,
      aliases: ["Heizkörper", "Radiator"],
    },
    {
      sku: "SHK-1020",
      name: "Duscharmatur",
      category: "Armaturen",
      unit: "Stück",
      defaultPrice: 189.0,
      aliases: ["Duschbatterie", "Brausearmatur"],
    },
  ],
};

const GENERIC = (label: string): TradeConfig => ({
  label,
  units: ["Stück", "m", "m²", "l", "kg", "Pauschale"],
  commonActivities: [],
  catalog: [],
});

export const TRADE_CONFIGS: Record<Trade, TradeConfig> = {
  SHK,
  ELEKTRO: GENERIC("Elektrotechnik"),
  MALER: GENERIC("Maler und Lackierer"),
  DACHDECKER: GENERIC("Dachdecker"),
  SCHREINER: GENERIC("Schreiner"),
  BAU: GENERIC("Bau und Montage"),
  SONSTIGES: GENERIC("Handwerk"),
};

export function getTradeConfig(trade: Trade): TradeConfig {
  return TRADE_CONFIGS[trade] ?? TRADE_CONFIGS.SONSTIGES;
}

export const COMMON_UNITS = [
  "Stück",
  "m",
  "m²",
  "lfm",
  "l",
  "kg",
  "Satz",
  "Packung",
  "Rolle",
  "Std.",
  "Pauschale",
];
