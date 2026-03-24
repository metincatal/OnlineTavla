// ═══════════════════════════════════════════════════════════════
//  Türkçe Meme GIF Veritabanı
//  ─────────────────────────────────────────────────────────────
//  GIF eklemek/değiştirmek için:
//    Tenor  → tenor.com'da GIF'e tıkla → "Share" → "Copy GIF Link"
//    Giphy  → giphy.com'da GIF'e tıkla → "Copy Link" → "GIF Link"
// ═══════════════════════════════════════════════════════════════

const MEME_CATEGORIES = [
  { id: 'zafer',    label: 'Zafer'    },
  { id: 'yikildim', label: 'Yıkıldım' },
  { id: 'gulme',   label: 'Gülme'    },
  { id: 'sinirli', label: 'Sinirli'  },
  { id: 'dalga',   label: 'Dalga'    },
  { id: 'sok',     label: 'Şok'      },
  { id: 'gg',      label: 'GG'       },
];

const MEME_LIST = [

  // ── Zafer ────────────────────────────────────────────────────
  {
    id: 'helal',
    category: 'zafer',
    label: 'Helal Olsun',
    url: 'https://media.tenor.com/nmJmC4L8gxsAAAAC/dogan-gunes.gif',
  },
  {
    id: 'ivedik-dans',
    category: 'zafer',
    label: 'İvedik Dansı',
    url: 'https://media.tenor.com/-YVDU-vNNP4AAAAC/recep-ivedik.gif',
  },
  {
    id: 'zafer-dans',
    category: 'zafer',
    label: 'Zafer Dansı',
    url: 'https://media.tenor.com/EnwXkUkTg6EAAAAC/barba-bambino.gif',
  },

  // ── Yıkıldım ─────────────────────────────────────────────────
  {
    id: 'ay-be',
    category: 'yikildim',
    label: 'Ay Be...',
    url: 'https://media.tenor.com/4EwxKaszrUEAAAAC/dilan-deniz-dilan-cicek-deniz.gif',
  },
  {
    id: 'kaderim',
    category: 'yikildim',
    label: 'Kaderim!',
    url: 'https://media.tenor.com/EcACBaynTNMAAAAC/cukur-%C3%A7ukur.gif',
  },
  {
    id: 'tamam-tamam',
    category: 'yikildim',
    label: 'Tamam Tamam',
    url: 'https://media.tenor.com/nyjkgNBi_KMAAAAC/tamam-tamam-tamam.gif',
  },

  // ── Gülme ────────────────────────────────────────────────────
  {
    id: 'can-yaman-gul',
    category: 'gulme',
    label: 'Can Yaman',
    url: 'https://media1.tenor.com/m/wXTQrOKzpuwAAAAC/can-yaman-can.gif',
  },
  {
    id: 'engin-gul',
    category: 'gulme',
    label: 'Engin Güler',
    url: 'https://media1.tenor.com/m/3wXiACds33sAAAAC/engin-aky%C3%BCrek-the-ambassadors-daughter.gif',
  },
  {
    id: 'el-risitas',
    category: 'gulme',
    label: 'El Risitas',
    url: 'https://media1.tenor.com/m/3KONHAjX7LAAAAAC/el-risitas-risitaslaughing.gif',
  },
  {
    id: 'ask-mavi-gul',
    category: 'gulme',
    label: 'Kahkaha',
    url: 'https://media1.tenor.com/m/6IgDFRehI98AAAAC/a%C5%9Fk-ve-mavi-gif-emrah.gif',
  },

  // ── Sinirli ──────────────────────────────────────────────────
  {
    id: 'koksal-baba',
    category: 'sinirli',
    label: 'Köksal Baba',
    url: 'https://media1.tenor.com/m/lLYQGDFnkn8AAAAC/koksal-baba.gif',
  },
  {
    id: 'evren-sinirli',
    category: 'sinirli',
    label: 'Evren Sinirli',
    url: 'https://media1.tenor.com/m/aH3tw90vTbsAAAAC/evren-sinirli.gif',
  },
  {
    id: 'masaya-vur',
    category: 'sinirli',
    label: 'Masaya Vuruyor',
    url: 'https://media1.tenor.com/m/TBT1DIuVy4EAAAAC/masaya-vurmak-sinirlenme.gif',
  },
  {
    id: 'cukur-aras',
    category: 'sinirli',
    label: 'Çukur - Aras',
    url: 'https://media1.tenor.com/m/-qGLz2cTaVkAAAAC/%C3%A7ukur-aras-bulut%C4%B0ynemli.gif',
  },

  // ── Dalga ────────────────────────────────────────────────────
  {
    id: 'gel-bakalim',
    category: 'dalga',
    label: 'Çıkışa Gel Lan',
    url: 'https://media.tenor.com/O_JH64YkYCAAAAAC/%C3%A7%C4%B1k%C4%B1%C5%9Fa-gel-%C3%A7%C4%B1k%C4%B1%C5%9Fa-gel-lan.gif',
  },
  {
    id: 'turk-troll',
    category: 'dalga',
    label: 'Türk Troll',
    url: 'https://media.tenor.com/7NgACHcJalUAAAAC/turk-troll.gif',
  },
  {
    id: 'dalga-gel',
    category: 'dalga',
    label: 'Gel Bakalım',
    url: 'https://media.tenor.com/VCqchonbM1QAAAAC/turkish-turkiye.gif',
  },

  // ── Şok ──────────────────────────────────────────────────────
  {
    id: 'noluyo-lan',
    category: 'sok',
    label: 'Noluyo Lan?!',
    url: 'https://media.tenor.com/0X6Zh_80O4sAAAAC/noluyo-lan-noluyo.gif',
  },
  {
    id: 'hay-allah',
    category: 'sok',
    label: 'Allah Kurtarsın',
    url: 'https://media.tenor.com/pwcL_cIdfZgAAAAC/allah-kurtars%C4%B1n-karde%C5%9Fim-deep-web-turkish.gif',
  },
  {
    id: 'kafayi-siyirdin',
    category: 'sok',
    label: 'Kafayı Sıyırdın',
    url: 'https://media.tenor.com/tMpDiC_IZlcAAAAC/deep-turkish-web-sen-kafay%C4%B1s%C4%B1y%C4%B1rm%C4%B1%C5%9Fs%C4%B1n.gif',
  },

  // ── GG / Saygı ───────────────────────────────────────────────
  {
    id: 'respect',
    category: 'gg',
    label: 'Respect!',
    url: 'https://media1.tenor.com/m/EITlmmdqb5cAAAAC/respect-restecp.gif',
  },
  {
    id: 'aybuke-pusat',
    category: 'gg',
    label: 'Her Yerdesen',
    url: 'https://media1.tenor.com/m/PYjSZD5kyyUAAAAC/aybukepusat-heryerdesen.gif',
  },
  {
    id: 'deep-web-gg',
    category: 'gg',
    label: 'Ne Bu Tantana',
    url: 'https://media1.tenor.com/m/Df56RjhWBqQAAAAC/noluyo-karde%C5%9Fim-ne-bu-tantana-deep-web-turkish.gif',
  },
  {
    id: 'turkun-armasi',
    category: 'gg',
    label: "Türk'ün Arması",
    url: 'https://media1.tenor.com/m/SnPBvFAT1JwAAAAC/turkun-armasi.gif',
  },
];
