// ═══════════════════════════════════════════════════════════════
//  Türkçe Meme GIF Veritabanı
//  ─────────────────────────────────────────────────────────────
//  Her memin url alanını gerçek bir Türkçe meme GIF linki ile
//  değiştirebilirsiniz. Tenor veya Giphy'den GIF linki almak için:
//    Tenor  → tenor.com'da GIF'e tıkla → "Share" → "Copy GIF Link"
//    Giphy  → giphy.com'da GIF'e tıkla → "Copy Link" → "GIF Link"
// ═══════════════════════════════════════════════════════════════

const MEME_CATEGORIES = [
  { id: 'zafer',    label: '🏆 Zafer'    },
  { id: 'yikildim', label: '😭 Yıkıldım' },
  { id: 'dalga',   label: '😏 Dalga'    },
  { id: 'sok',     label: '😱 Şok'      },
];

const MEME_LIST = [

  // ── 🏆 Zafer ─────────────────────────────────────────────────
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

  // ── 😭 Yıkıldım ──────────────────────────────────────────────
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

  // ── 😏 Dalga ─────────────────────────────────────────────────
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

  // ── 😱 Şok ───────────────────────────────────────────────────
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
];
