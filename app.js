    (() => {
      const initial = {
        layout: 'span', gap: 24, maskOffscreen: false, preset: 'aurora', energy: 35, grain: 12, time: 8, playing: true, selectedRecipes: [], recipeSettings: {}, recipeGraphs: {}, colorSettings: {}, savedLayouts: [],
        screens: [
          { id:'left', name:'Left screen', width:1920, height:1080, x:0, y:0 },
          { id:'center', name:'Center screen', width:1920, height:1080, x:1944, y:0 }
        ], selected:'center'
      };
      let state;
      try { state = {...initial, ...JSON.parse(localStorage.getItem('stillframe-prototype') || '{}')}; }
      catch { state = {...initial}; }
      // Playback is a session preference: always start moving when the prototype opens.
      state.playing = true;
      if (!Array.isArray(state.selectedRecipes)) state.selectedRecipes=[];
      if (!Array.isArray(state.savedLayouts)) state.savedLayouts=[];
      state.savedLayouts=state.savedLayouts.filter(item=>item&&Array.isArray(item.screens)&&item.screens.length>0);
      if (!state.recipeSettings || typeof state.recipeSettings!=='object') state.recipeSettings={};
      if (!state.colorSettings || typeof state.colorSettings!=='object') state.colorSettings={};
      if(state.energy===undefined)state.energy=state.motion??35;delete state.motion;
      if (!Array.isArray(state.screens) || !state.screens.length) state.screens = initial.screens.map(s=>({...s}));
      if (!state.screens.some(s=>s.id===state.selected)) state.selected = state.screens[0].id;
      const $ = id => document.getElementById(id);
      const canvas = $('art'), gl = canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
      let shaderProgram=null, shaderUniforms={}, shaderNodeUniforms={}, compiledGraphKey='';
      let renderResolution=null, renderTargetContext=null, exportInProgress=false;
      let advancedMode=false;
      let viewZoom=1, panX=0, panY=0, dragging=false, dragMoved=false, pointerX=0, pointerY=0, startPanX=0, startPanY=0;
      let last = performance.now(), elapsed = 0, anim;
      const palettes = {
        aurora: { base:'#111b1e', a:'#668f76', b:'#d2cc83', c:'#263b42' },
        tide: { base:'#10282d', a:'#3d8087', b:'#d2b58b', c:'#244b50' },
        dust: { base:'#281c19', a:'#ad6448', b:'#e0bd88', c:'#594033' },
        still: { base:'#172426', a:'#568174', b:'#e1ba86', c:'#324f49' },
        'tidal-lines': {base:'#10272f',a:'#3b8381',b:'#bdd2c0',c:'#244d5a'},
        'contour-maps': {base:'#172824',a:'#78906b',b:'#d2bf91',c:'#3d5b4b'},
        'orbit-rings': {base:'#101a30',a:'#6e88bf',b:'#dfbd86',c:'#34476e'},
        'quiet-stars': {base:'#101522',a:'#b2c5df',b:'#f1dfb4',c:'#343e58'},
        'fractal-bloom': {base:'#261c2d',a:'#9a6b91',b:'#e4bd9a',c:'#563a5b'},
        'prism-facets': {base:'#15242b',a:'#4b9b9b',b:'#d6ad78',c:'#536a91'},
        'sanctuary-rays': {base:'#29221b',a:'#c58a4d',b:'#f0d4a0',c:'#76533a'},
        'ink-water': {base:'#172b32',a:'#478486',b:'#b5c4b2',c:'#354d68'},
        'halftone-dunes': {base:'#30251d',a:'#bb754d',b:'#e2c48d',c:'#72533a'},
        'floating-embers': {base:'#201a1b',a:'#dd7441',b:'#ffd08a',c:'#5a3030'},
        'horizon-drift': {base:'#18232d',a:'#63777b',b:'#e0c194',c:'#26383a'},
        'motion-ribbons': {base:'#101a25',a:'#4d9b9b',b:'#d6c5a0',c:'#2c4554'},
        'soft-refraction': {base:'#151e2b',a:'#679ba0',b:'#dac293',c:'#3e5367'},
        'pigment-bloom': {base:'#18212a',a:'#9a6c68',b:'#d4b99b',c:'#527b7b'},
        'starfall-trails': {base:'#0f1522',a:'#90adc0',b:'#e6d6b1',c:'#3e526d'},
        'stained-mosaic': {base:'#17242d',a:'#6a8f87',b:'#d1ad7c',c:'#445d72'}
      };
      const designNames={aurora:'Quiet aurora',tide:'Slow tide',dust:'Desert dust',still:'Morning light','tidal-lines':'Tidal Lines','contour-maps':'Contour Maps','orbit-rings':'Orbit Rings','quiet-stars':'Quiet Stars','fractal-bloom':'Fractal Bloom','prism-facets':'Prism Facets','sanctuary-rays':'Sanctuary Rays','ink-water':'Ink in Water','halftone-dunes':'Halftone Dunes','floating-embers':'Floating Embers','horizon-drift':'Horizon Drift','motion-ribbons':'Motion Ribbons','soft-refraction':'Soft Refraction','pigment-bloom':'Pigment Bloom','starfall-trails':'Starfall Trails','stained-mosaic':'Stained Mosaic'};
      const defaultColors={
        aurora:{mode:'swatches',colors:[palettes.aurora.base,palettes.aurora.a,palettes.aurora.b,palettes.aurora.c],shift:0},
        tide:{mode:'gradient',colors:[palettes.tide.base,palettes.tide.b,palettes.tide.a,palettes.tide.c],shift:0},
        dust:{mode:'single',colors:[palettes.dust.a,palettes.dust.b,palettes.dust.c,palettes.dust.base],shift:0},
        still:{mode:'swatches',colors:[palettes.still.base,palettes.still.a,palettes.still.b,palettes.still.c],shift:0},
        'tidal-lines':{mode:'gradient',colors:[palettes['tidal-lines'].base,palettes['tidal-lines'].a,palettes['tidal-lines'].b,palettes['tidal-lines'].c],shift:0},
        'contour-maps':{mode:'swatches',colors:[palettes['contour-maps'].base,palettes['contour-maps'].a,palettes['contour-maps'].b,palettes['contour-maps'].c],shift:0},
        'orbit-rings':{mode:'gradient',colors:[palettes['orbit-rings'].base,palettes['orbit-rings'].b,palettes['orbit-rings'].a,palettes['orbit-rings'].c],shift:0},
        'quiet-stars':{mode:'single',colors:[palettes['quiet-stars'].b,palettes['quiet-stars'].a,palettes['quiet-stars'].c,palettes['quiet-stars'].base],shift:0},
        'fractal-bloom':{mode:'swatches',colors:[palettes['fractal-bloom'].base,palettes['fractal-bloom'].a,palettes['fractal-bloom'].b,palettes['fractal-bloom'].c],shift:0},
        'prism-facets':{mode:'swatches',colors:[palettes['prism-facets'].base,palettes['prism-facets'].a,palettes['prism-facets'].b,palettes['prism-facets'].c],shift:0},
        'sanctuary-rays':{mode:'gradient',colors:[palettes['sanctuary-rays'].base,palettes['sanctuary-rays'].b,palettes['sanctuary-rays'].a,palettes['sanctuary-rays'].c],shift:0},
        'ink-water':{mode:'swatches',colors:[palettes['ink-water'].base,palettes['ink-water'].a,palettes['ink-water'].b,palettes['ink-water'].c],shift:0},
        'halftone-dunes':{mode:'single',colors:[palettes['halftone-dunes'].b,palettes['halftone-dunes'].a,palettes['halftone-dunes'].c,palettes['halftone-dunes'].base],shift:0},
        'floating-embers':{mode:'gradient',colors:[palettes['floating-embers'].base,palettes['floating-embers'].b,palettes['floating-embers'].a,palettes['floating-embers'].c],shift:0},
        'horizon-drift':{mode:'gradient',colors:[palettes['horizon-drift'].base,palettes['horizon-drift'].b,palettes['horizon-drift'].a,palettes['horizon-drift'].c],shift:0},
        'motion-ribbons':{mode:'swatches',colors:[palettes['motion-ribbons'].base,palettes['motion-ribbons'].a,palettes['motion-ribbons'].b,palettes['motion-ribbons'].c],shift:0},
        'soft-refraction':{mode:'swatches',colors:[palettes['soft-refraction'].base,palettes['soft-refraction'].a,palettes['soft-refraction'].b,palettes['soft-refraction'].c],shift:0},
        'pigment-bloom':{mode:'swatches',colors:[palettes['pigment-bloom'].base,palettes['pigment-bloom'].a,palettes['pigment-bloom'].b,palettes['pigment-bloom'].c],shift:0},
        'starfall-trails':{mode:'gradient',colors:[palettes['starfall-trails'].base,palettes['starfall-trails'].b,palettes['starfall-trails'].a,palettes['starfall-trails'].c],shift:0},
        'stained-mosaic':{mode:'swatches',colors:[palettes['stained-mosaic'].base,palettes['stained-mosaic'].a,palettes['stained-mosaic'].b,palettes['stained-mosaic'].c],shift:0}
      };
      Object.keys(designNames).forEach(id=>{
        if(!state.colorSettings[id])state.colorSettings[id]=JSON.parse(JSON.stringify(defaultColors[id]));
        const setting=state.recipeSettings[id];if(setting&&setting.energy===undefined)setting.energy=setting.motion??state.energy;
      });
      const nodeNames={noise:'Noise field',gradient:'Color gradient',mirror:'Mirror',blend:'Blend',grain:'Film grain',waves:'Tidal lines',contours:'Contour maps',rings:'Orbit rings',stars:'Star field',bloom:'Fractal bloom',prism:'Prism facets',rays:'Sanctuary rays',ink:'Ink wash',halftone:'Halftone dunes',particles:'Floating embers',horizon:'Atmospheric horizon',ribbons:'Motion ribbons',refraction:'Soft refraction',watercolor:'Watercolor wash',startrails:'Star trails',mosaic:'Stained mosaic'};
      function defaultNodeParams(type){
        if(type==='noise')return {scale:3.6,speed:48,contrast:100};
        if(type==='gradient')return {angle:18,strength:32};
        if(type==='blend')return {opacity:55};
        if(type==='grain')return {amount:42};
        if(['waves','contours','rings','stars','bloom','prism','rays','ink','halftone','particles','horizon','ribbons','refraction','watercolor','startrails','mosaic'].includes(type))return {scale:5,speed:30,strength:82};
        return {};
      }
      function createNode(type){return {id:`${type}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,enabled:true,...defaultNodeParams(type)};}
      function defaultGraph(){return ['gradient','noise','blend','grain'].map(createNode);}
      function defaultRecipeGraph(id){
        const recipes={
          'tidal-lines':[['waves',{scale:4,speed:32,strength:86}],['grain',{amount:14}]],
          'contour-maps':[['contours',{scale:6,speed:12,strength:88}]],
          'orbit-rings':[['rings',{scale:5,speed:24,strength:84}],['grain',{amount:12}]],
          'quiet-stars':[['stars',{scale:22,speed:34,strength:95}]],
          'fractal-bloom':[['bloom',{scale:7,speed:19,strength:82}]],
          'prism-facets':[['prism',{scale:7,speed:11,strength:90}]],
          'sanctuary-rays':[['rays',{scale:9,speed:18,strength:90}]],
          'ink-water':[['ink',{scale:3,speed:10,strength:88}]],
          'halftone-dunes':[['halftone',{scale:20,speed:10,strength:92}]],
          'floating-embers':[['particles',{scale:12,speed:36,strength:96}],['grain',{amount:10}]],
          'horizon-drift':[['horizon',{scale:5.5,speed:16,strength:80}]],
          'motion-ribbons':[['ribbons',{scale:4.5,speed:24,strength:86}]],
          'soft-refraction':[['refraction',{scale:5,speed:16,strength:78}]],
          'pigment-bloom':[['watercolor',{scale:3.5,speed:9,strength:84}]],
          'starfall-trails':[['startrails',{scale:12,speed:30,strength:88}]],
          'stained-mosaic':[['mosaic',{scale:6.5,speed:8,strength:92}]]
        };
        if(!recipes[id])return defaultGraph();
        return [['gradient',{angle:18,strength:32}],...recipes[id].map(([type,params])=>[type,params])].map(([type,params])=>Object.assign(createNode(type),params));
      }
      if(!state.recipeGraphs||typeof state.recipeGraphs!=='object')state.recipeGraphs={};
      Object.keys(designNames).forEach(id=>{if(!Array.isArray(state.recipeGraphs[id]))state.recipeGraphs[id]=defaultRecipeGraph(id);});
      Object.values(state.recipeGraphs).forEach(graph=>graph.forEach(node=>{
        if(node.enabled===undefined)node.enabled=true;
        if(node.type==='noise'&&node.contrast===undefined)node.contrast=100;
        if(node.type==='gradient'&&node.strength===undefined)node.strength=32;
      }));
      const currentGraph=()=>state.recipeGraphs[state.preset]||[];
      const save = () => { localStorage.setItem('stillframe-prototype', JSON.stringify(state)); $('saveBtn').textContent='Saved ✓'; };
      const current = () => state.screens.find(s=>s.id===state.selected) || state.screens[0];
      const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${(seconds%60).toFixed(2).padStart(5,'0')}`;
      const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
      function renderSavedLayouts(){
        const select=$('savedLayoutSelect'),selectedId=select.value;
        select.replaceChildren();
        const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=state.savedLayouts.length?'Choose a saved layout':'No saved layouts';select.append(placeholder);
        state.savedLayouts.forEach((layout,index)=>{
          const option=document.createElement('option');option.value=layout.id||`saved-layout-${index}`;option.textContent=`${layout.name||`Layout ${index+1}`} · ${layout.screens.length} screen${layout.screens.length===1?'':'s'}`;select.append(option);
        });
        select.value=state.savedLayouts.some((layout,index)=>(layout.id||`saved-layout-${index}`)===selectedId)?selectedId:'';
        const hasSelection=!!select.value;$('recallLayout').disabled=!hasSelection;$('deleteLayout').disabled=!hasSelection;
      }
      function hexToRgb(hex){const value=hex.replace('#','');return [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)];}
      function rgbToHex(rgb){return '#'+rgb.map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join('').toUpperCase();}
      function rgbToHsl(hex){const [r0,g0,b0]=hexToRgb(hex).map(value=>value/255),max=Math.max(r0,g0,b0),min=Math.min(r0,g0,b0),d=max-min;let h=0,s=0,l=(max+min)/2;if(d){s=d/(1-Math.abs(2*l-1));if(max===r0)h=60*(((g0-b0)/d)%6);else if(max===g0)h=60*((b0-r0)/d+2);else h=60*((r0-g0)/d+4);}return [(h+360)%360,s,l];}
      function hslToHex(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbToHex(rgb.map(value=>(value+m)*255));}
      function mixHex(a,b,t){const aa=hexToRgb(a),bb=hexToRgb(b);return rgbToHex(aa.map((value,index)=>value+(bb[index]-value)*t));}
      function colorPalette(id){
        const setting=state.colorSettings[id]||defaultColors[id]||defaultColors.aurora,colors=setting.colors;
        if(setting.mode==='single'){const [h,s,l]=rgbToHsl(colors[0]);return {base:colors[0],a:hslToHex(h,s*.72,clamp(l+.12,.08,.88)),b:hslToHex((h+32)%360,s*.78,clamp(l+.24,.1,.92)),c:hslToHex(h,s*.36,clamp(l-.2,.05,.78))};}
        if(setting.mode==='gradient')return {base:colors[0],a:mixHex(colors[0],colors[1],.32),b:mixHex(colors[0],colors[1],.68),c:colors[1]};
        return {base:colors[0],a:colors[1],b:colors[2],c:colors[3]};
      }
      function renderColorControls(){
        const setting=state.colorSettings[state.preset]||defaultColors.aurora;$('colorMode').value=setting.mode;
        const definitions=setting.mode==='single'?[[0,'Source color']]:setting.mode==='gradient'?[[0,'Start color'],[1,'End color']]:[[0,'Base'],[1,'Accent 1'],[2,'Accent 2'],[3,'Accent 3']];
        $('colorControls').innerHTML=definitions.map(([index,label])=>`<div class="color-control"><label for="colorPicker${index}">${label}</label><input id="colorPicker${index}" type="color" value="${setting.colors[index]}" data-color-index="${index}" aria-label="${label}" /><input type="text" value="${setting.colors[index].toUpperCase()}" data-color-index="${index}" aria-label="${label} hex value" maxlength="7" /></div>`).join('');
        $('colorShift').value=setting.shift;$('colorShiftVal').textContent=`${setting.shift}°`;
      }
      const maxBounds = () => {
        const minX=Math.min(...state.screens.map(s=>s.x)), minY=Math.min(...state.screens.map(s=>s.y));
        const maxX=Math.max(...state.screens.map(s=>s.x+s.width)), maxY=Math.max(...state.screens.map(s=>s.y+s.height));
        return {x:minX,y:minY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
      };
      function aspect(w,h) { const g=(a,b)=>b?g(b,a%b):a, d=g(w,h); return `${Math.round(w/d)}:${Math.round(h/d)}`; }
      function syncInputs() {
        const s=current(); if (!s) return;
        $('selectedTitle').textContent=s.name||'Unnamed screen'; $('selectedAspect').textContent=aspect(s.width,s.height);
        $('screenWidth').value=s.width; $('screenHeight').value=s.height; $('screenX').value=s.x; $('screenY').value=s.y;
        $('gap').value=state.gap; $('gapVal').textContent=`${state.gap} px`;
        $('maskOffscreen').checked=!!state.maskOffscreen;
        $('energy').value=state.energy; $('energyVal').textContent=`${state.energy}%`;
        $('grain').value=state.grain; $('grainVal').textContent=`${state.grain}%`;
        $('screenName').value=current().name;
        renderColorControls();
        $('recipeFocusTitle').textContent=designNames[state.preset]||'Selected recipe';
        $('recipeFocusSwatch').className=`swatch ${state.preset}`;
        $('scrub').value=state.time; $('timeReadout').textContent=formatTime(state.time);
        $('playBtn').textContent=state.playing?'Ⅱ':'▶'; $('playBtn').setAttribute('aria-label',state.playing?'Pause preview':'Play preview');
        document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('active',b.dataset.layout===state.layout));
        document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));
        document.querySelectorAll('[data-design-card]').forEach(card=>card.classList.toggle('active',card.dataset.designCard===state.preset));
        renderRecipeSelection();renderRecipeStrip();renderGraphEditor();
        $('stageMeta').textContent=`${state.screens.length} screen${state.screens.length===1?'':'s'} · ${state.layout==='span'?'extended canvas':'separate feeds'} · ${maxBounds().width.toLocaleString()} × ${maxBounds().height.toLocaleString()} px`;
        renderSavedLayouts();
        updateExportSummary();
      }
      function updateExportSummary(){
        const box=maxBounds(),target=$('exportTarget').value;
        const heading=target==='canvas'?'Full extended canvas':`${state.screens.length} file${state.screens.length===1?'':'s'} · one per screen`;
        const size=target==='canvas'?`${box.width.toLocaleString()} × ${box.height.toLocaleString()} px`:`${state.screens.map(s=>`${s.width} × ${s.height}`).join(' + ')} px`;
        const recipeSummary=state.selectedRecipes.length?`${state.selectedRecipes.length} selected recipe${state.selectedRecipes.length===1?'':'s'}`:'No recipes selected';
        $('exportDetails').innerHTML=`${recipeSummary}<br />${heading} · ${size}<br />${$('exportFps').value} · ${$('exportDuration').value} loop`;
      }
      function selectWorkspaceTab(tab){
        document.querySelectorAll('[data-workspace-tab]').forEach(button=>{
          const active=button.dataset.workspaceTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
        });
        document.querySelectorAll('[data-tab-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.tabPanel===tab));
        $('previewTitle').textContent=tab==='layout'?'Stage preview':tab==='browser'?'Design preview':tab==='editor'?'Visual preview':'Export preview';
        $('resetBtn').hidden=tab!=='layout';
        $('prototypeNote').hidden=tab==='browser';
      }
      function filterDesigns(){
        const query=$('designSearch').value.trim().toLowerCase(),category=$('designCategory').value;
        let visible=0;
        document.querySelectorAll('[data-design-card]').forEach(card=>{
          const matches=(category==='all'||card.dataset.category===category)&&(!query||card.dataset.search.includes(query));
          card.hidden=!matches;if(matches)visible++;
        });
        $('designCount').textContent=`${visible} design${visible===1?'':'s'}`;$('noDesigns').hidden=visible>0;
      }
      function renderRecipeSelection(){
        $('selectionCount').textContent=`${state.selectedRecipes.length} scene${state.selectedRecipes.length===1?'':'s'} in playlist`;
        document.querySelectorAll('[data-design-card]').forEach(card=>card.classList.toggle('has-recipe',state.selectedRecipes.includes(card.dataset.designCard)));
        document.querySelectorAll('[data-toggle-recipe]').forEach(button=>{
          const selected=state.selectedRecipes.includes(button.dataset.toggleRecipe);
          button.classList.toggle('selected',selected);button.textContent=selected?'In playlist ✓':'Add to playlist';button.title=selected?'Remove this scene from the playlist':'Add this scene to the playlist';
        });
        document.querySelectorAll('[data-batch-route]').forEach(button=>button.disabled=state.selectedRecipes.length===0);
        const empty=state.selectedRecipes.length===0;
        $('advancedMode').checked=advancedMode;
        $('editorControls').hidden=empty;$('editorNodes').hidden=empty||!advancedMode;$('emptyEditorRecipes').hidden=!empty;
      }
      function renderRecipeStrip(){
        $('stripCount').textContent=`${state.selectedRecipes.length} scene${state.selectedRecipes.length===1?'':'s'}`;
        const addButton=$('addSceneButton'),currentAdded=state.selectedRecipes.includes(state.preset);
        addButton.disabled=currentAdded;addButton.textContent=currentAdded?'✓ Scene added':'＋ Add current scene';
        const thumbs=$('recipeThumbs');thumbs.innerHTML='';
        if(!state.selectedRecipes.length){
          thumbs.innerHTML='<div class="empty-recipes"><span>No scenes in your playlist yet.</span><button class="ghost-btn" type="button" data-goto-browser>Browse designs</button></div>';return;
        }
        state.selectedRecipes.forEach(id=>{
          const button=document.createElement('button');button.type='button';button.className='recipe-thumb'+(state.preset===id?' active':'');button.dataset.recipeThumb=id;
          button.innerHTML=`<span class="swatch ${id}"></span><strong>${designNames[id]||id}</strong>`;
          button.addEventListener('click',()=>choosePreset(id));thumbs.append(button);
        });
      }
      function renderGraphEditor(){
        const root=$('graphNodes');root.innerHTML='';
        const graph=currentGraph();
        $('nodeAddPanel').hidden=!advancedMode;
        graph.forEach((node,index)=>{
          const card=document.createElement('div');card.className=`node-card advanced-node${node.enabled?'':' disabled'}`;card.dataset.nodeId=node.id;
          const icon={noise:'N',gradient:'G',mirror:'M',blend:'B',grain:'Gr',waves:'≈',contours:'⌁',rings:'◎',stars:'✦',bloom:'✿',prism:'◇',rays:'☼',ink:'◉',halftone:'⠿',particles:'✧',horizon:'H',ribbons:'≋',refraction:'◇',watercolor:'W',startrails:'☄',mosaic:'▦'}[node.type]||'?';
          const descriptions={noise:'Adds soft, organic movement.',gradient:'Shapes the color fade across the screen.',mirror:'Reflects the image across its center.',blend:'Mixes the color layers together.',grain:'Adds fine animated texture.',waves:'Sweeping curved bands with flowing phase motion.',contours:'Topographic isolines reveal a moving noise field.',rings:'Concentric orbital bands with a luminous center.',stars:'Sparse twinkling points arranged at multiple scales.',bloom:'Radial petals expand and rotate like a living mandala.',prism:'Hard-edged triangular facets form a shifting mosaic.',rays:'Directional beams fan upward from a low horizon.',ink:'Soft, diffused pigment clouds pool and spread.',halftone:'Printed dots change size to shape rolling forms.',particles:'Independent glowing sparks drift upward through space.',horizon:'Builds soft color strata around a breathing horizon.',ribbons:'Moves long, narrow curves in parallel flowing bands.',refraction:'Warps clouded glass forms with prismatic light edges.',watercolor:'Layers feathered pigment blooms with soft tide-like motion.',startrails:'Sends sparse streaks gliding through a star field.',mosaic:'Creates irregular glass cells separated by dark seams.'};
          const actions=`<span class="node-order">${String(index+1).padStart(2,'0')}</span><span class="node-actions"><button type="button" data-node-action="up" title="Move up" aria-label="Move ${nodeNames[node.type]} up" ${index===0?'disabled':''}>↑</button><button type="button" data-node-action="down" title="Move down" aria-label="Move ${nodeNames[node.type]} down" ${index===graph.length-1?'disabled':''}>↓</button><button class="node-reset" type="button" data-node-action="reset" title="Reset node settings" aria-label="Reset ${nodeNames[node.type]} to default">↺</button><button type="button" data-node-action="remove" title="Remove node" aria-label="Remove ${nodeNames[node.type]}">×</button></span>`;
          card.innerHTML=`<div class="node-header"><input type="checkbox" data-node-enabled ${node.enabled?'checked':''} aria-label="Enable ${nodeNames[node.type]}" /><span class="node-dot">${icon}</span><span class="node-title-wrap"><strong class="node-title">${nodeNames[node.type]}</strong><small class="node-description">${descriptions[node.type]||''}</small></span>${actions}</div>`;
          const params={
            noise:[['scale','Scale',1,12,.1],['speed','Flow speed',0,100,1],['contrast','Contrast',50,200,1]],
            gradient:[['angle','Angle',0,360,1],['strength','Strength',0,100,1]],
            blend:[['opacity','Opacity',0,100,1]],
            grain:[['amount','Grain amount',0,100,1]],
            mirror:[],
            waves:[['scale','Band spacing',1,12,.1],['speed','Flow speed',0,100,1],['strength','Strength',0,100,1]],
            contours:[['scale','Line density',1,12,.1],['speed','Drift speed',0,100,1],['strength','Strength',0,100,1]],
            rings:[['scale','Ring density',1,12,.1],['speed','Rotation speed',0,100,1],['strength','Glow',0,100,1]],
            stars:[['scale','Star count',4,40,1],['speed','Twinkle speed',0,100,1],['strength','Brightness',0,100,1]],
            bloom:[['scale','Petal detail',1,12,.1],['speed','Growth speed',0,100,1],['strength','Strength',0,100,1]],
            prism:[['scale','Facet size',2,16,.1],['speed','Shift speed',0,100,1],['strength','Contrast',0,100,1]],
            rays:[['scale','Beam count',2,18,.1],['speed','Drift speed',0,100,1],['strength','Intensity',0,100,1]],
            ink:[['scale','Cloud detail',1,10,.1],['speed','Diffusion speed',0,100,1],['strength','Pigment',0,100,1]],
            halftone:[['scale','Dot density',6,36,1],['speed','Dune drift',0,100,1],['strength','Ink coverage',0,100,1]],
            particles:[['scale','Particle count',3,24,1],['speed','Rise speed',0,100,1],['strength','Glow',0,100,1]],
            horizon:[['scale','Layer detail',1,10,.1],['speed','Drift speed',0,100,1],['strength','Horizon glow',0,100,1]],
            ribbons:[['scale','Ribbon spacing',1,10,.1],['speed','Flow speed',0,100,1],['strength','Brightness',0,100,1]],
            refraction:[['scale','Glass detail',1,12,.1],['speed','Drift speed',0,100,1],['strength','Refraction',0,100,1]],
            watercolor:[['scale','Bloom size',1,10,.1],['speed','Flow speed',0,100,1],['strength','Pigment',0,100,1]],
            startrails:[['scale','Trail count',4,24,1],['speed','Trail speed',0,100,1],['strength','Brightness',0,100,1]],
            mosaic:[['scale','Pane size',2,14,.1],['speed','Light shift',0,100,1],['strength','Glass glow',0,100,1]]
          }[node.type]||[];
          params.forEach(([key,label,min,max,step])=>{
            const value=Number(node[key]??min);
            const field=document.createElement('div');field.className='node-param';
            field.innerHTML=`<div class="field-head"><label>${label}</label><span>${key==='scale'?value.toFixed(1):Math.round(value)}${key==='scale'?'×':key==='angle'?'°':'%'}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-node-param="${key}" aria-label="${nodeNames[node.type]} ${label}" />`;
            card.append(field);
          });
          root.append(card);
        });
        if(!graph.length)root.innerHTML='<p class="footer-note">No effects in this recipe. Add a node below.</p>';
      }
      function shaderSource(graph){
        const declarations=[],steps=[],nodeUniformNames={};
        graph.forEach((node,index)=>{
          if(!node.enabled)return;
          const a=`uNode${index}A`,b=`uNode${index}B`;nodeUniformNames[node.id]={a,b};
          if(node.type==='noise'){
            declarations.push(`uniform float ${a}; uniform float ${b}; uniform float ${a}C;`);
            steps.push(`float noise${index}=clamp((fbm(patternUv*${a}*mix(.55,1.8,u_energy)+vec2(u_time*${b}*.003*1.5*u_energy,u_time*${b}*.002*1.5*u_energy))-.5)*${a}C+.5,0.0,1.0);float wave${index}=.5+.5*sin((patternUv.x*5.0+noise${index}*2.2+u_time*u_energy*.8)*6.28318);float cloud${index}=smoothstep(.25,.85,noise${index}*.58+wave${index}*.42);col=mix(col,mix(u_colorA,u_colorB,noise${index}),cloud${index}*.78);`);
          }else if(node.type==='gradient'){
            declarations.push(`uniform float ${a};uniform float ${b};`);
            steps.push(`float grad${index}=clamp(dot(patternUv-vec2(.5),vec2(cos(radians(${a})),sin(radians(${a}))))+.5,0.0,1.0);col=mix(col,mix(u_base,u_colorC,grad${index}),${b});`);
          }else if(node.type==='mirror'){
            steps.push(`uv.x=abs(uv.x*2.0-1.0);patternUv=vec2((uv.x-.5)*outputAspect+.5,uv.y);`);
          }else if(node.type==='blend'){
            declarations.push(`uniform float ${a};`);
            steps.push(`col=mix(col,mix(col,u_colorB,.42),${a});`);
          }else if(node.type==='grain'){
            declarations.push(`uniform float ${a};`);
            steps.push(`float grain${index}=hash(gl_FragCoord.xy+vec2(u_time*41.0,u_time*17.0))-.5;col+=grain${index}*u_grain*${a}*.36;`);
          }else if(['waves','contours','rings','stars','bloom','prism','rays','ink','halftone','particles','horizon','ribbons','refraction','watercolor','startrails','mosaic'].includes(node.type)){
            declarations.push(`uniform float ${a};uniform float ${b};uniform float ${a}C;`);
            const time=`u_time*${b}*.025*u_energy`,strength=`${a}C`;
            const patterns={
              waves:`float p${index}=patternUv.y*${a}*5.2+sin(patternUv.x*7.0+${time})*.65+sin(patternUv.x*15.0-${time}*.45)*.16;float band${index}=1.0-smoothstep(.08,.3,abs(fract(p${index})-.5));float shape${index}=smoothstep(-.1,.9,sin(p${index}*6.28318));col=mix(col,mix(u_colorB,u_colorA,shape${index}),band${index}*${strength});`,
              contours:`float field${index}=fbm(patternUv*${a}*1.65+vec2(${time}*.16,-${time}*.11));float contour${index}=1.0-smoothstep(.018,.075,abs(fract(field${index}*${a}*1.6)-.5));col=mix(col,u_colorA,contour${index}*${strength});`,
              rings:`vec2 rp${index}=patternUv-vec2(.5);float rr${index}=length(rp${index});float ring${index}=pow(max(0.0,.5+.5*cos(rr${index}*${a}*15.0-${time})),12.0)*exp(-rr${index}*1.35);col=mix(col,u_colorB,ring${index}*${strength});`,
              stars:`vec2 sg${index}=patternUv*${a};vec2 sc${index}=floor(sg${index});vec2 sf${index}=fract(sg${index});float sr${index}=hash(sc${index});vec2 sp${index}=vec2(hash(sc${index}+3.1),hash(sc${index}+8.7));float tw${index}=.45+.55*sin(u_time*(${b}*.05+sr${index}*2.0)*u_energy+sr${index}*30.0);float star${index}=(1.0-smoothstep(.015,.09,length(sf${index}-sp${index})))*step(.79,sr${index})*tw${index};col+=u_colorB*star${index}*${strength}*.85;`,
              bloom:`vec2 bp${index}=patternUv-vec2(.5);float br${index}=length(bp${index});float ba${index}=atan(bp${index}.y,bp${index}.x);float pet${index}=.5+.5*cos(ba${index}*8.0+br${index}*${a}*3.0-${time});float flower${index}=smoothstep(.17,.68,pet${index})*(1.0-smoothstep(.42,.9,br${index}));col=mix(col,mix(u_colorA,u_colorB,pet${index}),flower${index}*${strength});`,
              prism:`vec2 pg${index}=patternUv*${a}*1.4;vec2 pc${index}=floor(pg${index});vec2 pf${index}=fract(pg${index});float tri${index}=step(pf${index}.x,pf${index}.y);float facet${index}=mod(pc${index}.x+pc${index}.y+tri${index},3.0);vec3 prism${index}=facet${index}<1.0?u_colorA:(facet${index}<2.0?u_colorB:u_colorC);float edge${index}=smoothstep(.0,.025,min(abs(pf${index}.x-pf${index}.y),min(min(pf${index}.x,1.0-pf${index}.x),min(pf${index}.y,1.0-pf${index}.y))));col=mix(col,prism${index}*(.84+.16*sin(${time}+facet${index})),${strength}*(.62+.38*edge${index}));`,
              rays:`vec2 rp${index}=patternUv-vec2(.5,.02);float ra${index}=atan(rp${index}.x,max(.04,rp${index}.y));float beam${index}=pow(max(0.0,.5+.5*cos(ra${index}*${a}*1.25+sin(ra${index}*3.0+${time})*.45)),18.0);float horizon${index}=1.0-smoothstep(.05,.9,length(rp${index}));col=mix(col,u_colorB,beam${index}*horizon${index}*${strength});`,
              ink:`vec2 ip${index}=patternUv*${a}*.72+vec2(${time}*.012,-${time}*.009);float pigment${index}=fbm(ip${index})*.7+fbm(ip${index}*2.1+5.3)*.3;float wash${index}=smoothstep(.38,.72,pigment${index});col=mix(col,mix(u_colorA,u_colorC,pigment${index}),wash${index}*${strength});`,
              halftone:`vec2 hg${index}=patternUv*${a};vec2 hf${index}=fract(hg${index})-.5;float hfield${index}=fbm(patternUv*3.0+vec2(${time}*.025,0.0));float radius${index}=mix(.12,.48,smoothstep(.28,.72,hfield${index}));float dot${index}=1.0-smoothstep(radius${index}-.035,radius${index}+.035,length(hf${index}));col=mix(col,u_colorA,dot${index}*${strength});`,
              particles:`vec2 qg${index}=patternUv*${a};vec2 qc${index}=floor(qg${index});vec2 qf${index}=fract(qg${index});float qr${index}=hash(qc${index});vec2 qp${index}=vec2(hash(qc${index}+2.4),fract(hash(qc${index}+7.1)+u_time*${b}*.0025*u_energy*(.35+qr${index})));float glow${index}=exp(-length((qf${index}-qp${index})*vec2(1.0,1.7))*24.0)*step(.64,qr${index});col+=u_colorB*glow${index}*${strength}*.78;`,
              horizon:`float hh${index}=fbm(patternUv*vec2(1.7,${a}*.48)+vec2(${time}*.018,-${time}*.006));float hy${index}=.4+(hh${index}-.5)*.19+sin(patternUv.x*3.2+${time}*.35)*.018;float sky${index}=smoothstep(hy${index}-.02,hy${index}+.24,patternUv.y);float strata${index}=.5+.5*sin((patternUv.y+hh${index}*.045)*${a}*17.0);float horizonLine${index}=exp(-abs(patternUv.y-hy${index})*${a}*2.0);vec3 skyColor${index}=mix(u_colorC,u_colorA,clamp(sky${index}*.58+strata${index}*.2,0.0,1.0));col=mix(col,skyColor${index},${strength}*.58);col+=u_colorB*horizonLine${index}*${strength}*.38;`,
              ribbons:`float rw${index}=patternUv.y*${a}*1.35+sin(patternUv.x*4.2+${time})*.32+sin(patternUv.x*9.0-${time}*.65)*.08;float ribbon${index}=1.0-smoothstep(.035,.13,abs(fract(rw${index})-.5));float shimmer${index}=.5+.5*sin(patternUv.x*5.0-${time}*.3+rw${index}*4.0);col=mix(col,mix(u_colorA,u_colorB,shimmer${index}),ribbon${index}*${strength});`,
              refraction:`vec2 rg${index}=patternUv*${a}*.9;vec2 warp${index}=vec2(fbm(rg${index}+vec2(${time}*.018,0.0)),fbm(rg${index}+vec2(7.2,-${time}*.014)));vec2 glassUv${index}=patternUv+(warp${index}-.5)*.2*${strength};float glass${index}=fbm(glassUv${index}*${a}*1.65);float refractEdge${index}=1.0-smoothstep(.02,.13,abs(fract(glass${index}*3.4)-.5));float prismShift${index}=.5+.5*sin((warp${index}.x-warp${index}.y)*${a}*5.0+${time});col=mix(col,mix(u_colorA,u_colorB,prismShift${index}),refractEdge${index}*${strength}*.62);col+=u_colorC*pow(refractEdge${index},5.0)*${strength}*.22;`,
              watercolor:`vec2 wp${index}=patternUv*${a}*.42+vec2(${time}*.012,-${time}*.009);float wash${index}=fbm(wp${index})*.65+fbm(wp${index}*2.15+4.7)*.35;float pool${index}=smoothstep(.34,.68,wash${index});float pigmentEdge${index}=smoothstep(.3,.4,wash${index})*(1.0-smoothstep(.48,.59,wash${index}));float pigment${index}=fbm(wp${index}*1.2+8.1);vec3 washColor${index}=mix(u_colorA,u_colorC,pigment${index});col=mix(col,washColor${index},pool${index}*${strength}*.72);col+=u_colorB*pigmentEdge${index}*${strength}*.2;`,
              startrails:`vec2 st${index}=patternUv*vec2(${a},${a}*.62);vec2 sc${index}=floor(st${index});vec2 sf${index}=fract(st${index});float seed${index}=hash(sc${index});float phase${index}=fract(u_time*${b}*.0018*u_energy+seed${index}*7.0);float dx${index}=fract(sf${index}.x-phase${index}+1.0);float sy${index}=.18+.64*hash(sc${index}+5.1);float tail${index}=(1.0-smoothstep(.015,.32,dx${index}))*exp(-abs(sf${index}.y-sy${index})*42.0)*step(.72,seed${index});float head${index}=exp(-length(vec2(dx${index},(sf${index}.y-sy${index})*1.7))*34.0)*step(.72,seed${index});col+=u_colorB*(tail${index}*.42+head${index})*${strength};`,
              mosaic:`vec2 mg${index}=patternUv*${a}*.62;vec2 mc${index}=floor(mg${index});vec2 mf${index}=fract(mg${index});float md1${index}=10.0;float md2${index}=10.0;vec2 nearest${index}=vec2(0.0);for(int yy${index}=-1;yy${index}<=1;yy${index}++){for(int xx${index}=-1;xx${index}<=1;xx${index}++){vec2 cell${index}=mc${index}+vec2(float(xx${index}),float(yy${index}));vec2 jitter${index}=vec2(hash(cell${index}),hash(cell${index}+19.7))*.54+.23;vec2 delta${index}=vec2(float(xx${index}),float(yy${index}))+jitter${index}-mf${index};float dist${index}=dot(delta${index},delta${index});if(dist${index}<md1${index}){md2${index}=md1${index};md1${index}=dist${index};nearest${index}=cell${index};}else if(dist${index}<md2${index}){md2${index}=dist${index};}}}float seam${index}=smoothstep(.012,.075,md2${index}-md1${index});float paneId${index}=hash(nearest${index});vec3 pane${index}=paneId${index}<.33?u_colorA:(paneId${index}<.66?u_colorB:u_colorC);float paneLight${index}=.82+.18*sin(${time}*.4+paneId${index}*8.0);col=mix(col,u_base,(1.0-seam${index})*.92);col=mix(col,pane${index}*paneLight${index},seam${index}*${strength});`
            };
            steps.push(patterns[node.type]);
          }
        });
        const fragment=`#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform vec2 u_resolution;uniform float u_time;uniform float u_energy;uniform float u_grain;uniform float u_colorShift;
uniform vec3 u_base;uniform vec3 u_colorA;uniform vec3 u_colorB;uniform vec3 u_colorC;
uniform vec4 u_screenRects[32];uniform int u_screenCount;uniform bool u_clipScreens;uniform bool u_separate;
${declarations.join('\n')}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+17.1;a*=.5;}return v;}
vec3 rgbToHsv(vec3 c){vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}
vec3 hsvToRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return c.z*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),c.y);}
void main(){vec2 uv=v_uv;int screenIndex=-1;vec2 localUv=uv;
for(int i=0;i<32;i++){if(i<u_screenCount){vec4 r=u_screenRects[i];if(uv.x>=r.x&&uv.x<=r.x+r.z&&uv.y>=r.y&&uv.y<=r.y+r.w){screenIndex=i;localUv=(uv-r.xy)/r.zw;}}}
if(u_clipScreens&&screenIndex<0)discard;if(u_separate&&screenIndex>=0)uv=localUv;float outputAspect=u_resolution.x/u_resolution.y;if(u_separate&&screenIndex>=0){vec4 selectedRect=u_screenRects[screenIndex];outputAspect=selectedRect.z*u_resolution.x/(selectedRect.w*u_resolution.y);}vec2 patternUv=vec2((uv.x-.5)*outputAspect+.5,uv.y);
vec3 col=mix(u_base,u_colorC,smoothstep(0.0,1.0,uv.y)*.62);
${steps.join('\n')}
vec3 hsv=rgbToHsv(clamp(col,0.0,1.0));hsv.x=fract(hsv.x+u_colorShift);outColor=vec4(hsvToRgb(hsv),1.0);}`;
        return {fragment,nodeUniformNames};
      }
      function compileGraph(){
        if(!gl){$('shaderStatus').textContent='WebGL 2 is unavailable in this browser.';$('shaderStatus').classList.add('error');return;}
        const graph=currentGraph(),key=JSON.stringify(graph.map(({id,type,enabled})=>({id,type,enabled})));
        if(key===compiledGraphKey&&shaderProgram)return;
        const built=shaderSource(graph);
        const vertex=`#version 300 es
precision highp float;out vec2 v_uv;void main(){vec2 p=gl_VertexID==0?vec2(-1.0,-1.0):(gl_VertexID==1?vec2(3.0,-1.0):vec2(-1.0,3.0));v_uv=p*.5+.5;gl_Position=vec4(p,0.0,1.0);}`;
        let vs,fs,program;
        try{
          const make=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');return shader;};
          vs=make(gl.VERTEX_SHADER,vertex);fs=make(gl.FRAGMENT_SHADER,built.fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
          if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');
          const names=['u_resolution','u_time','u_energy','u_grain','u_colorShift','u_base','u_colorA','u_colorB','u_colorC','u_screenRects','u_screenCount','u_clipScreens','u_separate'];
          const uniforms={};names.forEach(name=>uniforms[name]=gl.getUniformLocation(program,name));
          const nodeUniforms={};Object.entries(built.nodeUniformNames).forEach(([id,slots])=>{nodeUniforms[id]={a:gl.getUniformLocation(program,slots.a),b:gl.getUniformLocation(program,slots.b),c:gl.getUniformLocation(program,slots.a+'C')};});
          if(shaderProgram)gl.deleteProgram(shaderProgram);shaderProgram=program;shaderUniforms=uniforms;shaderNodeUniforms=nodeUniforms;compiledGraphKey=key;
          $('shaderStatus').textContent=`WebGL 2 shader compiled · ${graph.filter(node=>node.enabled).length} active nodes`;$('shaderStatus').classList.remove('error');
        }catch(error){if(program)gl.deleteProgram(program);$('shaderStatus').textContent=`Shader error: ${error.message}`;$('shaderStatus').classList.add('error');}
        finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
      }
      function choosePreset(id){
        if(state.recipeSettings[state.preset])state.recipeSettings[state.preset]={energy:state.energy,grain:state.grain};
        state.preset=id;
        const settings=state.recipeSettings[id]||{energy:35,grain:12};state.energy=settings.energy??settings.motion??35;state.grain=settings.grain??12;
        compileGraph();syncInputs();draw();save();
      }
      function toggleRecipe(id){
        if(state.selectedRecipes.includes(id))state.selectedRecipes=state.selectedRecipes.filter(item=>item!==id);
        else {state.selectedRecipes.push(id);choosePreset(id);}
        if(state.selectedRecipes.length&&!state.selectedRecipes.includes(state.preset))choosePreset(state.selectedRecipes[0]);
        syncInputs();renderRecipeStrip();draw();save();
      }
      function addCurrentSceneToPlaylist(){
        if(state.selectedRecipes.includes(state.preset))return;
        state.selectedRecipes.push(state.preset);renderRecipeSelection();renderRecipeStrip();save();
      }
      function renderList() {
        $('screenList').innerHTML='';
        state.screens.forEach((s,i)=>{
          const row=document.createElement('div'); row.className='screen-item'+(s.id===state.selected?' selected':''); row.dataset.id=s.id;
          row.innerHTML=`<span class="screen-icon">${i+1}</span><span class="screen-copy"><strong></strong><small></small></span><span class="screen-actions"><button class="icon-btn" title="Remove screen" aria-label="Remove screen">×</button></span>`;
          row.querySelector('strong').textContent=s.name||'Unnamed screen'; row.querySelector('small').textContent=`${s.width} × ${s.height} · ${aspect(s.width,s.height)}`;
          row.addEventListener('click',e=>{ if(e.target.closest('button')) return;state.selected=s.id;syncInputs();renderList();draw();save(); });
          row.querySelector('button').addEventListener('click',e=>{e.stopPropagation();if(state.screens.length<2)return;state.screens=state.screens.filter(x=>x.id!==s.id);if(state.selected===s.id)state.selected=state.screens[Math.max(0,i-1)].id;syncInputs();renderList();draw();save();});
          $('screenList').append(row);
        });
      }
      function draw(updateOverlays=true) {
        const box=maxBounds(), stage=$('stage');
        stage.style.aspectRatio=`${box.width} / ${box.height}`;
        stage.style.transform=`translate(${panX}px, ${panY}px) scale(${viewZoom})`;
        $('zoomLabel').textContent=`${Math.round(viewZoom*100)}%`;
        const dpr=Math.min(window.devicePixelRatio||1,2), w=renderResolution?.width||Math.max(1,Math.round(stage.clientWidth*dpr)), h=renderResolution?.height||Math.max(1,Math.round(stage.clientHeight*dpr));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        if(gl){
          if(!shaderProgram)compileGraph();
          if(shaderProgram){
            gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(shaderProgram);
            const set1=(name,value)=>{const loc=shaderUniforms[name];if(loc!==null)gl.uniform1f(loc,value);};
            const palette=colorPalette(state.preset),colorSetting=state.colorSettings[state.preset]||defaultColors.aurora;
            const rgb=hex=>[parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255];
            if(shaderUniforms.u_resolution)gl.uniform2f(shaderUniforms.u_resolution,canvas.width,canvas.height);
            set1('u_time',elapsed);set1('u_energy',state.energy/100);set1('u_grain',state.grain/100);set1('u_colorShift',colorSetting.shift/360);
            gl.uniform3fv(shaderUniforms.u_base,rgb(palette.base));gl.uniform3fv(shaderUniforms.u_colorA,rgb(palette.a));gl.uniform3fv(shaderUniforms.u_colorB,rgb(palette.b));gl.uniform3fv(shaderUniforms.u_colorC,rgb(palette.c));
            const rects=new Float32Array(128),targetScreen=renderTargetContext?.screen;
            const screenCount=targetScreen?1:Math.min(32,state.screens.length);
            if(targetScreen)rects.set([0,0,1,1],0);
            else state.screens.slice(0,32).forEach((screen,index)=>{
              const x=(screen.x-box.x)/box.width,y=1-(screen.y-box.y+screen.height)/box.height,w=screen.width/box.width,h=screen.height/box.height;
              rects.set([x,y,w,h],index*4);
            });
            gl.uniform4fv(shaderUniforms.u_screenRects,rects);gl.uniform1i(shaderUniforms.u_screenCount,screenCount);
            gl.uniform1i(shaderUniforms.u_clipScreens,targetScreen?0:(state.maskOffscreen?1:0));gl.uniform1i(shaderUniforms.u_separate,targetScreen||state.layout==='separate'?1:0);
            const graph=currentGraph();
            graph.forEach((node,index)=>{if(!node.enabled)return;const slots=shaderNodeUniforms[node.id];if(!slots)return;
              const patterned=['waves','contours','rings','stars','bloom','prism','rays','ink','halftone','particles','horizon','ribbons','refraction','watercolor','startrails','mosaic'].includes(node.type);
              if(slots.a!==null){const value=node.type==='noise'||patterned?node.scale:node.type==='gradient'?node.angle:node.type==='blend'?node.opacity/100:node.type==='grain'?node.amount/100:0;gl.uniform1f(slots.a,value);}
              if(slots.b!==null)gl.uniform1f(slots.b,node.type==='noise'||patterned?(node.speed??0):node.type==='gradient'?(node.strength??32)/100:0);
              if(slots.c!==null)gl.uniform1f(slots.c,patterned?(node.strength??82)/100:(node.contrast??100)/100);
            });
            gl.drawArrays(gl.TRIANGLES,0,3);
          }
        }
        const fit=Math.min(stage.clientWidth/box.width,stage.clientHeight/box.height);
        if(updateOverlays){
          const outlines=$('outlines');outlines.innerHTML='';
          state.screens.forEach(s=>{const el=document.createElement('div');el.className='screen-outline'+(s.id===state.selected?' selected':'');el.dataset.screenId=s.id;el.style.left=`${(s.x-box.x)/box.width*100}%`;el.style.top=`${(s.y-box.y)/box.height*100}%`;el.style.width=`${s.width/box.width*100}%`;el.style.height=`${s.height/box.height*100}%`;const tag=document.createElement('span');tag.textContent=s.name||'Unnamed screen';el.append(tag);outlines.append(el);});
        }
        $('scaleReadout').textContent=`Preview scale · ${Math.max(1,Math.round(fit*100))}%`;
      }
      function updateSelected(key,value){const s=current();if(!s)return;s[key]=Number(value)||0;if(key==='width'||key==='height')s[key]=Math.max(key==='width'?320:240,Math.min(key==='width'?12000:8000,s[key]));syncInputs();renderList();draw();save();}
      $('screenName').addEventListener('input',e=>{const s=current();if(!s)return;s.name=e.target.value;$('selectedTitle').textContent=s.name||'Unnamed screen';renderList();draw();save();});
      $('screenName').addEventListener('change',e=>{const s=current();if(!s)return;s.name=e.target.value.trim()||`Screen ${state.screens.indexOf(s)+1}`;e.target.value=s.name;$('selectedTitle').textContent=s.name;renderList();draw();save();});
      function setZoom(next){viewZoom=Math.max(.5,Math.min(10,Math.round(next*100)/100));draw();}
      function fitPreview(){
        const stage=$('stage'),wrap=$('previewWrap'),previousTransition=stage.style.transition;
        stage.style.transition='none';stage.style.transform='none';
        const stageRect=stage.getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect(),css=getComputedStyle(wrap);
        const padLeft=parseFloat(css.paddingLeft)||0,padRight=parseFloat(css.paddingRight)||0,padTop=parseFloat(css.paddingTop)||0,padBottom=parseFloat(css.paddingBottom)||0;
        const contentLeft=wrapRect.left+(parseFloat(css.borderLeftWidth)||0)+padLeft,contentTop=wrapRect.top+(parseFloat(css.borderTopWidth)||0)+padTop;
        const contentWidth=Math.max(1,wrap.clientWidth-padLeft-padRight),contentHeight=Math.max(1,wrap.clientHeight-padTop-padBottom),margin=34;
        viewZoom=Math.max(.01,Math.min(10,Math.max(1,contentWidth-margin*2)/Math.max(1,stageRect.width),Math.max(1,contentHeight-margin*2)/Math.max(1,stageRect.height)));
        panX=contentLeft+contentWidth/2-(stageRect.left+stageRect.width/2);
        panY=contentTop+contentHeight/2-(stageRect.top+stageRect.height/2);
        draw();stage.offsetWidth;stage.style.transition=previousTransition;
      }
      $('zoomIn').addEventListener('click',()=>setZoom(viewZoom+.2));
      $('zoomOut').addEventListener('click',()=>setZoom(viewZoom-.2));
      $('fitView').addEventListener('click',fitPreview);
      $('outlines').addEventListener('click',e=>{
        const outline=e.target.closest('.screen-outline');
        if(!outline)return;
        state.selected=outline.dataset.screenId;syncInputs();renderList();draw();save();
      });
      $('previewWrap').addEventListener('wheel',e=>{
        if(e.target.closest('.preview-controls'))return;
        e.preventDefault();
        const oldZoom=viewZoom, next=Math.max(.5,Math.min(10,oldZoom*Math.exp(-e.deltaY*.0015)));
        if(next===oldZoom)return;
        const rect=$('stage').getBoundingClientRect();
        const dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2);
        const factor=next/oldZoom;
        panX-=dx*(factor-1);panY-=dy*(factor-1);viewZoom=next;draw();
      },{passive:false});
      $('previewWrap').addEventListener('pointerdown',e=>{
        if(e.button!==0||e.target.closest('.screen-outline, .preview-controls'))return;
        dragging=true;dragMoved=false;pointerX=e.clientX;pointerY=e.clientY;startPanX=panX;startPanY=panY;
        $('previewWrap').classList.add('panning');$('previewWrap').setPointerCapture(e.pointerId);
      });
      $('previewWrap').addEventListener('pointermove',e=>{
        if(!dragging)return;
        const dx=e.clientX-pointerX,dy=e.clientY-pointerY;
        if(Math.abs(dx)+Math.abs(dy)>3)dragMoved=true;
        panX=startPanX+dx;panY=startPanY+dy;draw();
      });
      const stopPan=e=>{if(!dragging)return;dragging=false;$('previewWrap').classList.remove('panning');if(dragMoved){e.preventDefault();setTimeout(()=>{dragMoved=false;},0);}};
      $('previewWrap').addEventListener('pointerup',stopPan);
      $('previewWrap').addEventListener('pointercancel',stopPan);
      $('previewWrap').addEventListener('click',e=>{if(dragMoved){e.preventDefault();e.stopImmediatePropagation();dragMoved=false;}},true);
      [['screenX','x'],['screenY','y']].forEach(([id,key])=>$(id).addEventListener('input',e=>updateSelected(key,e.target.value)));
      [['screenWidth','width'],['screenHeight','height']].forEach(([id,key])=>{
        const input=$(id);
        const commit=()=>updateSelected(key,input.value);
        input.addEventListener('change',commit);
        input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();input.blur();}});
      });
      function updateGap(value){
        state.gap=clamp(Number(value)||0,0,1000);
        let x=0;state.screens.forEach(s=>{s.x=x;x+=s.width+state.gap;});
        syncInputs();renderList();draw();save();
      }
      $('gap').addEventListener('change',e=>updateGap(e.target.value));
      $('gap').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();updateGap(e.target.value);e.target.blur();}});
      $('maskOffscreen').addEventListener('change',e=>{state.maskOffscreen=e.target.checked;draw();save();});
      $('energy').addEventListener('input',e=>{state.energy=Number(e.target.value);state.recipeSettings[state.preset]={energy:state.energy,grain:state.grain};$('energyVal').textContent=`${state.energy}%`;draw();save();});
      $('grain').addEventListener('input',e=>{state.grain=Number(e.target.value);state.recipeSettings[state.preset]={energy:state.energy,grain:state.grain};$('grainVal').textContent=`${state.grain}%`;draw();save();});
      $('colorMode').addEventListener('change',e=>{state.colorSettings[state.preset].mode=e.target.value;renderColorControls();draw();save();});
      $('colorShift').addEventListener('input',e=>{const setting=state.colorSettings[state.preset];setting.shift=Number(e.target.value);$('colorShiftVal').textContent=`${setting.shift}°`;draw();save();});
      $('colorControls').addEventListener('input',e=>{
        const field=e.target.closest('[data-color-index]');if(!field)return;
        const value=field.value.trim().toUpperCase();if(!/^#[0-9A-F]{6}$/.test(value))return;
        const index=Number(field.dataset.colorIndex);state.colorSettings[state.preset].colors[index]=value;
        $('colorControls').querySelectorAll(`[data-color-index="${index}"]`).forEach(input=>{if(input!==field)input.value=value;});
        draw();save();
      });
      $('resetEnergy').addEventListener('click',()=>{state.energy=35;state.recipeSettings[state.preset]={energy:35,grain:state.grain};syncInputs();draw();save();});
      $('resetColor').addEventListener('click',()=>{state.colorSettings[state.preset]=JSON.parse(JSON.stringify(defaultColors[state.preset]||defaultColors.aurora));syncInputs();draw();save();});
      $('resetGrain').addEventListener('click',()=>{state.grain=12;state.recipeSettings[state.preset]={energy:state.energy,grain:12};syncInputs();draw();save();});
      $('graphNodes').addEventListener('click',e=>{
        const action=e.target.closest('[data-node-action]');if(!action)return;
        const graph=currentGraph(),card=action.closest('[data-node-id]'),index=graph.findIndex(node=>node.id===card.dataset.nodeId),kind=action.dataset.nodeAction;
        if(index<0)return;
        if(kind==='reset'){
          const node=graph[index],wasEnabled=node.enabled;
          ['scale','speed','contrast','angle','strength','opacity','amount'].forEach(key=>delete node[key]);
          Object.assign(node,defaultNodeParams(node.type));node.enabled=true;
          if(!wasEnabled)compileGraph();renderGraphEditor();draw();save();return;
        }
        if(kind==='remove')graph.splice(index,1);
        else if(kind==='up'&&index>0)[graph[index-1],graph[index]]=[graph[index],graph[index-1]];
        else if(kind==='down'&&index<graph.length-1)[graph[index+1],graph[index]]=[graph[index],graph[index+1]];
        compileGraph();renderGraphEditor();draw();save();
      });
      $('graphNodes').addEventListener('change',e=>{
        if(!e.target.matches('[data-node-enabled]'))return;
        const card=e.target.closest('[data-node-id]'),node=currentGraph().find(item=>item.id===card.dataset.nodeId);if(!node)return;
        node.enabled=e.target.checked;compileGraph();renderGraphEditor();draw();save();
      });
      $('graphNodes').addEventListener('input',e=>{
        if(!e.target.matches('[data-node-param]'))return;
        const card=e.target.closest('[data-node-id]'),node=currentGraph().find(item=>item.id===card.dataset.nodeId);if(!node)return;
        const key=e.target.dataset.nodeParam;node[key]=Number(e.target.value);
        const readout=e.target.parentElement.querySelector('.field-head span');
        readout.textContent=key==='scale'?`${node[key].toFixed(1)}×`:key==='angle'?`${Math.round(node[key])}°`:`${Math.round(node[key])}%`;
        draw();save();
      });
      $('addGraphNode').addEventListener('click',()=>{
        currentGraph().push(createNode($('addNodeType').value));compileGraph();renderGraphEditor();draw();save();
      });
      $('advancedMode').addEventListener('change',e=>{advancedMode=e.target.checked;renderRecipeSelection();renderGraphEditor();});
      $('scrub').addEventListener('input',e=>{state.time=Number(e.target.value);elapsed=state.time;syncInputs();draw();save();});
      $('playBtn').addEventListener('click',()=>{state.playing=!state.playing;syncInputs();save();});
      document.querySelectorAll('[data-layout]').forEach(b=>b.addEventListener('click',()=>{state.layout=b.dataset.layout;syncInputs();draw();save();}));
      document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>choosePreset(b.dataset.preset)));
      document.querySelectorAll('[data-toggle-recipe]').forEach(b=>b.addEventListener('click',()=>toggleRecipe(b.dataset.toggleRecipe)));
      $('addScreen').addEventListener('click',()=>{const n=state.screens.length+1,s={id:`screen-${Date.now()}`,name:`Screen ${n}`,width:1920,height:1080,x:maxBounds().width+state.gap,y:0};state.screens.push(s);state.selected=s.id;syncInputs();renderList();draw();save();});
      $('resetBtn').addEventListener('click',()=>{const savedLayouts=state.savedLayouts;state={...initial,screens:initial.screens.map(s=>({...s})),recipeGraphs:{},colorSettings:JSON.parse(JSON.stringify(defaultColors)),savedLayouts};Object.keys(designNames).forEach(id=>state.recipeGraphs[id]=defaultRecipeGraph(id));elapsed=state.time;compiledGraphKey='';compileGraph();syncInputs();renderList();draw();save();});
      $('saveLayout').addEventListener('click',()=>{
        const id=`layout-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        const name=$('layoutName').value.trim()||`Layout ${state.savedLayouts.length+1}`;
        state.savedLayouts.push({id,name,layout:state.layout,gap:state.gap,selected:state.selected,screens:state.screens.map(screen=>({...screen}))});
        renderSavedLayouts();$('savedLayoutSelect').value=id;$('savedLayoutStatus').textContent=`“${name}” saved on this device.`;$('recallLayout').disabled=false;$('deleteLayout').disabled=false;save();
      });
      $('layoutName').addEventListener('keydown',e=>{if(e.key==='Enter')$('saveLayout').click();});
      $('savedLayoutSelect').addEventListener('change',()=>{const active=!!$('savedLayoutSelect').value;$('recallLayout').disabled=!active;$('deleteLayout').disabled=!active;});
      $('recallLayout').addEventListener('click',()=>{
        const saved=state.savedLayouts.find((layout,index)=>(layout.id||`saved-layout-${index}`)===$('savedLayoutSelect').value);if(!saved)return;
        state.screens=saved.screens.map(screen=>({...screen}));state.layout=saved.layout==='separate'?'separate':'span';state.gap=clamp(Number(saved.gap)||0,0,1000);
        state.selected=state.screens.some(screen=>screen.id===saved.selected)?saved.selected:state.screens[0].id;viewZoom=1;panX=0;panY=0;
        syncInputs();renderList();draw();save();$('savedLayoutStatus').textContent=`“${saved.name||'Saved layout'}” recalled.`;
      });
      $('deleteLayout').addEventListener('click',()=>{
        const id=$('savedLayoutSelect').value,index=state.savedLayouts.findIndex((layout,itemIndex)=>(layout.id||`saved-layout-${itemIndex}`)===id);if(index<0)return;
        const [removed]=state.savedLayouts.splice(index,1);renderSavedLayouts();save();$('savedLayoutStatus').textContent=`“${removed.name||'Saved layout'}” deleted.`;
      });
      $('saveBtn').addEventListener('click',()=>{save();});
      $('addSceneButton').addEventListener('click',addCurrentSceneToPlaylist);
      document.querySelectorAll('[data-workspace-tab]').forEach(button=>button.addEventListener('click',()=>selectWorkspaceTab(button.dataset.workspaceTab)));
      $('designSearch').addEventListener('input',filterDesigns);
      $('designCategory').addEventListener('change',filterDesigns);
      document.querySelectorAll('[data-batch-route]').forEach(button=>button.addEventListener('click',()=>{
        if(!state.selectedRecipes.length)return;
        if(button.dataset.batchRoute==='editor'&&!state.selectedRecipes.includes(state.preset))choosePreset(state.selectedRecipes[0]);
        selectWorkspaceTab(button.dataset.batchRoute);
      }));
      document.addEventListener('click',e=>{if(e.target.closest('[data-goto-browser]'))selectWorkspaceTab('browser');});
      function supportedRecordingTypes(){
        if(typeof MediaRecorder==='undefined')return {mp4:null,webm:null};
        const supports=type=>{try{return MediaRecorder.isTypeSupported(type)?type:null;}catch{return null;}};
        return {
          mp4:supports('video/mp4;codecs=avc1.42E01E')||supports('video/mp4'),
          webm:supports('video/webm;codecs=vp9')||supports('video/webm;codecs=vp8')||supports('video/webm')
        };
      }
      const recordingTypes=supportedRecordingTypes();
      $('exportFormat').querySelector('[value="mp4"]').disabled=!recordingTypes.mp4;
      $('exportFormat').querySelector('[value="webm"]').disabled=!recordingTypes.webm;
      if(recordingTypes.webm)$('exportFormat').querySelector('[value="webm"]').textContent=`WebM · ${recordingTypes.webm.includes('vp9')?'VP9':recordingTypes.webm.includes('vp8')?'VP8':'browser codec'}`;
      if(!recordingTypes.mp4&&recordingTypes.webm)$('exportFormat').value='webm';
      function safeFilename(value){return String(value||'scene').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'scene';}
      function downloadVideo(blob,name){
        const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.style.display='none';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }
      function recordCurrentScene(mime,fps,duration,label){
        return new Promise((resolve,reject)=>{
          let stream,recorder,timer,progressTimer,settled=false,chunks=[];
          const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(progressTimer);stream?.getTracks().forEach(track=>track.stop());reject(error instanceof Error?error:new Error(String(error)));};
          try{
            if(!canvas.captureStream)throw new Error('Canvas video capture is not available in this browser.');
            stream=canvas.captureStream(fps);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:18000000});
            recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
            recorder.onerror=event=>fail(event.error||new Error('The browser could not encode this video.'));
            recorder.onstop=()=>{
              if(settled)return;settled=true;clearTimeout(timer);clearInterval(progressTimer);stream.getTracks().forEach(track=>track.stop());
              const type=recorder.mimeType||mime,blob=new Blob(chunks,{type});
              if(!blob.size){reject(new Error('The browser produced an empty video file.'));return;}
              downloadVideo(blob,`${safeFilename(label)}.${type.includes('mp4')?'mp4':'webm'}`);resolve();
            };
            recorder.start(1000);
            const started=performance.now();
            progressTimer=setInterval(()=>{const seconds=Math.min(duration,Math.floor((performance.now()-started)/1000));$('exportNotice').textContent=`Recording ${label} · ${seconds} / ${duration} sec`;},250);
            timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},duration*1000);
          }catch(error){if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}fail(error);}
        });
      }
      async function renderPlaylist(){
        if(exportInProgress)return;
        if(!state.selectedRecipes.length){$('exportNotice').textContent='Add one or more scenes to the playlist before exporting.';return;}
        if(!gl||!canvas.captureStream||typeof MediaRecorder==='undefined'){$('exportNotice').textContent='Browser video export requires WebGL 2, canvas capture, and MediaRecorder support.';return;}
        const requestedFormat=$('exportFormat').value,mime=recordingTypes[requestedFormat];
        if(!mime){$('exportNotice').textContent=`${requestedFormat.toUpperCase()} recording is not supported by this browser. Choose an enabled format.`;return;}
        const fps=parseInt($('exportFps').value,10),duration=parseInt($('exportDuration').value,10),target=$('exportTarget').value;
        const outputs=[];
        state.selectedRecipes.forEach(sceneId=>{
          const sceneName=designNames[sceneId]||sceneId;
          if(target==='screens')state.screens.forEach(screen=>outputs.push({sceneId,sceneName,screen,label:`${sceneName} - ${screen.name||'Screen'}`,width:screen.width,height:screen.height}));
          else {const bounds=maxBounds();outputs.push({sceneId,sceneName,label:sceneName,width:bounds.width,height:bounds.height});}
        });
        const maxDims=gl.getParameter(gl.MAX_VIEWPORT_DIMS),maxBuffer=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        const tooLarge=outputs.find(output=>output.width>maxDims[0]||output.height>maxDims[1]||output.width>maxBuffer||output.height>maxBuffer);
        if(tooLarge){$('exportNotice').textContent=`${tooLarge.width.toLocaleString()} × ${tooLarge.height.toLocaleString()} exceeds this GPU's export limit (${Math.min(maxDims[0],maxBuffer).toLocaleString()} × ${Math.min(maxDims[1],maxBuffer).toLocaleString()} max width/height).`;return;}
        const button=$('renderVideo'),previous={preset:state.preset,time:state.time,elapsed,playing:state.playing,resolution:renderResolution,target:renderTargetContext};
        exportInProgress=true;button.disabled=true;button.textContent='Rendering…';state.playing=true;
        try{
          for(let index=0;index<outputs.length;index++){
            const output=outputs[index];$('exportNotice').textContent=`Preparing ${index+1} of ${outputs.length}: ${output.label}`;
            choosePreset(output.sceneId);state.time=0;elapsed=0;renderResolution={width:output.width,height:output.height};renderTargetContext=output.screen?{screen:output.screen}:null;draw(false);
            await recordCurrentScene(mime,fps,duration,output.label);
          }
          $('exportNotice').textContent=`Finished ${outputs.length} video${outputs.length===1?'':'s'}. Downloads have started.`;
        }catch(error){$('exportNotice').textContent=`Export stopped: ${error.message||'The browser could not render this video.'}`;}
        finally{
          renderResolution=previous.resolution;renderTargetContext=previous.target;elapsed=previous.elapsed;state.time=previous.time;state.playing=previous.playing;
          if(state.preset!==previous.preset)choosePreset(previous.preset);else{syncInputs();draw();}
          $('scrub').value=state.time;$('timeReadout').textContent=formatTime(state.time);button.disabled=false;button.textContent='Render video';exportInProgress=false;
        }
      }
      ['exportTarget','exportFormat','exportFps','exportDuration'].forEach(id=>$(id).addEventListener('change',updateExportSummary));
      $('renderVideo').addEventListener('click',renderPlaylist);
      function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(state.playing){elapsed+=dt;state.time=(state.time+dt)%30;$('scrub').value=state.time;$('timeReadout').textContent=formatTime(state.time);draw(false);}anim=requestAnimationFrame(frame);}
      syncInputs();renderList();filterDesigns();compileGraph();draw();window.addEventListener('resize',draw);anim=requestAnimationFrame(frame);
    })();
