import {
  AttachmentId,
  AttachmentSpec,
  WeaponId,
  WeaponSkinId,
  WeaponSkinSpec,
  WeaponSpec,
} from '../types/game';

export const WEAPON_LIST: WeaponSpec[] = [
  {
    id: WeaponId.KATANA,
    slot: 1,
    name: 'Katana',
    category: 'Melee',
    description:
      'Razor-sharp folded steel blade. Silent, infinite durability, deadly close-quarters arc slash.',
    price: 0,
    upgradeBaseCost: 120,
    damage: 58,
    fireRate: 2.1,
    reloadTime: 0,
    magSize: 0,
    maxReserve: 0,
    recoil: 0.02,
    accuracy: 1.0,
    spreadRad: 0,
    range: 3.1,
    pellets: 1,
    automatic: false,
    isMelee: true,
    adsFov: 68,
    penetration: 1,
    supportedAttachments: [],
  },
  {
    id: WeaponId.M1911,
    slot: 2,
    name: 'M1911 Pistol',
    category: 'Sidearm',
    description:
      'Reliable .45 ACP semi-automatic sidearm. High stopping power and crisp handling.',
    price: 150,
    upgradeBaseCost: 140,
    damage: 34,
    fireRate: 5.0,
    reloadTime: 1.35,
    magSize: 12,
    maxReserve: 120,
    recoil: 0.04,
    accuracy: 0.92,
    spreadRad: 0.014,
    range: 65,
    pellets: 1,
    automatic: false,
    isMelee: false,
    adsFov: 60,
    penetration: 1,
    supportedAttachments: ['red_dot', 'suppressor', 'extended_mag'],
  },
  {
    id: WeaponId.UZI,
    slot: 3,
    name: 'Uzi SMG',
    category: 'SMG',
    description:
      'Compact blowback submachine gun built to shred fast-moving infected packs at close range.',
    price: 420,
    upgradeBaseCost: 200,
    damage: 21,
    fireRate: 12.5,
    reloadTime: 1.6,
    magSize: 32,
    maxReserve: 256,
    recoil: 0.028,
    accuracy: 0.78,
    spreadRad: 0.036,
    range: 52,
    pellets: 1,
    automatic: true,
    isMelee: false,
    adsFov: 60,
    penetration: 1,
    supportedAttachments: ['red_dot', 'suppressor', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.BENELLI_M4,
    slot: 4,
    name: 'Benelli M4 Shotgun',
    category: 'Shotgun',
    description:
      'Tactical semi-auto 12-gauge combat shotgun firing 8 devastating buckshot pellets per shell.',
    price: 750,
    upgradeBaseCost: 260,
    damage: 22,
    fireRate: 2.0,
    reloadTime: 2.1,
    magSize: 8,
    maxReserve: 64,
    recoil: 0.11,
    accuracy: 0.68,
    spreadRad: 0.072,
    range: 34,
    pellets: 8,
    automatic: false,
    isMelee: false,
    adsFov: 62,
    penetration: 1,
    supportedAttachments: ['red_dot', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.AK74,
    slot: 5,
    name: 'AK-74 Rifle',
    category: 'Assault Rifle',
    description:
      'Rugged Kalashnikov pattern assault rifle delivering heavy 5.45mm punch through fog and timber.',
    price: 1200,
    upgradeBaseCost: 340,
    damage: 42,
    fireRate: 9.2,
    reloadTime: 1.9,
    magSize: 30,
    maxReserve: 240,
    recoil: 0.045,
    accuracy: 0.86,
    spreadRad: 0.022,
    range: 110,
    pellets: 1,
    automatic: true,
    isMelee: false,
    adsFov: 54,
    penetration: 1,
    supportedAttachments: ['red_dot', 'scope', 'suppressor', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.M4,
    slot: 6,
    name: 'M4 Rifle',
    category: 'Assault Rifle',
    description:
      'Precision NATO carbine with holographic optic, low recoil impulse, and fast tactical reload.',
    price: 1750,
    upgradeBaseCost: 420,
    damage: 39,
    fireRate: 11.2,
    reloadTime: 1.55,
    magSize: 30,
    maxReserve: 270,
    recoil: 0.03,
    accuracy: 0.93,
    spreadRad: 0.013,
    range: 120,
    pellets: 1,
    automatic: true,
    isMelee: false,
    adsFov: 50,
    penetration: 1,
    supportedAttachments: ['red_dot', 'scope', 'suppressor', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.M107,
    slot: 7,
    name: 'M107 Sniper Rifle',
    category: 'Sniper',
    description:
      'Anti-materiel .50 BMG rifle. Pierces multiple zombies in a line and obliterates Tank heads.',
    price: 2600,
    upgradeBaseCost: 520,
    damage: 245,
    fireRate: 1.05,
    reloadTime: 2.5,
    magSize: 10,
    maxReserve: 60,
    recoil: 0.16,
    accuracy: 0.99,
    spreadRad: 0.002,
    range: 200,
    pellets: 1,
    automatic: false,
    isMelee: false,
    adsFov: 32,
    penetration: 3,
    supportedAttachments: ['scope', 'suppressor', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.M249,
    slot: 8,
    name: 'M249 Machine Gun',
    category: 'LMG',
    description:
      'Belt-fed squad automatic weapon built for sustained horde suppression.',
    price: 3600,
    upgradeBaseCost: 650,
    damage: 37,
    fireRate: 13.0,
    reloadTime: 3.1,
    magSize: 100,
    maxReserve: 400,
    recoil: 0.038,
    accuracy: 0.83,
    spreadRad: 0.026,
    range: 125,
    pellets: 1,
    automatic: true,
    isMelee: false,
    adsFov: 55,
    penetration: 1,
    supportedAttachments: ['red_dot', 'scope', 'extended_mag', 'foregrip'],
  },
  {
    id: WeaponId.M2,
    slot: 9,
    name: 'M2 Heavy Machine Gun',
    category: 'Heavy MG',
    description:
      'Devastating .50 caliber heavy machine gun. Tears through armored hordes and wave bosses.',
    price: 5500,
    upgradeBaseCost: 850,
    damage: 86,
    fireRate: 8.5,
    reloadTime: 3.5,
    magSize: 120,
    maxReserve: 480,
    recoil: 0.055,
    accuracy: 0.85,
    spreadRad: 0.022,
    range: 160,
    pellets: 1,
    automatic: true,
    isMelee: false,
    adsFov: 54,
    penetration: 2,
    supportedAttachments: ['red_dot', 'extended_mag'],
  },
];

export const WEAPONS_BY_ID: Record<WeaponId, WeaponSpec> = WEAPON_LIST.reduce(
  (acc, w) => {
    acc[w.id] = w;
    return acc;
  },
  {} as Record<WeaponId, WeaponSpec>
);

export const ATTACHMENT_LIST: AttachmentSpec[] = [
  {
    id: 'red_dot',
    name: 'Red Dot Reflex Sight',
    slotType: 'optic',
    description: 'Illuminated reflex glass lens that tightens ADS precision by 15%.',
    price: 220,
    spreadMult: 0.85,
    recoilMult: 0.95,
    magMult: 1.0,
    adsFovDelta: -4,
    suppressed: false,
  },
  {
    id: 'scope',
    name: 'ACOG 4x Tactical Scope',
    slotType: 'optic',
    description: 'Magnified night-etched optic for long-range forest headshots.',
    price: 380,
    spreadMult: 0.72,
    recoilMult: 0.92,
    magMult: 1.0,
    adsFovDelta: -14,
    suppressed: false,
  },
  {
    id: 'suppressor',
    name: 'Tactical Suppressor',
    slotType: 'muzzle',
    description: 'Dampens muzzle flash and report while reducing vertical kick.',
    price: 320,
    spreadMult: 0.9,
    recoilMult: 0.82,
    magMult: 1.0,
    adsFovDelta: 0,
    suppressed: true,
  },
  {
    id: 'extended_mag',
    name: 'Extended Magazine',
    slotType: 'magazine',
    description: 'Increases magazine capacity by +40% for longer firefights.',
    price: 290,
    spreadMult: 1.0,
    recoilMult: 1.0,
    magMult: 1.4,
    adsFovDelta: 0,
    suppressed: false,
  },
  {
    id: 'foregrip',
    name: 'Angled Foregrip',
    slotType: 'underbarrel',
    description: 'Stabilizes full-auto sprays with -24% recoil and -12% hipfire bloom.',
    price: 260,
    spreadMult: 0.88,
    recoilMult: 0.76,
    magMult: 1.0,
    adsFovDelta: 0,
    suppressed: false,
  },
];

export const ATTACHMENTS_BY_ID: Record<AttachmentId, AttachmentSpec> = ATTACHMENT_LIST.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<AttachmentId, AttachmentSpec>
);

export const WEAPON_SKINS: WeaponSkinSpec[] = [
  {
    id: 'standard',
    name: 'Factory Issue',
    description: 'Mil-spec matte parkerized steel and black polymer.',
    priceCoins: 0,
    priceGems: 0,
    tintHex: 0x2a303a,
    accentHex: 0x64748b,
    swatchCss: 'linear-gradient(135deg, #272d38, #11161f)',
  },
  {
    id: 'urban_camo',
    name: 'Night Wolf Camo',
    description: 'Slate grey tactical finish tailored for nocturnal ops.',
    priceCoins: 350,
    priceGems: 0,
    tintHex: 0x475569,
    accentHex: 0x94a3b8,
    swatchCss: 'linear-gradient(135deg, #475569, #1e293b)',
  },
  {
    id: 'crimson_steel',
    name: 'Crimson Reaper',
    description: 'Anodized blood-red receiver plates over blackened steel.',
    priceCoins: 650,
    priceGems: 15,
    tintHex: 0x991b1b,
    accentHex: 0xef4444,
    swatchCss: 'linear-gradient(135deg, #b91c1c, #3b0a0a)',
  },
  {
    id: 'desert_tan',
    name: 'FDE Special Forces',
    description: 'Flat Dark Earth Cerakote receiver and furniture.',
    priceCoins: 500,
    priceGems: 0,
    tintHex: 0x856d4b,
    accentHex: 0xd6b98d,
    swatchCss: 'linear-gradient(135deg, #9c7e54, #4d3c27)',
  },
  {
    id: 'gold_plated',
    name: '24K Sovereign Gold',
    description: 'Mirror-brushed gold plating for veteran wave survivors.',
    priceCoins: 1400,
    priceGems: 35,
    tintHex: 0xd4a438,
    accentHex: 0xfde047,
    swatchCss: 'linear-gradient(135deg, #facc15, #92400e)',
  },
];

export const WEAPON_SKINS_BY_ID: Record<WeaponSkinId, WeaponSkinSpec> = WEAPON_SKINS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<WeaponSkinId, WeaponSkinSpec>
);

export function getWeaponUpgradeCost(weapon: WeaponSpec, currentLevel: number): number {
  return Math.round(weapon.upgradeBaseCost * Math.pow(1.48, currentLevel - 1));
}

export function getEffectiveWeaponDamage(
  weapon: WeaponSpec,
  weaponLevel: number,
  damageUpgradeLevel: number
): number {
  const weaponBonus = 1 + (weaponLevel - 1) * 0.14;
  const playerBonus = 1 + damageUpgradeLevel * 0.08;
  return Math.round(weapon.damage * weaponBonus * playerBonus);
}

export function getEffectiveWeaponStats(
  weapon: WeaponSpec,
  equippedAttachments: AttachmentId[] = []
): {
  magSize: number;
  spreadRad: number;
  recoil: number;
  adsFov: number;
  suppressed: boolean;
} {
  let magMult = 1;
  let spreadMult = 1;
  let recoilMult = 1;
  let adsFovDelta = 0;
  let suppressed = false;

  for (const id of equippedAttachments) {
    const att = ATTACHMENTS_BY_ID[id];
    if (!att) continue;
    magMult *= att.magMult;
    spreadMult *= att.spreadMult;
    recoilMult *= att.recoilMult;
    adsFovDelta += att.adsFovDelta;
    if (att.suppressed) suppressed = true;
  }

  return {
    magSize: weapon.isMelee ? 0 : Math.round(weapon.magSize * magMult),
    spreadRad: weapon.spreadRad * spreadMult,
    recoil: weapon.recoil * recoilMult,
    adsFov: Math.max(20, weapon.adsFov + adsFovDelta),
    suppressed,
  };
}
