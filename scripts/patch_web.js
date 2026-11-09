const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Update Home screen hero banner from "Scan Packaged Food Quality" to "Universal AI Food Intelligence"
content = content.replace(
  /<!-- PROMINENT AI FOOD SCANNER HERO BANNER[\s\S]*?<!-- Search & Dietary Filter Bar -->/,
  `<!-- PROMINENT AI FOOD INTELLIGENCE HERO BANNER -->
      <div onclick="window.switchPage('aifood')" class="cursor-pointer bg-gradient-to-r from-emerald-800 via-teal-700 to-amber-500 text-white p-4 sm:p-5 rounded-3xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-0.5 border border-white/20 relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 w-36 h-36 bg-white/15 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
        <div class="flex items-center justify-between relative z-10">
          <div class="space-y-1.5 max-w-[70%]">
            <div class="flex items-center space-x-2">
              <span class="text-[10px] font-black bg-amber-300 text-slate-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center space-x-1">
                <i class="fa-solid fa-sparkles text-[9px]"></i>
                <span>Universal Food AI</span>
              </span>
              <span class="text-[10px] text-emerald-100 font-bold bg-white/15 px-2 py-0.5 rounded-full">100% Accurate</span>
            </div>
            <h2 class="text-base sm:text-lg font-black leading-tight text-white flex items-center space-x-2">
              <span>AI Food & Grain Intelligence</span>
            </h2>
            <p class="text-[11px] sm:text-xs text-emerald-50 leading-snug">
              Instant benefits, complete vitamins & minerals, who should eat, contraindications & bad food combinations!
            </p>
          </div>
          <div class="flex flex-col items-center justify-center space-y-1">
            <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white text-emerald-800 shadow-lg flex items-center justify-center text-xl sm:text-2xl font-black group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <i class="fa-solid fa-wand-magic-sparkles text-emerald-600"></i>
            </div>
            <span class="text-[10px] font-black tracking-wider text-amber-100 uppercase">Explore AI →</span>
          </div>
        </div>
      </div>

      <!-- Search & Dietary Filter Bar -->`
);

// 2. Replace the old page-scanner div with page-aifood div (and alias page-scanner)
const aiFoodPageHtml = `    <!-- PAGE 4: AI FOOD INTELLIGENCE & NUTRITION ENCYCLOPEDIA -->
    <div id="page-aifood" class="space-y-6 hidden">
      
      <!-- AI Food Hero & Header -->
      <div class="bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-emerald-700/40 relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10 space-y-2">
          <div class="flex items-center space-x-2">
            <span class="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-3 py-1 rounded-full shadow-sm flex items-center space-x-1">
              <i class="fa-solid fa-sparkles text-[10px]"></i>
              <span>Universal Food Intelligence AI</span>
            </span>
            <span class="text-[10px] text-emerald-300 font-bold bg-white/10 px-2.5 py-1 rounded-full">Evidence-Based</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black tracking-tight flex items-center space-x-2">
            <span>Nutrolix AI Food</span>
            <i class="fa-solid fa-wand-magic-sparkles text-amber-400 text-base animate-pulse"></i>
          </h2>
          <p class="text-xs text-slate-300 max-w-xl leading-relaxed">
            Search any grain, vegetable, fruit, dal, snack, spice, or herb in Hindi or English. Get deep clinical benefits, complete vitamins & minerals, who should eat, contraindications & bad food combinations.
          </p>
        </div>
      </div>

      <!-- SEARCH BAR WITH TYPEWRITER ANIMATION -->
      <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <form onsubmit="window.handleAiFoodSearch(event)" class="relative flex items-center">
          <div class="absolute left-4 text-emerald-600 text-base">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <input 
            type="text" 
            id="aiFoodSearchInput" 
            placeholder="Search Cow Ghee, Wheat, Palak, Bajra..." 
            class="w-full pl-11 pr-24 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white shadow-inner transition"
          />
          <button 
            type="submit" 
            id="aiFoodSearchBtn" 
            class="absolute right-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition flex items-center space-x-1.5"
          >
            <span>Search</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </form>

        <!-- Quick Pre-Searchable Suggestion Chips (User requested) -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <i class="fa-solid fa-bolt text-amber-500"></i>
              <span>Quick Suggestions (Click to Analyse)</span>
            </span>
            <span class="text-[10px] text-slate-400">Hindi & English supported</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" onclick="window.quickSearchAiFood('Analyse Wheat')" class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🌾 Analyse Wheat</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Benefits of Anjeer')" class="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🫐 Benefits of Anjeer</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Analyse Potato')" class="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🥔 Analyse Potato</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Cow Ghee')" class="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🧈 Cow Ghee</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Soyabeans')" class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🌱 Soyabeans</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Palak')" class="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🥬 Palak (Spinach)</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Dhaniya')" class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🌿 Dhaniya (Coriander)</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Bajra')" class="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 text-[11px] font-bold border border-orange-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🌾 Bajra</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Ashwagandha')" class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-[11px] font-bold border border-indigo-200/70 shadow-sm transition flex items-center space-x-1">
              <span>✨ Ashwagandha</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Makhana')" class="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200 shadow-sm transition flex items-center space-x-1">
              <span>🌰 Makhana</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Pizza')" class="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-[11px] font-bold border border-rose-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🍕 Pizza</span>
            </button>
            <button type="button" onclick="window.quickSearchAiFood('Potato Chips')" class="px-3 py-1.5 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-900 text-[11px] font-bold border border-yellow-200/70 shadow-sm transition flex items-center space-x-1">
              <span>🍟 Potato Chips</span>
            </button>
          </div>
        </div>
      </div>

      <!-- LOADING STATE -->
      <div id="aiFoodLoadingState" class="hidden bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-3">
        <div class="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin mx-auto"></div>
        <p class="text-sm font-extrabold text-slate-800">Analysing with AI Food Clinical Knowledge...</p>
        <p class="text-xs text-slate-400">Fetching benefits, complete vitamins & minerals, contraindications & food combinations.</p>
      </div>

      <!-- RESULTS CONTAINER -->
      <div id="aiFoodResultContainer" class="space-y-4">
        <!-- Rendered by window.renderFoodAiResult -->
      </div>

    </div>
    <!-- Alias div to prevent missing element errors -->
    <div id="page-scanner" class="hidden"></div>`;

content = content.replace(
  /<!-- PAGE 4: AI FOOD QUALITY SCANNER[\s\S]*?<!-- SCAN HISTORY TAB CONTAINER[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  aiFoodPageHtml
);

// 3. Update Bottom Nav Button #3 from "Scan AI" to "AI Food"
content = content.replace(
  /<!-- 3\. CENTER RAISED SCANNER BUTTON[\s\S]*?<\/button>/,
  `<!-- 3. CENTER RAISED AI FOOD BUTTON -->
      <button onclick="window.switchPage('aifood')" id="navBtn-aifood" class="nav-item flex flex-col items-center justify-center relative -top-3 group">
        <div class="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-600/30 group-hover:scale-105 group-hover:shadow-emerald-600/50 transition-all border-2 border-white">
          <i class="fa-solid fa-wand-magic-sparkles text-xl text-white"></i>
        </div>
        <span class="text-[10px] font-black text-emerald-700 mt-1 flex items-center space-x-0.5">
          <span>AI Food</span>
          <i class="fa-solid fa-sparkles text-[8px] text-amber-500"></i>
        </span>
      </button>`
);

// 4. Update More Drawer Item
content = content.replace(
  /<!-- Prominent AI Scanner in More Drawer -->[\s\S]*?<\/button>/,
  `<!-- Prominent AI Food in More Drawer -->
          <button onclick="window.switchPage('aifood'); window.closeModal('moreDrawerModal');" class="w-full flex items-center space-x-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-950 font-bold transition text-left border border-emerald-200">
            <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <p class="text-xs font-black flex items-center space-x-1">
                <span>Universal AI Food Intelligence</span>
                <span class="text-[9px] bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded font-extrabold">NEW</span>
              </p>
              <p class="text-[10px] text-emerald-700 font-normal">Benefits, vitamins, minerals, who should eat & pairings</p>
            </div>
          </button>`
);

// 5. Update switchPage to support 'aifood' and map 'scanner' -> 'aifood'
content = content.replace(
  /window\.switchPage = function\(pageId\) \{[\s\S]*?window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\);\s*\};/,
  `window.switchPage = function(pageId) {
      if (pageId === 'scanner') pageId = 'aifood';

      ['home', 'orders', 'aifood', 'profile'].forEach(id => {
        const el = document.getElementById(\`page-\${id}\`);
        if (el) el.classList.add('hidden');
        const navBtn = document.getElementById(\`navBtn-\${id}\`);
        if (navBtn) {
          if (id === 'aifood') {
            navBtn.className = 'nav-item flex flex-col items-center justify-center relative -top-3 group';
          } else {
            navBtn.className = 'nav-item flex flex-col items-center justify-center space-y-1 text-slate-400 hover:text-slate-700 transition';
          }
        }
      });

      const target = document.getElementById(\`page-\${pageId}\`);
      if (target) target.classList.remove('hidden');

      const activeNav = document.getElementById(\`navBtn-\${pageId}\`);
      if (activeNav) {
        if (pageId === 'aifood') {
          activeNav.className = 'nav-item flex flex-col items-center justify-center relative -top-3 group scale-105 transition-transform';
        } else {
          activeNav.className = 'nav-item flex flex-col items-center justify-center space-y-1 text-emerald-600 transition font-bold';
        }
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };`
);

// 6. Inject AI Food script (typewriter, search, and 6-card renderer) right before </body>
const aiFoodScript = `
  <!-- AI FOOD INTELLIGENCE LOGIC & TYPEWRITER -->
  <script>
    const foodTypewriterWords = [
      "Cow Ghee",
      "Soyabeans",
      "Dhaniya",
      "Palak",
      "Wheat",
      "Bajra",
      "Anjeer",
      "Makhana",
      "Ashwagandha",
      "Potato",
      "Pizza",
      "Potato Chips"
    ];
    let twWordIdx = 0;
    let twCharIdx = 0;
    let twIsDeleting = false;
    let twTimer = null;

    function runFoodTypewriter() {
      const inputEl = document.getElementById('aiFoodSearchInput');
      if (!inputEl) return;
      
      // Do not animate if user has entered their own text or focused
      if (inputEl.value && inputEl.value.trim().length > 0) {
        twTimer = setTimeout(runFoodTypewriter, 1500);
        return;
      }

      const currentWord = foodTypewriterWords[twWordIdx];
      if (twIsDeleting) {
        twCharIdx--;
      } else {
        twCharIdx++;
      }
      
      inputEl.placeholder = 'Search "' + currentWord.substring(0, twCharIdx) + '"...';

      let delay = twIsDeleting ? 50 : 110;
      if (!twIsDeleting && twCharIdx === currentWord.length) {
        delay = 1800; // pause at end of word
        twIsDeleting = true;
      } else if (twIsDeleting && twCharIdx === 0) {
        twIsDeleting = false;
        twWordIdx = (twWordIdx + 1) % foodTypewriterWords.length;
        delay = 400; // pause before next word
      }
      twTimer = setTimeout(runFoodTypewriter, delay);
    }

    window.handleAiFoodSearch = async function(e) {
      if (e) e.preventDefault();
      const inputEl = document.getElementById('aiFoodSearchInput');
      const query = (inputEl ? inputEl.value : '').trim();
      if (!query) {
        alert("Please enter a food or grain name (e.g. Cow Ghee, Wheat, Palak, Anjeer).");
        return;
      }
      await window.fetchAndRenderFoodAi(query);
    };

    window.quickSearchAiFood = async function(query) {
      const inputEl = document.getElementById('aiFoodSearchInput');
      if (inputEl) inputEl.value = query;
      await window.fetchAndRenderFoodAi(query);
    };

    window.fetchAndRenderFoodAi = async function(query) {
      const loadingEl = document.getElementById('aiFoodLoadingState');
      const containerEl = document.getElementById('aiFoodResultContainer');
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (containerEl) containerEl.innerHTML = '';

      try {
        const res = await fetch('/api/food-ai-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query })
        });
        const data = await res.json();
        if (loadingEl) loadingEl.classList.add('hidden');
        if (data.error) throw new Error(data.error);
        window.renderFoodAiResult(data);
      } catch (err) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (containerEl) {
          containerEl.innerHTML = \`
            <div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs space-y-1">
              <p class="font-bold">Could not fetch AI Food details:</p>
              <p>\${err.message}</p>
            </div>
          \`;
        }
      }
    };

    window.renderFoodAiResult = function(item) {
      const container = document.getElementById('aiFoodResultContainer');
      if (!container) return;

      const nf = item.nutritionFacts || {};
      const vitamins = item.vitamins || [];
      const minerals = item.minerals || [];
      const otherBenefits = item.otherBenefits || [];
      const whoShouldEat = item.whoShouldEat || [];
      const whenToAvoid = item.whenToAvoid || [];
      const avoidCombinations = item.avoidCombinations || [];

      container.innerHTML = \`
        <!-- HEADER SUMMARY BADGE -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                \${item.category || 'Food & Nutrition'}
              </span>
              <h3 class="text-xl font-black text-slate-900 mt-1">\${item.nameEn}</h3>
              <p class="text-sm font-bold text-slate-600">\${item.nameHi}</p>
            </div>
            <span class="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shadow-sm shrink-0">
              \${item.verdictTag || 'Clinical AI Verified'}
            </span>
          </div>
        </div>

        <!-- CARD 1: SABSE BADI BENEFIT (Top Highlighted Benefit) -->
        <div class="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 text-slate-950 p-5 rounded-3xl shadow-lg border border-amber-300 space-y-2 relative overflow-hidden">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center text-sm shadow">
              <i class="fa-solid fa-star"></i>
            </div>
            <span class="text-xs font-black uppercase tracking-wider text-slate-900">Sabse Bada Fayda (Top Benefit)</span>
          </div>
          <h4 class="text-base sm:text-lg font-black text-slate-950">\${item.topBenefitTitle}</h4>
          <p class="text-xs sm:text-sm font-semibold text-slate-900/90 leading-relaxed bg-white/40 p-3.5 rounded-2xl border border-white/50">
            \${item.topBenefitDesc}
          </p>
        </div>

        <!-- CARD 2: OTHER MAJOR HEALTH BENEFITS -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
              <i class="fa-solid fa-seedling"></i>
            </div>
            <h4 class="text-sm font-black text-slate-900 uppercase tracking-wider">Other Major Health Benefits (अन्य लाभ)</h4>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            \${otherBenefits.map(b => \`
              <div class="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start space-x-2.5">
                <span class="text-emerald-600 text-sm mt-0.5"><i class="fa-solid fa-circle-check"></i></span>
                <span class="text-xs font-bold text-slate-800 leading-snug">\${b}</span>
              </div>
            \`).join('')}
          </div>
        </div>

        <!-- CARD 3: COMPLETE NUTRITION FACTS, VITAMINS & MINERALS (per 100g) -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">
              <i class="fa-solid fa-chart-pie"></i>
            </div>
            <h4 class="text-sm font-black text-slate-900 uppercase tracking-wider">Complete Nutrition Facts & Minerals (Per 100g)</h4>
          </div>

          <!-- Macro Grid -->
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <div class="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200/60">
              <p class="text-[10px] font-bold text-amber-800 uppercase">Calories</p>
              <p class="text-sm font-black text-slate-900">\${nf.calories || 'N/A'}</p>
            </div>
            <div class="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200/60">
              <p class="text-[10px] font-bold text-emerald-800 uppercase">Protein</p>
              <p class="text-sm font-black text-emerald-700">\${nf.protein || 'N/A'}</p>
            </div>
            <div class="bg-blue-50/70 p-2.5 rounded-2xl border border-blue-200/60">
              <p class="text-[10px] font-bold text-blue-800 uppercase">Carbs</p>
              <p class="text-sm font-black text-slate-900">\${nf.carbs || 'N/A'}</p>
            </div>
            <div class="bg-orange-50/70 p-2.5 rounded-2xl border border-orange-200/60">
              <p class="text-[10px] font-bold text-orange-800 uppercase">Fats</p>
              <p class="text-sm font-black text-slate-900">\${nf.fats || 'N/A'}</p>
            </div>
            <div class="bg-purple-50/70 p-2.5 rounded-2xl border border-purple-200/60">
              <p class="text-[10px] font-bold text-purple-800 uppercase">Fiber</p>
              <p class="text-sm font-black text-slate-900">\${nf.fiber || 'N/A'}</p>
            </div>
            <div class="bg-teal-50/70 p-2.5 rounded-2xl border border-teal-200/60">
              <p class="text-[10px] font-bold text-teal-800 uppercase">GI Index</p>
              <p class="text-sm font-black text-slate-900">\${nf.glycemicIndex || 'N/A'}</p>
            </div>
          </div>

          <!-- Vitamins & Minerals Badges -->
          <div class="space-y-2 pt-1 border-t border-slate-100">
            <div>
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Key Vitamins & Micronutrients:</p>
              <div class="flex flex-wrap gap-1.5">
                \${vitamins.map(v => \`
                  <span class="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">
                    <i class="fa-solid fa-capsules text-[9px] text-indigo-500 mr-1"></i>\${v}
                  </span>
                \`).join('')}
              </div>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 mt-2">Essential Minerals & Calcium:</p>
              <div class="flex flex-wrap gap-1.5">
                \${minerals.map(m => \`
                  <span class="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                    <i class="fa-solid fa-gem text-[9px] text-teal-500 mr-1"></i>\${m}
                  </span>
                \`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- CARD 4: KISE JYADA KHANA CHAHIYE (Who Should Eat More) -->
        <div class="bg-emerald-50/60 rounded-3xl p-5 border border-emerald-200 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
              <i class="fa-solid fa-user-check"></i>
            </div>
            <h4 class="text-sm font-black text-emerald-950 uppercase tracking-wider">Kise Jyada Khana Chahiye (Who Should Eat)</h4>
          </div>
          <div class="space-y-2">
            \${whoShouldEat.map(w => \`
              <div class="bg-white p-3 rounded-2xl border border-emerald-100 flex items-start space-x-2.5 shadow-xs">
                <span class="text-emerald-600 text-sm mt-0.5"><i class="fa-solid fa-circle-plus"></i></span>
                <span class="text-xs font-bold text-slate-800 leading-snug">\${w}</span>
              </div>
            \`).join('')}
          </div>
        </div>

        <!-- CARD 5: KAB NAHI KHANA CHAHIYE / PARHEZ (When to Avoid) -->
        <div class="bg-rose-50/60 rounded-3xl p-5 border border-rose-200 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h4 class="text-sm font-black text-rose-950 uppercase tracking-wider">Kab Nahi Khana Chahiye (When to Avoid / Parhez)</h4>
          </div>
          <div class="space-y-2">
            \${whenToAvoid.map(a => \`
              <div class="bg-white p-3 rounded-2xl border border-rose-100 flex items-start space-x-2.5 shadow-xs">
                <span class="text-rose-600 text-sm mt-0.5"><i class="fa-solid fa-circle-exclamation"></i></span>
                <span class="text-xs font-bold text-slate-800 leading-snug">\${a}</span>
              </div>
            \`).join('')}
          </div>
        </div>

        <!-- CARD 6: KIS CHIJ KE SAATH AVOID KARNA CHAHIYE (Viruddha Aahar) -->
        <div class="bg-amber-50/60 rounded-3xl p-5 border border-amber-200 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
              <i class="fa-solid fa-ban"></i>
            </div>
            <h4 class="text-sm font-black text-amber-950 uppercase tracking-wider">Kis Chij Ke Saath Avoid Karein (Bad Pairings / Viruddha Aahar)</h4>
          </div>
          <div class="space-y-2">
            \${avoidCombinations.map(c => \`
              <div class="bg-white p-3 rounded-2xl border border-amber-200/80 flex items-start space-x-2.5 shadow-xs">
                <span class="text-amber-600 text-sm mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i></span>
                <span class="text-xs font-bold text-slate-800 leading-snug">\${c}</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;

      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Auto start typewriter on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runFoodTypewriter);
    } else {
      runFoodTypewriter();
    }
  </script>
`;

if (!content.includes('foodTypewriterWords')) {
  content = content.replace('</body>', `${aiFoodScript}\n</body>`);
}

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Successfully patched public/index.html with Universal AI Food UI!');

// Sync to public/app.html and public/customer.html
fs.writeFileSync(path.join(__dirname, '../public/app.html'), content, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/customer.html'), content, 'utf8');
console.log('Successfully synced to public/app.html and public/customer.html!');
