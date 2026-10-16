/* DreamCorp — vanilla JS single-page app.
   Hash routing, localStorage persistence ("dreamcorp:" keys), zero dependencies.
   All "agent" activity is simulated locally; nothing leaves the browser. */
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
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var fmtInt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var fmtMoney = function (n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var nowTime = function () {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  };

  /* timers registry — cleared on every route change */
  var timers = [];
  function every(ms, fn) { var id = setInterval(fn, ms); timers.push(id); return id; }
  function after(ms, fn) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(function (id) { clearInterval(id); clearTimeout(id); }); timers = []; }

  /* ---------- store ---------- */
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
    { role: 'CEO Agent', desc: 'Sets priorities, reads the numbers, and keeps the whole team pointed at revenue.' },
    { role: 'Builder', desc: 'Ships your website, checkout, and product pages — then keeps improving them.' },
    { role: 'Designer', desc: 'Crafts your brand and visuals so the company looks established on day one.' },
    { role: 'Marketer', desc: 'Writes launch content, tests page variants, and grows your audience.' },
    { role: 'Sales Rep', desc: 'Finds prospects, drafts outreach, and follows up until they reply or opt out.' },
    { role: 'Support', desc: 'Answers customer questions instantly, day or night, in your company\u2019s voice.' }
  ];

  var AGENT_ROSTER = [
    { role: 'CEO Agent', task: 'Reviewing today\u2019s revenue and reprioritizing the team' },
    { role: 'Builder', task: 'Optimizing checkout load time and fixing a signup bug' },
    { role: 'Designer', task: 'Polishing the pricing page and new brand illustrations' },
    { role: 'Marketer', task: 'Publishing landing page variant B and scheduling posts' },
    { role: 'Sales Rep', task: 'Following up with 14 warm prospects from yesterday' },
    { role: 'Support', task: 'Answering 3 open customer conversations' }
  ];

  var FEED_EVENTS = [
    ['Marketer', 'published landing page variant B'],
    ['Sales Rep', 'sent 12 personalized outreach emails'],
    ['Builder', 'shipped a faster checkout (1.8s \u2192 0.9s)'],
    ['Support', 'resolved a billing question in 40 seconds'],
    ['Designer', 'uploaded 6 new hero illustrations'],
    ['CEO Agent', 'approved this week\u2019s marketing budget'],
    ['Marketer', 'scheduled 5 social posts for tomorrow'],
    ['Sales Rep', 'booked a demo call with a warm lead'],
    ['Builder', 'added customer testimonials to the homepage'],
    ['Support', 'updated the help center with 4 new answers'],
    ['Designer', 'refreshed the logo lockup for dark mode'],
    ['CEO Agent', 'flagged a pricing experiment to review Friday']
  ];

  var TASK_POOL = [
    'Draft launch announcement email',
    'A/B test hero headline',
    'Research 20 competitor pricing pages',
    'Write 3 blog posts for SEO',
    'Set up abandoned-cart reminders',
    'Design onboarding checklist',
    'Translate landing page to Spanish',
    'Build referral rewards page',
    'Audit site accessibility',
    'Create 7-day email welcome sequence'
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
    clearTimers();
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
      '<p class="microcopy">Free to start \u00b7 no credit card \u00b7 demo runs entirely in your browser</p>' +
    '</div></section>' +
    '<section class="strip stats-strip" aria-label="Demo statistics">' +
      '<div class="stat"><strong data-count="12408">0</strong><span>businesses started</span></div>' +
      '<div class="stat"><strong data-count="96120">0</strong><span>agent cycles today</span></div>' +
      '<div class="stat"><strong data-count="1400000" data-money="1">$0</strong><span>revenue earned by demo companies</span></div>' +
      '<p class="demo-note">Illustrative demo figures \u2014 animated for effect</p>' +
    '</section>' +
    '<section id="how" class="section"><h2>How it works</h2><div class="cards-3">' +
      '<article class="card"><div class="step-num">1</div><h3>Say the idea</h3><p>Type one sentence. A founder agent interviews you for sixty seconds to sharpen the model, the customer, and the price.</p></article>' +
      '<article class="card"><div class="step-num">2</div><h3>Agents build it</h3><p>Architect, designer, engineer, and marketer agents spin up your site, your offer, and your launch pages \u2014 in minutes.</p></article>' +
      '<article class="card"><div class="step-num">3</div><h3>You steer by chat</h3><p>Your CEO agent prospects customers, sends emails, and reports back. You approve direction; the workforce does the work.</p></article>' +
    '</div></section>' +
    '<section id="workforce" class="section"><h2>Meet your AI workforce</h2><div class="cards-3">' + workforce + '</div></section>' +
    '<section class="section"><h2>Wall of dreams</h2><p class="demo-note">Illustrative examples, not real customers.</p><div class="cards-3">' +
      '<article class="card quote"><p>\u201cI typed a sentence about a meal-planning app before bed. By morning there was a landing page and twelve signups.\u201d</p><cite>\u2014 Priya, demo founder</cite></article>' +
      '<article class="card quote"><p>\u201cThe sales agent booked my first three calls while I was at my day job. I just showed up.\u201d</p><cite>\u2014 Marcus, demo founder</cite></article>' +
      '<article class="card quote"><p>\u201cIt feels like hiring a six-person team that never sleeps and never invoices me.\u201d</p><cite>\u2014 Lena, demo founder</cite></article>' +
    '</div></section>' +
    '<section id="pricing" class="section"><h2>Free to start</h2>' +
      '<div class="pricing card"><p class="price">$0</p>' +
      '<p>Start your company, meet your workforce, and watch your demo dashboard come alive \u2014 free, right in your browser.</p>' +
      '<a class="btn btn-primary" href="#/new">Found your company</a></div></section>' +
    '<section id="faq" class="section"><h2>Questions</h2>' +
      '<details class="faq"><summary>Is this real or a demo?</summary><p>This page is an interactive demo. The agents, revenue, and activity are simulated locally in your browser \u2014 nothing leaves your device.</p></details>' +
      '<details class="faq"><summary>Do I need to know how to code?</summary><p>No. You describe the business in plain language; the agents handle design, building, and operations.</p></details>' +
      '<details class="faq"><summary>What does it cost?</summary><p>Starting is free. This demo costs nothing and needs no account.</p></details>' +
      '<details class="faq"><summary>Where does my data go?</summary><p>Nowhere. Your company, stats, and chat history are stored only in your browser\u2019s local storage.</p></details>' +
      '<details class="faq"><summary>Can I reset the demo?</summary><p>Yes \u2014 open your company dashboard and use the \u201cReset demo\u201d button to start over.</p></details>' +
    '</section>';
  }

  function animateCounters(root) {
    var els = $$('[data-count]', root);
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.textContent = fmtInt(el.getAttribute('data-count')); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, target = parseFloat(el.getAttribute('data-count')), money = el.getAttribute('data-money');
        var start = null, dur = 1600;
        function frame(t) {
          if (!start) start = t;
          var p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
          var v = target * e;
          el.textContent = money ? '$' + fmtInt(v / 100) + 'k' : fmtInt(v);
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  function renderLanding() {
    app.innerHTML = landingHTML();
    animateCounters(app);
    var prefill = store.get('prefill', '');
    if (prefill) { $('#hero-idea', app).value = prefill; store.del('prefill'); }
    $('#hero-form', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var idea = $('#hero-idea', app).value.trim();
      if (idea) store.set('prefill', idea);
      location.hash = '#/new';
    });
  }

  /* ---------- founding wizard (#/new) ---------- */
  var wiz = null;

  function wizardShell(stepNum, inner) {
    var bars = '';
    for (var i = 1; i <= 4; i++) {
      bars += '<div class="wstep ' + (i < stepNum ? 'done' : i === stepNum ? 'now' : '') + '"><i></i></div>';
    }
    return '<div class="wizard"><div class="wizard-steps" aria-hidden="true">' + bars + '</div>' + inner + '</div>';
  }

  function renderNew() {
    var prefill = store.get('prefill', '');
    if (prefill) store.del('prefill');
    wiz = { idea: prefill, model: null, audience: '', price: '', name: '', mission: '' };
    renderWizStep1();
  }

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
      wiz.idea = v;
      renderWizStep2();
    });
  }

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
      '<p class="lede">Sixty seconds with your Founder Agent. Answer three quick questions.</p>' +
      '<p class="q-progress" id="q-progress">Question 1 of 3</p>' +
      '<div class="chat-box" id="wiz-chat" aria-live="polite"></div>' +
      '<div id="wiz-controls"></div>'
    );
    var box = $('#wiz-chat', app), controls = $('#wiz-controls', app);
    var qi = 0;

    function setProgress(n) { $('#q-progress', app).textContent = 'Question ' + n + ' of 3'; }

    function askModel() {
      setProgress(1);
      agentSay(box, 'Great idea. First: how should <strong>' + esc(wiz.idea.length > 60 ? wiz.idea.slice(0, 57) + '\u2026' : wiz.idea) + '</strong> make money? Pick the model that fits best.').then(function () {
        controls.innerHTML = '<div class="model-options">' + MODEL_OPTIONS.map(function (m) {
          return '<button type="button" class="model-opt" data-model="' + esc(m.id) + '">' + esc(m.label) + '<small>' + esc(m.hint) + '</small></button>';
        }).join('') + '</div>';
        $$('.model-opt', controls).forEach(function (b) {
          b.addEventListener('click', function () {
            wiz.model = b.getAttribute('data-model');
            addMsg(box, 'user', esc(b.textContent.split('\n')[0] || wiz.model));
            controls.innerHTML = '';
            qi = 1; askAudience();
          });
        });
        var first = $('.model-opt', controls); if (first) first.focus();
      });
    }

    function textQuestion(promptHtml, key, next) {
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
        wiz[key] = v;
        addMsg(box, 'user', esc(v));
        controls.innerHTML = '';
        next();
      });
    }

    function askAudience() {
      setProgress(2);
      agentSay(box, 'Got it \u2014 <strong>' + esc(wiz.model) + '</strong>. Who is this for? Describe your ideal customer in a few words.').then(function () {
        textQuestion('', 'audience', askPrice);
      });
    }

    function askPrice() {
      setProgress(3);
      agentSay(box, 'Perfect. Last one: what should it cost? Give me a starting price, like <em>$19/month</em> or <em>$49 one-time</em>.').then(function () {
        textQuestion('', 'price', finishInterview);
      });
    }

    function finishInterview() {
      agentSay(box, 'Excellent \u2014 I have everything I need. Drafting your company brief now\u2026', 900).then(function () {
        return sleep(700);
      }).then(function () {
        wiz.name = generateName(wiz.idea);
        wiz.mission = generateMission(wiz.idea);
        renderWizStep3();
      });
    }

    agentSay(box, 'Hi, I\u2019m your Founder Agent. I\u2019ll turn your idea into a real company brief \u2014 just answer three quick questions.', 500)
      .then(function () { askModel(); });
  }

  function renderWizStep3() {
    app.innerHTML = wizardShell(3,
      '<h1>Your company brief</h1>' +
      '<p class="lede">Generated from your answers. Like the name? Keep it \u2014 or roll the dice again.</p>' +
      '<div class="brief">' +
        '<p class="co-name grad-text" id="brief-name">' + esc(wiz.name) + '</p>' +
        '<p class="co-mission">' + esc(wiz.mission) + '</p>' +
        '<dl>' +
          '<dt>Original idea</dt><dd>' + esc(wiz.idea) + '</dd>' +
          '<dt>Business model</dt><dd>' + esc(wiz.model) + '</dd>' +
          '<dt>Target customer</dt><dd>' + esc(wiz.audience) + '</dd>' +
          '<dt>Starting price</dt><dd>' + esc(wiz.price) + '</dd>' +
        '</dl>' +
      '</div>' +
      '<div class="wizard-actions">' +
        '<button class="btn btn-ghost" id="wiz-back-3">Back</button>' +
        '<span style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn btn-ghost" id="wiz-rename">Regenerate name</button>' +
          '<button class="btn btn-primary" id="wiz-found">Found my company</button>' +
        '</span>' +
      '</div>'
    );
    $('#wiz-rename', app).addEventListener('click', function () {
      wiz.name = generateName(wiz.idea + ' ' + Math.random().toString(36).slice(2, 6));
      wiz.mission = generateMission(wiz.idea);
      $('#brief-name', app).textContent = wiz.name;
    });
    $('#wiz-back-3', app).addEventListener('click', renderWizStep1);
    $('#wiz-found', app).addEventListener('click', function () {
      store.set('company', {
        name: wiz.name, idea: wiz.idea, mission: wiz.mission,
        model: wiz.model, audience: wiz.audience, price: wiz.price,
        createdAt: Date.now()
      });
      if (!store.get('stats', null)) {
        store.set('stats', { revenue: rand(20, 80), visitors: Math.round(rand(40, 160)), orders: Math.round(rand(2, 9)), cycles: Math.round(rand(30, 120)) });
      }
      renderWizStep4();
    });
  }

  /* ---------- build cinematic (wizard step 4) ---------- */
  var BUILD_AGENTS = [
    { name: 'Architect', tasks: ['Mapping the business model', 'Designing the offer structure', 'Planning the launch sequence'],
      logs: ['Blueprint drafted: {model} model mapped', 'Offer structure finalized', 'Launch sequence planned: 6 steps'] },
    { name: 'Designer', tasks: ['Creating the brand identity', 'Designing the landing page', 'Polishing visual details'],
      logs: ['Brand palette locked: indigo \u2192 violet \u2192 cyan', 'Landing page mockup rendered', 'Favicon and logo variants exported'] },
    { name: 'Engineer', tasks: ['Building the website', 'Wiring up checkout', 'Testing signup flow'],
      logs: ['Site scaffold generated (4 pages)', 'Checkout connected in test mode', 'Signup flow passing: 12/12 checks'] },
    { name: 'Marketer', tasks: ['Writing launch copy', 'Preparing email sequence', 'Scheduling first posts'],
      logs: ['Headline A/B variants drafted', '5-email welcome sequence written', 'Launch posts scheduled for 9:00 AM'] }
  ];

  function renderWizStep4() {
    var co = store.get('company', {});
    var cards = BUILD_AGENTS.map(function (a, i) {
      var tasks = a.tasks.map(function (t, j) {
        return '<li data-agent="' + i + '" data-task="' + j + '">' + esc(t) + '</li>';
      }).join('');
      return '<div class="build-agent"><h3><span class="agent-dot"></span>' + esc(a.name) + '</h3>' +
        '<ul>' + tasks + '</ul><div class="progress"><i id="prog-' + i + '"></i></div></div>';
    }).join('');
    app.innerHTML = wizardShell(4,
      '<h1>Building ' + esc(co.name || 'your company') + '</h1>' +
      '<p class="lede">Four agents, one mission. Watch them work.</p>' +
      '<div class="build-grid">' + cards + '</div>' +
      '<div class="log-box" id="build-log" aria-live="polite" aria-label="Build log"></div>' +
      '<div class="build-cta" id="build-cta" hidden>' +
        '<p class="microcopy" style="margin-bottom:14px">Your company is live in this demo.</p>' +
        '<a class="btn btn-primary" href="#/dashboard">Launch dashboard</a>' +
      '</div>'
    );
    var log = $('#build-log', app);
    function logLine(text) {
      var d = document.createElement('div');
      d.innerHTML = '<span class="t">[' + nowTime() + ']</span>' + esc(text);
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }

    logLine('DreamCorp build engine starting\u2026');
    var totalMs = 9000, started = Date.now();
    var per = BUILD_AGENTS.map(function () { return { done: 0 }; });

    var tick = setInterval(function () {
      var elapsed = Date.now() - started;
      var overall = Math.min(1, elapsed / totalMs);
      var finished = true;
      BUILD_AGENTS.forEach(function (a, i) {
        var p = Math.min(1, overall * rand(0.92, 1.06));
        var bar = document.getElementById('prog-' + i);
        if (bar) bar.style.width = Math.round(p * 100) + '%';
        var taskCount = a.tasks.length;
        var doneCount = Math.floor(p * taskCount);
        var lis = $$('li[data-agent="' + i + '"]', app);
        lis.forEach(function (li, j) {
          li.className = j < doneCount ? 'done' : j === doneCount && p < 1 ? 'active' : '';
        });
        while (per[i].done < doneCount) {
          logLine(a.name + ': ' + a.logs[per[i].done].replace('{model}', co.model || 'business'));
          per[i].done++;
        }
        if (p < 1) finished = false;
      });
      if (finished) {
        clearInterval(tick);
        BUILD_AGENTS.forEach(function (a, i) {
          var bar = document.getElementById('prog-' + i);
          if (bar) bar.style.width = '100%';
          $$('li[data-agent="' + i + '"]', app).forEach(function (li) { li.className = 'done'; });
        });
        logLine('Build complete. ' + (co.name || 'Your company') + ' is live.');
        var cta = $('#build-cta', app);
        if (cta) { cta.hidden = false; var btn = $('a', cta); if (btn) btn.focus(); }
      }
    }, 220);
    timers.push(tick);
  }

  /* ---------- dashboard (#/dashboard) ---------- */
  var dash = null;

  function defaultStats() { return { revenue: rand(20, 80), visitors: Math.round(rand(40, 160)), orders: Math.round(rand(2, 9)), cycles: Math.round(rand(30, 120)) }; }
  function defaultAgents() { var o = {}; AGENT_ROSTER.forEach(function (a) { o[a.role] = true; }); return o; }
  function defaultTasks() {
    return [
      { title: 'Publish launch announcement', agent: 'Marketer', status: 'done' },
      { title: 'Set up checkout page', agent: 'Builder', status: 'done' },
      { title: 'Draft welcome email sequence', agent: 'Marketer', status: 'in-progress' },
      { title: 'Design pricing page', agent: 'Designer', status: 'in-progress' },
      { title: 'Research 20 competitor sites', agent: 'CEO Agent', status: 'queued' },
      { title: 'Answer open support tickets', agent: 'Support', status: 'queued' }
    ];
  }

  function renderDashboard() {
    var co = store.get('company', null);
    if (!co) {
      app.innerHTML = '<div class="dash"><div class="empty-dash">' +
        '<h1>No company yet</h1><p class="microcopy">Found your first company to unlock the dashboard.</p>' +
        '<div class="card"><a class="btn btn-primary" href="#/new">Start the founding wizard</a></div>' +
      '</div></div>';
      return;
    }
    dash = {
      co: co,
      stats: store.get('stats', defaultStats()),
      agentsOn: store.get('agents', defaultAgents()),
      tasks: store.get('tasks', defaultTasks()),
      chat: store.get('chat', []),
      revData: store.get('revData', null),
      tab: 'overview'
    };
    if (!dash.revData) {
      dash.revData = [];
      var v = dash.stats.revenue * 0.6;
      for (var i = 0; i < 30; i++) { v = Math.max(5, v + rand(-6, 10)); dash.revData.push(v); }
      store.set('revData', dash.revData);
    }

    app.innerHTML =
      '<div class="dash">' +
        '<div class="dash-head"><h1>' + esc(co.name) + '</h1>' +
        '<span class="pill"><span class="dot"></span>Demo mode</span></div>' +
        '<p class="dash-sub">' + esc(co.mission) + '</p>' +
        '<div class="tabs" role="tablist" aria-label="Dashboard sections">' +
          '<button class="tab" role="tab" data-tab="overview" aria-selected="true">Overview</button>' +
          '<button class="tab" role="tab" data-tab="agents" aria-selected="false">Agents</button>' +
          '<button class="tab" role="tab" data-tab="tasks" aria-selected="false">Tasks</button>' +
          '<button class="tab" role="tab" data-tab="chat" aria-selected="false">Chat</button>' +
        '</div>' +
        '<div id="dash-body" role="tabpanel"></div>' +
        '<div class="dash-foot">' +
          '<button class="btn btn-ghost btn-sm" id="reset-demo">Reset demo</button>' +
          '<p class="microcopy" style="margin-top:10px">Clears your company, stats, and chat from this browser.</p>' +
        '</div>' +
      '</div>';

    $$('.tab', app).forEach(function (t) {
      t.addEventListener('click', function () {
        dash.tab = t.getAttribute('data-tab');
        $$('.tab', app).forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        renderDashTab();
      });
    });
    $('#reset-demo', app).addEventListener('click', function () {
      if (confirm('Reset the demo? Your company, stats, and chat will be cleared.')) {
        ['company', 'stats', 'agents', 'tasks', 'chat', 'revData', 'prefill'].forEach(function (k) { store.del(k); });
        location.hash = '#/';
      }
    });
    renderDashTab();
    startDashSim();
  }

  function renderDashTab() {
    var body = $('#dash-body', app);
    if (!body) return;
    if (dash.tab === 'overview') body.innerHTML = overviewHTML();
    else if (dash.tab === 'agents') body.innerHTML = agentsHTML();
    else if (dash.tab === 'tasks') body.innerHTML = tasksHTML();
    else if (dash.tab === 'chat') body.innerHTML = chatHTML();

    if (dash.tab === 'overview') { drawChart(); seedFeed(); }
    if (dash.tab === 'agents') bindAgentToggles();
    if (dash.tab === 'tasks') bindTaskForm();
    if (dash.tab === 'chat') bindCeoChat();
  }

  /* ----- overview ----- */
  function overviewHTML() {
    var s = dash.stats;
    return '' +
    '<div class="stat-cards">' +
      '<div class="stat-card"><div class="k">Revenue</div><div class="v up" id="st-revenue">' + fmtMoney(s.revenue) + '</div></div>' +
      '<div class="stat-card"><div class="k">Visitors</div><div class="v" id="st-visitors">' + fmtInt(s.visitors) + '</div></div>' +
      '<div class="stat-card"><div class="k">Orders</div><div class="v" id="st-orders">' + fmtInt(s.orders) + '</div></div>' +
      '<div class="stat-card"><div class="k">Agent cycles</div><div class="v" id="st-cycles">' + fmtInt(s.cycles) + '</div></div>' +
    '</div>' +
    '<div class="chart-card"><h3>Revenue trend</h3>' +
      '<p class="microcopy">Simulated data \u00b7 last 30 intervals</p>' +
      '<canvas id="rev-chart" aria-label="Simulated revenue chart" role="img"></canvas></div>' +
    '<div class="feed"><h3>Live agent activity</h3><ul class="feed-list" id="feed-list" aria-live="polite"></ul></div>';
  }

  function drawChart() {
    var cv = $('#rev-chart', app);
    if (!cv) return;
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight || 220;
    cv.width = w * dpr; cv.height = h * dpr;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    var data = dash.revData;
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var pad = 12, span = (max - min) || 1;
    function X(i) { return pad + (i / (data.length - 1)) * (w - pad * 2); }
    function Y(v) { return h - pad - ((v - min) / span) * (h - pad * 2); }
    var grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#6366f1'); grad.addColorStop(0.55, '#a855f7'); grad.addColorStop(1, '#22d3ee');
    /* fill */
    ctx.beginPath();
    ctx.moveTo(X(0), h - pad);
    data.forEach(function (v, i) { ctx.lineTo(X(i), Y(v)); });
    ctx.lineTo(X(data.length - 1), h - pad);
    ctx.closePath();
    var fg = ctx.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, 'rgba(168,85,247,0.35)'); fg.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = fg; ctx.fill();
    /* line */
    ctx.beginPath();
    data.forEach(function (v, i) { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); });
    ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    /* last point */
    ctx.beginPath();
    ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee'; ctx.fill();
  }

  function seedFeed() {
    var list = $('#feed-list', app);
    if (!list) return;
    for (var i = 0; i < 4; i++) pushFeedEvent(list, true);
  }

  function pushFeedEvent(list, silent) {
    var on = AGENT_ROSTER.filter(function (a) { return dash.agentsOn[a.role]; });
    if (!on.length) return;
    var agent = pick(on);
    var evt = pick(FEED_EVENTS.filter(function (e) { return e[0] === agent.role; }).concat([FEED_EVENTS.map(function (e) { return [agent.role, e[1]]; })[0]]));
    var text = evt ? evt[1] : 'completed a routine cycle';
    var li = document.createElement('li');
    li.innerHTML = '<span class="t">' + nowTime() + '</span><strong>' + esc(agent.role) + '</strong> ' + esc(text);
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 12) list.removeChild(list.lastChild);
    if (!silent && dash.tab === 'overview') { /* aria-live handles announcement */ }
  }

  /* ----- agents ----- */
  function agentsHTML() {
    return '<div class="agent-grid">' + AGENT_ROSTER.map(function (a) {
      var on = dash.agentsOn[a.role] !== false;
      return '<div class="agent-card' + (on ? '' : ' off') + '">' +
        '<div class="agent-top"><div class="agent-ava" aria-hidden="true">' + esc(a.role.charAt(0)) + '</div>' +
        '<div><h3>' + esc(a.role) + '</h3><div class="agent-role">AI agent</div></div>' +
        '<span class="status ' + (on ? 'working' : 'idle') + '">' + (on ? 'working' : 'idle') + '</span></div>' +
        '<p class="agent-task">' + (on ? esc(a.task) : 'Paused \u2014 enable to resume work.') + '</p>' +
        '<label class="switch"><input type="checkbox" data-agent="' + esc(a.role) + '"' + (on ? ' checked' : '') + ' aria-label="Toggle ' + esc(a.role) + '"><span class="track"></span>Active</label>' +
      '</div>';
    }).join('') + '</div>' +
    '<p class="microcopy" style="margin-top:16px">Toggling an agent off pauses its activity in the live feed and task pipeline.</p>';
  }

  function bindAgentToggles() {
    $$('input[data-agent]', app).forEach(function (box) {
      box.addEventListener('change', function () {
        var role = box.getAttribute('data-agent');
        dash.agentsOn[role] = box.checked;
        store.set('agents', dash.agentsOn);
        var card = box.closest('.agent-card');
        var status = $('.status', card);
        card.classList.toggle('off', !box.checked);
        status.textContent = box.checked ? 'working' : 'idle';
        status.className = 'status ' + (box.checked ? 'working' : 'idle');
        $('.agent-task', card).textContent = box.checked
          ? AGENT_ROSTER.filter(function (a) { return a.role === role; })[0].task
          : 'Paused \u2014 enable to resume work.';
      });
    });
  }

  /* ----- tasks ----- */
  function tasksHTML() {
    var items = dash.tasks.map(function (t, i) {
      return '<li><span class="t-title">' + esc(t.title) + '</span>' +
        '<span class="t-agent">' + esc(t.agent) + '</span>' +
        '<span class="task-pill ' + esc(t.status) + '">' + esc(t.status.replace('-', ' ')) + '</span></li>';
    }).join('');
    return '<ul class="task-list" id="task-list">' + items + '</ul>' +
      '<form class="assign-row" id="assign-form">' +
        '<label class="visually-hidden" for="assign-input">Assign a new task</label>' +
        '<input class="text-input" id="assign-input" type="text" placeholder="Assign a task, e.g. Write a pricing FAQ\u2026" autocomplete="off">' +
        '<button class="btn btn-primary" type="submit">Assign task</button>' +
      '</form>' +
      '<p class="microcopy" style="margin-top:12px">An available agent picks up new tasks automatically. Agents complete work over time.</p>';
  }

  function bindTaskForm() {
    $('#assign-form', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#assign-input', app);
      var v = input.value.trim();
      if (!v) { input.focus(); return; }
      var on = AGENT_ROSTER.filter(function (a) { return dash.agentsOn[a.role]; });
      var agent = on.length ? pick(on).role : 'CEO Agent';
      dash.tasks.push({ title: v, agent: agent, status: 'queued' });
      store.set('tasks', dash.tasks);
      input.value = '';
      renderDashTab();
    });
  }

  /* ----- chat ----- */
  function chatHTML() {
    return '<div class="ceo-card"><div class="ceo-head">' +
      '<div class="agent-ava" aria-hidden="true">C</div>' +
      '<div><h3>Talk to your CEO agent</h3><p>Ask about revenue, priorities, or what the team is doing.</p></div></div>' +
      '<div class="ceo-body"><div class="chat-box" id="ceo-chat" aria-live="polite"></div>' +
      '<form class="chat-input" id="ceo-form">' +
        '<label class="visually-hidden" for="ceo-input">Message your CEO agent</label>' +
        '<input class="text-input" id="ceo-input" type="text" placeholder="Ask anything, e.g. How is revenue?" autocomplete="off">' +
        '<button class="btn btn-primary" type="submit">Send</button>' +
      '</form></div></div>';
  }

  function bindCeoChat() {
    var box = $('#ceo-chat', app);
    dash.chat.forEach(function (m) { addMsg(box, m.who, esc(m.text)); });
    if (!dash.chat.length) {
      addMsg(box, 'agent', 'Hello! I\u2019m the CEO agent of <strong>' + esc(dash.co.name) + '</strong>. The team is running smoothly \u2014 ask me anything about the business.');
      saveChat();
    }
    $('#ceo-form', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#ceo-input', app);
      var v = input.value.trim();
      if (!v) { input.focus(); return; }
      addMsg(box, 'user', esc(v));
      input.value = '';
      dash.chat.push({ who: 'user', text: v });
      agentSay(box, '&hellip;', 600).then(function (node) {
        var reply = ceoReply(v);
        node.innerHTML = '<span class="who">CEO Agent</span><span>' + reply + '</span>';
        box.scrollTop = box.scrollHeight;
        dash.chat.push({ who: 'agent', text: reply.replace(/<[^>]*>/g, '') });
        saveChat();
      });
    });
  }

  function saveChat() { store.set('chat', dash.chat.slice(-40)); }

  function ceoReply(text) {
    var t = text.toLowerCase();
    var s = dash.stats, co = dash.co;
    var on = AGENT_ROSTER.filter(function (a) { return dash.agentsOn[a.role]; }).map(function (a) { return a.role; });
    if (/\b(hi|hello|hey|yo|good (morning|evening|afternoon))\b/.test(t))
      return 'Hello! Great to see you. <strong>' + esc(co.name) + '</strong> is humming along \u2014 ' + on.length + ' of ' + AGENT_ROSTER.length + ' agents are active right now.';
    if (t.indexOf('revenue') > -1 || t.indexOf('money') > -1 || t.indexOf('sales') > -1 || t.indexOf('earning') > -1)
      return 'Revenue stands at <strong>' + fmtMoney(s.revenue) + '</strong> across ' + fmtInt(s.orders) + ' orders. The trend is upward \u2014 I\u2019ve asked the Marketer to double down on what\u2019s working.';
    if (t.indexOf('working on') > -1 || t.indexOf('what are you') > -1 || t.indexOf('status') > -1 || t.indexOf('priorities') > -1)
      return 'Current focus: ' + esc(on.length ? on.slice(0, 3).join(', ') + ' are driving today\u2019s plan' : 'the team is paused \u2014 flip an agent back on in the Agents tab') + '. Top priority is converting this week\u2019s ' + fmtInt(s.visitors) + ' visitors into customers.';
    if (t.indexOf('task') > -1)
      return 'The team has ' + dash.tasks.filter(function (x) { return x.status !== 'done'; }).length + ' open tasks. ' +
        (dash.tasks.filter(function (x) { return x.status === 'in-progress'; }).map(function (x) { return esc(x.title); }).slice(0, 2).join(' and ') || 'Everything queued is moving') + ' \u2014 assign more from the Tasks tab any time.';
    if (t.indexOf('idea') > -1 || t.indexOf('business') > -1 || t.indexOf('company') > -1 || t.indexOf('mission') > -1)
      return 'Our mission: <em>' + esc(co.mission) + '</em> We serve ' + esc(co.audience) + ' with a ' + esc(co.model) + ' model at ' + esc(co.price) + '.';
    if (t.indexOf('price') > -1 || t.indexOf('pricing') > -1 || t.indexOf('cost') > -1)
      return 'We\u2019re positioned at <strong>' + esc(co.price) + '</strong>. I\u2019m running a pricing experiment this week to test whether a small increase lifts revenue per visitor.';
    if (t.indexOf('customer') > -1 || t.indexOf('audience') > -1 || t.indexOf('visitor') > -1)
      return 'We\u2019ve had ' + fmtInt(s.visitors) + ' visitors so far. Our core audience: ' + esc(co.audience) + '. Support is keeping response times under a minute.';
    if (t.indexOf('thank') > -1)
      return 'Anytime! I\u2019ll keep the team focused while you\u2019re away.';
    if (t.indexOf('bye') > -1 || t.indexOf('good night') > -1 || t.indexOf('goodnight') > -1)
      return 'Good night! The night shift is my favorite \u2014 I\u2019ll have a fresh report for you in the morning.';
    if (t.indexOf('help') > -1)
      return 'Try asking me: \u201cHow is revenue?\u201d, \u201cWhat are you working on?\u201d, \u201cTell me about our customers\u201d, or \u201cWhat\u2019s our pricing?\u201d';
    var fallbacks = [
      'Noted \u2014 I\u2019ve added that to my review list for tomorrow\u2019s planning cycle. Anything else on ' + esc(co.name) + '?',
      'Interesting thought. I\u2019ll have the team evaluate it against our current numbers (' + fmtMoney(s.revenue) + ' revenue so far).',
      'I\u2019m on it. In the meantime, revenue is ' + fmtMoney(s.revenue) + ' and the team is executing today\u2019s plan.'
    ];
    return pick(fallbacks);
  }

  /* ----- live simulation: stats, feed, tasks ----- */
  function startDashSim() {
    every(3000, function () {
      if (!dash) return;
      var s = dash.stats;
      s.revenue += rand(1, 14);
      s.visitors += Math.round(rand(1, 9));
      if (Math.random() < 0.35) s.orders += 1;
      s.cycles += Math.round(rand(2, 12));
      store.set('stats', s);
      dash.revData.push(s.revenue);
      dash.revData.shift();
      store.set('revData', dash.revData);
      var r = $('#st-revenue', app);
      if (r) {
        r.textContent = fmtMoney(s.revenue);
        $('#st-visitors', app).textContent = fmtInt(s.visitors);
        $('#st-orders', app).textContent = fmtInt(s.orders);
        $('#st-cycles', app).textContent = fmtInt(s.cycles);
        drawChart();
      }
    });

    every(5000, function () {
      if (!dash) return;
      var list = $('#feed-list', app);
      if (list) pushFeedEvent(list);
    });

    every(8000, function () {
      if (!dash) return;
      var changed = false;
      var inProg = dash.tasks.filter(function (t) { return t.status === 'in-progress' && dash.agentsOn[t.agent] !== false; });
      if (inProg.length) { inProg[0].status = 'done'; changed = true; }
      var queued = dash.tasks.filter(function (t) { return t.status === 'queued' && dash.agentsOn[t.agent] !== false; });
      if (queued.length) { queued[0].status = 'in-progress'; changed = true; }
      if (!dash.tasks.some(function (t) { return t.status === 'queued'; }) && Math.random() < 0.5) {
        var on = AGENT_ROSTER.filter(function (a) { return dash.agentsOn[a.role]; });
        if (on.length) {
          var agent = pick(on);
          dash.tasks.push({ title: pick(TASK_POOL), agent: agent.role, status: 'queued' });
          changed = true;
        }
      }
      if (changed) {
        store.set('tasks', dash.tasks);
        if (dash.tab === 'tasks') renderDashTab();
      }
    });
  }

  /* ---------- init ---------- */
  window.addEventListener('hashchange', route);
  route();
})();
