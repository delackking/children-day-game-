import type {
  AccessoryId,
  ArcadeGameId,
  AvatarConfig,
  BallState,
  DanceId,
  DjTrack,
  FoodStallDef,
  HairstyleId,
  OutfitId,
  ZoneId,
} from './types';

export const WORLD_RADIUS = 88;

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
  spawnX: number;
  spawnZ: number;
  color: string;
}

export const CARNIVAL_ZONES: ZoneDefinition[] = [
  {
    id: 'entrance',
    name: 'Grand Entrance',
    subtitle: 'Welcome Arch & Arrival Plaza',
    x: 0,
    z: 48,
    radius: 15,
    spawnX: 0,
    spawnZ: 54,
    color: '#F59E0B',
  },
  {
    id: 'central_plaza',
    name: 'Central Plaza',
    subtitle: 'Lotus Fountain & Ferris Wheel',
    x: 0,
    z: 0,
    radius: 18,
    spawnX: 0,
    spawnZ: 12,
    color: '#EA580C',
  },
  {
    id: 'food_street',
    name: 'Indian Food Street',
    subtitle: '15 Authentic Mela Food Stalls',
    x: -32,
    z: 0,
    radius: 26,
    spawnX: -23.5,
    spawnZ: -2,
    color: '#DC2626',
  },
  {
    id: 'sports_ground',
    name: 'Sports Ground',
    subtitle: 'Football Pitch & Basketball Court',
    x: 36,
    z: 6,
    radius: 25,
    spawnX: 28,
    spawnZ: 8,
    color: '#16A34A',
  },
  {
    id: 'dj_arena',
    name: 'DJ & Dance Arena',
    subtitle: 'Live Stage, Disco Lights & Dance Floor',
    x: 0,
    z: -36,
    radius: 20,
    spawnX: 0,
    spawnZ: -30,
    color: '#7C3AED',
  },
  {
    id: 'arcade_zone',
    name: 'Arcade Zone',
    subtitle: '10 Mini-Game Cabinets & Leaderboards',
    x: -30,
    z: -34,
    radius: 17,
    spawnX: -30,
    spawnZ: -35,
    color: '#0284C7',
  },
  {
    id: 'celebration_stage',
    name: 'Grand Celebration Stage',
    subtitle: 'Podium, Ceremonies & Fireworks',
    x: 32,
    z: -34,
    radius: 17,
    spawnX: 30,
    spawnZ: -28,
    color: '#D97706',
  },
];

// 15 Required Indian Carnival Food Stalls arranged cleanly along two festive lanes in Food Street
export const FOOD_STALLS: FoodStallDef[] = [
  {
    id: 'pav_bhaji',
    name: 'Pav Bhaji Express',
    vendorName: 'Ramesh Chacha',
    greeting: 'Hot buttered Pav Bhaji ready on the tawa!',
    x: -26,
    z: 22,
    rotationY: Math.PI / 2,
    awningColorA: '#DC2626',
    awningColorB: '#FDE047',
    items: [
      {
        id: 'item_pav_bhaji',
        stallId: 'pav_bhaji',
        name: 'Mumbai Butter Pav Bhaji',
        description: 'Spiced mashed veggies with toasted butter pav & onions',
        price: 40,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#EA580C',
        secondaryColor: '#FDE68A',
        isDrink: false,
      },
      {
        id: 'item_cheese_pav_bhaji',
        stallId: 'pav_bhaji',
        name: 'Cheese Pav Bhaji',
        description: 'Extra grated cheese melting on warm bhaji',
        price: 55,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#F59E0B',
        secondaryColor: '#FEF3C7',
        isDrink: false,
      },
    ],
  },
  {
    id: 'chole_kulche',
    name: 'Delhi Chole Kulche',
    vendorName: 'Harpreet Ji',
    greeting: 'Soft fluffy kulchas with tangy masala chole!',
    x: -26,
    z: 14,
    rotationY: Math.PI / 2,
    awningColorA: '#EA580C',
    awningColorB: '#FFFBEB',
    items: [
      {
        id: 'item_chole_kulche',
        stallId: 'chole_kulche',
        name: 'Butter Chole Kulche',
        description: 'Two buttered kulchas with spiced chickpeas',
        price: 45,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#92400E',
        secondaryColor: '#FDE68A',
        isDrink: false,
      },
    ],
  },
  {
    id: 'lays_snacks',
    name: 'Lays & Crunch Corner',
    vendorName: 'Meena Didi',
    greeting: 'Crispy Lays packets and mela munchies here!',
    x: -26,
    z: 6,
    rotationY: Math.PI / 2,
    awningColorA: '#EAB308',
    awningColorB: '#DC2626',
    items: [
      {
        id: 'item_lays_magic',
        stallId: 'lays_snacks',
        name: 'Lays Magic Masala',
        description: 'Blue packet crunchy spiced potato chips',
        price: 20,
        visualType: 'packet',
        maxBites: 4,
        primaryColor: '#2563EB',
        secondaryColor: '#FACC15',
        isDrink: false,
      },
      {
        id: 'item_lays_classic',
        stallId: 'lays_snacks',
        name: 'Lays Classic Salted',
        description: 'Golden crisp salted potato chips packet',
        price: 20,
        visualType: 'packet',
        maxBites: 4,
        primaryColor: '#EAB308',
        secondaryColor: '#EF4444',
        isDrink: false,
      },
    ],
  },
  {
    id: 'appy_fizz',
    name: 'Appy Fizz Chill Bar',
    vendorName: 'Karan Bhaiya',
    greeting: 'Ice-cold sparkling Appy Fizz to refresh your walk!',
    x: -26,
    z: -2,
    rotationY: Math.PI / 2,
    awningColorA: '#991B1B',
    awningColorB: '#1E293B',
    items: [
      {
        id: 'item_appy_fizz',
        stallId: 'appy_fizz',
        name: 'Appy Fizz Sparkling Apple',
        description: 'Chilled sparkling apple drink bottle',
        price: 25,
        visualType: 'bottle',
        maxBites: 4,
        primaryColor: '#7F1D1D',
        secondaryColor: '#F59E0B',
        isDrink: true,
      },
    ],
  },
  {
    id: 'rasgulla',
    name: 'Bengali Rasgulla House',
    vendorName: 'Bimal Dada',
    greeting: 'Soft, juicy syrupy rasgullas fresh from the kadai!',
    x: -26,
    z: -10,
    rotationY: Math.PI / 2,
    awningColorA: '#F59E0B',
    awningColorB: '#FFF7ED',
    items: [
      {
        id: 'item_rasgulla',
        stallId: 'rasgulla',
        name: 'Royal Sponge Rasgulla',
        description: 'Snow-white chhena sweet soaked in rose syrup',
        price: 30,
        visualType: 'sweet',
        maxBites: 3,
        primaryColor: '#FFFBEB',
        secondaryColor: '#FDE68A',
        isDrink: false,
      },
    ],
  },
  {
    id: 'momos',
    name: 'Himalayan Momos',
    vendorName: 'Tenzing',
    greeting: 'Steaming hot momos with red chutney!',
    x: -26,
    z: -18,
    rotationY: Math.PI / 2,
    awningColorA: '#B91C1C',
    awningColorB: '#FEF08A',
    items: [
      {
        id: 'item_steamed_momos',
        stallId: 'momos',
        name: 'Steamed Veg Momos (6 pcs)',
        description: 'Warm dumplings served with mild tangy dip',
        price: 35,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#FEF9C3',
        secondaryColor: '#EF4444',
        isDrink: false,
      },
    ],
  },
  {
    id: 'golgappe',
    name: 'Chatpata Golgappe',
    vendorName: 'Gopal Uncle',
    greeting: 'Crunchy puris with mint & tamarind pani!',
    x: -38,
    z: 22,
    rotationY: -Math.PI / 2,
    awningColorA: '#16A34A',
    awningColorB: '#FDE047',
    items: [
      {
        id: 'item_golgappe',
        stallId: 'golgappe',
        name: 'Pani Puri / Golgappe',
        description: 'Crispy hollow puris filled with spiced potato & mint water',
        price: 25,
        visualType: 'plate',
        maxBites: 5,
        primaryColor: '#D97706',
        secondaryColor: '#22C55E',
        isDrink: false,
      },
    ],
  },
  {
    id: 'samosa',
    name: 'Golden Samosa Junction',
    vendorName: 'Sita Mausi',
    greeting: 'Crunchy triangular samosas with sweet imli chutney!',
    x: -38,
    z: 14,
    rotationY: -Math.PI / 2,
    awningColorA: '#D97706',
    awningColorB: '#FEF3C7',
    items: [
      {
        id: 'item_samosa',
        stallId: 'samosa',
        name: 'Crispy Punjabi Samosa',
        description: 'Flaky golden pastry filled with spiced potatoes & peas',
        price: 20,
        visualType: 'sweet',
        maxBites: 3,
        primaryColor: '#D97706',
        secondaryColor: '#16A34A',
        isDrink: false,
      },
    ],
  },
  {
    id: 'pizza',
    name: 'Carnival Slice Pizza',
    vendorName: 'Chef Arjun',
    greeting: 'Cheesy wood-fired carnival pizza slices!',
    x: -38,
    z: 6,
    rotationY: -Math.PI / 2,
    awningColorA: '#EF4444',
    awningColorB: '#FFFFFF',
    items: [
      {
        id: 'item_pizza',
        stallId: 'pizza',
        name: 'Paneer Margherita Slice',
        description: 'Melted mozzarella, paneer cubes & basil on crisp crust',
        price: 55,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#F59E0B',
        secondaryColor: '#DC2626',
        isDrink: false,
      },
    ],
  },
  {
    id: 'burger',
    name: 'Mela Smash Burger',
    vendorName: 'Vikram',
    greeting: 'Crunchy aloo tikki burgers made fresh!',
    x: -38,
    z: -2,
    rotationY: -Math.PI / 2,
    awningColorA: '#F97316',
    awningColorB: '#FEF08A',
    items: [
      {
        id: 'item_burger',
        stallId: 'burger',
        name: 'Aloo Tikki Crunch Burger',
        description: 'Toasted sesame bun with crispy patty & mint mayo',
        price: 45,
        visualType: 'sweet',
        maxBites: 4,
        primaryColor: '#D97706',
        secondaryColor: '#22C55E',
        isDrink: false,
      },
    ],
  },
  {
    id: 'ice_cream',
    name: 'Rainbow Scoop Parlour',
    vendorName: 'Ananya',
    greeting: 'Mango, strawberry and chocolate waffle cones!',
    x: -38,
    z: -10,
    rotationY: -Math.PI / 2,
    awningColorA: '#EC4899',
    awningColorB: '#FEF9C3',
    items: [
      {
        id: 'item_ice_cream_mango',
        stallId: 'ice_cream',
        name: 'Alphonso Mango Cone',
        description: 'Rich mango ice cream scoop in a crisp waffle cone',
        price: 30,
        visualType: 'cone',
        maxBites: 4,
        primaryColor: '#FBBF24',
        secondaryColor: '#D97706',
        isDrink: false,
      },
      {
        id: 'item_ice_cream_berry',
        stallId: 'ice_cream',
        name: 'Strawberry Swirl Cone',
        description: 'Sweet berry ice cream with rainbow sprinkles',
        price: 30,
        visualType: 'cone',
        maxBites: 4,
        primaryColor: '#F472B6',
        secondaryColor: '#D97706',
        isDrink: false,
      },
    ],
  },
  {
    id: 'cotton_candy',
    name: 'Cloud Nine Cotton Candy',
    vendorName: 'Priya Didi',
    greeting: 'Fluffy spun sugar clouds in pink & sky blue!',
    x: -38,
    z: -18,
    rotationY: -Math.PI / 2,
    awningColorA: '#F472B6',
    awningColorB: '#60A5FA',
    items: [
      {
        id: 'item_cotton_candy',
        stallId: 'cotton_candy',
        name: 'Pink Cloud Cotton Candy',
        description: 'Melt-in-mouth spun sugar candy on a festive stick',
        price: 25,
        visualType: 'floss',
        maxBites: 4,
        primaryColor: '#F472B6',
        secondaryColor: '#FBCFE8',
        isDrink: false,
      },
    ],
  },
  {
    id: 'cold_drinks',
    name: 'Nimbu & Cold Drinks',
    vendorName: 'Raju Bhai',
    greeting: 'Chilled mango fizz, cola and nimbu masala soda!',
    x: -32,
    z: -24,
    rotationY: 0,
    awningColorA: '#0EA5E9',
    awningColorB: '#FEF08A',
    items: [
      {
        id: 'item_nimbu_soda',
        stallId: 'cold_drinks',
        name: 'Masala Nimbu Soda',
        description: 'Sparkling lemon cooler with roasted jeera & ice',
        price: 20,
        visualType: 'cup',
        maxBites: 4,
        primaryColor: '#FEF08A',
        secondaryColor: '#22C55E',
        isDrink: true,
      },
      {
        id: 'item_mango_drink',
        stallId: 'cold_drinks',
        name: 'Chilled Mango Shake',
        description: 'Thick chilled Alphonso mango shake bottle',
        price: 30,
        visualType: 'bottle',
        maxBites: 4,
        primaryColor: '#F59E0B',
        secondaryColor: '#FDE68A',
        isDrink: true,
      },
    ],
  },
  {
    id: 'chowmein',
    name: 'Street Style Chowmein',
    vendorName: 'Sonu Chef',
    greeting: 'Sizzling wok-tossed carnival chowmein!',
    x: -32,
    z: 27,
    rotationY: Math.PI,
    awningColorA: '#DC2626',
    awningColorB: '#FBBF24',
    items: [
      {
        id: 'item_chowmein',
        stallId: 'chowmein',
        name: 'Desi Veg Chowmein',
        description: 'Smoky wok-tossed noodles with crunchy bell peppers',
        price: 40,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#F59E0B',
        secondaryColor: '#16A34A',
        isDrink: false,
      },
    ],
  },
  {
    id: 'jalebi',
    name: 'Shahi Jalebi & Rabri',
    vendorName: 'Halwai Shyam',
    greeting: 'Crispy saffron jalebis dipped warm in syrup!',
    x: -18,
    z: 10,
    rotationY: -Math.PI / 2,
    awningColorA: '#F59E0B',
    awningColorB: '#B91C1C',
    items: [
      {
        id: 'item_jalebi',
        stallId: 'jalebi',
        name: 'Kesariya Hot Jalebi',
        description: 'Golden crispy spirals soaked in saffron sugar syrup',
        price: 30,
        visualType: 'plate',
        maxBites: 4,
        primaryColor: '#F97316',
        secondaryColor: '#FDE047',
        isDrink: false,
      },
    ],
  },
];

export const FIREWORKS_STALL: FoodStallDef = {
  id: 'patakha_bazaar',
  name: 'Patakha & Skyshot Bazaar',
  vendorName: 'Bunty Bhaiya',
  greeting: 'Light up the sky with safe festival skyshots, chakras & crackers!',
  x: 13,
  z: 14,
  rotationY: -Math.PI * 0.75,
  awningColorA: '#7C3AED',
  awningColorB: '#FACC15',
  items: [
    {
      id: 'fw_tricolour_skyshot',
      stallId: 'patakha_bazaar',
      name: 'Tricolour Aerial Skyshot',
      description: 'Rockets high into the sky and bursts in saffron, white & green!',
      price: 30,
      visualType: 'firework',
      maxBites: 2,
      primaryColor: '#F97316',
      secondaryColor: '#22C55E',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'skyshot',
    },
    {
      id: 'fw_rainbow_barrage',
      stallId: 'patakha_bazaar',
      name: 'Rainbow 5-Shot Skyshot',
      description: 'Launches rapid multi-colour comets high over Central Plaza!',
      price: 50,
      visualType: 'firework',
      maxBites: 3,
      primaryColor: '#EC4899',
      secondaryColor: '#38BDF8',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'skyshot_multi',
    },
    {
      id: 'fw_golden_anar',
      stallId: 'patakha_bazaar',
      name: 'Golden Anar Fountain',
      description: 'Sprays a shimmering golden spark fountain right in front of you!',
      price: 25,
      visualType: 'firework',
      maxBites: 2,
      primaryColor: '#FACC15',
      secondaryColor: '#F97316',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'fountain',
    },
    {
      id: 'fw_peacock_chakra',
      stallId: 'patakha_bazaar',
      name: 'Peacock Ground Chakra',
      description: 'Spins on the ground throwing dazzling cyan & gold rings!',
      price: 20,
      visualType: 'firework',
      maxBites: 2,
      primaryColor: '#06B6D4',
      secondaryColor: '#FDE047',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'chakra',
    },
    {
      id: 'fw_ladi_crackers',
      stallId: 'patakha_bazaar',
      name: 'Mela Ladi Firecrackers',
      description: 'Pop-pop-pop! Rapid chain of bright festive firecracker sparkles!',
      price: 15,
      visualType: 'firework',
      maxBites: 3,
      primaryColor: '#EF4444',
      secondaryColor: '#FACC15',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'crackers',
    },
    {
      id: 'fw_sutli_bomb',
      stallId: 'patakha_bazaar',
      name: 'Sutli Bomb (Mega Dhamaka)',
      description: 'VIP heavy green-twine Sutli Bomb! Massive ground shockwave & mega boom!',
      price: 120,
      visualType: 'firework',
      maxBites: 1,
      primaryColor: '#16A34A',
      secondaryColor: '#DC2626',
      isDrink: false,
      category: 'firework',
      fireworkEffect: 'sutli',
    },
  ],
};

export const ALL_STALLS: FoodStallDef[] = [...FOOD_STALLS, FIREWORKS_STALL];
export const ALL_FOOD_ITEMS = FOOD_STALLS.flatMap((s) => s.items);
export const ALL_SHOP_ITEMS = ALL_STALLS.flatMap((s) => s.items);

export const TRAMPOLINE_PADS = [
  { id: 'tramp_1', x: 18, z: 20, radius: 2.3, color: '#EC4899' },
  { id: 'tramp_2', x: 24, z: 23, radius: 2.3, color: '#06B6D4' },
  { id: 'tramp_3', x: 18, z: 26, radius: 2.3, color: '#F59E0B' },
] as const;

export interface OutfitDef {
  id: OutfitId;
  name: string;
  category: 'traditional' | 'casual';
  defaultTop: string;
  defaultBottom: string;
  description: string;
}

export const OUTFIT_CATALOG: OutfitDef[] = [
  {
    id: 'kurta_saffron',
    name: 'Saffron Kurta Pajama',
    category: 'traditional',
    defaultTop: '#F59E0B',
    defaultBottom: '#FFFBEB',
    description: 'Bright marigold silk kurta with ivory churidar',
  },
  {
    id: 'kurta_peacock',
    name: 'Peacock Blue Kurta',
    category: 'traditional',
    defaultTop: '#0284C7',
    defaultBottom: '#F8FAFC',
    description: 'Royal peacock kurta with silver border trim',
  },
  {
    id: 'kurta_printed',
    name: 'Festive Block-Print Kurta',
    category: 'traditional',
    defaultTop: '#E11D48',
    defaultBottom: '#FEF3C7',
    description: 'Rajasthani patterned festive kurta',
  },
  {
    id: 'nehru_royal',
    name: 'Nehru Jacket Ensemble',
    category: 'traditional',
    defaultTop: '#1E3A5F',
    defaultBottom: '#F8FAFC',
    description: 'Crisp kurta layered with a tailored Nehru vest',
  },
  {
    id: 'sherwani_festive',
    name: 'Golden Festive Sherwani',
    category: 'traditional',
    defaultTop: '#B45309',
    defaultBottom: '#FEF3C7',
    description: 'Ceremonial embroidered jacket & traditional bottoms',
  },
  {
    id: 'tee_carnival',
    name: 'Carnival Graphic Tee',
    category: 'casual',
    defaultTop: '#10B981',
    defaultBottom: '#1E3A8A',
    description: 'Breathable cotton t-shirt with denim jeans',
  },
  {
    id: 'hoodie_sky',
    name: 'Starlight Hoodie',
    category: 'casual',
    defaultTop: '#7C3AED',
    defaultBottom: '#334155',
    description: 'Cozy festival hoodie with cargo trousers',
  },
  {
    id: 'jacket_sport',
    name: 'Varsity Sports Track',
    category: 'casual',
    defaultTop: '#DC2626',
    defaultBottom: '#1E293B',
    description: 'Athletic zip jacket built for the sports ground',
  },
];

export const SKIN_TONES = [
  { id: 'warm_ivory', name: 'Warm Ivory', hex: '#F4C9A8' },
  { id: 'wheatish', name: 'Golden Wheat', hex: '#E0A87E' },
  { id: 'honey', name: 'Honey Caramel', hex: '#C68652' },
  { id: 'almond', name: 'Toasted Almond', hex: '#9E6238' },
  { id: 'chestnut', name: 'Deep Chestnut', hex: '#6E3F22' },
];

export const HAIRSTYLES: { id: HairstyleId; name: string }[] = [
  { id: 'classic_short', name: 'Classic Crop' },
  { id: 'curly_puff', name: 'Curly Crown' },
  { id: 'twin_braids', name: 'Twin Braids' },
  { id: 'side_part', name: 'Sleek Side Part' },
  { id: 'festive_bun', name: 'Festive Top Bun' },
];

export const HAIR_COLORS = ['#1C1917', '#3F2718', '#6B3F22', '#B45309', '#4338CA'];

export const ACCESSORIES_CATALOG: { id: AccessoryId; name: string }[] = [
  { id: 'sunglasses', name: 'Cool Shades' },
  { id: 'cap', name: 'Carnival Cap' },
  { id: 'watch', name: 'Gold Watch' },
  { id: 'bracelet', name: 'Friendship Band' },
  { id: 'sneakers', name: 'Neon Sneakers' },
];

export const TOP_COLOR_SWATCHES = [
  '#F59E0B',
  '#DC2626',
  '#0284C7',
  '#10B981',
  '#7C3AED',
  '#EC4899',
  '#1E3A5F',
  '#B45309',
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skinTone: '#E0A87E',
  hairstyle: 'classic_short',
  hairColor: '#1C1917',
  outfit: 'kurta_saffron',
  topColor: '#F59E0B',
  bottomColor: '#FFFBEB',
  accessories: ['sneakers'],
};

export const DANCE_LIST: { id: DanceId; label: string; hotkey?: string; category: 'dance' | 'emote' }[] = [
  { id: 'normal_dance', label: 'Bhangra Groove', hotkey: '1', category: 'dance' },
  { id: 'funny_dance', label: 'Wiggle Hop', hotkey: '2', category: 'dance' },
  { id: 'celebration', label: 'Victory Spin', hotkey: '3', category: 'dance' },
  { id: 'jump_dance', label: 'Bolly Bounce', hotkey: '4', category: 'dance' },
  { id: 'robot_dance', label: 'Robot Lock', category: 'dance' },
  { id: 'victory_dance', label: 'Champion Twist', category: 'dance' },
  { id: 'wave', label: 'Friendly Wave', category: 'emote' },
  { id: 'clap', label: 'Big Applause', category: 'emote' },
  { id: 'laugh', label: 'Happy Laugh', category: 'emote' },
  { id: 'sit', label: 'Sit & Chill', category: 'emote' },
  { id: 'cheer', label: 'Stage Cheer', category: 'emote' },
];

export interface ArcadeGameDef {
  id: ArcadeGameId;
  name: string;
  tagline: string;
  supportsPvp: boolean;
  accent: string;
  category: 'midway' | 'indian' | 'arcade';
}

export const ARCADE_GAMES: ArcadeGameDef[] = [
  // 11 Classic Carnival Midway Games
  { id: 'ring_toss', name: 'Ring Toss (Hoopla)', tagline: 'Aim & toss colourful rings onto prize pegs', supportsPvp: false, accent: '#EC4899', category: 'midway' },
  { id: 'can_knockdown', name: 'Can Knockdown', tagline: 'Topple the metal can pyramid with heavy beanbags', supportsPvp: false, accent: '#EA580C', category: 'midway' },
  { id: 'balloon_pop', name: 'Balloon Pop Darts', tagline: 'Pop swaying carnival balloons before darts run out', supportsPvp: false, accent: '#EF4444', category: 'midway' },
  { id: 'duck_pond', name: 'Duck Pond Match', tagline: 'Pick swimming ducks to reveal hidden winning numbers', supportsPvp: false, accent: '#EAB308', category: 'midway' },
  { id: 'cup_ball_toss', name: 'Cup Ball Toss', tagline: 'Lob ping-pong balls into glowing bonus cups', supportsPvp: false, accent: '#06B6D4', category: 'midway' },
  { id: 'dunk_tank', name: 'Dunk Tank Splash', tagline: 'Strike the moving target to drop the clown in water', supportsPvp: false, accent: '#0284C7', category: 'midway' },
  { id: 'high_striker', name: 'High Striker Bell', tagline: 'Time your mallet swing to ring the top strength bell', supportsPvp: false, accent: '#B91C1C', category: 'midway' },
  { id: 'prize_wheel', name: 'Spin the Prize Wheel', tagline: 'Spin the giant wheel for jackpots & multiplier wedges', supportsPvp: false, accent: '#8B5CF6', category: 'midway' },
  { id: 'dart_game', name: 'Bullseye Darts', tagline: 'Steady your aim and land darts in the bullseye', supportsPvp: false, accent: '#10B981', category: 'midway' },
  { id: 'feed_the_clown', name: 'Feed the Clown', tagline: 'Toss balls right into the moving clown mouth target', supportsPvp: false, accent: '#F59E0B', category: 'midway' },
  { id: 'tp_toss', name: 'Toilet Paper Toss', tagline: 'Adjust for fan breeze and sink rolls into the bin', supportsPvp: false, accent: '#64748B', category: 'midway' },

  // 4 Indian Mela Games
  { id: 'matka_phod', name: 'Matka Phod (Dahi Handi)', tagline: 'Sling stones to crack swinging clay handis for treats', supportsPvp: false, accent: '#D97706', category: 'indian' },
  { id: 'kite_duel', name: 'Patang Kite Duel', tagline: 'Pull manjha & slice rival kites in the festival sky', supportsPvp: false, accent: '#F97316', category: 'indian' },
  { id: 'kancha_marbles', name: 'Kancha (Glass Marbles)', tagline: 'Flick your striker marble to knock kanchas out of the ring', supportsPvp: false, accent: '#14B8A6', category: 'indian' },
  { id: 'gilli_danda', name: 'Gilli Danda', tagline: 'Two-tap timing: pop the gilli & smash it far across the field', supportsPvp: false, accent: '#16A34A', category: 'indian' },

  // 10 Arcade Zone Games
  { id: 'memory_match', name: 'Memory Match', tagline: 'Flip & pair Indian carnival icons', supportsPvp: false, accent: '#F59E0B', category: 'arcade' },
  { id: 'tic_tac_toe', name: 'Tic Tac Toe', tagline: 'Challenge a room friend or Bot', supportsPvp: true, accent: '#DC2626', category: 'arcade' },
  { id: 'snake', name: 'Mela Snake', tagline: 'Collect ladoos without crashing', supportsPvp: false, accent: '#16A34A', category: 'arcade' },
  { id: 'whack_a_mole', name: 'Whack-a-Mole', tagline: 'Fast reflex carnival mallet', supportsPvp: false, accent: '#EA580C', category: 'arcade' },
  { id: 'reaction_speed', name: 'Reaction Speed', tagline: 'Tap the instant the lantern turns green', supportsPvp: false, accent: '#0284C7', category: 'arcade' },
  { id: 'number_puzzle', name: 'Number Puzzle', tagline: 'Slide tiles 1–15 into order', supportsPvp: false, accent: '#7C3AED', category: 'arcade' },
  { id: 'color_match', name: 'Colour Match', tagline: 'Match Rangoli ink vs word fast', supportsPvp: false, accent: '#EC4899', category: 'arcade' },
  { id: 'quick_maths', name: 'Quick Maths', tagline: 'Beat 30s arithmetic sprints', supportsPvp: false, accent: '#0D9488', category: 'arcade' },
  { id: 'word_guess', name: 'Word Guess', tagline: 'Guess festive 5-letter carnival words', supportsPvp: false, accent: '#D97706', category: 'arcade' },
  { id: 'mini_racing', name: 'Mini Racing', tagline: 'Dodge cones on the Mela Speedway', supportsPvp: false, accent: '#E11D48', category: 'arcade' },
];

export const DEFAULT_DJ_PLAYLIST: DjTrack[] = [
  { id: 'track_mela_dhol', title: 'Mela Dhol Fiesta', artist: 'Carnival Brass Collective', bpm: 124, keyHz: 261.63 },
  { id: 'track_childrens_day', title: 'Children’s Day Sunshine', artist: 'Lotus Beats', bpm: 118, keyHz: 293.66 },
  { id: 'track_garba_glow', title: 'Garba Glow Electro', artist: 'Saffron Synth', bpm: 128, keyHz: 329.63 },
  { id: 'track_starlight_party', title: 'Starlight Ferris Bounce', artist: 'DJ Baloo', bpm: 122, keyHz: 349.23 },
];

export interface NpcDefinition {
  id: string;
  name: string;
  role: 'security' | 'welcome' | 'ticket' | 'game_op' | 'announcer' | 'decorator';
  zone: ZoneId;
  x: number;
  z: number;
  patrolX?: number;
  patrolZ?: number;
  shirtColor: string;
  hatColor: string;
  dialogue: string[];
}

export const CARNIVAL_NPCS: NpcDefinition[] = [
  {
    id: 'npc_welcome_1',
    name: 'Asha Didi',
    role: 'welcome',
    zone: 'entrance',
    x: -4,
    z: 42,
    patrolX: -4,
    patrolZ: 36,
    shirtColor: '#F59E0B',
    hatColor: '#DC2626',
    dialogue: [
      'Happy Children’s Day! Welcome to the Grand Carnival!',
      'Visit Food Street on the left for Pav Bhaji, Golgappe & Appy Fizz!',
      'Press F5 anytime to switch camera views, or V to dance!',
    ],
  },
  {
    id: 'npc_ticket_1',
    name: 'Rohan Assistant',
    role: 'ticket',
    zone: 'entrance',
    x: 4.5,
    z: 42,
    shirtColor: '#0284C7',
    hatColor: '#FDE047',
    dialogue: [
      'Your Golden Mela Pass is active! Entry to all rides & games is free.',
      'Earn extra coins in Arcade Games and the Treasure Hunt!',
    ],
  },
  {
    id: 'npc_guard_1',
    name: 'Guard Vikram',
    role: 'security',
    zone: 'central_plaza',
    x: 11,
    z: 10,
    patrolX: 11,
    patrolZ: -8,
    shirtColor: '#1E3A5F',
    hatColor: '#0F172A',
    dialogue: [
      'Everything is safe and cheerful in the Central Plaza!',
      'Please keep chat kind and respectful for all friends.',
    ],
  },
  {
    id: 'npc_decorator_1',
    name: 'Maya Decorator',
    role: 'decorator',
    zone: 'central_plaza',
    x: -11,
    z: 8,
    patrolX: -11,
    patrolZ: -6,
    shirtColor: '#EC4899',
    hatColor: '#F59E0B',
    dialogue: [
      'We hung fresh marigold garlands and fairy lights across every stall!',
      'Look up at the Giant Ferris Wheel spinning over Central Plaza!',
    ],
  },
  {
    id: 'npc_game_op_1',
    name: 'Kabir Arcade Host',
    role: 'game_op',
    zone: 'arcade_zone',
    x: -24,
    z: -30,
    shirtColor: '#7C3AED',
    hatColor: '#38BDF8',
    dialogue: [
      'Step right up! We have 10 playable 2D arcade games inside the pavilion!',
      'Challenge a friend in Tic Tac Toe or top the room leaderboard!',
    ],
  },
  {
    id: 'npc_announcer_1',
    name: 'Meera MC',
    role: 'announcer',
    zone: 'celebration_stage',
    x: 28,
    z: -31,
    shirtColor: '#D97706',
    hatColor: '#FFFBEB',
    dialogue: [
      'Welcome to the Grand Celebration Stage! Watch out for fireworks & prize ceremonies!',
      'The Host can launch Group Dance & Prize Ceremonies from the Host Panel.',
    ],
  },
];

export const INITIAL_BALLS: BallState[] = [
  { id: 'ball_football_1', kind: 'football', x: 36, y: 0.45, z: 4, vx: 0, vy: 0, vz: 0, holderId: null, lastKickerId: null, updatedAt: 0 },
  { id: 'ball_football_2', kind: 'football', x: 31, y: 0.45, z: 9, vx: 0, vy: 0, vz: 0, holderId: null, lastKickerId: null, updatedAt: 0 },
  { id: 'ball_basketball_1', kind: 'basketball', x: 48, y: 0.45, z: -8, vx: 0, vy: 0, vz: 0, holderId: null, lastKickerId: null, updatedAt: 0 },
  { id: 'ball_beach_1', kind: 'beachball', x: 28, y: 0.5, z: 11, vx: 0, vy: 0, vz: 0, holderId: null, lastKickerId: null, updatedAt: 0 },
];

export const TREASURE_SPAWN_LOCATIONS: { id: string; label: string; x: number; y: number; z: number; rewardCoins: number }[] = [
  { id: 'tr_1', label: 'Golden Laddoo Box', x: -16, y: 0.6, z: 24, rewardCoins: 18 },
  { id: 'tr_2', label: 'Saffron Kite', x: 14, y: 0.6, z: 20, rewardCoins: 20 },
  { id: 'tr_3', label: 'Peacock Feather Crown', x: -34, y: 0.6, z: -28, rewardCoins: 25 },
  { id: 'tr_4', label: 'Silver Diya Lantern', x: 44, y: 0.6, z: 18, rewardCoins: 22 },
  { id: 'tr_5', label: 'Marigold Trophy Gem', x: 16, y: 0.6, z: -38, rewardCoins: 28 },
  { id: 'tr_6', label: 'Starlight Whistle', x: -6, y: 0.6, z: -44, rewardCoins: 24 },
  { id: 'tr_7', label: 'Carnival Mystery Chest', x: 0, y: 0.6, z: 54, rewardCoins: 35 },
];

export const BADGE_TITLES = [
  'Carnival Champion',
  'Parkour Master',
  'Food Lover',
  'Dance King',
  'Football Star',
  'Treasure Hunter',
  'Arcade Champion',
  'Best Team Player',
] as const;

export const INITIAL_COINS = 250;
