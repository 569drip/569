/* ============================================================
   V.VI.IX — region badge
   ------------------------------------------------------------
   Shows "V.VI.IX 🇨🇦 Canada" in the header.

   Detection is 100% client-side. We read the browser's IANA time
   zone and map it to a country, falling back to the region subtag
   of navigator.language. No IP lookup, no third-party request,
   nothing about the visitor leaves their machine — which also means
   no API key, no rate limit, no adblocker breakage, and no latency.

   Accuracy: time zone is right for the large majority of visitors.
   It misses people on a VPN or a manually-set clock. If you later
   host behind Cloudflare/Vercel, prefer the edge country header
   (CF-IPCountry / x-vercel-ip-country) and set:

       <script>window.VVIIX_COUNTRY = "CA";</script>

   before this file — an explicit value always wins.
   ============================================================ */
(function () {
  "use strict";

  var STORE = "vviix.region.v1";

  /* ---------- IANA time zone → ISO 3166-1 alpha-2 ----------
     Written country-first because that's how it stays maintainable;
     inverted into a lookup below. Covers every populated zone. */
  var BY_COUNTRY = {
    AD:"Europe/Andorra", AE:"Asia/Dubai", AF:"Asia/Kabul",
    AL:"Europe/Tirane", AM:"Asia/Yerevan", AO:"Africa/Luanda",
    AR:"America/Argentina/Buenos_Aires America/Argentina/Cordoba America/Argentina/Mendoza America/Argentina/Salta America/Argentina/Tucuman America/Argentina/Jujuy America/Argentina/San_Juan America/Argentina/San_Luis America/Argentina/Catamarca America/Argentina/La_Rioja America/Argentina/Rio_Gallegos America/Argentina/Ushuaia",
    AT:"Europe/Vienna", AU:"Australia/Sydney Australia/Melbourne Australia/Brisbane Australia/Perth Australia/Adelaide Australia/Hobart Australia/Darwin Australia/Canberra Australia/Broken_Hill Australia/Lindeman Australia/Lord_Howe Australia/Eucla Antarctica/Macquarie",
    AZ:"Asia/Baku", BA:"Europe/Sarajevo", BB:"America/Barbados",
    BD:"Asia/Dhaka", BE:"Europe/Brussels", BF:"Africa/Ouagadougou",
    BG:"Europe/Sofia", BH:"Asia/Bahrain", BI:"Africa/Bujumbura",
    BJ:"Africa/Porto-Novo", BM:"Atlantic/Bermuda", BN:"Asia/Brunei",
    BO:"America/La_Paz", BR:"America/Sao_Paulo America/Bahia America/Fortaleza America/Recife America/Belem America/Manaus America/Cuiaba America/Campo_Grande America/Porto_Velho America/Rio_Branco America/Boa_Vista America/Santarem America/Maceio America/Araguaina America/Eirunepe America/Noronha",
    BS:"America/Nassau", BT:"Asia/Thimphu", BW:"Africa/Gaborone",
    BY:"Europe/Minsk", BZ:"America/Belize",
    CA:"America/Toronto America/Vancouver America/Edmonton America/Winnipeg America/Halifax America/St_Johns America/Regina America/Montreal America/Moncton America/Glace_Bay America/Goose_Bay America/Whitehorse America/Yellowknife America/Dawson_Creek America/Dawson America/Inuvik America/Iqaluit America/Rankin_Inlet America/Resolute America/Cambridge_Bay America/Creston America/Fort_Nelson America/Nipigon America/Rainy_River America/Thunder_Bay America/Atikokan America/Blanc-Sablon America/Swift_Current America/Pangnirtung America/Coral_Harbour",
    CD:"Africa/Kinshasa Africa/Lubumbashi", CF:"Africa/Bangui",
    CG:"Africa/Brazzaville", CH:"Europe/Zurich", CI:"Africa/Abidjan",
    CL:"America/Santiago Pacific/Easter America/Punta_Arenas America/Coyhaique",
    CM:"Africa/Douala", CN:"Asia/Shanghai Asia/Urumqi Asia/Chongqing Asia/Harbin Asia/Kashgar",
    CO:"America/Bogota", CR:"America/Costa_Rica", CU:"America/Havana",
    CV:"Atlantic/Cape_Verde", CY:"Asia/Nicosia Asia/Famagusta",
    CZ:"Europe/Prague", DE:"Europe/Berlin Europe/Busingen",
    DJ:"Africa/Djibouti", DK:"Europe/Copenhagen", DO:"America/Santo_Domingo",
    DZ:"Africa/Algiers", EC:"America/Guayaquil Pacific/Galapagos",
    EE:"Europe/Tallinn", EG:"Africa/Cairo", ER:"Africa/Asmara Africa/Asmera",
    ES:"Europe/Madrid Atlantic/Canary Africa/Ceuta", ET:"Africa/Addis_Ababa",
    FI:"Europe/Helsinki", FJ:"Pacific/Fiji", FO:"Atlantic/Faroe Atlantic/Faeroe",
    FR:"Europe/Paris", GA:"Africa/Libreville",
    GB:"Europe/London", GE:"Asia/Tbilisi", GF:"America/Cayenne",
    GH:"Africa/Accra", GI:"Europe/Gibraltar", GL:"America/Nuuk America/Godthab America/Danmarkshavn America/Scoresbysund America/Thule",
    GM:"Africa/Banjul", GN:"Africa/Conakry", GP:"America/Guadeloupe",
    GQ:"Africa/Malabo", GR:"Europe/Athens", GT:"America/Guatemala",
    GU:"Pacific/Guam", GW:"Africa/Bissau", GY:"America/Guyana",
    HK:"Asia/Hong_Kong", HN:"America/Tegucigalpa", HR:"Europe/Zagreb",
    HT:"America/Port-au-Prince", HU:"Europe/Budapest",
    ID:"Asia/Jakarta Asia/Makassar Asia/Jayapura Asia/Pontianak",
    IE:"Europe/Dublin", IL:"Asia/Jerusalem Asia/Tel_Aviv",
    IN:"Asia/Kolkata Asia/Calcutta", IQ:"Asia/Baghdad", IR:"Asia/Tehran",
    IS:"Atlantic/Reykjavik", IT:"Europe/Rome", JM:"America/Jamaica",
    JO:"Asia/Amman", JP:"Asia/Tokyo", KE:"Africa/Nairobi",
    KG:"Asia/Bishkek", KH:"Asia/Phnom_Penh", KR:"Asia/Seoul",
    KW:"Asia/Kuwait", KZ:"Asia/Almaty Asia/Aqtobe Asia/Aqtau Asia/Atyrau Asia/Oral Asia/Qostanay Asia/Qyzylorda",
    LA:"Asia/Vientiane", LB:"Asia/Beirut", LI:"Europe/Vaduz",
    LK:"Asia/Colombo", LR:"Africa/Monrovia", LS:"Africa/Maseru",
    LT:"Europe/Vilnius", LU:"Europe/Luxembourg", LV:"Europe/Riga",
    LY:"Africa/Tripoli", MA:"Africa/Casablanca", MC:"Europe/Monaco",
    MD:"Europe/Chisinau", ME:"Europe/Podgorica", MG:"Indian/Antananarivo",
    MK:"Europe/Skopje", ML:"Africa/Bamako", MM:"Asia/Yangon Asia/Rangoon",
    MN:"Asia/Ulaanbaatar Asia/Hovd Asia/Choibalsan", MO:"Asia/Macau",
    MQ:"America/Martinique", MR:"Africa/Nouakchott", MT:"Europe/Malta",
    MU:"Indian/Mauritius", MV:"Indian/Maldives", MW:"Africa/Blantyre",
    MX:"America/Mexico_City America/Tijuana America/Monterrey America/Cancun America/Merida America/Chihuahua America/Hermosillo America/Mazatlan America/Matamoros America/Ojinaga America/Bahia_Banderas America/Ciudad_Juarez",
    MY:"Asia/Kuala_Lumpur Asia/Kuching", MZ:"Africa/Maputo",
    NA:"Africa/Windhoek", NC:"Pacific/Noumea", NE:"Africa/Niamey",
    NG:"Africa/Lagos", NI:"America/Managua", NL:"Europe/Amsterdam",
    NO:"Europe/Oslo", NP:"Asia/Kathmandu Asia/Katmandu", NZ:"Pacific/Auckland Pacific/Chatham",
    OM:"Asia/Muscat", PA:"America/Panama", PE:"America/Lima",
    PF:"Pacific/Tahiti Pacific/Marquesas Pacific/Gambier",
    PG:"Pacific/Port_Moresby Pacific/Bougainville", PH:"Asia/Manila",
    PK:"Asia/Karachi", PL:"Europe/Warsaw", PR:"America/Puerto_Rico",
    PS:"Asia/Gaza Asia/Hebron", PT:"Europe/Lisbon Atlantic/Azores Atlantic/Madeira",
    PY:"America/Asuncion", QA:"Asia/Qatar", RE:"Indian/Reunion",
    RO:"Europe/Bucharest", RS:"Europe/Belgrade",
    RU:"Europe/Moscow Asia/Yekaterinburg Asia/Novosibirsk Asia/Krasnoyarsk Asia/Irkutsk Asia/Yakutsk Asia/Vladivostok Asia/Magadan Asia/Kamchatka Europe/Kaliningrad Europe/Samara Asia/Omsk Asia/Barnaul Asia/Tomsk Asia/Novokuznetsk Asia/Chita Asia/Khandyga Asia/Sakhalin Asia/Srednekolymsk Asia/Ust-Nera Asia/Anadyr Europe/Volgograd Europe/Saratov Europe/Astrakhan Europe/Ulyanovsk Europe/Kirov Asia/Tyumen",
    RW:"Africa/Kigali", SA:"Asia/Riyadh", SC:"Indian/Mahe",
    SD:"Africa/Khartoum", SE:"Europe/Stockholm", SG:"Asia/Singapore",
    SI:"Europe/Ljubljana", SK:"Europe/Bratislava", SL:"Africa/Freetown",
    SN:"Africa/Dakar", SO:"Africa/Mogadishu", SR:"America/Paramaribo",
    SS:"Africa/Juba", SV:"America/El_Salvador", SY:"Asia/Damascus",
    SZ:"Africa/Mbabane", TD:"Africa/Ndjamena", TG:"Africa/Lome",
    TH:"Asia/Bangkok", TJ:"Asia/Dushanbe", TM:"Asia/Ashgabat",
    TN:"Africa/Tunis", TR:"Europe/Istanbul", TT:"America/Port_of_Spain",
    TW:"Asia/Taipei", TZ:"Africa/Dar_es_Salaam", UA:"Europe/Kyiv Europe/Kiev Europe/Simferopol Europe/Uzhgorod Europe/Zaporozhye",
    UG:"Africa/Kampala",
    US:"America/New_York America/Chicago America/Denver America/Los_Angeles America/Phoenix America/Anchorage Pacific/Honolulu America/Detroit America/Indiana/Indianapolis America/Kentucky/Louisville America/Boise America/Juneau America/Sitka America/Nome America/Yakutat America/Adak America/Menominee America/North_Dakota/Center America/North_Dakota/New_Salem America/North_Dakota/Beulah America/Indiana/Vincennes America/Indiana/Winamac America/Indiana/Marengo America/Indiana/Petersburg America/Indiana/Vevay America/Indiana/Tell_City America/Indiana/Knox America/Kentucky/Monticello America/Metlakatla",
    UY:"America/Montevideo", UZ:"Asia/Tashkent Asia/Samarkand",
    VE:"America/Caracas", VN:"Asia/Ho_Chi_Minh Asia/Saigon",
    YE:"Asia/Aden", ZA:"Africa/Johannesburg", ZM:"Africa/Lusaka",
    ZW:"Africa/Harare",

    /* Territories, dependencies, research bases */
    AG:"America/Antigua",
    AI:"America/Anguilla",
    AQ:"Antarctica/Casey Antarctica/Davis Antarctica/DumontDUrville Antarctica/Mawson Antarctica/McMurdo Antarctica/Palmer Antarctica/Rothera Antarctica/Syowa Antarctica/Troll Antarctica/Vostok",
    AS:"Pacific/Pago_Pago",
    AW:"America/Aruba",
    AX:"Europe/Mariehamn",
    BL:"America/St_Barthelemy",
    BQ:"America/Kralendijk",
    CC:"Indian/Cocos",
    CK:"Pacific/Rarotonga",
    CW:"America/Curacao",
    CX:"Indian/Christmas",
    DM:"America/Dominica",
    EH:"Africa/El_Aaiun",
    FK:"Atlantic/Stanley",
    FM:"Pacific/Kosrae Pacific/Ponape Pacific/Truk Pacific/Chuuk Pacific/Pohnpei",
    GD:"America/Grenada",
    GG:"Europe/Guernsey",
    GS:"Atlantic/South_Georgia",
    IM:"Europe/Isle_of_Man",
    IO:"Indian/Chagos",
    JE:"Europe/Jersey",
    KI:"Pacific/Tarawa Pacific/Enderbury Pacific/Kanton Pacific/Kiritimati",
    KM:"Indian/Comoro",
    KN:"America/St_Kitts",
    KP:"Asia/Pyongyang",
    KY:"America/Cayman",
    LC:"America/St_Lucia",
    MF:"America/Marigot",
    MH:"Pacific/Majuro Pacific/Kwajalein",
    MP:"Pacific/Saipan",
    MS:"America/Montserrat",
    NF:"Pacific/Norfolk",
    NR:"Pacific/Nauru",
    NU:"Pacific/Niue",
    PM:"America/Miquelon",
    PN:"Pacific/Pitcairn",
    PW:"Pacific/Palau",
    SB:"Pacific/Guadalcanal",
    SH:"Atlantic/St_Helena",
    SJ:"Arctic/Longyearbyen",
    SM:"Europe/San_Marino",
    ST:"Africa/Sao_Tome",
    SX:"America/Lower_Princes",
    TC:"America/Grand_Turk",
    TF:"Indian/Kerguelen",
    TK:"Pacific/Fakaofo",
    TL:"Asia/Dili",
    TO:"Pacific/Tongatapu",
    TV:"Pacific/Funafuti",
    UM:"Pacific/Midway Pacific/Wake",
    VA:"Europe/Vatican",
    VC:"America/St_Vincent",
    VG:"America/Tortola",
    VI:"America/St_Thomas",
    VU:"Pacific/Efate",
    WF:"Pacific/Wallis",
    WS:"Pacific/Apia",
    YT:"Indian/Mayotte"
  };

  var TZ = {};
  for (var cc in BY_COUNTRY) {
    if (!Object.prototype.hasOwnProperty.call(BY_COUNTRY, cc)) continue;
    BY_COUNTRY[cc].split(" ").forEach(function (zone) { TZ[zone] = cc; });
  }

  /* ---------- Detection ---------- */
  function fromTimeZone() {
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zone) return null;
      if (TZ[zone]) return TZ[zone];
      // Some browsers report deprecated aliases; try a loose city match.
      var city = zone.split("/").pop();
      for (var z in TZ) {
        if (Object.prototype.hasOwnProperty.call(TZ, z) && z.split("/").pop() === city) return TZ[z];
      }
      return null;
    } catch (err) { return null; }
  }

  function fromLanguage() {
    var tags = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language];
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      if (!tag) continue;
      try {
        if (window.Intl && Intl.Locale) {
          var region = new Intl.Locale(tag).region;
          if (region) return region.toUpperCase();
        }
      } catch (err) { /* fall through to the regex */ }
      var m = /^[a-z]{2,3}[-_](?:[A-Za-z]{4}[-_])?([A-Za-z]{2})\b/.exec(tag);
      if (m) return m[1].toUpperCase();
    }
    return null;
  }

  function stored() {
    try {
      var v = window.localStorage.getItem(STORE);
      return v && /^[A-Z]{2}$/.test(v) ? v : null;
    } catch (err) { return null; }
  }

  function detect() {
    // Explicit wins (edge header), then a user's saved choice, then signals.
    var explicit = window.VVIIX_COUNTRY;
    if (typeof explicit === "string" && /^[A-Za-z]{2}$/.test(explicit)) return explicit.toUpperCase();
    return stored() || fromTimeZone() || fromLanguage();
  }

  /* ---------- Presentation ---------- */
  function flagFor(cc) {
    return cc.replace(/./g, function (c) {
      return String.fromCodePoint(127397 + c.charCodeAt(0));
    });
  }

  function nameFor(cc) {
    try {
      var dn = new Intl.DisplayNames([navigator.language || "en", "en"], { type: "region" });
      return dn.of(cc) || cc;
    } catch (err) { return cc; }
  }

  /* Windows renders flag emoji as two letters, not a flag. Detect by drawing
     one and checking whether any colour landed on the canvas. */
  var flagsSupported = null;
  function supportsFlags() {
    if (flagsSupported !== null) return flagsSupported;
    try {
      var c = document.createElement("canvas");
      c.width = 20; c.height = 20;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return (flagsSupported = false);
      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText(flagFor("CA"), 0, 0);
      var d = ctx.getImageData(0, 0, 20, 20).data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        // Any non-greyscale pixel means a real flag glyph rendered.
        if (Math.abs(d[i] - d[i + 1]) > 12 || Math.abs(d[i + 1] - d[i + 2]) > 12) {
          return (flagsSupported = true);
        }
      }
      return (flagsSupported = false);
    } catch (err) { return (flagsSupported = false); }
  }

  function render(cc) {
    var host = document.querySelector("[data-region]");
    if (!host || !cc) return;

    var name = nameFor(cc);
    var flagEl = host.querySelector("[data-region-flag]");
    var nameEl = host.querySelector("[data-region-name]");

    if (flagEl) {
      if (supportsFlags()) {
        flagEl.textContent = flagFor(cc);
        flagEl.classList.remove("region__code");
      } else {
        // Graceful fallback: the ISO code in a bordered chip, on-brand and legible.
        flagEl.textContent = cc;
        flagEl.classList.add("region__code");
      }
    }
    if (nameEl) nameEl.textContent = name;

    host.hidden = false;
    host.dataset.country = cc;

    // Keep the logo's accessible name honest: "V.VI.IX Canada — home"
    var link = host.closest("a");
    if (link) link.setAttribute("aria-label", "V.VI.IX " + name + " — home");
  }

  /* Public hook so a region picker can set it later. */
  window.VVIIXSetCountry = function (cc) {
    if (!/^[A-Za-z]{2}$/.test(cc || "")) return;
    cc = cc.toUpperCase();
    window.VVIIXCountry = cc;
    try { window.localStorage.setItem(STORE, cc); } catch (err) {}
    render(cc);
  };

  // Resolve now rather than on DOMContentLoaded: detection needs no DOM, and
  // fourthwall.js picks a currency the moment it loads, right after this file.
  try { window.VVIIXCountry = detect() || ""; } catch (err) { window.VVIIXCountry = ""; }

  function boot() { render(detect()); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
