/* ---------- histoire ---------- */
const STORY = {
  intro: [
    { title: 'La crypte', text: 'Sous la ville, une porte que personne ne ferme. Derrière, des marches qui descendent et ne remontent pas. Ceux qui les prennent ne reviennent jamais. Pourtant, chaque nuit, quelqu’un descend.' },
    { title: 'L’essence', text: 'Tout ce qui meurt ici laisse un éclat : l’essence ◆. La crypte s’en nourrit, s’en souvient, et se rebâtit avec. Ramasse-la. Ce que tu remontes, elle ne pourra plus l’utiliser contre toi.' },
    { title: 'Le Voile', text: 'Entre la pierre et son reflet, une toile mince : le Voile. Chaque mort le déchire un peu. Quand il s’ouvre, on peut passer de l’autre côté. Là-bas, rien ne tient. Là-bas, tout se paie double.' },
    { title: 'Toi', text: 'Tu n’as pas de nom ici. Seulement une capuche, une arme, et ce que tu es prêt ou prête à promettre. Descends. Si tu tombes, la crypte se souviendra de toi. C’est sa seule pitié.' },
  ],

  biomes: {
    crypte: [
      'Les torches meurent une à une. Quelqu’un les a allumées avant toi, et il n’est jamais remonté.',
      'Même pierre, même froid. Les catacombes t’ont reconnu. Elles n’aiment pas les visages qui reviennent.',
    ],
    marais: [
      'L’eau ne coule pas : elle attend. Sous la vase, des choses bourdonnent qui n’ont plus de nom.',
      'Le marais a gardé ton odeur. Les mares s’écartent, puis se referment derrière toi.',
    ],
    forge: [
      'On forgeait ici. Plus personne ne tient le marteau, mais le métal coule encore. Pour qui ?',
      'Les braises se souviennent de ton pas. La forge chauffe plus fort quand on revient.',
    ],
    givre: [
      'Le froid ne vient pas d’en haut. Il monte des profondeurs, comme un souffle retenu.',
      'La glace conserve tout. Sous tes pieds, des silhouettes figées, capuche baissée. Ne regarde pas trop longtemps.',
    ],
    abime: [
      'Ici la lumière renonce. Les gouffres n’ont pas de fond : ils ont un autre côté.',
      'Tu connais ce noir. Il te connaît aussi. Quelque chose y cligne, lentement, comme un œil qui s’ouvre.',
    ],
  },

  bosses: {
    guardian:  { intro: 'La vase se dresse. Ce qui reste des premiers descendus veille encore.', death: 'Le Gardien s’affaisse. Dans la flaque, mille petits éclats d’essence : autant de morts qu’il gardait.' },
    queen:     { intro: 'La Reine se soulève des eaux mortes. Le marais entier est son ventre.', death: 'La Reine crève comme une outre. Ses enfants s’enfuient dans la vase, sans reine à nourrir.' },
    colossus:  { intro: 'Le Colosse s’allume. On l’a forgé pour garder une porte qu’il a oubliée.', death: 'Le Colosse se fige, encore rouge. Le marteau qui l’a fait n’existe plus. Personne ne le rallumera.' },
    frostking: { intro: 'Le Roi de Givre te regarde comme on regarde un souvenir.', death: 'Le Roi éclate en givre. Sous la couronne, un visage encapuchonné. Il te ressemblait.' },
    eye:       { intro: 'L’Abîme s’ouvre. Ce n’est pas un œil. C’est ton reflet qui te regarde.', death: 'L’Œil se ferme. Derrière lui, pas de fond : un miroir. Et trois sceaux, intacts, qui attendent.' },
  },

  tablets: [
    { id: 't01', floorMin: 1, biome: 'crypte', text: 'Ici reposent ceux qui sont descendus. On n’a jamais eu besoin d’ajouter de noms : la crypte les garde elle-même.' },
    { id: 't02', floorMin: 1, text: 'L’essence n’est pas de l’or. C’est ce qu’il reste d’une chose quand la crypte l’a reprise. Un souvenir durci.' },
    { id: 't03', floorMin: 1, biome: 'crypte', text: 'Les torches ne s’éteignent pas parce qu’elles meurent. Elles s’éteignent parce qu’on les regarde.' },
    { id: 't04', floorMin: 2, text: 'On dit que la crypte n’a pas de fond. C’est faux. Elle a un fond. Il n’est simplement pas en bas.' },
    { id: 't05', floorMin: 2, text: 'Le Voile est la peau entre la pierre et son ombre. Tue, et tu la déchires. Assez de morts, et tu passes.' },
    { id: 't06', floorMin: 2, text: 'Ne traîne pas. Le temps ici n’est pas compté en heures, mais en patience. Et la patience de la crypte a un visage rouge.' },
    { id: 't07', floorMin: 3, biome: 'marais', text: 'Le marais ne pourrit pas. Il digère. Ce que tu vois flotter, c’est ce qu’il n’a pas encore fini.' },
    { id: 't08', floorMin: 3, text: 'Le premier à descendre s’appelait autrement. Il a promis à la crypte de remonter avec sa lumière. Il a menti. Elle l’a gardé.' },
    { id: 't09', floorMin: 3, text: 'De l’autre côté du Voile, les murs sont des ombres et les gouffres des ponts. Là-bas, rien n’est encore reflété. Tout vaut double.' },
    { id: 't10', floorMin: 4, biome: 'marais', text: 'La Reine n’a jamais été un crapaud. C’est une descendue qui a bu la vase pour ne plus avoir faim. Elle a eu ce qu’elle voulait.' },
    { id: 't11', floorMin: 4, text: 'Un serment est une clé. On ne le prête pas à la crypte : on le prête à ce qui parle derrière elle. Et ce qui parle tient ses comptes.' },
    { id: 't12', floorMin: 4, text: 'Le Traqueur n’a pas de tombe. Il est la tombe. Il vient chercher ceux qui restent, parce qu’il n’a jamais pu partir.' },
    { id: 't13', floorMin: 5, biome: 'forge', text: 'Nous forgions des sceaux. Trois, pour tenir la porte. Le métal a coulé, le marteau s’est perdu. Les sceaux, eux, ont tenu.' },
    { id: 't14', floorMin: 5, text: 'Les Reflets ne sont pas des ennemis. Ce sont les mêmes ennemis, vus du bon côté. C’est nous qui sommes à l’envers.' },
    { id: 't15', floorMin: 5, text: 'Quand tu meurs, la crypte ne te garde pas. Elle garde ton contour. Il attend dans l’Envers, à l’étage exact, avec ce que tu tenais.' },
    { id: 't16', floorMin: 6, biome: 'forge', text: 'Le Colosse a été forgé pour garder la porte des sceaux. On l’a construit trop loyal. Il garde toujours, même sans savoir quoi.' },
    { id: 't17', floorMin: 6, text: 'La crypte se souvient. Ce n’est pas une consolation. C’est une description : elle est faite de mémoire, et la mémoire ne finit pas.' },
    { id: 't18', floorMin: 6, text: 'Les boss se voilent quand ils saignent. Ils fuient dans leur reflet. Frappe l’ombre, et la chair tombe.' },
    { id: 't19', floorMin: 7, biome: 'givre', text: 'La glace garde tout, même ce qu’elle ne devrait pas. Regarde bien les silhouettes prises dedans. Compte les capuches.' },
    { id: 't20', floorMin: 7, text: 'Le Roi de Givre a jeté sa lumière avant de descendre. Il a cru qu’il verrait mieux dans le noir. Il a vu. Il n’a plus jamais cligné.' },
    { id: 't21', floorMin: 8, biome: 'givre', text: 'Chaque serment prêté use un sceau. Pas beaucoup. Un grain. Mais nous sommes des milliers à être descendus, et les sceaux ne sont que trois.' },
    { id: 't22', floorMin: 8, text: 'La pierre n’est pas la crypte. La crypte, c’est l’Envers. Ce que tu parcours n’est que son ombre portée, et une ombre repousse tant que sa source vit.' },
    { id: 't23', floorMin: 9, biome: 'abime', text: 'Les gouffres de l’Abîme n’ont pas de fond. Ils ont un miroir. Penche-toi et tu verras quelqu’un se pencher vers toi.' },
    { id: 't24', floorMin: 10, biome: 'abime', text: 'Derrière l’Œil, la porte. Derrière la porte, trois sceaux. Derrière les sceaux, celui qui tisse le Voile. Il attend qu’on lui rende ses clés.' },
  ],

  envers: {
    first: 'L’Envers. Les murs sont des ombres, les gouffres des ponts. Ici, rien n’est encore reflété : l’essence vaut double, et le Voile se vide. Tiens, ou reviens.',
    forced: [
      'Le Voile se referme. Il te recrache dans la pierre, moins un souffle.',
      'L’Envers ne garde pas ceux qui ne le nourrissent pas. Retour au reflet.',
      'Trop longtemps sans mort. Le Voile te lâche comme une main fatiguée.',
    ],
    hunter: 'Il t’a trouvé. Le Traqueur ne remonte jamais, mais il descend très vite.',
    echo: 'Ton écho. Il est resté là où tu es tombé, avec ce que tu tenais. Il te le rend. Il ne demande rien.',
    sealed: 'Cette porte n’a pas de serrure. Elle a un reflet. Passe de l’autre côté et pousse.',
    glyph: 'Des glyphes s’allument dans l’Envers. Ils dessinent le chemin sûr au-dessus des gouffres. Retiens-le.',
    lever: 'Un levier qui n’existe que de ce côté. Tire, et un mur s’efface dans le monde de pierre.',
    veiled: 'Il se voile. Ses coups traversent la pierre. Seul son reflet peut encore saigner.',
  },

  oaths: {
    sang:   '« Prends ce cœur. Rends-le-moi en éclats. » La voix accepte. Le sang, elle sait le compter.',
    ombre:  '« Je marcherai sans fuir. » La voix approuve. Ceux qui ne fuient pas frappent plus fort, et meurent plus près.',
    fer:    '« Que l’acier soit plus dur. » La voix rit, doucement. Elle aime qu’on saigne longtemps.',
    hate:   '« Je ne traînerai pas. » La voix se tait. Derrière elle, quelque chose de rouge accélère.',
    brume:  '« Que la nuit se resserre. » La voix souffle sur les torches. Ce qu’on ne voit pas coûte plus cher, et rapporte autant.',
    faim:   '« Je n’aurai pas besoin de guérir. » La voix retient les cœurs. Elle les changera en essence : c’est son commerce.',
    miroir: '« Je commencerai du bon côté. » La voix hésite, puis ouvre le Voile en grand. Peu osent lui demander cela.',
  },

  merchant: [
    'Tout se paie en essence. Même ici. Surtout ici.',
    'Tu crois que je remonte vendre ça en ville ? Il n’y a pas de ville. Il n’y a que des étages.',
    'Je ne sais plus depuis combien de descentes je tiens boutique. Le Traqueur passe, me regarde, et ne s’arrête pas. Je dois lui servir à quelque chose.',
    'Reviens si tu survis. Sinon, ton écho passera peut-être. Ils n’achètent jamais rien.',
  ],

  altar: [
    'L’autel ne demande pas de prière. Il demande un prix. Sang, essence ou silence : choisis ce que tu peux perdre.',
    'Ceux qui ont sculpté cet autel ne savaient pas à qui ils parlaient. Ils savaient seulement que quelqu’un répondait.',
    'Pose ce que tu as. La crypte s’en souviendra à ta place.',
  ],

  deaths: [
    'La crypte se souvient. Ton contour t’attend de l’autre côté.',
    'Une torche de plus s’éteint. Quelqu’un la rallumera.',
    'Tu n’es pas remonté. Personne ne remonte. Mais tu es descendu loin.',
    'Ce que tu tenais n’est pas perdu. Il attend, à l’étage exact, dans l’Envers.',
    'Le Voile s’est refermé sur toi comme de l’eau.',
    'L’essence remonte au Sanctuaire. Toi, pas encore.',
    'La glace garde tout. Elle garde aussi cette chute.',
    'Un éclat ◆ de plus dans la mémoire de la crypte. Elle en fera une marche.',
  ],

  floor10: 'Tu croyais descendre. Tu t’enfonçais dans un reflet. La pierre n’est que l’ombre portée de l’Envers, et une ombre repousse tant que sa source vit. Derrière l’Œil, il n’y a pas de fond : un miroir, une porte, trois sceaux. Et derrière les sceaux, celui qui tisse le Voile et reçoit les serments. Il attend qu’on lui rende ses clés. Pas encore. Pas toi. Pas cette fois.',

  cycle: 'La crypte se souvient. Elle t’a reflété, toi aussi. Les marches recommencent, plus froides, plus profondes : ce sont les mêmes, vues d’un peu plus près du miroir. Descends encore.',

  summary: 'Sous la ville, une crypte sans fin où l’on descend et d’où personne ne remonte. Ce qui y meurt laisse une essence que la crypte garde en mémoire, et avec laquelle elle se rebâtit sans cesse. Entre la pierre et son reflet s’étend le Voile : chaque mort le déchire, et quand il cède, on passe dans l’Envers, où rien n’est encore reflété et où tout vaut double. Le Traqueur, premier descendu et premier parjure, y chasse ceux qui traînent ; les serments se prêtent à une voix qui parle derrière le Voile et qui tient ses comptes. Au dixième étage, la vérité affleure : la pierre n’est que l’ombre de l’Envers, et derrière l’Abîme attendent une porte, trois sceaux, et celui qui tisse le Voile. Puis la boucle recommence, car la crypte se souvient.',
};

/* ---------- biomes et boss ajoutés ---------- */
Object.assign(STORY.biomes, {
  jardin: ['Quelque chose pousse ici sans lumière. Les racines ont trouvé les corps avant toi.', 'Le jardin te reconnaît. Les ronces s’écartent à peine.'],
  ossuaire: ['Les murs sont faits de ceux qui sont descendus. Ils te regardent passer.', 'Tu connais ces couloirs. Certains os pourraient être les tiens.'],
  cristal: ['Chaque paroi te renvoie ta propre lumière, et autre chose derrière elle.', 'Les cristaux vibrent à ton approche. Ils se souviennent de ta note.'],
  noyee: ['Une ville entière, engloutie. La mer qui l’a prise ne bouge plus.', 'L’eau est immobile comme un miroir posé à plat. Ne regarde pas trop longtemps.'],
  foret: ['Les arbres poussent à l’envers ici : les racines vers le ciel, les cimes vers le fond. Quelque chose respire entre les troncs.', 'La forêt te connaît. Les corbeaux ont annoncé ton retour bien avant que tu ne descendes.'],
  fongique: ['Tout luit d’une lumière qui n’est pas la tienne. Ne respire pas trop fort : les spores écoutent.', 'Le mycélium court sous chaque dalle. Il a goûté ton essence la dernière fois.'],
  cascade: ['L’eau tombe de nulle part vers nulle part. Son bruit couvre presque les pas derrière toi.', 'Les gorges rugissent toujours. Elles ne se souviennent pas de toi, et c’est reposant.'],
});
Object.assign(STORY.bosses, {
  sylve: { intro: 'Elle a poussé sur tous ceux qui sont tombés ici.', death: 'Les ronces se retirent. Sous elles, des marches, et des noms.' },
  lich: { intro: 'Quelqu’un a refusé la crypte. Il en est devenu le gardien.', death: 'La Liche s’effondre en poussière. Sa couronne, elle, reste chaude.' },
  leviathan: { intro: 'La mer immobile se soulève.', death: 'L’eau retombe. Le silence, en dessous, n’a pas changé.' },
  prism: { intro: 'Le cristal a appris ta lumière. Il te la rend.', death: 'Le Prisme se fend. Dans chaque éclat, un reflet de toi s’éteint.' },
  cerf: { intro: 'Ses bois portent les noms de ceux qui ont voulu remonter par la forêt.', death: 'Le Grand Cerf s’agenouille. La forêt retient son souffle, puis reprend.' },
  mycelium: { intro: 'Elle n’a pas de visage. Elle a des milliers de bouches, et toutes chuchotent.', death: 'Les chapeaux s’éteignent un à un. Sous la Mère, la roche est nue pour la première fois.' },
  salamandre: { intro: 'Elle dort sous la cascade depuis avant la crypte.', death: 'La Salamandre replonge. L’eau, un instant, coule à l’envers.' },
});
