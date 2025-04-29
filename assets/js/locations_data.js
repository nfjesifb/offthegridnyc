const locations = [
  {
    "name": "Elevated Acre",
    "lat": 40.7033047,
    "lng": -74.0086169,
    "description": "A one-acre elevated public park located in Manhattan's Financial District, offering green space, seating, and views of the East River.",
    "slug": "elevated-acre",
    "thumbnailUrl": "/locations/elevated-acre/images/photo_1.jpg"
  },
  {
    "name": "Wallabout Hasidic Compound",
    "lat": 40.7012609,
    "lng": -73.9495343,
    "description": "A large housing development in the Wallabout neighborhood of Brooklyn, primarily serving the Hasidic community.",
    "slug": "wallabout-hasidic-compound",
    "thumbnailUrl": "/locations/wallabout-hasidic-compound/images/photo_1.jpg"
  },
  {
    "name": "Mott Haven Water Front",
    "lat": 40.8074399,
    "lng": -73.9311497,
    "description": "A revitalized waterfront area in the Mott Haven neighborhood of the Bronx, featuring parks and recreational spaces.",
    "slug": "mott-haven-water-front",
    "thumbnailUrl": "/locations/mott-haven-water-front/images/photo_1.jpg"
  },
  {
    "name": "Brooklyn Navy Yard",
    "lat": 40.6991147,
    "lng": -73.9728531,
    "description": "A historic shipyard and industrial complex located in Brooklyn, now repurposed as a hub for manufacturing, technology, and creative industries.",
    "slug": "brooklyn-navy-yard",
    "thumbnailUrl": "/locations/brooklyn-navy-yard/images/photo_1.jpg"
  },
  {
    "name": "Brooklyn Bridge Parks",
    "lat": 40.7018997,
    "lng": -73.9961015,
    "description": "A series of parks and recreational areas along the Brooklyn waterfront, connected by the iconic Brooklyn Bridge.",
    "slug": "brooklyn-bridge-parks",
    "thumbnailUrl": "/locations/brooklyn-bridge-parks/images/photo_1.jpg"
  },
  {
    "name": "Govoners Island",
    "lat": 40.6892172,
    "lng": -74.0185413,
    "description": "A 172-acre island in New York Harbor, formerly a military base and now a public park and cultural venue.",
    "slug": "govoners-island",
    "thumbnailUrl": "/locations/govoners-island/images/photo_1.jpg"
  },
  {
    "name": "Track on the roof",
    "lat": 40.7748443,
    "lng": -73.9814742,
    "description": "No description available.",
    "slug": "track-on-the-roof",
    "thumbnailUrl": "/locations/track-on-the-roof/images/photo_1.jpg"
  },
  {
    "name": "SkyTrack",
    "lat": 40.6879331,
    "lng": -73.9918461,
    "description": "A rooftop jogging track located on a building in Manhattan, offering a unique urban fitness experience.",
    "slug": "skytrack",
    "thumbnailUrl": "/locations/skytrack/images/photo_1.jpg"
  },
  {
    "name": "Sky Port",
    "lat": 40.7355885,
    "lng": -73.9744233,
    "description": "A heliport located on the East River in Manhattan, providing helicopter services and scenic tours.",
    "slug": "sky-port",
    "thumbnailUrl": "/locations/sky-port/images/photo_1.jpg"
  },
  {
    "name": "Commandants Mansion",
    "lat": 40.7023811,
    "lng": -73.9803764,
    "description": "A historic residence located on Governors Island, once home to military commanders.",
    "slug": "commandants-mansion",
    "thumbnailUrl": "/locations/commandants-mansion/images/photo_1.jpg"
  },
  {
    "name": "Cliff House (Pumpkin House)",
    "lat": 40.8549866,
    "lng": -73.9395154,
    "description": "A unique residential building in Manhattan, known for its distinctive appearance and location on a cliff.",
    "slug": "cliff-house-pumpkin-house",
    "thumbnailUrl": "/locations/cliff-house-pumpkin-house/images/photo_1.jpg"
  },
  {
    "name": "Sullivan Street",
    "lat": 40.7284723,
    "lng": -74.0012998,
    "description": "A street in Manhattan's Greenwich Village, known for its historic buildings and communal garden.",
    "slug": "sullivan-street",
    "thumbnailUrl": "/locations/sullivan-street/images/photo_1.jpg"
  },
  {
    "name": "210 W 90th (Astor Court)",
    "lat": 40.7903112,
    "lng": -73.9742209,
    "description": "A residential building on the Upper West Side of Manhattan, featuring a central courtyard.",
    "slug": "210-w-90th-astor-court",
    "thumbnailUrl": "/locations/210-w-90th-astor-court/images/photo_1.jpg"
  },
  {
    "name": "Ansonia Clock Factory",
    "lat": 40.6646062,
    "lng": -73.9829468,
    "description": "A historic building in Brooklyn, originally a factory for the Ansonia Clock Company.",
    "slug": "ansonia-clock-factory",
    "thumbnailUrl": null
  },
  {
    "name": "Stuy Town",
    "lat": 40.7318054,
    "lng": -73.9778906,
    "description": "A large residential complex in Manhattan, known for its extensive green spaces and community amenities.",
    "slug": "stuy-town",
    "thumbnailUrl": "/locations/stuy-town/images/photo_1.jpg"
  },
  {
    "name": "Sutton Square",
    "lat": 40.7574713,
    "lng": -73.9598883,
    "description": "A private enclave of townhouses located in the Sutton Place neighborhood of Manhattan.",
    "slug": "sutton-square",
    "thumbnailUrl": "/locations/sutton-square/images/photo_1.jpg"
  },
  {
    "name": "Strivers Row",
    "lat": 40.8175433,
    "lng": -73.9439576,
    "description": "A historic district in Harlem, known for its well-preserved row houses and cultural significance.",
    "slug": "strivers-row",
    "thumbnailUrl": "/locations/strivers-row/images/photo_1.jpg"
  },
  {
    "name": "Waterside",
    "lat": 40.7374817,
    "lng": -73.9732056,
    "description": "A residential complex located along the East River in Manhattan, offering waterfront living.",
    "slug": "waterside",
    "thumbnailUrl": "/locations/waterside/images/photo_1.jpg"
  },
  {
    "name": "Knickerbocker Village",
    "lat": 40.7108205,
    "lng": -73.9960392,
    "description": "A historic housing complex in Manhattan's Lower East Side, known for its early adoption of modern housing concepts.",
    "slug": "knickerbocker-village",
    "thumbnailUrl": "/locations/knickerbocker-village/images/photo_1.jpg"
  },
  {
    "name": "116 Pinehurst",
    "lat": 40.8539663,
    "lng": -73.9389458,
    "description": "A residential building located in the Washington Heights neighborhood of Manhattan.",
    "slug": "116-pinehurst",
    "thumbnailUrl": "/locations/116-pinehurst/images/photo_1.jpg"
  },
  {
    "name": "South Bridge Towers",
    "lat": 40.7094761,
    "lng": -74.0042551,
    "description": "A cooperative housing complex located near the South Street Seaport in Manhattan.",
    "slug": "south-bridge-towers",
    "thumbnailUrl": "/locations/south-bridge-towers/images/photo_1.jpg"
  },
  {
    "name": "Kips Bay Towers",
    "lat": 40.7426759,
    "lng": -73.9758258,
    "description": "A pair of residential towers located in the Kips Bay neighborhood of Manhattan, known for their modernist architecture.",
    "slug": "kips-bay-towers",
    "thumbnailUrl": "/locations/kips-bay-towers/images/photo_1.jpg"
  },
  {
    "name": "Grove Court",
    "lat": 40.7320619,
    "lng": -74.0058125,
    "description": "A hidden courtyard of six townhouses located in Greenwich Village, Manhattan.",
    "slug": "grove-court",
    "thumbnailUrl": "/locations/grove-court/images/photo_1.jpg"
  },
  {
    "name": "Patchin Place",
    "lat": 40.7351334,
    "lng": -73.9993554,
    "description": "A small, gated alley in Greenwich Village, lined with historic townhouses.",
    "slug": "patchin-place",
    "thumbnailUrl": null
  },
  {
    "name": "Milligan Place",
    "lat": 40.7351299,
    "lng": -73.9988065,
    "description": "A tiny, triangular courtyard in Greenwich Village, featuring four townhouses.",
    "slug": "milligan-place",
    "thumbnailUrl": null
  },
  {
    "name": "Pomander Walk",
    "lat": 40.7939961,
    "lng": -73.9733071,
    "description": "A Tudor-style residential complex located on the Upper West Side of Manhattan.",
    "slug": "pomander-walk",
    "thumbnailUrl": "/locations/pomander-walk/images/photo_1.jpg"
  },
  {
    "name": "Washington Mews",
    "lat": 40.7315753,
    "lng": -73.9959466,
    "description": "A private street in Greenwich Village, originally built as stables for nearby townhouses.",
    "slug": "washington-mews",
    "thumbnailUrl": "/locations/washington-mews/images/photo_1.jpg"
  },
  {
    "name": "Sylvan Court",
    "lat": 40.801804,
    "lng": -73.9384614,
    "description": "No description available.",
    "slug": "sylvan-court",
    "thumbnailUrl": null
  },
  {
    "name": "Warren Place Mews",
    "lat": 40.6879287,
    "lng": -73.9984916,
    "description": "A historic row of cottages in Cobble Hill, Brooklyn, designed for working-class families.",
    "slug": "warren-place-mews",
    "thumbnailUrl": null
  },
  {
    "name": "Sylvan Terrace",
    "lat": 40.8347234,
    "lng": -73.9393878,
    "description": "A cobblestone street in Washington Heights, lined with wooden row houses.",
    "slug": "sylvan-terrace",
    "thumbnailUrl": "/locations/sylvan-terrace/images/photo_1.jpg"
  },
  {
    "name": "Riverview Terrace",
    "lat": 40.7579249,
    "lng": -73.9593522,
    "description": "No description available.",
    "slug": "riverview-terrace",
    "thumbnailUrl": null
  },
  {
    "name": "Greenwich Mews",
    "lat": 40.7333401,
    "lng": -74.0071101,
    "description": "No description available.",
    "slug": "greenwich-mews",
    "thumbnailUrl": "/locations/greenwich-mews/images/photo_1.jpg"
  },
  {
    "name": "Sniffen Court",
    "lat": 40.7470204,
    "lng": -73.9780114,
    "description": "A small, private alley in Murray Hill, Manhattan, featuring Romanesque Revival-style carriage houses.",
    "slug": "sniffen-court",
    "thumbnailUrl": null
  },
  {
    "name": "Chester Court",
    "lat": 40.6583386,
    "lng": -73.9613947,
    "description": "No description available.",
    "slug": "chester-court",
    "thumbnailUrl": null
  },
  {
    "name": "Clinton Court",
    "lat": 40.76128,
    "lng": -73.9921142,
    "description": "No description available.",
    "slug": "clinton-court",
    "thumbnailUrl": "/locations/clinton-court/images/photo_1.jpg"
  },
  {
    "name": "Henderson Place",
    "lat": 40.7755536,
    "lng": -73.9449743,
    "description": "A historic district in the Upper East Side of Manhattan, featuring Queen Anne-style row houses.",
    "slug": "henderson-place",
    "thumbnailUrl": "/locations/henderson-place/images/photo_1.jpg"
  },
  {
    "name": "Ablemarle Terrace",
    "lat": 40.6486124,
    "lng": -73.9592343,
    "description": "No description available.",
    "slug": "ablemarle-terrace",
    "thumbnailUrl": null
  },
  {
    "name": "Barwell Terrace",
    "lat": 40.6150808,
    "lng": -74.0334827,
    "description": "No description available.",
    "slug": "barwell-terrace",
    "thumbnailUrl": null
  },
  {
    "name": "Madeline Court",
    "lat": 40.6368416,
    "lng": -74.0275419,
    "description": "No description available.",
    "slug": "madeline-court",
    "thumbnailUrl": null
  },
  {
    "name": "Hamilton Walk",
    "lat": 40.617658,
    "lng": -74.0321126,
    "description": "No description available.",
    "slug": "hamilton-walk",
    "thumbnailUrl": null
  },
  {
    "name": "Lafayette Walk",
    "lat": 40.6174686,
    "lng": -74.0316834,
    "description": "No description available.",
    "slug": "lafayette-walk",
    "thumbnailUrl": null
  },
  {
    "name": "Colonial Gardens",
    "lat": 40.6225689,
    "lng": -74.0395689,
    "description": "No description available.",
    "slug": "colonial-gardens",
    "thumbnailUrl": null
  },
  {
    "name": "Kenmore Terrace",
    "lat": 40.6492046,
    "lng": -73.9593604,
    "description": "No description available.",
    "slug": "kenmore-terrace",
    "thumbnailUrl": null
  },
  {
    "name": "Temple Court",
    "lat": 40.6557988,
    "lng": -73.9745873,
    "description": "No description available.",
    "slug": "temple-court",
    "thumbnailUrl": "/locations/temple-court/images/photo_1.jpg"
  },
  {
    "name": "Dennett Place",
    "lat": 40.6765077,
    "lng": -73.9975594,
    "description": "A small, historic street in Carroll Gardens, Brooklyn, known for its charming row houses.",
    "slug": "dennett-place",
    "thumbnailUrl": null
  },
  {
    "name": "Grace Court",
    "lat": 40.6943062,
    "lng": -73.9976479,
    "description": "A quiet, dead-end street in Brooklyn Heights, lined with historic townhouses.",
    "slug": "grace-court",
    "thumbnailUrl": null
  },
  {
    "name": "Indian Road",
    "lat": 40.8721217,
    "lng": -73.9196605,
    "description": "A scenic road located in Inwood, Manhattan, offering views of the Hudson River.",
    "slug": "indian-road",
    "thumbnailUrl": null
  },
  {
    "name": "Little/Evans Street",
    "lat": 40.7030725,
    "lng": -73.9803093,
    "description": "A pair of narrow, historic streets in the Vinegar Hill neighborhood of Brooklyn.",
    "slug": "littleevans-street",
    "thumbnailUrl": null
  },
  {
    "name": "Grace Court Alley",
    "lat": 40.6938832,
    "lng": -73.9957757,
    "description": "A hidden alley in Brooklyn Heights, featuring converted carriage houses.",
    "slug": "grace-court-alley",
    "thumbnailUrl": "/locations/grace-court-alley/images/photo_1.jpg"
  },
  {
    "name": "Hunts Lane",
    "lat": 40.6934724,
    "lng": -73.9941074,
    "description": "A small, historic lane in Brooklyn Heights, known for its charming residences.",
    "slug": "hunts-lane",
    "thumbnailUrl": null
  },
  {
    "name": "College Place",
    "lat": 40.6965814,
    "lng": -73.9943281,
    "description": "A short, dead-end street in Brooklyn Heights, offering a peaceful retreat.",
    "slug": "college-place",
    "thumbnailUrl": null
  },
  {
    "name": "Hamilton Terrace",
    "lat": 40.8228782,
    "lng": -73.9464374,
    "description": "A residential street in Hamilton Heights, Manhattan, known for its elegant townhouses.",
    "slug": "hamilton-terrace",
    "thumbnailUrl": null
  },
  {
    "name": "Verandah Place",
    "lat": 40.6881867,
    "lng": -73.9964295,
    "description": "A narrow, historic street in Cobble Hill, Brooklyn, featuring small row houses.",
    "slug": "verandah-place",
    "thumbnailUrl": null
  },
  {
    "name": "Chittenden Road",
    "lat": 40.8554451,
    "lng": -73.9390084,
    "description": "A street in Washington Heights, offering views of the Hudson River.",
    "slug": "chittenden-road",
    "thumbnailUrl": "/locations/chittenden-road/images/photo_1.jpg"
  },
  {
    "name": "Marble Hill",
    "lat": 40.8757049,
    "lng": -73.9115166,
    "description": "A neighborhood in the northern part of Manhattan, known for its suburban feel.",
    "slug": "marble-hill",
    "thumbnailUrl": "/locations/marble-hill/images/photo_1.jpg"
  },
  {
    "name": "Freeman Alley",
    "lat": 40.7218056,
    "lng": -73.9925468,
    "description": "A small, graffiti-covered alley in the Lower East Side of Manhattan.",
    "slug": "freeman-alley",
    "thumbnailUrl": "/locations/freeman-alley/images/photo_1.jpg"
  },
  {
    "name": "Broadway Between 40th and 17th",
    "lat": 40.7525651,
    "lng": -73.987471,
    "description": "A section of Broadway in Manhattan, known for its pedestrian-friendly design and public spaces.",
    "slug": "broadway-between-40th-and-17th",
    "thumbnailUrl": "/locations/broadway-between-40th-and-17th/images/photo_1.jpg"
  },
  {
    "name": "Doyer Street",
    "lat": 40.7145149,
    "lng": -73.9981452,
    "description": "A historic street in Chinatown, Manhattan, known for its sharp bend and cultural significance.",
    "slug": "doyer-street",
    "thumbnailUrl": "/locations/doyer-street/images/photo_1.jpg"
  },
  {
    "name": "46A Prospect Park Southwest",
    "lat": 40.6593121,
    "lng": -73.9771148,
    "description": "No description available.",
    "slug": "46a-prospect-park-southwest",
    "thumbnailUrl": null
  },
  {
    "name": "301 Greene Ave",
    "lat": 40.6878609,
    "lng": -73.9593718,
    "description": "No description available.",
    "slug": "301-greene-ave",
    "thumbnailUrl": null
  },
  {
    "name": "129 Degraw ABCD",
    "lat": 40.685794,
    "lng": -74.0018464,
    "description": "No description available.",
    "slug": "129-degraw-abcd",
    "thumbnailUrl": null
  },
  {
    "name": "117 Underhill Avenue",
    "lat": 40.6772844,
    "lng": -73.9653462,
    "description": "No description available.",
    "slug": "117-underhill-avenue",
    "thumbnailUrl": null
  },
  {
    "name": "48 Tiffany Place",
    "lat": 40.6860808,
    "lng": -74.0015567,
    "description": "No description available.",
    "slug": "48-tiffany-place",
    "thumbnailUrl": null
  },
  {
    "name": "158 Prospect Place",
    "lat": 40.6778346,
    "lng": -73.9716971,
    "description": "No description available.",
    "slug": "158-prospect-place",
    "thumbnailUrl": null
  },
  {
    "name": "5 Carmine St ABC",
    "lat": 40.7308213,
    "lng": -74.0021932,
    "description": "No description available.",
    "slug": "5-carmine-st-abc",
    "thumbnailUrl": "/locations/5-carmine-st-abc/images/photo_1.jpg"
  },
  {
    "name": "34 Strong Place",
    "lat": 40.6855823,
    "lng": -73.9981886,
    "description": "No description available.",
    "slug": "34-strong-place",
    "thumbnailUrl": null
  },
  {
    "name": "46 7th Ave",
    "lat": 40.7313394,
    "lng": -74.0043972,
    "description": "No description available.",
    "slug": "46-7th-ave",
    "thumbnailUrl": null
  },
  {
    "name": "10 Bedford St",
    "lat": 40.7291162,
    "lng": -74.0031112,
    "description": "No description available.",
    "slug": "10-bedford-st",
    "thumbnailUrl": null
  },
  {
    "name": "Roof Top Cape Cod",
    "lat": 40.7234933,
    "lng": -73.9886127,
    "description": "No description available.",
    "slug": "roof-top-cape-cod",
    "thumbnailUrl": "/locations/roof-top-cape-cod/images/photo_1.jpg"
  },
  {
    "name": "1288 Prospect Place",
    "lat": 40.6730685,
    "lng": -73.9344064,
    "description": "No description available.",
    "slug": "1288-prospect-place",
    "thumbnailUrl": null
  },
  {
    "name": "Maple Street",
    "lat": 40.660357,
    "lng": -73.9587125,
    "description": "A street in the Prospect Lefferts Gardens neighborhood of Brooklyn, known for its historic homes.",
    "slug": "maple-street",
    "thumbnailUrl": "/locations/maple-street/images/photo_1.jpg"
  },
  {
    "name": "Ditmas Park",
    "lat": 40.6465746,
    "lng": -73.9667459,
    "description": "A neighborhood in Brooklyn known for its large, Victorian-style homes and tree-lined streets.",
    "slug": "ditmas-park",
    "thumbnailUrl": "/locations/ditmas-park/images/photo_1.jpg"
  },
  {
    "name": "Forest Hills",
    "lat": 40.7195745,
    "lng": -73.8449253,
    "description": "A neighborhood in Queens, known for its Tudor-style homes and the historic Forest Hills Gardens.",
    "slug": "forest-hills",
    "thumbnailUrl": "/locations/forest-hills/images/photo_1.jpg"
  },
  {
    "name": "Riverdale",
    "lat": 40.8935758,
    "lng": -73.9068976,
    "description": "A residential neighborhood in the Bronx, known for its hilly terrain and upscale homes.",
    "slug": "riverdale",
    "thumbnailUrl": "/locations/riverdale/images/photo_1.jpg"
  },
  {
    "name": "Charlotte Gardens",
    "lat": 40.8342736,
    "lng": -73.892205,
    "description": "A housing development in the South Bronx, known for its suburban-style homes.",
    "slug": "charlotte-gardens",
    "thumbnailUrl": "/locations/charlotte-gardens/images/photo_1.jpg"
  },
  {
    "name": "30-36 Remsen",
    "lat": 40.6944148,
    "lng": -73.9974074,
    "description": "No description available.",
    "slug": "30-36-remsen",
    "thumbnailUrl": null
  },
  {
    "name": "46-58 Remsen",
    "lat": 40.6942521,
    "lng": -73.9967287,
    "description": "No description available.",
    "slug": "46-58-remsen",
    "thumbnailUrl": null
  },
  {
    "name": "245 Washington Ave",
    "lat": 40.6914085,
    "lng": -73.966115,
    "description": "No description available.",
    "slug": "245-washington-ave",
    "thumbnailUrl": null
  },
  {
    "name": "246 Washington Ave",
    "lat": 40.6911636,
    "lng": -73.9668614,
    "description": "No description available.",
    "slug": "246-washington-ave",
    "thumbnailUrl": null
  },
  {
    "name": "280 Washington Ave",
    "lat": 40.6903082,
    "lng": -73.9666332,
    "description": "No description available.",
    "slug": "280-washington-ave",
    "thumbnailUrl": null
  },
  {
    "name": "193 Prospect Place",
    "lat": 40.6781787,
    "lng": -73.9700769,
    "description": "No description available.",
    "slug": "193-prospect-place",
    "thumbnailUrl": null
  }
];