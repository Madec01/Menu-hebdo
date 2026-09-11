// Estimation de la distribution des tailles de groupes (tap-blast, grille uniforme aleatoire).
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function analyse(w,h,nbCouleurs,tirages,seed){
  const rnd=mulberry32(seed);
  const n=w*h;
  const g=new Int8Array(n), vu=new Uint8Array(n), pile=new Int32Array(n);
  const seuils=[2,3,4,5,6,7,8,9,10,12];
  const presence=new Array(seuils.length).fill(0);   // grilles ou il existe >=1 groupe de taille >= seuil
  const nbGroupes=new Array(seuils.length).fill(0);  // nb moyen de groupes >= seuil par grille
  let maxTotal=0, groupesTotal=0, cellulesTapables=0;
  for(let t=0;t<tirages;t++){
    for(let i=0;i<n;i++){g[i]=Math.floor(rnd()*nbCouleurs);vu[i]=0;}
    let max=0; const tailles=[];
    for(let i=0;i<n;i++){
      if(vu[i])continue;
      let sp=0,taille=0; pile[sp++]=i; vu[i]=1; const c=g[i];
      while(sp>0){
        const p=pile[--sp]; taille++;
        const x=p%w,y=(p/w)|0;
        if(x>0&&!vu[p-1]&&g[p-1]===c){vu[p-1]=1;pile[sp++]=p-1;}
        if(x<w-1&&!vu[p+1]&&g[p+1]===c){vu[p+1]=1;pile[sp++]=p+1;}
        if(y>0&&!vu[p-w]&&g[p-w]===c){vu[p-w]=1;pile[sp++]=p-w;}
        if(y<h-1&&!vu[p+w]&&g[p+w]===c){vu[p+w]=1;pile[sp++]=p+w;}
      }
      tailles.push(taille); if(taille>max)max=taille;
      if(taille>=2){groupesTotal++;cellulesTapables+=taille;}
    }
    maxTotal+=max;
    seuils.forEach((s,k)=>{
      const c=tailles.filter(v=>v>=s).length;
      nbGroupes[k]+=c; if(c>0)presence[k]++;
    });
  }
  return {w,h,nbCouleurs,
    maxMoyen:(maxTotal/tirages).toFixed(2),
    groupesTapables:(groupesTotal/tirages).toFixed(1),
    partCellulesTapables:((cellulesTapables/tirages/n)*100).toFixed(0)+'%',
    seuils:seuils.map((s,k)=>({seuil:s,
      'presents/grille':(nbGroupes[k]/tirages).toFixed(2),
      'grilles avec >=1':((presence[k]/tirages)*100).toFixed(1)+'%'}))};
}

for(const [w,h,c] of [[8,10,5],[8,10,4],[8,10,6],[5,14,5]]){
  const r=analyse(w,h,c,20000,12345);
  console.log(`\n### grille ${w}x${h}, ${c} couleurs — max moyen ${r.maxMoyen} | groupes tapables ${r.groupesTapables} | ${r.partCellulesTapables} des billes tapables`);
  console.table(r.seuils);
}
