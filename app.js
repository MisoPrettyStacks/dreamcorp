/* DreamCorp — real-infrastructure frontend.
   Hash-routed single-page app, vanilla JS, zero dependencies.
   The site collects founding briefs and renders REAL company data fetched
   from companies.json / activity.json / directives.json, which the AI
   workforce maintains. localStorage holds only the wizard draft. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* ---------- store: wizard draft + landing prefill only ---------- */
  var PREFIX = 'dreamcorp:';
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage full/blocked */ }
    },
    del: function (key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} }
  };

  /* ---------- content data (all original copy) ---------- */
  var WORKFORCE = [
    { role: 'CEO Agent', desc: 'Coordinates the workforce, reviews briefings, and routes your directives to the right agent.' },
    { role: 'Builder', desc: 'Creates the company repo, ships the public website, and deploys it to a live URL.' },
    { role: 'Backend Engineer', desc: 'Sets up the backend app: database, your admin login, the inbox, and the tutorial.' },
    { role: 'Marketer', desc: 'Drafts launch copy and page content for your review.' },
    { role: 'Researcher', desc: 'Runs scheduled web research and writes your daily briefings.' },
    { role: 'Support', desc: 'Tends the company inbox and drafts replies in your company\u2019s voice.' }
  ];

  var SUGGESTIONS = [
    'A marketplace for renting backyard pools by the hour',
    'A weekly AI newsletter that explains one science topic simply',
    'On-demand r\u00e9sum\u00e9 reviews for new graduates'
  ];

  var MODEL_OPTIONS = [
    { id: 'digital product', label: 'Digital product', hint: 'Sell downloads, templates, or tools. Build once, sell forever.' },
    { id: 'subscription', label: 'Subscription', hint: 'Recurring revenue. Customers pay monthly for ongoing value.' },
    { id: 'marketplace', label: 'Marketplace', hint: 'Connect buyers and sellers, take a cut of each transaction.' },
    { id: 'service', label: 'Service', hint: 'Done-for-you work productized into clear packages.' }
  ];

  var SITE_TYPES = [
    { id: 'Landing page', label: 'Landing page', hint: 'A fast public site that presents your offer and captures signups.' },
    { id: 'Landing page + Blog', label: 'Landing page + Blog', hint: 'Adds a blog section for updates, stories, and search traffic.' }
  ];

  var MODULES = [
    { id: 'inbox', label: 'Message inbox', hint: 'A working inbox in your backend for customer messages.' },
    { id: 'tasks', label: 'Task board', hint: 'Track work, priorities, and who is doing what.' },
    { id: 'notes', label: 'Notes & content', hint: 'Store drafts, pages, and ideas in one place.' }
  ];

  var EMAIL_OPTIONS = [
    { id: 'built-in inbox', label: 'Built-in inbox now', hint: 'A real working inbox inside your backend from day one. No setup needed.' },
    { id: 'real address later', label: 'Real you@company address later', hint: 'Needs a domain plus a short guided setup. We prepare everything for you.' }
  ];

  var AUTONOMY_LEVELS = [
    { id: 'autopilot', label: 'Autopilot', hint: 'Agents act on their own: publish updates, run cycles, execute directives hands-free.' },
    { id: 'approval', label: 'Approval mode', hint: 'Agents draft everything into a pending queue \u2014 nothing goes live until you approve in chat.' },
    { id: 'oversight', label: 'Oversight', hint: 'Agents research and propose only \u2014 every action needs your explicit go-ahead.' }
  ];

  var NAME_SUFFIXES = ['ly', 'HQ', 'Labs', 'OS', 'Forge', 'Works', 'Pilot', 'Nest', 'Studio', 'Base', 'Loop', 'Lane'];
  var STOPWORDS = { the: 1, a: 1, an: 1, for: 1, of: 1, and: 1, to: 1, in: 1, on: 1, with: 1, my: 1, your: 1, that: 1, this: 1, is: 1, are: 1, be: 1, it: 1, as: 1, at: 1, by: 1, from: 1, or: 1, new: 1, app: 1, simple: 1 };

  function titleCase(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

  function generateName(idea) {
    var words = String(idea || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOPWORDS[w]; });
    if (!words.length) words = ['dream'];
    var base = titleCase(words[0]);
    if (words[1] && (words[0].length + words[1].length) <= 12) base += titleCase(words[1]);
    var suffix = pick(NAME_SUFFIXES);
    if (suffix === 'ly' && /[aeiou]ly$/.test(base.toLowerCase())) return base;
    if (suffix === 'ly') return base.replace(/e$/, '') + 'ly';
    return base + ' ' + suffix;
  }

  function generateMission(idea) {
    var templates = [
      'Make "{idea}" effortless for everyone.',
      'Bring "{idea}" to the people who need it most.',
      'Turn "{idea}" into a business customers love.'
    ];
    var short = String(idea).length > 70 ? String(idea).slice(0, 67).trim() + '\u2026' : String(idea);
    return pick(templates).replace('{idea}', short.replace(/\.$/, ''));
  }

  /* ---------- router ---------- */
  var app = document.getElementById('app');

  function route() {
    var hash = location.hash || '#/';
    var path = hash.replace(/^#/, '') || '/';
    window.scrollTo(0, 0);
    if (path === '/' || path === '') renderLanding();
    else if (path === '/new') renderNew();
    else if (path === '/dashboard') renderDashboard();
    else renderLanding();
  }

  /* smooth-scroll nav links (data-scroll) */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-scroll]');
    if (!link) return;
    e.preventDefault();
    var target = link.getAttribute('data-scroll');
    function go() {
      var el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if ((location.hash || '#/') !== '#/') {
      location.hash = '#/';
      setTimeout(go, 120);
    } else { go(); }
  });

  /* ---------- landing ---------- */
  function landingHTML() {
    var workforce = WORKFORCE.map(function (a) {
      return '<article class="card"><h3>' + esc(a.role) + '</h3><p>' + esc(a.desc) + '</p></article>';
    }).join('');
    return '' +
    '<section class="hero"><div class="hero-inner">' +
      '<p class="eyebrow">Autonomous AI companies</p>' +
      '<h1>Type one sentence.<br><span class="grad-text">Wake up to a company.</span></h1>' +
      '<p class="subhead">Tell us the company of your dreams. DreamCorp\u2019s AI workforce designs it, builds it, and runs it \u2014 while you get on with your day.</p>' +
      '<form class="idea-form" id="hero-form">' +
        '<label class="visually-hidden" for="hero-idea">Tell us the company of your dreams</label>' +
        '<input id="hero-idea" type="text" placeholder="Tell us the company of your dreams\u2026" autocomplete="off">' +
        '<button class="btn btn-primary" type="submit">Start building</button>' +
      '</form>' +
      '<p class="microcopy">Free to start \u00b7 no credit card \u00b7 real infrastructure</p>' +
    '</div></section>' +
    '<section class="strip deliver-strip" aria-label="What gets built">' +
      '<div class="stat"><strong>Public website</strong><span>repo + live URL, deployed for real</span></div>' +
      '<div class="stat"><strong>Backend app</strong><span>database, inbox, your admin login</span></div>' +
      '<div class="stat"><strong>Agent workforce</strong><span>daily briefings &amp; real directive execution</span></div>' +
    '</section>' +
    '<section id="how" class="section"><h2>How it works</h2><div class="cards-3">' +
      '<article class="card"><div class="step-num">1</div><h3>Say the idea</h3><p>Type one sentence, then answer a short founding interview \u2014 model, customer, price, plus real choices for your site, backend, email, and autonomy level.</p></article>' +
      '<article class="card"><div class="step-num">2</div><h3>We provision it for real</h3><p>Your workforce creates the company repo, ships the website to a live URL, sets up the backend with your admin login, and writes the tutorial.</p></article>' +
      '<article class="card"><div class="step-num">3</div><h3>You steer in chat</h3><p>Directives you give in chat are executed for real and logged. Daily briefings keep you posted on everything the workforce did.</p></article>' +
    '</div></section>' +
    '<section id="workforce" class="section"><h2>Meet your AI workforce</h2><div class="cards-3">' + workforce + '</div></section>' +
    '<section class="section"><h2>Choose your autonomy</h2><p class="lede-center">How hands-free should it be? Pick per company, change any time.</p><div class="cards-3">' +
      '<article class="card"><h3>\u2699 Autopilot</h3><p>Agents act on their own: publish updates, run cycles, execute directives hands-free.</p></article>' +
      '<article class="card"><h3>\u2705 Approval mode</h3><p>Agents draft everything into a pending queue \u2014 nothing goes live until you approve in chat.</p></article>' +
      '<article class="card"><h3>\uD83D\uDC41 Oversight</h3><p>Agents research and propose only \u2014 every action needs your explicit go-ahead.</p></article>' +
    '</div></section>' +
    '<section id="pricing" class="section"><h2>Free to start</h2>' +
      '<div class="pricing card"><p class="price">$0</p>' +
      '<p>Found your company, get the website, the backend, and the agent workforce \u2014 running on free infrastructure.</p>' +
      '<a class="btn btn-primary" href="#/new">Found your company</a></div></section>' +
    '<section id="faq" class="section"><h2>Questions</h2>' +
      '<details class="faq"><summary>What do I actually get?</summary><p>A public website (repo + live URL), a backend app with a database, a working inbox, your own admin login, a step-by-step tutorial, and an agent workforce that runs daily briefings and executes your directives.</p></details>' +
      '<details class="faq"><summary>How do the agents work?</summary><p>On a schedule, your workforce researches, briefs, and maintains your company \u2014 every run is logged in Agent Activity. Directives you give in chat are executed for real. Your autonomy level decides how much happens without asking you first.</p></details>' +
      '<details class="faq"><summary>What about a real email address?</summary><p>You get a working inbox inside your backend from day one. A real you@company address needs a domain plus a short guided setup \u2014 choose it in the interview and we prepare everything.</p></details>' +
      '<details class="faq"><summary>Do I need to know how to code?</summary><p>No. You describe the business in plain language and pick from real options; the workforce handles the rest.</p></details>' +
      '<details class="faq"><summary>What does it cost?</summary><p>Starting is free \u2014 the whole stack runs on free tiers. No credit card required.</p></details>' +
      '<details class="faq"><summary>Where is my data?</summary><p>Your companies live in real repos and backends owned by you. Only your unfinished wizard draft is kept in this browser\u2019s local storage.</p></details>' +
    '</section>';
  }

  function renderLanding() {
    app.innerHTML = landingHTML();
    var prefill = store.get('prefill', '');
    if (prefill) { $('#hero-idea', app).value = prefill; store.del('prefill'); }
    $('#hero-form', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var idea = $('#hero-idea', app).value.trim();
      if (idea) store.set('prefill', idea);
      location.hash = '#/new';
    });
  }

  /* ---------- founding wizard (#/new): a real interview with real options ---------- */
  var wiz = null;
  var WIZ_STEPS = 6;

  function wizardShell(stepNum, inner) {
    var bars = '';
    for (var i = 1; i <= WIZ_STEPS; i++) {
      bars += '<div class="wstep ' + (i < stepNum ? 'done' : i === stepNum ? 'now' : '') + '"><i></i></div>';
    }
    return '<div class="wizard"><div class="wizard-steps" aria-hidden="true">' + bars + '</div>' + inner + '</div>';
  }

  function saveDraft() { store.set('draft', wiz); }

  function renderNew() {
    var prefill = store.get('prefill', '');
    if (prefill) store.del('prefill');
    var draft = store.get('draft', null);
    wiz = {
      idea: prefill || (draft && draft.idea) || '',
      model: (draft && draft.model) || null,
      audience: (draft && draft.audience) || '',
      price: (draft && draft.price) || '',
      site: (draft && draft.site) || 'Landing page',
      modules: (draft && draft.modules) || [],
      email: (draft && draft.email) || 'built-in inbox',
      autonomy: (draft && draft.autonomy) || null,
      name: (draft && draft.name) || '',
      mission: (draft && draft.mission) || ''
    };
    renderWizStep1();
  }

  /* ---- step 1: idea ---- */
  function renderWizStep1() {
    var chips = SUGGESTIONS.map(function (s) {
      return '<button type="button" class="chip" data-idea="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');
    app.innerHTML = wizardShell(1,
      '<h1>What business do you wish existed?</h1>' +
      '<p class="lede">One sentence is enough. Your AI workforce takes it from there.</p>' +
      '<div class="field"><label for="wiz-idea">Your idea</label>' +
      '<textarea id="wiz-idea" placeholder="e.g. A subscription box that sends a new bedtime story to kids every week">' + esc(wiz.idea) + '</textarea></div>' +
      '<div class="chips" role="group" aria-label="Example ideas">' + chips + '</div>' +
      '<div class="wizard-actions"><span></span>' +
      '<button class="btn btn-primary" id="wiz-next-1">Continue</button></div>'
    );
    $$('.chip', app).forEach(function (c) {
      c.addEventListener('click', function () { $('#wiz-idea', app).value = c.getAttribute('data-idea'); $('#wiz-idea', app).focus(); });
    });
    $('#wiz-next-1', app).addEventListener('click', function () {
      var v = $('#wiz-idea', app).value.trim();
      if (!v) { $('#wiz-idea', app).focus(); $('#wiz-idea', app).setAttribute('aria-invalid', 'true'); return; }
      wiz.idea = v; saveDraft();
      renderWizStep2();
    });
  }

  /* ---- step 2: founding interview (chat) ---- */
  function addMsg(box, who, html) {
    var d = document.createElement('div');
    d.className = 'msg ' + (who === 'user' ? 'user' : 'agent');
    d.innerHTML = '<span class="who">' + (who === 'user' ? 'You' : 'Founder Agent') + '</span><span>' + html + '</span>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function agentSay(box, html, delay) {
    var typing = document.createElement('div');
    typing.className = 'msg agent';
    typing.innerHTML = '<span class="typing" aria-label="Founder Agent is typing"><i></i><i></i><i></i></span>';
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    return sleep(delay == null ? 700 : delay).then(function () {
      typing.remove();
      return addMsg(box, 'agent', html);
    });
  }

  function renderWizStep2() {
    app.innerHTML = wizardShell(2,
      '<h1>Founding interview</h1>' +
      '<p class="lede">Sixty seconds with your Founder Agent. Three quick questions.</p>' +
      '<p class="q-progress" id="q-progress">Question 1 of 3</p>' +
      '<div class="chat-box" id="wiz-chat" aria-live="polite"></div>' +
      '<div id="wiz-controls"></div>'
    );
    var box = $('#wiz-chat', app), controls = $('#wiz-controls', app);

    function setProgress(n) { $('#q-progress', app).textContent = 'Question ' + n + ' of 3'; }

    function askModel() {
      setProgress(1);
      agentSay(box, 'Great idea. First: how should <strong>' + esc(wiz.idea.length > 60 ? wiz.idea.slice(0, 57) + '\u2026' : wiz.idea) + '</strong> make money? Pick the model that fits best.').then(function () {
        controls.innerHTML = '<div class="opt-grid two" role="radiogroup" aria-label="Business model">' + MODEL_OPTIONS.map(function (m) {
          return '<button type="button" class="opt-card' + (wiz.model === m.id ? ' selected' : '') + '" data-model="' + esc(m.id) + '"><strong>' + esc(m.label) + '</strong><span>' + esc(m.hint) + '</span></button>';
        }).join('') + '</div>';
        $$('.opt-card', controls).forEach(function (b) {
          b.addEventListener('click', function () {
            wiz.model = b.getAttribute('data-model'); saveDraft();
            addMsg(box, 'user', esc(wiz.model));
            controls.innerHTML = '';
            askAudience();
          });
        });
        var first = $('.opt-card', controls); if (first) first.focus();
      });
    }

    function textQuestion(key, next) {
      controls.innerHTML = '<form class="chat-input" id="wiz-form">' +
        '<label class="visually-hidden" for="wiz-answer">Your answer</label>' +
        '<input class="text-input" id="wiz-answer" type="text" autocomplete="off" placeholder="Type your answer\u2026">' +
        '<button class="btn btn-primary" type="submit">Send</button></form>';
      var input = $('#wiz-answer', controls);
      input.focus();
      $('#wiz-form', controls).addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        wiz[key] = v; saveDraft();
        addMsg(box, 'user', esc(v));
        controls.innerHTML = '';
        next();
      });
    }

    function askAudience() {
      setProgress(2);
      agentSay(box, 'Got it \u2014 <strong>' + esc(wiz.model) + '</strong>. Who is this for? Describe your ideal customer in a few words.').then(function () {
        textQuestion('audience', askPrice);
      });
    }

    function askPrice() {
      setProgress(3);
      agentSay(box, 'Perfect. Last one: what should it cost? Give me a starting price, like <em>$19/month</em> or <em>$49 one-time</em>.').then(function () {
        textQuestion('price', finishInterview);
      });
    }

    function finishInterview() {
      agentSay(box, 'Excellent \u2014 moving on to what we build.', 900).then(function () {
        wiz.name = wiz.name || generateName(wiz.idea);
        wiz.mission = wiz.mission || generateMission(wiz.idea);
        saveDraft();
        renderWizStep3();
      });
    }

    agentSay(box, 'Hi, I\u2019m your Founder Agent. Three quick questions, then real choices about what gets built.', 500)
      .then(function () { askModel(); });
  }

  /* ---- step 3: what should we build? ---- */
  function renderWizStep3() {
    var siteCards = SITE_TYPES.map(function (s) {
      return '<button type="button" class="opt-card' + (wiz.site === s.id ? ' selected' : '') + '" data-site="' + esc(s.id) + '"><strong>' + esc(s.label) + '</strong><span>' + esc(s.hint) + '</span></button>';
    }).join('');
    var modChecks = MODULES.map(function (m) {
      var on = wiz.modules.indexOf(m.id) > -1;
      return '<label class="check-item"><input type="checkbox" value="' + esc(m.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="box" aria-hidden="true"></span>' +
        '<span><strong>' + esc(m.label) + '</strong><small>' + esc(m.hint) + '</small></span></label>';
    }).join('');
    app.innerHTML = wizardShell(3,
      '<h1>What should we build?</h1>' +
      '<p class="lede">Pick the site type and the backend modules your company needs.</p>' +
      '<h3 class="opt-heading">Site type</h3>' +
      '<div class="opt-grid" role="radiogroup" aria-label="Site type">' + siteCards + '</div>' +
      '<h3 class="opt-heading">Backend modules <span class="opt-sub">(optional)</span></h3>' +
      '<div class="check-list">' + modChecks + '</div>' +
      '<div class="wizard-actions">' +
        '<button class="btn btn-ghost" id="wiz-back-3">Back</button>' +
        '<button class="btn btn-primary" id="wiz-next-3">Continue</button></div>'
    );
    $$('.opt-card', app).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.opt-card', app).forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        wiz.site = b.getAttribute('data-site');
      });
    });
    $('#wiz-back-3', app).addEventListener('click', renderWizStep2);
    $('#wiz-next-3', app).addEventListener('click', function () {
      wiz.modules = $$('.check-item input:checked', app).map(function (c) { return c.value; });
      saveDraft();
      renderWizStep4();
    });
  }

  /* ---- step 4: business email ---- */
  function renderWizStep4() {
    var cards = EMAIL_OPTIONS.map(function (o) {
      return '<button type="button" class="opt-card' + (wiz.email === o.id ? ' selected' : '') + '" data-email="' + esc(o.id) + '"><strong>' + esc(o.label) + '</strong><span>' + esc(o.hint) + '</span></button>';
    }).join('');
    app.innerHTML = wizardShell(4,
      '<h1>Business email</h1>' +
      '<p class="lede">Every company needs a way to hear from customers. Choose honestly \u2014 no fake addresses here.</p>' +
      '<div class="opt-grid" role="radiogroup" aria-label="Business email">' + cards + '</div>' +
      '<div class="wizard-actions">' +
        '<button class="btn btn-ghost" id="wiz-back-4">Back</button>' +
        '<button class="btn btn-primary" id="wiz-next-4">Continue</button></div>'
    );
    $$('.opt-card', app).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.opt-card', app).forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        wiz.email = b.getAttribute('data-email'); saveDraft();
      });
    });
    $('#wiz-back-4', app).addEventListener('click', renderWizStep3);
    $('#wiz-next-4', app).addEventListener('click', function () { saveDraft(); renderWizStep5(); });
  }

  /* ---- step 5: autonomy level ---- */
  function renderWizStep5() {
    var cards = AUTONOMY_LEVELS.map(function (a) {
      return '<button type="button" class="opt-card' + (wiz.autonomy === a.id ? ' selected' : '') + '" data-autonomy="' + esc(a.id) + '"><strong>' + esc(a.label) + '</strong><span>' + esc(a.hint) + '</span></button>';
    }).join('');
    app.innerHTML = wizardShell(5,
      '<h1>How hands-free?</h1>' +
      '<p class="lede">Tell your workforce how much it may do without asking. You can change this any time in chat.</p>' +
      '<div class="opt-grid" role="radiogroup" aria-label="Autonomy level">' + cards + '</div>' +
      '<p class="microcopy" id="autonomy-err" role="alert" style="color:var(--amber);min-height:1.4em"></p>' +
      '<div class="wizard-actions">' +
        '<button class="btn btn-ghost" id="wiz-back-5">Back</button>' +
        '<button class="btn btn-primary" id="wiz-next-5">Review brief</button></div>'
    );
    $$('.opt-card', app).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.opt-card', app).forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        wiz.autonomy = b.getAttribute('data-autonomy'); saveDraft();
        $('#autonomy-err', app).textContent = '';
      });
    });
    $('#wiz-back-5', app).addEventListener('click', renderWizStep4);
    $('#wiz-next-5', app).addEventListener('click', function () {
      if (!wiz.autonomy) {
        $('#autonomy-err', app).textContent = 'Pick an autonomy level to continue \u2014 this one matters.';
        var first = $('.opt-card', app); if (first) first.focus();
        return;
      }
      saveDraft();
      renderWizStep6();
    });
  }

  /* ---- step 6: review brief ---- */
  function moduleLabels() {
    return wiz.modules.map(function (id) {
      var m = MODULES.filter(function (x) { return x.id === id; })[0];
      return m ? m.label : id;
    });
  }

  function renderWizStep6() {
    var mods = moduleLabels();
    app.innerHTML = wizardShell(6,
      '<h1>Review your brief</h1>' +
      '<p class="lede">Check everything. Like the name? Keep it \u2014 or roll the dice again.</p>' +
      '<div class="brief">' +
        '<p class="co-name grad-text" id="brief-name">' + esc(wiz.name) + '</p>' +
        '<p class="co-mission">' + esc(wiz.mission) + '</p>' +
        '<dl>' +
          '<dt>Idea</dt><dd>' + esc(wiz.idea) + '</dd>' +
          '<dt>Model</dt><dd>' + esc(wiz.model) + '</dd>' +
          '<dt>Customer</dt><dd>' + esc(wiz.audience) + '</dd>' +
          '<dt>Price</dt><dd>' + esc(wiz.price) + '</dd>' +
          '<dt>Site</dt><dd>' + esc(wiz.site) + '</dd>' +
          '<dt>Backend</dt><dd>' + esc(mods.length ? mods.join(', ') : 'None selected') + '</dd>' +
          '<dt>Email</dt><dd>' + esc(wiz.email) + '</dd>' +
          '<dt>Autonomy</dt><dd>' + esc(wiz.autonomy) + '</dd>' +
        '</dl>' +
      '</div>' +
      '<div class="wizard-actions">' +
        '<button class="btn btn-ghost" id="wiz-back-6">Back</button>' +
        '<span style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn btn-ghost" id="wiz-rename">Regenerate name</button>' +
          '<button class="btn btn-primary" id="wiz-provision">Provision my company</button>' +
        '</span>' +
      '</div>'
    );
    $('#wiz-rename', app).addEventListener('click', function () {
      wiz.name = generateName(wiz.idea + ' ' + Math.random().toString(36).slice(2, 6));
      wiz.mission = generateMission(wiz.idea);
      saveDraft();
      $('#brief-name', app).textContent = wiz.name;
    });
    $('#wiz-back-6', app).addEventListener('click', renderWizStep5);
    $('#wiz-provision', app).addEventListener('click', renderWizFinale);
  }

  /* ---- finale: real provisioning handoff ---- */
  function briefMessage() {
    var mods = moduleLabels();
    return 'FOUND NEW COMPANY\n' +
      'Name: ' + wiz.name + '\n' +
      'Idea: ' + wiz.idea + '\n' +
      'Customer: ' + wiz.audience + '\n' +
      'Model: ' + wiz.model + '\n' +
      'Price: ' + wiz.price + '\n' +
      'Site: ' + wiz.site + '\n' +
      'Backend modules: ' + (mods.length ? mods.join(', ') : 'none') + '\n' +
      'Email: ' + wiz.email + '\n' +
      'Autonomy: ' + wiz.autonomy;
  }

  function renderWizFinale() {
    store.del('draft');
    var mods = moduleLabels();
    app.innerHTML =
      '<div class="wizard"><div class="provision">' +
      '<p class="eyebrow">Provisioning</p>' +
      '<h1>' + esc(wiz.name) + ' is ready to be built.</h1>' +
      '<p class="lede">Your AI workforce now provisions everything for real:</p>' +
      '<div class="cards-3">' +
        '<article class="card"><h3>Public website</h3><p>Dedicated repo, live site on its own URL, deployed and online.</p></article>' +
        '<article class="card"><h3>Backend app</h3><p>Database' + (mods.length ? ', ' + esc(mods.join(', ').toLowerCase()) : '') + ', and your own admin login.</p></article>' +
        '<article class="card"><h3>Tutorial</h3><p>A step-by-step guide to navigating and using your backend.</p></article>' +
      '</div>' +
      '<div class="brief" style="margin-top:22px"><dl>' +
        '<dt>Idea</dt><dd>' + esc(wiz.idea) + '</dd>' +
        '<dt>Model</dt><dd>' + esc(wiz.model) + '</dd>' +
        '<dt>Customer</dt><dd>' + esc(wiz.audience) + '</dd>' +
        '<dt>Price</dt><dd>' + esc(wiz.price) + '</dd>' +
        '<dt>Site</dt><dd>' + esc(wiz.site) + '</dd>' +
        '<dt>Backend</dt><dd>' + esc(mods.length ? mods.join(', ') : 'None selected') + '</dd>' +
        '<dt>Email</dt><dd>' + esc(wiz.email) + '</dd>' +
        '<dt>Autonomy</dt><dd>' + esc(wiz.autonomy) + '</dd>' +
      '</dl></div>' +
      '<div class="provision-cta">' +
        '<button class="btn btn-primary" id="copy-brief">Copy founding brief</button>' +
        '<a class="btn btn-ghost" href="#/dashboard">View my companies</a>' +
      '</div>' +
      '<p class="microcopy provision-note">Paste this to your AI workforce in chat \u2014 your admin username/password and tutorial are handed over there when provisioning completes.</p>' +
      '<pre class="brief-preview" id="brief-preview">' + esc(briefMessage()) + '</pre>' +
      '</div></div>';
    $('#copy-brief', app).addEventListener('click', function () {
      var done = function () {
        var b = $('#copy-brief', app);
        b.textContent = 'Copied!';
        setTimeout(function () { b.textContent = 'Copy founding brief'; }, 1800);
      };
      var text = briefMessage();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- dashboard (#/dashboard): live workforce data ---------- */
  var dashTab = 'companies';

  function fetchJSON(path) {
    return fetch(path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).catch(function () { return null; });
  }

  function fmtDate(ts) {
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts || '');
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return String(ts || ''); }
  }

  function renderDashboard() {
    app.innerHTML =
      '<div class="dash">' +
        '<div class="dash-head"><h1>Mission control</h1>' +
        '<span class="pill pill-live"><span class="dot"></span>Live data</span></div>' +
        '<p class="dash-sub">Your companies, agent activity, and directives \u2014 straight from your workforce.</p>' +
        '<div class="tabs" role="tablist" aria-label="Dashboard sections">' +
          '<button class="tab" role="tab" data-tab="companies" aria-selected="true">My Companies</button>' +
          '<button class="tab" role="tab" data-tab="activity" aria-selected="false">Agent Activity</button>' +
          '<button class="tab" role="tab" data-tab="directives" aria-selected="false">Directives</button>' +
        '</div>' +
        '<div id="dash-body" role="tabpanel"><p class="microcopy">Loading\u2026</p></div>' +
      '</div>';
    $$('.tab', app).forEach(function (t) {
      t.addEventListener('click', function () {
        dashTab = t.getAttribute('data-tab');
        $$('.tab', app).forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        renderDashTab();
      });
    });
    renderDashTab();
  }

  function renderDashTab() {
    var body = $('#dash-body', app);
    if (!body) return;
    body.innerHTML = '<p class="microcopy">Loading\u2026</p>';
    if (dashTab === 'companies') loadCompanies(body);
    else if (dashTab === 'activity') loadActivity(body);
    else loadDirectives(body);
  }

  function emptyDash(title, text, cta) {
    return '<div class="empty-dash"><h2>' + esc(title) + '</h2>' +
      '<p class="microcopy">' + esc(text) + '</p>' +
      (cta ? '<div class="card"><a class="btn btn-primary" href="#/new">' + esc(cta) + '</a></div>' : '') +
      '</div>';
  }

  /* ----- my companies ----- */
  function loadCompanies(body) {
    var tab = dashTab;
    fetchJSON('companies.json').then(function (data) {
      if (!body.isConnected || dashTab !== tab) return;
      if (!data || !data.length) {
        body.innerHTML = emptyDash('No companies yet', 'Found your first company and it will appear here with its live site.', 'Start the founding wizard');
        return;
      }
      body.innerHTML = '<div class="co-grid">' + data.map(function (c) {
        var aut = String(c.autonomy || '').toLowerCase();
        var badge = aut === 'autopilot' ? '<span class="autonomy auto">Autopilot</span>'
          : aut === 'approval' ? '<span class="autonomy appr">Approval mode</span>'
          : aut === 'oversight' ? '<span class="autonomy over">Oversight</span>' : '';
        return '<article class="card co-card">' +
          '<div class="co-top"><h3>' + esc(c.name) + '</h3>' + badge + '</div>' +
          '<p class="co-idea">' + esc(c.idea) + '</p>' +
          '<p class="microcopy">Founded ' + esc(fmtDate(c.created_at || c.createdAt)) + '</p>' +
          (c.pages_url ? '<a class="btn btn-primary btn-sm" href="' + esc(c.pages_url) + '" target="_blank" rel="noopener">Open live site</a>' : '') +
        '</article>';
      }).join('') + '</div>';
    });
  }

  /* ----- agent activity ----- */
  function loadActivity(body) {
    var tab = dashTab;
    fetchJSON('activity.json').then(function (data) {
      if (!body.isConnected || dashTab !== tab) return;
      if (!data || !data.length) {
        body.innerHTML = emptyDash('No agent activity yet', 'Activity appears here after your first company is provisioned and the workforce starts its cycles.', null);
        return;
      }
      var items = data.slice().sort(function (a, b) {
        return new Date(b.ts || 0) - new Date(a.ts || 0);
      });
      body.innerHTML = '<div class="feed"><ul class="feed-list">' + items.map(function (e) {
        return '<li><span class="t">' + esc(fmtDate(e.ts)) + '</span>' +
          '<strong>' + esc(e.company || 'DreamCorp') + '</strong> \u2014 ' + esc(e.action || '') +
          (e.detail ? '<br>' + esc(e.detail) : '') + '</li>';
      }).join('') + '</ul></div>';
    });
  }

  /* ----- directives ----- */
  function loadDirectives(body) {
    var tab = dashTab;
    fetchJSON('directives.json').then(function (data) {
      if (!body.isConnected || dashTab !== tab) return;
      var explainer = '<div class="card dir-explainer"><h3>How directives work</h3>' +
        '<p>Give directives to your workforce in chat \u2014 for example, \u201chave MealPilot draft a launch post\u201d \u2014 ' +
        'they execute for real and log the result here. Your autonomy level decides whether anything needs your approval first.</p></div>';
      if (!data || !data.length) {
        body.innerHTML = explainer + emptyDash('No directives yet', 'Your directives and their results will be listed here.', null);
        return;
      }
      var items = data.slice().sort(function (a, b) {
        return new Date(b.ts || 0) - new Date(a.ts || 0);
      });
      body.innerHTML = explainer + '<ul class="task-list">' + items.map(function (d) {
        var st = String(d.status || 'open').toLowerCase();
        var pill = st === 'done' ? 'done' : st === 'in-progress' || st === 'in progress' ? 'in-progress' : 'queued';
        return '<li><span class="t-title">' + esc(d.text || d.title || '') + '</span>' +
          '<span class="t-agent">' + esc(d.company || '') + '</span>' +
          '<span class="task-pill ' + pill + '">' + esc(st) + '</span></li>' +
          (d.result ? '<li class="dir-result"><span class="t-title">' + esc(d.result) + '</span></li>' : '');
      }).join('') + '</ul>';
    });
  }

  /* ---------- init ---------- */
  window.addEventListener('hashchange', route);
  route();
})();
