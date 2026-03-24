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
    label: 'Helal olsun!',
    url: 'https://media.tenor.com/BHQLlLzxW2oAAAAd/helal-olsun.gif',
  },
  {
    id: 'ivedik-dans',
    category: 'zafer',
    label: 'İvedik Dansı',
    url: 'https://media.tenor.com/HqP4mMxDlBAAAAAd/recep-ivedik-recep.gif',
  },
  {
    id: 'polat-kazan',
    category: 'zafer',
    label: 'Kazandım!',
    url: 'https://media.tenor.com/Wqbj5n8GVQgAAAAd/polat-alemdar-kazandim.gif',
  },

  // ── 😭 Yıkıldım ──────────────────────────────────────────────
  {
    id: 'ay-be',
    category: 'yikildim',
    label: 'Ay be...',
    url: 'https://media.tenor.com/Xnp5cz3MQ0sAAAAd/ay-be-kaderim.gif',
  },
  {
    id: 'kaderim',
    category: 'yikildim',
    label: 'Kaderim!',
    url: 'https://media.tenor.com/3FUCiL5GWNMAAAAC/kaderim-ece-erken.gif',
  },
  {
    id: 'tamam-tamam',
    category: 'yikildim',
    label: 'Tamam tamam',
    url: 'https://media.tenor.com/OcjRL41x0PAAAAAC/tamam-tamam.gif',
  },

  // ── 😏 Dalga ─────────────────────────────────────────────────
  {
    id: 'gel-bakalim',
    category: 'dalga',
    label: 'Gel bakalım',
    url: 'https://media.tenor.com/M2n7hNixmHoAAAAd/gel-bakalim-buyuk-oyun.gif',
  },
  {
    id: 'gardas',
    category: 'dalga',
    label: 'Gardaşım...',
    url: 'https://media.tenor.com/Tq7j2jvVEpMAAAAC/gardas-neyapiyorsun.gif',
  },
  {
    id: 'kork-benden',
    category: 'dalga',
    label: 'Kork benden!',
    url: 'https://media.tenor.com/0mVXDDfmFZkAAAAd/polat-alemdar-kurtlar-vadisi.gif',
  },

  // ── 😱 Şok ───────────────────────────────────────────────────
  {
    id: 'ya-bu-ne',
    category: 'sok',
    label: 'Ya bu ne?!',
    url: 'https://media.tenor.com/JAvYbzMnlcoAAAAd/ya-bu-ne-be-ne-bitiyor.gif',
  },
  {
    id: 'yok-oyle',
    category: 'sok',
    label: 'Yok öyle şey!',
    url: 'https://media.tenor.com/2Bx2DX-Q_kYAAAAd/yok-oyle-bir-sey.gif',
  },
  {
    id: 'hay-allah',
    category: 'sok',
    label: 'Hay Allah!',
    url: 'https://media.tenor.com/XcLkIgCEv8EAAAAC/hay-allah-subhanallah.gif',
  },
];
