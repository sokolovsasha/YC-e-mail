(function () {
  'use strict';

  const PREFIX = '[YC-Email]';
  const EMOJI = '✉️';
  const DONE_ATTR = 'data-yc-email';
  const BTN_ATTR = 'data-yc-email-btn';
  const BTN_HANDLED = 'data-yc-email-handled';
  const EMAIL_STR = '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}';
  const EMAIL_TEST = new RegExp(EMAIL_STR);
  const EMAIL_GLOBAL = new RegExp(EMAIL_STR, 'g');
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE', 'OPTION', 'NOSCRIPT', 'CODE', 'PRE']);

  console.log(PREFIX, 'loaded on', location.href);

  // ---------- обработка обычных текстовых узлов ----------
  function shouldSkip(el) {
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.closest('a[href^="mailto:"]')) return true;
    if (el.closest('[' + DONE_ATTR + ']')) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.indexOf('@') === -1) return;

    const parent = node.parentElement;
    if (shouldSkip(parent)) return;
    if (!EMAIL_TEST.test(text)) return;

    const frag = document.createDocumentFragment();
    let last = 0;
    EMAIL_GLOBAL.lastIndex = 0;
    let m, count = 0;

    while ((m = EMAIL_GLOBAL.exec(text)) !== null) {
      count++;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const email = m[0];
      const a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = EMOJI + ' ' + email;
      a.style.color = 'inherit';
      a.style.textDecoration = 'none';
      a.style.cursor = 'pointer';
      frag.appendChild(a);
      last = m.index + email.length;
    }

    if (!count) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

    const span = document.createElement('span');
    span.setAttribute(DONE_ATTR, '1');
    span.appendChild(frag);
    parent.replaceChild(span, node);
    console.log(PREFIX, 'wrapped', count, 'email(s) in', parent.tagName);
  }

  // ---------- обработка <input name="email"> ----------
  function updateBtn(input, btn) {
    const v = (input.value || '').trim();
    const isEmail = v && EMAIL_TEST.test(v);
    btn.style.display = isEmail ? 'inline-block' : 'none';
    btn.setAttribute('href', isEmail ? 'mailto:' + v : '#');
    btn.setAttribute('title', isEmail ? 'Написать письмо на ' + v : '');
  }

  function handleEmailInput(input) {
    if (!input || input.tagName !== 'INPUT') return;
    if (input.type !== 'text' && input.type !== 'email') return;

    // Уже обработан — просто обновляем состояние кнопки
    if (input.hasAttribute(BTN_HANDLED)) {
      const btn = input.nextElementSibling;
      if (btn && btn.hasAttribute(BTN_ATTR)) updateBtn(input, btn);
      return;
    }

    // Пропускаем, если рядом с полем ничего нет (пустой контейнер)
    if (!input.parentNode) return;

    input.setAttribute(BTN_HANDLED, '1');

    const btn = document.createElement('a');
    btn.setAttribute(BTN_ATTR, '1');
    btn.textContent = EMOJI;
    btn.style.cssText =
      'cursor:pointer;margin-left:6px;text-decoration:none;font-size:16px;' +
      'display:inline-block;vertical-align:middle;line-height:1;';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = (input.value || '').trim();
      if (email && EMAIL_TEST.test(email)) {
        window.location.href = 'mailto:' + email;
      }
    });

    // Если поле readonly/disabled — открываем почту и по клику на само поле
    if (input.readOnly || input.disabled) {
      input.style.cursor = 'pointer';
      input.addEventListener('click', (e) => {
        const email = (input.value || '').trim();
        if (email && EMAIL_TEST.test(email)) {
          window.location.href = 'mailto:' + email;
        }
      });
    }

    input.addEventListener('input', () => updateBtn(input, btn));
    input.addEventListener('change', () => updateBtn(input, btn));

    input.parentNode.insertBefore(btn, input.nextSibling);
    updateBtn(input, btn);
    console.log(PREFIX, 'email input handler attached');
  }

  // ---------- обход DOM ----------
  function walk(root) {
    if (!root) return;
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (n.shadowRoot) stack.push(n.shadowRoot);

      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.tagName === 'INPUT') {
          try { handleEmailInput(n); } catch (e) { console.warn(PREFIX, e); }
        }
        const kids = n.childNodes;
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      } else if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE ||
                 n.nodeType === Node.DOCUMENT_NODE) {
        const kids = n.childNodes;
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      } else if (n.nodeType === Node.TEXT_NODE) {
        try { processTextNode(n); } catch (e) { console.warn(PREFIX, e); }
      }
    }
  }

  // ---------- наблюдатели и периодика ----------
  let observer = null;
  let intervalId = null;

  function startObserving() {
    if (!document.body || observer) return;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) walk(n);
        } else if (m.type === 'characterData') {
          walk(m.target);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log(PREFIX, 'observer installed');
  }

  function refreshInputButtons() {
    // Фреймворки пишут в .value без event — обновляем вручную
    document.querySelectorAll('[' + BTN_HANDLED + ']').forEach(input => {
      const btn = input.nextElementSibling;
      if (btn && btn.hasAttribute(BTN_ATTR)) updateBtn(input, btn);
    });
  }

  function initialScan() {
    if (!document.body) return;
    console.log(PREFIX, 'initial scan');
    walk(document.body);
    startObserving();

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      const rows = document.querySelectorAll('.ag-row, .ag-center-cols-container > div');
      if (rows.length) rows.forEach(r => walk(r));
      else walk(document.body);
      refreshInputButtons();
    }, 1500);
  }

  // SPA-навигация
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log(PREFIX, 'URL changed → rescan', lastUrl);
      setTimeout(() => { if (document.body) walk(document.body); }, 500);
    }
  }).observe(document, { subtree: true, childList: true });

  window.addEventListener('hashchange', () => {
    console.log(PREFIX, 'hashchange → rescan');
    setTimeout(() => walk(document.body), 300);
  });

  if (document.body) initialScan();
  else document.addEventListener('DOMContentLoaded', initialScan, { once: true });
})();