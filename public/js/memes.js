// ═══════════════════════════════════════════════════════════════
//  Türkçe Meme GIF Veritabanı — sesli
//  ─────────────────────────────────────────────────────────────
//  Her meme'in `sound` alanı sounds.js'teki playSfx() efektlerinden
//  birini seçer. Efektler Web Audio ile anlık üretilir; indirilecek
//  ses dosyası yoktur.
//
//    korna   airhorn        davul   davul-zurna / halay
//    trombon sad trombone   kahkaha gülme
//    zil     kaba korna     boom    vine boom
//    sting   dramatik vuruş alkis   alkış
//    parilti ışıltı         tiktak  saat tik-takı
//
//  GIF eklemek/değiştirmek için:
//    Tenor → tenor.com'da GIF'e tıkla → "Share" → "Copy GIF Link"
//    Küçük boy (.../XXXXXAAAAM/...) linkleri tercih et: hızlı yüklenir.
// ═══════════════════════════════════════════════════════════════

const MEME_CATEGORIES = [
  { id: 'zafer',    label: 'Zafer'       },
  { id: 'yikildim', label: 'Yıkıldım'    },
  { id: 'kahkaha',  label: 'Kahkaha'     },
  { id: 'sinir',    label: 'Sinir'       },
  { id: 'dalga',    label: 'Dalga'       },
  { id: 'sok',      label: 'Şok'         },
  { id: 'saygi',    label: 'Saygı'       },
  { id: 'zar',      label: 'Zar'         },
  { id: 'bekle',    label: 'Bekle'       },
];

const MEME_LIST = [

  // ── Zafer — korna ve davul ────────────────────────────────────
  {
    id:       'ivedik-ates',
    category: 'zafer',
    label:    'Ateşler İçinde',
    sound:    'korna',
    url:      'https://media.tenor.com/bFlGIiNe5S4AAAAM/recep-ivedik-ate%C5%9F.gif',
  },
  {
    id:       'gol-sevinci',
    category: 'zafer',
    label:    'Gol Sevinci',
    sound:    'korna',
    url:      'https://media.tenor.com/H49ZocZvKgIAAAAM/bar%C4%B1%C5%9F-alper-y%C4%B1lmaz-gol-sevinci.gif',
  },
  {
    id:       'siuuu',
    category: 'zafer',
    label:    'SIUUU!',
    sound:    'korna',
    url:      'https://media.tenor.com/DoH_u04EDzoAAAAM/siuuuu.gif',
  },
  {
    id:       'vizontele-halay',
    category: 'zafer',
    label:    'Vizontele Halay',
    sound:    'davul',
    url:      'https://media.tenor.com/hdb4918EC60AAAAM/vizontelehalay-kaykayclub.gif',
  },
  {
    id:       'mahmut-halay',
    category: 'zafer',
    label:    'Mahmut Tuncer',
    sound:    'davul',
    url:      'https://media.tenor.com/_t2PKnlCpJ0AAAAM/halay-mahmut-tuncer.gif',
  },
  {
    id:       'dugun-halay',
    category: 'zafer',
    label:    'Düğün Havası',
    sound:    'davul',
    url:      'https://media.tenor.com/nCmF5jMtTsUAAAAM/dugun-halay.gif',
  },
  {
    id:       'ibo-dans',
    category: 'zafer',
    label:    'İbo Oynuyor',
    sound:    'davul',
    url:      'https://media.tenor.com/VwV91_by4XMAAAAM/ibrahim-tatlises-dancing.gif',
  },
  {
    id:       'ivedik-uzunhava',
    category: 'zafer',
    label:    'Uzun Hava',
    sound:    'davul',
    url:      'https://media.tenor.com/c9EX9FyAh5YAAAAM/luciferrn-recep-i%CC%87vedik-uzun-hava.gif',
  },

  // ── Yıkıldım — üzgün trombon ──────────────────────────────────
  {
    id:       'ivedik-depresyon',
    category: 'yikildim',
    label:    'Depresyondayım',
    sound:    'trombon',
    url:      'https://media.tenor.com/cxmeH6sfekcAAAAM/recep-ivedik-recep-ivedik-depresyon.gif',
  },
  {
    id:       'sacma-hayat',
    category: 'yikildim',
    label:    'Bu Ne Saçma Hayat',
    sound:    'trombon',
    url:      'https://media.tenor.com/F53IqwiuuqgAAAAM/recep-ivedik-bu-ne-sa%C3%A7ma-hayat.gif',
  },
  {
    id:       'cok-uzuldum',
    category: 'yikildim',
    label:    'Çok Üzüldüm Lan',
    sound:    'trombon',
    url:      'https://media.tenor.com/wXFqUDJTxW8AAAAM/o%C4%9Flum-%C3%A7ok-%C3%BCz%C3%BCld%C3%BCm-lan.gif',
  },
  {
    id:       'dolandirildim',
    category: 'yikildim',
    label:    'Dolandırıldım Lan',
    sound:    'trombon',
    url:      'https://media.tenor.com/xAORrYKCTLIAAAAM/doland%C4%B1r%C4%B1ld%C4%B1m-lan-para-gitti.gif',
  },
  {
    id:       'ibo-agliyor',
    category: 'yikildim',
    label:    'İbo Ağlıyor',
    sound:    'trombon',
    url:      'https://media.tenor.com/FysVPWYlKnkAAAAM/tatlises-crying-ibo-ibo.gif',
  },
  {
    id:       'muslum-baba',
    category: 'yikildim',
    label:    'Müslüm Baba',
    sound:    'trombon',
    url:      'https://media.tenor.com/_ubU1KYmQZYAAAAM/m%C3%BCsl%C3%BCm-baba.gif',
  },
  {
    id:       'huzun',
    category: 'yikildim',
    label:    'Hüzün',
    sound:    'trombon',
    url:      'https://media.tenor.com/_mzpdvHWgQ8AAAAM/ekmek-topla-h%C3%BCz%C3%BCn.gif',
  },
  {
    id:       'vartolu-uzgun',
    category: 'yikildim',
    label:    'Vartolu Üzgün',
    sound:    'trombon',
    url:      'https://media.tenor.com/RJa1lJQT3NwAAAAM/%C3%A7ukur-vartolu.gif',
  },

  // ── Kahkaha ───────────────────────────────────────────────────
  {
    id:       'el-risitas',
    category: 'kahkaha',
    label:    'El Risitas',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/QgTx6fv4IpAAAAAM/el-risitas-juan-joya-borja.gif',
  },
  {
    id:       'sunal-guluyor',
    category: 'kahkaha',
    label:    'Kemal Sunal',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/Y9knjXNn_P8AAAAM/kemal-sunal-laugh%C4%B1ng.gif',
  },
  {
    id:       'sener-gul',
    category: 'kahkaha',
    label:    'Şener Şen',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/TIMMTLDoX3wAAAAM/%C5%9Fener-%C5%9Fen-g%C3%BCl.gif',
  },
  {
    id:       'kotu-gulus',
    category: 'kahkaha',
    label:    'Kötü Gülüş',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/0OooINQRS6EAAAAM/kotu-gulus-dedecim.gif',
  },
  {
    id:       'hah-ulan',
    category: 'kahkaha',
    label:    'Hah Ulan!',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/YRQDX_mU0J4AAAAM/hah-ulan-hah-ulan-ulan.gif',
  },
  {
    id:       'kahkaha-krizi',
    category: 'kahkaha',
    label:    'Gülme Krizi',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/sYXXpMOs9l4AAAAM/hahahaha-ahahahaah.gif',
  },
  {
    id:       'hababam-gulme',
    category: 'kahkaha',
    label:    'Hababam Gülme',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/svtLueCwr9wAAAAM/g%C3%BClmek-hahaha.gif',
  },
  {
    id:       'saban-sener',
    category: 'kahkaha',
    label:    'Şaban & Şener',
    sound:    'kahkaha',
    url:      'https://media.tenor.com/4VtbmmyLfsIAAAAM/kemal-sunal-%C5%9Fener-%C5%9Fen.gif',
  },

  // ── Sinir ─────────────────────────────────────────────────────
  {
    id:       'hey-yavrum',
    category: 'sinir',
    label:    'Hey Yavrum Hey',
    sound:    'zil',
    url:      'https://media.tenor.com/Kf7h5nieOP8AAAAM/koksal-baba-hey-yavrum-hey.gif',
  },
  {
    id:       'koksal-baba',
    category: 'sinir',
    label:    'Köksal Baba',
    sound:    'zil',
    url:      'https://media.tenor.com/sxqMgioW4EQAAAAM/koksal-baba-koksal.gif',
  },
  {
    id:       'arabadan-indi',
    category: 'sinir',
    label:    'Arabadan İndi',
    sound:    'zil',
    url:      'https://media.tenor.com/8OA9rorZAkgAAAAM/turkey-man-angry-out-of-car-meme.gif',
  },
  {
    id:       'evren-sinirli',
    category: 'sinir',
    label:    'Evren Sinirli',
    sound:    'zil',
    url:      'https://media.tenor.com/aH3tw90vTbsAAAAM/evren-sinirli.gif',
  },
  {
    id:       'ne-bicim-insan',
    category: 'sinir',
    label:    'Ne Biçim İnsansın',
    sound:    'zil',
    url:      'https://media.tenor.com/F3nbVP2qauUAAAAM/lan-sen-ne-bicim-insans%C4%B1n-recep-ivedik-bag%C4%B1rma.gif',
  },
  {
    id:       'deliricem',
    category: 'sinir',
    label:    'Deliricem',
    sound:    'zil',
    url:      'https://media.tenor.com/daG89Bw5p_AAAAAM/deliricem-turkish.gif',
  },
  {
    id:       'petekkaya',
    category: 'sinir',
    label:    'Erkan Petekkaya',
    sound:    'zil',
    url:      'https://media.tenor.com/0z0vgjALtyQAAAAM/erkanpetekkaya.gif',
  },
  {
    id:       'saban-yumruk',
    category: 'sinir',
    label:    'Şaban Yumruk',
    sound:    'zil',
    url:      'https://media.tenor.com/aJhAyCyf6ZoAAAAM/kemal-sunal-%C5%9Faban-yumruk-sahnesi.gif',
  },

  // ── Dalga / trol ──────────────────────────────────────────────
  {
    id:       'ivedik-nah',
    category: 'dalga',
    label:    'Nah!',
    sound:    'boom',
    url:      'https://media.tenor.com/EBAJ6pnCoWwAAAAM/recep-ivedik-nah.gif',
  },
  {
    id:       'nah-cekerim',
    category: 'dalga',
    label:    'Nah Çekerim',
    sound:    'boom',
    url:      'https://media.tenor.com/ELt_NT2ShQoAAAAM/nah-nah%C3%A7ekmek.gif',
  },
  {
    id:       'koksal-dalga',
    category: 'dalga',
    label:    'Köksal Dalga',
    sound:    'boom',
    url:      'https://media.tenor.com/FSkcBVFuDDgAAAAM/k%C3%B6ksal-baba-trabzonspor.gif',
  },
  {
    id:       'dalga-mi',
    category: 'dalga',
    label:    'Dalga mı Geçiyorsun?',
    sound:    'boom',
    url:      'https://media.tenor.com/JwS1-qh9fvAAAAAM/dalga-mi-geciyorsun-canim.gif',
  },
  {
    id:       'saka-mi-bu',
    category: 'dalga',
    label:    'Şaka mı Bu?',
    sound:    'boom',
    url:      'https://media.tenor.com/yjCRp1QA6IwAAAAM/%C5%9Faka-m%C4%B1bu-cem-y%C4%B1lmaz.gif',
  },
  {
    id:       'bak-bu-olabilir',
    category: 'dalga',
    label:    'Bak Bu Olabilir',
    sound:    'boom',
    url:      'https://media.tenor.com/cLGRdT2sExEAAAAM/bak-bu-olabilir-kemal-sunal.gif',
  },
  {
    id:       'korktun-mu',
    category: 'dalga',
    label:    'Korktun mu?',
    sound:    'boom',
    url:      'https://media.tenor.com/gr3GCr3osB8AAAAM/korktun-mu.gif',
  },
  {
    id:       'turk-troll',
    category: 'dalga',
    label:    'Türk Troll',
    sound:    'boom',
    url:      'https://media.tenor.com/7NgACHcJalUAAAAM/turk-troll.gif',
  },

  // ── Şok ───────────────────────────────────────────────────────
  {
    id:       'noluyo-lan',
    category: 'sok',
    label:    'Noluyo Lan?!',
    sound:    'sting',
    url:      'https://media.tenor.com/028p1VCTFskAAAAM/recep-ivedik-noluyo-lan.gif',
  },
  {
    id:       'noluyo-dayi',
    category: 'sok',
    label:    'Noluyo Dayı',
    sound:    'sting',
    url:      'https://media.tenor.com/dB5xTj2CrHsAAAAM/noluyo-lan-noluyo-day%C4%B1.gif',
  },
  {
    id:       'sok-oldum',
    category: 'sok',
    label:    'Şok Oldum',
    sound:    'sting',
    url:      'https://media.tenor.com/J4RWH4WH2HcAAAAM/%C5%9Fok-%C5%9Fok-oldum.gif',
  },
  {
    id:       'kafayi-siyirdin',
    category: 'sok',
    label:    'Kafayı Sıyırmışsın',
    sound:    'sting',
    url:      'https://media.tenor.com/VtWaRn98ArkAAAAM/sen-kafay%C4%B1s%C4%B1y%C4%B1rm%C4%B1%C5%9Fs%C4%B1n-deep-t%C3%BCrkish-web.gif',
  },
  {
    id:       'ne-olmesi',
    category: 'sok',
    label:    'Ne Ölmesi Kardeşim',
    sound:    'sting',
    url:      'https://media.tenor.com/26YteeZj_zEAAAAM/deep-turkish-web-ne%C3%B6lmesi-karde%C5%9Fim.gif',
  },
  {
    id:       'ne-bu-tantana',
    category: 'sok',
    label:    'Ne Bu Tantana',
    sound:    'sting',
    url:      'https://media.tenor.com/Df56RjhWBqQAAAAM/noluyo-karde%C5%9Fim-ne-bu-tantana-deep-web-turkish.gif',
  },
  {
    id:       'ivedik-korktu',
    category: 'sok',
    label:    'Korktum',
    sound:    'sting',
    url:      'https://media.tenor.com/DW5wNiFtoG0AAAAM/recep-ivedik-korkmak.gif',
  },
  {
    id:       'oha-yaa',
    category: 'sok',
    label:    'Oha Yaa!',
    sound:    'sting',
    url:      'https://media.tenor.com/zsrKszTZMv0AAAAM/oha-yaa-ama-oha-yaa.gif',
  },

  // ── Saygı / GG ────────────────────────────────────────────────
  {
    id:       'eyvallah',
    category: 'saygi',
    label:    'Eyvallah',
    sound:    'alkis',
    url:      'https://media.tenor.com/3OGmmJGewX4AAAAM/eyvallah-eyv.gif',
  },
  {
    id:       'ivedik-eyvallah',
    category: 'saygi',
    label:    'İvedik Eyvallah',
    sound:    'alkis',
    url:      'https://media.tenor.com/lwYmYsYw5zMAAAAM/recepi%CC%87vedik-eyvallah.gif',
  },
  {
    id:       'eyvallah-kanka',
    category: 'saygi',
    label:    'Eyvallah Kanka',
    sound:    'alkis',
    url:      'https://media.tenor.com/_9KUftSqjEwAAAAM/eyvallah-kanka.gif',
  },
  {
    id:       'eyvallah-reis',
    category: 'saygi',
    label:    'Eyvallah Reis',
    sound:    'alkis',
    url:      'https://media.tenor.com/iQAXAlggjdAAAAAM/eyvallah-alparslan.gif',
  },
  {
    id:       'pasa-eyvallah',
    category: 'saygi',
    label:    'Paşa Eyvallah',
    sound:    'alkis',
    url:      'https://media.tenor.com/TUMTkdnq2XgAAAAM/mahmud-pasha-eyvallah.gif',
  },
  {
    id:       'alkis',
    category: 'saygi',
    label:    'Alkış',
    sound:    'alkis',
    url:      'https://media.tenor.com/paXQ0eZDvxIAAAAM/tcalk%C4%B1s1x-alk%C4%B1stc1x.gif',
  },
  {
    id:       'tebrikler',
    category: 'saygi',
    label:    'Tebrikler',
    sound:    'alkis',
    url:      'https://media.tenor.com/gp6l1sEqoU0AAAAM/clapping-congrats.gif',
  },
  {
    id:       'helal-olsun',
    category: 'saygi',
    label:    'Helal Olsun',
    sound:    'alkis',
    url:      'https://media.tenor.com/nmJmC4L8gxsAAAAM/dogan-gunes.gif',
  },

  // ── Zar & şans ────────────────────────────────────────────────
  {
    id:       'zar-duasi',
    category: 'zar',
    label:    'Zar Duası',
    sound:    'parilti',
    url:      'https://media.tenor.com/Xh5VMxymW48AAAAM/aykut-elmas-aykut-elmas-zar.gif',
  },
  {
    id:       'tavla-ustasi',
    category: 'zar',
    label:    'Tavla Ustası',
    sound:    'parilti',
    url:      'https://media.tenor.com/4anQnD0LOcAAAAAM/playing-backgammon-sebastian.gif',
  },
  {
    id:       'duses',
    category: 'zar',
    label:    'Düşeş!',
    sound:    'parilti',
    url:      'https://media.tenor.com/nLhN3O7uBHcAAAAM/backgammon-six.gif',
  },
  {
    id:       'zar-atiyorum',
    category: 'zar',
    label:    'Zar Atıyorum',
    sound:    'parilti',
    url:      'https://media.tenor.com/KH1jb0_m6wEAAAAM/dice-roll.gif',
  },
  {
    id:       'sans-bende',
    category: 'zar',
    label:    'Şans Bende',
    sound:    'parilti',
    url:      'https://media.tenor.com/z9SSjPt0DJcAAAAM/lucky-luck.gif',
  },
  {
    id:       'gerildim',
    category: 'zar',
    label:    'Gerildim',
    sound:    'parilti',
    url:      'https://media.tenor.com/T0ou1c-tpXEAAAAM/nervous-sign-of-the-cross.gif',
  },
  {
    id:       'insallah',
    category: 'zar',
    label:    'İnşallah',
    sound:    'parilti',
    url:      'https://media.tenor.com/oNMboFn8qeYAAAAM/inshallah-cat-cat-inshallah.gif',
  },
  {
    id:       'dua-ediyorum',
    category: 'zar',
    label:    'Dua Ediyorum',
    sound:    'parilti',
    url:      'https://media.tenor.com/7d3KK1oN7i0AAAAM/prayer-desert.gif',
  },

  // ── Bekle / sıkıldım ──────────────────────────────────────────
  {
    id:       'canim-sikildi',
    category: 'bekle',
    label:    'Canım Sıkıldı',
    sound:    'tiktak',
    url:      'https://media.tenor.com/qM113EWrhp8AAAAM/canim-sikildi.gif',
  },
  {
    id:       'bekliyorum',
    category: 'bekle',
    label:    'Bekliyorum...',
    sound:    'tiktak',
    url:      'https://media.tenor.com/NTa3P2NGcUEAAAAM/tolga-cevik.gif',
  },
  {
    id:       'hemen-geliyorum',
    category: 'bekle',
    label:    'Hemen Geliyorum',
    sound:    'tiktak',
    url:      'https://media.tenor.com/Ydlk9GaatDYAAAAM/hemen-geliyorum-bekle.gif',
  },
  {
    id:       'uyuyakaldim',
    category: 'bekle',
    label:    'Uyuyakaldım',
    sound:    'tiktak',
    url:      'https://media.tenor.com/dGy6JFozi-AAAAAM/aykut-elmas-uyuyam%C4%B1yom.gif',
  },
  {
    id:       'hala-bekliyorum',
    category: 'bekle',
    label:    'Hâlâ Bekliyorum',
    sound:    'tiktak',
    url:      'https://media.tenor.com/TqpI4vhB18oAAAAM/nadirleumutabegleniyor-nadirab.gif',
  },
  {
    id:       'sikildim',
    category: 'bekle',
    label:    'Sıkıldım',
    sound:    'tiktak',
    url:      'https://media.tenor.com/fX9PXHeyLa8AAAAM/im-bored-cat.gif',
  },
  {
    id:       'iskelet-oldum',
    category: 'bekle',
    label:    'İskelet Oldum',
    sound:    'tiktak',
    url:      'https://media.tenor.com/kILcyW6fO_cAAAAM/skeleton-waiting-skeleton.gif',
  },
  {
    id:       'uyudun-mu',
    category: 'bekle',
    label:    'Uyudun mu?',
    sound:    'tiktak',
    url:      'https://media.tenor.com/-GkR37YPVsMAAAAM/yaz-uyudun-mu-yaz-cem-y%C4%B1lmaz-yaz-uyudun-mu.gif',
  },
];
