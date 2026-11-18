(function initResearchReader(){
  'use strict';
  const main = document.getElementById('main');
  const embedded = document.getElementById('research-data');
  const data = embedded ? JSON.parse(embedded.textContent) : null;
  if (!data || !Array.isArray(data.reports) || !Array.isArray(data.topics)) {
    if (!main.querySelector('.reading-copy')) main.innerHTML = '<div class="page-heading"><h1>AI 研究观察台</h1><p class="empty">提醒资料暂时无法加载，请刷新页面重试。</p></div>';
    return;
  }
  const {reports, topics} = data;
  const topicMap = new Map(topics.map(t => [t.id,t]));
  const reportMap = new Map(reports.map(r => [r.id,r]));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const reportURL = id => '#report/' + encodeURIComponent(id);
  const topicURL = id => '#topic/' + encodeURIComponent(id);
  const arrow = '<span class="arrow" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></span>';
  const dial = '<span class="topic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l3 2h9v11H3z"/><path d="M7 13h9"/></svg></span>';
  const count = topic => reports.filter(r=>r.topic===topic).length;
  const zhDate = date => String(date || '').replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1 年 $2 月 $3 日');
  const tag = value => value ? `<span class="tag ${/暂停|停用|结束|异常|归档/.test(value) ? 'paused' : ''}">${escape(value)}</span>` : '';
  const homeBack = () => `<a class="back" href="#home">${arrow}提醒总览</a>`;
  let limit=8;
  let filter='';
  let lastRoute = null;
  let noticeTimer;
  document.getElementById('footer-date').textContent='资料截至 '+zhDate(data.asOf);
  function urlChecked(raw){
    try{
      const u = new URL(raw);
      return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
    }catch{return null;}
  }
  function inline(raw){
    // Only explicit emphasis and safe links receive markup. Everything else stays plain text.
    const source=String(raw ?? '');
    let start=0, result='';
    for(const match of source.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*/g)){
      result+=escape(source.slice(start,match.index));
      const href=match[2] && urlChecked(match[2]);
      result+=match[3] ? `<strong>${escape(match[3])}</strong>` : href ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(match[1])}</a>` : escape(match[1]);
      start=match.index+match[0].length;
    }
    return result+escape(source.slice(start));
  }
  function row(r){
    const t=topicMap.get(r.topic);
    const [year,month,day]=String(r.date).split('-');
    const stamp = month && day ? `<span class="date-number">${escape(month)}.${escape(day)}</span><small>${escape(year)}</small>` : escape(r.date);
    return `<a class="report-row" href="${escape(reportURL(r.id))}"><time class="date-stamp" datetime="${escape(r.date)}">${stamp}</time><div><div class="row-category">${escape(t?.name ?? '')}</div><h3 class="row-title">${escape(r.title)}</h3><p class="row-summary">${escape(r.summary)}</p></div><span class="row-arrow">${arrow}</span></a>`;
  }
  function feature(r){
    if(!r)return '';
    const name=topicMap.get(r.topic)?.name;
    return `<article class="feature"><div class="feature-body"><div class="feature-meta"><span class="feature-label">本期主文</span><span>${escape(name)}</span><time datetime="${escape(r.date)}">· ${escape(r.date)}</time></div><h2><a href="${escape(reportURL(r.id))}">${escape(r.title)}</a></h2><p class="feature-summary">${escape(r.summary)}</p><a class="feature-link" href="${escape(reportURL(r.id))}">阅读提醒 ${arrow}</a></div><img class="feature-art" src="surface.svg" alt="" aria-hidden="true" width="560" height="340"></article>`;
  }
  function miniTopic(t){
    const meta = [t.status,t.schedule].filter(Boolean).join(' · ');
    return `<a class="topic-mini" href="${escape(topicURL(t.id))}">${dial}<div><span class="mini-name">${escape(t.name)}</span><span class="mini-meta">${escape(meta)}</span></div></a>`;
  }
  function renderArchive(){
    const archive=document.getElementById('archive-rows');
    if(!archive)return;
    const list=filter ? reports.filter(r=>r.topic===filter) : reports;
    const t=topicMap.get(filter);
    archive.innerHTML=list.slice(0,limit).map(row).join('') || '<p class="empty">此专题尚未收录可供阅读的提醒正文。</p>';
    if(t)archive.insertAdjacentHTML('beforeend',`<a class="text-link directory-link" href="${escape(topicURL(t.id))}">查看专题设置与跟踪范围 ${arrow}</a>`);
    if(list.length>limit)archive.insertAdjacentHTML('beforeend',`<div><button type="button" class="more" id="load-more">查看更早的提醒（余 ${list.length-limit} 篇）</button></div>`);
    document.getElementById('load-more')?.addEventListener('click',()=>{const firstNew=limit;limit+=8;renderArchive();archive.querySelectorAll('.report-row')[firstNew]?.focus();});
  }
  function home(){
    main.innerHTML=`<div class="masthead"><h1>研究提醒</h1><div class="as-of">资料截至 <time datetime="${escape(data.asOf)}">${escape(zhDate(data.asOf))}</time></div></div>${feature(reports[0])}<div class="home-grid"><section aria-labelledby="archive-heading"><div class="section-heading"><h2 id="archive-heading">提醒记录</h2><label class="select-wrap"><span class="sr-only">按专题筛选</span><select id="topic-filter"><option value="">全部专题</option>${topics.map(t=>`<option value="${escape(t.id)}">${escape(t.name)}</option>`).join('')}</select></label></div><p class="section-note">已收录 ${reports.length} 篇 · 北京时间</p><div id="archive-rows"></div></section><aside aria-labelledby="topic-heading"><div class="section-heading"><h2 id="topic-heading">跟踪专题</h2><a href="#topics" class="text-link">全部 ${topics.length} 项 ${arrow}</a></div>${topics.slice(0,4).map(miniTopic).join('')}${topics.length>4?`<a class="text-link directory-link" href="#topics">查看完整专题目录 ${arrow}</a>`:''}</aside></div>`;
    const select=document.getElementById('topic-filter');
    select.value=filter;
    select.addEventListener('change',()=>{filter=select.value;limit=8;renderArchive();});
    renderArchive();
  }
  function directory(){
    main.innerHTML=`<div class="page-heading">${homeBack()}<h1>专题目录</h1><div class="page-details"><span>${topics.length} 项提醒设置</span><span>资料截至 ${escape(zhDate(data.asOf))}</span></div></div><div class="directory-grid">${topics.map(t=>`<article class="topic-card"><h2><a href="${escape(topicURL(t.id))}">${escape(t.name)}</a></h2><div class="page-details" style="margin-top:0">${tag(t.status)}<span class="schedule">${escape(t.schedule)}</span></div><p>${inline(t.description)}</p><a class="text-link" href="${escape(topicURL(t.id))}">进入专题 · ${count(t.id)} 篇提醒 ${arrow}</a></article>`).join('')}</div>`;
  }
  function topicPage(t){
    const list=reports.filter(r=>r.topic===t.id);
    main.innerHTML=`<div class="topic-detail"><div class="page-heading"><a class="back" href="#topics">${arrow}专题目录</a><h1>${escape(t.name)}</h1><div class="page-details">${tag(t.status)}<span>${escape(t.schedule)}</span></div></div><div class="topic-description">${inline(t.description)}</div><div class="section-heading"><h2>专题提醒记录</h2><span class="schedule">${list.length} 篇</span></div>${list.length?list.map(row).join(''):'<p class="empty">截至本页收录日期，此专题尚无可供阅读的提醒正文。</p>'}</div>`;
  }
  function article(r){
    const t=topicMap.get(r.topic);
    const sections = (r.sections || []).map(section=>`<section>${section.heading ? `<h2>${escape(section.heading)}</h2>`:''}${(section.paragraphs||[]).map(p=>`<p>${inline(p)}</p>`).join('')}</section>`).join('');
    const sources=(r.sources || []).map(s=>({...s,safeURL:urlChecked(s.url)})).filter(s=>s.safeURL);
    main.innerHTML=`<article class="article">${homeBack()}<div class="article-meta">${t ? `<a href="${escape(topicURL(t.id))}">${escape(t.name)}</a>`:''}<time class="article-date" datetime="${escape(r.date)}">${escape(zhDate(r.date))} ${escape(r.time||'')}</time>${r.time?'<span>北京时间</span>':''}</div><h1>${escape(r.title)}</h1>${r.summary ? `<p class="standfirst">${inline(r.summary)}</p>`:''}${sections}${sources.length ? `<section class="source-list"><h2>来源与延伸阅读</h2><ol>${sources.map(s=>`<li><a href="${escape(s.safeURL)}" target="_blank" rel="noopener noreferrer">${escape(s.name || new URL(s.safeURL).hostname)}<span class="external" aria-hidden="true">↗</span></a></li>`).join('')}</ol></section>`:''}<div class="article-actions">${homeBack()}<button data-share type="button" class="share-button">复制本篇链接 ${arrow}</button></div></article>`;
  }
  function route(){
    const hash=location.hash.slice(1);
    if(hash==='main' && lastRoute!==null){main.focus();return;}
    const [part,raw='']=hash.split('/');
    let id;
    try{id=decodeURIComponent(raw);}catch{id='';}
    const isTopic=part==='topics'||part==='topic';
    const targetReport=part==='report'&&reportMap.get(id);
    const targetTopic=part==='topic'&&topicMap.get(id);
    const showHome=!hash||hash==='home'||hash==='main';
    let title='提醒总览';
    if(targetReport){article(targetReport);title=targetReport.title;}
    else if(targetTopic){topicPage(targetTopic);title=targetTopic.name;}
    else if(part==='topics'){directory();title='专题目录';}
    else if(showHome){home();}
    else {main.innerHTML=`<div class="page-heading">${homeBack()}<h1>未找到这条记录</h1><p class="empty">可以返回提醒总览，或从专题目录继续查找。</p></div>`;title='未找到记录';}
    document.title=title+' · AI 研究观察台';
    for(const nav of document.querySelectorAll('nav a')){
      const active=(nav.id==='nav-topics'&&isTopic)||(nav.id==='nav-home'&&(showHome||!!targetReport));
      nav.classList.toggle('active',active);
      if(active)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');
    }
    if(lastRoute!==null){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
    lastRoute=hash;
  }
  function notice(message){
    const n=document.getElementById('notice');
    n.textContent=message;n.classList.add('visible');clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>n.classList.remove('visible'),2200);
  }
  async function share(){
    const canonical = new URL(location.href);
    canonical.search = '';
    canonical.hash = '';
    let id;
    const match = /^#(report|topic)\/([^/]+)$/.exec(location.hash);
    if(match){
      try {id = decodeURIComponent(match[2]);} catch {}
      if(match[1] === 'report' && reportMap.has(id)) canonical.hash = reportURL(id);
      if(match[1] === 'topic' && topicMap.has(id)) canonical.hash = topicURL(id);
    } else if (location.hash === '#topics') canonical.hash = 'topics';
    const url = canonical.href;
    try{
      if(!navigator.clipboard?.writeText)throw new Error();
      await navigator.clipboard.writeText(url);
      notice('链接已复制');
    }catch{
      const dialog=document.getElementById('share-dialog'),field=document.getElementById('link-field');
      field.value=url;
      if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
      field.focus();field.select();
    }
  }
  document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
  document.addEventListener('click',event=>{if(event.target.closest('[data-share]'))share();});
  window.addEventListener('hashchange',route);
  route();
  document.querySelector('.topbar [data-share]').hidden = false;
})();
