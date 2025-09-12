import random

# -------------------------------
# 1. Word lists for English, Catalan, Spanish
# Each sublist has 64 words.
# Nouns: (word, gender) -> "m" (masculine), "f" (feminine), "n" (neutral)
# Adjectives: (masculine_form, feminine_form)
# Other words: (word, None) to keep structure consistent.
# -------------------------------

word_lists = {
    "en": [
        # 1: adjectives (moods)
        [("silent","silent"),("ancient","ancient"),("bright","bright"),("calm","calm"),("curious","curious"),("daring","daring"),("dusty","dusty"),("eager","eager"),
         ("frozen","frozen"),("gentle","gentle"),("golden","golden"),("hidden","hidden"),("humble","humble"),("lonely","lonely"),("lucky","lucky"),("mighty","mighty"),
         ("narrow","narrow"),("noble","noble"),("playful","playful"),("proud","proud"),("quick","quick"),("quiet","quiet"),("rare","rare"),("restless","restless"),
         ("shiny","shiny"),("shy","shy"),("simple","simple"),("slow","slow"),("small","small"),("smooth","smooth"),("soft","soft"),("strong","strong"),
         ("subtle","subtle"),("swift","swift"),("tiny","tiny"),("vast","vast"),("warm","warm"),("weary","weary"),("wild","wild"),("wise","wise"),
         ("bold","bold"),("brave","brave"),("clear","clear"),("cold","cold"),("dark","dark"),("deep","deep"),("eager","eager"),("faint","faint"),
         ("fiery","fiery"),("free","free"),("fresh","fresh"),("grand","grand"),("happy","happy"),("heavy","heavy"),("kind","kind"),("light","light"),
         ("lively","lively"),("sharp","sharp"),("smart","smart"),("strange","strange"),("sweet","sweet"),("tall","tall"),("vast","vast"),("young","young")],
        # 2: animals
        [("ant","n"),("bear","n"),("cat","n"),("crow","n"),("deer","n"),("dog","n"),("dove","n"),("eagle","n"),
         ("fox","n"),("frog","n"),("goat","n"),("hawk","n"),("horse","n"),("lion","n"),("lizard","n"),("mole","n"),
         ("mouse","n"),("owl","n"),("ox","n"),("pig","n"),("rabbit","n"),("rat","n"),("seal","n"),("shark","n"),
         ("sheep","n"),("snake","n"),("spider","n"),("swan","n"),("tiger","n"),("toad","n"),("wolf","n"),("zebra","n"),
         ("bat","n"),("bison","n"),("camel","n"),("cheetah","n"),("cobra","n"),("crab","n"),("duck","n"),("falcon","n"),
         ("fish","n"),("gecko","n"),("goose","n"),("gull","n"),("jaguar","n"),("jellyfish","n"),("leopard","n"),("lynx","n"),
         ("monkey","n"),("octopus","n"),("panda","n"),("parrot","n"),("penguin","n"),("raven","n"),("salmon","n"),("scorpion","n"),
         ("shrimp","n"),("squid","n"),("squirrel","n"),("turtle","n"),("vulture","n"),("whale","n"),("wasp","n"),("yak","n")],
        # 3: verbs (motion)
        [("arches",None),("balances",None),("bounces",None),("climbs",None),("dances",None),("drifts",None),("falls",None),("flies",None),
         ("glides",None),("hops",None),("jumps",None),("marches",None),("rolls",None),("runs",None),("sails",None),("shifts",None),
         ("shines",None),("slides",None),("soars",None),("spins",None),("springs",None),("steps",None),("strolls",None),("swims",None),
         ("swings",None),("tumbles",None),("turns",None),("walks",None),("wades",None),("wanders",None),("weaves",None),("zooms",None),
         ("ambles",None),("ascends",None),("bursts",None),("crawls",None),("darts",None),("dashes",None),("dives",None),("drops",None),
         ("emerges",None),("flows",None),("grows",None),("hurries",None),("leaps",None),("lurks",None),("moves",None),("passes",None),
         ("prowls",None),("races",None),("rises",None),("rushes",None),("settles",None),("sinks",None),("skips",None),("slides",None),
         ("storms",None),("strides",None),("surges",None),("sweeps",None),("twirls",None),("vaults",None),("wanders",None),("zigzags",None)],
        # 4: prepositions
        [("above",None),("across",None),("against",None),("along",None),("amid",None),("among",None),("around",None),("at",None),
         ("before",None),("behind",None),("below",None),("beneath",None),("beside",None),("between",None),("beyond",None),("by",None),
         ("down",None),("from",None),("in",None),("inside",None),("into",None),("near",None),("off",None),("on",None),
         ("onto",None),("opposite",None),("outside",None),("over",None),("past",None),("through",None),("toward",None),("under",None),
         ("underneath",None),("up",None),("upon",None),("within",None),("without",None),("about",None),("after",None),("around",None),
         ("atop",None),("beneath",None),("beside",None),("beyond",None),("during",None),("except",None),("inside",None),("like",None),
         ("near",None),("outside",None),("over",None),("round",None),("since",None),("throughout",None),("to",None),("toward",None),
         ("under",None),("until",None),("up",None),("versus",None),("with",None),("within",None),("without",None),("along",None),("amid",None)],
        # 5: adjectives (scenery)
        [("arid","arid"),("barren","barren"),("blazing","blazing"),("breezy","breezy"),("bright","bright"),("brisk","brisk"),("broken","broken"),("calm","calm"),
         ("cloudy","cloudy"),("crooked","crooked"),("dense","dense"),("distant","distant"),("dry","dry"),("dusty","dusty"),("eerie","eerie"),("fertile","fertile"),
         ("foggy","foggy"),("fresh","fresh"),("frozen","frozen"),("gleaming","gleaming"),("glowing","glowing"),("golden","golden"),("gray","gray"),("grim","grim"),
         ("humid","humid"),("icy","icy"),("jagged","jagged"),("lush","lush"),("misty","misty"),("muddy","muddy"),("narrow","narrow"),("open","open"),
         ("parched","parched"),("radiant","radiant"),("rainy","rainy"),("rocky","rocky"),("rough","rough"),("rugged","rugged"),("sandy","sandy"),("shadowy","shadowy"),
         ("silent","silent"),("smooth","smooth"),("snowy","snowy"),("soft","soft"),("solid","solid"),("steep","steep"),("still","still"),("stormy","stormy"),
         ("sunny","sunny"),("warm","warm"),("wet","wet"),("wide","wide"),("wild","wild"),("windy","windy"),("wooded","wooded"),("worn","worn"),
         ("ancient","ancient"),("green","green"),("hidden","hidden"),("hollow","hollow"),("pale","pale"),("pink","pink"),("red","red"),("silver","silver"),
         ("stark","stark"),("thin","thin"),("vast","vast"),("yellow","yellow")],
        # 6: places
        [("bay","n"),("beach","n"),("bluff","n"),("bridge","n"),("canyon","n"),("cave","n"),("cliff","n"),("coast","n"),
         ("crater","n"),("creek","n"),("delta","n"),("desert","n"),("dune","n"),("forest","n"),("glacier","n"),("grove","n"),
         ("harbor","n"),("hill","n"),("island","n"),("jungle","n"),("lagoon","n"),("lake","n"),("meadow","n"),("mountain","n"),
         ("oasis","n"),("ocean","n"),("park","n"),("path","n"),("peak","n"),("plain","n"),("pond","n"),("quarry","n"),
         ("reef","n"),("ridge","n"),("river","n"),("road","n"),("savanna","n"),("sea","n"),("shore","n"),("spring","n"),
         ("swamp","n"),("terrace","n"),("trail","n"),("valley","n"),("village","n"),("volcano","n"),("waterfall","n"),("woods","n"),
         ("arch","n"),("arena","n"),("barn","n"),("castle","n"),("chapel","n"),("city","n"),("field","n"),("fort","n"),
         ("garden","n"),("gate","n"),("harbor","n"),("haven","n"),("market","n"),("plaza","n"),("port","n"),("tower","n")],
        # 7: adjectives (objects)
        [("amber","amber"),("azure","azure"),("beige","beige"),("black","black"),("blue","blue"),("bronze","bronze"),("brown","brown"),("crimson","crimson"),
         ("emerald","emerald"),("gold","gold"),("gray","gray"),("green","green"),("indigo","indigo"),("ivory","ivory"),("jade","jade"),("khaki","khaki"),
         ("lavender","lavender"),("lime","lime"),("magenta","magenta"),("maroon","maroon"),("navy","navy"),("ochre","ochre"),("olive","olive"),("orange","orange"),
         ("peach","peach"),("pink","pink"),("plum","plum"),("purple","purple"),("red","red"),("rose","rose"),("ruby","ruby"),("saffron","saffron"),
         ("scarlet","scarlet"),("silver","silver"),("tan","tan"),("teal","teal"),("turquoise","turquoise"),("violet","violet"),("white","white"),("yellow","yellow"),
         ("ashen","ashen"),("brass","brass"),("chalky","chalky"),("copper","copper"),("dusty","dusty"),("gilded","gilded"),("glowing","glowing"),("glossy","glossy"),
         ("ivory","ivory"),("leaden","leaden"),("matte","matte"),("pale","pale"),("pearly","pearly"),("polished","polished"),("shiny","shiny"),("smoky","smoky"),
         ("soft","soft"),("steel","steel"),("stone","stone"),("sunny","sunny"),("tarnished","tarnished"),("waxy","waxy"),("wooden","wooden")],
        # 8: objects
        [("anchor","n"),("arrow","n"),("banner","n"),("barrel","n"),("bell","n"),("blade","n"),("book","n"),("bowl","n"),
         ("bridge","n"),("bucket","n"),("candle","n"),("cart","n"),("chain","n"),("chair","n"),("chest","n"),("clock","n"),
         ("coin","n"),("crown","n"),("cup","n"),("door","n"),("drum","n"),("fan","n"),("flag","n"),("flute","n"),
         ("gear","n"),("globe","n"),("hammer","n"),("helmet","n"),("hook","n"),("horn","n"),("jar","n"),("key","n"),
         ("lamp","n"),("ladder","n"),("lock","n"),("mirror","n"),("mug","n"),("needle","n"),("net","n"),("orb","n"),
         ("pail","n"),("pen","n"),("pipe","n"),("plate","n"),("pot","n"),("ring","n"),("rope","n"),("saddle","n"),
         ("scale","n"),("scroll","n"),("shield","n"),("shovel","n"),("spear","n"),("spoon","n"),("staff","n"),("star","n"),
         ("stone","n"),("sword","n"),("table","n"),("torch","n"),("tower","n"),("trumpet","n"),("vase","n"),("wheel","n")],
        # 9: verbs (events)
        [("appears",None),("ascends",None),("awakens",None),("bends",None),("blazes",None),("blooms",None),("breaks",None),("bursts",None),
         ("calls",None),("carries",None),("carves",None),("changes",None),("circles",None),("clears",None),("closes",None),("comes",None),
         ("crashes",None),("creates",None),("crosses",None),("dances",None),("dazzles",None),("descends",None),("drifts",None),("echoes",None),
         ("emerges",None),("fades",None),("falls",None),("feeds",None),("fills",None),("finds",None),("flashes",None),("flies",None),
         ("flows",None),("forms",None),("gathers",None),("glows",None),("grows",None),("guides",None),("hides",None),("hums",None),
         ("joins",None),("jumps",None),("lands",None),("leaves",None),("lights",None),("listens",None),("moves",None),("opens",None),
         ("passes",None),("points",None),("rises",None),("rolls",None),("scatters",None),("shines",None),("sings",None),("sinks",None),
         ("sleeps",None),("speaks",None),("spins",None),("spreads",None),("starts",None),("stirs",None),("stops",None),("turns",None)],
        # 10: prepositions again (use list #4)
        [("above",None),("across",None),("against",None),("along",None),("amid",None),("among",None),("around",None),("at",None),
         ("before",None),("behind",None),("below",None),("beneath",None),("beside",None),("between",None),("beyond",None),("by",None),
         ("down",None),("from",None),("in",None),("inside",None),("into",None),("near",None),("off",None),("on",None),
         ("onto",None),("opposite",None),("outside",None),("over",None),("past",None),("through",None),("toward",None),("under",None),
         ("underneath",None),("up",None),("upon",None),("within",None),("without",None),("about",None),("after",None),("around",None),
         ("atop",None),("beneath",None),("beside",None),("beyond",None),("during",None),("except",None),("inside",None),("like",None),
         ("near",None),("outside",None),("over",None),("round",None),("since",None),("throughout",None),("to",None),("toward",None),
         ("under",None),("until",None),("up",None),("versus",None),("with",None),("within",None),("without",None),("along",None),("amid",None)],
        # 11: adjectives (phenomena)
        [("angry","angry"),("blazing","blazing"),("calm","calm"),("cold","cold"),("crimson","crimson"),("dark","dark"),("electric","electric"),("faint","faint"),
         ("fiery","fiery"),("gentle","gentle"),("glowing","glowing"),("golden","golden"),("gray","gray"),("heavy","heavy"),("hot","hot"),("icy","icy"),
         ("intense","intense"),("light","light"),("luminous","luminous"),("misty","misty"),("pale","pale"),("quiet","quiet"),("radiant","radiant"),("red","red"),
         ("roaring","roaring"),("shining","shining"),("silent","silent"),("silver","silver"),("smooth","smooth"),("soft","soft"),("sparkling","sparkling"),("stormy","stormy"),
         ("strong","strong"),("subtle","subtle"),("sunny","sunny"),("swift","swift"),("thin","thin"),("turbulent","turbulent"),("vast","vast"),("violent","violent"),
         ("warm","warm"),("weary","weary"),("white","white"),("wild","wild"),("windy","windy"),("yellow","yellow"),("young","young"),("ancient","ancient"),
         ("bold","bold"),("bright","bright"),("brilliant","brilliant"),("clear","clear"),("cool","cool"),("deep","deep"),("dim","dim"),("distant","distant"),
         ("frozen","frozen"),("hidden","hidden"),("lofty","lofty"),("quiet","quiet"),("sharp","sharp"),("still","still"),("wide","wide"),("wise","wise")],
        # 12: phenomena
        [("aurora","f"),("beam","m"),("breeze","f"),("cloud","f"),("comet","m"),("current","f"),("dawn","f"),("dusk","m"),
         ("echo","m"),("flame","f"),("flood","f"),("fog","f"),("frost","f"),("gale","m"),("gleam","m"),("glow","m"),
         ("gust","f"),("hail","m"),("heat","m"),("hush","m"),("lightning","m"),("mist","f"),("moon","f"),("rainbow","m"),
         ("ray","m"),("shadow","f"),("shine","m"),("shower","f"),("snow","f"),("spark","f"),("star","f"),("storm","f"),
         ("sun","m"),("thunder","m"),("tide","f"),("twinkle","m"),("wave","f"),("whirl","m"),("wind","m"),("blaze","f"),
         ("bolt","m"),("burst","m"),("chill","m"),("clash","m"),("crack","m"),("drift","f"),("flare","m"),("flicker","m"),
         ("flow","m"),("haze","f"),("light","f"),("rain","f"),("rise","f"),("roar","m"),("rush","m"),("shimmer","m"),
         ("sky","m"),("smoke","m"),("spark","f"),("spray","m"),("stream","f"),("swirl","m"),("wind","m"),("zenith","m")]
    ],
    "ca": [
        # 1: adjectius (estats d'ànim)
        [("silenciós","silenciosa"),("antic","antiga"),("brillant","brillant"),("calmat","calmada"),("curiós","curiosa"),("agosarat","agosarada"),("polsós","polsosa"),("entusiasta","entusiasta"),
         ("gelat","gelada"),("gentil","gentil"),("daurat","daurada"),("ocult","oculta"),("humil","humil"),("solitari","solitària"),("afortunat","afortunada"),("poderós","poderosa"),
         ("estret","estreta"),("noble","noble"),("juguetó","juguetona"),("orgullós","orgullosa"),("ràpid","ràpida"),("quiet","quieta"),("rar","rara"),("inquiet","inquieta"),
         ("lluent","lluent"),("tímid","tímida"),("simple","simple"),("lent","lenta"),("petit","petita"),("suau","suau"),("tou","tova"),("fort","forta"),
         ("subtil","subtil"),("velaç","velaç"),("diminut","diminuta"),("vast","vasta"),("càlid","càlida"),("cansat","cansada"),("salvatge","salvatge"),("savi","sàvia"),
         ("valent","valenta"),("valent","valenta"),("clar","clara"),("fred","freda"),("fosc","fosca"),("profund","profunda"),("impacient","impacient"),("feble","feble"),
         ("ardent","ardent"),("lliure","lliure"),("fresc","fresca"),("gran","gran"),("feliç","feliç"),("pesat","pesada"),("amable","amable"),("lleuger","lleugera"),
         ("animat","animada"),("afilat","afilada"),("intel·ligent","intel·ligent"),("estrany","estranya"),("dolç","dolça"),("alt","alta"),("immens","immensa"),("jove","jove")],
        # 2: animals
        [("formiga","f"),("ós","m"),("gat","m"),("corb","m"),("cérvol","m"),("gos","m"),("colom","m"),("àguila","f"),
         ("guineu","f"),("granota","f"),("cabra","f"),("falcó","m"),("cavall","m"),("lleó","m"),("llangardaix","m"),("talp","m"),
         ("ratolí","m"),("mussol","m"),("bou","m"),("porc","m"),("conill","m"),("rata","f"),("foca","f"),("tauró","m"),
         ("ovella","f"),("serp","f"),("aranya","f"),("cigne","m"),("tigre","m"),("gripau","m"),("llop","m"),("zebra","f"),
         ("ratpenat","m"),("bisó","m"),("camell","m"),("guepard","m"),("cobra","f"),("cranc","m"),("ànec","m"),("falcó","m"),
         ("peix","m"),("dragó","m"),("oca","f"),("gavina","f"),("jaguar","m"),("medusa","f"),("lleopard","m"),("linx","m"),
         ("mico","m"),("pop","m"),("panda","m"),("lloro","m"),("pingüí","m"),("corb","m"),("salmó","m"),("escorpí","m"),
         ("gamba","f"),("calamar","m"),("esquirol","m"),("tortuga","f"),("voltor","m"),("balena","f"),("vespa","f"),("iac","m")],
        # 3: verbs (moviment)
        [("s'arqueja",None),("s'equilibra",None),("bota",None),("s'enfila",None),("balla",None),("flota",None),("cau",None),("vola",None),
         ("planeja",None),("salta",None),("brinca",None),("marxa",None),("roda",None),("corre",None),("navega",None),("canvia",None),
         ("brilla",None),("lllisca",None),("s'eleva",None),("gira",None),("brolla",None),("camina",None),("passeja",None),("neda",None),
         ("es gronxa",None),("trontolla",None),("gira",None),("camina",None),("avança",None),("deambula",None),("teixeix",None),("accelera",None),
         ("vagueja",None),("ascendeix",None),("esclata",None),("s'arrossega",None),("es llança",None),("s'afanya",None),("se submergeix",None),("cau",None),
         ("emergeix",None),("flueix",None),("creix",None),("s'apressa",None),("salta",None),("aguaita",None),("es mou",None),("passa",None),
         ("merodeja",None),("competeix",None),("s'aixeca",None),("irromp",None),("s'assenta",None),("s'enfonsa",None),("saltironeja",None),("es desplaça",None),
         ("irromp",None),("avança",None),("avança",None),("escombra",None),("fa giragonses",None),("salta",None),("vaga",None),("zigzagueja",None)],
        # 4: preposicions
        [("sobre",None),("a través de",None),("contra",None),("al llarg de",None),("enmig de",None),("entre",None),("al voltant de",None),("a",None),
         ("abans de",None),("darrere de",None),("sota",None),("sota",None),("al costat de",None),("entre",None),("més enllà de",None),("per",None),
         ("avall",None),("des de",None),("dins de",None),("a dins",None),("cap a",None),("prop de",None),("fora de",None),("sobre",None),
         ("a sobre de",None),("davant de",None),("a fora",None),("per sobre de",None),("més enllà",None),("a través de",None),("cap a",None),("sota",None),
         ("per sota",None),("amunt",None),("sobre",None),("dins de",None),("sense",None),("sobre",None),("després",None),("al voltant de",None),
         ("al cim de",None),("sota de",None),("al costat de",None),("més enllà de",None),("durant",None),("excepte",None),("dins de",None),("com",None),
         ("prop de",None),("fora de",None),("per sobre de",None),("al voltant de",None),("des de",None),("al llarg de",None),("a",None),("cap a",None),
         ("sota",None),("fins a",None),("amunt",None),("contra",None),("amb",None),("dins de",None),("sense",None),("al llarg de",None),("enmig de",None)],
        # 5: adjectius (paisatges)
        [("àrid","àrida"),("erm","erma"),("abrusador","abrusadora"),("ventós","ventosa"),("lluminós","lluminosa"),("fresc","fresca"),("trencat","trencada"),("calmat","calmada"),
         ("ennuvolat","ennuvolada"),("tort","torta"),("dens","densa"),("llunyà","llunyana"),("sec","seca"),("polsós","polsosa"),("inquietant","inquietant"),("fèrtil","fèrtil"),
         ("boirós","boirosa"),("fresc","fresca"),("gelat","gelada"),("resplendent","resplendent"),("lluent","lluent"),("daurat","daurada"),("gris","grisa"),("tètric","tètrica"),
         ("humit","humida"),("glaçat","glaçada"),("irregular","irregular"),("exuberant","exuberant"),("nebulós","nebulosa"),("fangós","fangosa"),("estret","estreta"),("obert","oberta"),
         ("ressec","resseca"),("radiant","radiant"),("plujós","plujosa"),("rocós","rocosa"),("aspre","aspra"),("escarpat","escarpada"),("sorrenc","sorrenca"),("ombrívol","ombrívola"),
         ("silenciós","silenciosa"),("llis","llisa"),("nevat","nevada"),("suau","suau"),("sòlid","sòlida"),("empinat","empinada"),("quiet","quieta"),("tempestuós","tempestuosa"),
         ("assolellat","assolellada"),("càlid","càlida"),("humit","humida"),("ample","ampla"),("salvatge","salvatge"),("ventós","ventosa"),("boscós","boscosa"),("desgastat","desgastada"),
         ("antic","antiga"),("verd","verda"),("amagat","amagada"),("buit","buida"),("pàl·lid","pàl·lida"),("rosa","rosa"),("vermell","vermella"),("platejat","platejada"),
         ("auster","austera"),("prim","prima"),("vast","vasta"),("groc","groga")],
        # 6: llocs
        [("badia","f"),("platja","f"),("penya-segat","m"),("pont","m"),("canyó","m"),("cova","f"),("precipici","m"),("costa","f"),
         ("cràter","m"),("rierol","m"),("delta","m"),("desert","m"),("duna","f"),("bosc","m"),("glacera","f"),("arbreda","f"),
         ("port","m"),("turó","m"),("illa","f"),("jungla","f"),("llacuna","f"),("llac","m"),("prat","m"),("muntanya","f"),
         ("oasi","m"),("oceà","m"),("parc","m"),("camí","m"),("cim","m"),("plana","f"),("estany","m"),("pedrera","f"),
         ("escull","m"),("carena","f"),("riu","m"),("carretera","f"),("sabana","f"),("mar","m"),("riba","f"),("font","f"),
         ("pantà","m"),("terrassa","f"),("sender","m"),("vall","f"),("poble","m"),("volcà","m"),("cascada","f"),("bosc","m"),
         ("arc","m"),("arena","f"),("graner","m"),("castell","m"),("capella","f"),("ciutat","f"),("camp","m"),("fort","m"),
         ("jardí","m"),("porta","f"),("port","m"),("refugi","m"),("mercat","m"),("plaça","f"),("port","m"),("torre","f")],
        # 7: adjectius (objectes)
        [("ambre","ambre"),("atzur","atzur"),("beix","beix"),("negre","negra"),("blau","blava"),("bronze","bronze"),("marró","marró"),("carmesí","carmesí"),
         ("maragda","maragda"),("or","or"),("gris","grisa"),("verd","verda"),("índigo","índigo"),("ivori","ivori"),("jade","jade"),("caqui","caqui"),
         ("lavanda","lavanda"),("llima","llima"),("magenta","magenta"),("grana","grana"),("marí","marina"),("ocre","ocre"),("oliva","oliva"),("taronja","taronja"),
         ("préssec","préssec"),("rosa","rosa"),("pruna","pruna"),("porpra","porpra"),("vermell","vermella"),("rosa","rosa"),("robí","robí"),("safrà","safrà"),
         ("escarlata","escarlata"),("plata","plata"),("marró clar","marró clar"),("turquesa","turquesa"),("turquesa","turquesa"),("violeta","violeta"),("blanc","blanca"),("groc","groga"),
         ("cendrós","cendrosa"),("llautó","llautó"),("calcari","calcària"),("coure","coure"),("polsós","polsosa"),("daurat","daurada"),("brillant","brillant"),("llustrós","llustrosa"),
         ("marfil","marfil"),("plomís","plomissa"),("mat","mat"),("pàl·lid","pàl·lida"),("perlat","perlada"),("polit","polida"),("lluent","lluent"),("fumat","fumada"),
         ("suau","suau"),("acer","acer"),("pedra","pedra"),("assolellat","assolellada"),("deslluït","deslluïda"),("cerós","cerosa"),("de fusta","de fusta")],
        # 8: objectes
        [("àncora","f"),("fletxa","f"),("estendard","m"),("barril","m"),("campana","f"),("fulla","f"),("llibre","m"),("bol","m"),
         ("pont","m"),("galleda","f"),("espelma","f"),("carro","m"),("cadena","f"),("cadira","f"),("cofre","m"),("rellotge","m"),
         ("moneda","f"),("corona","f"),("tassa","f"),("porta","f"),("tambor","m"),("ventilador","m"),("bandera","f"),("flauta","f"),
         ("engranatge","m"),("globus","m"),("martell","m"),("casc","m"),("ganxo","m"),("banya","f"),("pot","m"),("clau","f"),
         ("làmpada","f"),("escala","f"),("pany","m"),("mirall","m"),("tassa","f"),("agulla","f"),("xarxa","f"),("orb","m"),
         ("galleda","f"),("ploma","f"),("pipa","f"),("plat","m"),("olla","f"),("anell","m"),("corda","f"),("sella","f"),
         ("balança","f"),("pergamí","m"),("escut","m"),("pala","f"),("llança","f"),("cullera","f"),("bastó","m"),("estrella","f"),
         ("pedra","f"),("espasa","f"),("taula","f"),("torxa","f"),("torre","f"),("trompeta","f"),("gerro","m"),("roda","f")],
        # 9: verbs (esdeveniments)
        [("apareix",None),("ascendeix",None),("desperta",None),("es doblega",None),("flameja",None),("floreix",None),("es trenca",None),("esclata",None),
         ("crida",None),("transporta",None),("esculpeix",None),("canvia",None),("encercla",None),("s'aclareix",None),("es tanca",None),("arriba",None),
         ("xoca",None),("crea",None),("creua",None),("balla",None),("enlluerna",None),("descendeix",None),("deriva",None),("ressona",None),
         ("emergeix",None),("s'esvaeix",None),("cau",None),("alimenta",None),("omple",None),("troba",None),("reflla",None),("vola",None),
         ("flueix",None),("forma",None),("reuneix",None),("resplendeix",None),("creix",None),("guia",None),("s'amaga",None),("brunzeix",None),
         ("s'uneix",None),("salta",None),("aterra",None),("marxa",None),("il·lumina",None),("escolta",None),("es mou",None),("s'obre",None),
         ("passa",None),("assenyala",None),("s'aixeca",None),("roda",None),("escampa",None),("brilla",None),("canta",None),("s'enfonsa",None),
         ("dorm",None),("parla",None),("gira",None),("s'estén",None),("comença",None),("es mou",None),("s'atura",None),("gira",None)],
        # 10: preposicions (còpia de la llista 4)
        [("sobre",None),("a través de",None),("contra",None),("al llarg de",None),("enmig de",None),("entre",None),("al voltant de",None),("a",None),
         ("abans de",None),("darrere de",None),("sota",None),("sota",None),("al costat de",None),("entre",None),("més enllà de",None),("per",None),
         ("avall",None),("des de",None),("dins de",None),("a dins",None),("cap a",None),("prop de",None),("fora de",None),("sobre",None),
         ("a sobre de",None),("davant de",None),("a fora",None),("per sobre de",None),("més enllà",None),("a través de",None),("cap a",None),("sota",None),
         ("per sota",None),("amunt",None),("sobre",None),("dins de",None),("sense",None),("sobre",None),("després",None),("al voltant de",None),
         ("al cim de",None),("sota de",None),("al costat de",None),("més enllà de",None),("durant",None),("excepte",None),("dins de",None),("com",None),
         ("prop de",None),("fora de",None),("per sobre de",None),("al voltant de",None),("des de",None),("al llarg de",None),("a",None),("cap a",None),
         ("sota",None),("fins a",None),("amunt",None),("contra",None),("amb",None),("dins de",None),("sense",None),("al llarg de",None),("enmig de",None)],
        # 11: adjectius (fenòmens)
        [("furiós","furiosa"),("flamejant","flamejant"),("calmat","calmada"),("fred","freda"),("carmesí","carmesí"),("fosc","fosca"),("elèctric","elèctrica"),("feble","feble"),
         ("ardent","ardent"),("gentil","gentil"),("lluent","lluent"),("daurat","daurada"),("gris","grisa"),("pesat","pesada"),("calent","calenta"),("glaçat","glaçada"),
         ("intens","intensa"),("lleuger","lleugera"),("lluminós","lluminosa"),("nebulós","nebulosa"),("pàl·lid","pàl·lida"),("quiet","quieta"),("radiant","radiant"),("vermell","vermella"),
         ("rugent","rugent"),("brillant","brillant"),("silenciós","silenciosa"),("platejat","platejada"),("suau","suau"),("tou","tova"),("espurnejant","espurnejant"),("tempestuós","tempestuosa"),
         ("fort","forta"),("subtil","subtil"),("assolellat","assolellada"),("velaç","velaç"),("prim","prima"),("turbulent","turbulenta"),("vast","vasta"),("violent","violenta"),
         ("càlid","càlida"),("cansat","cansada"),("blanc","blanca"),("salvatge","salvatge"),("ventós","ventosa"),("groc","groga"),("jove","jove"),("antic","antiga"),
         ("valent","valenta"),("brillant","brillant"),("brillant","brillant"),("clar","clara"),("fresc","fresca"),("profund","profunda"),("tènue","tènue"),("llunyà","llunyana"),
         ("gelat","gelada"),("amagat","amagada"),("alt","alta"),("quiet","quieta"),("afilat","afilada"),("immòbil","immòbil"),("ample","ampla"),("savi","sàvia")],
        # 12: fenòmens
        [("aurora","f"),("raig","m"),("brisa","f"),("núvol","m"),("cometa","m"),("corrent","m"),("alba","f"),("crepuscle","m"),
         ("eco","m"),("flama","f"),("inundació","f"),("boira","f"),("gebrada","f"),("vendaval","m"),("llampada","f"),("resplendor","f"),
         ("ràfega","f"),("calamarsa","f"),("calor","f"),("silenci","m"),("llamp","m"),("boirina","f"),("lluna","f"),("arc de Sant Martí","m"),
         ("raig","m"),("ombra","f"),("brillantor","f"),("ruixat","m"),("neu","f"),("espurna","f"),("estrella","f"),("tempesta","f"),
         ("sol","m"),("tro","m"),("marea","f"),("pampalluga","f"),("ona","f"),("remolí","m"),("vent","m"),("flamarada","f"),
         ("llamp","m"),("esclat","m"),("fredor","f"),("xoc","m"),("cruixit","m"),("deriva","f"),("flamarada","f"),("parpelleig","m"),
         ("flux","m"),("calima","f"),("llum","f"),("pluja","f"),("ascens","m"),("rugit","m"),("embranzida","f"),("lluïssor","f"),
         ("cel","m"),("fum","m"),("guspira","f"),("esprai","m"),("corrent","m"),("remolí","m"),("vent","m"),("zenit","m")]
    ],
    "es": [
        # 1: adjetivos (estados de ánimo)
        [("silencioso","silenciosa"),("antiguo","antigua"),("brillante","brillante"),("calmo","calma"),("curioso","curiosa"),("audaz","audaz"),("polvoriento","polvorienta"),("ansioso","ansiosa"),
         ("helado","helada"),("gentil","gentil"),("dorado","dorada"),("oculto","oculta"),("humilde","humilde"),("solitario","solitaria"),("afortunado","afortunada"),("poderoso","poderosa"),
         ("estrecho","estrecha"),("noble","noble"),("juguetón","juguetona"),("orgulloso","orgullosa"),("rápido","rápida"),("quieto","quieta"),("raro","rara"),("inquieto","inquieta"),
         ("reluciente","reluciente"),("tímido","tímida"),("simple","simple"),("lento","lenta"),("pequeño","pequeña"),("suave","suave"),("suave","suave"),("fuerte","fuerte"),
         ("sutil","sutil"),("veloz","veloz"),("diminuto","diminuta"),("vasto","vasta"),("cálido","cálida"),("cansado","cansada"),("salvaje","salvaje"),("sabio","sabia"),
         ("valiente","valiente"),("valeroso","valerosa"),("claro","clara"),("frío","fría"),("oscuro","oscura"),("profundo","profunda"),("deseoso","deseosa"),("débil","débil"),
         ("ardiente","ardiente"),("libre","libre"),("fresco","fresca"),("grandioso","grandiosa"),("feliz","feliz"),("pesado","pesada"),("amable","amable"),("ligero","ligera"),
         ("animado","animada"),("afilado","afilada"),("listo","lista"),("extraño","extraña"),("dulce","dulce"),("alto","alta"),("inmenso","inmensa"),("joven","joven")],
        # 2: animales
        [("hormiga","f"),("oso","m"),("gato","m"),("cuervo","m"),("ciervo","m"),("perro","m"),("paloma","f"),("águila","f"),
         ("zorro","m"),("rana","f"),("cabra","f"),("halcón","m"),("caballo","m"),("león","m"),("lagarto","m"),("topo","m"),
         ("ratón","m"),("búho","m"),("buey","m"),("cerdo","m"),("conejo","m"),("rata","f"),("foca","f"),("tiburón","m"),
         ("oveja","f"),("serpiente","f"),("araña","f"),("cisne","m"),("tigre","m"),("sapo","m"),("lobo","m"),("cebra","f"),
         ("murciélago","m"),("bisonte","m"),("camello","m"),("guepardo","m"),("cobra","f"),("cangrejo","m"),("pato","m"),("halcón","m"),
         ("pez","m"),("geco","m"),("ganso","m"),("gaviota","f"),("jaguar","m"),("medusa","f"),("leopardo","m"),("lince","m"),
         ("mono","m"),("pulpo","m"),("panda","m"),("loro","m"),("pingüino","m"),("cuervo","m"),("salmón","m"),("escorpión","m"),
         ("camarón","m"),("calamar","m"),("ardilla","f"),("tortuga","f"),("buitre","m"),("ballena","f"),("avispa","f"),("yak","m")],
        # 3: verbos (movimiento)
        [("se arquea",None),("se balancea",None),("rebota",None),("trepa",None),("baila",None),("flota",None),("cae",None),("vuela",None),
         ("planea",None),("salta",None),("brinca",None),("marcha",None),("rueda",None),("corre",None),("navega",None),("cambia",None),
         ("brilla",None),("se desliza",None),("se eleva",None),("gira",None),("brota",None),("da pasos",None),("pasea",None),("nada",None),
         ("se columpia",None),("se tambalea",None),("gira",None),("camina",None),("avanza",None),("deambula",None),("teje",None),("acelera",None),
         ("vaga",None),("asciende",None),("irrumpe",None),("se arrastra",None),("se lanza",None),("se precipita",None),("se zambulle",None),("cae",None),
         ("emerge",None),("fluye",None),("crece",None),("se apresura",None),("salta",None),("acecha",None),("se mueve",None),("pasa",None),
         ("merodea",None),("compite",None),("se alza",None),("se precipita",None),("se asienta",None),("se hunde",None),("brinca",None),("se desliza",None),
         ("irrumpe",None),("avanza",None),("embiste",None),("barre",None),("da vueltas",None),("salta",None),("vaga",None),("zigzaguea",None)],
        # 4: preposiciones
        [("sobre",None),("a través de",None),("contra",None),("a lo largo de",None),("en medio de",None),("entre",None),("alrededor de",None),("en",None),
         ("antes de",None),("detrás de",None),("bajo",None),("debajo de",None),("junto a",None),("entre",None),("más allá de",None),("por",None),
         ("abajo",None),("desde",None),("en",None),("adentro",None),("hacia",None),("cerca de",None),("fuera de",None),("sobre",None),
         ("encima de",None),("frente a",None),("afuera",None),("por encima de",None),("pasado",None),("a través de",None),("hacia",None),("bajo",None),
         ("por debajo de",None),("arriba",None),("sobre",None),("dentro de",None),("sin",None),("acerca de",None),("después de",None),("alrededor de",None),
         ("en la cima de",None),("debajo de",None),("al lado de",None),("más allá de",None),("durante",None),("excepto",None),("dentro de",None),("como",None),
         ("cerca de",None),("fuera de",None),("sobre",None),("alrededor de",None),("desde",None),("a lo largo de",None),("a",None),("hacia",None),
         ("bajo",None),("hasta",None),("arriba",None),("contra",None),("con",None),("dentro de",None),("sin",None),("a lo largo de",None),("en medio de",None)],
        # 5: adjetivos (paisajes)
        [("árido","árida"),("yermo","yerma"),("abrasador","abrasadora"),("airoso","airosa"),("brillante","brillante"),("enérgico","enérgica"),("roto","rota"),("calmo","calma"),
         ("nublado","nublada"),("torcido","torcida"),("denso","densa"),("distante","distante"),("seco","seca"),("polvoriento","polvorienta"),("inquietante","inquietante"),("fértil","fértil"),
         ("brumoso","brumosa"),("fresco","fresca"),("helado","helada"),("reluciente","reluciente"),("resplandeciente","resplandeciente"),("dorado","dorada"),("gris","gris"),("sombrío","sombría"),
         ("húmedo","húmeda"),("gélido","gélida"),("irregular","irregular"),("exuberante","exuberant"),("neblinoso","neblinosa"),("fangoso","fangosa"),("estrecho","estrecha"),("abierto","abierta"),
         ("reseco","reseca"),("radiante","radiante"),("lluvioso","lluviosa"),("rocoso","rocosa"),("áspero","áspera"),("escarpado","escarpada"),("arenoso","arenosa"),("sombrío","sombría"),
         ("silencioso","silenciosa"),("liso","lisa"),("nevado","nevada"),("suave","suave"),("sólido","sólida"),("empinado","empinada"),("quieto","quieta"),("tormentoso","tormentosa"),
         ("soleado","soleada"),("cálido","cálida"),("mojado","mojada"),("ancho","ancha"),("salvaje","salvaje"),("ventoso","ventosa"),("boscoso","boscosa"),("desgastado","desgastada"),
         ("antiguo","antigua"),("verde","verde"),("oculto","oculta"),("hueco","hueca"),("pálido","pálida"),("rosa","rosa"),("rojo","roja"),("plateado","plateada"),
         ("austero","austera"),("delgado","delgada"),("vasto","vasta"),("amarillo","amarilla")],
        # 6: lugares
        [("bahía","f"),("playa","f"),("acantilado","m"),("puente","m"),("cañón","m"),("cueva","f"),("precipicio","m"),("costa","f"),
         ("cráter","m"),("arroyo","m"),("delta","m"),("desierto","m"),("duna","f"),("bosque","m"),("glaciar","m"),("arboleda","f"),
         ("puerto","m"),("colina","f"),("isla","f"),("jungla","f"),("laguna","f"),("lago","m"),("prado","m"),("montaña","f"),
         ("oasis","m"),("océano","m"),("parque","m"),("sendero","m"),("cima","f"),("llanura","f"),("estanque","m"),("cantera","f"),
         ("arrecife","m"),("cresta","f"),("río","m"),("camino","m"),("sabana","f"),("mar","m"),("orilla","f"),("manantial","m"),
         ("pantano","m"),("terraza","f"),("sendero","m"),("valle","m"),("aldea","f"),("volcán","m"),("cascada","f"),("bosque","m"),
         ("arco","m"),("arena","f"),("granero","m"),("castillo","m"),("capilla","f"),("ciudad","f"),("campo","m"),("fuerte","m"),
         ("jardín","m"),("puerta","f"),("puerto","m"),("refugio","m"),("mercado","m"),("plaza","f"),("puerto","m"),("torre","f")],
        # 7: adjetivos (objetos)
        [("ámbar","ámbar"),("azur","azur"),("beige","beige"),("negro","negra"),("azul","azul"),("bronce","bronce"),("marrón","marrón"),("carmesí","carmesí"),
         ("esmeralda","esmeralda"),("oro","oro"),("gris","gris"),("verde","verde"),("índigo","índigo"),("marfil","marfil"),("jade","jade"),("caqui","caqui"),
         ("lavanda","lavanda"),("lima","lima"),("magenta","magenta"),("granate","granate"),("marino","marina"),("ocre","ocre"),("oliva","oliva"),("naranja","naranja"),
         ("melocotón","melocotón"),("rosa","rosa"),("ciruela","ciruela"),("púrpura","púrpura"),("rojo","roja"),("rosa","rosa"),("rubí","rubí"),("azafrán","azafrán"),
         ("escarlata","escarlata"),("plata","plata"),("canela","canela"),("verde azulado","verde azulado"),("turquesa","turquesa"),("violeta","violeta"),("blanco","blanca"),("amarillo","amarilla"),
         ("ceniciento","cenicienta"),("latón","latón"),("gredoso","gredosa"),("cobre","cobre"),("polvoriento","polvorienta"),("dorado","dorada"),("brillante","brillante"),("lustroso","lustrosa"),
         ("marfil","marfil"),("plomizo","plomiza"),("mate","mate"),("pálido","pálida"),("perlado","perlada"),("pulido","pulida"),("reluciente","reluciente"),("ahumado","ahumada"),
         ("suave","suave"),("acero","acero"),("piedra","piedra"),("soleado","soleada"),("deslustrado","deslustrada"),("ceroso","cerosa"),("de madera","de madera")],
        # 8: objetos
        [("ancla","f"),("flecha","f"),("estandarte","m"),("barril","m"),("campana","f"),("hoja","f"),("libro","m"),("cuenco","m"),
         ("puente","m"),("cubo","m"),("vela","f"),("carro","m"),("cadena","f"),("silla","f"),("cofre","m"),("reloj","m"),
         ("moneda","f"),("corona","f"),("taza","f"),("puerta","f"),("tambor","m"),("abanico","m"),("bandera","f"),("flauta","f"),
         ("engranaje","m"),("globus","m"),("martillo","m"),("casco","m"),("gancho","m"),("cuerno","m"),("jarra","f"),("llave","f"),
         ("lámpara","f"),("escalera","f"),("cerradura","f"),("espejo","m"),("taza","f"),("aguja","f"),("red","f"),("orbe","m"),
         ("cubo","m"),("pluma","f"),("pipa","f"),("plato","m"),("olla","f"),("anillo","m"),("cuerda","f"),("silla de montar","f"),
         ("balanza","f"),("pergamino","m"),("escudo","m"),("pala","f"),("lanza","f"),("cuchara","f"),("báculo","m"),("estrella","f"),
         ("piedra","f"),("espada","f"),("mesa","f"),("antorcha","f"),("torre","f"),("trompeta","f"),("jarrón","m"),("rueda","f")],
        # 9: verbos (eventos)
        [("aparece",None),("asciende",None),("despierta",None),("se dobla",None),("arde",None),("florece",None),("se rompe",None),("estalla",None),
         ("llama",None),("transporta",None),("esculpe",None),("cambia",None),("circula",None),("se despeja",None),("se cierra",None),("llega",None),
         ("choca",None),("crea",None),("cruza",None),("baila",None),("deslumbra",None),("desciende",None),("deriva",None),("resuena",None),
         ("emerge",None),("se desvanece",None),("cae",None),("alimenta",None),("llena",None),("encuentra",None),("destella",None),("vuela",None),
         ("fluye",None),("forma",None),("reúne",None),("brilla",None),("crece",None),("guía",None),("se esconde",None),("zumba",None),
         ("se une",None),("salta",None),("aterriza",None),("se va",None),("ilumina",None),("escucha",None),("se mueve",None),("se abre",None),
         ("pasa",None),("señala",None),("se eleva",None),("rueda",None),("esparce",None),("brilla",None),("canta",None),("se hunde",None),
         ("duerme",None),("habla",None),("gira",None),("se extiende",None),("comienza",None),("se agita",None),("se detiene",None),("gira",None)],
        # 10: preposiciones (copia de la llista 4)
        [("sobre",None),("a través de",None),("contra",None),("a lo largo de",None),("en medio de",None),("entre",None),("alrededor de",None),("en",None),
         ("antes de",None),("detrás de",None),("bajo",None),("debajo de",None),("junto a",None),("entre",None),("más allá de",None),("por",None),
         ("abajo",None),("desde",None),("en",None),("adentro",None),("hacia",None),("cerca de",None),("fuera de",None),("sobre",None),
         ("encima de",None),("frente a",None),("afuera",None),("por encima de",None),("pasado",None),("a través de",None),("hacia",None),("bajo",None),
         ("por debajo de",None),("arriba",None),("sobre",None),("dentro de",None),("sin",None),("acerca de",None),("después de",None),("alrededor de",None),
         ("en la cima de",None),("debajo de",None),("al lado de",None),("más allá de",None),("durante",None),("excepto",None),("dentro de",None),("como",None),
         ("cerca de",None),("fuera de",None),("sobre",None),("alrededor de",None),("desde",None),("a lo largo de",None),("a",None),("hacia",None),
         ("bajo",None),("hasta",None),("arriba",None),("contra",None),("con",None),("dentro de",None),("sin",None),("a lo largo de",None),("en medio de",None)],
        # 11: adjetivos (fenómenos)
        [("furioso","furiosa"),("flameante","flameante"),("calmo","calma"),("frío","fría"),("carmesí","carmesí"),("oscuro","oscura"),("eléctrico","eléctrica"),("débil","débil"),
         ("ardiente","ardiente"),("gentil","gentil"),("brillante","brillante"),("dorado","dorada"),("gris","gris"),("pesado","pesada"),("caliente","caliente"),("gélido","gélida"),
         ("intenso","intensa"),("ligero","ligera"),("luminoso","luminosa"),("neblinoso","neblinosa"),("pálido","pálida"),("quieto","quieta"),("radiante","radiante"),("rojo","roja"),
         ("rugiente","rugiente"),("brillante","brillante"),("silencioso","silenciosa"),("plateado","plateada"),("suave","suave"),("suave","suave"),("chispeante","chispeante"),("tormentoso","tormentosa"),
         ("fuerte","fuerte"),("sutil","sutil"),("soleado","soleada"),("veloz","veloz"),("delgado","delgada"),("turbulento","turbulenta"),("vasto","vasta"),("violento","violenta"),
         ("cálido","cálida"),("cansado","cansada"),("blanco","blanca"),("salvaje","salvaje"),("ventoso","ventosa"),("amarillo","amarilla"),("joven","joven"),("antiguo","antigua"),
         ("audaz","audaz"),("brillante","brillante"),("brillante","brillante"),("claro","clara"),("fresco","fresca"),("profundo","profunda"),("tenue","tenue"),("distante","distante"),
         ("helado","helada"),("oculto","oculta"),("elevado","elevada"),("silencioso","silenciosa"),("afilado","afilada"),("inmóvil","inmóvil"),("ancho","ancha"),("sabio","sabia")],
        # 12: fenómenos
        [("aurora","f"),("rayo","m"),("brisa","f"),("nube","f"),("cometa","m"),("corriente","f"),("alba","f"),("ocaso","m"),
         ("eco","m"),("llama","f"),("inundación","f"),("niebla","f"),("escarcha","f"),("vendaval","m"),("destello","m"),("brillo","m"),
         ("ráfaga","f"),("granizo","m"),("calor","m"),("silencio","m"),("relámpago","m"),("neblina","f"),("luna","f"),("arcoíris","m"),
         ("rayo","m"),("sombra","f"),("brillo","m"),("chaparrón","m"),("nieve","f"),("chispa","f"),("estrella","f"),("tormenta","f"),
         ("sol","m"),("trueno","m"),("marea","f"),("parpadeo","m"),("ola","f"),("remolino","m"),("viento","m"),("llamarada","f"),
         ("rayo","m"),("explosión","f"),("frío","m"),("choque","m"),("crujido","m"),("deriva","f"),("destello","m"),("parpadeo","m"),
         ("flujo","m"),("bruma","f"),("luz","f"),("lluvia","f"),("ascenso","m"),("rugido","m"),("embestida","f"),("resplandor","m"),
         ("cielo","m"),("humo","m"),("chispa","f"),("rocío","m"),("corriente","f"),("remolino","m"),("viento","m"),("cenit","m")]
    ]
}

# -------------------------------
# 2. Encode / decode functions
# -------------------------------

def _get_gendered_components(lang, noun_tuple, adj_tuple):
    """Helper to get correct article and adjective form based on noun gender."""
    noun, gender = noun_tuple
    adj_masc, adj_fem = adj_tuple
    
    if lang == "en":
        return "the", adj_masc, noun
        
    if gender == "f":
        adj = adj_fem
        article = "la"
        # Spanish rule: use 'el' for feminine nouns starting with stressed 'a' or 'ha'
        if lang == "es" and (noun.startswith("a") or noun.startswith("ha")):
            article = "el"
    else: # gender == "m"
        adj = adj_masc
        article = "el"

    # Catalan rule: use 'l\'' before a vowel
    if lang == "ca" and noun[0] in "aeiouhAEIOUH":
        # A small simplification, as there are exceptions, but good for most cases.
        article = "l'"
        
    return article, adj, noun


def gaia_to_sentence(gaia_id, lang="en"):
    """Convert Gaia 64-bit ID to a 12-word sentence, handling grammatical gender."""
    lists = word_lists[lang]
    assert len(lists) == 12, "Need 12 word lists per language"
    
    # Convert ID into 12 base-64 indices
    indices = []
    for l in reversed(range(12)):
        indices.append(gaia_id % 64)
        gaia_id //= 64
    indices.reverse()
    
    # Get the raw word tuples from the lists
    raw_words = [lists[i][indices[i]] for i in range(12)]
    
    # Process gender for the four noun/adjective pairs
    art1, adj1, noun1 = _get_gendered_components(lang, raw_words[1], raw_words[0])
    art2, adj2, noun2 = _get_gendered_components(lang, raw_words[5], raw_words[4])
    art3, adj3, noun3 = _get_gendered_components(lang, raw_words[7], raw_words[6])
    art4, adj4, noun4 = _get_gendered_components(lang, raw_words[11], raw_words[10])

    # Get verbs and prepositions (they don't have gender variants)
    verb1 = raw_words[2][0]
    prep1 = raw_words[3][0]
    verb2 = raw_words[8][0]
    prep2 = raw_words[9][0]

    # Assemble the sentence using language-specific templates and word order
    if lang == 'ca':
        # Order: Article + Noun + Adjective
        sentence = f"{art1.capitalize()} {noun1} {adj1} {verb1} {prep1} {art2} {noun2} {adj2}, mentre que {art3} {noun3} {adj3} {verb2} {prep2} {art4} {noun4} {adj4}."
    elif lang == 'es':
        # Order: Article + Noun + Adjective
        sentence = f"{art1.capitalize()} {noun1} {adj1} {verb1} {prep1} {art2} {noun2} {adj2}, mientras que {art3} {noun3} {adj3} {verb2} {prep2} {art4} {noun4} {adj4}."
    else: # English default
        # Order: Article + Adjective + Noun
        sentence = f"{art1.capitalize()} {adj1} {noun1} {verb1} {prep1} {art2} {adj2} {noun2}, while {art3} {adj3} {noun3} {verb2} {prep2} {art4} {adj4} {noun4}."
        
    return sentence

# -------------------------------
# 3. Example Gaia IDs
# -------------------------------
example_ids = [
    1234567890123456789,
    9876543210987654321,
    3141592653589793238,
    2718281828459045235,
    1618033988749894848,
    1123581321345589144,
    1414213562373095048,
    1732050807568877293,
    2236067977499789696,
    2469135782469135782
]

# -------------------------------
# 4. Print examples
# -------------------------------
for gaia_id in example_ids:
    print("\n---")
    print("GaiaDR3 " + str(gaia_id))
    print("English:")
    print(gaia_to_sentence(gaia_id, lang="en"))
    print("Catalan:")
    print(gaia_to_sentence(gaia_id, lang="ca"))
    print("Spanish:")
    print(gaia_to_sentence(gaia_id, lang="es"))